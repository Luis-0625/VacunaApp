import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/notifications/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 20;

/**
 * Envía el siguiente lote de mensajes pendientes de la campaña. La pantalla lo llama en bucle
 * hasta que no queden pendientes, así ninguna petición supera el tiempo máximo de la función.
 * Plantilla de producción: TWILIO_CAMPANA_CONTENT_SID con {{1}} nombre, {{2}} vacuna, {{3}} dosis, {{4}} fecha.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = createAdminClient();

  const { data: lote, error } = await db.from("campana_envios")
    .select("id, telefono, mensaje, variables")
    .eq("campana_id", params.id).eq("estado", "PENDIENTE").limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const e of lote ?? []) {
    try {
      await enviarWhatsApp({
        to: e.telefono,
        body: e.mensaje,
        contentSid: process.env.TWILIO_CAMPANA_CONTENT_SID,
        variables: e.variables as Record<string, string>,
      });
      await db.from("campana_envios").update({ estado: "ENVIADO", enviado_at: new Date().toISOString(), error: null }).eq("id", e.id);
    } catch (err) {
      await db.from("campana_envios").update({ estado: "FALLIDO", error: (err as Error).message.slice(0, 300) }).eq("id", e.id);
    }
  }

  const contar = (estado: string) => db.from("campana_envios")
    .select("id", { count: "exact", head: true }).eq("campana_id", params.id).eq("estado", estado);
  const [p, s, f] = await Promise.all([contar("PENDIENTE"), contar("ENVIADO"), contar("FALLIDO")]);
  return NextResponse.json({ pendientes: p.count ?? 0, enviados: s.count ?? 0, fallidos: f.count ?? 0 });
}
