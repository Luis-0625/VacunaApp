import twilio from "twilio";
import { formatFechaLarga } from "@/lib/agenda";
import { datosContacto, type Establecimiento } from "@/lib/establecimiento";

/**
 * WhatsApp se envía con Twilio. Los mensajes que inicia el centro (recordatorio, campaña, carné)
 * requieren una plantilla aprobada; las respuestas dentro de las 24 h del último mensaje
 * del paciente pueden ser texto libre.
 */

/** Plantillas aprobadas. Las variables se envían en este orden ({{1}}, {{2}}, …). */
export type ClavePlantilla = "RECORDATORIO" | "CAMPANA" | "CARNE";

const PLANTILLA_TWILIO: Record<ClavePlantilla, string | undefined> = {
  RECORDATORIO: process.env.TWILIO_WHATSAPP_CONTENT_SID,
  CAMPANA: process.env.TWILIO_CAMPANA_CONTENT_SID,
  CARNE: process.env.TWILIO_CARNE_CONTENT_SID,
};

export interface ReminderMessageInput {
  to: string; // E.164, ej. +573001234567
  establecimiento: Establecimiento;
  nombrePaciente: string;
  vacuna: string;
  numeroDosis: number;
  fechaProximaDosis: string;
}

/**
 * Envía un WhatsApp. Si se indica `plantilla` y está configurada para el proveedor activo, se envía la
 * plantilla aprobada con sus variables; si no, se envía `body` como texto (válido en el sandbox de Twilio
 * o dentro de la ventana de 24 h).
 */
export async function enviarWhatsApp(input: {
  to: string;
  body: string;
  /** Número propio del centro en Twilio (whatsapp:+57...). */
  from?: string | null;
  plantilla?: { clave: ClavePlantilla; variables: string[] };
}): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Credenciales de Twilio no configuradas");

  const useSms = process.env.TWILIO_USE_SMS === "true";
  const fromRaw = useSms ? process.env.TWILIO_SMS_FROM : input.from || process.env.TWILIO_WHATSAPP_FROM;
  if (!fromRaw) throw new Error(useSms ? "TWILIO_SMS_FROM no configurada" : "TWILIO_WHATSAPP_FROM no configurada");

  const client = twilio(sid, token);
  const contentSid = input.plantilla && PLANTILLA_TWILIO[input.plantilla.clave];
  if (!useSms && contentSid) {
    await client.messages.create({
      from: fromRaw,
      to: `whatsapp:${input.to}`,
      contentSid,
      contentVariables: JSON.stringify(Object.fromEntries(input.plantilla!.variables.map((v, i) => [i + 1, v]))),
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
 * Recordatorio del día anterior. Plantilla RECORDATORIO:
 * {{1}} nombre, {{2}} fecha, {{3}} dosis, {{4}} vacuna, {{5}} centro.
 */
export async function sendReminderWhatsApp(input: ReminderMessageInput): Promise<void> {
  const fecha = formatFechaLarga(input.fechaProximaDosis);
  const est = input.establecimiento;
  const contacto = datosContacto(est);

  await enviarWhatsApp({
    to: input.to,
    from: est.whatsapp_from,
    plantilla: {
      clave: "RECORDATORIO",
      variables: [input.nombrePaciente, fecha, String(input.numeroDosis), input.vacuna, est.nombre],
    },
    body:
      `Hola ${input.nombrePaciente}, te recordamos que mañana ${fecha} ` +
      `te corresponde la dosis ${input.numeroDosis} de ${input.vacuna} en *${est.nombre}*.\n\n` +
      (contacto ? `${contacto}\n\n` : "") +
      `Responde *1* para CONFIRMAR o *2* para REPROGRAMAR.\n\n` +
      `_Si no deseas recibir más mensajes, responde SALIR._`,
  });
}
