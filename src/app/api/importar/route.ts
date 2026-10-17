import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/agenda";
import {
  ALIAS, normNombre, pick, planificarDosis, planificarLotes, planificarVacunas,
  type CitaExistente, type ErrorFila, type Fila, type VacunaRef,
} from "@/lib/importacion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILAS = 5000;
const LOTE = 200;
const SECCIONES = ["vacunas", "dosis", "lotes"] as const;
type Seccion = (typeof SECCIONES)[number];

const trozos = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Carga inicial desde la plantilla de Excel, una hoja por petición: { seccion: "vacunas" | "dosis" | "lotes", rows }.
 * (Los pacientes van por /api/pacientes/importar.) Solo ADMIN. Orden recomendado: vacunas, pacientes, dosis y,
 * al final, lotes con las existencias de HOY: las dosis históricas no descuentan del inventario.
 */
export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const seccion = b?.seccion as Seccion;
  const rows = b?.rows as Fila[] | undefined;
  if (!SECCIONES.includes(seccion) || !Array.isArray(rows)) {
    return NextResponse.json({ error: "Se esperaba { seccion: vacunas | dosis | lotes, rows: [...] }" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "La hoja no tiene filas" }, { status: 400 });
  if (rows.length > MAX_FILAS) return NextResponse.json({ error: `Máximo ${MAX_FILAS} filas por hoja` }, { status: 413 });

  const db = createAdminClient();
  const centroId = g.perfil.centro_id;
  try {
    const r = seccion === "vacunas" ? await cargarVacunas(db, centroId, rows)
      : seccion === "dosis" ? await cargarDosis(db, centroId, g.perfil.user_id, rows)
      : await cargarLotes(db, centroId, g.perfil.user_id, rows);
    return NextResponse.json({ total: rows.length, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

interface Resultado { importados: number; omitidas: number; errores: ErrorFila[] }

async function vacunasDelCentro(db: SupabaseClient, centroId: string) {
  const { data, error } = await db.from("vacunas").select("id, nombre, dosis_totales, intervalo_dias_recom_dosis").eq("centro_id", centroId);
  if (error) throw new Error(error.message);
  return new Map<string, VacunaRef>((data ?? []).map((v) => [
    normNombre(v.nombre), { id: v.id, dosis_totales: v.dosis_totales, intervalo: v.intervalo_dias_recom_dosis },
  ]));
}

async function cargarVacunas(db: SupabaseClient, centroId: string, rows: Fila[]): Promise<Resultado> {
  const existentes = new Set((await vacunasDelCentro(db, centroId)).keys());
  const plan = planificarVacunas(rows, existentes);
  for (const parte of trozos(plan.insertar, LOTE)) {
    const { error } = await db.from("vacunas").insert(parte.map((v) => ({ ...v, centro_id: centroId })));
    if (error) throw new Error(`No se pudieron guardar las vacunas: ${error.message}`);
  }
  return { importados: plan.insertar.length, omitidas: plan.omitidas, errores: plan.errores };
}

async function cargarDosis(db: SupabaseClient, centroId: string, userId: string, rows: Fila[]): Promise<Resultado> {
  const vacunas = await vacunasDelCentro(db, centroId);

  // Pacientes del archivo, por documento
  const docs = [...new Set(rows.map((r) => String(pick(r, ALIAS.dosis.documento) ?? "").trim()).filter(Boolean))];
  const pacientes = new Map<string, string>();
  for (const parte of trozos(docs, 300)) {
    const { data, error } = await db.from("pacientes").select("id, documento_identidad")
      .eq("centro_id", centroId).in("documento_identidad", parte);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((p) => pacientes.set(p.documento_identidad, p.id));
  }

  // Dosis que esos pacientes ya tienen
  const existentes: CitaExistente[] = [];
  for (const parte of trozos([...pacientes.values()], 200)) {
    const { data, error } = await db.from("citas_vacunacion").select("id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion")
      .eq("centro_id", centroId).in("paciente_id", parte).neq("estado", "CANCELADA");
    if (error) throw new Error(error.message);
    existentes.push(...(data ?? []));
  }

  const plan = planificarDosis(rows, { hoy: todayISO(), vacunas, pacientes, existentes });
  const errores = [...plan.errores];
  let importados = 0;

  const base = (d: (typeof plan.insertar)[number]) => ({
    centro_id: centroId, paciente_id: d.paciente_id, vacuna_id: d.vacuna_id, numero_dosis: d.numero_dosis,
    fecha_aplicacion: d.fecha_aplicacion, fecha_proxima_dosis: d.fecha_proxima_dosis,
    estado: "COMPLETADA", aplicada_por: userId, externa: false,
  });
  for (const parte of trozos(plan.insertar, LOTE)) {
    const { error } = await db.from("citas_vacunacion").insert(parte.map(base));
    if (!error) { importados += parte.length; continue; }
    // Una regla de la base (p. ej. la vacuna ya lleva inventario) rechazó el lote: se aísla la fila culpable
    for (const d of parte) {
      const { error: e } = await db.from("citas_vacunacion").insert(base(d));
      if (e) errores.push({ fila: d.fila, motivo: e.message });
      else importados++;
    }
  }

  // Un recordatorio pendiente de una dosis anterior ya no aplica si el paciente tiene una dosis posterior
  const afectados = [...new Set(plan.insertar.map((d) => d.paciente_id))];
  for (const parte of trozos(afectados, 200)) {
    const { data } = await db.from("citas_vacunacion").select("id, paciente_id, vacuna_id, numero_dosis")
      .eq("centro_id", centroId).in("paciente_id", parte).neq("estado", "CANCELADA");
    const maximo = new Map<string, number>();
    (data ?? []).forEach((c) => {
      const k = `${c.paciente_id}|${c.vacuna_id}`;
      maximo.set(k, Math.max(maximo.get(k) ?? 0, c.numero_dosis));
    });
    const obsoletas = (data ?? []).filter((c) => c.numero_dosis < (maximo.get(`${c.paciente_id}|${c.vacuna_id}`) ?? 0)).map((c) => c.id);
    for (const ids of trozos(obsoletas, 200)) {
      await db.from("recordatorios").delete().in("cita_id", ids).eq("estado_envio", "PENDIENTE");
    }
  }

  return { importados, omitidas: plan.omitidas, errores };
}

async function cargarLotes(db: SupabaseClient, centroId: string, userId: string, rows: Fila[]): Promise<Resultado> {
  const vacunas = await vacunasDelCentro(db, centroId);
  const { data, error } = await db.from("lotes").select("vacuna_id, numero_lote").eq("centro_id", centroId);
  if (error) throw new Error(error.message);
  const existentes = new Set((data ?? []).map((l) => `${l.vacuna_id}|${normNombre(l.numero_lote)}`));

  const plan = planificarLotes(rows, { vacunas, existentes });
  const errores = [...plan.errores];
  let importados = 0;
  for (const l of plan.insertar) {
    const { error: e } = await db.from("lotes").insert({
      centro_id: centroId, vacuna_id: l.vacuna_id, numero_lote: l.numero_lote, laboratorio: l.laboratorio,
      fecha_vencimiento: l.fecha_vencimiento, cantidad_inicial: l.cantidad_inicial, costo_unitario: l.costo_unitario,
      creado_por: userId,
    });
    if (e) errores.push({ fila: l.fila, referencia: l.numero_lote, motivo: e.message });
    else importados++;
  }
  return { importados, omitidas: plan.omitidas, errores };
}
