"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Vacuna } from "@/types/db";
import Modal from "@/components/Modal";
import { PageHeader } from "@/components/ui";

const inputCls =
  "input";

function VacunaForm({ vacuna, onSaved, onCancel }: { vacuna: Vacuna | null; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    nombre: vacuna?.nombre ?? "",
    dosis_totales: String(vacuna?.dosis_totales ?? 1),
    intervalo_dias_recom_dosis: vacuna?.intervalo_dias_recom_dosis?.toString() ?? "",
    descripcion: vacuna?.descripcion ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const multi = Number(f.dosis_totales) > 1;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(vacuna ? `/api/vacunas/${vacuna.id}` : "/api/vacunas", {
      method: vacuna ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo guardar");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Nombre de la vacuna *</span>
        <input required value={f.nombre} onChange={set("nombre")} className={inputCls} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Dosis del esquema *</span>
          <input required type="number" min={1} max={20} value={f.dosis_totales} onChange={set("dosis_totales")} className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Cada cuántos días {multi && "*"}</span>
          <input type="number" min={1} disabled={!multi} required={multi} value={multi ? f.intervalo_dias_recom_dosis : ""}
            onChange={set("intervalo_dias_recom_dosis")} placeholder={multi ? "30" : "No aplica"}
            className={`${inputCls} disabled:opacity-50`} />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Descripción</span>
        <textarea rows={2} value={f.descripcion} onChange={set("descripcion")} className={inputCls} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button disabled={saving} className="btn-primary">{saving ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}

export default function VacunasManager({ vacunas }: { vacunas: Vacuna[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Vacuna | "new" | null>(null);
  const [deleting, setDeleting] = useState<Vacuna | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/vacunas/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "No se pudo eliminar");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de vacunas"
        subtitle="Define cuántas dosis tiene cada vacuna y cada cuántos días se aplican. El sistema usa esto para programar los recordatorios."
        action={<button onClick={() => setEditing("new")} className="btn-primary"><Plus size={16} /> Nueva vacuna</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr><th className="th">Vacuna</th><th className="th">Esquema</th><th className="th">Intervalo</th><th className="th">Descripción</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vacunas.map((v) => (
              <tr key={v.id} className="hover:bg-brand-50/40">
                <td className="td font-medium">{v.nombre}</td>
                <td className="td">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
                    {v.dosis_totales} {v.dosis_totales === 1 ? "dosis" : "dosis"}
                  </span>
                </td>
                <td className="td text-slate-600">{v.intervalo_dias_recom_dosis ? `cada ${v.intervalo_dias_recom_dosis} días` : "—"}</td>
                <td className="td max-w-xs truncate text-slate-500">{v.descripcion ?? "—"}</td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(v)} aria-label="Editar" className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"><Pencil size={16} /></button>
                    <button onClick={() => { setError(null); setDeleting(v); }} aria-label="Eliminar" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {vacunas.length === 0 && <tr><td colSpan={5} className="py-14 text-center text-slate-400">Aún no hay vacunas</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Nueva vacuna" : "Editar vacuna"} onClose={() => setEditing(null)}>
          <VacunaForm vacuna={editing === "new" ? null : editing} onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); router.refresh(); }} />
        </Modal>
      )}
      {deleting && (
        <Modal title="Eliminar vacuna" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600">¿Eliminar <strong>{deleting.nombre}</strong> del catálogo?</p>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancelar</button>
            <button onClick={confirmDelete} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
