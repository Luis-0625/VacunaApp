import twilio from "twilio";

export interface ReminderMessageInput {
  to: string; // E.164, ej. +573001234567
  nombrePaciente: string;
  vacuna: string;
  numeroDosis: number;
  fechaProximaDosis: string;
}

/** Envía por WhatsApp (por defecto) o SMS si TWILIO_USE_SMS=true. */
export async function sendReminderWhatsApp(input: ReminderMessageInput): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Credenciales de Twilio no configuradas");

  const useSms = process.env.TWILIO_USE_SMS === "true";
  const fromRaw = useSms ? process.env.TWILIO_SMS_FROM : process.env.TWILIO_WHATSAPP_FROM;
  if (!fromRaw) throw new Error(useSms ? "TWILIO_SMS_FROM no configurada" : "TWILIO_WHATSAPP_FROM no configurada");

  const client = twilio(sid, token);
  await client.messages.create({
    from: fromRaw,
    to: useSms ? input.to : `whatsapp:${input.to}`,
    body:
      `Hola ${input.nombrePaciente}, te recordamos que mañana (${input.fechaProximaDosis}) ` +
      `te corresponde la dosis ${input.numeroDosis} de ${input.vacuna}. — VacunaApp`,
  });
}
