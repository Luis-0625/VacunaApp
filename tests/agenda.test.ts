import { describe, expect, it } from "vitest";
import { addDaysISO, fechasDisponibles, formatFechaLarga } from "@/lib/agenda";

describe("addDaysISO", () => {
  it("suma y resta días cruzando mes y año", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("maneja años bisiestos", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("formatFechaLarga", () => {
  it("escribe el día de la semana en español", () => {
    expect(formatFechaLarga("2026-10-15")).toBe("jueves 15 de octubre");
  });
});

/** Base falsa: la consulta de citas devuelve las fechas indicadas. */
function dbConCitas(fechas: string[]) {
  const q: any = {
    select: () => q, gte: () => q, lte: () => q, neq: () => q, eq: () => q,
    then: (res: (v: unknown) => void) => res({ data: fechas.map((f) => ({ fecha_proxima_dosis: f })), error: null }),
  };
  return { from: () => q } as any;
}

describe("fechasDisponibles", () => {
  // 2026-10-15 es jueves. Atiende de lunes a viernes (1-5).
  const agenda = { id: "c1", dias_atencion: [1, 2, 3, 4, 5], cupos_por_dia: 0 };

  it("omite los días en que el centro no atiende", async () => {
    const f = await fechasDisponibles(dbConCitas([]), "2026-10-15", agenda, 4);
    expect(f).toEqual(["2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21"]); // salta sábado y domingo
  });

  it("omite los días con el cupo lleno", async () => {
    const f = await fechasDisponibles(dbConCitas(["2026-10-16", "2026-10-16"]), "2026-10-15", { ...agenda, cupos_por_dia: 2 }, 2);
    expect(f).toEqual(["2026-10-19", "2026-10-20"]);
  });

  it("nunca ofrece el mismo día ni fechas pasadas", async () => {
    const f = await fechasDisponibles(dbConCitas([]), "2026-10-15", agenda, 3);
    expect(f.every((x) => x > "2026-10-15")).toBe(true);
  });
});
