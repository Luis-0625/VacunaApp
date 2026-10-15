"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, Clock, FileText, Megaphone, Phone, Search, Send, UserRoundX, Users } from "lucide-react";
import Modal from "@/components/Modal";
import { AutorizacionBadge, Avatar, formatDay } from "@/components/ui";
import {
  DIAS_ENTRE_CONTACTOS, MENSAJE_CAMPANA_DEFAULT, VARIABLES_MENSAJE, renderMensaje, variablesCampana, type DosisPendiente,
} from "@/lib/campanas";

export interface ResumenCampana {
  id: string;
  nombre: string;
  created_at: string;
  total: number;
  enviados: number;
  fallidos: number;
  pendientes: number;
  agendados: number;
  yaAplicada: number;
}

const RANGOS = [
  { id: "todos", label: "Todos", min: 1, max: Infinity },
  { id: "30", label: "1–30 días", min: 1, max: 30 },
  { id: "90", label: "31–90 días", min: 31, max: 90 },
  { id: "mas", label: "Más de 90 días", min: 91, max: Infinity },
] as const;

const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

function AtrasoBadge({ dias }: { dias: number }) {
  const cls = dias > 90 ? "bg-red-50 text-red-700 ring-red-600/20"
    : dias > 30 ? "bg-amber-50 text-amber-700 ring-amber-600/20"
    : "bg-slate-100 text-slate-700 ring-slate-500/20";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ring-1 ring-inset ${cls}`}>{dias} {dias === 1 ? "día" : "días"}</span>;
}

/** Motivo por el que no se puede incluir en una campaña (null = se puede). */
function bloqueo(d: DosisPendiente): string | null {
  if (d.ultima_respuesta === "YA_APLICADA") return "Dijo que ya se vacunó: regístrala como dosis externa";
  if (d.autoriza_mensajes === "NO_AUTORIZADO") return "No autoriza mensajes";
  if (d.ultimo_contacto && Date.now() - Date.parse(d.ultimo_contacto) < DIAS_ENTRE_CONTACTOS * 86400000) {
    return `Contactado hace menos de ${DIAS_ENTRE_CONTACTOS} días`;
  }
  return null;
}

type Fase = { tipo: "editar" } | { tipo: "enviando"; id: string; total: number; enviados: number; fallidos: number; omitidos?: Record<string, number> } | { tipo: "listo"; total: number; enviados: number; fallidos: number; omitidos?: Record<string, number> };

export default function AtrasadosManager({
  atrasados, campanas, hoy, esAdmin, centro,
}: { atrasados: DosisPendiente[]; campanas: ResumenCampana[]; hoy: string; esAdmin: boolean; centro: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [vacuna, setVacuna] = useState("");
  const [rango, setRango] = useState<(typeof RANGOS)[number]["id"]>("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);

  const vacunas = useMemo(() => [...new Set(atrasados.map((a) => a.vacuna))].sort(), [atrasados]);
  const filas = useMemo(() => {
    const r = RANGOS.find((x) => x.id === rango)!;
    const t = q.trim().toLowerCase();
    return atrasados
      .map((a) => ({ ...a, dias: diasEntre(a.fecha_proxima_dosis, hoy) }))
      .filter((a) => a.dias >= r.min && a.dias <= r.max)
      .filter((a) => !vacuna || a.vacuna === vacuna)
      .filter((a) => !t || [a.nombre_completo, a.documento_identidad, a.telefono].some((v) => v.toLowerCase().includes(t)))
      .sort((a, b) => b.dias - a.dias);
  }, [atrasados, hoy, q, vacuna, rango]);

  const seleccionables = filas.filter((f) => !bloqueo(f));
  const todosMarcados = seleccionables.length > 0 && seleccionables.every((f) => sel.has(f.cita_id));
  const seleccion = atrasados.filter((a) => sel.has(a.cita_id));

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleTodos() {
    setSel((s) => {
      const n = new Set(s);
      seleccionables.forEach((f) => (todosMarcados ? n.delete(f.cita_id) : n.add(f.cita_id)));
      return n;
    });
  }

  const pacientesUnicos = new Set(atrasados.map((a) => a.paciente_id)).size;
  const masDe30 = atrasados.filter((a) => diasEntre(a.fecha_proxima_dosis, hoy) > 30).length;
  const recuperados = campanas.reduce((n, c) => n + c.agendados, 0);
  const kpis = [
    { label: "Pacientes atrasados", value: pacientesUnicos, icon: Users, tone: "bg-amber-50 text-amber-600" },
    { label: "Dosis atrasadas", value: atrasados.length, icon: UserRoundX, tone: "bg-red-50 text-red-600" },
    { label: "Más de 30 días", value: masDe30, icon: Clock, tone: "bg-slate-100 text-slate-600" },
    { label: "Recuperados con campañas", value: recuperados, icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card flex items-center gap-4 p-5">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={22} /></div>
            <div>
              <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente, documento o teléfono" className="input pl-10" />
          </div>
          <select value={vacuna} onChange={(e) => setVacuna(e.target.value)} className="input w-auto">
            <option value="">Todas las vacunas</option>
            {vacunas.map((v) => <option key={v}>{v}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-slate-200 bg-surface p-0.5 text-sm">
            {RANGOS.map((r) => (
              <button key={r.id} onClick={() => setRango(r.id)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${rango === r.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                {esAdmin && (
                  <th className="th w-10">
                    <input type="checkbox" aria-label="Seleccionar todos" checked={todosMarcados} onChange={toggleTodos}
                      className="h-4 w-4 rounded accent-brand-600" />
                  </th>
                )}
                <th className="th">Paciente</th><th className="th">Dosis pendiente</th><th className="th">Debía aplicarse</th>
                <th className="th">Atraso</th><th className="th">Último contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((a) => {
                const motivo = bloqueo(a);
                return (
                  <tr key={a.cita_id} className={`align-top transition ${sel.has(a.cita_id) ? "bg-brand-50/60" : "hover:bg-slate-50"}`}>
                    {esAdmin && (
                      <td className="td">
                        <input type="checkbox" aria-label={`Seleccionar ${a.nombre_completo}`} disabled={!!motivo} title={motivo ?? undefined}
                          checked={sel.has(a.cita_id)} onChange={() => toggle(a.cita_id)}
                          className="h-4 w-4 rounded accent-brand-600 disabled:opacity-30" />
                      </td>
                    )}
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" name={a.nombre_completo} />
                        <div className="min-w-0">
                          <div className="font-medium">{a.nombre_completo}</div>
                          <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><Phone size={11} />{a.telefono}</span>
                            <AutorizacionBadge estado={a.autoriza_mensajes} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600">
                      {a.vacuna} <span className="text-slate-400">· dosis {a.numero_dosis + 1} de {a.dosis_totales}</span>
                      {a.ultima_respuesta === "YA_APLICADA" && (
                        <div className="mt-1.5 space-y-1">
                          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
                            Dice que ya se la aplicó
                          </span>
                          <Link href={`/dashboard/vacunacion?paciente=${a.paciente_id}&vacuna=${a.vacuna_id}&externa=1`}
                            className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                            <FileText size={12} /> Registrar como dosis externa
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="td text-slate-600">{formatDay(a.fecha_proxima_dosis)}</td>
                    <td className="td"><AtrasoBadge dias={a.dias} /></td>
                    <td className="td text-xs text-slate-500">
                      {a.ultimo_contacto ? `Hace ${diasEntre(a.ultimo_contacto.slice(0, 10), hoy)} días` : "—"}
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 && (
                <tr><td colSpan={esAdmin ? 6 : 5} className="py-14 text-center text-slate-400">
                  {atrasados.length === 0 ? "¡Excelente! No hay pacientes atrasados" : "Ningún paciente coincide con los filtros"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Megaphone size={18} className="text-brand-600" />
          <h2 className="font-semibold">Campañas recientes</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Campaña</th><th className="th">Enviados</th><th className="th">Recuperados</th>
                <th className="th">Ya vacunados</th><th className="th">Fallidos</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campanas.map((c) => (
                <tr key={c.id}>
                  <td className="td">
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}</div>
                  </td>
                  <td className="td tabular-nums">{c.enviados} / {c.total}</td>
                  <td className="td">
                    <span className="font-semibold tabular-nums text-emerald-700">{c.agendados}</span>
                    {c.enviados > 0 && <span className="ml-1.5 text-xs text-slate-500">({Math.round((c.agendados / c.enviados) * 100)}%)</span>}
                  </td>
                  <td className="td tabular-nums text-slate-600">{c.yaAplicada}</td>
                  <td className="td tabular-nums text-slate-600">{c.fallidos}</td>
                  <td className="td text-right">
                    {esAdmin && c.pendientes > 0 && (
                      <ReanudarEnvio id={c.id} total={c.total} onDone={() => router.refresh()} />
                    )}
                  </td>
                </tr>
              ))}
              {campanas.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Aún no has enviado campañas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {esAdmin && sel.size > 0 && (
        <div className="sticky bottom-20 z-30 md:bottom-4">
          <div className="card mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 shadow-lg">
            <span className="text-sm"><strong className="tabular-nums">{sel.size}</strong> {sel.size === 1 ? "paciente seleccionado" : "pacientes seleccionados"}</span>
            <div className="flex gap-2">
              <button onClick={() => setSel(new Set())} className="btn-secondary py-2">Limpiar</button>
              <button onClick={() => setModal(true)} className="btn-primary py-2"><Megaphone size={16} /> Crear campaña</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <CampanaModal seleccion={seleccion} centro={centro}
          onClose={(enviada) => { setModal(false); if (enviada) { setSel(new Set()); router.refresh(); } }} />
      )}
    </div>
  );
}

/** Envía en bucle los lotes pendientes de una campaña. */
async function enviarLotes(id: string, onProgreso: (p: { pendientes: number; enviados: number; fallidos: number }) => void) {
  for (;;) {
    const res = await fetch(`/api/campanas/${id}/enviar`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Error al enviar");
    onProgreso(json);
    if (json.pendientes === 0) return json as { enviados: number; fallidos: number };
  }
}

function ReanudarEnvio({ id, total, onDone }: { id: string; total: number; onDone: () => void }) {
  const [enviando, setEnviando] = useState<number | null>(null);
  return (
    <button disabled={enviando !== null} className="btn-secondary py-1.5 text-xs"
      onClick={async () => {
        setEnviando(0);
        try { await enviarLotes(id, (p) => setEnviando(p.enviados + p.fallidos)); } finally { onDone(); }
      }}>
      <Send size={13} /> {enviando === null ? "Reanudar envío" : `Enviando ${enviando}/${total}…`}
    </button>
  );
}

function CampanaModal({ seleccion, centro, onClose }: {
  seleccion: DosisPendiente[]; centro: string; onClose: (enviada: boolean) => void;
}) {
  const [nombre, setNombre] = useState(`Recuperación ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`);
  const [mensaje, setMensaje] = useState(MENSAJE_CAMPANA_DEFAULT);
  const [incluirSinRegistrar, setIncluirSinRegistrar] = useState(false);
  const [fase, setFase] = useState<Fase>({ tipo: "editar" });
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const sinRegistrar = seleccion.filter((s) => !s.autoriza_mensajes).length;
  const destinatarios = seleccion.length - (incluirSinRegistrar ? 0 : sinRegistrar);
  const ejemplo = seleccion[0];
  const preview = ejemplo ? renderMensaje(mensaje, variablesCampana(ejemplo, centro)) : "";

  async function enviar() {
    if (creando) return;
    setCreando(true);
    setError(null);
    const res = await fetch("/api/campanas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, mensaje, cita_ids: seleccion.map((s) => s.cita_id), incluir_sin_registrar: incluirSinRegistrar }),
    });
    const json = await res.json();
    if (!res.ok) { setCreando(false); return setError(json.error ?? "No se pudo crear la campaña"); }

    setFase({ tipo: "enviando", id: json.id, total: json.total, enviados: 0, fallidos: 0, omitidos: json.omitidos });
    try {
      const fin = await enviarLotes(json.id, (p) =>
        setFase({ tipo: "enviando", id: json.id, total: json.total, enviados: p.enviados, fallidos: p.fallidos, omitidos: json.omitidos }));
      setFase({ tipo: "listo", total: json.total, enviados: fin.enviados, fallidos: fin.fallidos, omitidos: json.omitidos });
    } catch (e) {
      setError(`${(e as Error).message}. Puedes reanudar el envío desde "Campañas recientes".`);
      setFase({ tipo: "listo", total: json.total, enviados: 0, fallidos: 0, omitidos: json.omitidos });
    }
  }

  const omitidosTexto = (o?: Record<string, number>) => {
    if (!o) return null;
    const partes = [
      o.sin_registrar && `${o.sin_registrar} sin autorización registrada`,
      o.no_autoriza && `${o.no_autoriza} no autorizan`,
      o.contactados && `${o.contactados} contactados recientemente`,
      o.no_atrasados && `${o.no_atrasados} ya no están atrasados`,
    ].filter(Boolean);
    return partes.length ? `No se incluyeron: ${partes.join(", ")}.` : null;
  };

  if (fase.tipo !== "editar") {
    const hechos = fase.enviados + fase.fallidos;
    const pct = fase.total ? Math.round((hechos / fase.total) * 100) : 100;
    return (
      <Modal title={fase.tipo === "listo" ? "Campaña enviada" : "Enviando campaña…"} onClose={() => fase.tipo === "listo" && onClose(true)}>
        <div className="space-y-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-slate-600">
            <strong className="tabular-nums">{fase.enviados}</strong> enviados
            {fase.fallidos > 0 && <> · <strong className="tabular-nums text-red-600">{fase.fallidos}</strong> fallidos</>}
            {" "}de {fase.total}
          </p>
          {omitidosTexto(fase.omitidos) && <p className="text-xs text-slate-500">{omitidosTexto(fase.omitidos)}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
          {fase.tipo === "listo" && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
                Las respuestas llegan solas: los pacientes que respondan <strong>1</strong> elegirán su fecha y aparecerán en la Agenda.
              </p>
              <div className="flex justify-end"><button onClick={() => onClose(true)} className="btn-primary">Listo</button></div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nueva campaña por WhatsApp" wide onClose={() => onClose(false)}>
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Nombre de la campaña</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className="input" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Mensaje</span>
          <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={1000} className="input" />
          <span className="block text-xs text-slate-500">
            Variables: {VARIABLES_MENSAJE.map((v) => <code key={v} className="mr-1 rounded bg-slate-100 px-1">{v}</code>)}
            · Las instrucciones para responder y la opción SALIR se agregan siempre al final.
          </span>
        </label>

        {preview && (
          <div className="rounded-lg bg-[#efeae2] p-4 dark:bg-[#0b141a]">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Vista previa · {ejemplo.nombre_completo}</div>
            <div className="max-w-[95%] whitespace-pre-line rounded-lg rounded-tl-none bg-surface px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm">
              {preview}
            </div>
          </div>
        )}

        {sinRegistrar > 0 && (
          <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <input type="checkbox" checked={incluirSinRegistrar} onChange={(e) => setIncluirSinRegistrar(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-600" />
            <span>
              Incluir {sinRegistrar} {sinRegistrar === 1 ? "paciente" : "pacientes"} con autorización <strong>sin registrar</strong>.
              <span className="block text-xs text-amber-700">Por la Ley 1581, lo recomendable es contactar solo a quienes autorizaron.</span>
            </span>
          </label>
        )}

        <p className="text-xs text-slate-500">
          En producción, WhatsApp exige una plantilla aprobada (TWILIO_CAMPANA_CONTENT_SID); en ese caso se envía la
          plantilla en lugar de este texto.
        </p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
          <button onClick={enviar} disabled={creando || destinatarios === 0 || !nombre.trim() || !mensaje.trim()} className="btn-primary">
            <Send size={16} /> Enviar a {destinatarios} {destinatarios === 1 ? "paciente" : "pacientes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
