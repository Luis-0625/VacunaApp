import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { construirPlantilla } from "@/lib/plantilla-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Descarga la plantilla de carga inicial (Excel con colores, notas y listas desplegables). Solo ADMIN. */
export async function GET() {
  const g = await requireApi(["ADMIN"]);
  if ("res" in g) return g.res;

  const archivo = await construirPlantilla();
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-carga-inicial-vacunaapp.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
