"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LIMITE_MS = 10 * 60 * 1000; // sin actividad durante 10 minutos se cierra la sesión
const AVISO_MS = 60 * 1000; // el último minuto se muestra el aviso
const CLAVE = "ultima-actividad"; // compartida entre pestañas: la actividad en una mantiene viva a las demás
const EVENTOS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;

function leerUltima(): number {
  try {
    return Number(localStorage.getItem(CLAVE)) || Date.now();
  } catch {
    return Date.now();
  }
}

function marcarActividad() {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // sin almacenamiento (modo privado): cada pestaña cuenta por su cuenta con la variable en memoria
  }
}

/**
 * Cierra la sesión tras 10 minutos sin actividad, con un aviso el último minuto. Protege los datos de
 * pacientes en computadores compartidos (recepción del centro).
 */
export default function CierreInactividad() {
  const [restante, setRestante] = useState<number | null>(null); // segundos del aviso, o null sin aviso
  const ultimaLocal = useRef(0);
  const avisando = useRef(false);
  const cerrando = useRef(false);

  useEffect(() => {
    ultimaLocal.current = Date.now();
    marcarActividad();
    let ultimaEscritura = 0;

    const alActuar = () => {
      if (avisando.current) return; // durante el aviso solo cuenta el botón "Seguir conectado"
      const ahora = Date.now();
      ultimaLocal.current = ahora;
      if (ahora - ultimaEscritura > 5000) { // no escribir en cada movimiento del mouse
        ultimaEscritura = ahora;
        marcarActividad();
      }
    };

    const revisar = async () => {
      const inactivo = Date.now() - Math.max(leerUltima(), ultimaLocal.current);
      if (inactivo >= LIMITE_MS) {
        if (cerrando.current) return;
        cerrando.current = true;
        await createClient().auth.signOut().catch(() => {});
        window.location.replace("/login?motivo=inactividad");
      } else if (inactivo >= LIMITE_MS - AVISO_MS) {
        avisando.current = true;
        setRestante(Math.ceil((LIMITE_MS - inactivo) / 1000));
      } else if (avisando.current) {
        avisando.current = false; // otra pestaña siguió activa
        setRestante(null);
      }
    };

    EVENTOS.forEach((e) => window.addEventListener(e, alActuar, { passive: true }));
    const intervalo = setInterval(revisar, 1000);
    // Al volver de otra app o de suspender el equipo, revisar de inmediato
    const alVolver = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, alActuar));
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  function seguir() {
    avisando.current = false;
    ultimaLocal.current = Date.now();
    marcarActividad();
    setRestante(null);
  }

  if (restante === null) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true"
      aria-labelledby="inactividad-titulo">
      <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Clock className="h-6 w-6" />
        </span>
        <h2 id="inactividad-titulo" className="mt-4 text-lg font-semibold text-slate-900">¿Sigues ahí?</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Por seguridad, tu sesión se cerrará por inactividad en{" "}
          <strong className="tabular-nums text-slate-900">{restante} s</strong>.
        </p>
        <button onClick={seguir} autoFocus className="btn-primary mt-5 w-full justify-center py-2.5">
          Seguir conectado
        </button>
      </div>
    </div>
  );
}
