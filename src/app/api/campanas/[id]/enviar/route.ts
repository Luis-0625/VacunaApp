import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/notifications/whatsapp";
import { getEstablecimiento } from "@/lib/establecimiento";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 20;

/** Variables de la plantilla en orden. Las campañas antiguas las guardaban como objeto {1: …, 2: …}. */
function variablesEnOrden(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.keys(o).sort((a, b) => Number(a) - Number(b)).map((k) => String(o[k]));
}

/**
 * Envía el siguiente lote de mensajes pendientes de la campaña. La pantalla lo llama en bucle
 * hasta que no queden pendientes, así ninguna petición supera el tiempo máximo de la función.
 * Plantilla CAMPANA: {{1}} nombre, {{2}} centro, {{3}} dosis, {{4}} vacuna, {{5}} fecha en que correspondía.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = createAdminClient();

  const { data: campana } = await db.from("campanas").select("id, centro_id")
    .eq("id", params.id).eq("centro_id", g.perfil.centro_id).maybeSingle();
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  const est = await getEstablecimiento(db, campana.centro_id);

  const { data: lote, error } = await db.from("campana_envios")
    .select("id, telefono, mensaje, variables")
    .eq("campana_id", params.id).eq("estado", "PENDIENTE").limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const e of lote ?? []) {
    try {
      await enviarWhatsApp({
        to: e.telefono,
        from: est.whatsapp_from,
        body: e.mensaje,
        plantilla: { clave: "CAMPANA", variables: variablesEnOrden(e.variables) },
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
