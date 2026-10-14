import { NextResponse, type NextRequest } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarMensajeEntrante } from "@/lib/confirmaciones";

export const dynamic = "force-dynamic";

/**
 * Webhook de mensajes entrantes de Twilio (WhatsApp o SMS).
 * Configúralo en Twilio como "When a message comes in": POST https://<tu-dominio>/api/whatsapp/webhook
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });

  // Verifica que la petición venga de Twilio (firma X-Twilio-Signature)
  const token = process.env.TWILIO_AUTH_TOKEN;
  const url = process.env.TWILIO_WEBHOOK_URL ?? request.url;
  const firma = request.headers.get("x-twilio-signature") ?? "";
  if (!token || !twilio.validateRequest(token, firma, url, params)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 403 });
  }

  let respuesta: string;
  try {
    respuesta = await procesarMensajeEntrante(createAdminClient(), params.From ?? "", params.Body ?? "", params.To ?? "");
  } catch (e) {
    console.error("Webhook WhatsApp:", e);
    respuesta = "Tuvimos un problema procesando tu respuesta. Intenta de nuevo en unos minutos.";
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
