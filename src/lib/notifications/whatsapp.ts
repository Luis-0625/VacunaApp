import twilio from "twilio";
import { formatFechaLarga } from "@/lib/agenda";
import { datosContacto, type Establecimiento } from "@/lib/establecimiento";

export interface ReminderMessageInput {
  to: string; // E.164, ej. +573001234567
  establecimiento: Establecimiento;
  nombrePaciente: string;
  vacuna: string;
  numeroDosis: number;
  fechaProximaDosis: string;
}

/**
 * Envía un mensaje por WhatsApp (por defecto) o SMS si TWILIO_USE_SMS=true.
 * Si se indica `contentSid` (plantilla aprobada de WhatsApp) se usa con `variables` en lugar de `body`;
 * en producción WhatsApp exige plantilla para los mensajes que inicia el centro.
 */
export async function enviarWhatsApp(input: {
  to: string;
  body: string;
  contentSid?: string;
  variables?: Record<string, string>;
}): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Credenciales de Twilio no configuradas");

  const useSms = process.env.TWILIO_USE_SMS === "true";
  const fromRaw = useSms ? process.env.TWILIO_SMS_FROM : process.env.TWILIO_WHATSAPP_FROM;
  if (!fromRaw) throw new Error(useSms ? "TWILIO_SMS_FROM no configurada" : "TWILIO_WHATSAPP_FROM no configurada");

  const client = twilio(sid, token);
  if (!useSms && input.contentSid) {
    await client.messages.create({
      from: fromRaw,
      to: `whatsapp:${input.to}`,
      contentSid: input.contentSid,
      contentVariables: JSON.stringify(input.variables ?? {}),
    });
    return;
  }

  await client.messages.create({
    from: fromRaw,
    to: useSms ? input.to : `whatsapp:${input.to}`,
    body: input.body,
  });
}

/**
 * Recordatorio del día anterior. Plantilla de producción: TWILIO_WHATSAPP_CONTENT_SID
 * con variables {{1}} nombre, {{2}} fecha, {{3}} dosis, {{4}} vacuna.
 */
export async function sendReminderWhatsApp(input: ReminderMessageInput): Promise<void> {
  const fecha = formatFechaLarga(input.fechaProximaDosis);
  const est = input.establecimiento;
  const contacto = datosContacto(est);

  await enviarWhatsApp({
    to: input.to,
    contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID,
    variables: { 1: input.nombrePaciente, 2: fecha, 3: String(input.numeroDosis), 4: input.vacuna },
    body:
      `Hola ${input.nombrePaciente}, te recordamos que mañana ${fecha} ` +
      `te corresponde la dosis ${input.numeroDosis} de ${input.vacuna} en *${est.nombre}*.\n\n` +
      (contacto ? `${contacto}\n\n` : "") +
      `Responde *1* para CONFIRMAR o *2* para REPROGRAMAR.\n\n` +
      `_Si no deseas recibir más mensajes, responde SALIR._`,
  });
}
