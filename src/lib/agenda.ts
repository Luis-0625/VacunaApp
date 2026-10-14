import type { SupabaseClient } from "@supabase/supabase-js";

const TZ = () => process.env.APP_TIMEZONE ?? "America/Bogota";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la app. */
export function todayISO(timeZone = TZ()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "2026-10-15" -> "miércoles 15 de octubre". */
export function formatFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(",", "");
}

/**
 * Próximas fechas disponibles para reprogramar, posteriores a `despuesDe`.
 * Respeta los días de atención (0 = domingo … 6 = sábado) y, si `cupos` > 0, omite los días llenos.
 */
export async function fechasDisponibles(
  db: SupabaseClient,
  despuesDe: string,
  agenda: { dias_atencion: number[]; cupos_por_dia: number },
  cantidad = Number(process.env.REPROGRAMAR_OPCIONES ?? 4)
): Promise<string[]> {
  const dias = new Set(agenda.dias_atencion);
  const cupos = agenda.cupos_por_dia;
  const ventana = 30;
  const desde = addDaysISO(despuesDe, 1);
  const hasta = addDaysISO(despuesDe, ventana);

  const ocupados = new Map<string, number>();
  if (cupos > 0) {
    const { data, error } = await db
      .from("citas_vacunacion")
      .select("fecha_proxima_dosis")
      .gte("fecha_proxima_dosis", desde)
      .lte("fecha_proxima_dosis", hasta)
      .neq("estado", "CANCELADA");
    if (error) throw new Error(error.message);
    for (const c of data ?? []) {
      const f = c.fecha_proxima_dosis as string;
      ocupados.set(f, (ocupados.get(f) ?? 0) + 1);
    }
  }

  const fechas: string[] = [];
  for (let i = 1; i <= ventana && fechas.length < cantidad; i++) {
    const f = addDaysISO(despuesDe, i);
    if (!dias.has(new Date(`${f}T00:00:00Z`).getUTCDay())) continue;
    if (cupos > 0 && (ocupados.get(f) ?? 0) >= cupos) continue;
    fechas.push(f);
  }
  return fechas;
}
