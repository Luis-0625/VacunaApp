import { Resend } from "resend";

export interface ReminderEmailInput {
  to: string;
  nombrePaciente: string;
  vacuna: string;
  numeroDosis: number;
  fechaProximaDosis: string; // YYYY-MM-DD
}

export async function sendReminderEmail(input: ReminderEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no configurada");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "VacunaApp <onboarding@resend.dev>",
    to: input.to,
    subject: `Recordatorio: tu dosis de ${input.vacuna} es mañana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2>Hola ${escapeHtml(input.nombrePaciente)},</h2>
        <p>Te recordamos que <strong>mañana (${input.fechaProximaDosis})</strong>
        te corresponde la dosis <strong>${input.numeroDosis}</strong> de
        <strong>${escapeHtml(input.vacuna)}</strong>.</p>
        <p>Si no puedes asistir, comunícate con el centro de vacunación para reprogramar.</p>
        <p>— Equipo VacunaApp</p>
      </div>`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
