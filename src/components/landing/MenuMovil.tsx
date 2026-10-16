"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, CircleHelp, Menu, MessageCircle, Sparkles, Tag, X } from "lucide-react";
import { TarjetaAcceso } from "./AccesoCentro";

const ICONOS: Record<string, typeof Menu> = {
  "#funciones": Sparkles,
  "#demo": MessageCircle,
  "#precios": Tag,
  "#faq": CircleHelp,
};

/** Menú hamburguesa de la landing para pantallas pequeñas, donde no caben los enlaces del encabezado. */
export function MenuMovil({ enlaces }: { enlaces: { href: string; texto: string; detalle: string }[] }) {
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
        <div id="menu-movil"
          className="absolute inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-slate-200 bg-surface px-4 pb-5 pt-4 shadow-xl sm:px-6">
          <TarjetaAcceso alElegir={cerrar} />

          <p className="mb-1 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Conoce VacunaApp</p>
          <nav className="flex flex-col">
            {enlaces.map((e) => {
              const Icono = ICONOS[e.href] ?? ChevronRight;
              return (
                <a key={e.href} href={e.href} onClick={cerrar}
                  className="group flex items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-slate-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-brand-50 group-hover:text-brand-600">
                    <Icono className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{e.texto}</span>
                    <span className="block truncate text-xs text-slate-500">{e.detalle}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </a>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <a href="#prueba" onClick={cerrar} className="btn-secondary w-full justify-center py-2.5">
              Probar gratis 6 días <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-slate-500">Sin tarjeta de crédito · Sin permanencia</p>
          </div>
        </div>
      )}
    </div>
  );
}
