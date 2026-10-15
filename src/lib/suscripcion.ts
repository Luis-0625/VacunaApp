import { addDaysISO } from "@/lib/agenda";

export type Plan = "PRUEBA" | "BASICO" | "PRO" | "ENTERPRISE";
export type PlanPago = Exclude<Plan, "PRUEBA">;

/** Precios en COP. Son los de la página de inicio: el plan anual equivale a 10 meses (ahorra 16%). */
export const PLANES: Record<PlanPago, { nombre: string; mensual: number; anual: number }> = {
  BASICO: { nombre: "Básico", mensual: 280_000, anual: 2_800_000 },
  PRO: { nombre: "Pro", mensual: 480_000, anual: 4_800_000 },
  ENTERPRISE: { nombre: "Enterprise", mensual: 980_000, anual: 9_800_000 },
};

export const NOMBRE_PLAN: Record<Plan, string> = { PRUEBA: "Prueba gratis", BASICO: "Básico", PRO: "Pro", ENTERPRISE: "Enterprise" };

export const esPlanPago = (p: unknown): p is PlanPago => typeof p === "string" && p in PLANES;

export const precio = (plan: PlanPago, meses: 1 | 12) => (meses === 12 ? PLANES[plan].anual : PLANES[plan].mensual);

/**
 * Links de pago fijos de Mercado Pago, por plan y periodo. Se usan mientras no haya MERCADOPAGO_ACCESS_TOKEN:
 * Mercado Pago no dice qué centro pagó, así que un superadmin confirma la renovación en /plataforma.
 */
export const LINKS_PAGO: Partial<Record<`${PlanPago}-${1 | 12}`, string>> = {
  "BASICO-1": "https://mpago.li/1CXLn5a", // $280.000
  "PRO-1": "https://mpago.li/1PJriua", // $480.000
  "ENTERPRISE-1": "https://mpago.li/1L7EMKk", // $980.000
};

export const linkPago = (plan: PlanPago, meses: 1 | 12) => LINKS_PAGO[`${plan}-${meses}`] ?? null;

/** Días con acceso completo después de vencer, antes de bloquear el panel. */
export const DIAS_GRACIA = 1;
/** Desde cuántos días antes de vencer se avisa al centro. */
export const DIAS_AVISO = 5;

export type EstadoSuscripcion =
  | { estado: "VIGENTE"; dias: number }     // dias = días que faltan para el vencimiento
  | { estado: "POR_VENCER"; dias: number }
  | { estado: "GRACIA"; bloqueo: string }   // bloqueo = fecha en que se bloquea el panel
  | { estado: "VENCIDA" };

/**
 * `vence` es el último día pagado (inclusive). Al día siguiente empieza la gracia y después se bloquea.
 * Sin fecha (centro creado antes de las suscripciones) se considera vigente.
 */
export function estadoSuscripcion(vence: string | null | undefined, hoy: string): EstadoSuscripcion {
  if (!vence) return { estado: "VIGENTE", dias: 9999 };
  const dias = Math.round((Date.parse(vence) - Date.parse(hoy)) / 86_400_000);
  if (dias >= 0) return dias <= DIAS_AVISO ? { estado: "POR_VENCER", dias } : { estado: "VIGENTE", dias };
  if (-dias <= DIAS_GRACIA) return { estado: "GRACIA", bloqueo: addDaysISO(vence, DIAS_GRACIA + 1) };
  return { estado: "VENCIDA" };
}

export const suscripcionBloqueada = (vence: string | null | undefined, hoy: string) =>
  estadoSuscripcion(vence, hoy).estado === "VENCIDA";
