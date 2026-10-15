import { redirect } from "next/navigation";
import PlataformaManager, { type CentroResumen, type PagoPorConfirmar } from "@/components/PlataformaManager";
import { esSuperadmin, getPerfil } from "@/lib/auth";
import { addDaysISO, todayISO } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma" };

export default async function PlataformaPage() {
  if (!(await esSuperadmin())) redirect("/dashboard");
  const perfil = await getPerfil();

  const db = createAdminClient();
  // select("*"): si aún no se ejecutó suscripciones.sql, pedir plan/suscripcion_vence haría fallar la
  // consulta y la lista saldría vacía. Sin esas columnas se muestran como prueba sin vencimiento.
  const { data: filas, error } = await db.from("centros").select("*").order("created_at");
  if (error) throw new Error(`No se pudieron cargar los centros: ${error.message}`);
  const centros = (filas ?? []).map((c) => ({
    id: c.id as string, nombre: c.nombre as string, ciudad: c.ciudad as string | null, activo: c.activo as boolean,
    whatsapp_from: c.whatsapp_from as string | null, created_at: c.created_at as string,
    plan: (c.plan ?? "PRUEBA") as Plan, suscripcion_vence: (c.suscripcion_vence ?? null) as string | null,
  }));

  const hace30 = addDaysISO(todayISO(), -30);
  const contar = (tabla: string, centroId: string) =>
    db.from(tabla).select("*", { count: "exact", head: true }).eq("centro_id", centroId);

  const resumen: CentroResumen[] = await Promise.all((centros ?? []).map(async (c) => {
    const [usuarios, pacientes, dosis30] = await Promise.all([
      contar("perfiles", c.id),
      contar("pacientes", c.id),
      contar("citas_vacunacion", c.id).eq("externa", false).gte("fecha_aplicacion", hace30),
    ]);
    return { ...c, usuarios: usuarios.count ?? 0, pacientes: pacientes.count ?? 0, dosis30: dosis30.count ?? 0 };
  }));

  // Pagos con link fijo esperando confirmación (los automáticos traen mp_payment_id). Antes de ejecutar
  // suscripciones.sql la tabla no existe y la lista queda vacía.
  const { data: porConfirmar } = await db.from("pagos_suscripcion")
    .select("id, centro_id, plan, meses, monto, created_at")
    .eq("estado", "PENDIENTE").is("mp_payment_id", null).gte("created_at", addDaysISO(todayISO(), -30))
    .order("created_at", { ascending: false });
  const nombres = new Map(centros.map((c) => [c.id, c.nombre]));
  const pagos: PagoPorConfirmar[] = (porConfirmar ?? []).map((p) => ({ ...p, centro: nombres.get(p.centro_id) ?? "Centro" }));

  return <PlataformaManager centros={resumen} pagos={pagos} tieneCentro={!!perfil} hoy={todayISO()} />;
}
