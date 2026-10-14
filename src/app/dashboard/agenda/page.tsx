import AgendaCitas from "@/components/AgendaCitas";
import { PageHeader } from "@/components/ui";

export default function AgendaPage() {
  return (
    <>
      <PageHeader title="Agenda" subtitle="Próximas citas y confirmaciones de los pacientes por WhatsApp, en tiempo real" />
      <AgendaCitas />
    </>
  );
}
