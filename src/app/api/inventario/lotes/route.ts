import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { parseLote } from "@/lib/inventario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Registra la entrada de un lote (las existencias empiezan en la cantidad recibida). Solo ADMIN. */
export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const parsed = parseLote(await request.json().catch(() => null), true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await createClient();
  const { data, error } = await db.from("lotes").insert(parsed.data).select().single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ese número de lote ya está registrado para esta vacuna" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
