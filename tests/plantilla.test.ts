import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { construirPlantilla } from "@/lib/plantilla-excel";
import { HOJAS, leerLibro } from "@/lib/plantilla-carga";
import { planificarDosis, planificarLotes, planificarVacunas, normNombre } from "@/lib/importacion";

const aBuffer = (b: Buffer | ExcelJS.Buffer) => {
  const u = new Uint8Array(b as ArrayBuffer);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
};

async function plantillaLlena() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await construirPlantilla() as never);
  const poner = (hoja: string, fila: number, valores: (string | number | Date)[]) =>
    valores.forEach((v, i) => { wb.getWorksheet(hoja)!.getCell(fila, i + 1).value = v; });
  // Las filas se llenan desde la 3 (la 2 es el ejemplo); dejamos una fila vacía en medio para comprobar los números de fila
  poner("1. Vacunas", 3, ["Hepatitis B", 3, 30, "Esquema 0-1-6", 10]);
  poner("1. Vacunas", 4, ["Influenza", 1]);
  poner("2. Pacientes", 3, ["Ana Pérez", "1023456789", "300 123 4567", "ana@mail.com", new Date(Date.UTC(1990, 2, 15)), "SI"]);
  poner("3. Dosis aplicadas", 3, ["1023456789", "Hepatitis B", new Date(Date.UTC(2026, 8, 15))]);
  poner("3. Dosis aplicadas", 5, ["1023456789", "Hepatitis B", new Date(Date.UTC(2026, 9, 14)), 2]);
  poner("4. Inventario actual", 3, ["Influenza", "L-77", new Date(Date.UTC(2027, 5, 30)), 42, "Sanofi", 18500]);
  return aBuffer(await wb.xlsx.writeBuffer());
}

describe("plantilla de carga inicial", () => {
  it("tiene la hoja de inicio y una hoja por dato, con encabezados, ejemplo y listas", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await construirPlantilla() as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Inicio", ...HOJAS.map((h) => h.nombre)]);
    for (const h of HOJAS) {
      const ws = wb.getWorksheet(h.nombre)!;
      expect(h.columnas.map((c, i) => ws.getCell(1, i + 1).value)).toEqual(h.columnas.map((c) => c.titulo));
      expect(String(ws.getCell(2, 1).value)).toMatch(/^Ej:/);
    }
    const dosis = wb.getWorksheet("3. Dosis aplicadas")!;
    expect(dosis.getCell(3, 2).dataValidation.type).toBe("list"); // vacuna desplegable
    expect(wb.getWorksheet("2. Pacientes")!.getCell(3, 6).dataValidation.formulae).toEqual(['"SI,NO"']);
  });

  it("al leerla llena se ignora el ejemplo y los errores apuntan a la fila real del Excel", async () => {
    const hojas = leerLibro(await plantillaLlena());
    expect(hojas.vacunas!.map((f) => f.__fila)).toEqual([3, 4]);
    expect(hojas.dosis!.map((f) => f.__fila)).toEqual([3, 5]);
    expect(hojas.pacientes).toHaveLength(1);
  });

  it("los encabezados de la plantilla son entendidos por el importador de punta a punta", async () => {
    const hojas = leerLibro(await plantillaLlena());

    const v = planificarVacunas(hojas.vacunas!, new Set());
    expect(v.errores).toEqual([]);
    expect(v.insertar.map((x) => [x.nombre, x.dosis_totales, x.intervalo_dias_recom_dosis, x.stock_minimo]))
      .toEqual([["Hepatitis B", 3, 30, 10], ["Influenza", 1, null, 0]]);

    const vacunas = new Map([
      [normNombre("Hepatitis B"), { id: "hb", dosis_totales: 3, intervalo: 30 }],
      [normNombre("Influenza"), { id: "flu", dosis_totales: 1, intervalo: null }],
    ]);
    const d = planificarDosis(hojas.dosis!, { hoy: "2026-10-15", vacunas, pacientes: new Map([["1023456789", "p1"]]), existentes: [] });
    expect(d.errores).toEqual([]);
    expect(d.insertar.map((x) => [x.fila, x.numero_dosis, x.fecha_aplicacion, x.fecha_proxima_dosis]))
      .toEqual([[3, 1, "2026-09-15", "2026-10-15"], [5, 2, "2026-10-14", "2026-11-13"]]);

    const l = planificarLotes(hojas.lotes!, { vacunas, existentes: new Set() });
    expect(l.errores).toEqual([]);
    expect(l.insertar[0]).toMatchObject({ vacuna_id: "flu", numero_lote: "L-77", cantidad_inicial: 42, laboratorio: "Sanofi", costo_unitario: 18500, fecha_vencimiento: "2027-06-30" });
  });
});
