import { NextResponse, type NextRequest } from "next/server";
import { firmaValida } from "@/lib/mercadopago";
import { procesarPagoMP } from "@/lib/suscripcion-pagos";

export const dynamic = "force-dynamic";

/**
 * Notificaciones de Mercado Pago (Webhooks, evento "Pagos"). El estado del pago siempre se consulta a
 * Mercado Pago; la notificación solo dice qué pago revisar.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const body = await request.json().catch(() => ({}));
  const tipo = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (tipo !== "payment" || !id) return NextResponse.json({ ok: true }); // otros eventos: se ignoran
  if (!firmaValida(request.headers, url.searchParams.get("data.id") ?? id)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  try {
    const r = await procesarPagoMP(id);
    return NextResponse.json({ ok: true, estado: r.estado });
  } catch (e) {
    // 500 hace que Mercado Pago reintente la notificación más tarde
    console.error("suscripcion/webhook", e);
    return NextResponse.json({ error: "No se pudo procesar" }, { status: 500 });
  }
}
