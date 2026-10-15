import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BellRing, Building2, CalendarCheck, Check, ChevronDown, DatabaseBackup, Lock, Mail, MapPin,
  MessageCircle, PackageSearch, Phone, ShieldCheck, Syringe, TriangleAlert, UserRoundSearch, X,
} from "lucide-react";
import { temaMarca } from "@/lib/establecimiento";
import { EMPRESA, enlaceVentas, telefonoLegible } from "@/lib/empresa";
import { Precios } from "@/components/landing/Precios";
import { DemoWhatsApp } from "@/components/landing/DemoWhatsApp";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { SolicitudPrueba } from "@/components/landing/SolicitudPrueba";
import { ANCLAS } from "@/components/landing/anclas";
import SelectorTema from "@/components/SelectorTema";

export const metadata: Metadata = {
  title: { absolute: "VacunaApp · Recordatorios de vacunación por correo y WhatsApp para IPS en Colombia" },
  description:
    "Reduce el ausentismo, automatiza tu agenda de vacunación y controla tu inventario por lote. Recordatorios por WhatsApp y email para clínicas e IPS en Colombia.",
};


const ANTES_DESPUES = [
  { antes: "Secretarias perdiendo horas llamando por teléfono.", despues: "Recordatorios automáticos enviados por WhatsApp y email." },
  { antes: "Pacientes que olvidan su 2ª y 3ª dosis.", despues: "Bot interactivo 24/7 para confirmar o reprogramar en segundos." },
  { antes: "Vencimientos no detectados e inventario descontrolado.", despues: "Inventario por lote con alertas automáticas de vencimiento." },
  { antes: "Incumplimiento o riesgo en el manejo de datos.", despues: "Datos cifrados, acceso por roles y respaldo en la nube." },
];

const MODULOS = [
  { icono: MessageCircle, titulo: "Notificaciones por WhatsApp y email", texto: "Mensajes oficiales con el logo, nombre y número de tu centro de vacunación." },
  { icono: CalendarCheck, titulo: "Semáforo de citas y agenda inteligente", texto: "Citas confirmadas, pendientes, reprogramadas y fallidas en un solo tablero." },
  { icono: UserRoundSearch, titulo: "Pacientes atrasados", texto: "Recaptura activa de esquemas de vacunación incompletos con campañas masivas." },
  { icono: PackageSearch, titulo: "Inventario trazable por lote", texto: "Lotes, fechas de vencimiento y descuento automático por cada dosis aplicada." },
  { icono: Building2, titulo: "Multicentro y roles de usuario", texto: "Varias sedes con datos aislados y permisos para administradores, médicos y vacunadores." },
  { icono: Syringe, titulo: "Carné digital de vacunación", texto: "Cada paciente consulta su historial desde un enlace o código QR seguro." },
];

const INTEGRACIONES = ["WhatsApp Business API", "Meta", "Twilio", "Resend", "Supabase"];

const FAQ = [
  { p: "¿Puedo usar mi propio número de WhatsApp?", r: "Sí. Vinculamos tu línea fija o móvil oficial a través de la API en la nube de Meta (WhatsApp Business Platform), y tus pacientes ven el nombre de tu centro." },
  { p: "¿Cumple con la normatividad de datos de salud en Colombia?", r: "Sí. Tratamos los datos conforme a la Ley 1581 de 2012: autorización registrada de cada paciente, opción de retirarla respondiendo SALIR, bases de datos cifradas y acceso restringido por centro y por rol." },
  { p: "¿Cuánto tarda la implementación?", r: "Dejamos la plataforma parametrizada, cargamos tus pacientes desde Excel y capacitamos a tu personal en 3 días hábiles." },
  { p: "¿Tengo contrato de permanencia?", r: "No. En el plan mensual puedes cancelar o cambiar de plan cuando quieras." },
  { p: "¿Qué pasa con mis datos si cancelo?", r: "Te entregamos la exportación completa de pacientes, vacunas aplicadas y citas en Excel antes de cerrar la cuenta." },
];

export default function LandingPage() {
  return (
    // La landing siempre usa el azul de VacunaApp, no el color del centro de quien tenga sesión
    <div data-marca style={temaMarca("azul") as React.CSSProperties} className="min-h-screen overflow-x-clip">
      <Encabezado />

      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgb(var(--brand-200)/0.6),transparent_60%)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface px-3 py-1 text-xs font-medium text-brand-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Hecho en Colombia para clínicas e IPS
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
                La plataforma inteligente de vacunación y <span className="text-brand-600">recordatorios automáticos por correo y WhatsApp</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Reduce el ausentismo de pacientes hasta en un 35%, automatiza tu agenda y gestiona tu inventario por lote sin
                esfuerzo. Diseñado para clínicas e IPS en Colombia.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#prueba" className="btn-primary justify-center px-6 py-3 text-base">
                  Probar demo gratis (6 días) <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#precios" className="btn-secondary justify-center px-6 py-3 text-base">Ver planes y precios</a>
              </div>
              <p className="mt-4 text-sm text-slate-500">Sin tarjeta de crédito · Sin permanencia · Configuración en 3 días</p>
            </div>
            <MockupHero />
          </div>
        </section>

        {/* 2. Confianza */}
        <section className="border-y border-slate-200 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-slate-700">
              <Lock className="h-4 w-4 shrink-0 text-emerald-600" />
              Tecnología de grado médico, compatible con la Ley 1581 de 2012 de Protección de Datos Personales.
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {INTEGRACIONES.map((i) => (
                <li key={i} className="text-lg font-semibold tracking-tight text-slate-400">{i}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. Antes y después */}
        <Seccion id="solucion" etiqueta="El problema" titulo="Deja de perseguir pacientes por teléfono" subtitulo="Lo que hoy le cuesta horas a tu equipo, VacunaApp lo hace solo.">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
            <div className="grid grid-cols-2 border-b border-slate-200 text-sm font-semibold">
              <p className="bg-red-50 px-4 py-3 text-red-700 sm:px-6">El método tradicional</p>
              <p className="bg-emerald-50 px-4 py-3 text-emerald-700 sm:px-6">Con VacunaApp</p>
            </div>
            {ANTES_DESPUES.map((f) => (
              <div key={f.antes} className="grid grid-cols-2 border-b border-slate-100 text-sm last:border-0">
                <p className="flex gap-2.5 px-4 py-4 text-slate-600 sm:px-6">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {f.antes}
                </p>
                <p className="flex gap-2.5 border-l border-slate-100 px-4 py-4 font-medium text-slate-800 sm:px-6">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f.despues}
                </p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 4. Módulos */}
        <Seccion id="funciones" etiqueta="Funcionalidades" titulo="Todo lo que tu centro de vacunación necesita" subtitulo="Un solo sistema para pacientes, agenda, mensajes e inventario." fondo>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <div key={m.titulo} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <m.icono className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{m.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{m.texto}</p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 5. Demo del bot */}
        <Seccion id="demo" etiqueta="Pruébalo tú mismo" titulo="Así lo vive tu paciente" subtitulo="Responde como si fueras Juan y mira cómo se actualiza la agenda del centro.">
          <DemoWhatsApp />
        </Seccion>

        {/* 6. Precios */}
        <Seccion id="precios" etiqueta="Planes y precios" titulo="Un plan para cada tamaño de centro" subtitulo="Precios en pesos colombianos. Cambia de plan cuando quieras." fondo>
          <Precios />
        </Seccion>

        {/* 7. ROI */}
        <Seccion id="roi" etiqueta="Retorno de inversión" titulo="Se paga sola con unos pocos pacientes" subtitulo="Si atiendes 200 pacientes al mes y recuperas solo 5 que iban a faltar, el sistema ya cubrió su costo mensual.">
          <CalculadoraROI />
        </Seccion>

        {/* 8. FAQ */}
        <Seccion id="faq" etiqueta="Preguntas frecuentes" titulo="Resolvemos tus dudas" fondo>
          <div className="mx-auto max-w-3xl space-y-3">
            {FAQ.map((f) => (
              <details key={f.p} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-slate-900">
                  {f.p}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.r}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* CTA final: formulario de prueba gratis / demostración */}
        <section className="relative px-4 py-20 sm:px-6">
          {/* Destinos de los botones de la página (ver ANCLAS en SolicitudPrueba) */}
          {Object.keys(ANCLAS).map((id) => <span key={id} id={id} className="absolute top-0 scroll-mt-16" />)}
          <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-3xl bg-brand-600 px-6 py-12 text-white shadow-xl sm:px-10 lg:grid-cols-[1fr_1.3fr] lg:py-14">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Empieza a recuperar pacientes esta semana</h2>
              <p className="mt-4 text-white/85">
                Te acompañamos en la configuración, cargamos tus pacientes y conectamos tu WhatsApp. 6 días gratis, sin compromiso.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {["Te contactamos en menos de un día hábil", "Sin tarjeta de crédito", "Configuración y capacitación incluidas"].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-white/90" /> {t}</li>
                ))}
              </ul>
            </div>
            <SolicitudPrueba />
          </div>
        </section>
      </main>

      <PiePagina />
      {EMPRESA.whatsapp && <BotonWhatsApp />}
    </div>
  );
}

function Encabezado() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Syringe className="h-4 w-4" />
          </span>
          VacunaApp
        </Link>
        <div className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <a href="#funciones" className="hover:text-slate-900">Funciones</a>
          <a href="#demo" className="hover:text-slate-900">Demo</a>
          <a href="#precios" className="hover:text-slate-900">Precios</a>
          <a href="#faq" className="hover:text-slate-900">Preguntas</a>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <SelectorTema compacto />
          <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:block">
            Iniciar sesión
          </Link>
          <a href="#prueba" className="btn-primary py-2">
            Prueba gratis
          </a>
        </div>
      </nav>
    </header>
  );
}

function Seccion({ id, etiqueta, titulo, subtitulo, fondo, children }: {
  id: string; etiqueta: string; titulo: string; subtitulo?: string; fondo?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-16 py-20 ${fondo ? "bg-slate-100/60" : ""}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{etiqueta}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{titulo}</h2>
          {subtitulo && <p className="mt-4 text-lg text-slate-600">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Laptop con el tablero y celular con el recordatorio, dibujados con HTML para que se vean nítidos. */
function MockupHero() {
  const citas = [
    { n: "Juan Pérez", v: "Hepatitis B · 2", e: "Confirmada", c: "bg-emerald-100 text-emerald-700" },
    { n: "María Gómez", v: "Influenza · 1", e: "Pendiente", c: "bg-amber-100 text-amber-700" },
    { n: "Sofía Ruiz", v: "Pentavalente · 3", e: "Reprogramada", c: "bg-violet-100 text-violet-700" },
    { n: "Andrés Díaz", v: "Fiebre amarilla", e: "Fallida", c: "bg-red-100 text-red-700" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 lg:pb-0" aria-hidden>
      {/* Laptop */}
      <div className="rounded-t-xl border-[6px] border-b-0 border-slate-800 bg-slate-800 shadow-2xl dark:border-slate-300 dark:bg-slate-300">
        <div className="flex aspect-[16/10] overflow-hidden rounded-t-md bg-[rgb(var(--app-bg))] text-[9px] sm:text-[10px]">
          <div className="hidden w-[22%] shrink-0 space-y-1.5 border-r border-slate-200 bg-surface p-2 sm:block">
            <div className="mb-3 flex items-center gap-1 font-bold text-slate-900">
              <span className="h-3 w-3 rounded bg-brand-600" /> Vida Plena
            </div>
            {["Inicio", "Pacientes", "Agenda", "Vacunación", "Atrasados", "Inventario"].map((m, i) => (
              <div key={m} className={`rounded px-1.5 py-1 ${i === 0 ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-500"}`}>{m}</div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-2 p-2.5">
            <p className="font-semibold text-slate-900">Resumen de hoy</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                ["Citas", "48", "text-slate-900"],
                ["Confirmadas", "36", "text-emerald-600"],
                ["Atrasados", "12", "text-amber-600"],
                ["Por vencer", "3", "text-red-600"],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-md border border-slate-200 bg-surface p-1.5">
                  <p className="truncate text-slate-500">{l}</p>
                  <p className={`text-sm font-bold sm:text-base ${c}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              <div className="col-span-3 rounded-md border border-slate-200 bg-surface p-1.5">
                <p className="mb-1 font-medium text-slate-700">Agenda</p>
                {citas.map((c) => (
                  <div key={c.n} className="flex items-center justify-between border-t border-slate-100 py-[3px]">
                    <span className="truncate text-slate-700">{c.n}</span>
                    <span className={`rounded-full px-1.5 ${c.c}`}>{c.e}</span>
                  </div>
                ))}
              </div>
              <div className="col-span-2 rounded-md border border-slate-200 bg-surface p-1.5">
                <p className="mb-1 font-medium text-slate-700">Asistencia</p>
                <div className="flex h-[60px] items-end gap-1 sm:h-[72px]">
                  {[45, 60, 52, 70, 78, 85, 92].map((h, i) => (
                    <span key={i} className="flex-1 rounded-sm bg-brand-500" style={{ height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-[-6%] h-3 rounded-b-xl bg-gradient-to-b from-slate-300 to-slate-400 shadow-lg dark:from-slate-400 dark:to-slate-500" />

      {/* Celular */}
      <div className="absolute -bottom-2 right-[-2%] w-[38%] min-w-[150px] max-w-[200px] rounded-[1.6rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl sm:right-[-6%] lg:-bottom-10 dark:border-slate-200 dark:bg-slate-200">
        <div className="overflow-hidden rounded-[1.2rem] bg-[#efeae2] text-[9px] leading-snug dark:bg-[#0b141a]">
          <div className="bg-[#075e54] px-2.5 py-2 font-semibold text-white dark:bg-[#202c33]">Vida Plena · Vacunación</div>
          <div className="space-y-1.5 p-2">
            <p className="rounded-md rounded-tl-none bg-white p-1.5 text-slate-800 shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              Hola Juan 👋 Te recordamos tu cita de <b>Hepatitis B</b> mañana a las 9:00 a. m. Responde <b>1</b> para confirmar o <b>2</b> para reprogramar.
            </p>
            <p className="ml-auto w-fit rounded-md rounded-tr-none bg-[#d9fdd3] px-2 py-1 font-semibold text-slate-800 shadow-sm dark:bg-[#005c4b] dark:text-white">1</p>
            <p className="rounded-md rounded-tl-none bg-white p-1.5 text-slate-800 shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              ¡Gracias! ✅ Tu cita quedó <b>confirmada</b>.
            </p>
          </div>
        </div>
      </div>

      {/* Alertas flotantes */}
      <div className="absolute -left-3 top-[18%] hidden items-center gap-2 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg sm:flex lg:-left-10">
        <BellRing className="h-4 w-4 text-brand-600" />
        <span><b className="text-slate-900">128</b> <span className="text-slate-500">recordatorios enviados hoy</span></span>
      </div>
      <div className="absolute -left-2 bottom-[14%] hidden items-center gap-2 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg sm:flex lg:-left-8">
        <TriangleAlert className="h-4 w-4 text-amber-500" />
        <span className="text-slate-600">Lote <b className="text-slate-900">HB-2291</b> vence en 12 días</span>
      </div>
    </div>
  );
}

function PiePagina() {
  const anio = new Date().getFullYear();
  return (
    <footer id="contacto" className="border-t border-slate-200 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1.4fr]">
        <div>
          <p className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Syringe className="h-4 w-4" /></span>
            {EMPRESA.nombreComercial}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
            Software de gestión de vacunación y recordatorios automáticos para clínicas e IPS en Colombia.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <DatabaseBackup className="h-4 w-4" /> Datos cifrados y con respaldo en la nube
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/privacidad" className="text-slate-600 hover:text-brand-600">Política de privacidad y tratamiento de datos (Ley 1581)</Link></li>
            <li><Link href="/terminos" className="text-slate-600 hover:text-brand-600">Términos y condiciones del servicio</Link></li>
            <li><Link href="/dashboard" className="text-slate-600 hover:text-brand-600">Acceso para centros</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {(EMPRESA.razonSocial || EMPRESA.nit) && (
              <li>
                {EMPRESA.razonSocial || EMPRESA.nombreComercial}
                {EMPRESA.nit && <> · NIT {EMPRESA.nit}</>}
              </li>
            )}
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {EMPRESA.direccion ? `${EMPRESA.direccion} · ` : ""}{EMPRESA.ciudad}</li>
            {EMPRESA.email && (
              <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> <a href={`mailto:${EMPRESA.email}`} className="hover:text-brand-600">{EMPRESA.email}</a></li>
            )}
            {EMPRESA.whatsapp && (
              <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> <a href={`https://wa.me/${EMPRESA.whatsapp}`} className="hover:text-brand-600">{telefonoLegible(EMPRESA.whatsapp)} (WhatsApp)</a></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
        © {anio} {EMPRESA.razonSocial || EMPRESA.nombreComercial}. Todos los derechos reservados. WhatsApp y Meta son marcas de Meta Platforms, Inc.
      </div>
    </footer>
  );
}

function BotonWhatsApp() {
  return (
    <a
      {...enlaceVentas("Hola, tengo una pregunta sobre VacunaApp.")}
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-xl transition hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

