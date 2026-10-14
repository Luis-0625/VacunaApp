import { createClient } from "@/lib/supabase/server";
import { requirePerfilPage } from "@/lib/auth";
import type { Vacuna } from "@/types/db";
import VacunasManager from "@/components/VacunasManager";

export const dynamic = "force-dynamic";

export default async function VacunasPage() {
  await requirePerfilPage(["ADMIN"]);
  const { data } = await (await createClient()).from("vacunas").select("*").order("nombre").returns<Vacuna[]>();
  return <VacunasManager vacunas={data ?? []} />;
}
