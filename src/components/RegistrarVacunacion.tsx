"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Search, Syringe, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, formatDay } from "@/components/ui";
import type { CanalEnvio, Vacuna } from "@/types/db";

export interface PacienteLite { id: string; nombre_completo: string; documento_identidad: string }
export interface Reciente {
  id: string; numero_dosis: number; fecha_aplicacion: string; fecha_proxima_dosis: string | null;
  paciente: { nombre_completo: string }; vacuna: { nombre: string; dosis_totales: number };
}
interface HistorialItem {
  id: string; vacuna_id: string; numero_dosis: number; fecha_aplicacion: string;
  fecha_proxima_dosis: string | null; vacuna: { nombre: string; dosis_totales: number };
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const todayLocal = () => new Date().toLocaleDateString("en-CA");

const inputCls =
  "input";

const CANALES: { value: CanalEnvio; label: string }[] = [
  { value: "AMBOS", label: "Email + WhatsApp" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
];

export default function RegistrarVacunacion({
  pacientes, vacunas, recientes,
}: { pacientes: PacienteLite[]; vacunas: Vacuna[]; recientes: Reciente[] }) {
  const router = useRouter();
  const [paciente, setPaciente] = useState<PacienteLite | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [vacunaId, setVacunaId] = useState("");
  const [fecha, setFecha] = useState(todayLocal);
  const [proximaManual, setProximaManual] = useState<string | null>(null);
  const [canal, setCanal] = useState<CanalEnvio>("AMBOS");
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return pacientes.slice(0, 8);
    return pacientes.filter((p) => p.nombre_completo.toLowerCase().includes(t) || p.documento_identidad.includes(t)).slice(0, 8);
  }, [query, pacientes]);

  const loadHistorial = useCallback(async (id: string) => {
    const { data } = await createClient()
      .from("citas_vacunacion")
      .select("id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, vacuna:vacunas!inner(nombre, dosis_totales)")
      .eq("paciente_id", id).neq("estado", "CANCELADA")
      .order("fecha_aplicacion", { ascending: false })
      .returns<HistorialItem[]>();
    setHistorial(data ?? []);
  }, []);

  useEffect(() => {
    if (paciente) loadHistorial(paciente.id);
    else setHistorial([]);
  }, [paciente, loadHistorial]);

  const vacuna = vacunas.find((v) => v.id === vacunaId) ?? null;
  const numeroDosis = vacuna
    ? Math.max(0, ...historial.filter((h) => h.vacuna_id === vacuna.id).map((h) => h.numero_dosis)) + 1
    : 0;
  const completo = !!vacuna && numeroDosis > vacuna.dosis_totales;
  const esUltima = !!vacuna && numeroDosis === vacuna.dosis_totales;
  const sugerida = vacuna && !esUltima && !completo && vacuna.intervalo_dias_recom_dosis
    ? addDays(fecha, vacuna.intervalo_dias_recom_dosis) : "";
  const proxima = esUltima || completo ? "" : proximaManual ?? sugerida;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!paciente || !vacuna) return;
    setSaving(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/vacunacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: paciente.id, vacuna_id: vacuna.id, fecha_aplicacion: fecha,
        fecha_proxima_dosis: proxima || null, canal,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setError(json.error ?? "No se pudo registrar");

    setOk(
      `${vacuna.nombre} · dosis ${json.numero_dosis} de ${json.dosis_totales} registrada para ${paciente.nombre_completo}. ` +
      (json.fecha_proxima_dosis
        ? `Próxima dosis: ${formatDay(json.fecha_proxima_dosis)} (recordatorio el ${formatDay(json.recordatorio_para)}).`
        : "Esquema completo.")
    );
    setVacunaId("");
    setProximaManual(null);
    loadHistorial(paciente.id);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={submit} className="card space-y-5 p-6 lg:col-span-3">
        <div className="relative space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Paciente *</span>
          {paciente ? (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
              <Avatar name={paciente.nombre_completo} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{paciente.nombre_completo}</div>
                <div className="text-xs text-slate-500">Doc. {paciente.documento_identidad}</div>
              </div>
              <button type="button" onClick={() => { setPaciente(null); setVacunaId(""); setOk(null); }}
                className="text-sm text-brand-700 hover:underline">Cambiar</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                  placeholder="Buscar por nombre o documento" className={`${inputCls} pl-10`} />
              </div>
              {open && (
                <div className="card absolute z-20 mt-1 max-h-72 w-full overflow-y-auto py-1">
                  {matches.map((p) => (
                    <button type="button" key={p.id} onClick={() => { setPaciente(p); setOpen(false); setQuery(""); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50">
                      <Avatar size="sm" name={p.nombre_completo} />
                      <span className="flex-1 truncate text-sm">{p.nombre_completo}</span>
                      <span className="text-xs text-slate-400">{p.documento_identidad}</span>
                    </button>
                  ))}
                  {matches.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Sin resultados. Crea el paciente en la sección Pacientes.</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Vacuna aplicada *</span>
            <select required value={vacunaId} onChange={(e) => { setVacunaId(e.target.value); setProximaManual(null); }} className={inputCls}>
              <option value="">Selecciona…</option>
              {vacunas.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Fecha de aplicación *</span>
            <input required type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setProximaManual(null); }} className={inputCls} />
          </label>
        </div>

        {vacuna && paciente && (
          completo ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              Este paciente ya completó el esquema de {vacuna.nombre} ({vacuna.dosis_totales} dosis).
            </p>
          ) : (
            <div className="space-y-4 rounded-lg bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Syringe size={16} className="text-brand-600" />
                Se registrará la <strong>dosis {numeroDosis} de {vacuna.dosis_totales}</strong>
                {esUltima && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Última dosis</span>}
              </div>
              {!esUltima && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Próxima dosis</span>
                    <input type="date" value={proxima} onChange={(e) => setProximaManual(e.target.value)} className={inputCls} />
                    {vacuna.intervalo_dias_recom_dosis && (
                      <span className="text-xs text-slate-400">Sugerida: cada {vacuna.intervalo_dias_recom_dosis} días (editable)</span>
                    )}
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Enviar recordatorio por</span>
                    <select value={canal} onChange={(e) => setCanal(e.target.value as CanalEnvio)} className={inputCls}>
                      {CANALES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {proxima && !esUltima && (
                <p className="flex items-center gap-2 text-sm text-brand-700">
                  <BellRing size={16} /> Se avisará al paciente el <strong>{formatDay(addDays(proxima, -1))}</strong>, un día antes de su cita.
                </p>
              )}
            </div>
          )
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        {ok && (
          <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {ok}
          </p>
        )}

        <button disabled={!paciente || !vacuna || completo || saving} className="btn-primary w-full justify-center py-3">
          <Syringe size={16} /> {saving ? "Registrando…" : "Registrar vacunación"}
        </button>
      </form>

      <div className="space-y-6 lg:col-span-2">
        {paciente && (
          <section className="card">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Historial del paciente</h2>
            <ul className="divide-y divide-slate-100">
              {historial.map((h) => (
                <li key={h.id} className="px-5 py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{h.vacuna.nombre}</span>
                    <span className="text-slate-500">dosis {h.numero_dosis}/{h.vacuna.dosis_totales}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Aplicada {formatDay(h.fecha_aplicacion)}{h.fecha_proxima_dosis && ` · próxima ${formatDay(h.fecha_proxima_dosis)}`}
                  </div>
                </li>
              ))}
              {historial.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">Sin vacunas registradas</li>}
            </ul>
          </section>
        )}

        <section className="card">
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Últimas vacunaciones</h2>
          <ul className="divide-y divide-slate-100">
            {recientes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar size="sm" name={r.paciente.nombre_completo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.paciente.nombre_completo}</div>
                  <div className="truncate text-xs text-slate-500">{r.vacuna.nombre} · dosis {r.numero_dosis}/{r.vacuna.dosis_totales}</div>
                </div>
                <div className="text-right text-xs text-slate-500">{formatDay(r.fecha_aplicacion)}</div>
              </li>
            ))}
            {recientes.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">Aún no hay registros</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
