import { requirePerfilPage } from "@/lib/auth";
import CargaInicial from "@/components/CargaInicial";

export const dynamic = "force-dynamic";

export default async function CargaInicialPage() {
  await requirePerfilPage(["ADMIN"]);
  return <CargaInicial />;
}
