"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, BellRing, Building2, CalendarDays, Megaphone, ChevronsLeft, ChevronsRight, LayoutDashboard, LogOut, Pill, Syringe, UserCog, Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, LogoEstablecimiento } from "@/components/ui";
import SelectorTema from "@/components/SelectorTema";
import { useLocalStorage } from "@/lib/use-local-storage";
import type { Rol } from "@/types/db";

type Item = { href: string; label: string; icon: typeof Users; roles: Rol[] };

const SECCIONES: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/atrasados", label: "Atrasados", icon: Megaphone, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/vacunacion", label: "Vacunación", icon: Syringe, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/pacientes", label: "Pacientes", icon: Users, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/recordatorios", label: "Recordatorios", icon: BellRing, roles: ["ADMIN", "VACUNADOR"] },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/dashboard/vacunas", label: "Vacunas", icon: Pill, roles: ["ADMIN"] },
      { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
      { href: "/dashboard/usuarios", label: "Usuarios", icon: UserCog, roles: ["ADMIN"] },
      { href: "/dashboard/establecimiento", label: "Establecimiento", icon: Building2, roles: ["ADMIN"] },
    ],
  },
];

export default function Sidebar({
  nombre, rol, establecimiento,
}: { nombre: string; rol: Rol; establecimiento: { nombre: string; ciudad: string | null; logo_url: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [colapsadoGuardado, guardarColapsado] = useLocalStorage("sidebar-collapsed", "0");
  const collapsed = colapsadoGuardado === "1";
  const secciones = SECCIONES
    .map((s) => ({ ...s, items: s.items.filter((l) => l.roles.includes(rol)) }))
    .filter((s) => s.items.length > 0);
  const links = secciones.flatMap((s) => s.items);

  function toggle() {
    guardarColapsado(collapsed ? "0" : "1");
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around overflow-x-auto border-t border-slate-200 bg-surface/95 py-2 backdrop-blur md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex min-w-16 flex-col items-center gap-0.5 px-2 text-[11px] font-medium ${isActive(href) ? "text-brand-700" : "text-slate-500"}`}>
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>

      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-surface transition-[width] duration-200 md:flex ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <div className={`flex h-16 items-center border-b border-slate-200 ${collapsed ? "justify-center" : "gap-3 px-4"}`}>
          <LogoEstablecimiento logoUrl={establecimiento.logo_url} nombre={establecimiento.nombre} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-slate-900">{establecimiento.nombre}</div>
              <div className="truncate text-xs text-slate-500">{establecimiento.ciudad ?? "Centro de vacunación"}</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {secciones.map((s) => (
            <div key={s.titulo}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.titulo}</div>
              )}
              <div className="space-y-0.5">
                {s.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} title={collapsed ? label : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-3"} ${
                      isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}>
                    {isActive(href) && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-600" />}
                    <Icon size={18} className={`shrink-0 ${isActive(href) ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                    {!collapsed && label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3">
          {collapsed ? <div className="flex justify-center"><SelectorTema compacto /></div> : <SelectorTema />}
          <div className={`flex items-center gap-3 rounded-lg p-2 ${collapsed ? "justify-center" : ""}`} title={collapsed ? `${nombre} · ${rol}` : undefined}>
            <Avatar size="sm" name={nombre} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{nombre}</div>
                <div className="text-xs text-slate-500">{rol === "ADMIN" ? "Administrador" : "Vacunador"}</div>
              </div>
            )}
          </div>
          <div className={`flex ${collapsed ? "flex-col items-center gap-1" : "gap-1"}`}>
            <button onClick={logout} title="Cerrar sesión"
              className={`flex items-center gap-2 rounded-lg py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 ${collapsed ? "px-2" : "flex-1 px-3"}`}>
              <LogOut size={16} className="shrink-0 text-slate-400" /> {!collapsed && "Cerrar sesión"}
            </button>
            <button onClick={toggle} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
