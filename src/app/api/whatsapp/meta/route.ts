import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { procesarMensajeEntrante } from "@/lib/confirmaciones";
import { enviarTextoWhatsApp } from "@/lib/notifications/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook de WhatsApp Cloud API (Meta). Configúralo en la app de Meta → WhatsApp → Configuración:
 *   URL de devolución de llamada: https://<tu-dominio>/api/whatsapp/meta
 *   Token de verificación: el valor de META_WEBHOOK_VERIFY_TOKEN; suscríbete al campo "messages".
 */

// Verificación del webhook (Meta hace un GET al guardarlo)
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (esperado && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === esperado) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token de verificación inválido" }, { status: 403 });
}

interface MensajeMeta {
  id: string;
  from: string; // número del paciente sin "+", ej. 573001234567
  type: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}

/** Texto que escribió o botón que pulsó el paciente. */
function textoDe(m: MensajeMeta): string {
  if (m.type === "text") return m.text?.body ?? "";
  if (m.type === "button") return m.button?.text ?? m.button?.payload ?? "";
  if (m.type === "interactive") return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
  return ""; // audio, imagen, etc.: el bot responde con las instrucciones
}

function firmaValida(cuerpo: string, firma: string | null): boolean {
  const secreto = process.env.META_APP_SECRET;
  if (!secreto || !firma?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex"));
  const recibida = Buffer.from(firma.slice("sha256=".length));
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export async function POST(request: NextRequest) {
  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 403 });
  }

  const evento = JSON.parse(cuerpo || "{}");
  const db = createAdminClient();

  for (const entry of evento.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const destino = value.metadata?.display_phone_number ? `whatsapp:+${String(value.metadata.display_phone_number).replace(/\D/g, "")}` : "";
      for (const m of (value.messages ?? []) as MensajeMeta[]) {
        try {
          const respuesta = await procesarMensajeEntrante(db, `+${m.from}`, textoDe(m), destino);
          await enviarTextoWhatsApp(`+${m.from}`, respuesta);
        } catch (e) {
          console.error("Webhook Meta:", m.id, e);
          await enviarTextoWhatsApp(`+${m.from}`, "Tuvimos un problema procesando tu respuesta. Intenta de nuevo en unos minutos.")
            .catch(() => {});
        }
      }
      // value.statuses (entregado, leído, fallido) no se procesan por ahora
    }
  }

  // Siempre 200 tras validar la firma: si no, Meta reintenta el mismo evento
  return NextResponse.json({ ok: true });
}
