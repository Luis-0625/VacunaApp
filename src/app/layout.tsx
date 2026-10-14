import type { Metadata } from "next";
import localFont from "next/font/local";
import { getEstablecimientoActual } from "@/lib/establecimiento-server";
import { temaMarca } from "@/lib/establecimiento";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export async function generateMetadata(): Promise<Metadata> {
  const est = await getEstablecimientoActual();
  return {
    title: { default: est.nombre, template: `%s · ${est.nombre}` },
    description: "Gestión de pacientes, citas y recordatorios de vacunación",
    icons: est.logo_url ? { icon: est.logo_url } : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const est = await getEstablecimientoActual();
  return (
    // suppressHydrationWarning: SCRIPT_TEMA agrega la clase .dark antes de que React hidrate
    <html lang="es" style={temaMarca(est.color) as React.CSSProperties} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
