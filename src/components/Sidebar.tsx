"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, BellRing, Building2, CalendarDays, CreditCard, FileSpreadsheet, Globe, Megaphone, Package, ChevronsLeft, ChevronsRight, LayoutDashboard, LogOut, Menu, Pill, Syringe, UserCog, Users, X,
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
      { href: "/dashboard/inventario", label: "Inventario", icon: Package, roles: ["ADMIN", "VACUNADOR"] },
      { href: "/dashboard/recordatorios", label: "Recordatorios", icon: BellRing, roles: ["ADMIN", "VACUNADOR"] },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/dashboard/vacunas", label: "Vacunas", icon: Pill, roles: ["ADMIN"] },
      { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
      { href: "/dashboard/usuarios", label: "Usuarios", icon: UserCog, roles: ["ADMIN"] },
      { href: "/dashboard/carga-inicial", label: "Carga inicial", icon: FileSpreadsheet, roles: ["ADMIN"] },
      { href: "/dashboard/establecimiento", label: "Establecimiento", icon: Building2, roles: ["ADMIN"] },
      { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard, roles: ["ADMIN"] },
    ],
  },
];

export default function Sidebar({
  nombre, rol, establecimiento, superadmin = false, avisos = {},
}: {
  nombre: string; rol: Rol; superadmin?: boolean;
  /** Contador de alertas por enlace (ej. { "/dashboard/inventario": 3 }). */
  avisos?: Record<string, number>;
  establecimiento: { nombre: string; ciudad: string | null; logo_url: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [colapsadoGuardado, guardarColapsado] = useLocalStorage("sidebar-collapsed", "0");
  const collapsed = colapsadoGuardado === "1";
  const secciones = [
    ...SECCIONES,
    ...(superadmin ? [{ titulo: "VacunaApp", items: [{ href: "/plataforma", label: "Plataforma", icon: Globe, roles: [rol] }] }] : []),
  ]
    .map((s) => ({ ...s, items: s.items.filter((l) => l.roles.includes(rol)) }))
    .filter((s) => s.items.length > 0);
  const links = secciones.flatMap((s) => s.items);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Menú móvil: cierra con Escape y bloquea el scroll de la página mientras está abierto
  useEffect(() => {
    if (!menuAbierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setMenuAbierto(false);
    document.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

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
      {/* Celular: encabezado con el centro y menú lateral desplegable */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/95 px-4 backdrop-blur md:hidden">
        <LogoEstablecimiento logoUrl={establecimiento.logo_url} nombre={establecimiento.nombre} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-slate-900">{establecimiento.nombre}</div>
          <div className="truncate text-xs text-slate-500">{links.find((l) => isActive(l.href))?.label ?? "Panel"}</div>
        </div>
        <SelectorTema compacto />
        <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}
          className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100">
          <Menu size={20} />
          {Object.values(avisos).some(Boolean) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
        </button>
      </header>

      <div className={`fixed inset-0 z-50 md:hidden ${menuAbierto ? "" : "pointer-events-none"}`} aria-hidden={!menuAbierto}>
        <div onClick={() => setMenuAbierto(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${menuAbierto ? "opacity-100" : "opacity-0"}`} />
        <aside role="dialog" aria-modal="true" aria-label="Menú"
          className={`absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-surface transition-transform duration-200 ${menuAbierto ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
          <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4">
            <LogoEstablecimiento logoUrl={establecimiento.logo_url} nombre={establecimiento.nombre} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight text-slate-900">{establecimiento.nombre}</div>
              <div className="truncate text-xs text-slate-500">{establecimiento.ciudad ?? "Centro de vacunación"}</div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
            {secciones.map((s) => (
              <div key={s.titulo}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.titulo}</div>
                <div className="space-y-0.5">
                  {s.items.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setMenuAbierto(false)}
                      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}>
                      {isActive(href) && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-600" />}
                      <Icon size={18} className={`shrink-0 ${isActive(href) ? "text-brand-600" : "text-slate-400"}`} />
                      {label}
                      {!!avisos[href] && (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                          {avisos[href]}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="space-y-1 border-t border-slate-200 p-3">
            <div className="flex items-center gap-3 rounded-lg p-2">
              <Avatar size="sm" name={nombre} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{nombre}</div>
                <div className="text-xs text-slate-500">{rol === "ADMIN" ? "Administrador" : "Vacunador"}</div>
              </div>
            </div>
            <button onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
              <LogOut size={16} className="shrink-0 text-slate-400" /> Cerrar sesión
            </button>
          </div>
        </aside>
      </div>

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
                    {!!avisos[href] && (collapsed
                      ? <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-label={`${avisos[href]} alertas`} />
                      : <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums"
                          title={`${avisos[href]} alertas`}>{avisos[href]}</span>)}
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
