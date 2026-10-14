import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/notifications/email";
import { sendReminderWhatsApp } from "@/lib/notifications/whatsapp";
import { toE164 } from "@/lib/phone";
import { addDaysISO, todayISO } from "@/lib/agenda";
import { getEstablecimiento, type Establecimiento } from "@/lib/establecimiento";
import type { RecordatorioDetalle } from "@/types/db";

/** Fecha de mañana (YYYY-MM-DD) en la zona horaria de la app. */
export function tomorrowISO(timeZone = process.env.APP_TIMEZONE ?? "America/Bogota"): string {
  return addDaysISO(todayISO(timeZone), 1);
}

/**
 * Envía el recordatorio por el canal configurado y actualiza su estado.
 * ENVIADO si llegó por al menos un canal; si el otro falló, el detalle queda en `ultimo_error`
 * como aviso. FALLIDO solo si no salió por ninguno.
 */
export async function processReminder(
  db: SupabaseClient,
  r: RecordatorioDetalle,
  establecimiento?: Establecimiento
): Promise<{ id: string; ok: boolean; error?: string }> {
  const errors: string[] = [];
  let entregados = 0;
  const cita = r.cita;

  if (!cita) {
    errors.push("Cita no encontrada");
  } else if (cita.paciente.autoriza_mensajes === "NO_AUTORIZADO") {
    errors.push("El paciente no autoriza recibir mensajes (Ley 1581)");
  } else {
    const base = {
      establecimiento: establecimiento ?? (await getEstablecimiento(db, r.centro_id)),
      nombrePaciente: cita.paciente.nombre_completo,
      vacuna: cita.vacuna.nombre,
      numeroDosis: cita.numero_dosis,
      fechaProximaDosis: cita.fecha_proxima_dosis ?? r.fecha_programada,
    };
    const wantEmail = r.canal === "EMAIL" || r.canal === "AMBOS";
    const wantWa = r.canal === "WHATSAPP" || r.canal === "AMBOS";

    if (wantEmail) {
      try {
        if (!cita.paciente.email) throw new Error("Paciente sin email");
        await sendReminderEmail({ ...base, to: cita.paciente.email });
        entregados++;
      } catch (e) {
        errors.push(`Email: ${(e as Error).message}`);
      }
    }
    if (wantWa) {
      try {
        const phone = toE164(cita.paciente.telefono, process.env.DEFAULT_COUNTRY_CODE ?? "57");
        if (!phone) throw new Error(`Teléfono inválido (${cita.paciente.telefono})`);
        await sendReminderWhatsApp({ ...base, to: phone });
        entregados++;
      } catch (e) {
        errors.push(`WhatsApp: ${(e as Error).message}`);
      }
    }
  }

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

  if (error) return { id: r.id, ok: false, error: `No se pudo actualizar: ${error.message}` };
  return { id: r.id, ok, error: errors.length ? errors.join(" | ") : undefined };
}
