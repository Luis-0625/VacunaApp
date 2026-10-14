import { redirect } from "next/navigation";
import PlataformaManager, { type CentroResumen } from "@/components/PlataformaManager";
import { esSuperadmin, getPerfil } from "@/lib/auth";
import { addDaysISO, todayISO } from "@/lib/agenda";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma" };

export default async function PlataformaPage() {
  if (!(await esSuperadmin())) redirect("/dashboard");
  const perfil = await getPerfil();

  const db = createAdminClient();
  const { data: centros } = await db.from("centros")
    .select("id, nombre, ciudad, activo, whatsapp_from, created_at").order("created_at");

  const hace30 = addDaysISO(todayISO(), -30);
  const contar = (tabla: string, centroId: string) =>
    db.from(tabla).select("*", { count: "exact", head: true }).eq("centro_id", centroId);

  const resumen: CentroResumen[] = await Promise.all((centros ?? []).map(async (c) => {
    const [usuarios, pacientes, dosis30] = await Promise.all([
      contar("perfiles", c.id),
      contar("pacientes", c.id),
      contar("citas_vacunacion", c.id).eq("externa", false).gte("fecha_aplicacion", hace30),
    ]);
    return { ...c, usuarios: usuarios.count ?? 0, pacientes: pacientes.count ?? 0, dosis30: dosis30.count ?? 0 };
  }));

  return <PlataformaManager centros={resumen} tieneCentro={!!perfil} />;
}
