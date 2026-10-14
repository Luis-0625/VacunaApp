import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, fechasDisponibles, formatFechaLarga } from "@/lib/agenda";
import type { Establecimiento } from "@/lib/establecimiento";
import type { AutorizaMensajes } from "@/types/db";

/** Fila de la vista dosis_pendientes: última dosis aplicada con la siguiente programada. */
export interface DosisPendiente {
  cita_id: string;
  paciente_id: string;
  vacuna_id: string;
  numero_dosis: number;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string;
  nombre_completo: string;
  documento_identidad: string;
  telefono: string;
  autoriza_mensajes: AutorizaMensajes | null;
  vacuna: string;
  dosis_totales: number;
  ultimo_contacto: string | null;
}

/** No se vuelve a contactar a un paciente por la misma dosis antes de estos días. */
export const DIAS_ENTRE_CONTACTOS = 7;

export const MENSAJE_CAMPANA_DEFAULT =
  "Hola {nombre} 👋 En {centro} notamos que tienes pendiente la *dosis {dosis} de {vacuna}*, " +
  "que te correspondía el {fecha}. Completar tu esquema es importante para tu protección.";

/** Instrucciones fijas que siempre acompañan la campaña (el flujo de respuesta y la Ley 1581 dependen de ellas). */
export const PIE_CAMPANA =
  "Responde *1* para AGENDAR tu cita o *2* si ya te la aplicaste.\n\n" +
  "_Si no deseas recibir más mensajes, responde SALIR._";

export const VARIABLES_MENSAJE = ["{nombre}", "{vacuna}", "{dosis}", "{fecha}", "{centro}"];

/** Variables del mensaje para una dosis atrasada (también son las de la plantilla aprobada {{1}}…{{4}}). */
export function variablesCampana(d: DosisPendiente, centro: string) {
  return {
    nombre: d.nombre_completo.split(/\s+/)[0],
    vacuna: d.vacuna,
    dosis: String(d.numero_dosis + 1),
    fecha: formatFechaLarga(d.fecha_proxima_dosis),
    centro,
  };
}

export function renderMensaje(plantilla: string, vars: Record<string, string>): string {
  const intro = plantilla.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m).trim();
  return `${intro}\n\n${PIE_CAMPANA}`;
}

// ---------------------------------------------------------------------------------------------
// Respuestas por WhatsApp a una campaña

interface EnvioActivo {
  id: string;
  cita_id: string;
  enviado_at: string;
  respuesta: "ELIGIENDO" | null;
  opciones_fecha: string[] | null;
  cita: { numero_dosis: number; paciente: { nombre_completo: string }; vacuna: { nombre: string } };
}

/** Las respuestas a una campaña se aceptan durante este tiempo. */
const VIGENCIA_DIAS = 15;

/** Envíos de campaña que esperan respuesta de este teléfono (el más reciente primero). */
export async function enviosCampanaActivos(db: SupabaseClient, telefono: string): Promise<EnvioActivo[]> {
  const desde = new Date(Date.now() - VIGENCIA_DIAS * 86400000).toISOString();
  const { data, error } = await db
    .from("campana_envios")
    .select(`id, cita_id, enviado_at, respuesta, opciones_fecha,
      cita:citas_vacunacion!inner (numero_dosis, paciente:pacientes!inner (nombre_completo), vacuna:vacunas!inner (nombre))`)
    .eq("telefono", telefono)
    .eq("estado", "ENVIADO")
    .or("respuesta.is.null,respuesta.eq.ELIGIENDO")
    .gte("enviado_at", desde)
    .order("enviado_at", { ascending: false })
    .returns<EnvioActivo[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

const nombres = (es: EnvioActivo[]) =>
  [...new Set(es.map((e) => e.cita.paciente.nombre_completo.split(/\s+/)[0]))].join(" y ");
const dosis = (es: EnvioActivo[]) =>
  es.map((e) => `${e.cita.vacuna.nombre} (dosis ${e.cita.numero_dosis + 1})`).join(", ");

function menuFechas(opciones: string[], prefijo = ""): string {
  const lista = opciones.map((f, i) => `*${i + 1}.* ${formatFechaLarga(f)}`).join("\n");
  return `${prefijo}Elige la fecha para tu cita respondiendo con su número:\n\n${lista}\n\nResponde *0* para hacerlo más tarde.`;
}

/** Atiende la respuesta del paciente a una campaña. `texto` viene normalizado (minúsculas, sin tildes). */
export async function responderCampana(
  db: SupabaseClient,
  est: Establecimiento,
  envios: EnvioActivo[],
  texto: string,
  hoy: string,
  pie: string
): Promise<string> {
  const ahora = new Date().toISOString();
  const actualizar = async (es: EnvioActivo[], cambios: Record<string, unknown>) => {
    const { error } = await db.from("campana_envios")
      .update({ ...cambios, respondido_at: ahora }).in("id", es.map((e) => e.id));
    if (error) throw new Error(error.message);
  };

  // 1. Eligiendo fecha
  const eligiendo = envios.filter((e) => e.respuesta === "ELIGIENDO");
  if (eligiendo.length > 0) {
    const opciones = eligiendo[0].opciones_fecha ?? [];
    const n = Number(texto);
    if (Number.isInteger(n) && n >= 1 && n <= opciones.length) {
      return (await agendar(db, eligiendo, opciones[n - 1], hoy)) + pie;
    }
    if (texto === "0") {
      await actualizar(eligiendo, { respuesta: null, opciones_fecha: null });
      return "Listo. Cuando quieras agendar tu dosis responde *1*.";
    }
    return menuFechas(opciones, "No entendimos tu respuesta. ");
  }

  // 2. Primera respuesta: aplica a todas las dosis pendientes de este teléfono (ej. hijos con el mismo número)
  if (texto === "1" || /^(si|agendar|agenda|quiero|ok|claro)/.test(texto)) {
    const opciones = await fechasDisponibles(db, hoy, est);
    if (opciones.length === 0) {
      return "En este momento no tenemos fechas disponibles en línea. Comunícate con nosotros para agendar tu dosis." + pie;
    }
    await actualizar(envios, { respuesta: "ELIGIENDO", opciones_fecha: opciones });
    return menuFechas(opciones);
  }

  if (texto === "2" || /^(ya|me la apli|me vacune)/.test(texto)) {
    await actualizar(envios, { respuesta: "YA_APLICADA", opciones_fecha: null });
    return `Gracias por avisarnos, ${nombres(envios)}. Registraremos que ya recibiste ${dosis(envios)}. ` +
      "Si puedes, trae tu carné en tu próxima visita para actualizar tu historial.";
  }

  return `Hola ${nombres(envios)}, tienes pendiente: ${dosis(envios)}.\n\n${PIE_CAMPANA}`;
}

/** Agenda la dosis pendiente: mueve la próxima dosis a la fecha elegida y programa su recordatorio. */
async function agendar(db: SupabaseClient, envios: EnvioActivo[], fecha: string, hoy: string): Promise<string> {
  const programada = addDaysISO(fecha, -1);
  // Si el recordatorio del día anterior ya no alcanza a salir, la elección cuenta como confirmación.
  const sinRecordatorio = programada <= hoy;
  const ahora = new Date().toISOString();

  for (const e of envios) {
    // Primero el recordatorio (el trigger de citas solo actualiza los PENDIENTE)
    const { error: e1 } = await db.from("recordatorios").upsert({
      cita_id: e.cita_id,
      fecha_programada: programada,
      estado_envio: sinRecordatorio ? "ENVIADO" : "PENDIENTE",
      confirmacion: sinRecordatorio ? "CONFIRMADA" : null,
      opciones_fecha: null,
      respondido_at: ahora,
    }, { onConflict: "cita_id" });
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await db.from("citas_vacunacion").update({ fecha_proxima_dosis: fecha }).eq("id", e.cita_id);
    if (e2) throw new Error(e2.message);

    const { error: e3 } = await db.from("campana_envios").update({
      respuesta: "AGENDADA", fecha_agendada: fecha, opciones_fecha: null, respondido_at: ahora,
    }).eq("id", e.id);
    if (e3) throw new Error(e3.message);
  }

  return `✅ ¡Listo, ${nombres(envios)}! Tu cita quedó agendada para el *${formatFechaLarga(fecha)}* ` +
    `(${dosis(envios)}).` + (sinRecordatorio ? " ¡Te esperamos!" : " Te enviaremos un recordatorio el día anterior.");
}
