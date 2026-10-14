"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { AutorizaMensajes, Paciente } from "@/types/db";

interface Props {
  paciente?: Paciente | null;
  onSaved: () => void;
  onCancel: () => void;
}

const inputCls =
  "input";

const MEDIOS: Record<string, string> = {
  FORMULARIO: "registrado por el personal",
  WHATSAPP: "respuesta del paciente por WhatsApp",
  IMPORTACION: "importación de Excel",
};

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default function PacienteForm({ paciente, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    nombre_completo: paciente?.nombre_completo ?? "",
    documento_identidad: paciente?.documento_identidad ?? "",
    telefono: paciente?.telefono ?? "",
    email: paciente?.email ?? "",
    fecha_nacimiento: paciente?.fecha_nacimiento ?? "",
  });
  const [autoriza, setAutoriza] = useState<AutorizaMensajes | null>(paciente?.autoriza_mensajes ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!paciente && !autoriza) {
      setError("Indica si el paciente autoriza recibir recordatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(paciente ? `/api/pacientes/${paciente.id}` : "/api/pacientes", {
        method: paciente ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, autoriza_mensajes: autoriza }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const opcion = (valor: AutorizaMensajes, titulo: string, Icon: typeof ShieldCheck, activo: string) => (
    <button type="button" role="radio" aria-checked={autoriza === valor} onClick={() => setAutoriza(valor)}
      className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
        autoriza === valor ? activo : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}>
      <Icon size={16} className="shrink-0" /> {titulo}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Nombre completo *</span>
        <input required value={form.nombre_completo} onChange={set("nombre_completo")} className={inputCls} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Documento de identidad *</span>
          <input required value={form.documento_identidad} onChange={set("documento_identidad")} className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Fecha de nacimiento</span>
          <input type="date" value={form.fecha_nacimiento} onChange={set("fecha_nacimiento")} className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Teléfono / WhatsApp *</span>
          <input required value={form.telefono} onChange={set("telefono")} placeholder="300 123 4567" className={inputCls} />
          <span className="text-xs text-slate-400">Se guarda con el código de país (+57 por defecto)</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
        </label>
      </div>

      <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <legend className="sr-only">Autorización de mensajes</legend>
        <div className="text-sm font-medium text-slate-700">
          ¿El paciente autoriza recibir recordatorios por WhatsApp y email? {!paciente && "*"}
        </div>
        <p className="text-xs text-slate-500">
          Tratamiento de datos personales según la Ley 1581 de 2012. El paciente puede retirar la autorización
          en cualquier momento respondiendo <strong>SALIR</strong> a un mensaje.
        </p>
        <div role="radiogroup" className="flex flex-col gap-2 pt-1 sm:flex-row">
          {opcion("AUTORIZADO", "Sí autoriza", ShieldCheck, "border-emerald-600 bg-emerald-50 text-emerald-700")}
          {opcion("NO_AUTORIZADO", "No autoriza", ShieldX, "border-red-600 bg-red-50 text-red-700")}
        </div>
        {paciente && !paciente.autoriza_mensajes && !autoriza && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <ShieldAlert size={14} /> Autorización sin registrar: pregúntale al paciente y márcala.
          </p>
        )}
        {paciente?.autorizacion_fecha && paciente.autoriza_mensajes === autoriza && (
          <p className="text-xs text-slate-500">
            Registrada el {fechaHora(paciente.autorizacion_fecha)}
            {paciente.autorizacion_medio && ` · ${MEDIOS[paciente.autorizacion_medio]}`}
          </p>
        )}
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="btn-secondary">Cancelar</button>
        <button disabled={saving} className="btn-primary">
          {saving ? "Guardando…" : paciente ? "Guardar cambios" : "Crear paciente"}
        </button>
      </div>
    </form>
  );
}
