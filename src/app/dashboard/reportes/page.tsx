import Link from "next/link";
import { CalendarCheck, Download, ShieldCheck, Syringe, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePerfilPage } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import { tomorrowISO } from "@/lib/reminders";
import { Avatar, formatDay, PageHeader } from "@/components/ui";
import type { Paciente, Perfil } from "@/types/db";

export const dynamic = "force-dynamic";

interface Cita {
  paciente_id: string; vacuna_id: string; numero_dosis: number; fecha_aplicacion: string;
  fecha_proxima_dosis: string | null; aplicada_por: string | null;
  vacuna: { nombre: string; dosis_totales: number };
}

const RANGOS = [
  { dias: 7, label: "7 días" }, { dias: 30, label: "30 días" }, { dias: 90, label: "90 días" },
  { dias: 365, label: "1 año" }, { dias: 0, label: "Todo" },
];
const DAY = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function Bars({ data, empty }: { data: [string, number][]; empty: string }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  if (data.length === 0) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-3">
      {data.map(([label, n]) => (
        <li key={label}>
          <div className="mb-1 flex justify-between text-sm"><span className="truncate">{label}</span><span className="font-medium tabular-nums">{n}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: { dias?: string } }) {
  await requirePerfilPage(["ADMIN"]);
  const db = createClient();
  const dias = RANGOS.some((r) => String(r.dias) === searchParams.dias) ? Number(searchParams.dias) : 30;
  const hoy = addDays(tomorrowISO(), -1);
  const desde = dias === 0 ? "0000-01-01" : addDays(hoy, -dias + 1);

  const [citas, perfiles] = await Promise.all([
    fetchAll<Cita>((f, t) => db.from("citas_vacunacion")
      .select("paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, aplicada_por, vacuna:vacunas!inner(nombre, dosis_totales)")
      .neq("estado", "CANCELADA").order("fecha_aplicacion", { ascending: false }).order("id").range(f, t).returns<Cita[]>()),
    fetchAll<Perfil>((f, t) => db.from("perfiles").select("*").order("user_id").range(f, t).returns<Perfil[]>()),
  ]);

  const recCount = (estado: string) =>
    db.from("recordatorios").select("id", { count: "exact", head: true }).eq("estado_envio", estado).gte("fecha_programada", desde);
  const [env, fail, pend] = await Promise.all([recCount("ENVIADO"), recCount("FALLIDO"), recCount("PENDIENTE")]);

  const enRango = citas.filter((c) => c.fecha_aplicacion >= desde);
  const tally = (key: (c: Cita) => string) => {
    const m = new Map<string, number>();
    enRango.forEach((c) => m.set(key(c), (m.get(key(c)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const nombreDe = new Map(perfiles.map((p) => [p.user_id, p.nombre]));
  const porVacuna = tally((c) => c.vacuna.nombre);
  const porVacunador = tally((c) => (c.aplicada_por ? nombreDe.get(c.aplicada_por) ?? "Usuario eliminado" : "Sin asignar"));
  const pacientesAtendidos = new Set(enRango.map((c) => c.paciente_id)).size;
  const esquemasCompletos = enRango.filter((c) => c.numero_dosis >= c.vacuna.dosis_totales).length;

  // Últimos 14 días
  const dias14 = Array.from({ length: 14 }, (_, i) => addDays(hoy, i - 13));
  const porDia = dias14.map((d) => [d, citas.filter((c) => c.fecha_aplicacion === d).length] as const);
  const maxDia = Math.max(1, ...porDia.map(([, n]) => n));

  // Pacientes con la próxima dosis vencida y sin retornar (oportunidad de recontactar)
  const ultima = new Map<string, Cita>();
  citas.forEach((c) => {
    const k = `${c.paciente_id}|${c.vacuna_id}`;
    const prev = ultima.get(k);
    if (!prev || c.numero_dosis > prev.numero_dosis) ultima.set(k, c);
  });
  const vencidas = [...ultima.values()]
    .filter((c) => c.fecha_proxima_dosis && c.fecha_proxima_dosis < hoy && c.numero_dosis < c.vacuna.dosis_totales)
    .sort((a, b) => (b.fecha_proxima_dosis! > a.fecha_proxima_dosis! ? 1 : -1));
  const top = vencidas.slice(0, 10);
  const { data: pacTop } = top.length
    ? await db.from("pacientes").select("id, nombre_completo, telefono").in("id", top.map((c) => c.paciente_id)).returns<Pick<Paciente, "id" | "nombre_completo" | "telefono">[]>()
    : { data: [] as Pick<Paciente, "id" | "nombre_completo" | "telefono">[] };
  const pacById = new Map((pacTop ?? []).map((p) => [p.id, p]));

  const kpis = [
    { label: "Dosis aplicadas", value: enRango.length, icon: Syringe },
    { label: "Pacientes atendidos", value: pacientesAtendidos, icon: UserCheck },
    { label: "Esquemas completados", value: esquemasCompletos, icon: CalendarCheck },
    { label: "Dosis vencidas sin retorno", value: vencidas.length, icon: ShieldCheck },
  ];

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Control de vacunas aplicadas, desempeño por vacunador y pacientes por recuperar"
        action={
          <a href="/api/exportar" className="btn-primary"><Download size={16} /> Exportar todos los datos</a>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGOS.map((r) => (
          <Link key={r.dias} href={`/dashboard/reportes?dias=${r.dias}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium ring-1 ring-inset transition ${
              r.dias === dias ? "bg-teal-600 text-white ring-teal-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}>
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={22} /></div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Dosis por vacuna</h2>
          <Bars data={porVacuna} empty="Sin vacunaciones en este periodo" />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Dosis por vacunador</h2>
          <Bars data={porVacunador} empty="Sin vacunaciones en este periodo" />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Últimos 14 días</h2>
          <div className="flex h-36 items-end gap-1.5">
            {porDia.map(([d, n]) => (
              <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${formatDay(d)}: ${n}`}>
                <span className="text-[10px] tabular-nums text-slate-500">{n || ""}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-teal-500 to-emerald-400" style={{ height: `${Math.max(n ? 6 : 2, (n / maxDia) * 100)}%`, opacity: n ? 1 : 0.25 }} />
                <span className="text-[10px] text-slate-400">{d.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Recordatorios del periodo</h2>
          <Bars data={[["Enviados", env.count ?? 0], ["Pendientes", pend.count ?? 0], ["Fallidos", fail.count ?? 0]]} empty="" />
        </section>
      </div>

      <section className="card mt-6">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Pacientes que no regresaron por su siguiente dosis</h2>
          <p className="text-xs text-slate-500">Dosis vencidas sin aplicar: buenos candidatos para volver a contactar ({vencidas.length} en total, se muestran las 10 más recientes)</p>
        </header>
        <ul className="divide-y divide-slate-100">
          {top.map((c) => {
            const p = pacById.get(c.paciente_id);
            const atraso = Math.round((Date.parse(hoy) - Date.parse(c.fecha_proxima_dosis!)) / DAY);
            return (
              <li key={`${c.paciente_id}${c.vacuna_id}`} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={p?.nombre_completo ?? "?"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p?.nombre_completo ?? "—"}</div>
                  <div className="truncate text-xs text-slate-500">{c.vacuna.nombre} · le falta la dosis {c.numero_dosis + 1} de {c.vacuna.dosis_totales} · {p?.telefono}</div>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">hace {atraso} d</span>
              </li>
            );
          })}
          {top.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-400">No hay dosis vencidas pendientes</li>}
        </ul>
      </section>
    </div>
  );
}
