import { describe, expect, it } from "vitest";
import { cambios, etiquetaCampo, finDia, inicioDia, leerFiltros, valorLegible } from "@/lib/auditoria";

describe("cambios", () => {
  it("muestra antes y después con nombres legibles y sin columnas internas", () => {
    const filas = cambios({
      antes: { telefono: "+573001111111", id: "x", centro_id: "c" },
      despues: { telefono: "+573002222222", id: "x", centro_id: "c" },
    });
    expect(filas).toEqual([{ campo: "Teléfono", antes: "+573001111111", despues: "+573002222222" }]);
  });
  it("al crear solo hay 'después'; al eliminar solo 'antes'", () => {
    expect(cambios({ antes: null, despues: { numero_dosis: 2 } })).toEqual([{ campo: "Número de dosis", antes: null, despues: "2" }]);
    expect(cambios({ antes: { nombre: "Polio" }, despues: null })).toEqual([{ campo: "Nombre", antes: "Polio", despues: null }]);
  });
  it("valores vacíos y booleanos legibles", () => {
    expect(valorLegible(null)).toBe("—");
    expect(valorLegible("")).toBe("—");
    expect(valorLegible(true)).toBe("Sí");
    expect(valorLegible(false)).toBe("No");
    expect(etiquetaCampo("campo_raro")).toBe("campo raro");
  });
});

describe("leerFiltros", () => {
  it("acepta filtros válidos", () => {
    const f = leerFiltros({
      tabla: "pacientes", accion: "ELIMINAR", usuario: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      desde: "2026-10-01", hasta: "2026-10-15", q: "María", p: "3",
    });
    expect(f).toMatchObject({ tabla: "pacientes", accion: "ELIMINAR", desde: "2026-10-01", hasta: "2026-10-15", q: "María", pagina: 3 });
  });
  it("descarta lo inválido y limpia la búsqueda", () => {
    const f = leerFiltros({ tabla: "usuarios; drop table", accion: "X", usuario: "no-es-uuid", desde: "ayer", q: "a%,b_(c)*", p: "-4" });
    expect(f.tabla).toBeUndefined();
    expect(f.accion).toBeUndefined();
    expect(f.usuario).toBeUndefined();
    expect(f.desde).toBeUndefined();
    expect(f.q).toBe("a  b  c");
    expect(f.pagina).toBe(1);
  });
  it("permite filtrar por procesos automáticos", () => {
    expect(leerFiltros({ usuario: "sistema" }).usuario).toBe("sistema");
  });
});

describe("rango de fechas", () => {
  it("cubre el día completo en hora de Colombia", () => {
    expect(inicioDia("2026-10-15")).toBe("2026-10-15T00:00:00-05:00");
    expect(finDia("2026-10-15")).toBe("2026-10-15T23:59:59.999-05:00");
  });
});
