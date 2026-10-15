"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MessageCircle, RefreshCw, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { Avatar, ConfirmacionBadge, formatDay, StatusBadge, STATUS_STYLES } from "@/components/ui";
import type { CanalEnvio, EstadoEnvio, RecordatorioDetalle } from "@/types/db";

const TABS: EstadoEnvio[] = ["PENDIENTE", "ENVIADO", "FALLIDO"];

function Canal({ canal }: { canal: CanalEnvio }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      {(canal === "EMAIL" || canal === "AMBOS") && <Mail size={14} />}
      {(canal === "WHATSAPP" || canal === "AMBOS") && <MessageCircle size={14} />}
      <span className="text-xs">{canal === "AMBOS" ? "Email + WhatsApp" : canal === "EMAIL" ? "Email" : "WhatsApp"}</span>
    </span>
  );
}

export default function MonitorRecordatorios() {
  const [items, setItems] = useState<RecordatorioDetalle[]>([]);
  const [tab, setTab] = useState<EstadoEnvio>("PENDIENTE");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("recordatorios")
      .select(REMINDER_SELECT)
      .order("fecha_programada", { ascending: false })
      .limit(300)
      .returns<RecordatorioDetalle[]>();
    if (error) setError(error.message);
    else { setError(null); setItems(data ?? []); }
  }, []);

  // Tiempo real: suscripción a cambios + refresco periódico de respaldo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga remota: el estado cambia al llegar la respuesta
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("recordatorios-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "recordatorios" }, () => load())
      .subscribe();
    const timer = setInterval(load, 15000);
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      const res = await fetch(`/api/recordatorios/${id}/reintentar`, { method: "POST" });
      if (!res.ok && res.status !== 502) setError((await res.json()).error ?? "Error al reintentar");
    } finally {
      setRetrying(null);
      load();
    }
  }

  const count = (s: EstadoEnvio) => items.filter((i) => i.estado_envio === s).length;
  const visible = items.filter((i) => i.estado_envio === tab);
  const respuestas = (c: RecordatorioDetalle["confirmacion"]) =>
    items.filter((i) => i.estado_envio === "ENVIADO" && i.confirmacion === c).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`card p-5 text-left transition ${tab === s ? "ring-2 ring-brand-500" : "hover:-translate-y-0.5"}`}
          >
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[s].dot}`} />
              {STATUS_STYLES[s].label}s
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{count(s)}</div>
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-semibold">{STATUS_STYLES[tab].label}s</h2>
            {tab === "ENVIADO" && (
              <p className="text-xs text-slate-500">
                <span className="font-medium text-emerald-700">{respuestas("CONFIRMADA")}</span> confirmadas ·{" "}
                <span className="font-medium text-sky-700">{respuestas("REPROGRAMANDO")}</span> eligiendo fecha ·{" "}
                <span className="font-medium text-slate-600">{respuestas(null)}</span> sin respuesta
              </p>
            )}
          </div>
          <button onClick={load} aria-label="Actualizar"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Paciente</th><th className="th">Vacuna</th><th className="th">Programado</th>
                <th className="th">Canal</th><th className="th">Intentos</th><th className="th">Estado</th><th className="th">Respuesta</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="align-top transition hover:bg-brand-50/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={r.cita?.paciente.nombre_completo ?? "?"} />
                      <span className="font-medium">{r.cita?.paciente.nombre_completo ?? "—"}</span>
                    </div>
                  </td>
                  <td className="td text-slate-600">{r.cita?.vacuna.nombre} <span className="text-slate-400">· dosis {r.cita && r.cita.numero_dosis + 1}</span></td>
                  <td className="td text-slate-600">{formatDay(r.fecha_programada)}</td>
                  <td className="td"><Canal canal={r.canal} /></td>
                  <td className="td tabular-nums text-slate-600">{r.intentos}</td>
                  <td className="td">
                    <StatusBadge estado={r.estado_envio} />
                    {r.ultimo_error && (
                      <div className={`mt-1.5 max-w-xs text-xs ${r.estado_envio === "ENVIADO" ? "text-amber-700" : "text-red-600"}`}>
                        {r.estado_envio === "ENVIADO" ? "Llegó por un canal. Otro falló: " : ""}{r.ultimo_error}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    {(r.estado_envio === "ENVIADO" || r.confirmacion) && <ConfirmacionBadge confirmacion={r.confirmacion} />}
                    {r.reprogramaciones > 0 && (
                      <div className="mt-1.5 text-xs text-violet-700">
                        Reprogramada por el paciente{r.reprogramaciones > 1 ? ` (${r.reprogramaciones} veces)` : ""}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    {r.estado_envio !== "ENVIADO" && (
                      <button onClick={() => retry(r.id)} disabled={retrying === r.id}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50">
                        <RotateCw size={13} className={retrying === r.id ? "animate-spin" : ""} /> Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-slate-400">Nada por aquí</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
