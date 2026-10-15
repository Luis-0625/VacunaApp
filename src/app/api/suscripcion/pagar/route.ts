import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { urlApp } from "@/lib/carne";
import { crearPreferencia } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { esPlanPago, linkPago, PLANES, precio } from "@/lib/suscripcion";
import { sendPagoPorConfirmarEmail } from "@/lib/notifications/email";
import { correosSuperadmins } from "@/lib/superadmins";

export const dynamic = "force-dynamic";

/**
 * El ADMIN elige plan y periodo: se registra el pago como PENDIENTE y se devuelve el link de Mercado Pago:
 * uno propio de este pago (con credenciales, se renueva solo) o el link fijo del plan (lo confirma un superadmin).
 * Funciona aunque la suscripción esté vencida (es justamente para renovarla).
 */
export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"], { permitirVencida: true });
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const plan = b?.plan;
  const meses = Number(b?.meses);
  if (!esPlanPago(plan)) return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  if (meses !== 1 && meses !== 12) return NextResponse.json({ error: "Periodo inválido" }, { status: 400 });

  // Sin credenciales se usa el link fijo del plan y un superadmin confirma la renovación en /plataforma
  const automatico = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  const link = linkPago(plan, meses);
  if (!automatico && !link) {
    return NextResponse.json(
      { error: "Este plan todavía no tiene link de pago. Escríbenos por WhatsApp y te ayudamos a renovarlo.", sinLink: true },
      { status: 409 }
    );
  }

  const db = createAdminClient();
  const monto = precio(plan, meses);
  const { data: pago, error } = await db.from("pagos_suscripcion")
    .insert({ centro_id: g.perfil.centro_id, plan, meses, monto, creado_por: g.perfil.user_id })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!automatico) {
    // Aviso a los superadmins para que confirmen el pago cuando llegue a Mercado Pago (si falla, igual se paga)
    try {
      const [{ data: centro }, correos] = await Promise.all([
        db.from("centros").select("nombre").eq("id", g.perfil.centro_id).single(),
        correosSuperadmins(db),
      ]);
      if (correos.length) {
        await sendPagoPorConfirmarEmail(correos, {
          centro: centro?.nombre ?? "Centro", plan: PLANES[plan].nombre, meses, monto,
          admin: `${g.perfil.nombre} (${g.perfil.email})`, url: `${urlApp()}/plataforma`,
        });
      }
    } catch (e) {
      console.error("suscripcion/pagar: no se pudo avisar a los superadmins", e);
    }
    return NextResponse.json({ url: link, manual: true });
  }

  try {
    const base = urlApp();
    const url = await crearPreferencia({
      referencia: pago.id,
      titulo: `VacunaApp · Plan ${PLANES[plan].nombre} · ${meses === 12 ? "12 meses" : "1 mes"}`,
      monto,
      email: g.perfil.email,
      urlRetorno: `${base}/dashboard/suscripcion`,
      urlNotificacion: `${base}/api/suscripcion/webhook`,
      idempotencia: pago.id,
    });
    return NextResponse.json({ url });
  } catch (e) {
    await db.from("pagos_suscripcion").delete().eq("id", pago.id);
    console.error("suscripcion/pagar", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago con Mercado Pago. Inténtalo de nuevo." }, { status: 502 });
  }
}
