"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CircleCheck, CirclePause, LogOut, MessageCircle, Plus, Syringe, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import SelectorTema from "@/components/SelectorTema";
import { LogoEstablecimiento } from "@/components/ui";
import { addDaysISO, formatFechaLarga } from "@/lib/agenda";
import { NOMBRE_PLAN, estadoSuscripcion, type Plan } from "@/lib/suscripcion";

/** Pago hecho con el link fijo de Mercado Pago, esperando que el superadmin lo confirme. */
export interface PagoPorConfirmar {
  id: string;
  centro_id: string;
  centro: string;
  plan: Exclude<Plan, "PRUEBA">;
  meses: number;
  monto: number;
  created_at: string;
}

export interface CentroResumen {
  id: string;
  nombre: string;
  ciudad: string | null;
  activo: boolean;
  whatsapp_from: string | null;
  plan: Plan;
  suscripcion_vence: string | null;
  created_at: string;
  usuarios: number;
  pacientes: number;
  dosis30: number;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });

/** Panel del superadministrador: centros clientes, alta de centros, suspensión y número de WhatsApp. */
export default function PlataformaManager({ centros, pagos, tieneCentro, hoy }: {
  centros: CentroResumen[]; pagos: PagoPorConfirmar[]; tieneCentro: boolean; hoy: string;
}) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(false);
  const [suspender, setSuspender] = useState<CentroResumen | null>(null);
  const [whatsapp, setWhatsapp] = useState<CentroResumen | null>(null);
  const [suscripcion, setSuscripcion] = useState<CentroResumen | null>(null);

  async function cerrarSesion() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const activos = centros.filter((c) => c.activo);
  const kpis = [
    { label: "Centros activos", value: `${activos.length} / ${centros.length}`, icon: Building2 },
    { label: "Pacientes en la plataforma", value: centros.reduce((n, c) => n + c.pacientes, 0), icon: Users },
    { label: "Dosis aplicadas (30 días)", value: centros.reduce((n, c) => n + c.dosis30, 0), icon: Syringe },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <LogoEstablecimiento logoUrl={null} nombre="Vacuna App" size={36} />
            <div>
              <div className="font-semibold leading-tight">VacunaApp · Plataforma</div>
              <div className="text-xs text-slate-500">Administración de centros clientes</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tieneCentro && (
              <Link href="/dashboard" className="btn-secondary py-2"><ArrowLeft size={16} /> Mi centro</Link>
            )}
            <SelectorTema compacto />
            <button onClick={cerrarSesion} className="btn-secondary py-2">
              <LogOut size={16} /> <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Centros de vacunación</h1>
            <p className="mt-1 text-sm text-slate-500">Cada centro ve solo sus datos y administra sus propios usuarios.</p>
          </div>
          <button onClick={() => setNuevo(true)} className="btn-primary"><Plus size={16} /> Nuevo centro</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map(({ label, value, icon: Icon }) => (
            <div key={label} className="card flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon size={22} /></div>
              <div>
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {pagos.length > 0 && <PagosPorConfirmar pagos={pagos} onCambio={() => router.refresh()} />}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Centro</th><th className="th">Usuarios</th><th className="th">Pacientes</th>
                <th className="th">Dosis 30 días</th><th className="th">Suscripción</th><th className="th">WhatsApp</th><th className="th">Estado</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {centros.map((c) => (
                <tr key={c.id} className={c.activo ? "" : "bg-slate-50/60"}>
                  <td className="td">
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs text-slate-500">{[c.ciudad, `desde ${fecha(c.created_at)}`].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="td tabular-nums">{c.usuarios}</td>
                  <td className="td tabular-nums">{c.pacientes}</td>
                  <td className="td tabular-nums">{c.dosis30}</td>
                  <td className="td">
                    <button onClick={() => setSuscripcion(c)} className="text-left hover:underline">
                      <div className="text-xs font-medium text-slate-700">{NOMBRE_PLAN[c.plan] ?? c.plan}</div>
                      <EstadoPlan vence={c.suscripcion_vence} hoy={hoy} />
                    </button>
                  </td>
                  <td className="td">
                    <button onClick={() => setWhatsapp(c)} className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline">
                      <MessageCircle size={13} /> {c.whatsapp_from?.replace("whatsapp:", "") ?? "Número de la plataforma"}
                    </button>
                  </td>
                  <td className="td">
                    {c.activo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <CircleCheck size={12} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        <CirclePause size={12} /> Suspendido
                      </span>
                    )}
                  </td>
                  <td className="td text-right">
                    <button onClick={() => setSuspender(c)}
                      className={`btn-secondary py-1.5 text-xs ${c.activo ? "text-red-600" : "text-emerald-700"}`}>
                      {c.activo ? "Suspender" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
              {centros.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-slate-400">Aún no hay centros. Crea el primero.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {nuevo && <NuevoCentro onClose={(creado) => { setNuevo(false); if (creado) router.refresh(); }} />}
      {suspender && <CambiarEstado centro={suspender} onClose={(ok) => { setSuspender(null); if (ok) router.refresh(); }} />}
      {whatsapp && <NumeroWhatsApp centro={whatsapp} onClose={(ok) => { setWhatsapp(null); if (ok) router.refresh(); }} />}
      {suscripcion && <EditarSuscripcion centro={suscripcion} hoy={hoy} onClose={(ok) => { setSuscripcion(null); if (ok) router.refresh(); }} />}
    </div>
  );
}

function EstadoPlan({ vence, hoy }: { vence: string | null; hoy: string }) {
  const s = estadoSuscripcion(vence, hoy);
  const [cls, texto] =
    s.estado === "VIGENTE" ? ["text-slate-500", vence ? `hasta ${formatFechaLarga(vence)}` : "sin vencimiento"]
    : s.estado === "POR_VENCER" ? ["text-amber-700", s.dias === 0 ? "vence hoy" : `vence en ${s.dias} d`]
    : s.estado === "GRACIA" ? ["text-red-600", "vencida · en gracia"]
    : ["text-red-600 font-medium", "vencida · bloqueada"];
  return <div className={`text-xs ${cls}`}>{texto}</div>;
}

/** Ajuste manual: pagos por transferencia, cortesías o correcciones. Los pagos con Mercado Pago son automáticos. */
function EditarSuscripcion({ centro, hoy, onClose }: { centro: CentroResumen; hoy: string; onClose: (ok: boolean) => void }) {
  const [plan, setPlan] = useState<Plan>(centro.plan);
  const [vence, setVence] = useState(centro.suscripcion_vence ?? hoy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suma meses desde el vencimiento actual, o desde hoy si ya venció
  const sumarMeses = (n: number) => {
    const base = new Date(`${vence > hoy ? vence : hoy}T12:00:00`);
    base.setMonth(base.getMonth() + n);
    setVence(base.toISOString().slice(0, 10));
  };

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await patchCentro(centro.id, { plan, suscripcion_vence: vence });
    setBusy(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={`Suscripción · ${centro.nombre}`} onClose={() => onClose(false)}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className="input">
              {(Object.keys(NOMBRE_PLAN) as Plan[]).map((p) => <option key={p} value={p}>{NOMBRE_PLAN[p]}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Pagado hasta (inclusive)</span>
            <input type="date" required value={vence} onChange={(e) => setVence(e.target.value)} className="input" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => sumarMeses(1)} className="btn-secondary py-1.5 text-xs">+1 mes</button>
          <button type="button" onClick={() => sumarMeses(12)} className="btn-secondary py-1.5 text-xs">+12 meses</button>
          <button type="button" onClick={() => setVence(addDaysISO(hoy, 6))} className="btn-secondary py-1.5 text-xs">Prueba de 6 días</button>
        </div>
        <p className="text-xs text-slate-500">
          Úsalo para pagos por transferencia o cortesías. Los pagos con Mercado Pago renuevan la suscripción solos.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
          <button disabled={busy} className="btn-primary">{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

async function patchCentro(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/plataforma/centros/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.ok ? null : ((await res.json()).error ?? "No se pudo actualizar");
}

function NuevoCentro({ onClose }: { onClose: (creado: boolean) => void }) {
  const [f, setF] = useState({ nombre: "", ciudad: "", admin_nombre: "", admin_email: "", admin_password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/plataforma/centros", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    setSaving(false);
    if (!res.ok) return setError((await res.json()).error ?? "No se pudo crear el centro");
    onClose(true);
  }

  return (
    <Modal title="Nuevo centro de vacunación" onClose={() => onClose(false)}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nombre del centro *</span>
            <input required value={f.nombre} onChange={set("nombre")} className="input" placeholder="IPS Vacunar Salud" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Ciudad</span>
            <input value={f.ciudad} onChange={set("ciudad")} className="input" placeholder="Montería" />
          </label>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-sm font-medium text-slate-700">Primer administrador del centro</div>
            <p className="text-xs text-slate-500">Con esta cuenta el centro entra al sistema y crea a sus vacunadores y demás administradores.</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nombre *</span>
            <input required value={f.admin_nombre} onChange={set("admin_nombre")} className="input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Email *</span>
              <input required type="email" value={f.admin_email} onChange={set("admin_email")} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Contraseña inicial *</span>
              <input required type="password" minLength={8} value={f.admin_password} onChange={set("admin_password")} className="input" />
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-500">El centro empieza con un catálogo básico de vacunas que puede editar.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
          <button disabled={saving} className="btn-primary">{saving ? "Creando…" : "Crear centro"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CambiarEstado({ centro, onClose }: { centro: CentroResumen; onClose: (ok: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspender = centro.activo;

  async function confirmar() {
    setBusy(true);
    const err = await patchCentro(centro.id, { activo: !suspender });
    setBusy(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={suspender ? "Suspender centro" : "Reactivar centro"} onClose={() => onClose(false)}>
      <p className="text-sm text-slate-600">
        {suspender
          ? <>Los usuarios de <strong>{centro.nombre}</strong> no podrán entrar y no se enviarán sus recordatorios. Sus datos se conservan.</>
          : <>Los usuarios de <strong>{centro.nombre}</strong> recuperarán el acceso y se reanudarán sus recordatorios.</>}
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
        <button onClick={confirmar} disabled={busy}
          className={suspender ? "rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50" : "btn-primary"}>
          {busy ? "Guardando…" : suspender ? "Suspender" : "Reactivar"}
        </button>
      </div>
    </Modal>
  );
}

function NumeroWhatsApp({ centro, onClose }: { centro: CentroResumen; onClose: (ok: boolean) => void }) {
  const [numero, setNumero] = useState(centro.whatsapp_from?.replace("whatsapp:", "") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await patchCentro(centro.id, { whatsapp_from: numero });
    setBusy(false);
    if (err) return setError(err);
    onClose(true);
  }

  return (
    <Modal title={`WhatsApp · ${centro.nombre}`} onClose={() => onClose(false)}>
      <form onSubmit={guardar} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Número propio de WhatsApp (en Twilio)</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} className="input" placeholder="+573001234567" />
          <span className="block text-xs text-slate-500">
            Déjalo vacío para usar el número de la plataforma. El número debe estar registrado en tu cuenta de Twilio
            con el webhook de VacunaApp configurado.
          </span>
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn-secondary">Cancelar</button>
          <button disabled={busy} className="btn-primary">{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Pagos con el link fijo de Mercado Pago: se confirman cuando el dinero aparece en la cuenta. */
function PagosPorConfirmar({ pagos, onCambio }: { pagos: PagoPorConfirmar[]; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accion(id: string, accion: "confirmar" | "descartar") {
    if (accion === "descartar" && !confirm("¿Descartar este pago? Úsalo solo si el dinero nunca llegó a Mercado Pago.")) return;
    setOcupado(id);
    setError(null);
    const res = await fetch(`/api/plataforma/pagos/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }),
    });
    setOcupado(null);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "No se pudo actualizar el pago");
    onCambio();
  }

  return (
    <section className="card overflow-x-auto ring-1 ring-amber-300">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Pagos por confirmar ({pagos.length})</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Centros que abrieron el link de pago de Mercado Pago. Confírmalos cuando veas el dinero en tu cuenta: la suscripción se renueva al instante.
        </p>
      </div>
      {error && <p className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <table className="w-full text-sm">
        <thead className="bg-slate-50/70">
          <tr><th className="th">Centro</th><th className="th">Plan</th><th className="th">Valor</th><th className="th">Iniciado</th><th className="th" /></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pagos.map((p) => (
            <tr key={p.id}>
              <td className="td font-medium">{p.centro}</td>
              <td className="td">{NOMBRE_PLAN[p.plan]} · {p.meses === 12 ? "12 meses" : "1 mes"}</td>
              <td className="td tabular-nums">${p.monto.toLocaleString("es-CO")}</td>
              <td className="td text-slate-500">{new Date(p.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="td">
                <div className="flex justify-end gap-2">
                  <button onClick={() => accion(p.id, "descartar")} disabled={!!ocupado} className="btn-secondary py-1.5 text-xs">Descartar</button>
                  <button onClick={() => accion(p.id, "confirmar")} disabled={!!ocupado} className="btn-primary py-1.5 text-xs">
                    {ocupado === p.id ? "Guardando…" : "Confirmar pago"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
