import type { Confirmacion, EstadoEnvio } from "@/types/db";

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const color = AVATAR_COLORS[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${dim} ${color}`}>
      {initials}
    </span>
  );
}

export const STATUS_STYLES: Record<EstadoEnvio, { badge: string; dot: string; label: string }> = {
  PENDIENTE: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500", label: "Pendiente" },
  ENVIADO: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500", label: "Enviado" },
  FALLIDO: { badge: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500", label: "Fallido" },
};

export function StatusBadge({ estado }: { estado: EstadoEnvio }) {
  const s = STATUS_STYLES[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const CONFIRMACION_STYLES: Record<Confirmacion | "SIN_RESPUESTA", { badge: string; label: string }> = {
  CONFIRMADA: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", label: "Confirmada" },
  REPROGRAMANDO: { badge: "bg-sky-50 text-sky-700 ring-sky-600/20", label: "Eligiendo fecha" },
  REPROGRAMADA: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", label: "Reprogramada" },
  SIN_RESPUESTA: { badge: "bg-slate-50 text-slate-500 ring-slate-500/20", label: "Sin respuesta" },
};

/** Respuesta del paciente por WhatsApp. */
export function ConfirmacionBadge({ confirmacion }: { confirmacion: Confirmacion | null }) {
  const s = CONFIRMACION_STYLES[confirmacion ?? "SIN_RESPUESTA"];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      {s.label}
    </span>
  );
}

/** "2026-10-15" -> "15 oct" (sin desfase de zona horaria). */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(".", "");
}

/** Logo del establecimiento, o sus iniciales sobre el color de marca. */
export function LogoEstablecimiento({ logoUrl, nombre, size = 36 }: { logoUrl: string | null; nombre: string; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={nombre} width={size} height={size}
      className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size }} />;
  }
  const iniciales = nombre.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "V";
  return (
    <span className="grid shrink-0 place-items-center rounded-lg bg-brand-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {iniciales}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
