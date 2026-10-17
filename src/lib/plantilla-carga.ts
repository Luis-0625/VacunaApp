import * as XLSX from "xlsx";

/** Hojas de la plantilla de carga inicial, en el orden en que se cargan. */
export const HOJAS = [
  {
    clave: "vacunas", nombre: "Vacunas", ruta: "/api/importar",
    columnas: ["nombre", "dosis_totales", "intervalo_dias", "descripcion", "stock_minimo"],
    aliases: ["vacunas"],
  },
  {
    clave: "pacientes", nombre: "Pacientes", ruta: "/api/pacientes/importar",
    columnas: ["nombre_completo", "documento_identidad", "telefono", "email", "fecha_nacimiento", "autoriza_mensajes"],
    aliases: ["pacientes"],
  },
  {
    clave: "dosis", nombre: "Dosis aplicadas", ruta: "/api/importar",
    columnas: ["documento_identidad", "vacuna", "numero_dosis", "fecha_aplicacion", "fecha_proxima_dosis"],
    aliases: ["dosis_aplicadas", "dosis", "vacunacion", "historial"],
  },
  {
    clave: "lotes", nombre: "Inventario actual", ruta: "/api/importar",
    columnas: ["vacuna", "numero_lote", "laboratorio", "fecha_vencimiento", "existencias", "costo_unitario"],
    aliases: ["inventario_actual", "inventario", "lotes"],
  },
] as const;

export type ClaveHoja = (typeof HOJAS)[number]["clave"];

const INSTRUCCIONES: string[][] = [
  ["PLANTILLA DE CARGA INICIAL · VacunaApp"],
  [""],
  ["Llene las hojas en este orden. No cambie los nombres de las hojas ni los encabezados (primera fila). Puede dejar vacía una hoja que no necesite."],
  [""],
  ["1. Vacunas: el catálogo del centro."],
  ["   nombre (obligatorio) · dosis_totales: dosis del esquema (1 si es dosis única) · intervalo_dias: días entre una dosis y la siguiente (obligatorio si tiene más de una dosis)"],
  ["   descripcion (opcional) · stock_minimo: avisar cuando queden menos de estas dosis (0 = sin alerta)"],
  [""],
  ["2. Pacientes: las personas vacunadas en el periodo que se quiere cargar (por ejemplo, el último mes o los últimos dos meses)."],
  ["   nombre_completo, documento_identidad y telefono son obligatorios. El teléfono puede ir con o sin +57. email y fecha_nacimiento son opcionales."],
  ["   autoriza_mensajes: escriba SI solo si el paciente autorizó recibir mensajes (Ley 1581 de 2012); NO si no lo autorizó; déjelo vacío si no se sabe."],
  ["   Quien tenga NO nunca recibe recordatorios."],
  [""],
  ["3. Dosis aplicadas: una fila por cada dosis que ya se aplicó."],
  ["   documento_identidad (el mismo de la hoja Pacientes) · vacuna (el mismo nombre de la hoja Vacunas) · fecha_aplicacion (AAAA-MM-DD o DD/MM/AAAA)"],
  ["   numero_dosis (opcional): si lo deja vacío se asigna 1, 2, 3… según la fecha de aplicación."],
  ["   fecha_proxima_dosis (opcional): si la deja vacía se calcula con el intervalo de la vacuna. La última dosis del esquema no lleva próxima."],
  ["   Con esta información el sistema programa los recordatorios de las dosis que vienen y muestra como atrasados a quienes ya debieron volver."],
  ["   Estas dosis NO descuentan del inventario."],
  [""],
  ["4. Inventario actual: las dosis que hay HOY en la nevera, por lote. Se llena junto con el administrador del centro, contando físicamente."],
  ["   vacuna · numero_lote · fecha_vencimiento · existencias (dosis disponibles hoy, no las recibidas) · laboratorio y costo_unitario son opcionales."],
  [""],
  ["Si el archivo se carga dos veces no se duplica nada: lo que ya existe se omite. Las filas con errores se muestran con su número de fila para corregirlas y volver a cargar."],
];

/** Descarga la plantilla en blanco (instrucciones + una hoja por tipo de dato, solo con encabezados). */
export function descargarPlantilla() {
  const wb = XLSX.utils.book_new();
  const instr = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
  instr["!cols"] = [{ wch: 150 }];
  XLSX.utils.book_append_sheet(wb, instr, "Instrucciones");
  for (const h of HOJAS) {
    const ws = XLSX.utils.aoa_to_sheet([[...h.columnas]]);
    ws["!cols"] = h.columnas.map((c) => ({ wch: Math.max(c.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, h.nombre);
  }
  XLSX.writeFile(wb, "plantilla-carga-inicial-vacunaapp.xlsx");
}

const normHoja = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");

/** Lee el libro y devuelve las filas de cada hoja reconocida (las vacías se omiten). */
export function leerLibro(data: ArrayBuffer): Partial<Record<ClaveHoja, Record<string, unknown>[]>> {
  // Sin cellDates: las fechas llegan como número de serie de Excel, que el servidor convierte sin desfases de zona horaria
  const wb = XLSX.read(data, { type: "array" });
  const salida: Partial<Record<ClaveHoja, Record<string, unknown>[]>> = {};
  for (const nombre of wb.SheetNames) {
    const hoja = HOJAS.find((h) => (h.aliases as readonly string[]).includes(normHoja(nombre)));
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nombre], { defval: "", raw: true })
      .filter((f) => Object.values(f).some((v) => v !== "" && v != null));
    if (filas.length) salida[hoja.clave] = filas;
  }
  return salida;
}
