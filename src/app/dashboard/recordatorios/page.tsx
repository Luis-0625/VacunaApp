import MonitorRecordatorios from "@/components/MonitorRecordatorios";
import { PageHeader } from "@/components/ui";

export default function RecordatoriosPage() {
  return (
    <>
      <PageHeader title="Recordatorios" subtitle="Monitor en tiempo real de envíos por Email y WhatsApp" />
      <MonitorRecordatorios />
    </>
  );
}
