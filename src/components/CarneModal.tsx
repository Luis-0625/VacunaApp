"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, Eye, RefreshCw, Send } from "lucide-react";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import type { Paciente } from "@/types/db";

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Carné digital del paciente: QR, enlace, envío por WhatsApp y cambio de enlace. */
export default function CarneModal({ paciente, onClose, onTokenChange }: {
  paciente: Paciente; onClose: () => void; onTokenChange: () => void;
}) {
  const [token, setToken] = useState(paciente.carne_token);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [busy, setBusy] = useState<"enviar" | "revocar" | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmarRevocar, setConfirmarRevocar] = useState(false);
  const [consultas, setConsultas] = useState<{ total: number; ultima: string | null } | null>(null);

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/carne/${token}`;

  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(""));
  }, [url]);

  useEffect(() => {
    createClient().from("carne_consultas").select("created_at", { count: "exact" })
      .eq("paciente_id", paciente.id).order("created_at", { ascending: false }).limit(1)
      .then(({ data, count }) => setConsultas({ total: count ?? 0, ultima: data?.[0]?.created_at ?? null }));
  }, [paciente.id, token]);

  async function accion(tipo: "enviar" | "revocar") {
    setBusy(tipo);
    setAviso(null);
    const res = await fetch(`/api/pacientes/${paciente.id}/carne`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: tipo }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setAviso({ ok: false, texto: json.error ?? "No se pudo completar la acción" });
    if (tipo === "revocar") {
      setToken(json.carne_token);
      setConfirmarRevocar(false);
      onTokenChange();
      setAviso({ ok: true, texto: "Se generó un enlace nuevo. El anterior ya no funciona." });
    } else {
      setAviso({ ok: true, texto: "Carné enviado por WhatsApp." });
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Modal title={`Carné digital · ${paciente.nombre_completo}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-white p-1.5 ring-1 ring-slate-200 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <p className="text-slate-600">
              El paciente puede mostrar este enlace o su código QR para que verifiquen sus vacunas en línea.
            </p>
            <div className="flex gap-1.5">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className="input py-2 text-xs" />
              <button onClick={copiar} title="Copiar enlace" aria-label="Copiar enlace" className="btn-secondary px-2.5 py-2">
                {copiado ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            {consultas && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Eye size={13} />
                {consultas.total === 0 ? "Aún no se ha consultado"
                  : `Consultado ${consultas.total} ${consultas.total === 1 ? "vez" : "veces"} · última: ${fechaHora(consultas.ultima!)}`}
              </p>
            )}
          </div>
        </div>

        {paciente.autoriza_mensajes === "NO_AUTORIZADO" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            El paciente no autoriza recibir mensajes: entrégale el carné impreso o el enlace en persona.
          </p>
        )}
        {aviso && (
          <p className={`rounded-lg px-3 py-2 text-sm ring-1 ${aviso.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
            {aviso.texto}
          </p>
        )}

        {confirmarRevocar ? (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>Se generará un enlace nuevo y <strong>el actual dejará de funcionar</strong>, incluido el QR impreso. Úsalo si el paciente compartió su carné por error.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarRevocar(false)} className="btn-secondary py-2">Cancelar</button>
              <button onClick={() => accion("revocar")} disabled={busy !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
                {busy === "revocar" ? "Generando…" : "Generar enlace nuevo"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
            <button onClick={() => setConfirmarRevocar(true)} className="btn-secondary py-2 text-red-600">
              <RefreshCw size={15} /> Cambiar enlace
            </button>
            <div className="flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noopener" className="btn-secondary py-2"><ExternalLink size={15} /> Abrir / imprimir</a>
              <button onClick={() => accion("enviar")} disabled={busy !== null || paciente.autoriza_mensajes === "NO_AUTORIZADO"}
                className="btn-primary py-2">
                <Send size={15} /> {busy === "enviar" ? "Enviando…" : "Enviar por WhatsApp"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
