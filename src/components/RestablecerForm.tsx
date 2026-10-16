"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CampoContrasena from "@/components/CampoContrasena";

export default function RestablecerForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<{ texto: string; enlaceVencido?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError({ texto: "La contraseña debe tener al menos 8 caracteres" });
    if (password !== confirmacion) return setError({ texto: "Las contraseñas no coinciden" });
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // El token se valida al enviar y no al abrir el enlace, para que los antivirus de correo que visitan
    // los enlaces no lo gasten antes que el usuario.
    const { error: errToken } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (errToken) {
      setLoading(false);
      return setError({ texto: "El enlace venció o ya fue usado.", enlaceVencido: true });
    }
    const { error: errClave } = await supabase.auth.updateUser({ password });
    if (errClave) {
      setLoading(false);
      return setError({
        texto: errClave.code === "same_password" ? "La contraseña nueva debe ser diferente a la anterior" : errClave.message,
      });
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="nueva" className="text-sm font-medium text-slate-700">Nueva contraseña</label>
        <CampoContrasena id="nueva" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmacion" className="text-sm font-medium text-slate-700">Confirmar contraseña</label>
        <CampoContrasena id="confirmacion" value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" minLength={8} />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error.texto}{" "}
          {error.enlaceVencido && <Link href="/recuperar" className="font-semibold underline">Pide uno nuevo</Link>}
        </p>
      )}
      <button disabled={loading} className="btn-primary w-full justify-center py-2.5">
        {loading ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
