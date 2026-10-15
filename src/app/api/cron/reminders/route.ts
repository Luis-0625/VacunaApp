import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReminders, tomorrowISO } from "@/lib/reminders";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { aEstablecimiento } from "@/lib/establecimiento";
import { todayISO } from "@/lib/agenda";
import { urlApp } from "@/lib/carne";
import { calcularAlertasInventario } from "@/lib/inventario-alertas";
import { sendAlertasInventarioEmail } from "@/lib/notifications/email";
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
  // Por centro, para que processReminders junte en un solo mensaje las dosis del mismo teléfono o correo
  for (const [centroId, establecimiento] of porCentro) {
    const delCentro = (data ?? []).filter((r) => r.centro_id === centroId);
    if (delCentro.length) results.push(...(await processReminders(db, delCentro, establecimiento)));
  }

  // Alertas de inventario: un email por centro a sus administradores, solo si hay algo que atender
  const hoy = todayISO();
  const inventario = [];
  for (const est of porCentro.values()) {
    try {
      const alertas = await calcularAlertasInventario(db, hoy, est.id!);
      if (alertas.total === 0) continue;
      const { data: admins } = await db.from("perfiles").select("email")
        .eq("centro_id", est.id!).eq("rol", "ADMIN").eq("activo", true);
      const to = (admins ?? []).map((a) => a.email as string).filter(Boolean);
      if (!to.length) continue;
      await sendAlertasInventarioEmail({ to, establecimiento: est, alertas, url: `${urlApp()}/dashboard/inventario` });
      inventario.push({ centro: est.nombre, alertas: alertas.total, ok: true });
    } catch (e) {
      inventario.push({ centro: est.nombre, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    inventario,
    fecha_objetivo: manana,
    total: results.length,
    enviados: results.filter((r) => r.ok).length,
    fallidos: results.filter((r) => !r.ok).length,
    detalle: results,
  });
}
