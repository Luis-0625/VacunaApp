import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Crea un usuario (Auth + perfil con rol). Solo ADMIN. */
export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const nombre = String(b?.nombre ?? "").trim();
  const password = String(b?.password ?? "");
  const rol = b?.rol;

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  if (rol !== "ADMIN" && rol !== "VACUNADOR") return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nombre },
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "No se pudo crear el usuario" }, { status: 400 });
  }

  const { error: pErr } = await admin.from("perfiles").insert({ user_id: created.user.id, email, nombre, rol, centro_id: g.perfil.centro_id });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id); // evita usuarios sin perfil
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
