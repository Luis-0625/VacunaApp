import { describe, expect, it } from "vitest";
import { DIAS_AVISO, estadoSuscripcion, linkPago, precio, suscripcionBloqueada } from "@/lib/suscripcion";

describe("estadoSuscripcion", () => {
  const hoy = "2026-10-15";
  it("sin fecha de vencimiento se considera vigente", () => {
    expect(estadoSuscripcion(null, hoy).estado).toBe("VIGENTE");
    expect(estadoSuscripcion(undefined, hoy).estado).toBe("VIGENTE");
  });
  it("vigente si faltan más de DIAS_AVISO días", () => {
    expect(estadoSuscripcion("2026-11-30", hoy).estado).toBe("VIGENTE");
  });
  it("por vencer dentro de la ventana de aviso, incluido el último día pagado", () => {
    expect(estadoSuscripcion("2026-10-20", hoy)).toEqual({ estado: "POR_VENCER", dias: DIAS_AVISO });
    expect(estadoSuscripcion(hoy, hoy)).toEqual({ estado: "POR_VENCER", dias: 0 });
  });
  it("un día de gracia después de vencer, con la fecha de bloqueo", () => {
    expect(estadoSuscripcion("2026-10-14", hoy)).toEqual({ estado: "GRACIA", bloqueo: "2026-10-16" });
  });
  it("vencida (bloqueada) pasada la gracia", () => {
    expect(estadoSuscripcion("2026-10-13", hoy).estado).toBe("VENCIDA");
    expect(suscripcionBloqueada("2026-10-13", hoy)).toBe(true);
    expect(suscripcionBloqueada("2026-10-14", hoy)).toBe(false);
  });
});

describe("precios", () => {
  it("el plan anual equivale a 10 meses", () => {
    for (const p of ["BASICO", "PRO", "ENTERPRISE"] as const) expect(precio(p, 12)).toBe(precio(p, 1) * 10);
  });
  it("todos los planes tienen link de pago mensual y anual", () => {
    for (const p of ["BASICO", "PRO", "ENTERPRISE"] as const) {
      expect(linkPago(p, 1)).toMatch(/^https:\/\//);
      expect(linkPago(p, 12)).toMatch(/^https:\/\//);
    }
  });
});
