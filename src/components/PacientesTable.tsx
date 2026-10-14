"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Mail, Pencil, Phone, Plus, Search, Trash2, Upload } from "lucide-react";
import Modal from "@/components/Modal";
import type { Paciente } from "@/types/db";
import ImportarExcel from "@/components/ImportarExcel";
import PacienteForm from "@/components/PacienteForm";
import { Avatar, PageHeader } from "@/components/ui";
import { exportPacientes } from "@/lib/export";

const PAGE = 12;

export default function PacientesTable({ pacientes, esAdmin }: { pacientes: Paciente[]; esAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editing, setEditing] = useState<Paciente | "new" | null>(null);
  const [deleting, setDeleting] = useState<Paciente | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return pacientes;
    return pacientes.filter((p) =>
      [p.nombre_completo, p.documento_identidad, p.email ?? "", p.telefono].some((v) => v.toLowerCase().includes(t))
    );
  }, [q, pacientes]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE, current * PAGE + PAGE);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    const res = await fetch(`/api/pacientes/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setDeleteError((await res.json()).error ?? "No se pudo eliminar");
    setDeleting(null);
    router.refresh();
  }

  const btnSecondary =
    "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50";

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${pacientes.length} pacientes registrados`}
        action={
          <div className="flex flex-wrap gap-2">
            {esAdmin && (
              <>
            <div className="relative">
              <button onClick={() => setShowExport((v) => !v)} className={btnSecondary}>
                <Download size={16} /> Exportar
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                  <div className="card absolute right-0 z-20 mt-2 w-60 overflow-hidden py-1 text-sm">
                    <p className="px-4 py-2 text-xs text-slate-400">
                      {q ? `${filtered.length} resultados filtrados` : `Todos (${pacientes.length})`}
                    </p>
                    {([["xlsx", "Excel (.xlsx)", FileSpreadsheet], ["csv", "CSV (.csv)", FileText]] as const).map(([fmt, label, Icon]) => (
                      <button key={fmt}
                        onClick={() => { exportPacientes(filtered, fmt); setShowExport(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50">
                        <Icon size={16} className="text-teal-600" /> {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowImport(true)} className={btnSecondary}>
              <Upload size={16} /> Importar
            </button>
              </>
            )}
            <button onClick={() => setEditing("new")} className="btn-primary">
              <Plus size={16} /> Nuevo paciente
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Buscar por nombre, documento, email o teléfono"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Paciente</th><th className="th">Documento</th>
                <th className="th">Contacto</th><th className="th">Nacimiento</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="transition hover:bg-teal-50/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.nombre_completo} />
                      <span className="font-medium">{p.nombre_completo}</span>
                    </div>
                  </td>
                  <td className="td tabular-nums text-slate-600">{p.documento_identidad}</td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 text-slate-700"><Phone size={13} className="text-slate-400" />{p.telefono}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Mail size={13} className="text-slate-400" />{p.email ?? "Sin email"}</div>
                  </td>
                  <td className="td text-slate-600">{p.fecha_nacimiento ?? "—"}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(p)} aria-label="Editar" title="Editar"
                        className="rounded-lg p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700"><Pencil size={16} /></button>
                      {esAdmin && (
                      <button onClick={() => { setDeleteError(null); setDeleting(p); }} aria-label="Eliminar" title="Eliminar"
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-14 text-center text-slate-400">No se encontraron pacientes</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <span>{filtered.length} resultados</span>
          <div className="flex items-center gap-2">
            <button disabled={current === 0} onClick={() => setPage(current - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Anterior</button>
            <span className="tabular-nums">{current + 1} / {pages}</span>
            <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Siguiente</button>
          </div>
        </footer>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Nuevo paciente" : "Editar paciente"} onClose={() => setEditing(null)}>
          <PacienteForm
            paciente={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); router.refresh(); }}
          />
        </Modal>
      )}

      {showImport && (
        <Modal title="Importar pacientes desde Excel / CSV" onClose={() => setShowImport(false)} wide>
          <ImportarExcel onDone={() => router.refresh()} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Eliminar paciente" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600">
            ¿Eliminar a <strong>{deleting.nombre_completo}</strong>? También se borrarán sus citas y recordatorios. Esta acción no se puede deshacer.
          </p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmDelete} disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
