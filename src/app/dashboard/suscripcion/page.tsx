import { requirePerfilPage } from "@/lib/auth";
import { todayISO } from "@/lib/agenda";
import { createClient } from "@/lib/supabase/server";
import { procesarPagoMP, type ResultadoPago } from "@/lib/suscripcion-pagos";
import { PageHeader } from "@/components/ui";
import SuscripcionManager, { type PagoSuscripcion } from "@/components/SuscripcionManager";
import type { Plan } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suscripción" };

export default async function SuscripcionPage(props: {
  searchParams: Promise<{ payment_id?: string; collection_status?: string }>;
}) {
  const perfil = await requirePerfilPage(["ADMIN"]);
  const sp = await props.searchParams;

  // Regreso desde Mercado Pago: se confirma el pago con Mercado Pago (no se confía en la URL) y se aplica
  // aquí mismo, por si la notificación del webhook todavía no ha llegado.
  let resultado: ResultadoPago["estado"] | "ERROR" | null = null;
  if (sp.payment_id && sp.payment_id !== "null") {
    try {
      const r = await procesarPagoMP(sp.payment_id);
      resultado = r.estado !== "DESCONOCIDO" && r.centroId === perfil.centro_id ? r.estado : null;
    } catch (e) {
      console.error("suscripcion: no se pudo confirmar el pago", e);
      resultado = "ERROR";
    }
  } else if (sp.collection_status === "null" || sp.collection_status === "rejected") {
    resultado = "RECHAZADO";
  }

  // Se lee después de procesar el pago para mostrar el vencimiento ya actualizado
  const db = await createClient();
  const [{ data: centro }, { data: pagos }] = await Promise.all([
    db.from("centros").select("plan, suscripcion_vence").single<{ plan: Plan; suscripcion_vence: string | null }>(),
    db.from("pagos_suscripcion")
      .select("id, plan, meses, monto, estado, created_at, pagado_at, vence_despues")
      // Pendientes (esperando que el superadmin confirme) y confirmados; los descartados no se muestran
      .in("estado", ["PENDIENTE", "APROBADO"])
      .order("created_at", { ascending: false }).limit(24).returns<PagoSuscripcion[]>(),
  ]);

  return (
    <>
      <PageHeader title="Suscripción" subtitle="Plan de tu centro, vencimiento y pagos con Mercado Pago." />
      <SuscripcionManager
        plan={centro?.plan ?? "PRUEBA"}
        vence={centro?.suscripcion_vence ?? null}
        hoy={todayISO()}
        pagos={pagos ?? []}
        resultado={resultado}
        modo={process.env.MERCADOPAGO_ACCESS_TOKEN ? "automatico" : "link"}
      />
    </>
  );
}
