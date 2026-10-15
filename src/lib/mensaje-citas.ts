/** Una dosis pendiente dentro de un mensaje (recordatorio o respuesta del bot). */
export interface DosisMensaje {
  pacienteId: string;
  nombre: string; // nombre completo del paciente
  vacuna: string;
  dosis: number; // número de la dosis que le corresponde
}

/** "Ana", "Ana y Luis", "Ana, Luis y Sofía". */
export const enumerar = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

/** "luis rivera" -> "Luis". */
const primerNombre = (nombre: string) => {
  const n = nombre.trim().split(/\s+/)[0] ?? "";
  return n.charAt(0).toLocaleUpperCase("es") + n.slice(1).toLocaleLowerCase("es");
};

/** Cada paciente una sola vez (en el orden en que aparece), con sus dosis. */
export function porPaciente(ds: DosisMensaje[]) {
  const pacientes = new Map<string, { nombre: string; dosis: DosisMensaje[] }>();
  for (const d of ds) {
    const p = pacientes.get(d.pacienteId) ?? { nombre: primerNombre(d.nombre), dosis: [] };
    p.dosis.push(d);
    pacientes.set(d.pacienteId, p);
  }
  return [...pacientes.values()];
}

/** Primeros nombres sin repetir: "Luis" aunque tenga tres citas, "Luis y Ana" si comparten teléfono. */
export const nombresPacientes = (ds: DosisMensaje[]) => enumerar([...new Set(porPaciente(ds).map((p) => p.nombre))]);
