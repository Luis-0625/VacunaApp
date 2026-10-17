import { describe, expect, it } from "vitest";
import {
  clasificarPacientes, normNombre, pick, planificarDosis, planificarLotes, planificarVacunas, toEntero, toISODate, type VacunaRef,
} from "@/lib/importacion";

describe("lectura tolerante", () => {
  it("encuentra la columna por alias, sin importar mayúsculas, tildes ni espacios", () => {
    expect(pick({ " Número Lote ": "A1" }, ["numero_lote"])).toBe("A1");
    expect(pick({ Cédula: "" , cc: "55" }, ["cedula", "cc"])).toBe("55");
  });
  it("entiende fechas en varios formatos y rechaza las imposibles", () => {
    expect(toISODate("2026-10-05")).toBe("2026-10-05");
    expect(toISODate("5/10/2026")).toBe("2026-10-05");
    expect(toISODate(46313)).toBe("2026-10-18"); // serial de Excel
    expect(toISODate("2026-02-31")).toBe("invalid");
    expect(toISODate("hola")).toBe("invalid");
    expect(toISODate("")).toBeNull();
  });
  it("toEntero", () => {
    expect(toEntero("3")).toBe(3);
    expect(toEntero("")).toBeNull();
    expect(toEntero("2.5")).toBe("invalid");
    expect(toEntero("-1")).toBe("invalid");
  });
  it("normNombre ignora tildes y espacios repetidos", () => {
    expect(normNombre("  Tétanos   / Difteria ")).toBe("tetanos / difteria");
  });
});

describe("planificarVacunas", () => {
  it("valida, omite las que ya existen y detecta repetidas", () => {
    const r = planificarVacunas([
      { nombre: "Hepatitis B", dosis_totales: 3, intervalo_dias: 30 },
      { nombre: "Influenza", dosis_totales: 1 },
      { nombre: "hepatitis  b", dosis_totales: 3, intervalo_dias: 30 },
      { nombre: "COVID-19", dosis_totales: 2 },
      { nombre: "Polio", dosis_totales: 3, intervalo_dias: 60 },
    ], new Set(["polio"]));
    expect(r.insertar.map((v) => v.nombre)).toEqual(["Hepatitis B", "Influenza"]);
    expect(r.omitidas).toBe(1);
    expect(r.errores.map((e) => e.fila)).toEqual([4, 5]); // repetida y COVID sin intervalo
  });
});

const hepB: VacunaRef = { id: "v-hepb", dosis_totales: 3, intervalo: 30 };
const flu: VacunaRef = { id: "v-flu", dosis_totales: 1, intervalo: null };
const vacunas = new Map([["hepatitis b", hepB], ["influenza", flu]]);
const pacientes = new Map([["111", "p1"], ["222", "p2"]]);
const base = { hoy: "2026-10-15", vacunas, pacientes, existentes: [] as never[] };

describe("planificarDosis", () => {
  it("numera las dosis por fecha y calcula la próxima con el intervalo", () => {
    const r = planificarDosis([
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-09-20" },
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-08-20" },
    ], base);
    expect(r.errores).toEqual([]);
    const porFecha = [...r.insertar].sort((a, b) => a.fecha_aplicacion.localeCompare(b.fecha_aplicacion));
    expect(porFecha.map((d) => d.numero_dosis)).toEqual([1, 2]);
    expect(porFecha[0].fecha_proxima_dosis).toBe("2026-09-19");
    expect(porFecha[1].fecha_proxima_dosis).toBe("2026-10-20");
  });

  it("la última dosis del esquema no lleva próxima, aunque venga en el archivo", () => {
    const r = planificarDosis([
      { documento: "222", vacuna: "Influenza", fecha_aplicacion: "2026-10-01", fecha_proxima_dosis: "2027-10-01" },
    ], base);
    expect(r.insertar[0]).toMatchObject({ numero_dosis: 1, fecha_proxima_dosis: null });
  });

  it("respeta la próxima dosis indicada", () => {
    const r = planificarDosis([
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-10-01", fecha_proxima_dosis: "2026-11-15" },
    ], base);
    expect(r.insertar[0].fecha_proxima_dosis).toBe("2026-11-15");
  });

  it("repetir el archivo no duplica: lo ya registrado se omite", () => {
    const existentes = [{ paciente_id: "p1", vacuna_id: "v-hepb", numero_dosis: 1, fecha_aplicacion: "2026-09-20" }];
    const r = planificarDosis([{ documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-09-20" }], { ...base, existentes });
    expect(r.insertar).toHaveLength(0);
    expect(r.omitidas).toBe(1);
  });

  it("continúa la numeración después de las dosis existentes", () => {
    const existentes = [{ paciente_id: "p1", vacuna_id: "v-hepb", numero_dosis: 1, fecha_aplicacion: "2026-08-01" }];
    const r = planificarDosis([{ documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-09-05" }], { ...base, existentes });
    expect(r.insertar[0].numero_dosis).toBe(2);
  });

  it("rechaza lo que no se puede cargar, con el número de fila", () => {
    const r = planificarDosis([
      { documento: "999", vacuna: "Hepatitis B", fecha_aplicacion: "2026-10-01" },      // fila 2: paciente inexistente
      { documento: "111", vacuna: "Rabia", fecha_aplicacion: "2026-10-01" },            // fila 3: vacuna inexistente
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-12-01" },      // fila 4: fecha futura
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-10-01", numero_dosis: 4 }, // fila 5: supera el esquema
      { documento: "111", vacuna: "Hepatitis B", fecha_aplicacion: "2026-10-01", fecha_proxima_dosis: "2026-09-01" }, // fila 6
      { documento: "111", vacuna: "Hepatitis B" },                                      // fila 7: sin fecha
    ], base);
    expect(r.insertar).toHaveLength(0);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("no permite pasar de las dosis totales", () => {
    const existentes = [{ paciente_id: "p2", vacuna_id: "v-flu", numero_dosis: 1, fecha_aplicacion: "2025-10-01" }];
    const r = planificarDosis([{ documento: "222", vacuna: "Influenza", fecha_aplicacion: "2026-10-01" }], { ...base, existentes });
    expect(r.insertar).toHaveLength(0);
    expect(r.errores[0].motivo).toContain("completo el esquema");
  });
});

describe("planificarLotes", () => {
  const ctx = { vacunas, existentes: new Set<string>() };
  it("carga las existencias de hoy como cantidad del lote", () => {
    const r = planificarLotes([
      { vacuna: "Influenza", numero_lote: "L-1", fecha_vencimiento: "2027-03-01", existencias: 40, laboratorio: "Sanofi" },
    ], ctx);
    expect(r.errores).toEqual([]);
    expect(r.insertar[0]).toMatchObject({ vacuna_id: "v-flu", numero_lote: "L-1", cantidad_inicial: 40, laboratorio: "Sanofi" });
  });
  it("omite lotes existentes o sin existencias y marca los errores", () => {
    const r = planificarLotes([
      { vacuna: "Influenza", numero_lote: "L-1", fecha_vencimiento: "2027-03-01", existencias: 10 },  // ya existe
      { vacuna: "Influenza", numero_lote: "L-2", fecha_vencimiento: "2027-03-01", existencias: 0 },   // agotado
      { vacuna: "Rabia", numero_lote: "L-3", fecha_vencimiento: "2027-03-01", existencias: 5 },       // vacuna inexistente
      { vacuna: "Influenza", numero_lote: "L-4", fecha_vencimiento: "mañana", existencias: 5 },       // fecha mala
      { vacuna: "Influenza", numero_lote: "L-5", fecha_vencimiento: "2027-03-01", existencias: "x" }, // existencias malas
    ], { vacunas, existentes: new Set(["v-flu|l-1"]) });
    expect(r.insertar).toHaveLength(0);
    expect(r.omitidas).toBe(2);
    expect(r.errores.map((e) => e.fila)).toEqual([4, 5, 6]);
  });
});

describe("clasificarPacientes", () => {
  const existente = { nombre_completo: "Ana Pérez", email: null, telefono: "+573001234567", fecha_nacimiento: "1990-03-15", autoriza_mensajes: "AUTORIZADO" };
  const fila = { documento_identidad: "111", nombre_completo: "Ana Pérez", email: null, telefono: "+573001234567", fecha_nacimiento: "1990-03-15" };
  const existentes = new Map([["111", existente]]);

  it("distingue nuevos, iguales y actualizados", () => {
    const r = clasificarPacientes([
      fila,                                                    // igual
      { ...fila, documento_identidad: "222" },                 // nuevo
      { ...fila, telefono: "+573009999999" },                  // existe pero cambió el teléfono
    ].map((f, i) => (i === 2 ? { ...f, documento_identidad: "111" } : f)), existentes);
    expect(r).toMatchObject({ nuevos: 1, actualizados: 1, iguales: 1 });
    expect(r.aGuardar).toHaveLength(2); // lo que ya estaba igual no se vuelve a guardar
  });
  it("la autorización solo cuenta si la columna venía en el archivo", () => {
    expect(clasificarPacientes([fila], existentes).iguales).toBe(1);
    expect(clasificarPacientes([{ ...fila, autoriza_mensajes: "AUTORIZADO" }], existentes).iguales).toBe(1);
    expect(clasificarPacientes([{ ...fila, autoriza_mensajes: "NO_AUTORIZADO" }], existentes).actualizados).toBe(1);
  });
  it("un correo o fecha de nacimiento distintos también cuentan como cambio", () => {
    expect(clasificarPacientes([{ ...fila, email: "ana@mail.com" }], existentes).actualizados).toBe(1);
    expect(clasificarPacientes([{ ...fila, fecha_nacimiento: null }], existentes).actualizados).toBe(1);
  });
});
