import { NextResponse, type NextRequest } from "next/server";
import { requireSuperadminApi } from "@/lib/auth";
import { todayISO } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Pagos hechos con el link fijo de Mercado Pago: el superadmin los confirma (renueva la suscripción igual
 * que un pago automático) o los descarta si el pago nunca llegó. Solo superadministradores.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const denegado = await requireSuperadminApi();
  if (denegado) return denegado;

  const accion = (await request.json().catch(() => null))?.accion;
  const db = createAdminClient();

  if (accion === "confirmar") {
    const { data, error } = await db.rpc("aplicar_pago_suscripcion", { p_pago: id, p_payment_id: `manual-${id}`, p_hoy: todayISO() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Ese pago ya estaba confirmado o no existe" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (accion === "descartar") {
    const { data, error } = await db.from("pagos_suscripcion").update({ estado: "RECHAZADO" })
      .eq("id", id).eq("estado", "PENDIENTE").select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Ese pago ya no está pendiente" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
