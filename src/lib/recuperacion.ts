import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

/** Recuperación de contraseña con código propio de 6 dígitos. SOLO servidor. */
export const DIGITOS = 6;
export const VENCE_CODIGO_MIN = 15;
export const MAX_INTENTOS = 5;
export const VENCE_TOKEN_MIN = 10; // tiempo para escribir la contraseña nueva tras confirmar el código
export const ESPERA_REENVIO_S = 60;
export const MAX_ENVIOS_HORA = 5; // códigos por correo y hora: limita también los intentos totales de adivinación

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function generarCodigo(): string {
  return String(randomInt(0, 10 ** DIGITOS)).padStart(DIGITOS, "0");
}

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** HMAC con la llave de servicio: sin ella, un hash filtrado no permite probar los 100.000 códigos. */
export function hashSecreto(email: string, valor: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`${email}:${valor}`).digest("hex");
}

export function mismoHash(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function minutosDesdeAhora(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}
