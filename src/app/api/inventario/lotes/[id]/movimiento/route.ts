import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { MOTIVOS_BAJA } from "@/lib/inventario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Movimientos manuales de un lote (solo ADMIN; la base de datos valida y registra en el kárdex):
 *   { tipo: "BAJA", cantidad, motivo, detalle? }  -> dosis perdidas (vencidas, rotas, cadena de frío…)
 *   { tipo: "CONTEO", existencias, detalle? }      -> ajusta a lo contado físicamente en la nevera
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const detalle = b?.detalle ? String(b.detalle).slice(0, 300) : null;
  const db = await createClient();

  let resultado;
  if (b?.tipo === "BAJA") {
    if (!MOTIVOS_BAJA.some((m) => m.id === b.motivo)) return NextResponse.json({ error: "Selecciona el motivo de la baja" }, { status: 400 });
    resultado = await db.rpc("registrar_baja", {
      p_lote: params.id, p_cantidad: Number(b.cantidad), p_motivo: b.motivo, p_detalle: detalle,
    });
  } else if (b?.tipo === "CONTEO") {
    resultado = await db.rpc("registrar_conteo", {
      p_lote: params.id, p_existencias: Number(b.existencias), p_detalle: detalle,
    });
  } else {
    return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 });
  }

  if (resultado.error) {
    return NextResponse.json({ error: resultado.error.message }, { status: resultado.error.code === "P0001" ? 400 : 500 });
  }
  return NextResponse.json({ ok: true });
}
