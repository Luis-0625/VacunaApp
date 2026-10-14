import AtrasadosManager, { type ResumenCampana } from "@/components/AtrasadosManager";
import { PageHeader } from "@/components/ui";
import { requirePerfilPage } from "@/lib/auth";
import { todayISO } from "@/lib/agenda";
import { fetchAll } from "@/lib/fetch-all";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";
import { createClient } from "@/lib/supabase/server";
import type { DosisPendiente } from "@/lib/campanas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Atrasados" };

export default async function AtrasadosPage() {
  const perfil = await requirePerfilPage();
  const db = createClient();
  const hoy = todayISO();

  const [atrasados, campanas, est] = await Promise.all([
    fetchAll<DosisPendiente>((f, t) =>
      db.from("dosis_pendientes").select("*").lt("fecha_proxima_dosis", hoy)
        .order("fecha_proxima_dosis").order("cita_id").range(f, t).returns<DosisPendiente[]>()
    ).catch(() => null),
    db.from("campanas").select("id, nombre, created_at").order("created_at", { ascending: false }).limit(10),
    getEstablecimientoActual(),
  ]);

  // Resultados por campaña: enviados, respuestas y pacientes recuperados (agendados)
  const ids = (campanas.data ?? []).map((c) => c.id);
  type Envio = { campana_id: string; estado: string; respuesta: string | null };
  const envios = ids.length
    ? await fetchAll<Envio>((f, t) =>
        db.from("campana_envios").select("campana_id, estado, respuesta").in("campana_id", ids)
          .order("id").range(f, t).returns<Envio[]>())
    : [];

  const resumen: ResumenCampana[] = (campanas.data ?? []).map((c) => {
    const es = envios.filter((e) => e.campana_id === c.id);
    return {
      ...c,
      total: es.length,
      enviados: es.filter((e) => e.estado === "ENVIADO").length,
      fallidos: es.filter((e) => e.estado === "FALLIDO").length,
      pendientes: es.filter((e) => e.estado === "PENDIENTE").length,
      agendados: es.filter((e) => e.respuesta === "AGENDADA").length,
      yaAplicada: es.filter((e) => e.respuesta === "YA_APLICADA").length,
    };
  });

  return (
    <>
      <PageHeader title="Pacientes atrasados"
        subtitle="Pacientes que no volvieron por su siguiente dosis. Contáctalos por WhatsApp para que la agenden solos." />
      {atrasados === null ? (
        <div className="card p-6 text-sm text-slate-600">
          Falta configurar la base de datos: ejecuta <code className="rounded bg-slate-100 px-1">supabase/campanas.sql</code> en Supabase.
        </div>
      ) : (
        <AtrasadosManager atrasados={atrasados} campanas={resumen} hoy={hoy}
          esAdmin={perfil.rol === "ADMIN"} centro={est.nombre} />
      )}
    </>
  );
}
