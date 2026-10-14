import { NextResponse, type NextRequest } from "next/server";
import { requireSuperadminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Catálogo inicial de cada centro nuevo (lo puede editar luego en Vacunas). */
const VACUNAS_INICIALES = [
  { nombre: "Hepatitis B", dosis_totales: 3, intervalo_dias_recom_dosis: 30, descripcion: "Esquema 0-1-6 meses" },
  { nombre: "Influenza", dosis_totales: 1, intervalo_dias_recom_dosis: null, descripcion: "Dosis anual" },
  { nombre: "COVID-19", dosis_totales: 2, intervalo_dias_recom_dosis: 28, descripcion: "Esquema primario de dos dosis" },
  { nombre: "Tétanos / Difteria (Td)", dosis_totales: 3, intervalo_dias_recom_dosis: 30, descripcion: "Refuerzo cada 10 años" },
];

/** Crea un centro con su catálogo de vacunas y su primer ADMIN. Solo superadministradores. */
export async function POST(request: NextRequest) {
  const denegado = await requireSuperadminApi();
  if (denegado) return denegado;

  const b = await request.json().catch(() => null);
  const nombre = String(b?.nombre ?? "").trim();
  const ciudad = String(b?.ciudad ?? "").trim();
  const adminNombre = String(b?.admin_nombre ?? "").trim();
  const email = String(b?.admin_email ?? "").trim().toLowerCase();
  const password = String(b?.admin_password ?? "");

  if (!nombre || nombre.length > 120) return NextResponse.json({ error: "Escribe el nombre del centro" }, { status: 400 });
  if (!adminNombre) return NextResponse.json({ error: "Escribe el nombre del administrador" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email del administrador inválido" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

  const db = createAdminClient();
  const { data: centro, error: e1 } = await db.from("centros")
    .insert({ nombre, ciudad: ciudad || null }).select("id").single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // Si algo falla después, se borra el centro (en cascada, también sus vacunas)
  const deshacer = async (msg: string, status = 500) => {
    await db.from("centros").delete().eq("id", centro.id);
    return NextResponse.json({ error: msg }, { status });
  };

  const { error: e2 } = await db.from("vacunas").insert(VACUNAS_INICIALES.map((v) => ({ ...v, centro_id: centro.id })));
  if (e2) return deshacer(e2.message);

  const { data: creado, error: e3 } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nombre: adminNombre },
  });
  if (e3 || !creado.user) return deshacer(e3?.message ?? "No se pudo crear el administrador", 400);

  const { error: e4 } = await db.from("perfiles")
    .insert({ user_id: creado.user.id, email, nombre: adminNombre, rol: "ADMIN", centro_id: centro.id });
  if (e4) {
    await db.auth.admin.deleteUser(creado.user.id);
    return deshacer(e4.message);
  }

  return NextResponse.json({ id: centro.id }, { status: 201 });
}
