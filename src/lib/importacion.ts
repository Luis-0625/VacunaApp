import { addDaysISO } from "@/lib/agenda";
import { parseLote, type LoteInput } from "@/lib/inventario";
import { parseVacuna, type VacunaInput } from "@/lib/vacunas";

/**
 * Carga inicial desde Excel: lectura tolerante de columnas y planificación (sin tocar la base) de
 * vacunas, dosis aplicadas y lotes. La ruta /api/importar solo consulta lo existente, ejecuta el plan y guarda.
 */

export type Fila = Record<string, unknown>;
export interface ErrorFila { fila: number; referencia?: string; motivo: string }

/** "Fecha de Nacimiento " -> "fecha_de_nacimiento". */
export const norm = (k: string) =>
  k.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");

/** Para comparar nombres: sin tildes, minúsculas y espacios simples ("Hepatitis  B" = "hepatitis b"). */
export const normNombre = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/** Valor de la primera columna cuyo encabezado coincide con algún alias (ignora vacíos). */
export function pick(row: Fila, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const k = keys.find((x) => norm(x) === alias);
    if (k !== undefined && row[k] !== "" && row[k] != null) return row[k];
  }
  return undefined;
}

/** AAAA-MM-DD, DD/MM/AAAA o serial de Excel -> AAAA-MM-DD. null = vacío; "invalid" = no se entiende. */
export function toISODate(v: unknown): string | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? "invalid" : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "invalid" : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return valida(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  return "invalid";
}

/** Rechaza fechas imposibles como 2026-02-31. */
function valida(iso: string): string | "invalid" {
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : "invalid";
}

/** Entero >= 0 (acepta "3", 3, "3.0"). null = vacío; "invalid" = no es entero. */
export function toEntero(v: unknown): number | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

export const ALIAS = {
  vacuna: {
    nombre: ["nombre", "vacuna", "nombre_vacuna"],
    dosis: ["dosis_totales", "dosis", "numero_de_dosis", "total_dosis"],
    intervalo: ["intervalo_dias", "intervalo_dias_recom_dosis", "intervalo", "dias_entre_dosis"],
    descripcion: ["descripcion", "observaciones", "notas"],
    minimo: ["stock_minimo", "existencias_minimas", "minimo"],
  },
  dosis: {
    documento: ["documento_identidad", "documento", "cedula", "cc", "identificacion"],
    vacuna: ["vacuna", "nombre_vacuna"],
    numero: ["numero_dosis", "dosis", "n_dosis", "numero_de_dosis"],
    fecha: ["fecha_aplicacion", "fecha", "fecha_de_aplicacion"],
    proxima: ["fecha_proxima_dosis", "proxima_dosis", "proxima", "fecha_proxima"],
  },
  lote: {
    vacuna: ["vacuna", "nombre_vacuna"],
    numero: ["numero_lote", "lote"],
    laboratorio: ["laboratorio", "fabricante"],
    vence: ["fecha_vencimiento", "vencimiento", "vence"],
    existencias: ["existencias", "cantidad", "dosis_disponibles", "existencias_actuales", "stock"],
    costo: ["costo_unitario", "costo", "costo_por_dosis"],
  },
};

// ---------------------------------------------------------------------------------------------
// Vacunas

export function planificarVacunas(rows: Fila[], existentes: Set<string>) {
  const errores: ErrorFila[] = [];
  const insertar: VacunaInput[] = [];
  const vistas = new Set<string>();
  let omitidas = 0;

  rows.forEach((row, i) => {
    const fila = i + 2;
    const a = ALIAS.vacuna;
    const nombre = String(pick(row, a.nombre) ?? "").trim();
    const r = parseVacuna({
      nombre, dosis_totales: pick(row, a.dosis) ?? 1, intervalo_dias_recom_dosis: pick(row, a.intervalo),
      descripcion: pick(row, a.descripcion), stock_minimo: pick(row, a.minimo),
    });
    if (!r.ok) return errores.push({ fila, referencia: nombre || undefined, motivo: r.error });
    const k = normNombre(r.data.nombre);
    if (vistas.has(k)) return errores.push({ fila, referencia: nombre, motivo: "Vacuna repetida en el archivo" });
    vistas.add(k);
    if (existentes.has(k)) return void omitidas++;
    insertar.push(r.data);
  });
  return { insertar, omitidas, errores };
}

// ---------------------------------------------------------------------------------------------
// Dosis aplicadas

export interface VacunaRef { id: string; dosis_totales: number; intervalo: number | null }
export interface CitaExistente { paciente_id: string; vacuna_id: string; numero_dosis: number; fecha_aplicacion: string }
export interface DosisPlan {
  fila: number; paciente_id: string; vacuna_id: string; numero_dosis: number;
  fecha_aplicacion: string; fecha_proxima_dosis: string | null;
}

/**
 * Decide qué dosis se insertan. Reglas:
 * - Sin número de dosis, se asigna la siguiente a las ya registradas (en orden de fecha).
 * - Una dosis que ya existe (mismo número o misma fecha para ese paciente y vacuna) se omite: repetir el archivo no duplica.
 * - La última dosis del esquema no lleva próxima. Si falta la próxima, se calcula con el intervalo de la vacuna.
 * - No se aceptan fechas futuras ni superar las dosis totales de la vacuna.
 */
export function planificarDosis(
  rows: Fila[],
  ctx: { hoy: string; vacunas: Map<string, VacunaRef>; pacientes: Map<string, string>; existentes: CitaExistente[] }
) {
  const errores: ErrorFila[] = [];
  let omitidas = 0;
  const a = ALIAS.dosis;

  type Parsed = { fila: number; ref: string; pid: string; vid: string; v: VacunaRef; numero: number | null; fecha: string; proxima: string | null };
  const grupos = new Map<string, Parsed[]>();

  rows.forEach((row, i) => {
    const fila = i + 2;
    const doc = String(pick(row, a.documento) ?? "").trim();
    const nombreVacuna = String(pick(row, a.vacuna) ?? "").trim();
    const fail = (motivo: string) => void errores.push({ fila, referencia: doc || undefined, motivo });

    if (!doc) return fail("Falta documento_identidad");
    if (!nombreVacuna) return fail("Falta la vacuna");
    const pid = ctx.pacientes.get(doc);
    if (!pid) return fail("El paciente no existe: cárgalo primero en la hoja Pacientes");
    const v = ctx.vacunas.get(normNombre(nombreVacuna));
    if (!v) return fail(`La vacuna "${nombreVacuna}" no existe: cárgala primero en la hoja Vacunas`);

    const fecha = toISODate(pick(row, a.fecha));
    if (fecha === null) return fail("Falta fecha_aplicacion");
    if (fecha === "invalid") return fail("fecha_aplicacion inválida (usa AAAA-MM-DD o DD/MM/AAAA)");
    if (fecha > ctx.hoy) return fail("fecha_aplicacion no puede ser futura");
    const numero = toEntero(pick(row, a.numero));
    if (numero === "invalid" || numero === 0) return fail("numero_dosis debe ser un entero mayor que cero");
    if (numero !== null && numero > v.dosis_totales) return fail(`${nombreVacuna} tiene ${v.dosis_totales} dosis: no existe la dosis ${numero}`);
    const proxima = toISODate(pick(row, a.proxima));
    if (proxima === "invalid") return fail("fecha_proxima_dosis inválida (usa AAAA-MM-DD o DD/MM/AAAA)");
    if (proxima !== null && proxima <= fecha) return fail("fecha_proxima_dosis debe ser posterior a la aplicación");

    const k = `${pid}|${v.id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), { fila, ref: doc, pid, vid: v.id, v, numero, fecha, proxima }]);
  });

  const insertar: DosisPlan[] = [];
  for (const [k, items] of grupos) {
    const previas = ctx.existentes.filter((c) => `${c.paciente_id}|${c.vacuna_id}` === k);
    const numerosExistentes = new Set(previas.map((c) => c.numero_dosis));
    const fechasExistentes = new Set(previas.map((c) => c.fecha_aplicacion));
    const numerosArchivo = new Set<number>();
    const fechasArchivo = new Set<string>();
    let maximo = Math.max(0, ...previas.map((c) => c.numero_dosis));

    for (const it of [...items].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.fila - y.fila)) {
      if (fechasExistentes.has(it.fecha) || (it.numero !== null && numerosExistentes.has(it.numero))) { omitidas++; continue; }
      if (fechasArchivo.has(it.fecha) || (it.numero !== null && numerosArchivo.has(it.numero))) {
        errores.push({ fila: it.fila, referencia: it.ref, motivo: "Dosis repetida en el archivo (misma vacuna y fecha o número de dosis)" });
        continue;
      }
      const numero = it.numero ?? maximo + 1;
      if (numero > it.v.dosis_totales) {
        errores.push({ fila: it.fila, referencia: it.ref, motivo: `El paciente ya tiene completo el esquema (${it.v.dosis_totales} dosis)` });
        continue;
      }
      if (numerosExistentes.has(numero) || numerosArchivo.has(numero)) {
        errores.push({ fila: it.fila, referencia: it.ref, motivo: `La dosis ${numero} ya está registrada para este paciente` });
        continue;
      }
      maximo = Math.max(maximo, numero);
      numerosArchivo.add(numero);
      fechasArchivo.add(it.fecha);
      const ultima = numero === it.v.dosis_totales;
      const proxima = ultima ? null : it.proxima ?? (it.v.intervalo ? addDaysISO(it.fecha, it.v.intervalo) : null);
      insertar.push({
        fila: it.fila, paciente_id: it.pid, vacuna_id: it.vid, numero_dosis: numero,
        fecha_aplicacion: it.fecha, fecha_proxima_dosis: proxima,
      });
    }
  }
  insertar.sort((x, y) => x.fila - y.fila);
  return { insertar, omitidas, errores };
}

// ---------------------------------------------------------------------------------------------
// Inventario actual (lotes)

export interface LotePlan extends LoteInput { fila: number; vacuna_id: string; cantidad_inicial: number }

/** `existentes` son claves "vacunaId|lote normalizado" ya registradas. Cada fila trae las existencias de HOY. */
export function planificarLotes(rows: Fila[], ctx: { vacunas: Map<string, VacunaRef>; existentes: Set<string> }) {
  const errores: ErrorFila[] = [];
  const insertar: LotePlan[] = [];
  const vistas = new Set<string>();
  let omitidas = 0;
  const a = ALIAS.lote;

  rows.forEach((row, i) => {
    const fila = i + 2;
    const nombreVacuna = String(pick(row, a.vacuna) ?? "").trim();
    const numero = String(pick(row, a.numero) ?? "").trim();
    const fail = (motivo: string) => void errores.push({ fila, referencia: numero || undefined, motivo });

    const v = ctx.vacunas.get(normNombre(nombreVacuna));
    if (!nombreVacuna) return fail("Falta la vacuna");
    if (!v) return fail(`La vacuna "${nombreVacuna}" no existe: cárgala primero en la hoja Vacunas`);
    const existencias = toEntero(pick(row, a.existencias));
    if (existencias === null || existencias === "invalid") return fail("existencias debe ser un número entero de dosis (0 o más)");
    const vence = toISODate(pick(row, a.vence));
    if (vence === null || vence === "invalid") return fail("fecha_vencimiento inválida (usa AAAA-MM-DD o DD/MM/AAAA)");

    const r = parseLote({
      numero_lote: numero, laboratorio: pick(row, a.laboratorio), fecha_vencimiento: vence,
      costo_unitario: pick(row, a.costo), vacuna_id: v.id, cantidad_inicial: Math.max(existencias, 1),
    }, true);
    if (!r.ok) return fail(r.error);

    const k = `${v.id}|${normNombre(numero)}`;
    if (vistas.has(k)) return fail("Lote repetido en el archivo");
    vistas.add(k);
    if (ctx.existentes.has(k) || existencias === 0) return void omitidas++;
    insertar.push({ ...r.data, fila, vacuna_id: v.id, cantidad_inicial: existencias });
  });
  return { insertar, omitidas, errores };
}
