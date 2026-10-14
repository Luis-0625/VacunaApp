import type { SupabaseClient } from "@supabase/supabase-js";

/** Datos y marca de un centro de vacunación (tabla `centros`). */
export interface Establecimiento {
  /** null = marca genérica de la plataforma (sin sesión o sin centro). */
  id: string | null;
  nombre: string;
  nit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  sitio_web: string | null;
  horario: string | null;
  logo_url: string | null;
  color: ColorMarca;
  dias_atencion: number[];
  cupos_por_dia: number;
  /** Número propio de WhatsApp del centro (whatsapp:+57...); null = el de la plataforma. */
  whatsapp_from: string | null;
  activo: boolean;
}

/** Marca de la plataforma: login y páginas sin un centro identificado. */
export const ESTABLECIMIENTO_DEFAULT: Establecimiento = {
  id: null,
  nombre: "VacunaApp",
  nit: null, telefono: null, email: null, direccion: null, ciudad: null, sitio_web: null, horario: null,
  logo_url: null,
  color: "azul",
  dias_atencion: [1, 2, 3, 4, 5, 6],
  cupos_por_dia: 0,
  whatsapp_from: null,
  activo: true,
};

/**
 * Datos de un centro. Sin `centroId` usa las reglas de seguridad: con un cliente de sesión devuelve el
 * centro del usuario. Con el cliente de service role siempre hay que indicar `centroId`.
 */
export async function getEstablecimiento(db: SupabaseClient, centroId?: string): Promise<Establecimiento> {
  let q = db.from("centros").select("*");
  if (centroId) q = q.eq("id", centroId);
  const { data } = await q.limit(1).maybeSingle();
  return data ? aEstablecimiento(data) : ESTABLECIMIENTO_DEFAULT;
}

/** Convierte una fila de `centros` en Establecimiento (con valores por defecto y color válido). */
export function aEstablecimiento(fila: Record<string, unknown>): Establecimiento {
  const e = { ...ESTABLECIMIENTO_DEFAULT, ...fila } as Establecimiento;
  return { ...e, color: esColor(e.color) ? e.color : "azul" };
}

/** Pie de mensaje: "📍 Calle 10 #5-20, Montería · 🕒 Lun a sáb 7am-5pm · ☎ 3001234567". */
export function datosContacto(e: Establecimiento): string {
  return [
    e.direccion && `📍 ${[e.direccion, e.ciudad].filter(Boolean).join(", ")}`,
    e.horario && `🕒 ${e.horario}`,
    e.telefono && `☎ ${e.telefono}`,
  ].filter(Boolean).join("\n");
}

export const DIAS_SEMANA = [
  { n: 1, corto: "Lun" }, { n: 2, corto: "Mar" }, { n: 3, corto: "Mié" }, { n: 4, corto: "Jue" },
  { n: 5, corto: "Vie" }, { n: 6, corto: "Sáb" }, { n: 0, corto: "Dom" },
];

// Paletas de marca (RGB de la escala 50…950).
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const PALETAS = {
  azul: { label: "Azul clínico", rgb: ["239 246 255", "219 234 254", "191 219 254", "147 197 253", "96 165 250", "59 130 246", "37 99 235", "29 78 216", "30 64 175", "30 58 138", "23 37 84"] },
  celeste: { label: "Celeste", rgb: ["236 254 255", "207 250 254", "165 243 252", "103 232 249", "34 211 238", "6 182 212", "8 145 178", "14 116 144", "21 94 117", "22 78 99", "8 51 68"] },
  teal: { label: "Verde azulado", rgb: ["240 253 250", "204 251 241", "153 246 228", "94 234 212", "45 212 191", "20 184 166", "13 148 136", "15 118 110", "17 94 89", "19 78 74", "4 47 46"] },
  esmeralda: { label: "Esmeralda", rgb: ["236 253 245", "209 250 229", "167 243 208", "110 231 183", "52 211 153", "16 185 129", "5 150 105", "4 120 87", "6 95 70", "6 78 59", "2 44 34"] },
  indigo: { label: "Índigo", rgb: ["238 242 255", "224 231 255", "199 210 254", "165 180 252", "129 140 248", "99 102 241", "79 70 229", "67 56 202", "55 48 163", "49 46 129", "30 27 75"] },
  violeta: { label: "Violeta", rgb: ["245 243 255", "237 233 254", "221 214 254", "196 181 253", "167 139 250", "139 92 246", "124 58 237", "109 40 217", "91 33 182", "76 29 149", "46 16 101"] },
  rosa: { label: "Rosa", rgb: ["255 241 242", "255 228 230", "254 205 211", "253 164 175", "251 113 133", "244 63 94", "225 29 72", "190 18 60", "159 18 57", "136 19 55", "76 5 25"] },
  pizarra: { label: "Pizarra", rgb: ["248 250 252", "241 245 249", "226 232 240", "203 213 225", "148 163 184", "100 116 139", "71 85 105", "51 65 85", "30 41 59", "15 23 42", "2 6 23"] },
} as const;

export type ColorMarca = keyof typeof PALETAS;

export const COLORES_MARCA = (Object.keys(PALETAS) as ColorMarca[]).map((id) => ({
  id,
  label: PALETAS[id].label,
  muestra: `rgb(${PALETAS[id].rgb[6]})`,
}));

export const esColor = (c: unknown): c is ColorMarca => typeof c === "string" && c in PALETAS;

/** Variables CSS base (--b-50 … --b-950) para el atributo style; globals.css las mapea a --brand-* según el tema. */
export function temaMarca(color: ColorMarca): Record<string, string> {
  const rgb = PALETAS[color].rgb;
  return Object.fromEntries(SHADES.map((s, i) => [`--b-${s}`, rgb[i]]));
}
