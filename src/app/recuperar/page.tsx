import type { Metadata } from "next";
import PantallaAcceso from "@/components/PantallaAcceso";
import RecuperarForm from "@/components/RecuperarForm";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <PantallaAcceso titulo="Recuperar contraseña" subtitulo="Te enviaremos un código a tu correo. Al confirmarlo podrás crear una contraseña nueva.">
      <RecuperarForm emailInicial={typeof email === "string" ? email : ""} />
    </PantallaAcceso>
  );
}
