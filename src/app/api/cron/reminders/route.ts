import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReminder, tomorrowISO } from "@/lib/reminders";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import { getEstablecimiento } from "@/lib/establecimiento";
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
  const establecimiento = await getEstablecimiento(db);
  for (const r of data ?? []) results.push(await processReminder(db, r, establecimiento));

  return NextResponse.json({
    fecha_objetivo: manana,
    total: results.length,
    enviados: results.filter((r) => r.ok).length,
    fallidos: results.filter((r) => !r.ok).length,
    detalle: results,
  });
}
