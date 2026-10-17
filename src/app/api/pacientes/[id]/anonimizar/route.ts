import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Anonimiza a un paciente (derecho de supresión, Ley 1581): borra su identidad y conserva las dosis aplicadas.
 * Irreversible. Solo ADMIN. Toda la lógica y las validaciones viven en la función anonimizar_paciente de la base
 * (supabase/auditoria.sql), que corre en una sola transacción.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const { error } = await (await createClient()).rpc("anonimizar_paciente", { p_paciente: params.id });
  if (error) {
    // P0001: regla de negocio con mensaje para el usuario (no encontrado, ya anonimizado…)
    if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
    const noInstalada = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json(
      { error: noInstalada ? "Falta ejecutar supabase/auditoria.sql en la base de datos" : error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
