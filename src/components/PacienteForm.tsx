"use client";

import { useState } from "react";
import type { Paciente } from "@/types/db";

interface Props {
  paciente?: Paciente | null;
  onSaved: () => void;
  onCancel: () => void;
}

const inputCls =
  "input";

export default function PacienteForm({ paciente, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    nombre_completo: paciente?.nombre_completo ?? "",
    documento_identidad: paciente?.documento_identidad ?? "",
    telefono: paciente?.telefono ?? "",
    email: paciente?.email ?? "",
    fecha_nacimiento: paciente?.fecha_nacimiento ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(paciente ? `/api/pacientes/${paciente.id}` : "/api/pacientes", {
        method: paciente ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

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
