"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { EMPRESA, enlaceVentas } from "@/lib/empresa";
import { ANCLAS } from "./anclas";

type Tipo = "prueba" | "demostracion";

const PLANES = ["Básico", "Pro", "Enterprise", "Aún no sé"];

const VACIO = { nombre: "", centro: "", ciudad: "", telefono: "", email: "", mensaje: "", sitio: "" };

export function SolicitudPrueba() {
  const [tipo, setTipo] = useState<Tipo>("prueba");
  const [plan, setPlan] = useState("Aún no sé");
  const [form, setForm] = useState(VACIO);
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState("");

  // Los botones "Probar gratis" de los planes llevan a #prueba-pro, etc.: preselecciona el plan
  useEffect(() => {
    const aplicar = () => {
      const a: { tipo: Tipo; plan?: string } | undefined = ANCLAS[window.location.hash.slice(1) as keyof typeof ANCLAS];
      if (!a) return;
      setTipo(a.tipo);
      if (a.plan) setPlan(a.plan);
    };
    aplicar();
    window.addEventListener("hashchange", aplicar);
    return () => window.removeEventListener("hashchange", aplicar);
  }, []);

  const campo = (k: keyof typeof VACIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setError("");
    try {
      const res = await fetch("/api/solicitud-prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipo, plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No pudimos enviar tu solicitud.");
      setEstado("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar tu solicitud.");
      setEstado("listo");
    }
  }

  if (estado === "enviado") {
    const queQuiere = tipo === "prueba" ? "activar la prueba gratis de 6 días" : "agendar una demostración";
    // La solicitud ya llegó por correo; el chat deja al cliente hablando con ventas de una vez
    const chat = enlaceVentas(
      `Hola, soy ${form.nombre} de ${form.centro} (${form.ciudad}). Acabo de enviar la solicitud en la página y quiero ${queQuiere} de VacunaApp` +
        `${plan !== "Aún no sé" ? ` (Plan ${plan})` : ""}. Mi correo es ${form.email}.`
    );
    return (
      <div className="flex flex-col items-center rounded-2xl bg-surface p-10 text-center text-slate-700 shadow-xl">
        <CircleCheck className="h-12 w-12 text-emerald-600" />
        <p className="mt-4 text-xl font-semibold text-slate-900">¡Recibimos tu solicitud, {form.nombre.split(" ")[0]}!</p>
        {EMPRESA.whatsapp ? (
          <>
            <p className="mt-2 max-w-md">Escríbenos ahora por WhatsApp y te atendemos de inmediato para {queQuiere}.</p>
            <a {...chat} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-105">
              <MessageCircle className="h-5 w-5" /> Continuar por WhatsApp
            </a>
            <p className="mt-3 text-xs text-slate-500">O espera nuestra llamada al {form.telefono}.</p>
          </>
        ) : (
          <p className="mt-2 max-w-md">
            Te contactaremos en menos de un día hábil al {form.telefono} o a {form.email} para {queQuiere}.
          </p>
        )}
        <button onClick={() => { setForm(VACIO); setEstado("listo"); }} className="mt-6 text-sm font-medium text-brand-600 hover:underline">
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl bg-surface p-6 text-left text-slate-900 shadow-xl sm:p-8">
      <div role="radiogroup" aria-label="¿Qué necesitas?" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        {([
          ["prueba", "Prueba gratis 6 días"],
          ["demostracion", "Agendar demostración"],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={tipo === v}
            onClick={() => setTipo(v)}
            className={`rounded-lg px-3 py-2 font-medium transition ${tipo === v ? "bg-surface text-brand-700 shadow-sm" : "text-slate-600"}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Campo label="Tu nombre"><input required autoComplete="name" className="input" {...campo("nombre")} /></Campo>
        <Campo label="Centro de vacunación / IPS"><input required autoComplete="organization" className="input" {...campo("centro")} /></Campo>
        <Campo label="Ciudad"><input required className="input" placeholder="Sincelejo" {...campo("ciudad")} /></Campo>
        <Campo label="Celular / WhatsApp"><input required type="tel" autoComplete="tel" className="input" placeholder="300 123 4567" {...campo("telefono")} /></Campo>
        <Campo label="Correo"><input required type="email" autoComplete="email" className="input" {...campo("email")} /></Campo>
        <Campo label="Plan de interés">
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="¿Algo que debamos saber? (opcional)">
            <textarea rows={3} className="input resize-none" placeholder="Número de sedes, pacientes al mes, horario para llamarte…" {...campo("mensaje")} />
          </Campo>
        </div>
        {/* Campo trampa para bots: oculto para las personas */}
        <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...campo("sitio")} />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={estado === "enviando"} className="btn-primary mt-6 w-full justify-center py-3 text-base">
        {estado === "enviando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {tipo === "prueba" ? "Solicitar prueba gratis" : "Solicitar demostración"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Al enviar aceptas que te contactemos según nuestra{" "}
        <a href="/privacidad" className="underline">política de privacidad</a>.
      </p>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
