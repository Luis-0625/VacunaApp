import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRecuperacionEmail } from "@/lib/notifications/email";
import { EMAIL_RE, ESPERA_REENVIO_S, VENCE_CODIGO_MIN, generarCodigo, hashSecreto, minutosDesdeAhora } from "@/lib/recuperacion";

export const dynamic = "force-dynamic";

/**
 * Paso 1: envía por Resend un código de 5 dígitos para restablecer la contraseña. Siempre responde ok
 * para no revelar qué correos tienen cuenta. Ver /verificar y /cambiar.
 */
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: userId } = await admin.rpc("usuario_id_por_email", { p_email: email });
    if (userId) {
      // Un código por minuto como máximo, para que no se use la app para llenar de correos a alguien
      const { data: previo } = await admin.from("codigos_recuperacion").select("created_at").eq("email", email).maybeSingle();
      const reciente = previo && Date.now() - new Date(previo.created_at).getTime() < ESPERA_REENVIO_S * 1000;
      if (!reciente) {
        const codigo = generarCodigo();
        const { error } = await admin.from("codigos_recuperacion").upsert({
          email, codigo_hash: hashSecreto(email, codigo), vence: minutosDesdeAhora(VENCE_CODIGO_MIN), intentos: 0,
          token_hash: null, token_vence: null, created_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        const { data: perfil } = await admin.from("perfiles").select("nombre").eq("email", email).maybeSingle();
        await sendRecuperacionEmail({ to: email, nombre: perfil?.nombre ?? null, codigo });
      }
    }
  } catch (e) {
    console.error("auth/recuperar", e);
  }
  return NextResponse.json({ ok: true });
}
