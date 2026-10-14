import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/agenda";
import { getEstablecimiento } from "@/lib/establecimiento";
import {
  DIAS_ENTRE_CONTACTOS, renderMensaje, variablesCampana, type DosisPendiente,
} from "@/lib/campanas";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Crea una campaña para las dosis atrasadas seleccionadas (los envíos se hacen luego por lotes). */
export async function POST(request: NextRequest) {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const nombre = String(b?.nombre ?? "").trim();
  const mensaje = String(b?.mensaje ?? "").trim();
  const incluirSinRegistrar = b?.incluir_sin_registrar === true;
  const ids: string[] = Array.isArray(b?.cita_ids) ? [...new Set(b.cita_ids.map(String))] as string[] : [];

  if (!nombre || nombre.length > 120) return NextResponse.json({ error: "Escribe un nombre para la campaña" }, { status: 400 });
  if (!mensaje || mensaje.length > 1000) return NextResponse.json({ error: "El mensaje debe tener entre 1 y 1000 caracteres" }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Selecciona al menos un paciente" }, { status: 400 });
  if (ids.length > 2000) return NextResponse.json({ error: "Máximo 2000 pacientes por campaña" }, { status: 400 });
  if (ids.some((id) => !UUID.test(id))) return NextResponse.json({ error: "Selección inválida" }, { status: 400 });

  const db = createAdminClient();
  const filas: DosisPendiente[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from("dosis_pendientes").select("*")
      .eq("centro_id", g.perfil.centro_id).in("cita_id", ids.slice(i, i + 150)).returns<DosisPendiente[]>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    filas.push(...(data ?? []));
  }

  // Se vuelve a validar en el servidor: solo atrasados, con autorización y sin contacto reciente
  const hoy = todayISO();
  const limiteContacto = Date.now() - DIAS_ENTRE_CONTACTOS * 86400000;
  const omitidos = { no_atrasados: ids.length - filas.length, no_autoriza: 0, sin_registrar: 0, contactados: 0 };
  const destino = filas.filter((d) => {
    if (d.fecha_proxima_dosis >= hoy) { omitidos.no_atrasados++; return false; }
    if (d.autoriza_mensajes === "NO_AUTORIZADO") { omitidos.no_autoriza++; return false; }
    if (!d.autoriza_mensajes && !incluirSinRegistrar) { omitidos.sin_registrar++; return false; }
    if (d.ultimo_contacto && Date.parse(d.ultimo_contacto) > limiteContacto) { omitidos.contactados++; return false; }
    return true;
  });
  if (!destino.length) {
    return NextResponse.json({ error: "Ningún paciente seleccionado se puede contactar", omitidos }, { status: 400 });
  }

  const { data: campana, error: e1 } = await db.from("campanas")
    .insert({ nombre, mensaje, creada_por: g.perfil.user_id, centro_id: g.perfil.centro_id }).select("id").single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const est = await getEstablecimiento(db, g.perfil.centro_id);
  const envios = destino.map((d) => {
    const v = variablesCampana(d, est.nombre);
    return {
      campana_id: campana.id,
      centro_id: g.perfil.centro_id,
      paciente_id: d.paciente_id,
      cita_id: d.cita_id,
      telefono: d.telefono,
      mensaje: renderMensaje(mensaje, v),
      variables: { 1: v.nombre, 2: v.vacuna, 3: v.dosis, 4: v.fecha },
    };
  });
  for (let i = 0; i < envios.length; i += 500) {
    const { error } = await db.from("campana_envios").insert(envios.slice(i, i + 500));
    if (error) {
      await db.from("campanas").delete().eq("id", campana.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: campana.id, total: envios.length, omitidos }, { status: 201 });
}
