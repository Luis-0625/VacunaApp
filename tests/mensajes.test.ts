import { describe, expect, it } from "vitest";
import { enumerar, nombresPacientes, porPaciente, type DosisMensaje } from "@/lib/mensaje-citas";
import { MENSAJE_CAMPANA_DEFAULT, PIE_CAMPANA, renderMensaje, variablesCampana, type DosisPendiente } from "@/lib/campanas";
import { enmascararDocumento } from "@/lib/carne";

const d = (pacienteId: string, nombre: string, vacuna = "Hepatitis B", dosis = 2): DosisMensaje => ({ pacienteId, nombre, vacuna, dosis });

describe("mensaje-citas", () => {
  it("enumera en español", () => {
    expect(enumerar([])).toBe("");
    expect(enumerar(["Ana"])).toBe("Ana");
    expect(enumerar(["Ana", "Luis"])).toBe("Ana y Luis");
    expect(enumerar(["Ana", "Luis", "Sofía"])).toBe("Ana, Luis y Sofía");
  });
  it("agrupa por paciente y deja el primer nombre con mayúscula inicial", () => {
    const g = porPaciente([d("1", "luis RIVERA"), d("1", "luis RIVERA", "Polio"), d("2", "ana pérez")]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ nombre: "Luis" });
    expect(g[0].dosis).toHaveLength(2);
  });
  it("no repite el nombre de quien tiene varias dosis", () => {
    expect(nombresPacientes([d("1", "Luis Rivera"), d("1", "Luis Rivera", "Polio"), d("2", "Ana Pérez")])).toBe("Luis y Ana");
  });
});

describe("campañas", () => {
  const fila = {
    nombre_completo: "María López", vacuna: "Hepatitis B", numero_dosis: 1, fecha_proxima_dosis: "2026-10-15",
  } as DosisPendiente;

  it("la dosis del mensaje es la siguiente a la aplicada", () => {
    expect(variablesCampana(fila, "IPS Salud")).toMatchObject({
      nombre: "María", vacuna: "Hepatitis B", dosis: "2", centro: "IPS Salud", fecha: "jueves 15 de octubre",
    });
  });
  it("el mensaje siempre lleva las instrucciones de respuesta y de baja (Ley 1581)", () => {
    const msg = renderMensaje(MENSAJE_CAMPANA_DEFAULT, variablesCampana(fila, "IPS Salud"));
    expect(msg).toContain("María");
    expect(msg).toContain("dosis 2 de Hepatitis B");
    expect(msg.endsWith(PIE_CAMPANA)).toBe(true);
    expect(msg).toContain("SALIR");
  });
  it("deja intactas las variables desconocidas", () => {
    expect(renderMensaje("Hola {nombre} {otra}", { nombre: "Ana" })).toContain("Hola Ana {otra}");
  });
});

describe("enmascararDocumento", () => {
  it("oculta el centro del documento", () => {
    expect(enmascararDocumento("1023456789")).toBe("1••••••789");
    expect(enmascararDocumento("123")).toBe("•••");
  });
});
