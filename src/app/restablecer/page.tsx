import type { Metadata } from "next";
import Link from "next/link";
import PantallaAcceso from "@/components/PantallaAcceso";
import RestablecerForm from "@/components/RestablecerForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  if (typeof token_hash !== "string" || !token_hash) {
    return (
      <PantallaAcceso titulo="Enlace inválido" subtitulo="Este enlace está incompleto o ya no es válido.">
        <Link href="/recuperar" className="btn-primary w-full justify-center py-2.5">Pedir un enlace nuevo</Link>
      </PantallaAcceso>
    );
  }
  return (
    <PantallaAcceso titulo="Crea tu nueva contraseña" subtitulo="Usa al menos 8 caracteres. Después entrarás directo a tu panel.">
      <RestablecerForm tokenHash={token_hash} />
    </PantallaAcceso>
  );
}
