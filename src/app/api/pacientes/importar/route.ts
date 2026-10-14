import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";
import { parseAutoriza } from "@/lib/pacientes";

export const dynamic = "force-dynamic";

type RawRow = Record<string, unknown>;
interface RowError { fila: number; documento?: string; motivo: string }

const ALIASES: Record<string, string[]> = {
  nombre_completo: ["nombre_completo", "nombre", "nombres", "paciente", "name"],
  documento_identidad: ["documento_identidad", "documento", "cedula", "cc", "identificacion", "id"],
  email: ["email", "correo", "correo_electronico", "mail"],
  telefono: ["telefono", "celular", "movil", "phone", "whatsapp"],
  fecha_nacimiento: ["fecha_nacimiento", "nacimiento", "fecha_de_nacimiento", "birthdate"],
  autoriza_mensajes: ["autoriza_mensajes", "autoriza", "autorizacion", "consentimiento", "acepta_mensajes"],
};

const norm = (k: string) =>
  k.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");

function pick(row: RawRow, field: keyof typeof ALIASES): unknown {
  const keys = Object.keys(row);
  for (const alias of ALIASES[field]) {
    const k = keys.find((x) => norm(x) === alias);
    if (k !== undefined && row[k] !== "" && row[k] != null) return row[k];
  }
  return undefined;
}

function toISODate(v: unknown): string | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") { // serial de Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "invalid" : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "invalid";
}

export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  let rows: RawRow[];
  try {
    const body = await request.json();
    rows = Array.isArray(body) ? body : body?.rows;
    if (!Array.isArray(rows)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Se esperaba JSON: { rows: [...] }" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "Archivo sin filas" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "Máximo 5000 filas por importación" }, { status: 413 });

  const cc = process.env.DEFAULT_COUNTRY_CODE ?? "57";
  const errores: RowError[] = [];
  const validos = new Map<string, Record<string, unknown>>();

  rows.forEach((row, i) => {
    const fila = i + 2; // +1 encabezado, +1 base 1
    const nombre = String(pick(row, "nombre_completo") ?? "").trim();
    const doc = String(pick(row, "documento_identidad") ?? "").trim();
    const emailRaw = String(pick(row, "email") ?? "").trim().toLowerCase();
    const telRaw = pick(row, "telefono");
    const fecha = toISODate(pick(row, "fecha_nacimiento"));
    const autoriza = parseAutoriza(pick(row, "autoriza_mensajes"));

    const fail = (motivo: string) => errores.push({ fila, documento: doc || undefined, motivo });

    if (!nombre) return fail("Falta nombre_completo");
    if (!doc) return fail("Falta documento_identidad");
    if (telRaw === undefined) return fail("Falta telefono");
    const telefono = toE164(telRaw, cc);
    if (!telefono) return fail(`Teléfono inválido: ${telRaw}`);
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return fail(`Email inválido: ${emailRaw}`);
    if (fecha === "invalid") return fail("fecha_nacimiento inválida (usa AAAA-MM-DD o DD/MM/AAAA)");
    if (autoriza === "invalid") return fail("autoriza_mensajes inválido (usa si / no)");
    if (validos.has(doc)) return fail("Documento duplicado en el archivo");

    validos.set(doc, {
      nombre_completo: nombre,
      documento_identidad: doc,
      email: emailRaw || null,
      telefono,
      fecha_nacimiento: fecha,
      // Si la columna viene vacía no se toca la autorización que ya tenga el paciente
      ...(autoriza && { autoriza_mensajes: autoriza, autorizacion_medio: "IMPORTACION" }),
    });
  });

  let importados = 0;
  if (validos.size > 0) {
    const db = createAdminClient();
    const todos = Array.from(validos.values());
    const grupos = [todos.filter((r) => "autoriza_mensajes" in r), todos.filter((r) => !("autoriza_mensajes" in r))];
    for (const lote of grupos) for (let i = 0; i < lote.length; i += 500) {
      const chunk = lote.slice(i, i + 500);
      const { error } = await db
        .from("pacientes")
        .upsert(chunk, { onConflict: "documento_identidad" });
      if (error) {
        return NextResponse.json(
          { error: `Error al insertar: ${error.message}`, importados, errores },
          { status: 500 }
        );
      }
      importados += chunk.length;
    }
  }

  return NextResponse.json({ total: rows.length, importados, errores });
}
