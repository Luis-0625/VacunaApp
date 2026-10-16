import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRecuperacionEmail } from "@/lib/notifications/email";
import { urlApp } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Envía por Resend el enlace para restablecer la contraseña. Supabase solo genera el token (no envía el
 * correo: su SMTP gratuito tiene un límite muy bajo). Siempre responde ok para no revelar qué correos
 * tienen cuenta.
 */
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (!error && data.properties?.hashed_token) {
      const { data: perfil } = await admin.from("perfiles").select("nombre").eq("email", email).maybeSingle();
      const url = `${urlApp()}/restablecer?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
      await sendRecuperacionEmail({ to: email, nombre: perfil?.nombre ?? null, url });
    }
  } catch (e) {
    console.error("auth/recuperar", e);
  }
  return NextResponse.json({ ok: true });
}
