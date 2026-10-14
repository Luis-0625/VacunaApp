import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/types/db";

/**
 * Perfil (rol y centro) del usuario autenticado, o null si no tiene perfil activo o su centro
 * está suspendido (las reglas de seguridad ocultan el centro en ese caso).
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("perfiles").select("*, centro:centros(id)")
    .eq("user_id", user.id).eq("activo", true).maybeSingle<Perfil & { centro: { id: string } | null }>();
  if (!data) return null;
  const { centro, ...perfil } = data;
  return centro ? perfil : null;
});

/** ¿El usuario autenticado administra la plataforma (crea y suspende centros)? */
export const esSuperadmin = cache(async (): Promise<boolean> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const { data } = await db.from("plataforma_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
});

/** Para API de la plataforma: null si es superadministrador, o la respuesta 401/403 lista para retornar. */
export async function requireSuperadminApi(): Promise<NextResponse | null> {
  return (await esSuperadmin()) ? null : NextResponse.json({ error: "Solo para administradores de la plataforma" }, { status: 403 });
}

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
