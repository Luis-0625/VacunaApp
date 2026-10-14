import type { EstadoEnvio } from "@/types/db";

const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",
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

/** "2026-10-15" -> "15 oct" (sin desfase de zona horaria). */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(".", "");
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
