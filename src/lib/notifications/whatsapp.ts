import twilio from "twilio";
import { formatFechaLarga } from "@/lib/agenda";
import { datosContacto, type Establecimiento } from "@/lib/establecimiento";
import { enumerar, nombresPacientes, porPaciente, type DosisMensaje } from "@/lib/mensaje-citas";
import { urlApp } from "@/lib/url";

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
  fechaProximaDosis: string;
  /** Dosis de mañana para este teléfono: varias si el paciente tiene varias vacunas o comparte el número. */
  dosis: DosisMensaje[];
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
}): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Credenciales de Twilio no configuradas");

  const useSms = process.env.TWILIO_USE_SMS === "true";
  const fromRaw = useSms ? process.env.TWILIO_SMS_FROM : input.from || process.env.TWILIO_WHATSAPP_FROM;
  if (!fromRaw) throw new Error(useSms ? "TWILIO_SMS_FROM no configurada" : "TWILIO_WHATSAPP_FROM no configurada");

  const client = twilio(sid, token);
  // Twilio avisa a /api/whatsapp/estado si el mensaje se entrega o falla (aceptarlo no es entregarlo).
  // Solo con una URL pública https: en local no la puede alcanzar.
  const base = urlApp();
  const statusCallback = base.startsWith("https://") ? `${base}${RUTA_ESTADO}` : undefined;

  const contentSid = input.plantilla && PLANTILLA_TWILIO[input.plantilla.clave];
  const mensaje = !useSms && contentSid
    ? await client.messages.create({
        from: fromRaw,
        to: `whatsapp:${input.to}`,
        contentSid,
        contentVariables: JSON.stringify(Object.fromEntries(input.plantilla!.variables.map((v, i) => [i + 1, v]))),
        statusCallback,
      })
    : await client.messages.create({
        from: fromRaw,
        to: useSms ? input.to : `whatsapp:${input.to}`,
        body: input.body,
        statusCallback,
      });
  return mensaje.sid;
}

/** Ruta que recibe de Twilio el estado de entrega de cada mensaje. */
export const RUTA_ESTADO = "/api/whatsapp/estado";

/**
 * Recordatorio del día anterior: un solo mensaje con todas las dosis de mañana para ese teléfono.
 * Plantilla RECORDATORIO: {{1}} nombre, {{2}} fecha, {{3}} dosis, {{4}} vacuna, {{5}} centro. Con varias
 * dosis, {{3}} es la primera y {{4}} sigue la frase: "la dosis {{3}} de Hepatitis B y la dosis 1 de Polio".
 */
export async function sendReminderWhatsApp(input: ReminderMessageInput): Promise<string> {
  const fecha = formatFechaLarga(input.fechaProximaDosis);
  const est = input.establecimiento;
  const contacto = datosContacto(est);
  const pacientes = porPaciente(input.dosis);
  const varios = pacientes.length > 1;
  // Si comparten teléfono, cada dosis lleva el nombre de su paciente
  const quien = (d: DosisMensaje) => (varios ? ` (${pacientes.find((p) => p.dosis.includes(d))!.nombre})` : "");
  const [primera, ...resto] = input.dosis;

  const detalle = varios
    ? `les recordamos que mañana ${fecha} tienen cita en *${est.nombre}*:\n` +
      pacientes.map((p) => `• ${p.nombre}: ${enumerar(p.dosis.map((d) => `dosis ${d.dosis} de ${d.vacuna}`))}`).join("\n")
    : `te recordamos que mañana ${fecha} te corresponde ` +
      `${enumerar(input.dosis.map((d) => `la dosis ${d.dosis} de ${d.vacuna}`))} en *${est.nombre}*.`;

  return enviarWhatsApp({
    to: input.to,
    from: est.whatsapp_from,
    plantilla: {
      clave: "RECORDATORIO",
      variables: [
        nombresPacientes(input.dosis), fecha, String(primera.dosis),
        enumerar([`${primera.vacuna}${quien(primera)}`, ...resto.map((d) => `la dosis ${d.dosis} de ${d.vacuna}${quien(d)}`)]),
        est.nombre,
      ],
    },
    body:
      `Hola ${nombresPacientes(input.dosis)}, ${detalle}\n\n` +
      (contacto ? `${contacto}\n\n` : "") +
      `Responde *1* para CONFIRMAR o *2* para REPROGRAMAR.\n\n` +
      `_Si no deseas recibir más mensajes, responde SALIR._`,
  });
}
