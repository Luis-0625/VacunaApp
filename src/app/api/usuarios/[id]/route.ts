import { NextResponse, type NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Cambia rol, estado o nombre de un usuario. Solo ADMIN; no puede modificar su propio rol/estado. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const b = await request.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (b?.rol !== undefined) {
    if (b.rol !== "ADMIN" && b.rol !== "VACUNADOR") return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    update.rol = b.rol;
  }
  if (b?.activo !== undefined) update.activo = Boolean(b.activo);
  if (b?.nombre !== undefined) {
    const nombre = String(b.nombre).trim();
    if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    update.nombre = nombre;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  if (params.id === g.perfil.user_id && ("rol" in update || "activo" in update)) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol ni desactivarte" }, { status: 400 });
  }

  const { error } = await createAdminClient().from("perfiles").update(update).eq("user_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
