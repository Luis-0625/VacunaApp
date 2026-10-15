import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSolicitudPruebaEmail, type SolicitudPrueba } from "@/lib/notifications/email";
import { enviarWhatsApp } from "@/lib/notifications/whatsapp";
import { EMPRESA } from "@/lib/empresa";

export const dynamic = "force-dynamic";

const PLANES = ["Básico", "Pro", "Enterprise", "Aún no sé"];

function parse(body: unknown): { ok: true; data: SolicitudPrueba } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Datos inválidos" };
  const b = body as Record<string, unknown>;
  const txt = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max);

  const data: SolicitudPrueba = {
    tipo: b.tipo === "demostracion" ? "demostracion" : "prueba",
    nombre: txt("nombre", 120),
    centro: txt("centro", 160),
    ciudad: txt("ciudad", 80),
    telefono: txt("telefono", 30),
    email: txt("email", 160),
    plan: PLANES.includes(String(b.plan)) ? String(b.plan) : "Aún no sé",
    mensaje: txt("mensaje", 1000),
  };
  if (!data.nombre || !data.centro || !data.ciudad) return { ok: false, error: "Completa tu nombre, el centro y la ciudad" };
  if (data.telefono.replace(/\D/g, "").length < 7) return { ok: false, error: "Escribe un teléfono válido" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: false, error: "Escribe un correo válido" };
  return { ok: true, data };
}

/** Formulario público de la landing: avisa al dueño de la plataforma por correo y por WhatsApp. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  // Campo trampa: los humanos no lo ven; si viene lleno es un bot. Se responde ok sin enviar nada.
  if (body && typeof body === "object" && (body as Record<string, unknown>).sitio) {
    return NextResponse.json({ ok: true });
  }

  const parsed = parse(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Se avisa por correo a los superadmins y por WhatsApp al número de ventas; basta con que llegue uno.
  const envios = await Promise.allSettled([
    avisarPorCorreo(parsed.data),
    EMPRESA.whatsapp
      ? enviarWhatsApp({ to: `+${EMPRESA.whatsapp}`, body: textoWhatsApp(parsed.data) })
      : Promise.reject(new Error("Sin número de WhatsApp de ventas")),
  ]);
  envios.forEach((r, i) => {
    if (r.status === "rejected") console.error(`solicitud-prueba (${i === 0 ? "correo" : "whatsapp"})`, r.reason);
  });
  if (envios.every((r) => r.status === "rejected")) {
    return NextResponse.json({ error: "No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function avisarPorCorreo(s: SolicitudPrueba) {
  const db = createAdminClient();
  const { data: admins, error } = await db.from("plataforma_admins").select("user_id");
  if (error) throw error;
  const correos = (
    await Promise.all((admins ?? []).map(async (a) => (await db.auth.admin.getUserById(a.user_id)).data.user?.email))
  ).filter((e): e is string => !!e);
  if (!correos.length) throw new Error("No hay superadmins con correo");
  await sendSolicitudPruebaEmail(correos, s);
}

function textoWhatsApp(s: SolicitudPrueba) {
  const tel = s.telefono.replace(/\D/g, "");
  return [
    `🚀 *${s.tipo === "prueba" ? "Nueva solicitud de prueba gratis" : "Nueva solicitud de demostración"}*`,
    "",
    `*Nombre:* ${s.nombre}`,
    `*Centro / IPS:* ${s.centro}`,
    `*Ciudad:* ${s.ciudad}`,
    `*Teléfono:* ${s.telefono} → https://wa.me/${tel.length === 10 ? `57${tel}` : tel}`,
    `*Correo:* ${s.email}`,
    `*Plan:* ${s.plan}`,
    ...(s.mensaje ? ["", `*Mensaje:* ${s.mensaje}`] : []),
  ].join("\n");
}
