"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Perfil, Rol } from "@/types/db";
import Modal from "@/components/Modal";
import { Avatar, PageHeader } from "@/components/ui";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15";

const ROLES: { value: Rol; label: string }[] = [
  { value: "VACUNADOR", label: "Vacunador / Enfermero" },
  { value: "ADMIN", label: "Administrador" },
];

function NuevoUsuario({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ nombre: "", email: "", password: "", rol: "VACUNADOR" as Rol });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo crear");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Nombre completo *</span>
        <input required value={f.nombre} onChange={set("nombre")} className={inputCls} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Correo *</span>
        <input required type="email" value={f.email} onChange={set("email")} className={inputCls} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Contraseña inicial *</span>
          <input required type="password" minLength={8} value={f.password} onChange={set("password")} className={inputCls} />
          <span className="text-xs text-slate-400">Mínimo 8 caracteres</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Rol *</span>
          <select value={f.rol} onChange={set("rol")} className={inputCls}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50">Cancelar</button>
        <button disabled={saving} className="btn-primary">{saving ? "Creando…" : "Crear usuario"}</button>
      </div>
    </form>
  );
}

export default function UsuariosManager({ usuarios, yoId }: { usuarios: Perfil[]; yoId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) return setError((await res.json()).error ?? "No se pudo actualizar");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Administrador: acceso total. Vacunador: registra vacunaciones y gestiona pacientes, sin acceso a reportes, catálogo, importación/exportación ni usuarios."
        action={<button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> Nuevo usuario</button>}
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr><th className="th">Usuario</th><th className="th">Rol</th><th className="th">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => {
              const soyYo = u.user_id === yoId;
              return (
                <tr key={u.user_id} className="hover:bg-teal-50/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.nombre} />
                      <div>
                        <div className="font-medium">{u.nombre}{soyYo && <span className="ml-2 text-xs text-teal-600">(tú)</span>}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <select value={u.rol} disabled={soyYo || busyId === u.user_id}
                      onChange={(e) => patch(u.user_id, { rol: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:opacity-60">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <button disabled={soyYo || busyId === u.user_id} onClick={() => patch(u.user_id, { activo: !u.activo })}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-60 ${
                        u.activo ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-slate-100 text-slate-500 ring-slate-300"
                      }`}>
                      {u.activo ? "Activo" : "Desactivado"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Nuevo usuario" onClose={() => setCreating(false)}>
          <NuevoUsuario onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); router.refresh(); }} />
        </Modal>
      )}
    </div>
  );
}
