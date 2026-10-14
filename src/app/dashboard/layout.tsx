import Sidebar from "@/components/Sidebar";
import SinAcceso from "@/components/SinAcceso";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/agenda";
import { esSuperadmin, getPerfil } from "@/lib/auth";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";
import { calcularAlertasInventario } from "@/lib/inventario-alertas";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [perfil, est, superadmin] = await Promise.all([getPerfil(), getEstablecimientoActual(), esSuperadmin()]);
  if (!perfil && superadmin) redirect("/plataforma");
  if (!perfil) return <SinAcceso />;

  // Contador de alertas de inventario en el menú (si falla, el menú se muestra sin contador)
  const alertas = await calcularAlertasInventario(await createClient(), todayISO()).catch(() => null);

  return (
    <div className="flex min-h-screen">
      <Sidebar nombre={perfil.nombre} rol={perfil.rol} superadmin={superadmin}
        establecimiento={{ nombre: est.nombre, ciudad: est.ciudad, logo_url: est.logo_url }}
        avisos={{ "/dashboard/inventario": alertas?.total ?? 0 }} />
      <main className="min-w-0 flex-1 px-5 py-6 pb-24 sm:px-8 sm:py-8 md:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
