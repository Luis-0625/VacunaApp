import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { enviarCarne } from "@/lib/carne";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Acciones del carné digital:
 *   { accion: "enviar" }  -> envía el enlace por WhatsApp
 *   { accion: "revocar" } -> genera un enlace nuevo; el anterior deja de funcionar
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireApi();
  if ("res" in g) return g.res;
  const db = createClient();
  const { accion } = (await request.json().catch(() => ({}))) as { accion?: string };

  if (accion === "enviar") {
    try {
      await enviarCarne(db, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  if (accion === "revocar") {
    const carne_token = randomBytes(15).toString("base64url"); // 20 caracteres
    const { data, error } = await db.from("pacientes")
      .update({ carne_token }).eq("id", params.id).select("carne_token").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
