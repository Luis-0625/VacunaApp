"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CampoContrasena from "@/components/CampoContrasena";
import { marcarActividad } from "@/lib/actividad";

const DIGITOS = 5; // mismo valor que en lib/recuperacion (ese archivo es solo de servidor)

type Paso = "correo" | "codigo" | "clave";

const PASOS: { id: Paso; texto: string }[] = [
  { id: "correo", texto: "Correo" },
  { id: "codigo", texto: "Código" },
  { id: "clave", texto: "Nueva contraseña" },
];

/** Recuperación en tres pasos: pedir el código de 5 dígitos, confirmarlo y solo entonces cambiar la contraseña. */
export default function RecuperarForm({ emailInicial }: { emailInicial: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("correo");
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enviarCodigo() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/recuperar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError(res ? ((await res.json().catch(() => null))?.error ?? "No se pudo enviar el código") : "Sin conexión. Intenta de nuevo.");
      return false;
    }
    return true;
  }

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (await enviarCodigo()) setPaso("codigo");
  }

  async function reenviar() {
    setAviso(null);
    if (await enviarCodigo()) setAviso("Te enviamos un código nuevo. El anterior ya no sirve.");
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAviso(null);
    const res = await fetch("/api/auth/recuperar/verificar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, codigo }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setLoading(false);
    if (!res?.ok || !data?.token) return setError(data?.error ?? "Sin conexión. Intenta de nuevo.");
    setToken(data.token);
    setPaso("clave");
  }

  async function guardarClave(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirmacion) return setError("Las contraseñas no coinciden");
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/recuperar/cambiar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token, password }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setLoading(false);
      if (data?.vencido) { setPaso("correo"); setCodigo(""); }
      return setError(data?.error ?? "Sin conexión. Intenta de nuevo.");
    }
    // Contraseña guardada: entra directo con ella
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) return router.replace("/login");
    marcarActividad();
    router.replace("/dashboard");
    router.refresh();
  }

  const indice = PASOS.findIndex((p) => p.id === paso);
  const mensajes = (
    <>
      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{aviso}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
    </>
  );

  return (
    <div>
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
        {PASOS.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${i <= indice ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              {i + 1}
            </span>
            <span className={i === indice ? "text-slate-900" : "text-slate-400"}>{p.texto}</span>
            {i < PASOS.length - 1 && <span className="h-px w-4 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {paso === "correo" && (
        <form onSubmit={pedirCodigo} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@centro.com" className="input" />
          </label>
          {mensajes}
          <button disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      )}

      {paso === "codigo" && (
        <form onSubmit={confirmarCodigo} className="space-y-5">
          <div className="flex gap-3 rounded-lg bg-brand-50 p-3 text-sm text-slate-700">
            <MailCheck className="h-5 w-5 shrink-0 text-brand-600" />
            <p>
              Si <strong>{email}</strong> tiene una cuenta, le enviamos un código de verificación. Revisa también la carpeta
              de spam. Vence en 15 minutos.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Código de verificación</span>
            <input required inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${DIGITOS}}`} maxLength={DIGITOS}
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder={"0".repeat(DIGITOS)} autoFocus
              className="input text-center font-mono text-2xl tracking-[0.5em]" />
          </label>
          {mensajes}
          <button disabled={loading || codigo.length < DIGITOS} className="btn-primary w-full justify-center py-2.5">
            {loading ? "Verificando…" : "Confirmar código"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setPaso("correo"); setCodigo(""); setError(null); setAviso(null); }}
              className="font-medium text-slate-500 hover:text-slate-700">
              Cambiar correo
            </button>
            <button type="button" onClick={reenviar} disabled={loading} className="font-medium text-brand-600 hover:text-brand-700">
              Reenviar código
            </button>
          </div>
        </form>
      )}

      {paso === "clave" && (
        <form onSubmit={guardarClave} className="space-y-5">
          <p className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <ShieldCheck size={18} className="shrink-0" /> Código confirmado. Ahora crea tu nueva contraseña.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="nueva" className="text-sm font-medium text-slate-700">Nueva contraseña</label>
            <CampoContrasena id="nueva" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmacion" className="text-sm font-medium text-slate-700">Confirmar contraseña</label>
            <CampoContrasena id="confirmacion" value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" minLength={8} />
          </div>
          {mensajes}
          <button disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>
      )}

      {paso !== "clave" && (
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <ArrowLeft size={16} /> Volver a iniciar sesión
        </Link>
      )}
    </div>
  );
}
