import { NextResponse, type NextRequest } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { RUTA_ESTADO } from "@/lib/notifications/whatsapp";
import { urlApp } from "@/lib/url";

export const dynamic = "force-dynamic";

/** Motivos más comunes de no entrega, explicados para el monitor de recordatorios. */
const MOTIVOS: Record<string, string> = {
  "63016": "fuera de la ventana de 24 h: se necesita una plantilla aprobada por Meta (en el sandbox, el paciente debe escribir primero)",
  "63015": "el número del paciente no se ha unido al sandbox de Twilio",
  "63003": "el número del paciente no tiene WhatsApp",
  "63024": "el número del paciente no es válido para WhatsApp",
  "63049": "Meta no entregó el mensaje de marketing a este usuario",
  "63032": "el paciente bloqueó o dejó de recibir mensajes de este número",
};

/**
 * Twilio avisa el estado de cada mensaje (statusCallback). Solo interesan los no entregados: el
 * recordatorio pasa a FALLIDO, salvo que el correo sí haya salido (entonces queda ENVIADO con el aviso).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });

  // La firma se calcula con la URL exacta que se le dio a Twilio al enviar
  const token = process.env.TWILIO_AUTH_TOKEN;
  const firma = request.headers.get("x-twilio-signature") ?? "";
  if (!token || !twilio.validateRequest(token, firma, `${urlApp()}${RUTA_ESTADO}`, params)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 403 });
  }

  const estado = params.MessageStatus;
  if (estado !== "undelivered" && estado !== "failed") return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const sid = params.MessageSid;
  const buscar = () => db.from("recordatorios").select("id, canal, ultimo_error").eq("whatsapp_sid", sid);
  let { data: rs } = await buscar();
  // El aviso puede llegar antes de que se guarde el id del mensaje: se espera un momento y se reintenta
  if (!rs?.length) {
    await new Promise((r) => setTimeout(r, 3000));
    ({ data: rs } = await buscar());
  }

  const codigo = params.ErrorCode ?? "";
  const aviso = `WhatsApp: Twilio no lo entregó (${codigo || estado}${MOTIVOS[codigo] ? `: ${MOTIVOS[codigo]}` : ""})`;
  for (const r of rs ?? []) {
    if (r.ultimo_error?.includes("Twilio no lo entregó")) continue; // aviso repetido
    const correoSalio = r.canal === "AMBOS" && !r.ultimo_error?.includes("Email:");
    await db.from("recordatorios").update({
      estado_envio: correoSalio ? "ENVIADO" : "FALLIDO",
      ultimo_error: [aviso, r.ultimo_error].filter(Boolean).join(" | ").slice(0, 500),
    }).eq("id", r.id);
  }
  return NextResponse.json({ ok: true, recordatorios: rs?.length ?? 0 });
}
