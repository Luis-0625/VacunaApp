import ExcelJS from "exceljs";
import { HOJAS } from "@/lib/plantilla-carga";

/**
 * Genera la plantilla de carga inicial: una hoja de inicio con los pasos, y una hoja por dato con encabezados de
 * color (azul = obligatorio, gris = opcional), una fila de ejemplo, notas en cada columna, listas desplegables y
 * formato de fecha. SOLO servidor (exceljs es pesado). Los encabezados deben seguir coincidiendo con plantilla-carga.ts.
 */

const FILAS_CON_FORMATO = 2000; // filas de datos con validación y formato listos
const GRIS = "FFD1D5DB";
const sol = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;
const borde = (argb: string) => ({ style: "thin", color: { argb } }) as const;

type Hoja = (typeof HOJAS)[number];

export async function construirPlantilla(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VacunaApp";
  wb.created = new Date();

  hojaInicio(wb);
  for (const h of HOJAS) hojaDatos(wb, h);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------------------------
// Hoja de inicio

function hojaInicio(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Inicio", { properties: { tabColor: { argb: "FF111827" } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const ANCHO_TEXTO = 100; // caracteres aproximados por línea en C:H

  const alto = (texto: string, min = 24) => Math.max(min, Math.ceil(texto.length / ANCHO_TEXTO) * 19 + 8);
  const fila = (n: number, alturaFila: number) => (ws.getRow(n).height = alturaFila);

  // Banner
  ws.mergeCells("B2:H2");
  Object.assign(ws.getCell("B2"), { value: "Plantilla de carga inicial" });
  ws.getCell("B2").font = { name: "Calibri", size: 24, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("B2").fill = sol("FF2563EB");
  ws.getCell("B2").alignment = { vertical: "middle", indent: 1 };
  fila(2, 48);
  ws.mergeCells("B3:H3");
  ws.getCell("B3").value = "VacunaApp · Dejamos su sistema listo con los pacientes vacunados en los últimos 1 o 2 meses";
  ws.getCell("B3").font = { name: "Calibri", size: 12, color: { argb: "FF1E3A8A" } };
  ws.getCell("B3").fill = sol("FFDBEAFE");
  ws.getCell("B3").alignment = { vertical: "middle", indent: 1 };
  fila(3, 30);

  // Pasos
  titulo(ws, 5, "Cómo llenarla: 4 hojas, en este orden");
  const pasos: [Hoja, string, string][] = [
    [HOJAS[0], "Vacunas.", " Las vacunas que aplica el centro y cuántas dosis tiene cada una. Se hace una sola vez."],
    [HOJAS[1], "Pacientes.", " Las personas vacunadas en el periodo que se va a cargar. Nombre, documento y celular son obligatorios."],
    [HOJAS[2], "Dosis aplicadas.", " Una fila por cada dosis ya aplicada: quién, qué vacuna y qué día. Con esto el sistema programa los recordatorios y avisa quién está atrasado."],
    [HOJAS[3], "Inventario actual.", " Cuántas dosis hay HOY en la nevera, por lote. Se llena junto con el administrador del centro, contando físicamente."],
  ];
  pasos.forEach(([h, negrita, resto], i) => {
    const r = 6 + i;
    const num = ws.getCell(`B${r}`);
    num.value = i + 1;
    num.font = { name: "Calibri", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
    num.fill = sol(`FF${h.color}`);
    num.alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(`C${r}:H${r}`);
    const t = ws.getCell(`C${r}`);
    t.value = { richText: [{ font: { name: "Calibri", size: 12, bold: true, color: { argb: `FF${h.color}` } }, text: negrita }, { font: { name: "Calibri", size: 12 }, text: resto }] };
    t.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    t.border = { bottom: borde("FFE5E7EB") };
    fila(r, alto(negrita + resto, 40));
  });

  // Cómo leer las hojas
  titulo(ws, 11, "Cómo leer cada hoja");
  const leyenda: [string, string, string, string, boolean][] = [
    ["Azul", "FF2563EB", "FFFFFFFF", "Columna obligatoria (el color cambia según la hoja).", true],
    ["Gris", GRIS, "FF374151", "Columna opcional: puede dejarla vacía.", true],
    ["Ej: …", "FFF3F4F6", "FF9CA3AF", "Fila de ejemplo, en gris y cursiva. Puede borrarla o escribir encima; el sistema la ignora.", false],
  ];
  leyenda.forEach(([etiqueta, fondo, texto, descr, negrita], i) => {
    const r = 12 + i;
    ws.mergeCells(`B${r}:C${r}`);
    const c = ws.getCell(`B${r}`);
    c.value = etiqueta;
    c.fill = sol(fondo);
    c.font = { name: "Calibri", size: 11, bold: negrita, italic: !negrita, color: { argb: texto } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(`D${r}:H${r}`);
    const d = ws.getCell(`D${r}`);
    d.value = descr;
    d.font = { name: "Calibri", size: 11 };
    d.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    fila(r, 26);
  });
  ws.mergeCells("B15:H15");
  ws.getCell("B15").value = "Tip: pase el mouse sobre el encabezado de cada columna para ver qué debe escribir.";
  ws.getCell("B15").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF4B5563" } };
  ws.getCell("B15").alignment = { vertical: "middle", indent: 0 };
  fila(15, 26);

  // Importante
  titulo(ws, 17, "Importante");
  const avisos = [
    "No cambie los nombres de las hojas ni los encabezados de la primera fila.",
    "Las fechas se escriben día/mes/año, por ejemplo 15/09/2026.",
    "Escriba cada vacuna igual en todas las hojas: en las hojas 3 y 4 elíjala de la lista desplegable.",
    "Las dosis ya aplicadas NO descuentan del inventario: el inventario es lo que hay hoy en la nevera.",
    "Autoriza mensajes: ponga SI solo si el paciente lo autorizó (Ley 1581 de 2012). Quien tenga NO nunca recibe recordatorios.",
    "Si al cargar algo sale con error, el sistema indica la fila exacta del Excel para corregirla. Puede volver a cargar el mismo archivo: lo que ya existe no se duplica.",
  ];
  avisos.forEach((a, i) => {
    const r = 18 + i;
    ws.mergeCells(`B${r}:H${r}`);
    const c = ws.getCell(`B${r}`);
    c.value = `•  ${a}`;
    c.font = { name: "Calibri", size: 11, color: { argb: "FF78350F" } };
    c.fill = sol("FFFEF3C7");
    c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    fila(r, Math.max(24, Math.ceil((a.length + 4) / (ANCHO_TEXTO + 24)) * 19 + 6));
  });
}

function titulo(ws: ExcelJS.Worksheet, r: number, texto: string) {
  ws.mergeCells(`B${r}:H${r}`);
  const c = ws.getCell(`B${r}`);
  c.value = texto;
  c.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FF111827" } };
  c.alignment = { vertical: "middle" };
  ws.getRow(r).height = 32;
}

// ---------------------------------------------------------------------------------------------
// Hojas de datos

const COLUMNAS_FECHA = new Set(["Fecha de nacimiento", "Fecha de aplicación", "Fecha próxima dosis", "Fecha de vencimiento"]);
const COLUMNAS_TEXTO = new Set(["Documento de identidad", "Teléfono", "Número de lote"]);

function hojaDatos(wb: ExcelJS.Workbook, h: Hoja) {
  const ws = wb.addWorksheet(h.nombre, { properties: { tabColor: { argb: `FF${h.color}` } }, views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = h.columnas.map((c) => ({ width: c.ancho }));

  // Encabezados
  const cab = ws.getRow(1);
  cab.height = 34;
  h.columnas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.titulo;
    cell.fill = sol(c.req ? `FF${h.color}` : GRIS);
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: c.req ? "FFFFFFFF" : "FF374151" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { left: borde("FFFFFFFF"), right: borde("FFFFFFFF") };
    cell.note = { texts: [{ font: { name: "Calibri", size: 10, bold: true }, text: `${c.req ? "Obligatoria" : "Opcional"}\n` }, { font: { name: "Calibri", size: 10 }, text: c.nota }], margins: { insetmode: "custom", inset: [0.1, 0.1, 0.1, 0.1] } };
  });

  // Fila de ejemplo
  const ej = ws.getRow(2);
  ej.height = 22;
  h.columnas.forEach((c, i) => {
    const cell = ej.getCell(i + 1);
    cell.value = c.ejemplo;
    cell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF9CA3AF" } };
    cell.fill = sol("FFF3F4F6");
    cell.alignment = { vertical: "middle", horizontal: c.titulo === "Vacuna" ? "left" : undefined };
  });

  // Formato y validaciones de las filas de datos
  h.columnas.forEach((c, i) => {
    for (let r = 3; r <= FILAS_CON_FORMATO + 2; r++) {
      const cell = ws.getCell(r, i + 1);
      if (COLUMNAS_TEXTO.has(c.titulo)) cell.numFmt = "@"; // conserva ceros y evita notación científica
      cell.alignment = { vertical: "middle" };
      if (COLUMNAS_FECHA.has(c.titulo)) {
        cell.numFmt = "dd/mm/yyyy";
        cell.dataValidation = {
          type: "date", operator: "between", allowBlank: true, formulae: [new Date(Date.UTC(1900, 0, 2)), new Date(Date.UTC(2100, 0, 1))],
          showErrorMessage: true, errorStyle: "stop", errorTitle: "Fecha no válida", error: "Escriba una fecha como 15/09/2026 (día/mes/año).",
        };
      } else if (c.titulo === "Autoriza mensajes") {
        cell.dataValidation = {
          type: "list", allowBlank: true, formulae: ['"SI,NO"'], showErrorMessage: true, errorStyle: "stop",
          errorTitle: "Valor no válido", error: "Elija SI o NO, o deje la celda vacía si no se sabe.",
        };
      } else if (c.titulo === "Vacuna" && h.clave !== "vacunas") {
        cell.dataValidation = {
          type: "list", allowBlank: true, formulae: [`'${HOJAS[0].nombre}'!$A$3:$A$500`], showErrorMessage: true, errorStyle: "stop",
          errorTitle: "Vacuna no encontrada", error: "Elija una vacuna de la lista. Si no aparece, primero agréguela en la hoja 1. Vacunas.",
        };
      } else if (["Dosis totales", "Número de dosis"].includes(c.titulo)) {
        cell.dataValidation = {
          type: "whole", operator: "between", allowBlank: true, formulae: [1, 20], showErrorMessage: true, errorStyle: "stop",
          errorTitle: "Número no válido", error: "Escriba un número entero entre 1 y 20.",
        };
      } else if (["Intervalo en días", "Existencias mínimas", "Existencias actuales", "Costo por dosis"].includes(c.titulo)) {
        cell.dataValidation = {
          type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorStyle: "stop",
          errorTitle: "Número no válido", error: "Escriba un número, sin puntos ni símbolos.",
        };
      }
    }
  });
}
