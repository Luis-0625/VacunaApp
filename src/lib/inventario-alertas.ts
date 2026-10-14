import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "@/lib/agenda";
import { fetchAll } from "@/lib/fetch-all";
import { DIAS_ALERTA_VENCIMIENTO } from "@/lib/inventario";

export interface AlertaLote {
  numero_lote: string;
  vacuna: string;
  fecha_vencimiento: string;
  existencias: number;
}

export interface AlertasInventario {
  /** Lotes vencidos que aún tienen dosis en nevera (hay que retirarlos). */
  vencidos: AlertaLote[];
  /** Lotes con dosis que vencen en los próximos DIAS_ALERTA_VENCIMIENTO días. */
  porVencer: AlertaLote[];
  /** Vacunas con inventario cuyas dosis vigentes están por debajo de su mínimo. */
  bajoMinimo: { vacuna: string; disponibles: number; minimo: number }[];
  total: number;
}

interface LoteFila { numero_lote: string; vacuna_id: string; fecha_vencimiento: string; existencias: number }

/**
 * Alertas de inventario de un centro. Con un cliente de sesión no hace falta `centroId` (las reglas de
 * seguridad limitan al centro del usuario); con el de service role es obligatorio.
 */
export async function calcularAlertasInventario(
  db: SupabaseClient, hoy: string, centroId?: string
): Promise<AlertasInventario> {
  const [lotes, vacunasRes] = await Promise.all([
    fetchAll<LoteFila>((f, t) => {
      let q = db.from("lotes").select("numero_lote, vacuna_id, fecha_vencimiento, existencias");
      if (centroId) q = q.eq("centro_id", centroId);
      return q.order("fecha_vencimiento").order("id").range(f, t).returns<LoteFila[]>();
    }),
    (() => {
      let q = db.from("vacunas").select("id, nombre, stock_minimo");
      if (centroId) q = q.eq("centro_id", centroId);
      return q.returns<{ id: string; nombre: string; stock_minimo: number }[]>();
    })(),
  ]);
  const vacunas = vacunasRes.data ?? [];
  const nombre = new Map(vacunas.map((v) => [v.id, v.nombre]));
  const limite = addDaysISO(hoy, DIAS_ALERTA_VENCIMIENTO);
  const aAlerta = (l: LoteFila): AlertaLote => ({
    numero_lote: l.numero_lote, vacuna: nombre.get(l.vacuna_id) ?? "", fecha_vencimiento: l.fecha_vencimiento, existencias: l.existencias,
  });

  const conDosis = lotes.filter((l) => l.existencias > 0);
  const vencidos = conDosis.filter((l) => l.fecha_vencimiento < hoy).map(aAlerta);
  const porVencer = conDosis.filter((l) => l.fecha_vencimiento >= hoy && l.fecha_vencimiento <= limite).map(aAlerta);

  // Solo vacunas que llevan inventario (tienen al menos un lote, aunque esté agotado) y con mínimo definido
  const bajoMinimo = vacunas
    .filter((v) => v.stock_minimo > 0 && lotes.some((l) => l.vacuna_id === v.id))
    .map((v) => ({
      vacuna: v.nombre,
      minimo: v.stock_minimo,
      disponibles: conDosis.filter((l) => l.vacuna_id === v.id && l.fecha_vencimiento >= hoy).reduce((n, l) => n + l.existencias, 0),
    }))
    .filter((v) => v.disponibles < v.minimo);

  return { vencidos, porVencer, bajoMinimo, total: vencidos.length + porVencer.length + bajoMinimo.length };
}
