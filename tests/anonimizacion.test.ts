import { describe, expect, it } from "vitest";
import { ACCIONES, cambios, etiquetaAccion } from "@/lib/auditoria";
import { PREFIJO_ANONIMO } from "@/lib/pacientes";

describe("anonimización en la auditoría", () => {
  it("la acción ANONIMIZAR tiene etiqueta y se puede filtrar", () => {
    expect(etiquetaAccion("ANONIMIZAR")).toBe("Anonimizó");
    expect(ACCIONES.map((a) => a.valor)).toContain("ANONIMIZAR");
  });
  it("un registro sin datos (ya anonimizado) no muestra campos", () => {
    expect(cambios({ antes: null, despues: null })).toEqual([]);
  });
  it("el prefijo de los pacientes anonimizados coincide con el del SQL", () => {
    // anonimizar_paciente() deja el documento como 'ANON-<id>'
    expect(PREFIJO_ANONIMO).toBe("ANON-");
  });
});
