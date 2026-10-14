import { createClient } from "@/lib/supabase/server";
import { requirePerfilPage } from "@/lib/auth";
import type { Perfil } from "@/types/db";
import UsuariosManager from "@/components/UsuariosManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const yo = await requirePerfilPage(["ADMIN"]);
  const { data } = await (await createClient()).from("perfiles").select("*").order("created_at").returns<Perfil[]>();
  return <UsuariosManager usuarios={data ?? []} yoId={yo.user_id} />;
}
