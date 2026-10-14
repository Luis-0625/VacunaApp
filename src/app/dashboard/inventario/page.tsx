import InventarioManager, { type Movimiento } from "@/components/InventarioManager";
import { PageHeader } from "@/components/ui";
import { requirePerfilPage } from "@/lib/auth";
import { todayISO } from "@/lib/agenda";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import type { Lote, Vacuna } from "@/types/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventario" };

export default async function InventarioPage() {
  const perfil = await requirePerfilPage();
  const db = await createClient();
  const hoy = todayISO();

  const [vacunas, lotes, movimientos] = await Promise.all([
    db.from("vacunas").select("id, nombre, stock_minimo").order("nombre")
      .returns<Pick<Vacuna, "id" | "nombre" | "stock_minimo">[]>(),
    fetchAll<Lote>((f, t) => db.from("lotes").select("*").order("fecha_vencimiento").order("id").range(f, t).returns<Lote[]>())
      .catch(() => null),
    db.from("inventario_movimientos")
      .select(`id, tipo, cantidad, motivo, detalle, created_at,
        lote:lotes!inner(numero_lote, costo_unitario, vacuna:vacunas!inner(nombre)),
        usuario:perfiles(nombre),
        cita:citas_vacunacion(paciente:pacientes(nombre_completo))`)
      .order("created_at", { ascending: false }).limit(300)
      .returns<Movimiento[]>(),
  ]);

  return (
    <>
      <PageHeader title="Inventario"
        subtitle="Dosis por lote y vencimiento. Cada vacunación descuenta una dosis del lote aplicado." />
      {lotes === null ? (
        <div className="card p-6 text-sm text-slate-600">
          Falta configurar la base de datos: ejecuta <code className="rounded bg-slate-100 px-1">supabase/inventario.sql</code> en Supabase.
        </div>
      ) : (
        <InventarioManager vacunas={vacunas.data ?? []} lotes={lotes} movimientos={movimientos.data ?? []}
          hoy={hoy} esAdmin={perfil.rol === "ADMIN"} />
      )}
    </>
  );
}
