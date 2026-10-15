import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad" };

const ACTUALIZADA = "14 de octubre de 2026";

/** Política de tratamiento de datos de la plataforma (Ley 1581 de 2012). */
export default function PrivacidadPage() {
  const contacto = process.env.NEXT_PUBLIC_CONTACTO_PRIVACIDAD;
  return (
    <main className="min-h-screen px-4 py-10">
      <article className="card mx-auto max-w-3xl space-y-5 p-8 text-sm leading-relaxed text-slate-700 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Política de privacidad y tratamiento de datos</h1>
          <p className="mt-1 text-slate-500">VacunaApp · Última actualización: {ACTUALIZADA}</p>
        </header>

        <p>
          VacunaApp es una plataforma de software que usan los centros de vacunación para gestionar pacientes, citas,
          recordatorios e inventario de vacunas. Esta política explica cómo se tratan los datos personales conforme a la
          Ley 1581 de 2012 y sus decretos reglamentarios.
        </p>

        <h2>Responsable y encargado</h2>
        <p>
          Cada centro de vacunación es el <strong>responsable</strong> de los datos de sus pacientes. VacunaApp actúa como
          <strong> encargado</strong> del tratamiento: procesa los datos por cuenta del centro y únicamente para prestar el
          servicio contratado. Los datos de cada centro están separados y no se comparten entre centros.
        </p>

        <h2>Datos que se tratan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Identificación y contacto: nombre, documento, fecha de nacimiento, teléfono y correo electrónico.</li>
          <li>Datos de salud: vacunas aplicadas, dosis, fechas, lotes y próximas citas (datos sensibles).</li>
          <li>Autorización de mensajes y respuestas enviadas por WhatsApp (confirmar, reprogramar, SALIR, ALTA).</li>
          <li>Datos de acceso del personal del centro (nombre, correo y rol).</li>
        </ul>

        <h2>Finalidades</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Registrar el historial de vacunación y generar el carné digital del paciente.</li>
          <li>Enviar recordatorios de citas y avisos de dosis pendientes por WhatsApp y correo electrónico.</li>
          <li>Permitir que el paciente confirme o reprograme sus citas respondiendo los mensajes.</li>
          <li>Controlar el inventario de vacunas y la trazabilidad de los lotes aplicados.</li>
        </ul>

        <h2>Autorización y datos sensibles</h2>
        <p>
          El centro de vacunación solicita la autorización del paciente para el tratamiento de sus datos y para recibir
          mensajes, y registra la fecha y el medio. Suministrar datos sensibles es facultativo. Los mensajes por WhatsApp
          se envían a través de un proveedor de mensajería (Twilio).
        </p>

        <h2>Derechos del titular</h2>
        <p>
          El titular puede conocer, actualizar, rectificar y suprimir sus datos, revocar la autorización y solicitar prueba
          de ella. Para dejar de recibir mensajes basta con responder <strong>SALIR</strong> a cualquier mensaje de WhatsApp;
          con <strong>ALTA</strong> se reactivan. Las demás solicitudes se presentan ante el centro de vacunación
          {contacto ? <> o escribiendo a <strong>{contacto}</strong></> : null}, y se atienden en los plazos de la Ley 1581.
        </p>

        <h2>Seguridad y conservación</h2>
        <p>
          Los datos se almacenan cifrados en tránsito, con acceso restringido por centro y por rol, y con registro de
          cambios de autorización y de consultas del carné digital. Se conservan mientras el centro mantenga la relación
          con el paciente y lo exija la normativa de salud aplicable.
        </p>

        <p className="text-slate-500">
          Al usar los servicios de un centro de vacunación que trabaja con VacunaApp, el titular acepta esta política.
          Cualquier cambio se publicará en esta misma página.
        </p>
      </article>
    </main>
  );
}
