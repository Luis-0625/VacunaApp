import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import type { Paciente, Perfil, Recordatorio, Vacuna } from "@/types/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CitaRow {
  numero_dosis: number; fecha_aplicacion: string; fecha_proxima_dosis: string | null; estado: string;
  aplicada_por: string | null;
  paciente: { nombre_completo: string; documento_identidad: string };
  vacuna: { nombre: string; dosis_totales: number };
}
interface RecRow extends Recordatorio {
  cita: { paciente: { nombre_completo: string }; vacuna: { nombre: string } };
}

/** Exporta TODOS los datos a un Excel con una hoja por tabla. Solo ADMIN. */
export async function GET() {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;
  const db = createClient();

  try {
    const [pacientes, vacunas, citas, recs, perfiles] = await Promise.all([
      fetchAll<Paciente>((f, t) => db.from("pacientes").select("*").order("nombre_completo").order("id").range(f, t).returns<Paciente[]>()),
      fetchAll<Vacuna>((f, t) => db.from("vacunas").select("*").order("nombre").order("id").range(f, t).returns<Vacuna[]>()),
      fetchAll<CitaRow>((f, t) => db.from("citas_vacunacion")
        .select("id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, estado, aplicada_por, paciente:pacientes!inner(nombre_completo, documento_identidad), vacuna:vacunas!inner(nombre, dosis_totales)")
        .order("fecha_aplicacion", { ascending: false }).order("id").range(f, t).returns<CitaRow[]>()),
      fetchAll<RecRow>((f, t) => db.from("recordatorios")
        .select("id, cita_id, estado_envio, canal, fecha_programada, intentos, ultimo_error, cita:citas_vacunacion!inner(paciente:pacientes!inner(nombre_completo), vacuna:vacunas!inner(nombre))")
        .order("fecha_programada", { ascending: false }).order("id").range(f, t).returns<RecRow[]>()),
      fetchAll<Perfil>((f, t) => db.from("perfiles").select("*").order("user_id").range(f, t).returns<Perfil[]>()),
    ]);
    const nombreDe = new Map(perfiles.map((p) => [p.user_id, p.nombre]));

    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: Record<string, unknown>[]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);

    add("Pacientes", pacientes.map((p) => ({
      nombre_completo: p.nombre_completo, documento_identidad: p.documento_identidad, telefono: p.telefono,
      email: p.email ?? "", fecha_nacimiento: p.fecha_nacimiento ?? "", registrado: p.created_at.slice(0, 10),
    })));
    add("Vacunas", vacunas.map((v) => ({
      nombre: v.nombre, dosis_totales: v.dosis_totales, intervalo_dias: v.intervalo_dias_recom_dosis ?? "", descripcion: v.descripcion ?? "",
    })));
    add("Vacunaciones", citas.map((c) => ({
      paciente: c.paciente.nombre_completo, documento: c.paciente.documento_identidad, vacuna: c.vacuna.nombre,
      dosis: `${c.numero_dosis}/${c.vacuna.dosis_totales}`, fecha_aplicacion: c.fecha_aplicacion,
      proxima_dosis: c.fecha_proxima_dosis ?? "", estado: c.estado, aplicada_por: c.aplicada_por ? nombreDe.get(c.aplicada_por) ?? "" : "",
    })));
    add("Recordatorios", recs.map((r) => ({
      paciente: r.cita.paciente.nombre_completo, vacuna: r.cita.vacuna.nombre, fecha_programada: r.fecha_programada,
      canal: r.canal, estado: r.estado_envio, intentos: r.intentos, detalle: r.ultimo_error ?? "",
    })));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="vacunaapp-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
