import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import type { Vacuna } from "@/types/db";
import RegistrarVacunacion, { type PacienteLite, type Reciente } from "@/components/RegistrarVacunacion";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VacunacionPage({ searchParams }: { searchParams: { paciente?: string; vacuna?: string; externa?: string } }) {
  const db = createClient();
  const [pacientes, vacunas, recientes] = await Promise.all([
    fetchAll<PacienteLite>((f, t) =>
      db.from("pacientes").select("id, nombre_completo, documento_identidad").order("nombre_completo").order("id").range(f, t).returns<PacienteLite[]>()
    ),
    db.from("vacunas").select("*").order("nombre").returns<Vacuna[]>(),
    db.from("citas_vacunacion")
      .select("id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, externa, paciente:pacientes!inner(nombre_completo), vacuna:vacunas!inner(nombre, dosis_totales)")
      .neq("estado", "CANCELADA").order("fecha_aplicacion", { ascending: false }).order("id").limit(12)
      .returns<Reciente[]>(),
  ]);

  return (
    <>
      <PageHeader title="Registrar vacunación" subtitle="Registra la dosis aplicada y el sistema programa el recordatorio de la siguiente" />
      <RegistrarVacunacion pacientes={pacientes} vacunas={vacunas.data ?? []} recientes={recientes.data ?? []}
        inicial={{ pacienteId: searchParams.paciente, vacunaId: searchParams.vacuna, externa: searchParams.externa === "1" }} />
    </>
  );
}
