import { BellRing, CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";
import LoginForm from "@/components/LoginForm";
import SelectorTema from "@/components/SelectorTema";
import { LogoEstablecimiento } from "@/components/ui";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";

export const dynamic = "force-dynamic";

const features = [
  { icon: CalendarCheck, title: "Agenda y esquemas", text: "Control de citas y dosis de cada paciente" },
  { icon: BellRing, title: "Recordatorios automáticos", text: "Por email y WhatsApp el día anterior" },
  { icon: MessageCircle, title: "Confirmación por WhatsApp", text: "El paciente confirma o reprograma solo" },
];

export default async function LoginPage() {
  const est = await getEstablecimientoActual();

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoEstablecimiento logoUrl={est.logo_url} nombre={est.nombre} size={40} />
          <div>
            <div className="font-semibold leading-tight text-slate-900">{est.nombre}</div>
            {est.ciudad && <div className="text-xs text-slate-500">{est.ciudad}</div>}
          </div>
        </div>
        <SelectorTema compacto />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mb-8 mt-1.5 text-sm text-slate-500">Ingresa con tu cuenta del personal del centro.</p>
          <LoginForm />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck size={14} /> Conexión segura · Plataforma VacunaApp
        </p>
      </section>

      <section className="relative hidden overflow-hidden bg-brand-900 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Que ningún paciente olvide su próxima dosis.
          </h2>
          <p className="mt-3 text-white/75">
            Gestión de vacunación con recordatorios y confirmación automática de citas.
          </p>
          <ul className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
