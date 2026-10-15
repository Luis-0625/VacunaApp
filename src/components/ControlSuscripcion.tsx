"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, CreditCard, Lock } from "lucide-react";
import { formatFechaLarga } from "@/lib/agenda";
import type { EstadoSuscripcion } from "@/lib/suscripcion";
import type { Rol } from "@/types/db";

const RUTA = "/dashboard/suscripcion";

/**
 * Aviso de vencimiento arriba de cada módulo y, con la suscripción vencida, bloqueo del panel: el ADMIN
 * solo puede entrar a Suscripción para renovar. Es del lado del cliente porque el layout no se vuelve a
 * renderizar al cambiar de módulo; las API igual rechazan las peticiones (requireApi).
 */
export default function ControlSuscripcion({ estado, rol, children }: {
  estado: EstadoSuscripcion; rol: Rol; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const enSuscripcion = pathname === RUTA;
  const admin = rol === "ADMIN";

  if (estado.estado === "VENCIDA" && !enSuscripcion) {
    return (
      <div className="card mx-auto mt-8 max-w-lg p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><Lock size={22} /></span>
        <h1 className="mt-4 text-xl font-semibold">La suscripción de tu centro venció</h1>
        <p className="mt-2 text-sm text-slate-600">
          {admin
            ? "Renuévala para seguir usando VacunaApp. Tus pacientes, citas e inventario están guardados y vuelven a estar disponibles apenas se apruebe el pago."
            : "El panel está bloqueado hasta que un administrador de tu centro renueve la suscripción. Tus datos están guardados."}
        </p>
        {admin && (
          <Link href={RUTA} className="btn-primary mt-6 justify-center">
            <CreditCard size={16} /> Renovar suscripción
          </Link>
        )}
      </div>
    );
  }

  const aviso =
    estado.estado === "POR_VENCER" ? (estado.dias === 0 ? "La suscripción de tu centro vence hoy." : `La suscripción de tu centro vence en ${estado.dias} ${estado.dias === 1 ? "día" : "días"}.`)
    : estado.estado === "GRACIA" ? `La suscripción de tu centro venció. El panel se bloqueará el ${formatFechaLarga(estado.bloqueo)}.`
    : null;

  return (
    <>
      {aviso && !enSuscripcion && (
        <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
          estado.estado === "GRACIA" ? "bg-red-50 text-red-800 ring-red-600/20" : "bg-amber-50 text-amber-800 ring-amber-600/20"
        }`}>
          <span className="flex items-center gap-2"><CircleAlert size={16} className="shrink-0" /> {aviso}{!admin && " Avísale a un administrador."}</span>
          {admin && <Link href={RUTA} className="font-semibold underline underline-offset-2">Renovar ahora</Link>}
        </div>
      )}
      {children}
    </>
  );
}
