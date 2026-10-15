"use client";

import { Moon, Sun } from "lucide-react";
import { CLAVE_TEMA as CLAVE, type Tema } from "@/lib/tema";
import { useLocalStorage } from "@/lib/use-local-storage";

const OPCIONES: { id: Tema; label: string; icon: typeof Sun }[] = [
  { id: "claro", label: "Predeterminado", icon: Sun },
  { id: "oscuro", label: "Oscuro", icon: Moon },
];

/** Selector Predeterminado / Oscuro. `compacto` muestra un solo botón que alterna. */
export default function SelectorTema({ compacto = false }: { compacto?: boolean }) {
  const [guardado, guardar] = useLocalStorage(CLAVE, "claro");
  const tema: Tema = guardado === "oscuro" ? "oscuro" : "claro";

  function elegir(t: Tema) {
    guardar(t);
    document.documentElement.classList.toggle("dark", t === "oscuro");
  }

  if (compacto) {
    const actual = OPCIONES.find((o) => o.id === tema)!;
    const siguiente = OPCIONES.find((o) => o.id !== tema)!;
    return (
      <button type="button" onClick={() => elegir(siguiente.id)}
        title={`Tema: ${actual.label} (cambiar a ${siguiente.label})`} aria-label={`Tema: ${actual.label}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
        <actual.icon size={16} />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-2 gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
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
