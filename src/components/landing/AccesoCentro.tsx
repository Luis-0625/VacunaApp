"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Correo del usuario con sesión abierta, o null. Lee la sesión guardada en el navegador (sin consultar a
 * Supabase), así la landing sigue siendo estática; /dashboard vuelve a validar la sesión en el servidor.
 */
export function useSesion() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return email;
}

/** Botón del encabezado: "Iniciar sesión" o, si ya hay sesión, "Ir a mi panel". En celular solo el ícono. */
export function BotonAcceso() {
  const email = useSesion();
  const Icono = email ? LayoutDashboard : LogIn;
  const texto = email ? "Ir a mi panel" : "Iniciar sesión";
  return (
    <Link href={email ? "/dashboard" : "/login"} aria-label={texto} title={email ?? undefined}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 sm:px-3.5">
      <Icono className="h-4 w-4" />
      <span className="hidden sm:inline">{texto}</span>
    </Link>
  );
}

/** Tarjeta de acceso para el menú móvil. */
export function TarjetaAcceso({ alElegir }: { alElegir: () => void }) {
  const email = useSesion();
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
          {email ? <LayoutDashboard className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{email ? "Tienes una sesión abierta" : "¿Ya eres cliente?"}</p>
          {/* Solo el correo se recorta; el texto de invitación puede ocupar dos líneas */}
          <p className={`text-sm text-slate-600 ${email ? "truncate" : ""}`}>
            {email ?? "Ingresa al panel de tu centro de vacunación."}
          </p>
        </div>
      </div>
      <Link href={email ? "/dashboard" : "/login"} onClick={alElegir} className="btn-primary mt-4 w-full justify-center">
        {email ? "Ir a mi panel" : "Iniciar sesión"}
      </Link>
    </div>
  );
}
