import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/types/db";

/** Perfil (rol) del usuario autenticado, o null si no tiene perfil activo. */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("perfiles").select("*").eq("user_id", user.id).eq("activo", true).maybeSingle<Perfil>();
  return data;
});

/** Para páginas: redirige si el rol no está permitido. */
export async function requirePerfilPage(roles: Rol[] = ["ADMIN", "VACUNADOR"]): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  if (!roles.includes(perfil.rol)) redirect("/dashboard");
  return perfil;
}

/** Para API routes: devuelve el perfil o una respuesta 401/403 lista para retornar. */
export async function requireApi(
  roles: Rol[] = ["ADMIN", "VACUNADOR"]
): Promise<{ perfil: Perfil } | { res: NextResponse }> {
  const perfil = await getPerfil();
  if (!perfil) return { res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!roles.includes(perfil.rol)) {
    return { res: NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }
  return { perfil };
}
