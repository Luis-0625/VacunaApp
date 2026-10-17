import * as XLSX from "xlsx";

/**
 * Definición de las hojas de la plantilla de carga inicial. La usan el generador del Excel (servidor,
 * plantilla-excel.ts) y el lector (navegador, leerLibro): los encabezados deben coincidir con los alias
 * de lib/importacion.ts, que ignora mayúsculas, tildes y espacios.
 */
export interface Columna {
  titulo: string;
  /** Obligatoria: encabezado en el color fuerte de la hoja. Opcional: en su tono claro. */
  req: boolean;
  /** Nota que aparece al pasar el mouse sobre el encabezado. */
  nota: string;
  /** Valor de la fila de ejemplo. */
  ejemplo: string;
  ancho: number;
}

export const PREFIJO_EJEMPLO = "Ej:";

export const HOJAS = [
  {
    clave: "vacunas", nombre: "1. Vacunas", ruta: "/api/importar", color: "3B6EA5", tinte: "E6EEF6",
    aliases: ["vacunas", "1_vacunas"],
    columnas: [
      { titulo: "Vacuna", req: true, ancho: 30, ejemplo: `${PREFIJO_EJEMPLO} Hepatitis B`, nota: "Nombre de la vacuna, como lo usa el centro. Escríbalo igual en las demás hojas." },
      { titulo: "Dosis totales", req: true, ancho: 16, ejemplo: "3", nota: "Cuántas dosis tiene el esquema completo. Escriba 1 si es dosis única (por ejemplo, influenza)." },
      { titulo: "Intervalo en días", req: false, ancho: 18, ejemplo: "30", nota: "Días entre una dosis y la siguiente. Obligatorio si la vacuna tiene más de una dosis. Con esto se calculan las próximas citas." },
      { titulo: "Descripción", req: false, ancho: 34, ejemplo: "Esquema 0-1-6 meses", nota: "Opcional. Una nota para el equipo." },
      { titulo: "Existencias mínimas", req: false, ancho: 20, ejemplo: "10", nota: "Opcional. El sistema avisa cuando queden menos dosis que este número. Deje vacío o 0 si no quiere alerta." },
    ],
  },
  {
    clave: "pacientes", nombre: "2. Pacientes", ruta: "/api/pacientes/importar", color: "2F7F76", tinte: "E2F1EE",
    aliases: ["pacientes", "2_pacientes"],
    columnas: [
      { titulo: "Nombre completo", req: true, ancho: 30, ejemplo: `${PREFIJO_EJEMPLO} María Pérez Gómez`, nota: "Nombres y apellidos del paciente." },
      { titulo: "Documento de identidad", req: true, ancho: 24, ejemplo: "1023456789", nota: "Solo números, sin puntos. Es lo que identifica al paciente: no puede repetirse." },
      { titulo: "Teléfono", req: true, ancho: 18, ejemplo: "3001234567", nota: "Celular con WhatsApp. Sirve con o sin +57." },
      { titulo: "Correo electrónico", req: false, ancho: 28, ejemplo: "maria@correo.com", nota: "Opcional. Para enviar recordatorios por correo." },
      { titulo: "Fecha de nacimiento", req: false, ancho: 22, ejemplo: "15/03/1990", nota: "Opcional. Día/mes/año, por ejemplo 15/03/1990." },
      { titulo: "Autoriza mensajes", req: false, ancho: 20, ejemplo: "SI", nota: "SI solo si el paciente autorizó recibir mensajes (Ley 1581 de 2012). NO si no lo autorizó: nunca recibirá recordatorios. Vacío = sin registrar." },
    ],
  },
  {
    clave: "dosis", nombre: "3. Dosis aplicadas", ruta: "/api/importar", color: "6B5B9E", tinte: "ECE9F5",
    aliases: ["dosis_aplicadas", "3_dosis_aplicadas", "dosis", "vacunacion", "historial"],
    columnas: [
      { titulo: "Documento de identidad", req: true, ancho: 24, ejemplo: `${PREFIJO_EJEMPLO} 1023456789`, nota: "El mismo documento que puso en la hoja Pacientes." },
      { titulo: "Vacuna", req: true, ancho: 28, ejemplo: "Hepatitis B", nota: "Elija de la lista: son las vacunas de la hoja 1." },
      { titulo: "Fecha de aplicación", req: true, ancho: 22, ejemplo: "15/09/2026", nota: "Día en que se aplicó la dosis. Día/mes/año. No puede ser una fecha futura." },
      { titulo: "Número de dosis", req: false, ancho: 18, ejemplo: "1", nota: "Opcional. Si lo deja vacío, el sistema numera 1, 2, 3… según la fecha de aplicación." },
      { titulo: "Fecha próxima dosis", req: false, ancho: 22, ejemplo: "15/10/2026", nota: "Opcional. Si la deja vacía se calcula con el intervalo de la vacuna. La última dosis del esquema no lleva próxima." },
    ],
  },
  {
    clave: "lotes", nombre: "4. Inventario actual", ruta: "/api/importar", color: "A0691C", tinte: "F8EEDB",
    aliases: ["inventario_actual", "4_inventario_actual", "inventario", "lotes"],
    columnas: [
      { titulo: "Vacuna", req: true, ancho: 28, ejemplo: `${PREFIJO_EJEMPLO} Hepatitis B`, nota: "Elija de la lista: son las vacunas de la hoja 1." },
      { titulo: "Número de lote", req: true, ancho: 20, ejemplo: "HB2026-041", nota: "Como aparece en el frasco o la caja." },
      { titulo: "Fecha de vencimiento", req: true, ancho: 22, ejemplo: "30/06/2027", nota: "Día/mes/año." },
      { titulo: "Existencias actuales", req: true, ancho: 22, ejemplo: "42", nota: "Dosis que hay HOY en la nevera de este lote (contadas), no las que llegaron en total." },
      { titulo: "Laboratorio", req: false, ancho: 22, ejemplo: "Sinovac", nota: "Opcional." },
      { titulo: "Costo por dosis", req: false, ancho: 18, ejemplo: "18500", nota: "Opcional. En pesos, sin puntos ni símbolos." },
    ],
  },
] as const;

export type ClaveHoja = (typeof HOJAS)[number]["clave"];

const normHoja = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-.]+/g, "_");

/**
 * Lee el libro y devuelve las filas de cada hoja reconocida. Se saltan las filas vacías y la de ejemplo; cada
 * fila conserva su número real de la hoja en `__fila` para que los errores apunten a la fila correcta del Excel.
 */
export function leerLibro(data: ArrayBuffer): Partial<Record<ClaveHoja, Record<string, unknown>[]>> {
  // Sin cellDates: las fechas llegan como número de serie de Excel, que el servidor convierte sin desfases de zona horaria
  const wb = XLSX.read(data, { type: "array" });
  const salida: Partial<Record<ClaveHoja, Record<string, unknown>[]>> = {};
  for (const nombre of wb.SheetNames) {
    const hoja = HOJAS.find((h) => (h.aliases as readonly string[]).includes(normHoja(nombre)));
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nombre], { defval: "", raw: true, blankrows: true })
      .map((f, i): Record<string, unknown> => ({ ...f, __fila: i + 2 }))
      .filter((f) => {
        const valores = Object.entries(f).filter(([k, v]) => k !== "__fila" && v !== "" && v != null).map(([, v]) => v);
        if (valores.length === 0) return false;
        return !String(valores[0]).trim().toLowerCase().startsWith(PREFIJO_EJEMPLO.toLowerCase());
      });
    if (filas.length) salida[hoja.clave] = filas;
  }
  return salida;
}
