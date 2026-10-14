import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { parseVacuna } from "@/lib/vacunas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = await createClient();

  const parsed = parseVacuna(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await db.from("vacunas").update(parsed.data).eq("id", params.id).select().maybeSingle();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ya existe una vacuna con ese nombre" : error.message }, { status: dup ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Vacuna no encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = await createClient();

  const { error } = await db.from("vacunas").delete().eq("id", params.id);
  if (error) {
    const inUse = error.code === "23503";
    return NextResponse.json(
      { error: inUse ? "No se puede eliminar: hay vacunaciones registradas con esta vacuna" : error.message },
      { status: inUse ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
