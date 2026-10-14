import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { parseVacuna } from "@/lib/vacunas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = await createClient();

  const parsed = parseVacuna(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await db.from("vacunas").insert(parsed.data).select().single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ya existe una vacuna con ese nombre" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
