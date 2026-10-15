"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Ancla } from "./anclas";

export const PLANES: { nombre: string; mensual: number; anual: number; popular?: boolean; items: string[]; cta: string; ancla: Ancla }[] = [
  {
    nombre: "Básico",
    mensual: 280_000,
    anual: 2_800_000,
    items: ["Hasta 300 pacientes", "1 sede", "Recordatorios por WhatsApp + Email", "Inventario por lote", "Soporte por email"],
    cta: "Comenzar ahora",
    ancla: "prueba-basico",
  },
  {
    nombre: "Pro",
    mensual: 480_000,
    anual: 4_800_000,
    popular: true,
    items: ["Hasta 1.000 pacientes", "Hasta 3 sedes", "Bot conversacional 24/7", "Trazabilidad avanzada", "Soporte prioritario"],
    cta: "Probar gratis 6 días",
    ancla: "prueba-pro",
  },
  {
    nombre: "Enterprise",
    mensual: 980_000,
    anual: 9_800_000,
    items: ["Pacientes ilimitados", "Sedes ilimitadas", "Bot + API personalizada", "Soporte 24/7", "Capacitación dedicada"],
    cta: "Contactar ventas",
    ancla: "ventas-enterprise",
  },
];

export const cop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export function Precios() {
  const [anual, setAnual] = useState(false);

  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Periodo de facturación" className="inline-flex rounded-full border border-slate-200 bg-surface p-1 text-sm shadow-sm">
          {[
            { valor: false, label: "Mensual" },
            { valor: true, label: "Anual" },
          ].map((o) => (
            <button
              key={o.label}
              role="radio"
              aria-checked={anual === o.valor}
              onClick={() => setAnual(o.valor)}
              className={`rounded-full px-5 py-2 font-medium transition ${
                anual === o.valor ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {o.label}
              {o.valor && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${anual ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}>
                  Ahorra 16%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANES.map((p) => (
          <div
            key={p.nombre}
            className={`relative flex flex-col rounded-2xl border bg-surface p-7 shadow-sm ${
              p.popular ? "border-brand-500 ring-4 ring-brand-500/10 lg:-my-3 lg:py-10" : "border-slate-200"
            }`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                Más popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-900">Plan {p.nombre}</h3>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">{cop(anual ? p.anual / 12 : p.mensual)}</span>
              <span className="text-sm text-slate-500">COP / mes</span>
            </p>
            <p className="mt-1 h-5 text-sm text-slate-500">
              {anual ? `Facturado ${cop(p.anual)} al año` : `o ${cop(p.anual)} al año`}
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
              {p.items.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {i}
                </li>
              ))}
            </ul>
            <a
              href={`#${p.ancla}`}
              className={`mt-8 justify-center ${p.popular ? "btn-primary" : "btn-secondary"}`}
            >
              {p.cta}
            </a>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-3xl rounded-xl border border-dashed border-brand-300 bg-brand-50 px-5 py-4 text-center text-sm text-slate-700">
        ¿Necesitas configuración inicial? <strong>Onboarding & Setup oficial: $600.000 COP</strong> (pago único) —{" "}
        <strong className="text-emerald-700">¡GRATIS contratando cualquier plan anual!</strong>
      </p>
    </div>
  );
}
