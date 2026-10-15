import type { Metadata } from "next";
import Link from "next/link";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = { title: "Términos y condiciones" };

const ACTUALIZADOS = "15 de octubre de 2026";

/** Términos del servicio SaaS. Enlazados desde el footer de la landing; Meta y Twilio los revisan. */
export default function TerminosPage() {
  const titular = EMPRESA.razonSocial || EMPRESA.nombreComercial;
  return (
    <main className="min-h-screen px-4 py-10">
      <article className="card mx-auto max-w-3xl space-y-5 p-8 text-sm leading-relaxed text-slate-700 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Términos y condiciones del servicio</h1>
          <p className="mt-1 text-slate-500">VacunaApp · Última actualización: {ACTUALIZADOS}</p>
        </header>

        <p>
          Estos términos regulan el uso de VacunaApp, plataforma de software como servicio (SaaS) ofrecida por{" "}
          <strong>{titular}</strong>
          {EMPRESA.nit && <>, NIT {EMPRESA.nit}</>}, con domicilio en {EMPRESA.ciudad}, a centros de vacunación, clínicas e
          IPS (el &quot;Cliente&quot;). Al contratar o usar el servicio, el Cliente acepta estos términos.
        </p>

        <h2>1. El servicio</h2>
        <p>
          VacunaApp permite gestionar pacientes, citas, recordatorios por WhatsApp y correo electrónico, historial de
          vacunación, carné digital e inventario de vacunas por lote. Las funciones disponibles dependen del plan contratado.
        </p>

        <h2>2. Planes, pagos y prueba gratuita</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Los planes se facturan por mes o por año, por anticipado, en pesos colombianos.</li>
          <li>La prueba gratuita dura 6 días y no genera cobro si el Cliente no contrata un plan al finalizarla.</li>
          <li>El onboarding tiene un valor único y es gratuito al contratar un plan anual.</li>
          <li>Si un pago no se recibe, el servicio puede suspenderse hasta que se ponga al día; los datos se conservan.</li>
        </ul>

        <h2>3. Permanencia y cancelación</h2>
        <p>
          El plan mensual no tiene permanencia: el Cliente puede cancelarlo o cambiarlo en cualquier momento y el cambio
          aplica al siguiente periodo. El plan anual no es reembolsable una vez iniciado el periodo. Al cancelar, el Cliente
          puede solicitar la exportación de sus datos durante los 30 días siguientes, tras los cuales se eliminan.
        </p>

        <h2>4. Datos personales</h2>
        <p>
          El Cliente es responsable del tratamiento de los datos de sus pacientes y de obtener su autorización conforme a la
          Ley 1581 de 2012. VacunaApp actúa como encargado del tratamiento según la{" "}
          <Link href="/privacidad" className="font-medium text-brand-600 hover:underline">política de privacidad</Link>.
          Los datos de cada Cliente están aislados y no se comparten con otros clientes.
        </p>

        <h2>5. Mensajes por WhatsApp</h2>
        <p>
          Los mensajes se envían por WhatsApp Business a través de un proveedor de mensajería (Twilio) y están sujetos a las políticas de Meta y de Twilio. El
          Cliente se compromete a enviar mensajes solo a pacientes que lo hayan autorizado y a no usar el servicio para
          publicidad no solicitada. Los costos por mensaje que cobren Meta y Twilio pueden facturarse aparte según el plan.
        </p>

        <h2>6. Uso aceptable</h2>
        <p>
          El Cliente es responsable de sus usuarios y contraseñas, y de la veracidad de la información clínica que registra.
          No está permitido usar la plataforma para fines ilícitos, intentar acceder a datos de otros clientes ni afectar su
          funcionamiento.
        </p>

        <h2>7. Disponibilidad y soporte</h2>
        <p>
          Trabajamos para mantener el servicio disponible de forma continua, con respaldos en la nube, salvo mantenimientos
          programados o fallas de proveedores externos (hosting, Twilio, Meta, operadores de correo). El soporte se presta por los
          canales y en los horarios de cada plan.
        </p>

        <h2>8. Responsabilidad</h2>
        <p>
          VacunaApp es una herramienta de apoyo administrativo y no reemplaza el criterio del personal de salud. La
          responsabilidad total de {titular} frente al Cliente se limita al valor pagado por el servicio en los últimos tres
          meses.
        </p>

        <h2>9. Cambios y ley aplicable</h2>
        <p>
          Estos términos pueden actualizarse; los cambios se publicarán en esta página y se avisarán al Cliente con
          antelación razonable. Se rigen por las leyes de la República de Colombia.
        </p>

        {EMPRESA.email && (
          <p className="text-slate-500">
            Contacto: <a href={`mailto:${EMPRESA.email}`} className="font-medium text-brand-600 hover:underline">{EMPRESA.email}</a>
          </p>
        )}
        <p><Link href="/" className="font-medium text-brand-600 hover:underline">← Volver al inicio</Link></p>
      </article>
    </main>
  );
}
