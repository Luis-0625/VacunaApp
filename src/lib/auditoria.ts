/** Presentación de la auditoría (supabase/auditoria.sql): etiquetas, valores legibles y filtros. */

export interface RegistroAuditoria {
  id: number;
  created_at: string;
  tabla: "citas_vacunacion" | "pacientes" | "vacunas";
  registro_id: string | null;
  accion: "CREAR" | "MODIFICAR" | "ELIMINAR";
  paciente_id: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  origen: "USUARIO" | "SISTEMA";
  resumen: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export const TABLAS: { valor: RegistroAuditoria["tabla"]; etiqueta: string }[] = [
  { valor: "citas_vacunacion", etiqueta: "Vacunaciones" },
  { valor: "pacientes", etiqueta: "Pacientes" },
  { valor: "vacunas", etiqueta: "Catálogo de vacunas" },
];

export const ACCIONES: { valor: RegistroAuditoria["accion"]; etiqueta: string }[] = [
  { valor: "CREAR", etiqueta: "Creó" },
  { valor: "MODIFICAR", etiqueta: "Modificó" },
  { valor: "ELIMINAR", etiqueta: "Eliminó" },
];

export const etiquetaTabla = (t: string) => TABLAS.find((x) => x.valor === t)?.etiqueta ?? t;
export const etiquetaAccion = (a: string) => ACCIONES.find((x) => x.valor === a)?.etiqueta ?? a;

const CAMPOS: Record<string, string> = {
  numero_dosis: "Número de dosis",
  fecha_aplicacion: "Fecha de aplicación",
  fecha_proxima_dosis: "Fecha próxima dosis",
  estado: "Estado",
  externa: "Dosis externa",
  lugar_externo: "Lugar de aplicación",
  lote_id: "Lote",
  vacuna_id: "Vacuna",
  paciente_id: "Paciente",
  aplicada_por: "Aplicada por",
  nombre_completo: "Nombre completo",
  documento_identidad: "Documento",
  telefono: "Teléfono",
  email: "Correo",
  fecha_nacimiento: "Fecha de nacimiento",
  autoriza_mensajes: "Autoriza mensajes",
  autorizacion_fecha: "Fecha de autorización",
  autorizacion_medio: "Medio de autorización",
  carne_token: "Enlace del carné",
  nombre: "Nombre",
  dosis_totales: "Dosis totales",
  intervalo_dias_recom_dosis: "Intervalo entre dosis (días)",
  descripcion: "Descripción",
  stock_minimo: "Existencias mínimas",
};

/** Columnas internas que no aportan al lector. */
const OCULTOS = new Set(["id", "centro_id", "created_at", "updated_at"]);

export const etiquetaCampo = (c: string) => CAMPOS[c] ?? c.replace(/_/g, " ");

export function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

/** Filas "campo · antes · después" de un registro, sin las columnas internas. */
export function cambios(r: Pick<RegistroAuditoria, "antes" | "despues">) {
  const campos = [...new Set([...Object.keys(r.antes ?? {}), ...Object.keys(r.despues ?? {})])].filter((c) => !OCULTOS.has(c));
  return campos.map((c) => ({
    campo: etiquetaCampo(c),
    antes: r.antes ? valorLegible(r.antes[c]) : null,
    despues: r.despues ? valorLegible(r.despues[c]) : null,
  }));
}

export const POR_PAGINA = 50;

export interface FiltrosAuditoria {
  tabla?: string;
  accion?: string;
  usuario?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  pagina: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normaliza los parámetros de la URL: lo que no es válido se descarta. */
export function leerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosAuditoria {
  const uno = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) || undefined;
  const pagina = Number(uno("p"));
  return {
    tabla: TABLAS.some((t) => t.valor === uno("tabla")) ? uno("tabla") : undefined,
    accion: ACCIONES.some((a) => a.valor === uno("accion")) ? uno("accion") : undefined,
    usuario: uno("usuario") === "sistema" || UUID.test(uno("usuario") ?? "") ? uno("usuario") : undefined,
    desde: ISO.test(uno("desde") ?? "") ? uno("desde") : undefined,
    hasta: ISO.test(uno("hasta") ?? "") ? uno("hasta") : undefined,
    // Se quitan los caracteres que tienen significado en los filtros de PostgREST/ilike
    q: uno("q")?.replace(/[%_,()*\\]/g, " ").trim().slice(0, 60) || undefined,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Inicio y fin del rango en hora de Colombia (UTC-5, sin horario de verano). */
export const inicioDia = (iso: string) => `${iso}T00:00:00-05:00`;
export const finDia = (iso: string) => `${iso}T23:59:59.999-05:00`;

/** "16 oct 2026, 8:05 p. m." en hora de Colombia. */
export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE ?? "America/Bogota" })
    .format(new Date(iso));
}
