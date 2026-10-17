import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIGITOS, EMAIL_RE, MAX_INTENTOS, VENCE_TOKEN_MIN, generarToken, hashSecreto, minutosDesdeAhora, mismoHash } from "@/lib/recuperacion";

export const dynamic = "force-dynamic";

const INVALIDO = "El código no es correcto o ya venció.";

/** Paso 2: confirma el código. Si es correcto devuelve un token de un solo uso para cambiar la contraseña. */
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const codigo = String(b?.codigo ?? "").trim();
  if (!EMAIL_RE.test(email) || !new RegExp(`^\\d{${DIGITOS}}$`).test(codigo)) {
    return NextResponse.json({ error: INVALIDO }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: fila } = await admin.from("codigos_recuperacion").select("*").eq("email", email).maybeSingle();
  if (!fila?.codigo_hash || new Date(fila.vence) < new Date()) return NextResponse.json({ error: INVALIDO }, { status: 400 });
  // El intento se cuenta ANTES de comparar y de forma atómica en la base: aunque lleguen cientos de
  // peticiones en paralelo, solo MAX_INTENTOS llegan a comparar el código.
  const { data: intentos } = await admin.rpc("recuperacion_contar_intento", { p_email: email });
  if (typeof intentos !== "number" || intentos > MAX_INTENTOS) {
    return NextResponse.json({ error: "Superaste los intentos permitidos. Pide un código nuevo." }, { status: 429 });
  }

  if (!mismoHash(fila.codigo_hash, hashSecreto(email, codigo))) {
    // Con el último intento fallido el código muere: ya no sirve ni el correcto.
    if (intentos >= MAX_INTENTOS) await admin.from("codigos_recuperacion").update({ codigo_hash: null }).eq("email", email);
    const quedan = MAX_INTENTOS - intentos;
    return NextResponse.json({
      error: quedan > 0
        ? `El código no es correcto. Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`}.`
        : "Superaste los intentos permitidos. Pide un código nuevo.",
    }, { status: 400 });
  }

  // Código correcto: se invalida y se cambia por un token para el paso 3
  const token = generarToken();
  await admin.from("codigos_recuperacion")
    .update({ codigo_hash: null, token_hash: hashSecreto(email, token), token_vence: minutosDesdeAhora(VENCE_TOKEN_MIN) })
    .eq("email", email);
  return NextResponse.json({ token });
}
