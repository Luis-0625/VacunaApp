import type { MotivoBaja } from "@/types/db";

export const MOTIVOS_BAJA: { id: MotivoBaja; label: string }[] = [
  { id: "VENCIDA", label: "Vencida" },
  { id: "ROTURA", label: "Rotura o daño" },
  { id: "CADENA_FRIO", label: "Falla de cadena de frío" },
  { id: "FRASCO_ABIERTO", label: "Frasco multidosis abierto (sobrante)" },
  { id: "OTRO", label: "Otro" },
];

/** Días para considerar que un lote "vence pronto". */
export const DIAS_ALERTA_VENCIMIENTO = 30;

export interface LoteInput {
  vacuna_id?: string;
  numero_lote: string;
  laboratorio: string | null;
  fecha_vencimiento: string;
  cantidad_inicial?: number;
  costo_unitario: number | null;
}

/** Valida los datos de un lote. `nuevo` exige vacuna y cantidad (no se editan después). */
export function parseLote(body: unknown, nuevo: boolean): { ok: true; data: LoteInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const numero = String(b.numero_lote ?? "").trim();
  const laboratorio = String(b.laboratorio ?? "").trim();
  const vence = String(b.fecha_vencimiento ?? "");
  const costoRaw = b.costo_unitario;
  const costo = costoRaw === "" || costoRaw == null ? null : Number(costoRaw);

  if (!numero || numero.length > 60) return { ok: false, error: "Escribe el número de lote" };
  if (laboratorio.length > 120) return { ok: false, error: "El laboratorio es demasiado largo" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence)) return { ok: false, error: "Fecha de vencimiento inválida" };
  if (costo !== null && (!Number.isFinite(costo) || costo < 0 || costo > 100_000_000)) {
    return { ok: false, error: "El costo por dosis no es válido" };
  }

  const data: LoteInput = { numero_lote: numero, laboratorio: laboratorio || null, fecha_vencimiento: vence, costo_unitario: costo };
  if (nuevo) {
    const vacunaId = String(b.vacuna_id ?? "");
    const cantidad = Number(b.cantidad_inicial);
    if (!vacunaId) return { ok: false, error: "Selecciona la vacuna" };
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1_000_000) {
      return { ok: false, error: "La cantidad recibida debe ser un número entero de dosis" };
    }
    data.vacuna_id = vacunaId;
    data.cantidad_inicial = cantidad;
  }
  return { ok: true, data };
}

export const pesos = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
