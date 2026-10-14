"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarSync, MessageCircleQuestion, Phone, RefreshCw, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addDaysISO, formatFechaLarga, todayISO } from "@/lib/agenda";
import { Avatar } from "@/components/ui";
import type { AutorizaMensajes, Confirmacion, EstadoEnvio } from "@/types/db";

interface CitaAgenda {
  id: string;
  numero_dosis: number;
  fecha_proxima_dosis: string;
  paciente: { nombre_completo: string; documento_identidad: string; telefono: string; autoriza_mensajes: AutorizaMensajes | null };
  vacuna: { nombre: string };
  recordatorio: {
    estado_envio: EstadoEnvio;
    confirmacion: Confirmacion | null;
    reprogramaciones: number;
    respondido_at: string | null;
  } | null;
}

type Situacion = "CONFIRMADA" | "REPROGRAMANDO" | "SIN_RESPUESTA" | "POR_AVISAR" | "FALLIDO";

const SITUACION: Record<Situacion, { label: string; badge: string; dot: string }> = {
  CONFIRMADA: { label: "Confirmada", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  REPROGRAMANDO: { label: "Eligiendo fecha", badge: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  SIN_RESPUESTA: { label: "Sin respuesta", badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  POR_AVISAR: { label: "Aviso pendiente", badge: "bg-slate-50 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  FALLIDO: { label: "Aviso fallido", badge: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
};

/** Estado de la cita desde el punto de vista de la confirmación del paciente. */
function situacion(c: CitaAgenda): Situacion {
  const r = c.recordatorio;
  if (!r) return "POR_AVISAR";
  if (r.confirmacion === "CONFIRMADA") return "CONFIRMADA";
  if (r.confirmacion === "REPROGRAMANDO") return "REPROGRAMANDO";
  if (r.estado_envio === "FALLIDO") return "FALLIDO";
  if (r.estado_envio === "ENVIADO") return "SIN_RESPUESTA";
  return "POR_AVISAR"; // PENDIENTE (incluye las reprogramadas que esperan su nuevo aviso)
}

const reprogramada = (c: CitaAgenda) => (c.recordatorio?.reprogramaciones ?? 0) > 0;

type Filtro = "TODAS" | "CONFIRMADA" | "REPROGRAMADA" | "SIN_RESPUESTA" | "REPROGRAMANDO";

const FILTROS: { id: Filtro; label: string; icon: typeof CalendarCheck; match: (c: CitaAgenda) => boolean }[] = [
  { id: "TODAS", label: "Todas", icon: CalendarClock, match: () => true },
  { id: "CONFIRMADA", label: "Confirmadas", icon: CalendarCheck, match: (c) => situacion(c) === "CONFIRMADA" },
  { id: "REPROGRAMADA", label: "Reprogramadas", icon: CalendarSync, match: reprogramada },
  { id: "SIN_RESPUESTA", label: "Sin respuesta", icon: MessageCircleQuestion, match: (c) => situacion(c) === "SIN_RESPUESTA" },
  { id: "REPROGRAMANDO", label: "Eligiendo fecha", icon: RefreshCw, match: (c) => situacion(c) === "REPROGRAMANDO" },
];

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
];

const SELECT = `
  id, numero_dosis, fecha_proxima_dosis,
  paciente:pacientes!inner (nombre_completo, documento_identidad, telefono, autoriza_mensajes),
  vacuna:vacunas!inner (nombre),
  recordatorio:recordatorios (estado_envio, confirmacion, reprogramaciones, respondido_at)`;

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function AgendaCitas() {
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [dias, setDias] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const hoy = todayISO();
  const manana = addDaysISO(hoy, 1);

  const load = useCallback(async () => {
    const desde = todayISO();
    const { data, error } = await createClient()
      .from("citas_vacunacion")
      .select(SELECT)
      .gte("fecha_proxima_dosis", desde)
      .lte("fecha_proxima_dosis", addDaysISO(desde, dias))
      .neq("estado", "CANCELADA")
      .order("fecha_proxima_dosis")
      .limit(1000)
      .returns<CitaAgenda[]>();
    if (error) setError(error.message);
    else { setError(null); setCitas(data ?? []); }
    setCargando(false);
  }, [dias]);

  // Tiempo real: las respuestas por WhatsApp aparecen sin recargar.
  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("agenda-citas")
      .on("postgres_changes", { event: "*", schema: "public", table: "recordatorios" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "citas_vacunacion" }, () => load())
      .subscribe();
    const timer = setInterval(load, 15000);
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [load]);

  const visibles = useMemo(
    () => citas.filter(FILTROS.find((f) => f.id === filtro)!.match),
    [citas, filtro]
  );

  const porDia = useMemo(() => {
    const grupos = new Map<string, CitaAgenda[]>();
    for (const c of visibles) grupos.set(c.fecha_proxima_dosis, [...(grupos.get(c.fecha_proxima_dosis) ?? []), c]);
    return [...grupos.entries()];
  }, [visibles]);

  const confirmadas = citas.filter((c) => situacion(c) === "CONFIRMADA").length;
  const tasa = citas.length ? Math.round((confirmadas / citas.length) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FILTROS.map(({ id, label, icon: Icon, match }) => (
          <button key={id} onClick={() => setFiltro(id)}
            className={`card flex items-center gap-3 p-4 text-left transition ${filtro === id ? "ring-2 ring-brand-500" : "hover:-translate-y-0.5"}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon size={18} /></span>
            <span>
              <span className="block text-2xl font-semibold tabular-nums leading-tight">{citas.filter(match).length}</span>
              <span className="text-xs text-slate-500">{label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-surface p-0.5 text-sm">
          {RANGOS.map((r) => (
            <button key={r.dias} onClick={() => setDias(r.dias)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${dias === r.dias ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              Próximos {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {tasa !== null && (
            <span className="text-sm text-slate-500">
              Tasa de confirmación: <span className="font-semibold text-emerald-700">{tasa}%</span>
            </span>
          )}
          <button onClick={load} aria-label="Actualizar"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {porDia.map(([fecha, lista]) => {
        const ok = lista.filter((c) => situacion(c) === "CONFIRMADA").length;
        return (
          <section key={fecha} className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <h2 className="font-semibold capitalize">
                {formatFechaLarga(fecha)}
                {fecha === hoy && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium normal-case text-white">Hoy</span>}
                {fecha === manana && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium normal-case text-brand-700">Mañana</span>}
              </h2>
              <span className="text-xs text-slate-500">
                {lista.length} {lista.length === 1 ? "cita" : "citas"} · {ok} confirmada{ok === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="divide-y divide-slate-100">
              {lista.map((c) => {
                const s = SITUACION[situacion(c)];
                const r = c.recordatorio;
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-brand-50/40">
                    <Avatar name={c.paciente.nombre_completo} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.paciente.nombre_completo}</div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                        <span>{c.vacuna.nombre} · dosis {c.numero_dosis}</span>
                        <span className="inline-flex items-center gap-1"><Phone size={11} />{c.paciente.telefono}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {c.paciente.autoriza_mensajes === "NO_AUTORIZADO" && (
                          <span title="El paciente no autoriza recibir mensajes: confirma la cita por otro medio"
                            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            <ShieldX size={12} /> No autoriza mensajes
                          </span>
                        )}
                        {reprogramada(c) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
                            <CalendarSync size={12} /> Reprogramada{r!.reprogramaciones > 1 ? ` ×${r!.reprogramaciones}` : ""}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                        </span>
                      </div>
                      {r?.respondido_at && (
                        <span className="text-[11px] text-slate-400">Respondió por WhatsApp el {hora(r.respondido_at)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!cargando && porDia.length === 0 && (
        <div className="card py-14 text-center text-sm text-slate-400">
          {filtro === "TODAS" ? "No hay citas programadas en este periodo" : "Ninguna cita coincide con este filtro"}
        </div>
      )}
    </div>
  );
}
