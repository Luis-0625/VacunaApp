"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarCog, Check, ImageUp, Palette, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  COLORES_MARCA, DIAS_SEMANA, datosContacto, temaMarca, type ColorMarca, type Establecimiento,
} from "@/lib/establecimiento";
import { LogoEstablecimiento } from "@/components/ui";

type Form = Omit<Establecimiento, "cupos_por_dia"> & { cupos_por_dia: string };

const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"];

function Seccion({ icon: Icon, titulo, descripcion, children }: {
  icon: typeof Building2; titulo: string; descripcion: string; children: React.ReactNode;
}) {
  return (
    <section className="card">
      <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-4">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon size={16} /></span>
        <div>
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-500">{descripcion}</p>
        </div>
      </header>
      <div className="space-y-4 p-6">{children}</div>
    </section>
  );
}

function Campo({ label, children, ayuda }: { label: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

export default function EstablecimientoForm({ inicial }: { inicial: Establecimiento }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Form>({ ...inicial, cupos_por_dia: String(inicial.cupos_por_dia) });
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setGuardado(false);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };
  const texto = (k: keyof Form) => (f[k] as string | null) ?? "";

  function toggleDia(n: number) {
    setGuardado(false);
    setF((x) => ({
      ...x,
      dias_atencion: x.dias_atencion.includes(n) ? x.dias_atencion.filter((d) => d !== n) : [...x.dias_atencion, n],
    }));
  }

  async function subirLogo(file: File) {
    setError(null);
    if (!TIPOS_LOGO.includes(file.type)) return setError("El logo debe ser una imagen PNG, JPG o WEBP");
    if (file.size > 2 * 1024 * 1024) return setError("El logo no puede pesar más de 2 MB");
    setSubiendo(true);
    const supabase = createClient();
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${inicial.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("marca").upload(path, file, { cacheControl: "31536000" });
    setSubiendo(false);
    if (error) return setError(`No se pudo subir el logo: ${error.message}`);
    setGuardado(false);
    setF((x) => ({ ...x, logo_url: supabase.storage.from("marca").getPublicUrl(path).data.publicUrl }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/establecimiento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, cupos_por_dia: Number(f.cupos_por_dia || 0) }),
    });
    setSaving(false);
    if (!res.ok) return setError((await res.json()).error ?? "No se pudo guardar");
    setGuardado(true);
    router.refresh(); // aplica nombre, logo y color en toda la app
  }

  const preview: Establecimiento = { ...f, cupos_por_dia: Number(f.cupos_por_dia || 0) };
  const contacto = datosContacto(preview);

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Seccion icon={Building2} titulo="Datos generales" descripcion="Identificación y contacto del centro.">
          <Campo label="Nombre del establecimiento *">
            <input required maxLength={120} value={f.nombre} onChange={set("nombre")} className="input" placeholder="IPS Vacunar Salud" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="NIT"><input value={texto("nit")} onChange={set("nit")} className="input" placeholder="900.123.456-7" /></Campo>
            <Campo label="Teléfono"><input value={texto("telefono")} onChange={set("telefono")} className="input" placeholder="604 123 4567" /></Campo>
            <Campo label="Email"><input type="email" value={texto("email")} onChange={set("email")} className="input" placeholder="contacto@centro.com" /></Campo>
            <Campo label="Sitio web"><input value={texto("sitio_web")} onChange={set("sitio_web")} className="input" placeholder="www.centro.com" /></Campo>
            <Campo label="Dirección"><input value={texto("direccion")} onChange={set("direccion")} className="input" placeholder="Calle 10 # 5-20" /></Campo>
            <Campo label="Ciudad"><input value={texto("ciudad")} onChange={set("ciudad")} className="input" placeholder="Montería, Córdoba" /></Campo>
          </div>
        </Seccion>

        <Seccion icon={CalendarCog} titulo="Horario y agenda"
          descripcion="Define qué fechas se ofrecen cuando un paciente reprograma por WhatsApp.">
          <Campo label="Horario de atención" ayuda="Se incluye en los mensajes al paciente.">
            <input value={texto("horario")} onChange={set("horario")} className="input" placeholder="Lunes a sábado, 7:00 a. m. – 5:00 p. m." />
          </Campo>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Días de atención</span>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => {
                const on = f.dias_atencion.includes(d.n);
                return (
                  <button type="button" key={d.n} onClick={() => toggleDia(d.n)} aria-pressed={on}
                    className={`w-14 rounded-lg border py-2 text-sm font-medium transition ${
                      on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-surface text-slate-600 hover:bg-slate-50"
                    }`}>
                    {d.corto}
                  </button>
                );
              })}
            </div>
          </div>
          <Campo label="Cupos por día" ayuda="Máximo de citas por día al reprogramar. 0 = sin límite.">
            <input type="number" min={0} value={f.cupos_por_dia} onChange={set("cupos_por_dia")} className="input max-w-[160px]" />
          </Campo>
        </Seccion>

        <Seccion icon={Palette} titulo="Marca" descripcion="Logo y color con los que se presenta el sistema.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <LogoEstablecimiento logoUrl={f.logo_url} nombre={f.nombre || "?"} size={64} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo} className="btn-secondary">
                  <ImageUp size={16} /> {subiendo ? "Subiendo…" : f.logo_url ? "Cambiar logo" : "Subir logo"}
                </button>
                {f.logo_url && (
                  <button type="button" onClick={() => { setGuardado(false); setF((x) => ({ ...x, logo_url: null })); }}
                    className="btn-secondary text-red-600 hover:bg-red-50">
                    <Trash2 size={16} /> Quitar
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">PNG, JPG o WEBP, máximo 2 MB. Ideal: cuadrado y con fondo transparente.</p>
              <input ref={fileRef} type="file" accept={TIPOS_LOGO.join(",")} className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) subirLogo(file); e.target.value = ""; }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Color de marca</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COLORES_MARCA.map((c) => {
                const on = f.color === c.id;
                return (
                  <button type="button" key={c.id} onClick={() => { setGuardado(false); setF((x) => ({ ...x, color: c.id as ColorMarca })); }}
                    aria-pressed={on}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      on ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-300 hover:bg-slate-50"
                    }`}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ background: c.muestra }}>
                      {on && <Check size={12} strokeWidth={3} />}
                    </span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Seccion>
      </div>

      {/* Vista previa con el color elegido (sin aplicarlo aún al resto de la app) */}
      <aside data-marca className="space-y-4 lg:sticky lg:top-8 lg:self-start" style={temaMarca(f.color) as React.CSSProperties}>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Vista previa</div>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <LogoEstablecimiento logoUrl={f.logo_url} nombre={f.nombre || "?"} size={40} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{f.nombre || "Nombre del centro"}</div>
                <div className="truncate text-xs text-slate-500">{f.ciudad || "Centro de vacunación"}</div>
              </div>
            </div>
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">Elemento seleccionado</div>
            <span className="btn-primary pointer-events-none">Botón principal</span>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Respuesta por WhatsApp</div>
          <div className="bg-[#efeae2] p-4 dark:bg-[#0b141a]">
            <div className="max-w-[95%] whitespace-pre-line rounded-lg rounded-tl-none bg-surface px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm">
              {`¡Gracias, María! ✅ Tu cita del jueves 15 de octubre quedó CONFIRMADA para: Hepatitis B (dosis 2). Te esperamos.`}
              {contacto && `\n\n${contacto}`}
              {`\n\n— ${f.nombre || "Nombre del centro"}`}
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        {guardado && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            <Check size={16} /> Cambios guardados
          </p>
        )}
        <button disabled={saving || subiendo} className="btn-primary w-full justify-center">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </aside>
    </form>
  );
}
