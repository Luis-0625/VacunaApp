import Sidebar from "@/components/Sidebar";
import SinAcceso from "@/components/SinAcceso";
import { redirect } from "next/navigation";
import { esSuperadmin, getPerfil } from "@/lib/auth";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [perfil, est, superadmin] = await Promise.all([getPerfil(), getEstablecimientoActual(), esSuperadmin()]);
  if (!perfil && superadmin) redirect("/plataforma");
  if (!perfil) return <SinAcceso />;

  return (
    <div className="flex min-h-screen">
      <Sidebar nombre={perfil.nombre} rol={perfil.rol} superadmin={superadmin}
        establecimiento={{ nombre: est.nombre, ciudad: est.ciudad, logo_url: est.logo_url }} />
      <main className="min-w-0 flex-1 px-5 py-6 pb-24 sm:px-8 sm:py-8 md:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
