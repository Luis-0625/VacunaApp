import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitarPorIp } from "@/lib/rate-limit";
import { sendRecuperacionEmail } from "@/lib/notifications/email";
import {
  EMAIL_RE, ESPERA_REENVIO_S, MAX_ENVIOS_HORA, VENCE_CODIGO_MIN, generarCodigo, hashSecreto, minutosDesdeAhora,
} from "@/lib/recuperacion";

export const dynamic = "force-dynamic";

/**
 * Paso 1: envía por Resend un código de 6 dígitos para restablecer la contraseña. Responde siempre ok y
 * enseguida: todo el trabajo (buscar la cuenta, guardar el código, enviar el correo) va después de la
 * respuesta, así ni el contenido ni el tiempo revelan qué correos tienen cuenta. Ver /verificar y /cambiar.
 */
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  const admin = createAdminClient();
  const limitada = await limitarPorIp(admin, request.headers, "recuperar", 3600, 10);
  if (limitada) return limitada;

  after(async () => {
    try {
      const { data: userId } = await admin.rpc("usuario_id_por_email", { p_email: email });
      if (!userId) return;
      // Atómico: máximo un código por minuto y MAX_ENVIOS_HORA por hora, para no llenar de correos a alguien
      // ni dar margen a adivinar el código pidiendo códigos nuevos.
      const { data: permitido } = await admin.rpc("recuperacion_reservar_envio", {
        p_email: email, p_espera_s: ESPERA_REENVIO_S, p_max_hora: MAX_ENVIOS_HORA,
      });
      if (!permitido) return;
      const codigo = generarCodigo();
      const { error } = await admin.from("codigos_recuperacion").update({
        codigo_hash: hashSecreto(email, codigo), vence: minutosDesdeAhora(VENCE_CODIGO_MIN), intentos: 0,
        token_hash: null, token_vence: null,
      }).eq("email", email);
      if (error) throw new Error(error.message);
      const { data: perfil } = await admin.from("perfiles").select("nombre").eq("email", email).maybeSingle();
      await sendRecuperacionEmail({ to: email, nombre: perfil?.nombre ?? null, codigo });
    } catch (e) {
      console.error("auth/recuperar", e);
    }
  });
  return NextResponse.json({ ok: true });
}
