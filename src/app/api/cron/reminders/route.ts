import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReminder, tomorrowISO } from "@/lib/reminders";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { aEstablecimiento } from "@/lib/establecimiento";
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
  for (const r of data ?? []) {
    const establecimiento = porCentro.get(r.centro_id);
    if (establecimiento) results.push(await processReminder(db, r, establecimiento));
  }

  return NextResponse.json({
    fecha_objetivo: manana,
    total: results.length,
    enviados: results.filter((r) => r.ok).length,
    fallidos: results.filter((r) => !r.ok).length,
    detalle: results,
  });
}
