import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { esColor } from "@/lib/establecimiento";

export const dynamic = "force-dynamic";

const TEXTOS = ["nit", "telefono", "email", "direccion", "ciudad", "sitio_web", "horario", "logo_url"] as const;

function parse(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "Datos inválidos" };
  const b = body as Record<string, unknown>;

  const nombre = String(b.nombre ?? "").trim();
  if (!nombre) return { ok: false as const, error: "El nombre del establecimiento es obligatorio" };
  if (nombre.length > 120) return { ok: false as const, error: "El nombre es demasiado largo" };

  const data: Record<string, unknown> = { nombre, updated_at: new Date().toISOString() };
  for (const k of TEXTOS) {
    const v = String(b[k] ?? "").trim();
    if (v.length > 300) return { ok: false as const, error: `El campo ${k} es demasiado largo` };
    data[k] = v || null;
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email as string)) {
    return { ok: false as const, error: "El email no es válido" };
  }

  if (!esColor(b.color)) return { ok: false as const, error: "Color de marca inválido" };
  data.color = b.color;

  const dias = Array.isArray(b.dias_atencion) ? [...new Set(b.dias_atencion.map(Number))] : [];
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false as const, error: "Selecciona al menos un día de atención" };
  }
  data.dias_atencion = dias.sort();

  const cupos = Number(b.cupos_por_dia ?? 0);
  if (!Number.isInteger(cupos) || cupos < 0 || cupos > 10000) {
    return { ok: false as const, error: "Los cupos por día deben ser un número entero (0 = sin límite)" };
  }
  data.cupos_por_dia = cupos;

  return { ok: true as const, data };
}

export async function PUT(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const parsed = parse(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await (await createClient())
    .from("establecimiento").update(parsed.data).eq("id", true).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "No se encontró el establecimiento. Ejecuta supabase/establecimiento.sql en Supabase." },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
