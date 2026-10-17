import { describe, expect, it } from "vitest";
import { parseVacuna } from "@/lib/vacunas";
import { parseLote } from "@/lib/inventario";
import { parseAutoriza, parsePaciente } from "@/lib/pacientes";

describe("parseVacuna", () => {
  const base = { nombre: " Hepatitis B ", dosis_totales: 3, intervalo_dias_recom_dosis: 30 };
  it("acepta una vacuna válida y limpia el nombre", () => {
    expect(parseVacuna(base)).toMatchObject({ ok: true, data: { nombre: "Hepatitis B", dosis_totales: 3, stock_minimo: 0 } });
  });
  it("una sola dosis no lleva intervalo", () => {
    const r = parseVacuna({ nombre: "Influenza", dosis_totales: 1, intervalo_dias_recom_dosis: 30 });
    expect(r).toMatchObject({ ok: true, data: { intervalo_dias_recom_dosis: null } });
  });
  it("exige intervalo si hay más de una dosis", () => {
    expect(parseVacuna({ ...base, intervalo_dias_recom_dosis: "" }).ok).toBe(false);
  });
  it("rechaza nombre vacío, dosis fuera de rango y mínimos negativos", () => {
    expect(parseVacuna({ ...base, nombre: " " }).ok).toBe(false);
    expect(parseVacuna({ ...base, dosis_totales: 0 }).ok).toBe(false);
    expect(parseVacuna({ ...base, dosis_totales: 21 }).ok).toBe(false);
    expect(parseVacuna({ ...base, stock_minimo: -1 }).ok).toBe(false);
  });
});

describe("parseLote", () => {
  const nuevo = { numero_lote: "L-001", fecha_vencimiento: "2027-05-01", vacuna_id: "v1", cantidad_inicial: 50 };
  it("acepta un lote nuevo válido", () => {
    expect(parseLote(nuevo, true)).toMatchObject({ ok: true, data: { numero_lote: "L-001", cantidad_inicial: 50 } });
  });
  it("al editar no exige vacuna ni cantidad", () => {
    expect(parseLote({ numero_lote: "L-001", fecha_vencimiento: "2027-05-01" }, false).ok).toBe(true);
  });
  it("rechaza fecha mal formada, cantidad no entera y costo negativo", () => {
    expect(parseLote({ ...nuevo, fecha_vencimiento: "01/05/2027" }, true).ok).toBe(false);
    expect(parseLote({ ...nuevo, cantidad_inicial: 2.5 }, true).ok).toBe(false);
    expect(parseLote({ ...nuevo, cantidad_inicial: 0 }, true).ok).toBe(false);
    expect(parseLote({ ...nuevo, costo_unitario: -5 }, true).ok).toBe(false);
  });
});

describe("parsePaciente", () => {
  const ok = { nombre_completo: "Ana Pérez", documento_identidad: "123", telefono: "300 123 4567", email: "ANA@Mail.com" };
  it("normaliza teléfono y correo", () => {
    expect(parsePaciente(ok)).toMatchObject({ ok: true, data: { telefono: "+573001234567", email: "ana@mail.com" } });
  });
  it("campos obligatorios y formatos", () => {
    expect(parsePaciente({ ...ok, nombre_completo: "" }).ok).toBe(false);
    expect(parsePaciente({ ...ok, documento_identidad: "" }).ok).toBe(false);
    expect(parsePaciente({ ...ok, telefono: "12" }).ok).toBe(false);
    expect(parsePaciente({ ...ok, email: "no-es-correo" }).ok).toBe(false);
    expect(parsePaciente({ ...ok, fecha_nacimiento: "1/2/2020" }).ok).toBe(false);
  });
  it("registra la autorización (Ley 1581) solo si viene informada", () => {
    const sin = parsePaciente(ok);
    expect(sin.ok && sin.data.autoriza_mensajes).toBeFalsy();
    expect(parsePaciente({ ...ok, autoriza_mensajes: "Sí" })).toMatchObject({ data: { autoriza_mensajes: "AUTORIZADO" } });
    expect(parsePaciente({ ...ok, autoriza_mensajes: "quizás" }).ok).toBe(false);
  });
});

describe("parseAutoriza", () => {
  it("entiende sí/no con o sin tilde", () => {
    expect(parseAutoriza("Sí")).toBe("AUTORIZADO");
    expect(parseAutoriza("NO")).toBe("NO_AUTORIZADO");
    expect(parseAutoriza("")).toBeUndefined();
    expect(parseAutoriza("tal vez")).toBe("invalid");
  });
});
