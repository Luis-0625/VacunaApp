"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CircleCheck, CirclePause, MessageCircle, Plus, Syringe, Users } from "lucide-react";
import Modal from "@/components/Modal";
import SelectorTema from "@/components/SelectorTema";
import { LogoEstablecimiento } from "@/components/ui";

export interface CentroResumen {
  id: string;
  nombre: string;
  ciudad: string | null;
  activo: boolean;
  whatsapp_from: string | null;
  created_at: string;
  usuarios: number;
  pacientes: number;
  dosis30: number;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });

/** Panel del superadministrador: centros clientes, alta de centros, suspensión y número de WhatsApp. */
export default function PlataformaManager({ centros, tieneCentro }: { centros: CentroResumen[]; tieneCentro: boolean }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(false);
  const [suspender, setSuspender] = useState<CentroResumen | null>(null);
  const [whatsapp, setWhatsapp] = useState<CentroResumen | null>(null);

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

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Centro</th><th className="th">Usuarios</th><th className="th">Pacientes</th>
                <th className="th">Dosis 30 días</th><th className="th">WhatsApp</th><th className="th">Estado</th><th className="th" />
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
                <tr><td colSpan={7} className="py-14 text-center text-slate-400">Aún no hay centros. Crea el primero.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {nuevo && <NuevoCentro onClose={(creado) => { setNuevo(false); if (creado) router.refresh(); }} />}
      {suspender && <CambiarEstado centro={suspender} onClose={(ok) => { setSuspender(null); if (ok) router.refresh(); }} />}
      {whatsapp && <NumeroWhatsApp centro={whatsapp} onClose={(ok) => { setWhatsapp(null); if (ok) router.refresh(); }} />}
    </div>
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
