import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Límite de peticiones por IP, con un contador en la base (supabase/rate_limit.sql): funciona igual en cualquier
 * instancia de Vercel y no necesita servicios externos. SOLO servidor.
 */

/** IP del cliente. En Vercel, x-forwarded-for lo fija la plataforma (no se puede falsear desde fuera). */
export function ipDe(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  return ip || "desconocida";
}

/** La IP no se guarda en claro: solo un hash corto. */
const anonimo = (valor: string) => createHash("sha256").update(valor).digest("hex").slice(0, 24);

/**
 * Cuenta una petición y dice si puede seguir. Si el contador falla (por ejemplo, aún no se ejecutó rate_limit.sql),
 * deja pasar y lo registra: un fallo del límite no debe tumbar el formulario.
 */
export async function permitir(db: SupabaseClient, clave: string, ventanaSegundos: number, maximo: number): Promise<boolean> {
  const { data, error } = await db.rpc("rate_limit_hit", { p_key: clave, p_window_s: ventanaSegundos, p_max: maximo });
  if (error) {
    console.error("rate-limit:", error.message);
    return true;
  }
  return data !== false;
}

/** Límites de una ruta, por IP. Devuelve la respuesta 429 lista para retornar, o null si puede seguir. */
export async function limitarPorIp(
  db: SupabaseClient, headers: Headers, ruta: string, ventanaSegundos: number, maximo: number
): Promise<NextResponse | null> {
  const ok = await permitir(db, `${ruta}:${anonimo(ipDe(headers))}`, ventanaSegundos, maximo);
  if (ok) return null;
  return NextResponse.json(
    { error: "Demasiados intentos. Espera un momento antes de volver a intentarlo." },
    { status: 429, headers: { "Retry-After": String(ventanaSegundos) } }
  );
}
