"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, EyeOff, FileSpreadsheet, FileText, IdCard, Mail, Pencil, Phone, Plus, Search, Trash2, Upload } from "lucide-react";
import Modal from "@/components/Modal";
import type { Paciente } from "@/types/db";
import ImportarExcel from "@/components/ImportarExcel";
import PacienteForm from "@/components/PacienteForm";
import CarneModal from "@/components/CarneModal";
import { AutorizacionBadge, Avatar, PageHeader } from "@/components/ui";
import { exportPacientes } from "@/lib/export";

const PAGE = 12;

export default function PacientesTable({ pacientes, esAdmin }: { pacientes: Paciente[]; esAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editing, setEditing] = useState<Paciente | "new" | null>(null);
  const [carne, setCarne] = useState<Paciente | null>(null);
  const [deleting, setDeleting] = useState<Paciente | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [anonimizando, setAnonimizando] = useState<Paciente | null>(null);
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [anonError, setAnonError] = useState<string | null>(null);
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

  async function confirmAnonimizar() {
    if (!anonimizando) return;
    setBusy(true);
    setAnonError(null);
    const res = await fetch(`/api/pacientes/${anonimizando.id}/anonimizar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setAnonError((await res.json().catch(() => ({}))).error ?? "No se pudo anonimizar");
    setAnonimizando(null);
    router.refresh();
  }

  const btnSecondary =
    "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-surface px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50";

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
                        <Icon size={16} className="text-brand-600" /> {label}
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
              className="input pl-10"
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
                <tr key={p.id} className="transition hover:bg-brand-50/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.nombre_completo} />
                      <span className={"font-medium" + (p.anonimizado_at ? " text-slate-400" : "")}>{p.nombre_completo}</span>
                      {p.anonimizado_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
                          <EyeOff size={11} /> Anonimizado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td tabular-nums text-slate-600">{p.documento_identidad}</td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 text-slate-700"><Phone size={13} className="text-slate-400" />{p.telefono}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Mail size={13} className="text-slate-400" />{p.email ?? "Sin email"}</div>
                    <div className="mt-1"><AutorizacionBadge estado={p.autoriza_mensajes} /></div>
                  </td>
                  <td className="td text-slate-600">{p.fecha_nacimiento ?? "—"}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      {!p.anonimizado_at && (<>
                      <button onClick={() => setCarne(p)} aria-label="Carné digital" title="Carné digital"
                        className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"><IdCard size={16} /></button>
                      <button onClick={() => setEditing(p)} aria-label="Editar" title="Editar"
                        className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"><Pencil size={16} /></button>
                      </>)}
                      {esAdmin && !p.anonimizado_at && (
                      <button onClick={() => { setAnonError(null); setConfirmaTexto(""); setAnonimizando(p); }} aria-label="Anonimizar" title="Anonimizar (borrar la identidad, conservar las dosis)"
                        className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"><EyeOff size={16} /></button>
                      )}
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

      {carne && (
        <CarneModal paciente={carne} onClose={() => setCarne(null)} onTokenChange={() => router.refresh()} />
      )}
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

      {anonimizando && (
        <Modal title="Anonimizar paciente" onClose={() => setAnonimizando(null)}>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Vas a borrar la identidad de <strong>{anonimizando.nombre_completo}</strong>. Úsalo cuando el paciente pida que se
              eliminen sus datos (Ley 1581 de 2012).
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Se borra:</strong> nombre, documento, teléfono, correo y fecha de nacimiento, también en los mensajes y en la auditoría. Su enlace del carné deja de funcionar y no recibirá más recordatorios.</li>
              <li><strong>Se conserva:</strong> las dosis aplicadas, sin nombre, porque el historial de vacunación debe conservarse. Quedan constancia de quién anonimizó y cuándo.</li>
            </ul>
            <p className="rounded-lg bg-red-50 px-3 py-2 font-medium text-red-700 ring-1 ring-red-200">Esta acción no se puede deshacer.</p>
            <label className="block space-y-1.5">
              <span className="font-medium text-slate-700">Escribe ANONIMIZAR para confirmar</span>
              <input value={confirmaTexto} onChange={(e) => setConfirmaTexto(e.target.value)} className="input" autoComplete="off" />
            </label>
          </div>
          {anonError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{anonError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setAnonimizando(null)} className="btn-secondary">Cancelar</button>
            <button onClick={confirmAnonimizar} disabled={busy || confirmaTexto.trim().toUpperCase() !== "ANONIMIZAR"}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
              {busy ? "Anonimizando…" : "Anonimizar"}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Eliminar paciente" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600">
            ¿Eliminar a <strong>{deleting.nombre_completo}</strong>? También se borrarán sus citas y recordatorios. Esta acción no se puede deshacer. Si el paciente pidió que se eliminen sus datos, usa mejor <strong>Anonimizar</strong>: conserva el historial de vacunación sin identidad.
          </p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancelar</button>
            <button onClick={confirmDelete} disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
