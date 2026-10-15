import { todayISO } from "@/lib/agenda";
import { obtenerPago } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoPago =
  | { estado: "APROBADO"; centroId: string; vence: string }
  | { estado: "PENDIENTE" | "RECHAZADO"; centroId: string }
  | { estado: "DESCONOCIDO" };

/**
 * Consulta el pago a Mercado Pago y, si está aprobado y coincide con el pago registrado (monto y moneda),
 * extiende la suscripción del centro. Es idempotente: lo llaman el webhook y la página de regreso, y la
 * función de la base de datos impide aplicarlo dos veces.
 */
export async function procesarPagoMP(paymentId: string): Promise<ResultadoPago> {
  const pago = await obtenerPago(paymentId);
  if (!pago.external_reference) return { estado: "DESCONOCIDO" };

  const db = createAdminClient();
  const { data: registro } = await db.from("pagos_suscripcion")
    .select("id, centro_id, monto, estado").eq("id", pago.external_reference).maybeSingle();
  if (!registro) return { estado: "DESCONOCIDO" };

  if (pago.status === "approved") {
    if (pago.currency_id !== "COP" || Math.round(pago.transaction_amount) !== registro.monto) {
      console.error("suscripcion: el pago no coincide con lo registrado", { paymentId, registro: registro.id });
      return { estado: "RECHAZADO", centroId: registro.centro_id };
    }
    const { error } = await db.rpc("aplicar_pago_suscripcion", {
      p_pago: registro.id, p_payment_id: String(pago.id), p_hoy: todayISO(),
    });
    if (error) throw new Error(error.message);
    const { data: centro } = await db.from("centros").select("suscripcion_vence").eq("id", registro.centro_id).single();
    return { estado: "APROBADO", centroId: registro.centro_id, vence: centro?.suscripcion_vence };
  }

  if (["rejected", "cancelled"].includes(pago.status)) {
    // Solo si sigue pendiente: un pago ya aprobado no se marca como rechazado por otro intento fallido
    await db.from("pagos_suscripcion").update({ estado: "RECHAZADO", mp_payment_id: String(pago.id) })
      .eq("id", registro.id).eq("estado", "PENDIENTE");
    return { estado: "RECHAZADO", centroId: registro.centro_id };
  }
  return { estado: "PENDIENTE", centroId: registro.centro_id };
}
