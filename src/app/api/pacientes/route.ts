import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { DUPLICATE_MSG, parsePaciente } from "@/lib/pacientes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const g = await requireApi();
  if ("res" in g) return g.res;
  const db = await createClient();

  const parsed = parsePaciente(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.data.autoriza_mensajes) {
    return NextResponse.json(
      { error: "Indica si el paciente autoriza recibir recordatorios (Ley 1581)" },
      { status: 400 }
    );
  }

  const { data, error } = await db.from("pacientes").insert(parsed.data).select().single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? DUPLICATE_MSG : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
