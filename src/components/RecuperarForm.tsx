"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

export default function RecuperarForm({ emailInicial }: { emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/recuperar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError(res ? ((await res.json().catch(() => null))?.error ?? "No se pudo enviar el enlace") : "Sin conexión. Intenta de nuevo.");
      return;
    }
    setEnviado(true);
  }

  const volver = (
    <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
      <ArrowLeft size={16} /> Volver a iniciar sesión
    </Link>
  );

  if (enviado) {
    return (
      <div>
        <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <MailCheck className="h-5 w-5 shrink-0" />
          <p>
            Si <strong>{email}</strong> tiene una cuenta, te llegará un correo con el enlace en unos minutos. Revisa también
            la carpeta de spam. El enlace vence en 1 hora.
          </p>
        </div>
        {volver}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@centro.com" className="input" />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <button disabled={loading} className="btn-primary w-full justify-center py-2.5">
        {loading ? "Enviando…" : "Enviar enlace"}
      </button>
      {volver}
    </form>
  );
}
