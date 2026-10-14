export interface VacunaInput {
  nombre: string;
  dosis_totales: number;
  intervalo_dias_recom_dosis: number | null;
  descripcion: string | null;
}

export function parseVacuna(body: unknown): { ok: true; data: VacunaInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const nombre = String(b.nombre ?? "").trim();
  const dosis = Number(b.dosis_totales);
  const intervaloRaw = b.intervalo_dias_recom_dosis;
  const intervalo = intervaloRaw === "" || intervaloRaw == null ? null : Number(intervaloRaw);
  const descripcion = String(b.descripcion ?? "").trim();

  if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
  if (!Number.isInteger(dosis) || dosis < 1 || dosis > 20) return { ok: false, error: "Las dosis deben ser un entero entre 1 y 20" };
  if (intervalo !== null && (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 3650))
    return { ok: false, error: "El intervalo debe ser un número de días entre 1 y 3650" };
  if (dosis > 1 && intervalo === null)
    return { ok: false, error: "Indica cada cuántos días se aplica la siguiente dosis" };

  return {
    ok: true,
    data: {
      nombre,
      dosis_totales: dosis,
      intervalo_dias_recom_dosis: dosis > 1 ? intervalo : null,
      descripcion: descripcion || null,
    },
  };
}
