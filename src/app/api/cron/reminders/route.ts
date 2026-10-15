import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReminders, tomorrowISO } from "@/lib/reminders";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { aEstablecimiento } from "@/lib/establecimiento";
import { todayISO } from "@/lib/agenda";
import { urlApp } from "@/lib/carne";
import { calcularAlertasInventario } from "@/lib/inventario-alertas";
import { sendAlertasInventarioEmail, sendAvisoSuscripcionEmail } from "@/lib/notifications/email";
import { estadoSuscripcion, suscripcionBloqueada } from "@/lib/suscripcion";
import type { RecordatorioDetalle } from "@/types/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createAdminClient();
  const manana = tomorrowISO();

  const { data, error } = await db
    .from("recordatorios")
    .select(REMINDER_SELECT)
    .eq("estado_envio", "PENDIENTE")
    .eq("cita.fecha_proxima_dosis", manana)
    .neq("cita.estado", "CANCELADA")
    .returns<RecordatorioDetalle[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  // Los recordatorios de un centro suspendido no se envían
  const { data: centros } = await db.from("centros").select("*").eq("activo", true);
  const porCentro = new Map((centros ?? []).map((c) => [c.id as string, aEstablecimiento(c)]));
  const hoy = todayISO();
  // Por centro, para que processReminders junte en un solo mensaje las dosis del mismo teléfono o correo.
  // Con la suscripción vencida (pasada la gracia) no se envían: quedan pendientes hasta que renueve.
  for (const [centroId, establecimiento] of porCentro) {
    if (suscripcionBloqueada(establecimiento.suscripcion_vence, hoy)) continue;
    const delCentro = (data ?? []).filter((r) => r.centro_id === centroId);
    if (delCentro.length) results.push(...(await processReminders(db, delCentro, establecimiento)));
  }

  const adminsDe = async (centroId: string) => {
    const { data: admins } = await db.from("perfiles").select("email")
      .eq("centro_id", centroId).eq("rol", "ADMIN").eq("activo", true);
    return (admins ?? []).map((a) => a.email as string).filter(Boolean);
  };

  // Aviso de renovación a los administradores: 3 días antes, el día que vence y el día de gracia
  const suscripciones = [];
  for (const est of porCentro.values()) {
    const s = estadoSuscripcion(est.suscripcion_vence, hoy);
    const avisar = (s.estado === "POR_VENCER" && [3, 0].includes(s.dias)) || s.estado === "GRACIA";
    if (!avisar) continue;
    try {
      const to = await adminsDe(est.id!);
      if (!to.length) continue;
      await sendAvisoSuscripcionEmail({ to, establecimiento: est, estado: s, url: `${urlApp()}/dashboard/suscripcion` });
      suscripciones.push({ centro: est.nombre, estado: s.estado, ok: true });
    } catch (e) {
      suscripciones.push({ centro: est.nombre, ok: false, error: (e as Error).message });
    }
  }

  // Alertas de inventario: un email por centro a sus administradores, solo si hay algo que atender
  const inventario = [];
  for (const est of porCentro.values()) {
    try {
      const alertas = await calcularAlertasInventario(db, hoy, est.id!);
      if (alertas.total === 0) continue;
      const to = await adminsDe(est.id!);
      if (!to.length) continue;
      await sendAlertasInventarioEmail({ to, establecimiento: est, alertas, url: `${urlApp()}/dashboard/inventario` });
      inventario.push({ centro: est.nombre, alertas: alertas.total, ok: true });
    } catch (e) {
      inventario.push({ centro: est.nombre, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    inventario,
    suscripciones,
    fecha_objetivo: manana,
    total: results.length,
    enviados: results.filter((r) => r.ok).length,
    fallidos: results.filter((r) => !r.ok).length,
    detalle: results,
  });
}
