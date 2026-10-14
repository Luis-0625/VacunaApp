import { createClient } from "@/lib/supabase/server";
import { requirePerfilPage } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import type { Paciente } from "@/types/db";
import PacientesTable from "@/components/PacientesTable";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const perfil = await requirePerfilPage();
  const db = createClient();
  let pacientes: Paciente[] = [];
  let error: string | null = null;
  try {
    pacientes = await fetchAll<Paciente>((f, t) =>
      db.from("pacientes").select("*").order("created_at", { ascending: false }).order("id").range(f, t).returns<Paciente[]>()
    );
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Error: {error}</p>}
      <PacientesTable pacientes={pacientes} esAdmin={perfil.rol === "ADMIN"} />
    </>
  );
}
