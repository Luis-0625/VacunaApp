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
  body: string,
  to = ""
): Promise<string> {
  const telefono = toE164(from.replace(/^whatsapp:/i, ""), process.env.DEFAULT_COUNTRY_CODE ?? "57");
  if (!telefono) return "No pudimos identificar tu número. Comunícate con tu centro de vacunación.";

  const centroId = await resolverCentro(db, telefono, to);
  if (!centroId) return "Hola 👋 No encontramos citas programadas con este número. Si necesitas ayuda, comunícate con tu centro de vacunación.";
  const est = await getEstablecimiento(db, centroId);
  if (!est.activo) return "Este servicio no está disponible en este momento. Comunícate con tu centro de vacunación.";
  return `${await responder(db, est, centroId, telefono, body)}\n\n— ${est.nombre}`;
}

/**
 * Centro al que escribe el paciente: el dueño del número de WhatsApp de destino; si comparten el
 * número de la plataforma, el centro que le escribió más recientemente; si no, el de su registro.
 */
async function resolverCentro(db: SupabaseClient, telefono: string, to: string): Promise<string | null> {
  if (to) {
    const { data } = await db.from("centros").select("id").eq("whatsapp_from", to).maybeSingle();
    if (data) return data.id;
  }
  const [rec, camp] = await Promise.all([
    db.from("recordatorios").select("centro_id, enviado_at, cita:citas_vacunacion!inner(paciente:pacientes!inner(telefono))")
      .eq("cita.paciente.telefono", telefono).not("enviado_at", "is", null)
      .order("enviado_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("campana_envios").select("centro_id, enviado_at")
      .eq("telefono", telefono).not("enviado_at", "is", null)
      .order("enviado_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ultimos = [rec.data, camp.data].filter((x): x is { centro_id: string; enviado_at: string } => !!x)
    .sort((a, b) => Date.parse(b.enviado_at) - Date.parse(a.enviado_at));
  if (ultimos.length) return ultimos[0].centro_id;

  const { data: paciente } = await db.from("pacientes").select("centro_id")
    .eq("telefono", telefono).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return paciente?.centro_id ?? null;
}

async function responder(
  db: SupabaseClient, est: Establecimiento, centroId: string, telefono: string, body: string
): Promise<string> {
  const contacto = datosContacto(est);
  const pie = contacto ? `\n\n${contacto}` : "";

  // Autorización de mensajes (Ley 1581): el paciente puede retirarla o renovarla en cualquier momento
  const texto = normalizar(body);
  if (/^(salir|baja|stop|parar|detener|no mas mensajes)\b/.test(texto)) {
    return cambiarAutorizacion(db, centroId, telefono, "NO_AUTORIZADO");
  }
  if (/^(alta|start|reanudar)\b/.test(texto)) {
    return cambiarAutorizacion(db, centroId, telefono, "AUTORIZADO");
  }

  const hoy = todayISO();
  const { data, error } = await db
    .from("recordatorios")
    .select(REMINDER_SELECT)
    .eq("centro_id", centroId)
    .in("estado_envio", ["PENDIENTE", "ENVIADO"])
    .eq("cita.paciente.telefono", telefono)
    .gte("cita.fecha_proxima_dosis", hoy)
    .neq("cita.estado", "CANCELADA")
    .returns<RecordatorioDetalle[]>();
  if (error) throw new Error(error.message);

  // Primero quien está eligiendo fecha, luego el recordatorio enviado más reciente y después la cita más próxima.
  // Así el paciente puede escribir en cualquier momento (aunque ya haya confirmado) para confirmar, adelantar
  // o aplazar su próxima cita.
  const activos = (data ?? [])
    .filter((r): r is Detalle => !!r.cita)
    .sort((a, b) =>
      (b.confirmacion === "REPROGRAMANDO" ? 1 : 0) - (a.confirmacion === "REPROGRAMANDO" ? 1 : 0) ||
      Date.parse(b.enviado_at ?? "1970-01-01") - Date.parse(a.enviado_at ?? "1970-01-01") ||
      a.cita.fecha_proxima_dosis!.localeCompare(b.cita.fecha_proxima_dosis!));

  // Campaña de pacientes atrasados: se atiende si es el mensaje más reciente que recibió este número
  const campana = await enviosCampanaActivos(db, centroId, telefono);
  if (campana.length > 0 &&
      (activos.length === 0 || Date.parse(campana[0].enviado_at) >= Date.parse(activos[0].enviado_at ?? "0"))) {
    return responderCampana(db, est, campana, texto, hoy, pie);
  }

  if (activos.length === 0) {
    return "Hola 👋 No encontramos citas programadas con este número. Si necesitas ayuda, comunícate con nosotros.";
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
    return menuFechas(opciones, "No entendimos tu respuesta. ", eligiendo[0].cita.fecha_proxima_dosis!);
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
    const opciones = await opcionesReprogramacion(db, est, grupo, fecha, hoy);
    if (opciones.length === 0) {
      return "En este momento no tenemos fechas disponibles en línea. Comunícate con nosotros para reprogramar tu cita." + pie;
    }
    await actualizar(db, grupo, { confirmacion: "REPROGRAMANDO", opciones_fecha: opciones });
    return menuFechas(opciones, "", fecha);
  }

  return `Hola ${nombres(grupo)}, tienes cita el ${formatFechaLarga(fecha)} para: ${listaVacunas(grupo)}.\n\n${INSTRUCCIONES}`;
}

/** Aplica la autorización a todos los pacientes con ese teléfono (queda en autorizaciones_log). */
async function cambiarAutorizacion(
  db: SupabaseClient, centroId: string, telefono: string, estado: AutorizaMensajes
): Promise<string> {
  const { data, error } = await db
    .from("pacientes")
    .update({ autoriza_mensajes: estado, autorizacion_medio: "WHATSAPP" })
    .eq("centro_id", centroId)
    .eq("telefono", telefono)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return "No encontramos pacientes registrados con este número.";

  return estado === "NO_AUTORIZADO"
    ? "Listo. No te enviaremos más recordatorios a este número. Si cambias de opinión, responde *ALTA*."
    : "¡Listo! Volverás a recibir los recordatorios de tus vacunas. Puedes responder *SALIR* en cualquier momento para dejar de recibirlos.";
}

/** Fechas por número de opción, separadas en "Adelantar" y "Aplazar" respecto a la cita actual. */
function menuFechas(opciones: string[], prefijo: string, actual: string): string {
  const linea = (f: string) => `*${opciones.indexOf(f) + 1}.* ${formatFechaLarga(f)}`;
  const antes = opciones.filter((f) => f < actual);
  const despues = opciones.filter((f) => f > actual);
  const bloques = [
    antes.length && `⬅️ *Adelantar:*\n${antes.map(linea).join("\n")}`,
    despues.length && `➡️ *Aplazar:*\n${despues.map(linea).join("\n")}`,
  ].filter(Boolean).join("\n\n");
  return `${prefijo}Tu cita actual es el ${formatFechaLarga(actual)}. Elige la nueva fecha respondiendo con su número:\n\n` +
    `${bloques}\n\nResponde *0* para conservar tu cita actual.`;
}

/** Cuántas fechas se ofrecen para adelantar y cuántas para aplazar. */
const OPCIONES_POR_LADO = 3;

/**
 * Fechas para reprogramar: hasta 3 antes de la cita (desde que se cumple el intervalo recomendado
 * desde la dosis anterior, y nunca antes de mañana) y hasta 3 después.
 */
async function opcionesReprogramacion(
  db: SupabaseClient, est: Establecimiento, grupo: Detalle[], actual: string, hoy: string
): Promise<string[]> {
  // Fecha mínima: la más tardía entre los pacientes del grupo (todos deben cumplir su intervalo)
  const minima = grupo.reduce((m, r) => {
    const intervalo = r.cita.vacuna.intervalo_dias_recom_dosis;
    const f = intervalo ? addDaysISO(r.cita.fecha_aplicacion, intervalo) : hoy;
    return f > m ? f : m;
  }, addDaysISO(hoy, 1));

  const antes = minima < actual
    ? (await fechasDisponibles(db, addDaysISO(minima, -1), est, OPCIONES_POR_LADO)).filter((f) => f < actual)
    : [];
  const despues = await fechasDisponibles(db, actual > hoy ? actual : hoy, est, OPCIONES_POR_LADO);
  return [...antes, ...despues];
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
