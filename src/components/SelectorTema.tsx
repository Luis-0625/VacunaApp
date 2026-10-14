"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CLAVE_TEMA as CLAVE, type Tema } from "@/lib/tema";

const OPCIONES: { id: Tema; label: string; icon: typeof Sun }[] = [
  { id: "claro", label: "Claro", icon: Sun },
  { id: "oscuro", label: "Oscuro", icon: Moon },
  { id: "sistema", label: "Sistema", icon: Monitor },
];

function leer(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === "oscuro" || t === "sistema" ? t : "claro";
  } catch {
    return "claro";
  }
}

function guardar(t: Tema) {
  try { localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento: solo esta sesión */ }
  const w = window as unknown as { __aplicarTema?: () => void };
  if (w.__aplicarTema) w.__aplicarTema();
  else document.documentElement.classList.toggle("dark", t === "oscuro");
}

/** Selector Claro / Oscuro / Sistema. `compacto` muestra un solo botón que alterna. */
export default function SelectorTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("claro");
  useEffect(() => setTema(leer()), []);

  function elegir(t: Tema) {
    setTema(t);
    guardar(t);
  }

  if (compacto) {
    const i = OPCIONES.findIndex((o) => o.id === tema);
    const actual = OPCIONES[i];
    const siguiente = OPCIONES[(i + 1) % OPCIONES.length];
    return (
      <button type="button" onClick={() => elegir(siguiente.id)}
        title={`Tema: ${actual.label} (cambiar a ${siguiente.label})`} aria-label={`Tema: ${actual.label}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
        <actual.icon size={16} />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {OPCIONES.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={tema === id} onClick={() => elegir(id)} title={label}
          className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
            tema === id ? "bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
          }`}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}
