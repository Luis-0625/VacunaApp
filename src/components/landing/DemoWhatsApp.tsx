"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, RotateCcw } from "lucide-react";

type Mensaje = { de: "bot" | "paciente"; texto: string };
type Estado = "PENDIENTE" | "CONFIRMADA" | "REPROGRAMANDO" | "REPROGRAMADA";

const FECHAS = [
  { largo: "Jueves 23 de octubre", corto: "Jue 23 oct" },
  { largo: "Viernes 24 de octubre", corto: "Vie 24 oct" },
  { largo: "Lunes 27 de octubre", corto: "Lun 27 oct" },
];
const FECHA_INICIAL = "Mié 22 oct · 9:00 a. m.";

const RECORDATORIO =
  "Hola Juan 👋 Te recordamos tu cita de vacuna *Hepatitis B (dosis 2)* mañana, miércoles 22 de octubre, a las 9:00 a. m. en *Centro de Vacunación Vida Plena*.\n\nResponde *1* para CONFIRMAR o *2* para REPROGRAMAR.";

const ESTADOS: Record<Estado, { label: string; cls: string }> = {
  PENDIENTE: { label: "Sin respuesta", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  CONFIRMADA: { label: "Confirmada", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  REPROGRAMANDO: { label: "Eligiendo fecha", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  REPROGRAMADA: { label: "Reprogramada", cls: "bg-violet-50 text-violet-700 ring-violet-600/20" },
};

/** Simulación del bot: el visitante responde como si fuera el paciente y ve cómo cambia la agenda. */
export function DemoWhatsApp() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ de: "bot", texto: RECORDATORIO }]);
  const [estado, setEstado] = useState<Estado>("PENDIENTE");
  const [fecha, setFecha] = useState(FECHA_INICIAL);
  const [escribiendo, setEscribiendo] = useState(false);
  const chat = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, escribiendo]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function responder(texto: string) {
    if (escribiendo) return;
    setMensajes((m) => [...m, { de: "paciente", texto }]);
    setEscribiendo(true);

    let respuesta: string;
    let nuevo: Estado;
    let nuevaFecha = fecha;
    if (estado === "REPROGRAMANDO") {
      const elegida = FECHAS[Number(texto) - 1];
      respuesta = `¡Listo! ✅ Tu cita quedó reprogramada para el *${elegida.largo}* a las 9:00 a. m. Te enviaremos un recordatorio el día anterior.`;
      nuevo = "REPROGRAMADA";
      nuevaFecha = `${elegida.corto} · 9:00 a. m.`;
    } else if (texto === "1") {
      respuesta = "¡Gracias, Juan! ✅ Tu cita quedó *confirmada*. Recuerda traer tu carné de vacunación.";
      nuevo = "CONFIRMADA";
    } else {
      respuesta = `Claro, elige una nueva fecha respondiendo con el número:\n\n${FECHAS.map((f, i) => `*${i + 1}.* ${f.largo}`).join("\n")}`;
      nuevo = "REPROGRAMANDO";
    }

    timer.current = setTimeout(() => {
      setEscribiendo(false);
      setMensajes((m) => [...m, { de: "bot", texto: respuesta }]);
      setEstado(nuevo);
      setFecha(nuevaFecha);
    }, 900);
  }

  function reiniciar() {
    clearTimeout(timer.current);
    setMensajes([{ de: "bot", texto: RECORDATORIO }]);
    setEstado("PENDIENTE");
    setFecha(FECHA_INICIAL);
    setEscribiendo(false);
  }

  const opciones = estado === "PENDIENTE" ? ["1", "2"] : estado === "REPROGRAMANDO" ? ["1", "2", "3"] : [];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-14">
      {/* Celular */}
      <div className="mx-auto w-full max-w-[340px] rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl dark:border-slate-300 dark:bg-slate-300">
        <div className="overflow-hidden rounded-[1.9rem] bg-[#efeae2] dark:bg-[#0b141a]">
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white dark:bg-[#202c33]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold">VP</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Vida Plena · Vacunación</p>
              <p className="text-xs text-white/70">{escribiendo ? "escribiendo…" : "Cuenta de empresa"}</p>
            </div>
          </div>
          <div ref={chat} className="h-[380px] space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.de === "paciente" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-[13px] leading-snug shadow-sm ${
                    m.de === "paciente"
                      ? "rounded-tr-none bg-[#d9fdd3] text-slate-900 dark:bg-[#005c4b] dark:text-white"
                      : "rounded-tl-none bg-white text-slate-900 dark:bg-[#202c33] dark:text-[#e9edef]"
                  }`}
                >
                  {formatear(m.texto)}
                  {m.de === "paciente" && <CheckCheck className="ml-1 inline h-3.5 w-3.5 text-sky-500" />}
                </p>
              </div>
            ))}
            {escribiendo && (
              <div className="flex">
                <span className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-slate-400 shadow-sm dark:bg-[#202c33]">•••</span>
              </div>
            )}
          </div>
          <div className="flex min-h-[60px] items-center gap-2 border-t border-black/5 bg-[#f0f2f5] px-3 py-3 dark:bg-[#202c33]">
            {opciones.length ? (
              <>
                <span className="text-xs text-slate-500 dark:text-[#8696a0]">Responde:</span>
                {opciones.map((o) => (
                  <button
                    key={o}
                    onClick={() => responder(o)}
                    disabled={escribiendo}
                    className="h-9 w-9 rounded-full bg-[#00a884] text-sm font-bold text-white shadow transition hover:scale-105 disabled:opacity-50"
                  >
                    {o}
                  </button>
                ))}
              </>
            ) : (
              <button onClick={reiniciar} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#008069] dark:text-[#00a884]">
                <RotateCcw className="h-3.5 w-3.5" /> Repetir la demostración
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Agenda del centro */}
      <div>
        <ol className="space-y-4 text-sm text-slate-600">
          {[
            "El paciente recibe el recordatorio con el nombre y el logo del centro.",
            "Responde con un 1 o un 2 — sin descargar apps ni llamar.",
            "La agenda se actualiza al instante y el bot envía la confirmación.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
              <span className="pt-1">{t}</span>
            </li>
          ))}
        </ol>

        <div className="card mt-8 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Agenda · mañana</p>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <FilaAgenda nombre="Juan Pérez" vacuna="Hepatitis B · dosis 2" fecha={fecha} estado={estado} destacada />
              <FilaAgenda nombre="María Gómez" vacuna="Influenza · dosis 1" fecha="Mié 22 oct · 9:30 a. m." estado="CONFIRMADA" />
              <FilaAgenda nombre="Sofía Ruiz" vacuna="Pentavalente · dosis 3" fecha="Mié 22 oct · 10:00 a. m." estado="REPROGRAMADA" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilaAgenda({ nombre, vacuna, fecha, estado, destacada }: { nombre: string; vacuna: string; fecha: string; estado: Estado; destacada?: boolean }) {
  const s = ESTADOS[estado];
  return (
    <tr className={destacada ? "bg-brand-50/60 transition-colors" : ""}>
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{nombre}</p>
        <p className="text-xs text-slate-500">{vacuna}</p>
      </td>
      <td className="hidden px-2 py-3 text-xs text-slate-500 sm:table-cell">{fecha}</td>
      <td className="px-5 py-3 text-right">
        <span key={estado} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.cls} ${destacada ? "animate-[pulse_1s_ease-in-out_1]" : ""}`}>
          {s.label}
        </span>
      </td>
    </tr>
  );
}

/** Negrita estilo WhatsApp: *texto*. */
function formatear(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte
  );
}
