"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarCheck, ShieldPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const features = [
  { icon: Users, text: "Gestión centralizada de pacientes" },
  { icon: CalendarCheck, text: "Control de citas y esquemas de vacunación" },
  { icon: BellRing, text: "Recordatorios automáticos por Email y WhatsApp" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <ShieldPlus />
          </div>
          <span className="text-xl font-semibold">VacunaApp</span>
        </div>
        <div className="relative space-y-8">
          <h1 className="max-w-md text-4xl font-semibold leading-tight">
            Que ningún paciente olvide su próxima dosis.
          </h1>
          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-teal-50/90">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-teal-100/60">© VacunaApp</p>
      </section>

      <section className="grid place-items-center p-6">
        <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-2xl font-semibold">Bienvenido</h2>
            <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta del personal</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Correo</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@centro.com" className={input} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Contraseña</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" className={input} />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
          )}
          <button disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
