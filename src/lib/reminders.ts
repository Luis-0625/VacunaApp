import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/notifications/email";
import { sendReminderWhatsApp } from "@/lib/notifications/whatsapp";
import { toE164 } from "@/lib/phone";
import { addDaysISO, todayISO } from "@/lib/agenda";
import { getEstablecimiento, type Establecimiento } from "@/lib/establecimiento";
import type { DosisMensaje } from "@/lib/mensaje-citas";
import type { RecordatorioDetalle } from "@/types/db";

/** Fecha de mañana (YYYY-MM-DD) en la zona horaria de la app. */
export function tomorrowISO(timeZone = process.env.APP_TIMEZONE ?? "America/Bogota"): string {
  return addDaysISO(todayISO(timeZone), 1);
}

type Detalle = RecordatorioDetalle & { cita: NonNullable<RecordatorioDetalle["cita"]> };

/**
 * Envía los recordatorios de un centro agrupados: un solo WhatsApp por teléfono y un solo correo por
 * dirección con todas las dosis del mismo día (varias vacunas, o hermanos con el número de la madre).
 * Cada recordatorio queda ENVIADO si llegó por al menos un canal; si el otro falló, el detalle queda en
 * `ultimo_error` como aviso. FALLIDO solo si no salió por ninguno.
 */
export async function processReminders(
  db: SupabaseClient,
  rs: RecordatorioDetalle[],
  establecimiento?: Establecimiento
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const resultado = new Map(rs.map((r) => [r.id, { entregados: 0, errors: [] as string[] }]));
  const anotar = (grupo: Detalle[], error?: string) =>
    grupo.forEach((r) => (error ? resultado.get(r.id)!.errors.push(error) : resultado.get(r.id)!.entregados++));

  const porCorreo = new Map<string, Detalle[]>();
  const porTelefono = new Map<string, Detalle[]>();
  const agregar = (m: Map<string, Detalle[]>, k: string, r: Detalle) => m.set(k, [...(m.get(k) ?? []), r]);

  for (const r of rs) {
    if (!r.cita) { resultado.get(r.id)!.errors.push("Cita no encontrada"); continue; }
    const d = r as Detalle;
    if (d.cita.paciente.autoriza_mensajes === "NO_AUTORIZADO") {
      anotar([d], "El paciente no autoriza recibir mensajes (Ley 1581)");
      continue;
    }
    const dia = `${d.centro_id}|${fechaDe(d)}`;
    if (d.canal === "EMAIL" || d.canal === "AMBOS") {
      if (d.cita.paciente.email) agregar(porCorreo, `${dia}|${d.cita.paciente.email.trim().toLowerCase()}`, d);
      else anotar([d], "Email: Paciente sin email");
    }
    if (d.canal === "WHATSAPP" || d.canal === "AMBOS") {
      const phone = toE164(d.cita.paciente.telefono, process.env.DEFAULT_COUNTRY_CODE ?? "57");
      if (phone) agregar(porTelefono, `${dia}|${phone}`, d);
      else anotar([d], `WhatsApp: Teléfono inválido (${d.cita.paciente.telefono})`);
    }
  }

  const centros = new Map<string, Establecimiento>();
  const estDe = async (centroId: string) => {
    if (establecimiento) return establecimiento;
    if (!centros.has(centroId)) centros.set(centroId, await getEstablecimiento(db, centroId));
    return centros.get(centroId)!;
  };

  for (const grupo of porCorreo.values()) {
    try {
      await sendReminderEmail({
        to: grupo[0].cita.paciente.email!, establecimiento: await estDe(grupo[0].centro_id),
        fechaProximaDosis: fechaDe(grupo[0]), dosis: dosisDe(grupo),
      });
      anotar(grupo);
    } catch (e) {
      anotar(grupo, `Email: ${(e as Error).message}`);
    }
  }

  const salida = new Map<string, { id: string; ok: boolean; error?: string }>();
  /** Guarda el estado final de cada recordatorio (los dos canales ya se intentaron). */
  const guardar = async (grupo: RecordatorioDetalle[], whatsappSid?: string) => {
    for (const r of grupo) {
      const { entregados, errors } = resultado.get(r.id)!;
      const ok = entregados > 0;
      const { error } = await db
        .from("recordatorios")
        .update({
          estado_envio: ok ? "ENVIADO" : "FALLIDO",
          intentos: r.intentos + 1,
          ultimo_error: errors.length ? errors.join(" | ").slice(0, 500) : null,
          // Abre una nueva conversación de confirmación con el paciente
          ...(ok && { enviado_at: new Date().toISOString(), confirmacion: null, opciones_fecha: null }),
        })
        .eq("id", r.id);
      // Aparte y sin bloquear: si aún no existe la columna (estado_whatsapp.sql), el envío no se ve afectado
      if (whatsappSid && !error) await db.from("recordatorios").update({ whatsapp_sid: whatsappSid }).eq("id", r.id);
      salida.set(r.id, error
        ? { id: r.id, ok: false, error: `No se pudo actualizar: ${error.message}` }
        : { id: r.id, ok, error: errors.length ? errors.join(" | ") : undefined });
    }
  };

  // Los que no van por WhatsApp ya terminaron
  const porWhatsApp = new Set([...porTelefono.values()].flat().map((r) => r.id));
  await guardar(rs.filter((r) => !porWhatsApp.has(r.id)));

  // Cada grupo de WhatsApp se guarda apenas se envía, con el id del mensaje: así, si Twilio avisa en seguida
  // que no lo entregó (/api/whatsapp/estado), ya encuentra el recordatorio y su estado no se sobrescribe.
  for (const [clave, grupo] of porTelefono) {
    let sid: string | undefined;
    try {
      sid = await sendReminderWhatsApp({
        to: clave.split("|")[2], establecimiento: await estDe(grupo[0].centro_id),
        fechaProximaDosis: fechaDe(grupo[0]), dosis: dosisDe(grupo),
      });
      anotar(grupo);
    } catch (e) {
      anotar(grupo, `WhatsApp: ${(e as Error).message}`);
    }
    await guardar(grupo, sid);
  }

  return rs.map((r) => salida.get(r.id)!);
}

/** Reenvía un solo recordatorio (botón "Reintentar" del monitor). */
export async function processReminder(db: SupabaseClient, r: RecordatorioDetalle, establecimiento?: Establecimiento) {
  return (await processReminders(db, [r], establecimiento))[0];
}

const fechaDe = (r: Detalle) => r.cita.fecha_proxima_dosis ?? r.fecha_programada;

/** La cita guarda la dosis aplicada; el recordatorio es de la siguiente. */
const dosisDe = (rs: Detalle[]): DosisMensaje[] => rs.map((r) => ({
  pacienteId: r.cita.paciente.id,
  nombre: r.cita.paciente.nombre_completo,
  vacuna: r.cita.vacuna.nombre,
  dosis: r.cita.numero_dosis + 1,
}));
