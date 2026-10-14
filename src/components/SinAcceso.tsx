"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SinAcceso() {
  const router = useRouter();
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Tu usuario no tiene acceso</h1>
        <p className="text-sm text-slate-600">
          Tu cuenta no tiene un perfil activo. Pide a un administrador que te asigne un rol. Si eres el
          administrador y acabas de actualizar la app, ejecuta <code className="rounded bg-slate-100 px-1">supabase/roles.sql</code> en Supabase.
        </p>
        <button className="btn-primary justify-center"
          onClick={async () => { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
