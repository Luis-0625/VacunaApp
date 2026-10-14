"use client";

import { useEffect, useState } from "react";
import { Printer, Share2 } from "lucide-react";

/** Botones de imprimir/compartir del carné. Al imprimir se usa siempre el tema claro. */
export default function CarneAcciones() {
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    setPuedeCompartir(typeof navigator !== "undefined" && "share" in navigator);
    const html = document.documentElement;
    let eraOscuro = false;
    const antes = () => { eraOscuro = html.classList.contains("dark"); html.classList.remove("dark"); };
    const despues = () => { if (eraOscuro) html.classList.add("dark"); };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => { window.removeEventListener("beforeprint", antes); window.removeEventListener("afterprint", despues); };
  }, []);

  return (
    <div className="flex justify-center gap-2 print:hidden">
      <button onClick={() => window.print()} className="btn-secondary"><Printer size={16} /> Imprimir o guardar PDF</button>
      {puedeCompartir && (
        <button onClick={() => navigator.share({ title: document.title, url: location.href }).catch(() => {})} className="btn-secondary">
          <Share2 size={16} /> Compartir
        </button>
      )}
    </div>
  );
}
