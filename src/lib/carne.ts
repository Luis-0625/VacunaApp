import type { SupabaseClient } from "@supabase/supabase-js";
import { getEstablecimiento } from "@/lib/establecimiento";
import { enviarWhatsApp } from "@/lib/notifications/whatsapp";
import { toE164 } from "@/lib/phone";
import { urlApp } from "@/lib/url";

export { urlApp };

export const urlCarne = (token: string, base = urlApp()) => `${base}/carne/${token}`;

/** "1023456789" -> "1•••••789": suficiente para verificar sin exponer el documento completo. */
export function enmascararDocumento(doc: string): string {
  if (doc.length <= 4) return "•".repeat(doc.length);
  return `${doc[0]}${"•".repeat(Math.max(3, doc.length - 4))}${doc.slice(-3)}`;
}

/**
 * Envía el enlace del carné por WhatsApp. Respeta la autorización de mensajes (Ley 1581).
 * Plantilla CARNE: {{1}} nombre, {{2}} centro, {{3}} enlace.
 */
export async function enviarCarne(db: SupabaseClient, pacienteId: string): Promise<void> {
  const { data: p, error } = await db.from("pacientes")
    .select("nombre_completo, telefono, autoriza_mensajes, carne_token, centro_id").eq("id", pacienteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Paciente no encontrado");
  if (p.autoriza_mensajes === "NO_AUTORIZADO") throw new Error("El paciente no autoriza recibir mensajes");

  const to = toE164(p.telefono, process.env.DEFAULT_COUNTRY_CODE ?? "57");
  if (!to) throw new Error(`Teléfono inválido (${p.telefono})`);

  const est = await getEstablecimiento(db, p.centro_id);
  const nombre = p.nombre_completo.split(/\s+/)[0];
  const url = urlCarne(p.carne_token);
  await enviarWhatsApp({
    to,
    from: est.whatsapp_from,
    plantilla: { clave: "CARNE", variables: [nombre, est.nombre, url] },
    body:
      `Hola ${nombre} 👋 Tu carné de vacunación de *${est.nombre}* está actualizado ✅\n\n${url}\n\n` +
      "Guarda este enlace: puedes mostrarlo o dejar que escaneen su código QR para verificarlo.\n\n" +
      "_Si no deseas recibir más mensajes, responde SALIR._",
  });
}
