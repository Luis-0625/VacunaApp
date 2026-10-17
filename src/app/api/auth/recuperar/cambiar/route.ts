import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitarPorIp } from "@/lib/rate-limit";
import { EMAIL_RE, hashSecreto, mismoHash } from "@/lib/recuperacion";

export const dynamic = "force-dynamic";

/** Paso 3: con el token del código confirmado, guarda la contraseña nueva. El cliente luego inicia sesión. */
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const token = String(b?.token ?? "");
  const password = String(b?.password ?? "");
  if (!EMAIL_RE.test(email) || !token) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

  const admin = createAdminClient();
  const limitada = await limitarPorIp(admin, request.headers, "recuperar-cambiar", 3600, 20);
  if (limitada) return limitada;
  const { data: fila } = await admin.from("codigos_recuperacion").select("token_hash, token_vence").eq("email", email).maybeSingle();
  if (!fila?.token_vence || new Date(fila.token_vence) < new Date() || !mismoHash(fila.token_hash, hashSecreto(email, token))) {
    return NextResponse.json({ error: "La verificación venció. Pide un código nuevo.", vencido: true }, { status: 400 });
  }

  const { data: userId } = await admin.rpc("usuario_id_por_email", { p_email: email });
  if (!userId) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("codigos_recuperacion").delete().eq("email", email); // token de un solo uso
  // Cierra las sesiones abiertas: quien tuviera acceso con la contraseña vieja lo pierde.
  const { error: sErr } = await admin.rpc("cerrar_sesiones_usuario", { p_user_id: userId });
  if (sErr) console.error("auth/recuperar/cambiar: no se cerraron las sesiones", sErr.message);
  return NextResponse.json({ ok: true });
}
