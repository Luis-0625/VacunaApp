import { NextResponse, type NextRequest } from "next/server";
import { requireSuperadminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const WHATSAPP = /^whatsapp:\+[1-9]\d{7,14}$/;

/** Suspende/reactiva un centro o cambia su número de WhatsApp. Solo superadministradores. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const denegado = await requireSuperadminApi();
  if (denegado) return denegado;

  const b = await request.json().catch(() => null);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b?.activo !== undefined) update.activo = Boolean(b.activo);
  if (b?.whatsapp_from !== undefined) {
    const raw = String(b.whatsapp_from ?? "").replace(/\s+/g, "");
    if (!raw) update.whatsapp_from = null;
    else {
      const valor = raw.startsWith("whatsapp:") ? raw : `whatsapp:${raw.startsWith("+") ? raw : `+${raw}`}`;
      if (!WHATSAPP.test(valor)) return NextResponse.json({ error: "Número inválido. Ej: +573001234567" }, { status: 400 });
      update.whatsapp_from = valor;
    }
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const { data, error } = await createAdminClient().from("centros").update(update).eq("id", params.id).select("id").maybeSingle();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ese número ya está asignado a otro centro" : error.message }, { status: dup ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
