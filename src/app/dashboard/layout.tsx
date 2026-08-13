"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReyGasLogo } from "@/components/brand/logo";
import { useAppStore } from "@/lib/store/app-store";
import {
  Globe,
  ShieldAlert,
  Calendar,
  Wrench,
  Package,
  CreditCard,
  Award,
  Clock,
  Settings,
  Table,
  LogOut,
  ChevronRight,
  Menu,
  X,
  UserCheck,
  Edit3,
  History
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, userRole, logout, isVisualEditing, toggleVisualEditing } = useAppStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const sidebarItems = [
    {
      name: "1. Sitio Web Público (Editor Visual)",
      href: "/dashboard/admin/cms",
      icon: Globe,
      color: "text-blue-400",
      badge: "Edición 100%",
    },
    {
      name: "2. Portería & Semáforo Salida",
      href: "/dashboard/porteria",
      icon: ShieldAlert,
      color: "text-red-400",
    },
    {
      name: "3. Recepción & Citas (Radar 15k)",
      href: "/dashboard/recepcion",
      icon: Calendar,
      color: "text-amber-400",
    },
    {
      name: "4. Taller & Tablero Kanban",
      href: "/dashboard/taller",
      icon: Wrench,
      color: "text-teal-400",
    },
    {
      name: "5. Almacén, Escáner & Equipos",
      href: "/dashboard/almacen",
      icon: Package,
      color: "text-emerald-400",
    },
    {
      name: "6. Caja & Facturación",
      href: "/dashboard/caja",
      icon: CreditCard,
      color: "text-purple-400",
    },
    {
      name: "7. Certificaciones GNV / GLP",
      href: "/dashboard/certificaciones",
      icon: Award,
      color: "text-cyan-400",
    },
    {
      name: "8. Asistencia Biométrica",
      href: "/dashboard/asistencia",
      icon: Clock,
      color: "text-indigo-400",
    },
    {
      name: "9. Consultas & Histórico por Día",
      href: "/dashboard/consultas",
      icon: History,
      color: "text-amber-400",
    },
    {
      name: "10. Tabla Maestra de Personal",
      href: "/dashboard/admin/tables",
      icon: Table,
      color: "text-pink-400",
    },
    {
      name: "11. Configuración & Exportación",
      href: "/dashboard/configuracion",
      icon: Settings,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="min-h-screen flex bg-reygas-dark text-white">
      {/* LEFT VERTICAL SIDEBAR FOR DESKTOP & TABLETS */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 glass-panel transition-all duration-300 z-40 sticky top-0 h-screen ${
          sidebarCollapsed ? "w-20" : "w-64 lg:w-72"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            <ReyGasLogo size="md" showText={!sidebarCollapsed} />
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight
              className={`w-5 h-5 transition-transform ${
                sidebarCollapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>

        {/* User Session Info Badge */}
        {!sidebarCollapsed && (
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-reygas-red/20 border border-reygas-red/40 flex items-center justify-center text-reygas-red shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-extrabold text-white block truncate">
                  {currentUser?.name || "Administrador ReyGas"}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold block uppercase">
                  ● Sesión ERP Activa ({userRole || "Admin"})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Operational Stations Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className={`px-3 py-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ${sidebarCollapsed ? "hidden" : "block"}`}>
            Estaciones Operativas ERP
          </div>

          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all group ${
                  isActive
                    ? "bg-reygas-red text-white shadow-lg shadow-reygas-red/30"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
                title={item.name}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-white" : item.color
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </div>

                {!sidebarCollapsed && item.badge && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout & Visual Edit Switcher */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {!sidebarCollapsed && userRole === "admin" && (
            <button
              onClick={toggleVisualEditing}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-2 ${
                isVisualEditing
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isVisualEditing ? "Edición Web ON" : "Edición Web OFF"}</span>
            </button>
          )}

          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>Cerrar Sesión ERP</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <ReyGasLogo size="sm" />
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 text-white"
        >
          {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE SIDEBAR DRAWER */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <ReyGasLogo size="md" />
            <button onClick={() => setMobileSidebarOpen(false)} className="text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                    isActive ? "bg-reygas-red text-white" : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${item.color}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}
