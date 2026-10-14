import EstablecimientoForm from "@/components/EstablecimientoForm";
import { PageHeader } from "@/components/ui";
import { requirePerfilPage } from "@/lib/auth";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Establecimiento" };

export default async function EstablecimientoPage() {
  await requirePerfilPage(["ADMIN"]);
  const est = await getEstablecimientoActual();
  return (
    <>
      <PageHeader title="Establecimiento"
        subtitle="Datos del centro de vacunación. Se muestran en el sistema y en los mensajes a los pacientes." />
      <EstablecimientoForm inicial={est} />
    </>
  );
}
