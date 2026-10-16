"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogIn, Menu, X } from "lucide-react";

/** Menú hamburguesa de la landing para pantallas pequeñas, donde no caben los enlaces del encabezado. */
export function MenuMovil({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra con Escape o al tocar fuera del menú (el backdrop-blur del encabezado impide un fondo `fixed`)
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const alTocar = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alTocar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alTocar);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <div ref={ref} className="md:hidden">
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} aria-controls="menu-movil"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100">
        {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {abierto && (
        <div id="menu-movil" className="absolute inset-x-0 top-16 z-40 border-b border-slate-200 bg-surface px-4 pb-5 pt-2 shadow-lg sm:px-6">
          <nav className="flex flex-col">
            {enlaces.map((e) => (
              <a key={e.href} href={e.href} onClick={cerrar}
                className="border-b border-slate-100 py-3.5 text-base font-medium text-slate-700 hover:text-brand-600">
                {e.texto}
              </a>
            ))}
          </nav>
          <div className="mt-5 grid gap-2.5">
            <Link href="/dashboard" onClick={cerrar} className="btn-secondary justify-center py-2.5">
              <LogIn className="h-4 w-4" /> Iniciar sesión
            </Link>
            <a href="#prueba" onClick={cerrar} className="btn-primary justify-center py-2.5">
              Prueba gratis
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
