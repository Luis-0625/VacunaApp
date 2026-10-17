import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { DUPLICATE_MSG, parsePaciente } from "@/lib/pacientes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi();
  if ("res" in g) return g.res;
  const db = await createClient();

  const parsed = parsePaciente(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: actual } = await db.from("pacientes").select("anonimizado_at").eq("id", params.id).maybeSingle();
  if (actual?.anonimizado_at) {
    return NextResponse.json({ error: "Este paciente fue anonimizado y ya no se puede editar" }, { status: 409 });
  }

  const { data, error } = await db
    .from("pacientes").update(parsed.data).eq("id", params.id).select().maybeSingle();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? DUPLICATE_MSG : error.message }, { status: dup ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = await createClient();

  const { error } = await db.from("pacientes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
