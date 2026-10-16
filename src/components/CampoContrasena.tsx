"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Input de contraseña con botón para mostrarla u ocultarla. */
export default function CampoContrasena({
  id, value, onChange, autoComplete = "current-password", placeholder = "••••••••", minLength,
}: {
  id?: string; value: string; onChange: (v: string) => void; autoComplete?: string; placeholder?: string; minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={visible ? "text" : "password"} required autoComplete={autoComplete} minLength={minLength}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pr-11" />
      <button type="button" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-400 transition hover:text-slate-700">
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
