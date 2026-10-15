import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago (Checkout Pro) por su API REST. Variables de entorno:
 * - MERCADOPAGO_ACCESS_TOKEN: credencial de producción (APP_USR-…) o de prueba (TEST-…).
 * - MERCADOPAGO_WEBHOOK_SECRET: clave secreta de las notificaciones (Webhooks), para validar la firma.
 */
const API = "https://api.mercadopago.com";

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  return t;
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
  return json as T;
}

/** Crea el link de pago (Checkout Pro) y devuelve la URL a la que se envía al cliente. */
export async function crearPreferencia(input: {
  referencia: string; // id de pagos_suscripcion, vuelve en external_reference
  titulo: string;
  monto: number; // COP
  email?: string;
  urlRetorno: string; // página a la que vuelve el cliente al terminar
  urlNotificacion: string; // webhook
  idempotencia: string;
}): Promise<string> {
  // Mercado Pago exige https en el retorno automático y en las notificaciones (en local no aplica)
  const https = input.urlRetorno.startsWith("https://");
  const pref = await mp<{ init_point: string; sandbox_init_point: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.idempotencia },
    body: JSON.stringify({
      items: [{ id: input.referencia, title: input.titulo, quantity: 1, unit_price: input.monto, currency_id: "COP" }],
      external_reference: input.referencia,
      ...(input.email && { payer: { email: input.email } }),
      back_urls: { success: input.urlRetorno, pending: input.urlRetorno, failure: input.urlRetorno },
      ...(https && { auto_return: "approved", notification_url: input.urlNotificacion }),
      statement_descriptor: "VACUNAAPP",
    }),
  });
  return token().startsWith("TEST-") ? pref.sandbox_init_point : pref.init_point;
}

export interface PagoMP {
  id: number;
  status: "approved" | "pending" | "in_process" | "authorized" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
}

/** Consulta un pago directamente a Mercado Pago: la única fuente confiable de su estado. */
export const obtenerPago = (id: string) => mp<PagoMP>(`/v1/payments/${encodeURIComponent(id)}`);

/**
 * Valida la firma de una notificación (cabeceras x-signature y x-request-id). Sin clave configurada no se
 * valida: igual el pago se consulta a Mercado Pago antes de aplicarlo, así que una notificación falsa no
 * puede aprobar nada.
 */
export function firmaValida(headers: Headers, dataId: string): boolean {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) return true;
  const partes = Object.fromEntries(
    (headers.get("x-signature") ?? "").split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string])
  );
  if (!partes.ts || !partes.v1) return false;
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${headers.get("x-request-id") ?? ""};ts:${partes.ts};`;
  const esperado = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return esperado.length === partes.v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}
