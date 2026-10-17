import Link from "next/link";
import { Bot, ChevronRight, EyeOff, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePerfilPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import {
  ACCIONES, POR_PAGINA, TABLAS, cambios, etiquetaAccion, etiquetaTabla, fechaHora, finDia, inicioDia, leerFiltros,
  type RegistroAuditoria,
} from "@/lib/auditoria";

export const dynamic = "force-dynamic";

const ICONO = { CREAR: Plus, MODIFICAR: Pencil, ELIMINAR: Trash2, ANONIMIZAR: EyeOff } as const;
const COLOR = {
  CREAR: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  MODIFICAR: "bg-amber-50 text-amber-700 ring-amber-600/20",
  ELIMINAR: "bg-red-50 text-red-700 ring-red-600/20",
  ANONIMIZAR: "bg-violet-50 text-violet-700 ring-violet-600/20",
} as const;

export default async function AuditoriaPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePerfilPage(["ADMIN"]);
  const f = leerFiltros(await props.searchParams);
  const db = await createClient();

  let q = db.from("auditoria").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (f.tabla) q = q.eq("tabla", f.tabla);
  if (f.accion) q = q.eq("accion", f.accion);
  if (f.usuario === "sistema") q = q.eq("origen", "SISTEMA");
  else if (f.usuario) q = q.eq("usuario_id", f.usuario);
  if (f.desde) q = q.gte("created_at", inicioDia(f.desde));
  if (f.hasta) q = q.lte("created_at", finDia(f.hasta));
  if (f.q) q = q.ilike("resumen", `%${f.q}%`);
  const desdeFila = (f.pagina - 1) * POR_PAGINA;

  const [{ data, count, error }, { data: usuarios }] = await Promise.all([
    q.range(desdeFila, desdeFila + POR_PAGINA - 1).returns<RegistroAuditoria[]>(),
    db.from("perfiles").select("user_id, nombre").order("nombre"),
  ]);

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlace = (pagina: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tabla: f.tabla, accion: f.accion, usuario: f.usuario, desde: f.desde, hasta: f.hasta, q: f.q })) if (v) p.set(k, v);
    if (pagina > 1) p.set("p", String(pagina));
    const query = p.toString();
    return `/dashboard/auditoria${query ? `?${query}` : ""}`;
  };
  const hayFiltros = !!(f.tabla || f.accion || f.usuario || f.desde || f.hasta || f.q);

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Quién creó, modificó o eliminó vacunaciones, pacientes y vacunas. El registro no se puede editar ni borrar." />

      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-medium text-slate-500">Buscar (paciente, vacuna…)</span>
          <input name="q" defaultValue={f.q} className="input" placeholder="Ej: María Pérez" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Qué</span>
          <select name="tabla" defaultValue={f.tabla ?? ""} className="input">
            <option value="">Todo</option>
            {TABLAS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Acción</span>
          <select name="accion" defaultValue={f.accion ?? ""} className="input">
            <option value="">Todas</option>
            {ACCIONES.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Quién</span>
          <select name="usuario" defaultValue={f.usuario ?? ""} className="input">
            <option value="">Todos</option>
            <option value="sistema">Procesos automáticos</option>
            {(usuarios ?? []).map((u) => <option key={u.user_id} value={u.user_id}>{u.nombre}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Desde</span>
            <input type="date" name="desde" defaultValue={f.desde} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Hasta</span>
            <input type="date" name="hasta" defaultValue={f.hasta} className="input" />
          </label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button className="btn-primary">Filtrar</button>
          {hayFiltros && <Link href="/dashboard/auditoria" className="btn-secondary">Quitar filtros</Link>}
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          No se pudo cargar la auditoría. Si es la primera vez, ejecuta <code>supabase/auditoria.sql</code> en Supabase.
        </p>
      )}

      <div className="card overflow-hidden">
        {(data ?? []).length === 0 && !error ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            {hayFiltros ? "No hay registros con esos filtros." : "Todavía no hay registros. Aparecerán a medida que se registren cambios."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(data ?? []).map((r) => {
              const Icono = ICONO[r.accion];
              const filas = cambios(r);
              return (
                <li key={r.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${COLOR[r.accion]}`}>
                        <Icono size={12} /> {etiquetaAccion(r.accion)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.resumen ?? etiquetaTabla(r.tabla)}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {etiquetaTabla(r.tabla)} · {r.origen === "SISTEMA" && !r.usuario_nombre
                            ? <span className="inline-flex items-center gap-1"><Bot size={12} /> Proceso automático</span>
                            : <>{r.usuario_nombre ?? "Usuario eliminado"}{r.origen === "SISTEMA" && " (carga automática)"}</>}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 sm:block">{fechaHora(r.created_at)}</span>
                      <ChevronRight size={16} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
                    </summary>
                    <div className="space-y-2 bg-slate-50 px-5 py-4">
                      <p className="text-xs tabular-nums text-slate-500 sm:hidden">{fechaHora(r.created_at)}</p>
                      {filas.length === 0 && <p className="text-sm text-slate-500">Sin detalle de campos: por privacidad no se conservan los datos personales de este registro.</p>}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500">
                              <th className="py-1 pr-4 font-medium">Campo</th>
                              {r.antes && <th className="py-1 pr-4 font-medium">{r.accion === "ELIMINAR" ? "Valor eliminado" : "Antes"}</th>}
                              {r.despues && <th className="py-1 font-medium">{r.accion === "CREAR" ? "Valor registrado" : "Después"}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map((c) => (
                              <tr key={c.campo} className="border-t border-slate-200/70">
                                <td className="py-1.5 pr-4 text-slate-600">{c.campo}</td>
                                {c.antes !== null && <td className="py-1.5 pr-4 text-slate-500 line-through decoration-slate-300">{c.antes}</td>}
                                {c.despues !== null && <td className="py-1.5 font-medium">{c.despues}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <span>{total} registros</span>
          <div className="flex items-center gap-2">
            {f.pagina > 1
              ? <Link href={enlace(f.pagina - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Anterior</Link>
              : <span className="rounded-lg border border-slate-200 px-3 py-1.5 opacity-40">Anterior</span>}
            <span className="tabular-nums">{f.pagina} / {paginas}</span>
            {f.pagina < paginas
              ? <Link href={enlace(f.pagina + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Siguiente</Link>
              : <span className="rounded-lg border border-slate-200 px-3 py-1.5 opacity-40">Siguiente</span>}
          </div>
        </footer>
      </div>
    </>
  );
}
