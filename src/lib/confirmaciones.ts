import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, fechasDisponibles, formatFechaLarga, todayISO } from "@/lib/agenda";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { toE164 } from "@/lib/phone";
import { datosContacto, getEstablecimiento, type Establecimiento } from "@/lib/establecimiento";
import { enviosCampanaActivos, responderCampana } from "@/lib/campanas";
import type { AutorizaMensajes, RecordatorioDetalle } from "@/types/db";

type Detalle = RecordatorioDetalle & { cita: NonNullable<RecordatorioDetalle["cita"]> };

const INSTRUCCIONES = "Responde *1* para CONFIRMAR tu cita o *2* para REPROGRAMARLA.";

/** Minúsculas y sin tildes: "Sí" -> "si". */
const normalizar = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const nombres = (rs: Detalle[]) =>
  rs.map((r) => r.cita.paciente.nombre_completo.split(/\s+/)[0]).join(" y ");

const listaVacunas = (rs: Detalle[]) =>
  rs.map((r) => `${r.cita.vacuna.nombre} (dosis ${r.cita.numero_dosis})`).join(", ");

/**
 * Procesa un mensaje entrante de WhatsApp/SMS y devuelve el texto de respuesta.
 * Si varios pacientes comparten el teléfono (ej. hijos con el número de la madre) y tienen cita
 * el mismo día, la respuesta aplica a todos ellos.
 */
export async function procesarMensajeEntrante(
  db: SupabaseClient,
  from: string,
  body: string
): Promise<string> {
  const est = await getEstablecimiento(db);
  return `${await responder(db, est, from, body)}\n\n— ${est.nombre}`;
}

async function responder(db: SupabaseClient, est: Establecimiento, from: string, body: string): Promise<string> {
  const contacto = datosContacto(est);
  const pie = contacto ? `\n\n${contacto}` : "";
  const telefono = toE164(from.replace(/^whatsapp:/i, ""), process.env.DEFAULT_COUNTRY_CODE ?? "57");
  if (!telefono) return "No pudimos identificar tu número. Comunícate con nosotros directamente.";

  // Autorización de mensajes (Ley 1581): el paciente puede retirarla o renovarla en cualquier momento
  const texto = normalizar(body);
  if (/^(salir|baja|stop|parar|detener|no mas mensajes)\b/.test(texto)) {
    return cambiarAutorizacion(db, telefono, "NO_AUTORIZADO");
  }
  if (/^(alta|start|reanudar)\b/.test(texto)) {
    return cambiarAutorizacion(db, telefono, "AUTORIZADO");
  }

  const hoy = todayISO();
  const { data, error } = await db
    .from("recordatorios")
    .select(REMINDER_SELECT)
    .eq("estado_envio", "ENVIADO")
    .not("enviado_at", "is", null)
    .or("confirmacion.is.null,confirmacion.eq.REPROGRAMANDO")
    .eq("cita.paciente.telefono", telefono)
    .gte("cita.fecha_proxima_dosis", hoy)
    .neq("cita.estado", "CANCELADA")
    .order("enviado_at", { ascending: false })
    .returns<RecordatorioDetalle[]>();
  if (error) throw new Error(error.message);

  const activos = (data ?? []).filter((r): r is Detalle => !!r.cita);

  // Campaña de pacientes atrasados: se atiende si es el mensaje más reciente que recibió este número
  const campana = await enviosCampanaActivos(db, telefono);
  if (campana.length > 0 &&
      (activos.length === 0 || Date.parse(campana[0].enviado_at) >= Date.parse(activos[0].enviado_at ?? "0"))) {
    return responderCampana(db, est, campana, texto, hoy, pie);
  }

  if (activos.length === 0) {
    return "Hola 👋 No tienes citas pendientes por confirmar con este número. Si necesitas ayuda, comunícate con nosotros.";
  }

  // 1. El paciente está eligiendo una nueva fecha
  const eligiendo = activos.filter((r) => r.confirmacion === "REPROGRAMANDO");
  if (eligiendo.length > 0) {
    const opciones = eligiendo[0].opciones_fecha ?? [];
    const n = Number(texto);
    if (Number.isInteger(n) && n >= 1 && n <= opciones.length) {
      return (await reprogramar(db, eligiendo, opciones[n - 1], hoy)) + pie;
    }
    if (texto === "0" || texto === "cancelar") {
      await actualizar(db, eligiendo, { confirmacion: null, opciones_fecha: null });
      return `Listo, conservamos tu cita del ${formatFechaLarga(eligiendo[0].cita.fecha_proxima_dosis!)}. ${INSTRUCCIONES}`;
    }
    return menuFechas(opciones, "No entendimos tu respuesta. ");
  }

  // 2. Primera respuesta al recordatorio: agrupa las citas del mismo día
  const fecha = activos[0].cita.fecha_proxima_dosis!;
  const grupo = activos.filter((r) => r.cita.fecha_proxima_dosis === fecha);

  if (texto === "1" || /^(si|confirm|ok|listo|claro)/.test(texto)) {
    await actualizar(db, grupo, { confirmacion: "CONFIRMADA" });
    return `¡Gracias, ${nombres(grupo)}! ✅ Tu cita del ${formatFechaLarga(fecha)} quedó CONFIRMADA ` +
      `para: ${listaVacunas(grupo)}. Te esperamos.` + pie;
  }

  if (texto === "2" || /^(no|reprogram|cambiar|mover|otra)/.test(texto)) {
    const opciones = await fechasDisponibles(db, fecha > hoy ? fecha : hoy, est);
    if (opciones.length === 0) {
      return "En este momento no tenemos fechas disponibles en línea. Comunícate con nosotros para reprogramar tu cita." + pie;
    }
    await actualizar(db, grupo, { confirmacion: "REPROGRAMANDO", opciones_fecha: opciones });
    return menuFechas(opciones);
  }

  return `Hola ${nombres(grupo)}, tienes cita el ${formatFechaLarga(fecha)} para: ${listaVacunas(grupo)}.\n\n${INSTRUCCIONES}`;
}

/** Aplica la autorización a todos los pacientes con ese teléfono (queda en autorizaciones_log). */
async function cambiarAutorizacion(db: SupabaseClient, telefono: string, estado: AutorizaMensajes): Promise<string> {
  const { data, error } = await db
    .from("pacientes")
    .update({ autoriza_mensajes: estado, autorizacion_medio: "WHATSAPP" })
    .eq("telefono", telefono)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return "No encontramos pacientes registrados con este número.";

  return estado === "NO_AUTORIZADO"
    ? "Listo. No te enviaremos más recordatorios a este número. Si cambias de opinión, responde *ALTA*."
    : "¡Listo! Volverás a recibir los recordatorios de tus vacunas. Puedes responder *SALIR* en cualquier momento para dejar de recibirlos.";
}

function menuFechas(opciones: string[], prefijo = ""): string {
  const lista = opciones.map((f, i) => `*${i + 1}.* ${formatFechaLarga(f)}`).join("\n");
  return `${prefijo}Elige la nueva fecha respondiendo con su número:\n\n${lista}\n\nResponde *0* para conservar tu cita actual.`;
}

async function actualizar(db: SupabaseClient, rs: Detalle[], cambios: Record<string, unknown>) {
  const { error } = await db
    .from("recordatorios")
    .update({ ...cambios, respondido_at: new Date().toISOString() })
    .in("id", rs.map((r) => r.id));
  if (error) throw new Error(error.message);
}

async function reprogramar(db: SupabaseClient, rs: Detalle[], nuevaFecha: string, hoy: string): Promise<string> {
  const programada = addDaysISO(nuevaFecha, -1);
  // Si el recordatorio del día anterior ya no alcanza a salir, la elección cuenta como confirmación.
  const sinRecordatorio = programada <= hoy;
  const ahora = new Date().toISOString();

  for (const r of rs) {
    // Primero el recordatorio: el trigger de citas solo actualiza recordatorios PENDIENTE.
    const { error: e1 } = await db
      .from("recordatorios")
      .update({
        estado_envio: sinRecordatorio ? "ENVIADO" : "PENDIENTE",
        fecha_programada: programada,
        confirmacion: sinRecordatorio ? "CONFIRMADA" : "REPROGRAMADA",
        opciones_fecha: null,
        reprogramaciones: r.reprogramaciones + 1,
        respondido_at: ahora,
      })
      .eq("id", r.id);
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await db
      .from("citas_vacunacion")
      .update({ fecha_proxima_dosis: nuevaFecha })
      .eq("id", r.cita_id);
    if (e2) throw new Error(e2.message);
  }

  return `✅ Listo, ${nombres(rs)}. Tu cita quedó reprogramada para el *${formatFechaLarga(nuevaFecha)}* ` +
    `(${listaVacunas(rs)}).` +
    (sinRecordatorio ? " ¡Te esperamos!" : " Te enviaremos un recordatorio el día anterior.");
}
