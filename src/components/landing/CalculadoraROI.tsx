"use client";

import { useState } from "react";
import { PLANES, cop } from "./Precios";

/** Cuántos pacientes que iban a faltar hay que recuperar para que el plan se pague solo. */
export function CalculadoraROI() {
  const [pacientes, setPacientes] = useState(200);
  const [valorCita, setValorCita] = useState(60_000);
  const [ausentismo, setAusentismo] = useState(20);
  const [plan, setPlan] = useState(0);

  const costo = PLANES[plan].mensual;
  const necesarios = Math.ceil(costo / valorCita);
  const faltantes = Math.round((pacientes * ausentismo) / 100);
  // Supuesto conservador: los recordatorios recuperan un tercio de las inasistencias.
  const recuperados = Math.round(faltantes / 3);
  const ganancia = recuperados * valorCita - costo;

  return (
    <div className="grid gap-8 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm sm:p-8 lg:grid-cols-2">
      <div className="space-y-6">
        <Deslizador label="Pacientes atendidos al mes" valor={pacientes} min={50} max={2000} paso={50} onChange={setPacientes} mostrar={pacientes.toLocaleString("es-CO")} />
        <Deslizador label="Valor promedio por cita" valor={valorCita} min={20_000} max={200_000} paso={5_000} onChange={setValorCita} mostrar={`${cop(valorCita)} COP`} />
        <Deslizador label="Pacientes que hoy faltan a su cita" valor={ausentismo} min={5} max={50} paso={1} onChange={setAusentismo} mostrar={`${ausentismo}%`} />
        <div>
          <p className="text-sm font-medium text-slate-700">Plan</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PLANES.map((p, i) => (
              <button
                key={p.nombre}
                onClick={() => setPlan(i)}
                aria-pressed={plan === i}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  plan === i ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-xl bg-brand-600 p-6 text-white sm:p-8">
        <p className="text-sm text-white/80">Para cubrir el 100% del plan {PLANES[plan].nombre} ({cop(costo)}/mes) solo necesitas recuperar</p>
        <p className="mt-2 text-5xl font-bold tracking-tight">
          {necesarios} <span className="text-2xl font-semibold">{necesarios === 1 ? "paciente" : "pacientes"}</span>
        </p>
        <p className="mt-1 text-sm text-white/80">que iban a faltar a su cita, de {faltantes} inasistencias al mes.</p>
        <div className="mt-6 border-t border-white/20 pt-5 text-sm">
          <p className="text-white/80">Si los recordatorios recuperan 1 de cada 3 inasistencias ({recuperados} pacientes):</p>
          <p className="mt-1 text-2xl font-semibold">
            {ganancia >= 0 ? `+${cop(ganancia)}` : `−${cop(-ganancia)}`} COP <span className="text-base font-normal text-white/80">al mes</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Deslizador(props: {
  label: string; valor: number; min: number; max: number; paso: number; mostrar: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">{props.label}</span>
        <span className="font-semibold text-slate-900">{props.mostrar}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.paso}
        value={props.valor}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-600"
      />
    </label>
  );
}
