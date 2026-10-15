"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Clock, CreditCard, Loader2, MessageCircle } from "lucide-react";
import { enlaceVentas } from "@/lib/empresa";
import { formatFechaLarga } from "@/lib/agenda";
import {
  DIAS_GRACIA, NOMBRE_PLAN, PLANES, estadoSuscripcion, linkPago, precio, type Plan, type PlanPago,
} from "@/lib/suscripcion";

export interface PagoSuscripcion {
  id: string;
  plan: PlanPago;
  meses: number;
  monto: number;
  estado: "PENDIENTE" | "APROBADO";
  created_at: string;
  pagado_at: string | null;
  vence_despues: string | null;
}

const cop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

const RESULTADOS = {
  APROBADO: { icon: CircleCheck, cls: "bg-emerald-50 text-emerald-800 ring-emerald-600/20", texto: "¡Pago aprobado! Tu suscripción quedó renovada." },
  PENDIENTE: { icon: Clock, cls: "bg-amber-50 text-amber-800 ring-amber-600/20", texto: "Tu pago está en proceso. Con PSE o Efecty puede tardar unos minutos; la suscripción se renueva sola cuando Mercado Pago lo apruebe." },
  RECHAZADO: { icon: CircleAlert, cls: "bg-red-50 text-red-800 ring-red-600/20", texto: "El pago no se completó. No se hizo ningún cobro; puedes intentarlo de nuevo." },
  ERROR: { icon: CircleAlert, cls: "bg-red-50 text-red-800 ring-red-600/20", texto: "No pudimos confirmar el pago con Mercado Pago. Si se hizo el cobro, la suscripción se renovará sola en unos minutos." },
} as const;


export default function SuscripcionManager({ plan, vence, hoy, pagos, resultado, modo }: {
  plan: Plan; vence: string | null; hoy: string; pagos: PagoSuscripcion[];
  resultado: keyof typeof RESULTADOS | null;
  /** automatico: link propio de cada pago (credenciales configuradas); link: links fijos con confirmación manual. */
  modo: "automatico" | "link";
}) {
  const router = useRouter();
  const [meses, setMeses] = useState<1 | 12>(1);
  const [elegido, setElegido] = useState<PlanPago>(plan === "PRUEBA" ? "BASICO" : plan);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [esperando, setEsperando] = useState(false);
  const estado = estadoSuscripcion(vence, hoy);

  // Tras un pago aprobado se recarga el panel completo para quitar avisos o bloqueos de vencimiento
  const refrescado = useRef(false);
  useEffect(() => {
    if (resultado === "APROBADO" && !refrescado.current) {
      refrescado.current = true;
      router.refresh();
    }
  }, [resultado, router]);

  // Con link fijo, Mercado Pago se abre en otra pestaña y el centro se queda viendo que el pago espera
  // confirmación. La pestaña se abre antes del fetch: abrirla después la bloquean los navegadores.
  const disponible = modo === "automatico" || !!linkPago(elegido, meses);

  async function pagar() {
    setEnviando(true);
    setError("");
    setEsperando(false);
    const pestana = modo === "link" ? window.open("", "_blank") : null;
    try {
      const res = await fetch("/api/suscripcion/pagar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: elegido, meses }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "No se pudo iniciar el pago");
      if (json.manual && pestana) {
        pestana.location.href = json.url;
        setEsperando(true);
        setEnviando(false);
        router.refresh(); // muestra el pago como "Pendiente de confirmación"
      } else {
        window.location.href = json.url;
      }
    } catch (e) {
      pestana?.close();
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  const r = resultado ? RESULTADOS[resultado] : null;
  // Los pagos vienen del más reciente al más antiguo
  const ultimoPago = pagos[0] ?? null;

  return (
    <div className="space-y-6">
      {r && (
        <p className={`flex gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${r.cls}`}>
          <r.icon size={18} className="mt-0.5 shrink-0" /> {r.texto}
        </p>
      )}

      {/* Estado del último pago: pendiente hasta que el superadmin lo confirme, luego confirmado */}
      {ultimoPago && (
        ultimoPago.estado === "PENDIENTE" ? (
          <div className="flex gap-3 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">
            <Clock size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Pago pendiente de confirmación</p>
              <p className="mt-0.5">
                Plan {PLANES[ultimoPago.plan].nombre} · {ultimoPago.meses === 12 ? "12 meses" : "1 mes"} · {cop(ultimoPago.monto)},
                iniciado el {fechaHora(ultimoPago.created_at)}. Cuando lo confirmemos, tu suscripción se renueva y este aviso cambia a confirmado.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
            <CircleCheck size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Último pago confirmado</p>
              <p className="mt-0.5">
                Plan {PLANES[ultimoPago.plan].nombre} · {ultimoPago.meses === 12 ? "12 meses" : "1 mes"} · {cop(ultimoPago.monto)},
                confirmado el {fechaHora(ultimoPago.pagado_at ?? ultimoPago.created_at)}
                {ultimoPago.vence_despues && <>. Tu suscripción está activa hasta el {formatFechaLarga(ultimoPago.vence_despues)}</>}.
              </p>
            </div>
          </div>
        )
      )}

      {/* Estado actual */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-slate-500">Plan actual</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">{NOMBRE_PLAN[plan]}</p>
        </div>
        <div className="text-right">
          {estado.estado === "VIGENTE" && (
            <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
              {vence ? `Activa hasta el ${formatFechaLarga(vence)}` : "Activa"}
            </Badge>
          )}
          {estado.estado === "POR_VENCER" && (
            <Badge cls="bg-amber-50 text-amber-700 ring-amber-600/20">
              {estado.dias === 0 ? "Vence hoy" : `Vence en ${estado.dias} ${estado.dias === 1 ? "día" : "días"} (${formatFechaLarga(vence!)})`}
            </Badge>
          )}
          {estado.estado === "GRACIA" && (
            <Badge cls="bg-red-50 text-red-700 ring-red-600/20">
              Vencida · el panel se bloquea el {formatFechaLarga(estado.bloqueo)}
            </Badge>
          )}
          {estado.estado === "VENCIDA" && (
            <Badge cls="bg-red-50 text-red-700 ring-red-600/20">Vencida · el panel está bloqueado</Badge>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Si pagas antes de vencer, el tiempo se suma a tu vencimiento actual. Después de vencer tienes {DIAS_GRACIA} día de gracia.
          </p>
        </div>
      </div>

      {/* Renovar */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Renovar o cambiar de plan</h2>
          <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
            {([[1, "1 mes"], [12, "12 meses · ahorra 16%"]] as const).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={meses === m} onClick={() => setMeses(m)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${meses === m ? "bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-label="Plan" className="mt-5 grid gap-3 sm:grid-cols-3">
          {(Object.keys(PLANES) as PlanPago[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={elegido === p} onClick={() => setElegido(p)}
              className={`rounded-xl border p-4 text-left transition ${elegido === p ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10" : "border-slate-200 hover:bg-slate-50"}`}>
              <span className="flex items-center justify-between text-sm font-semibold">
                {PLANES[p].nombre}
                {plan === p && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Actual</span>}
              </span>
              <span className="mt-2 block text-xl font-bold tracking-tight">{cop(precio(p, meses))}</span>
              <span className="text-xs text-slate-500">COP · {meses === 12 ? "12 meses" : "1 mes"}</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {esperando && (
          <p className="mt-4 flex gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-inset ring-sky-600/20">
            <Clock size={18} className="mt-0.5 shrink-0" />
            Completa el pago en la pestaña de Mercado Pago. Cuando lo recibamos confirmamos tu renovación (normalmente el
            mismo día hábil). Mientras tanto lo verás abajo como &quot;Pendiente de confirmación&quot;.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {disponible
              ? "Pagas en Mercado Pago con PSE, tarjeta de crédito o débito, o Efecty."
              : "Este plan y periodo todavía no tiene link de pago: escríbenos y te ayudamos a renovar."}
          </p>
          {disponible ? (
            <button onClick={pagar} disabled={enviando} className="btn-primary">
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              Pagar {cop(precio(elegido, meses))} con Mercado Pago
            </button>
          ) : (
            <a {...enlaceVentas(`Hola, quiero renovar mi centro con el Plan ${PLANES[elegido].nombre} por ${meses === 12 ? "12 meses" : "1 mes"} (${cop(precio(elegido, meses))}).`)}
              className="btn-primary">
              <MessageCircle size={16} /> Pagar por WhatsApp
            </a>
          )}
        </div>
      </section>

      {/* Historial */}
      <section className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Pagos</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr><th className="th">Fecha</th><th className="th">Plan</th><th className="th">Valor</th><th className="th">Estado</th><th className="th">Activa hasta</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagos.map((p) => (
              <tr key={p.id}>
                <td className="td">{new Date(p.pagado_at ?? p.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}</td>
                <td className="td">{PLANES[p.plan].nombre} · {p.meses === 12 ? "12 meses" : "1 mes"}</td>
                <td className="td tabular-nums">{cop(p.monto)}</td>
                <td className="td">
                  {p.estado === "APROBADO"
                    ? <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Confirmado</Badge>
                    : <Badge cls="bg-amber-50 text-amber-700 ring-amber-600/20">Pendiente de confirmación</Badge>}
                </td>
                <td className="td">{p.vence_despues ? formatFechaLarga(p.vence_despues) : "—"}</td>
              </tr>
            ))}
            {pagos.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Aún no hay pagos.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}
