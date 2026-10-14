"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, CircleAlert, History, PackageMinus, PackagePlus, Pencil, Search, ShieldAlert, Syringe, Trash2, Users, Wallet,
} from "lucide-react";
import Modal from "@/components/Modal";
import { formatDay } from "@/components/ui";
import { addDaysISO } from "@/lib/agenda";
import { DIAS_ALERTA_VENCIMIENTO, MOTIVOS_BAJA, pesos } from "@/lib/inventario";
import { createClient } from "@/lib/supabase/client";
import type { Lote, MotivoBaja, TipoMovimiento, Vacuna } from "@/types/db";

type VacunaLite = Pick<Vacuna, "id" | "nombre" | "stock_minimo">;

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: MotivoBaja | null;
  detalle: string | null;
  created_at: string;
  lote: { numero_lote: string; costo_unitario: number | null; vacuna: { nombre: string } };
  usuario: { nombre: string } | null;
  cita: { paciente: { nombre_completo: string } | null } | null;
}

const TIPOS: Record<TipoMovimiento, { label: string; cls: string }> = {
  ENTRADA: { label: "Entrada", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  APLICACION: { label: "Aplicación", cls: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  BAJA: { label: "Baja", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  CONTEO: { label: "Conteo", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  ANULACION: { label: "Anulación", cls: "bg-slate-100 text-slate-700 ring-slate-500/20" },
};

const motivoLabel = (m: MotivoBaja | null) => MOTIVOS_BAJA.find((x) => x.id === m)?.label ?? "";
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

type Accion =
  | { tipo: "nuevo" } | { tipo: "editar"; lote: Lote } | { tipo: "baja"; lote: Lote }
  | { tipo: "conteo"; lote: Lote } | { tipo: "pacientes"; lote: Lote } | { tipo: "eliminar"; lote: Lote };

export default function InventarioManager({
  vacunas, lotes, movimientos, hoy, esAdmin,
}: { vacunas: VacunaLite[]; lotes: Lote[]; movimientos: Movimiento[]; hoy: string; esAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [verAgotados, setVerAgotados] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);

  const limite = addDaysISO(hoy, DIAS_ALERTA_VENCIMIENTO);
  const vigente = (l: Lote) => l.fecha_vencimiento >= hoy;
  const nombreVacuna = useMemo(() => new Map(vacunas.map((v) => [v.id, v.nombre])), [vacunas]);

  // Indicadores y alertas
  const vigentesConDosis = lotes.filter((l) => vigente(l) && l.existencias > 0);
  const dosisDisponibles = vigentesConDosis.reduce((n, l) => n + l.existencias, 0);
  const valor = vigentesConDosis.reduce((n, l) => n + l.existencias * (l.costo_unitario ?? 0), 0);
  const hayCostos = lotes.some((l) => l.costo_unitario != null);
  const porVencer = vigentesConDosis.filter((l) => l.fecha_vencimiento <= limite);
  const vencidos = lotes.filter((l) => !vigente(l) && l.existencias > 0);
  const disponiblesDe = (vacunaId: string) =>
    vigentesConDosis.filter((l) => l.vacuna_id === vacunaId).reduce((n, l) => n + l.existencias, 0);
  const conInventario = vacunas.filter((v) => lotes.some((l) => l.vacuna_id === v.id));
  const bajoMinimo = conInventario.filter((v) => v.stock_minimo > 0 && disponiblesDe(v.id) < v.stock_minimo);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const bajasMes = movimientos.filter((m) => m.tipo === "BAJA" && m.created_at.slice(0, 10) >= inicioMes);
  const dosisPerdidas = bajasMes.reduce((n, m) => n - m.cantidad, 0);
  const valorPerdido = bajasMes.reduce((n, m) => n - m.cantidad * (m.lote.costo_unitario ?? 0), 0);

  const kpis = [
    { label: "Dosis disponibles", value: dosisDisponibles.toLocaleString("es-CO"), icon: Syringe, tone: "bg-brand-50 text-brand-600" },
    hayCostos
      ? { label: "Valor en nevera", value: pesos(valor), icon: Wallet, tone: "bg-emerald-50 text-emerald-600" }
      : { label: "Lotes vigentes", value: vigentesConDosis.length, icon: Wallet, tone: "bg-emerald-50 text-emerald-600" },
    { label: `Vencen en ${DIAS_ALERTA_VENCIMIENTO} días`, value: porVencer.length, icon: CircleAlert, tone: "bg-amber-50 text-amber-600" },
    {
      label: "Pérdidas este mes", value: hayCostos && valorPerdido > 0 ? pesos(valorPerdido) : `${dosisPerdidas} dosis`,
      icon: PackageMinus, tone: "bg-red-50 text-red-600",
    },
  ];

  const t = q.trim().toLowerCase();
  const visibles = lotes.filter((l) =>
    (verAgotados || l.existencias > 0) &&
    (!t || l.numero_lote.toLowerCase().includes(t) || (nombreVacuna.get(l.vacuna_id) ?? "").toLowerCase().includes(t) ||
      (l.laboratorio ?? "").toLowerCase().includes(t)));
  const grupos = vacunas
    .map((v) => ({ vacuna: v, lotes: visibles.filter((l) => l.vacuna_id === v.id) }))
    .filter((g) => g.lotes.length > 0);
  const sinInventario = vacunas.filter((v) => !lotes.some((l) => l.vacuna_id === v.id));

  const cerrar = (cambio: boolean) => { setAccion(null); if (cambio) router.refresh(); };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card flex items-center gap-4 p-5">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={22} /></div>
            <div className="min-w-0">
              <div className="truncate text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {(vencidos.length > 0 || porVencer.length > 0 || bajoMinimo.length > 0) && (
        <section className="card divide-y divide-slate-100">
          <h2 className="flex items-center gap-2 px-5 py-3 font-semibold"><ShieldAlert size={18} className="text-amber-600" /> Alertas</h2>
          {vencidos.map((l) => (
            <p key={`v-${l.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm text-red-700">
              <span>🔴 Lote <strong>{l.numero_lote}</strong> de {nombreVacuna.get(l.vacuna_id)} venció el {formatDay(l.fecha_vencimiento)} y tiene <strong>{l.existencias}</strong> dosis. Retíralas de la nevera.</span>
              {esAdmin && <button onClick={() => setAccion({ tipo: "baja", lote: l })} className="btn-secondary py-1 text-xs">Registrar baja</button>}
            </p>
          ))}
          {porVencer.map((l) => (
            <p key={`p-${l.id}`} className="px-5 py-2.5 text-sm text-amber-800">
              🟠 Lote <strong>{l.numero_lote}</strong> de {nombreVacuna.get(l.vacuna_id)} vence el {formatDay(l.fecha_vencimiento)} con <strong>{l.existencias}</strong> dosis. Aplícalo primero.
            </p>
          ))}
          {bajoMinimo.map((v) => (
            <p key={`m-${v.id}`} className="px-5 py-2.5 text-sm text-amber-800">
              ⚠️ <strong>{v.nombre}</strong>: quedan {disponiblesDe(v.id)} dosis (mínimo {v.stock_minimo}). Haz el pedido.
            </p>
          ))}
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lote, vacuna o laboratorio" className="input pl-10" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={verAgotados} onChange={(e) => setVerAgotados(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Mostrar lotes agotados
          </label>
          {esAdmin && (
            <button onClick={() => setAccion({ tipo: "nuevo" })} className="btn-primary"><PackagePlus size={16} /> Entrada de lote</button>
          )}
        </div>

        {grupos.map(({ vacuna, lotes: ls }) => {
          const disp = disponiblesDe(vacuna.id);
          const bajo = vacuna.stock_minimo > 0 && disp < vacuna.stock_minimo;
          return (
            <section key={vacuna.id} className="border-b border-slate-200 last:border-b-0">
              <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-5 py-2.5">
                <h3 className="font-semibold">{vacuna.nombre}</h3>
                <span className={`text-sm ${bajo ? "font-medium text-amber-700" : "text-slate-600"}`}>
                  {disp} dosis disponibles{vacuna.stock_minimo > 0 && ` · mínimo ${vacuna.stock_minimo}`}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">Lote</th><th className="th">Vence</th><th className="th">Existencias</th>
                      <th className="th">Costo / dosis</th><th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ls.map((l) => {
                      const vencido = !vigente(l);
                      const pronto = !vencido && l.fecha_vencimiento <= limite;
                      const pct = Math.round((l.existencias / l.cantidad_inicial) * 100);
                      return (
                        <tr key={l.id} className={vencido ? "bg-red-50/40" : ""}>
                          <td className="td">
                            <div className="font-medium">{l.numero_lote}</div>
                            <div className="text-xs text-slate-500">{l.laboratorio ?? "Sin laboratorio"} · ingresó {formatDay(l.fecha_ingreso)}</div>
                          </td>
                          <td className="td">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                              vencido ? "bg-red-50 text-red-700 ring-red-600/20"
                                : pronto ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                                : "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
                              {vencido ? "Vencido " : ""}{formatDay(l.fecha_vencimiento)}
                            </span>
                          </td>
                          <td className="td min-w-[140px]">
                            <div className="tabular-nums"><strong>{l.existencias}</strong> <span className="text-slate-400">/ {l.cantidad_inicial}</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${vencido ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="td tabular-nums text-slate-600">{l.costo_unitario != null ? pesos(l.costo_unitario) : "—"}</td>
                          <td className="td">
                            <div className="flex justify-end gap-1">
                              <IconBtn label="Pacientes que recibieron este lote" onClick={() => setAccion({ tipo: "pacientes", lote: l })}><Users size={16} /></IconBtn>
                              {esAdmin && <>
                                <IconBtn label="Registrar baja" onClick={() => setAccion({ tipo: "baja", lote: l })} disabled={l.existencias === 0}><PackageMinus size={16} /></IconBtn>
                                <IconBtn label="Conteo físico" onClick={() => setAccion({ tipo: "conteo", lote: l })}><ClipboardCheck size={16} /></IconBtn>
                                <IconBtn label="Editar datos del lote" onClick={() => setAccion({ tipo: "editar", lote: l })}><Pencil size={16} /></IconBtn>
                                {l.existencias === l.cantidad_inicial && (
                                  <IconBtn label="Eliminar (cargado por error)" onClick={() => setAccion({ tipo: "eliminar", lote: l })} peligro><Trash2 size={16} /></IconBtn>
                                )}
                              </>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {grupos.length === 0 && (
          <p className="px-5 py-14 text-center text-sm text-slate-400">
            {lotes.length === 0 ? "Aún no hay lotes registrados. Registra la primera entrada de vacunas." : "Ningún lote coincide con la búsqueda"}
          </p>
        )}
        {sinInventario.length > 0 && (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Sin inventario (se aplican sin lote): {sinInventario.map((v) => v.nombre).join(", ")}. Al registrar su primer lote, el lote pasa a ser obligatorio al vacunar.
          </p>
        )}
      </div>

      <section className="card overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 font-semibold"><History size={18} className="text-brand-600" /> Kárdex · últimos movimientos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr><th className="th">Fecha</th><th className="th">Movimiento</th><th className="th">Vacuna · lote</th><th className="th">Cantidad</th><th className="th">Detalle</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.slice(0, 50).map((m) => (
                <tr key={m.id}>
                  <td className="td whitespace-nowrap text-slate-600">{fechaHora(m.created_at)}</td>
                  <td className="td">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TIPOS[m.tipo].cls}`}>{TIPOS[m.tipo].label}</span>
                  </td>
                  <td className="td">{m.lote.vacuna.nombre} <span className="text-slate-400">· {m.lote.numero_lote}</span></td>
                  <td className={`td font-medium tabular-nums ${m.cantidad > 0 ? "text-emerald-700" : "text-red-700"}`}>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                  <td className="td text-xs text-slate-500">
                    {[m.cita?.paciente?.nombre_completo, motivoLabel(m.motivo), m.detalle, m.usuario?.nombre && `por ${m.usuario.nombre}`]
                      .filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              {movimientos.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Sin movimientos</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {accion?.tipo === "nuevo" && <LoteForm vacunas={vacunas} onClose={cerrar} />}
      {accion?.tipo === "editar" && <LoteForm vacunas={vacunas} lote={accion.lote} onClose={cerrar} />}
      {accion?.tipo === "baja" && <BajaForm lote={accion.lote} vacuna={nombreVacuna.get(accion.lote.vacuna_id) ?? ""} onClose={cerrar} />}
      {accion?.tipo === "conteo" && <ConteoForm lote={accion.lote} vacuna={nombreVacuna.get(accion.lote.vacuna_id) ?? ""} onClose={cerrar} />}
      {accion?.tipo === "eliminar" && <EliminarLote lote={accion.lote} onClose={cerrar} />}
      {accion?.tipo === "pacientes" && <PacientesLote lote={accion.lote} vacuna={nombreVacuna.get(accion.lote.vacuna_id) ?? ""} onClose={() => setAccion(null)} />}
    </div>
  );
}

function IconBtn({ label, onClick, children, disabled, peligro }: {
  label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; peligro?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`rounded-lg p-2 text-slate-500 transition disabled:opacity-30 ${peligro ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-50 hover:text-brand-700"}`}>
      {children}
    </button>
  );
}

/** Envía la petición y devuelve el error (o null si salió bien). */
async function enviar(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.ok ? null : ((await res.json().catch(() => ({}))).error ?? "No se pudo guardar");
}

function Pie({ error, saving, onCancel, texto }: { error: string | null; saving: boolean; onCancel: () => void; texto: string }) {
  return (
    <>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button disabled={saving} className="btn-primary">{saving ? "Guardando…" : texto}</button>
      </div>
    </>
  );
}

function LoteForm({ vacunas, lote, onClose }: { vacunas: VacunaLite[]; lote?: Lote; onClose: (cambio: boolean) => void }) {
  const [f, setF] = useState({
    vacuna_id: lote?.vacuna_id ?? "", numero_lote: lote?.numero_lote ?? "", laboratorio: lote?.laboratorio ?? "",
    fecha_vencimiento: lote?.fecha_vencimiento ?? "", cantidad_inicial: "", costo_unitario: lote?.costo_unitario?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = lote
      ? await enviar(`/api/inventario/lotes/${lote.id}`, "PATCH", f)
      : await enviar("/api/inventario/lotes", "POST", { ...f, cantidad_inicial: Number(f.cantidad_inicial) });
    setSaving(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={lote ? `Editar lote ${lote.numero_lote}` : "Entrada de lote"} onClose={() => onClose(false)}>
      <form onSubmit={submit} className="space-y-4">
        {!lote && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Vacuna *</span>
            <select required value={f.vacuna_id} onChange={set("vacuna_id")} className="input">
              <option value="">Selecciona…</option>
              {vacunas.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Número de lote *</span>
            <input required value={f.numero_lote} onChange={set("numero_lote")} className="input" placeholder="HB2026-0457" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Laboratorio</span>
            <input value={f.laboratorio} onChange={set("laboratorio")} className="input" placeholder="GSK, Sanofi, Pfizer…" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Fecha de vencimiento *</span>
            <input required type="date" value={f.fecha_vencimiento} onChange={set("fecha_vencimiento")} className="input" />
          </label>
          {!lote && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Dosis recibidas *</span>
              <input required type="number" min={1} value={f.cantidad_inicial} onChange={set("cantidad_inicial")} className="input" />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Costo por dosis (COP)</span>
            <input type="number" min={0} step="any" value={f.costo_unitario} onChange={set("costo_unitario")} className="input" placeholder="Opcional" />
          </label>
        </div>
        {lote && (
          <p className="text-xs text-slate-500">Las existencias no se editan aquí: usa <strong>Registrar baja</strong> o <strong>Conteo físico</strong> para que quede en el kárdex.</p>
        )}
        <Pie error={error} saving={saving} onCancel={() => onClose(false)} texto={lote ? "Guardar cambios" : "Registrar entrada"} />
      </form>
    </Modal>
  );
}

function BajaForm({ lote, vacuna, onClose }: { lote: Lote; vacuna: string; onClose: (cambio: boolean) => void }) {
  const vencido = lote.fecha_vencimiento < new Date().toLocaleDateString("en-CA");
  const [cantidad, setCantidad] = useState(String(vencido ? lote.existencias : 1));
  const [motivo, setMotivo] = useState<MotivoBaja>(vencido ? "VENCIDA" : "ROTURA");
  const [detalle, setDetalle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await enviar(`/api/inventario/lotes/${lote.id}/movimiento`, "POST", { tipo: "BAJA", cantidad: Number(cantidad), motivo, detalle });
    setSaving(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={`Baja · ${vacuna} · lote ${lote.numero_lote}`} onClose={() => onClose(false)}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Dosis que salen del inventario sin aplicarse. Quedan registradas como pérdida.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Dosis *</span>
            <input required type="number" min={1} max={lote.existencias} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input" />
            <span className="block text-xs text-slate-500">Disponibles: {lote.existencias}</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Motivo *</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoBaja)} className="input">
              {MOTIVOS_BAJA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Detalle</span>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} className="input" placeholder="Ej: nevera 2 se apagó la noche del 12" />
        </label>
        <Pie error={error} saving={saving} onCancel={() => onClose(false)} texto="Registrar baja" />
      </form>
    </Modal>
  );
}

function ConteoForm({ lote, vacuna, onClose }: { lote: Lote; vacuna: string; onClose: (cambio: boolean) => void }) {
  const [contadas, setContadas] = useState(String(lote.existencias));
  const [detalle, setDetalle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diferencia = Number(contadas) - lote.existencias;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await enviar(`/api/inventario/lotes/${lote.id}/movimiento`, "POST", { tipo: "CONTEO", existencias: Number(contadas), detalle });
    setSaving(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={`Conteo físico · ${vacuna} · lote ${lote.numero_lote}`} onClose={() => onClose(false)}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Cuenta las dosis que hay en la nevera. Si no coincide con el sistema, se ajusta y la diferencia queda en el kárdex.</p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Dosis contadas *</span>
          <input required type="number" min={0} value={contadas} onChange={(e) => setContadas(e.target.value)} className="input max-w-[160px]" />
          <span className={`block text-xs ${diferencia === 0 ? "text-slate-500" : "font-medium text-amber-700"}`}>
            Sistema: {lote.existencias}{contadas !== "" && diferencia !== 0 && ` · diferencia ${diferencia > 0 ? "+" : ""}${diferencia}`}
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Detalle</span>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} className="input" placeholder="Ej: conteo de fin de mes" />
        </label>
        <Pie error={error} saving={saving} onCancel={() => onClose(false)} texto="Guardar conteo" />
      </form>
    </Modal>
  );
}

function EliminarLote({ lote, onClose }: { lote: Lote; onClose: (cambio: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Eliminar lote" onClose={() => onClose(false)}>
      <p className="text-sm text-slate-600">
        ¿Eliminar el lote <strong>{lote.numero_lote}</strong>? Úsalo solo si se registró por error. Un lote que ya se usó no se puede eliminar.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
        <button disabled={busy} onClick={async () => {
          setBusy(true);
          const err = await enviar(`/api/inventario/lotes/${lote.id}`, "DELETE");
          setBusy(false);
          if (err) setError(err); else onClose(true);
        }} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
          {busy ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}

interface Aplicacion {
  id: string;
  fecha_aplicacion: string;
  numero_dosis: number;
  paciente: { nombre_completo: string; documento_identidad: string; telefono: string };
}

/** Trazabilidad: pacientes que recibieron dosis de este lote (para un retiro del lote). */
function PacientesLote({ lote, vacuna, onClose }: { lote: Lote; vacuna: string; onClose: () => void }) {
  const [filas, setFilas] = useState<Aplicacion[] | null>(null);
  useEffect(() => {
    createClient().from("citas_vacunacion")
      .select("id, fecha_aplicacion, numero_dosis, paciente:pacientes!inner(nombre_completo, documento_identidad, telefono)")
      .eq("lote_id", lote.id).order("fecha_aplicacion", { ascending: false })
      .returns<Aplicacion[]>()
      .then(({ data }) => setFilas(data ?? []));
  }, [lote.id]);

  return (
    <Modal title={`Pacientes · ${vacuna} · lote ${lote.numero_lote}`} wide onClose={onClose}>
      {filas === null ? (
        <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Ningún paciente ha recibido dosis de este lote.</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <p className="mb-3 text-sm text-slate-600">{filas.length} {filas.length === 1 ? "dosis aplicada" : "dosis aplicadas"} de este lote:</p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70"><tr><th className="th">Paciente</th><th className="th">Teléfono</th><th className="th">Dosis</th><th className="th">Fecha</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((a) => (
                <tr key={a.id}>
                  <td className="td"><div className="font-medium">{a.paciente.nombre_completo}</div><div className="text-xs text-slate-500">Doc. {a.paciente.documento_identidad}</div></td>
                  <td className="td text-slate-600">{a.paciente.telefono}</td>
                  <td className="td tabular-nums">{a.numero_dosis}</td>
                  <td className="td text-slate-600">{formatDay(a.fecha_aplicacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
