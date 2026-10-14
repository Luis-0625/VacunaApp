import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApi } from "@/lib/auth";
import { tomorrowISO } from "@/lib/reminders";
import { enviarCarne } from "@/lib/carne";
import type { CanalEnvio } from "@/types/db";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CANALES: CanalEnvio[] = ["EMAIL", "WHATSAPP", "AMBOS"];
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Registra una dosis aplicada; calcula el nº de dosis y programa el recordatorio de la siguiente. */
export async function POST(request: NextRequest) {
  const g = await requireApi();
  if ("res" in g) return g.res;
  const db = createClient();

  const b = await request.json().catch(() => null);
  const pacienteId = String(b?.paciente_id ?? "");
  const vacunaId = String(b?.vacuna_id ?? "");
  const fecha = String(b?.fecha_aplicacion ?? "");
  const canal = (b?.canal ?? "AMBOS") as CanalEnvio;
  const proximaIn = b?.fecha_proxima_dosis ? String(b.fecha_proxima_dosis) : null;
  // Dosis aplicada en otro lugar (registrada desde el carné físico del paciente)
  const externa = b?.externa === true;
  const lugarExterno = externa ? String(b?.lugar_externo ?? "").trim() : "";

  if (!pacienteId || !vacunaId) return NextResponse.json({ error: "Selecciona paciente y vacuna" }, { status: 400 });
  if (!ISO.test(fecha)) return NextResponse.json({ error: "Fecha de aplicación inválida" }, { status: 400 });
  if (externa && !lugarExterno) return NextResponse.json({ error: "Indica dónde se aplicó la dosis" }, { status: 400 });
  if (lugarExterno.length > 150) return NextResponse.json({ error: "El lugar de aplicación es demasiado largo" }, { status: 400 });
  if (externa && fecha > addDays(tomorrowISO(), -1)) {
    return NextResponse.json({ error: "Una dosis externa no puede tener fecha futura" }, { status: 400 });
  }
  if (!CANALES.includes(canal)) return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  if (proximaIn && !ISO.test(proximaIn)) return NextResponse.json({ error: "Fecha de próxima dosis inválida" }, { status: 400 });

  const { data: vacuna } = await db.from("vacunas").select("id, nombre, dosis_totales").eq("id", vacunaId).maybeSingle();
  if (!vacuna) return NextResponse.json({ error: "Vacuna no encontrada" }, { status: 404 });

  const { data: previas, error: prevErr } = await db
    .from("citas_vacunacion").select("id, numero_dosis")
    .eq("paciente_id", pacienteId).eq("vacuna_id", vacunaId).neq("estado", "CANCELADA");
  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 });

  const numeroDosis = Math.max(0, ...(previas ?? []).map((c) => c.numero_dosis)) + 1;
  if (numeroDosis > vacuna.dosis_totales) {
    return NextResponse.json(
      { error: `El paciente ya completó el esquema de ${vacuna.nombre} (${vacuna.dosis_totales} dosis)` },
      { status: 409 }
    );
  }

  // La última dosis del esquema no tiene "próxima".
  const proxima = numeroDosis === vacuna.dosis_totales ? null : proximaIn;
  if (proxima) {
    if (proxima <= fecha) return NextResponse.json({ error: "La próxima dosis debe ser posterior a la aplicación" }, { status: 400 });
    const manana = tomorrowISO();
    if (proxima === manana || proxima === addDays(manana, -1)) {
      return NextResponse.json(
        { error: "La próxima dosis debe ser en 2 días o más para poder enviar el recordatorio un día antes" },
        { status: 400 }
      );
    }
  }

  const { data: cita, error } = await db
    .from("citas_vacunacion")
    .insert({
      paciente_id: pacienteId, vacuna_id: vacunaId, numero_dosis: numeroDosis,
      fecha_aplicacion: fecha, fecha_proxima_dosis: proxima, estado: "COMPLETADA",
      aplicada_por: g.perfil.user_id, // en las externas: quién la registró
      externa, lugar_externo: lugarExterno || null,
    })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El trigger crea el recordatorio (1 día antes); aquí se fija el canal elegido.
  if (proxima) await db.from("recordatorios").update({ canal }).eq("cita_id", cita.id);

  // Si la dosis se aplicó antes de lo previsto, se anula el recordatorio pendiente de la dosis anterior.
  const previasIds = (previas ?? []).map((c) => c.id);
  if (previasIds.length) {
    await db.from("recordatorios").delete().in("cita_id", previasIds).eq("estado_envio", "PENDIENTE");
  }

  // Carné digital actualizado por WhatsApp; si falla, la vacunación ya quedó registrada igual.
  // No se envía al registrar una dosis externa (el paciente no se acaba de vacunar aquí).
  let carne: { enviado: true } | { enviado: false; error: string } | null = null;
  if (!externa) {
    try {
      await enviarCarne(db, pacienteId);
      carne = { enviado: true };
    } catch (e) {
      carne = { enviado: false, error: (e as Error).message };
    }
  }

  return NextResponse.json({
    numero_dosis: numeroDosis,
    dosis_totales: vacuna.dosis_totales,
    fecha_proxima_dosis: proxima,
    recordatorio_para: proxima ? addDays(proxima, -1) : null,
    carne,
  }, { status: 201 });
}
