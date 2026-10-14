import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { parseLote } from "@/lib/inventario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Corrige los datos de un lote (número, laboratorio, vencimiento, costo). Las existencias no se editan aquí. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const parsed = parseLote(await request.json().catch(() => null), false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await createClient();
  const { data, error } = await db.from("lotes").update(parsed.data).eq("id", params.id).select().maybeSingle();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ese número de lote ya está registrado para esta vacuna" : error.message }, { status: dup ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

/** Elimina un lote cargado por error (solo si nunca se usó). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const db = await createClient();
  const { data, error } = await db.from("lotes").delete().eq("id", params.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) {
    return NextResponse.json(
      { error: "Solo se puede eliminar un lote que nunca se usó. Para retirar dosis registra una baja." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
