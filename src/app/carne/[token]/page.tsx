import type { Metadata } from "next";
import QRCode from "qrcode";
import { BadgeCheck, CalendarClock, CircleAlert, CircleCheck, Info, Syringe } from "lucide-react";
import CarneAcciones from "@/components/CarneAcciones";
import { LogoEstablecimiento } from "@/components/ui";
import { formatFechaLarga, todayISO } from "@/lib/agenda";
import { enmascararDocumento, urlCarne } from "@/lib/carne";
import { getEstablecimiento } from "@/lib/establecimiento";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Página pública: nunca debe aparecer en buscadores
export const metadata: Metadata = {
  title: "Carné de vacunación",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const TOKEN = /^[A-Za-z0-9_-]{20}$/;

interface Dosis {
  id: string;
  vacuna_id: string;
  numero_dosis: number;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
  vacuna: { nombre: string; dosis_totales: number };
}

function NoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-sm space-y-3 p-8 text-center">
        <CircleAlert className="mx-auto text-slate-400" size={36} />
        <h1 className="text-lg font-semibold">Carné no disponible</h1>
        <p className="text-sm text-slate-500">
          Este enlace no existe o fue reemplazado por uno nuevo. Solicita el enlace actualizado a tu centro de vacunación.
        </p>
      </div>
    </main>
  );
}

export default async function CarnePage({ params }: { params: { token: string } }) {
  if (!TOKEN.test(params.token)) return <NoEncontrado />;

  // El acceso es por el token secreto: se consulta con el service role y solo se muestran datos mínimos
  const db = createAdminClient();
  const { data: paciente } = await db.from("pacientes")
    .select("id, nombre_completo, documento_identidad").eq("carne_token", params.token).maybeSingle();
  if (!paciente) return <NoEncontrado />;

  const [{ data: dosis }, est] = await Promise.all([
    db.from("citas_vacunacion")
      .select("id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, vacuna:vacunas!inner(nombre, dosis_totales)")
      .eq("paciente_id", paciente.id).neq("estado", "CANCELADA")
      .order("fecha_aplicacion").order("numero_dosis")
      .returns<Dosis[]>(),
    getEstablecimiento(db),
    db.from("carne_consultas").insert({ paciente_id: paciente.id }),
  ]);

  const url = urlCarne(params.token);
  const qr = await QRCode.toString(url, {
    type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" },
  });

  const hoy = todayISO();
  const porVacuna = new Map<string, Dosis[]>();
  for (const d of dosis ?? []) porVacuna.set(d.vacuna_id, [...(porVacuna.get(d.vacuna_id) ?? []), d]);

  const consultado = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long", timeStyle: "short", timeZone: process.env.APP_TIMEZONE ?? "America/Bogota",
  }).format(new Date());

  return (
    <main className="min-h-screen px-4 py-8 print:p-0">
      <div className="mx-auto max-w-lg space-y-4">
        <article className="card overflow-hidden print:border-slate-300 print:shadow-none">
          {/* Encabezado del centro */}
          <header className="flex items-center gap-3 border-b-4 border-brand-600 px-6 py-5">
            <LogoEstablecimiento logoUrl={est.logo_url} nombre={est.nombre} size={44} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{est.nombre}</div>
              <div className="text-xs text-slate-500">
                {[est.nit && `NIT ${est.nit}`, est.ciudad].filter(Boolean).join(" · ") || "Centro de vacunación"}
              </div>
            </div>
          </header>

          {/* Paciente y verificación */}
          <section className="space-y-3 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">Carné de vacunación</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">{paciente.nombre_completo}</h1>
              <p className="text-sm text-slate-500">Documento {enmascararDocumento(paciente.documento_identidad)}</p>
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <BadgeCheck size={18} className="mt-0.5 shrink-0" />
              <span>
                <strong>Carné verificado</strong> por {est.nombre}
                <span className="block text-xs text-emerald-700">Información consultada en línea el {consultado}</span>
              </span>
            </p>
          </section>

          {/* Vacunas */}
          <section className="border-t border-slate-200">
            <h2 className="px-6 pb-2 pt-4 text-sm font-semibold text-slate-700">Vacunas aplicadas en {est.nombre}</h2>
            {porVacuna.size === 0 && (
              <p className="px-6 pb-5 text-sm text-slate-500">Aún no hay vacunas registradas.</p>
            )}
            <ul className="divide-y divide-slate-100">
              {[...porVacuna.values()].map((lista) => {
                const ultima = lista[lista.length - 1];
                const total = ultima.vacuna.dosis_totales;
                const completo = ultima.numero_dosis >= total;
                const proxima = ultima.fecha_proxima_dosis;
                return (
                  <li key={ultima.vacuna_id} className="space-y-2 px-6 py-4 print:break-inside-avoid">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Syringe size={16} className="shrink-0 text-brand-600" /> {ultima.vacuna.nombre}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{ultima.numero_dosis} de {total} dosis</span>
                    </div>
                    <ol className="space-y-1 pl-6 text-sm">
                      {lista.map((d) => (
                        <li key={d.id} className="flex justify-between gap-3 text-slate-600">
                          <span>Dosis {d.numero_dosis}</span>
                          <span className="tabular-nums">{formatFechaLarga(d.fecha_aplicacion)}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="pl-6 text-xs">
                      {completo ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CircleCheck size={13} /> Esquema completo</span>
                      ) : proxima && proxima < hoy ? (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                          <CircleAlert size={13} /> Dosis {ultima.numero_dosis + 1} pendiente desde el {formatFechaLarga(proxima)}
                        </span>
                      ) : proxima ? (
                        <span className="inline-flex items-center gap-1 font-medium text-brand-700">
                          <CalendarClock size={13} /> Próxima dosis: {formatFechaLarga(proxima)}
                        </span>
                      ) : (
                        <span className="text-slate-500">Dosis {ultima.numero_dosis + 1} pendiente</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* QR de verificación */}
          <section className="flex items-center gap-5 border-t border-slate-200 px-6 py-5 print:break-inside-avoid">
            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-slate-200 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="space-y-1 text-sm">
              <div className="font-medium">Verifica este carné</div>
              <p className="text-xs text-slate-500">
                Escanea el código para consultar la información actualizada directamente con {est.nombre}.
              </p>
              <p className="break-all text-[11px] text-slate-400">{url.replace(/^https?:\/\//, "")}</p>
            </div>
          </section>

          <footer className="flex items-start gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 text-[11px] leading-relaxed text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Este carné muestra únicamente las vacunas registradas en {est.nombre}. No reemplaza el carné oficial
              de vacunación ni el registro del Programa Ampliado de Inmunizaciones (PAI).
              {est.telefono && ` Información: ${est.telefono}.`}
            </span>
          </footer>
        </article>

        <CarneAcciones />
      </div>
    </main>
  );
}
