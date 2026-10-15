import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/types/db";

/**
 * Id del usuario autenticado (una vez por petición). getClaims verifica la firma del token localmente
 * con las llaves asimétricas del proyecto, sin ir al servidor de Supabase como getUser.
 */
const getUserId = cache(async (): Promise<string | null> => {
  const { data } = await (await createClient()).auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * Perfil (rol y centro) del usuario autenticado, o null si no tiene perfil activo o su centro
 * está suspendido (las reglas de seguridad ocultan el centro en ese caso).
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const db = await createClient();
  const { data } = await db.from("perfiles").select("*, centro:centros(id)")
    .eq("user_id", userId).eq("activo", true).maybeSingle<Perfil & { centro: { id: string } | null }>();
  if (!data) return null;
  const { centro, ...perfil } = data;
  return centro ? perfil : null;
});

/** ¿El usuario autenticado administra la plataforma (crea y suspende centros)? */
export const esSuperadmin = cache(async (): Promise<boolean> => {
  const userId = await getUserId();
  if (!userId) return false;
  const { data } = await (await createClient()).from("plataforma_admins").select("user_id").eq("user_id", userId).maybeSingle();
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
