"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, BellRing, ChevronsLeft, ChevronsRight, LayoutDashboard, LogOut, Pill, ShieldCheck, ShieldPlus, Syringe, UserCog, Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import type { Rol } from "@/types/db";

const LINKS: { href: string; label: string; icon: typeof Users; roles: Rol[] }[] = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["ADMIN", "VACUNADOR"] },
  { href: "/dashboard/vacunacion", label: "Vacunación", icon: Syringe, roles: ["ADMIN", "VACUNADOR"] },
  { href: "/dashboard/pacientes", label: "Pacientes", icon: Users, roles: ["ADMIN", "VACUNADOR"] },
  { href: "/dashboard/recordatorios", label: "Recordatorios", icon: BellRing, roles: ["ADMIN", "VACUNADOR"] },
  { href: "/dashboard/vacunas", label: "Vacunas", icon: Pill, roles: ["ADMIN"] },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: UserCog, roles: ["ADMIN"] },
];

export default function Sidebar({ nombre, rol }: { nombre: string; rol: Rol }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const links = LINKS.filter((l) => l.roles.includes(rol));

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "1"); } catch { /* sin almacenamiento */ }
  }, []);

  function toggle() {
    setCollapsed((v) => {
      try { localStorage.setItem("sidebar-collapsed", v ? "0" : "1"); } catch { /* sin almacenamiento */ }
      return !v;
    });
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around overflow-x-auto border-t border-slate-200 bg-white/95 py-2 backdrop-blur md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex min-w-16 flex-col items-center gap-0.5 px-2 text-[11px] font-medium ${isActive(href) ? "text-teal-700" : "text-slate-500"}`}>
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>

      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-teal-900 via-teal-900 to-emerald-950 p-3 text-teal-50 transition-[width] duration-200 md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-2 pt-2"}`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <ShieldPlus size={22} />
            </div>
            {!collapsed && (
              <div>
                <div className="text-lg font-semibold leading-none">VacunaApp</div>
                <div className="mt-1 text-xs text-teal-200/70">Centro de vacunación</div>
              </div>
            )}
          </div>
          <button onClick={toggle} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="rounded-lg p-1.5 text-teal-100/70 transition hover:bg-white/10 hover:text-white">
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-3.5"} ${
                isActive(href) ? "bg-white/15 text-white shadow-inner ring-1 ring-white/15" : "text-teal-100/75 hover:bg-white/10 hover:text-white"
              }`}>
              <Icon size={18} className="shrink-0" /> {!collapsed && label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <div className={`flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ${collapsed ? "justify-center" : ""}`} title={collapsed ? `${nombre} · ${rol}` : undefined}>
            <Avatar size="sm" name={nombre} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{nombre}</div>
                <div className="flex items-center gap-1 text-xs text-teal-200/70">
                  {rol === "ADMIN" && <ShieldCheck size={12} />}{rol === "ADMIN" ? "Administrador" : "Vacunador"}
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} title={collapsed ? "Cerrar sesión" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm text-teal-100/75 transition hover:bg-white/10 hover:text-white ${collapsed ? "justify-center" : "px-3.5"}`}>
            <LogOut size={18} className="shrink-0" /> {!collapsed && "Cerrar sesión"}
          </button>
        </div>
      </aside>
    </>
  );
}
