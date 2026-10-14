import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { processReminder } from "@/lib/reminders";
import { REMINDER_SELECT } from "@/lib/reminder-select";
import type { RecordatorioDetalle } from "@/types/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const g = await requireApi();
  if ("res" in g) return g.res;

  const db = createAdminClient();
  const { data, error } = await db
    .from("recordatorios")
    .select(REMINDER_SELECT)
    .eq("id", params.id)
    .maybeSingle<RecordatorioDetalle>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });

  const result = await processReminder(db, data);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
