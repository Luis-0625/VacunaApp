import Sidebar from "@/components/Sidebar";
import SinAcceso from "@/components/SinAcceso";
import { getPerfil } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil();
  if (!perfil) return <SinAcceso />;

  return (
    <div className="flex min-h-screen">
      <Sidebar nombre={perfil.nombre} rol={perfil.rol} />
      <main className="min-w-0 flex-1 p-5 pb-24 sm:p-8 md:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
