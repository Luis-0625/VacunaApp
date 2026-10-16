import Link from "next/link";
import { ShieldCheck, Syringe } from "lucide-react";
import SelectorTema from "@/components/SelectorTema";

/** Marco centrado de las pantallas de recuperación de contraseña. */
export default function PantallaAcceso({ titulo, subtitulo, children }: {
  titulo: string; subtitulo: string; children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-[rgb(var(--app-bg))] px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Syringe className="h-4 w-4" /></span>
          VacunaApp
        </Link>
        <SelectorTema compacto />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
          <p className="mb-6 mt-1.5 text-sm text-slate-500">{subtitulo}</p>
          {children}
        </div>
      </div>
      <p className="mx-auto flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={14} /> Conexión segura · Plataforma VacunaApp
      </p>
    </main>
  );
}
