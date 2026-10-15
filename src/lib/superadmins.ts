import type { SupabaseClient } from "@supabase/supabase-js";

/** Correos de los superadministradores de la plataforma. `db` debe ser el cliente de service role. */
export async function correosSuperadmins(db: SupabaseClient): Promise<string[]> {
  const { data: admins, error } = await db.from("plataforma_admins").select("user_id");
  if (error) throw error;
  const correos = await Promise.all(
    (admins ?? []).map(async (a) => (await db.auth.admin.getUserById(a.user_id)).data.user?.email)
  );
  return correos.filter((e): e is string => !!e);
}
