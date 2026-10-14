import { Resend } from "resend";
import { formatFechaLarga } from "@/lib/agenda";
import { COLORES_MARCA, type Establecimiento } from "@/lib/establecimiento";
import type { AlertaLote, AlertasInventario } from "@/lib/inventario-alertas";

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
          <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5">
            Recibes este mensaje porque autorizaste a ${escapeHtml(est.nombre)} a enviarte recordatorios (Ley 1581 de 2012).
            Si no deseas recibir más mensajes, responde <strong>SALIR</strong> al WhatsApp
            ${est.email ? `o escríbenos a ${escapeHtml(est.email)}` : "o comunícate con nosotros"}.
          </div>
        </div>
      </div>`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/** Resumen diario de alertas de inventario para los administradores de un centro. */
export async function sendAlertasInventarioEmail(input: {
  to: string[];
  establecimiento: Establecimiento;
  alertas: AlertasInventario;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no configurada");
  const { establecimiento: est, alertas: a } = input;
  const color = COLORES_MARCA.find((c) => c.id === est.color)?.muestra ?? "rgb(37 99 235)";

  const bloque = (titulo: string, tono: string, filas: string[]) => filas.length === 0 ? "" : `
    <h3 style="margin:20px 0 8px;font-size:15px;color:${tono}">${titulo}</h3>
    <ul style="margin:0;padding-left:20px;line-height:1.7;font-size:14px">${filas.map((f) => `<li>${f}</li>`).join("")}</ul>`;
  const lote = (l: AlertaLote) =>
    `Lote <strong>${escapeHtml(l.numero_lote)}</strong> de ${escapeHtml(l.vacuna)}: ${l.existencias} dosis, vence el ${formatFechaLarga(l.fecha_vencimiento)}`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? `${est.nombre} <onboarding@resend.dev>`,
    to: input.to,
    subject: `Inventario de vacunas: ${a.total} ${a.total === 1 ? "alerta" : "alertas"} en ${est.nombre}`,
    html: `
      <div style="background:#f6f7f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="padding:20px 24px;border-bottom:3px solid ${color}">
            <strong style="font-size:16px">${escapeHtml(est.nombre)}</strong>
            <div style="font-size:13px;color:#64748b">Alertas de inventario de vacunas</div>
          </div>
          <div style="padding:8px 24px 24px">
            ${bloque("🔴 Lotes vencidos con dosis (retíralos de la nevera)", "#b91c1c", a.vencidos.map(lote))}
            ${bloque("🟠 Lotes por vencer (aplícalos primero)", "#b45309", a.porVencer.map(lote))}
            ${bloque("⚠️ Pocas unidades (haz el pedido)", "#b45309", a.bajoMinimo.map((v) =>
              `<strong>${escapeHtml(v.vacuna)}</strong>: quedan ${v.disponibles} dosis (mínimo ${v.minimo})`))}
            <p style="margin:24px 0 0">
              <a href="${input.url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Ver inventario</a>
            </p>
          </div>
        </div>
        <p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#94a3b8;text-align:center">
          Recibes este aviso diario porque eres administrador de ${escapeHtml(est.nombre)} en VacunaApp. Solo se envía cuando hay alertas.
        </p>
      </div>`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
