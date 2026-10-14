import { Resend } from "resend";
import { formatFechaLarga } from "@/lib/agenda";
import { COLORES_MARCA, type Establecimiento } from "@/lib/establecimiento";

export interface ReminderEmailInput {
  to: string;
  establecimiento: Establecimiento;
  nombrePaciente: string;
  vacuna: string;
  numeroDosis: number;
  fechaProximaDosis: string; // YYYY-MM-DD
}

export async function sendReminderEmail(input: ReminderEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no configurada");

  const est = input.establecimiento;
  const color = COLORES_MARCA.find((c) => c.id === est.color)?.muestra ?? "rgb(37 99 235)";
  const fecha = formatFechaLarga(input.fechaProximaDosis);
  const contacto = [
    est.direccion && `📍 ${escapeHtml([est.direccion, est.ciudad].filter(Boolean).join(", "))}`,
    est.horario && `🕒 ${escapeHtml(est.horario)}`,
    est.telefono && `☎ ${escapeHtml(est.telefono)}`,
  ].filter(Boolean).join("<br>");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? `${est.nombre} <onboarding@resend.dev>`,
    replyTo: est.email ?? undefined,
    to: input.to,
    subject: `Recordatorio: tu dosis de ${input.vacuna} es mañana`,
    html: `
      <div style="background:#f6f7f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="padding:20px 24px;border-bottom:3px solid ${color}">
            ${est.logo_url ? `<img src="${escapeHtml(est.logo_url)}" alt="" height="40" style="height:40px;vertical-align:middle;margin-right:10px">` : ""}
            <strong style="font-size:16px;vertical-align:middle">${escapeHtml(est.nombre)}</strong>
          </div>
          <div style="padding:24px">
            <h2 style="margin:0 0 12px;font-size:20px">Hola ${escapeHtml(input.nombrePaciente)},</h2>
            <p style="margin:0 0 16px;line-height:1.6">Te recordamos que <strong>mañana, ${fecha}</strong>,
            te corresponde la dosis <strong>${input.numeroDosis}</strong> de <strong>${escapeHtml(input.vacuna)}</strong>.</p>
            ${contacto ? `<p style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-radius:8px;line-height:1.7;font-size:14px">${contacto}</p>` : ""}
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6">Si no puedes asistir, responde al WhatsApp del recordatorio o comunícate con nosotros para reprogramar tu cita.</p>
          </div>
        </div>
      </div>`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
