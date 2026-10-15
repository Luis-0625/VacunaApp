import Link from "next/link";
import { CalendarClock, MailCheck, Package, Syringe, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { tomorrowISO } from "@/lib/reminders";
import { calcularAlertasInventario } from "@/lib/inventario-alertas";
import { Avatar, ConfirmacionBadge, formatDay, PageHeader, StatusBadge, STATUS_STYLES } from "@/components/ui";
import type { Confirmacion, EstadoEnvio } from "@/types/db";

export const dynamic = "force-dynamic";

interface ProximaCita {
  id: string;
  numero_dosis: number;
  fecha_proxima_dosis: string;
  paciente: { nombre_completo: string; telefono: string };
  vacuna: { nombre: string };
  recordatorio: { confirmacion: Confirmacion | null; reprogramaciones: number } | null;
}
interface UltimoEnvio {
  id: string;
  estado_envio: EstadoEnvio;
  fecha_programada: string;
  cita: { paciente: { nombre_completo: string }; vacuna: { nombre: string } };
}

export default async function DashboardPage() {
  const db = await createClient();
  const manana = tomorrowISO();
  const hoy = new Date(Date.parse(`${manana}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const en7 = new Date(Date.parse(`${hoy}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const count = (estado: EstadoEnvio) =>
    db.from("recordatorios").select("id", { count: "exact", head: true }).eq("estado_envio", estado);

  const [citasManana, pacientes, pend, env, fail, proximas, ultimos] = await Promise.all([
    db.from("citas_vacunacion").select("id", { count: "exact", head: true })
      .eq("fecha_proxima_dosis", manana).neq("estado", "CANCELADA"),
    db.from("pacientes").select("id", { count: "exact", head: true }),
    count("PENDIENTE"), count("ENVIADO"), count("FALLIDO"),
    db.from("citas_vacunacion")
      .select("id, numero_dosis, fecha_proxima_dosis, paciente:pacientes!inner(nombre_completo, telefono), vacuna:vacunas!inner(nombre), recordatorio:recordatorios(confirmacion, reprogramaciones)")
      .gte("fecha_proxima_dosis", hoy).lte("fecha_proxima_dosis", en7).neq("estado", "CANCELADA")
      .order("fecha_proxima_dosis").limit(8).returns<ProximaCita[]>(),
    db.from("recordatorios")
      .select("id, estado_envio, fecha_programada, cita:citas_vacunacion!inner(paciente:pacientes!inner(nombre_completo), vacuna:vacunas!inner(nombre))")
      .neq("estado_envio", "PENDIENTE").order("fecha_programada", { ascending: false }).limit(6)
      .returns<UltimoEnvio[]>(),
  ]);

  // Alertas de inventario: lotes vencidos con dosis, por vencer y vacunas con pocas unidades
  const alertas = await calcularAlertasInventario(db, hoy).catch(() => null);

  const nPend = pend.count ?? 0, nEnv = env.count ?? 0, nFail = fail.count ?? 0;
  const total = nPend + nEnv + nFail;
  const pct = nEnv + nFail > 0 ? Math.round((nEnv / (nEnv + nFail)) * 100) : null;

  const kpis = [
    { label: "Citas de mañana", value: citasManana.count ?? 0, icon: CalendarClock, tone: "bg-brand-50 text-brand-600" },
    { label: "Total de pacientes", value: pacientes.count ?? 0, icon: Users, tone: "bg-sky-50 text-sky-600" },
    { label: "Recordatorios entregados", value: pct === null ? "—" : `${pct}%`, icon: MailCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Pendientes de envío", value: nPend, icon: Syringe, tone: "bg-amber-50 text-amber-600" },
  ];

  const segments: { estado: EstadoEnvio; n: number }[] = [
    { estado: "ENVIADO", n: nEnv }, { estado: "PENDIENTE", n: nPend }, { estado: "FALLIDO", n: nFail },
  ];

  return (
    <div>
      <PageHeader title="Resumen" subtitle="Actividad del centro de vacunación y estado de los recordatorios" />

      {alertas && alertas.total > 0 && (
        <Link href="/dashboard/inventario"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100">
          <span className="flex items-center gap-2">
            <Package size={18} className="shrink-0" />
            Inventario: {[
              alertas.vencidos.length > 0 &&
                `${alertas.vencidos.length} ${alertas.vencidos.length === 1 ? "lote vencido" : "lotes vencidos"} con dosis`,
              alertas.porVencer.length > 0 && `${alertas.porVencer.length} por vencer en 30 días`,
              alertas.bajoMinimo.length > 0 &&
                `${alertas.bajoMinimo.length} ${alertas.bajoMinimo.length === 1 ? "vacuna" : "vacunas"} con pocas unidades`,
            ].filter(Boolean).join(" · ")}
          </span>
          <span className="font-medium">Revisar →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card flex items-center gap-4 p-5">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Próximas dosis (7 días)</h2>
            <span className="text-xs text-slate-400">{proximas.data?.length ?? 0} citas</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {(proximas.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={c.paciente.nombre_completo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.paciente.nombre_completo}</div>
                  <div className="truncate text-xs text-slate-500">{c.vacuna.nombre} · dosis {c.numero_dosis + 1}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatDay(c.fecha_proxima_dosis)}</div>
                  {c.fecha_proxima_dosis === manana && (
                    <span className="text-xs font-medium text-brand-600">Mañana</span>
                  )}
                </div>
                {(c.recordatorio?.confirmacion || (c.recordatorio?.reprogramaciones ?? 0) > 0) && (
                  <ConfirmacionBadge confirmacion={c.recordatorio!.confirmacion ?? "REPROGRAMADA"} />
                )}
              </li>
            ))}
            {(proximas.data ?? []).length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-400">No hay dosis programadas esta semana</li>
            )}
          </ul>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Estado de recordatorios</h2>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {total > 0 && segments.map((s) => (
                <div key={s.estado} className={STATUS_STYLES[s.estado].dot} style={{ width: `${(s.n / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5">
              {segments.map((s) => (
                <li key={s.estado} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[s.estado].dot}`} />
                    {STATUS_STYLES[s.estado].label}
                  </span>
                  <span className="font-medium tabular-nums">{s.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Últimos envíos</h2>
            <ul className="divide-y divide-slate-100">
              {(ultimos.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.cita.paciente.nombre_completo}</div>
                    <div className="truncate text-xs text-slate-500">{r.cita.vacuna.nombre} · {formatDay(r.fecha_programada)}</div>
                  </div>
                  <StatusBadge estado={r.estado_envio} />
                </li>
              ))}
              {(ultimos.data ?? []).length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Aún no hay envíos</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
