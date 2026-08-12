"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReyGasLogo } from "@/components/brand/logo";
import { useAppStore } from "@/lib/store/app-store";
import {
  ShieldAlert,
  LayoutDashboard,
  Calendar,
  Wrench,
  Package,
  CreditCard,
  Award,
  Clock,
  Settings,
  ChevronDown,
  LogOut,
  Table,
  Phone,
  Calculator,
  Flame
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAuthenticated,
    userRole,
    currentUser,
    logout,
  } = useAppStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [erpDropdownOpen, setErpDropdownOpen] = useState(false);

  const isDashboard = pathname.startsWith("/dashboard");

  const erpLinks = [
    { name: "1. Sitio Web Público (Editor)", href: "/dashboard/admin/cms", icon: Settings, color: "text-reygas-red" },
    { name: "2. Portería & Semáforo", href: "/dashboard/porteria", icon: ShieldAlert, color: "text-red-400" },
    { name: "3. Recepción & Citas", href: "/dashboard/recepcion", icon: Calendar, color: "text-blue-400" },
    { name: "4. Taller & Kanban", href: "/dashboard/taller", icon: Wrench, color: "text-amber-400" },
    { name: "5. Almacén & Herramientas", href: "/dashboard/almacen", icon: Package, color: "text-emerald-400" },
    { name: "6. Caja & Facturación", href: "/dashboard/caja", icon: CreditCard, color: "text-purple-400" },
    { name: "7. Certificaciones GNV/GLP", href: "/dashboard/certificaciones", icon: Award, color: "text-teal-400" },
    { name: "8. Asistencia Biométrica", href: "/dashboard/asistencia", icon: Clock, color: "text-cyan-400" },
    { name: "9. Consultas & Histórico por Día", href: "/dashboard/consultas", icon: Clock, color: "text-amber-400" },
    { name: "10. Tablas Maestras", href: "/dashboard/admin/tables", icon: Table, color: "text-indigo-400" },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Emblem */}
          <Link href="/" className="group flex items-center gap-2">
            <ReyGasLogo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {isDashboard ? (
              /* ERP DASHBOARD HEADER (INSIDE /dashboard/...) */
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {currentUser?.name || "Usuario ERP"}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase font-mono">
                    Rol: {userRole}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-red-950/40 text-gray-400 hover:text-red-400 transition-colors"
                  title="Cerrar Sesión ERP"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* CLEAN PUBLIC WEBSITE NAVBAR (NO ERP TEXTS, NO ERP BUTTONS) */
              <div className="flex items-center gap-6 text-sm font-medium text-gray-300">
                <a href="#calculadora" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-reygas-red" />
                  <span>Calculadora de Ahorro</span>
                </a>
                <a href="#servicios" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Servicios GNV / GLP</span>
                </a>
                <a
                  href="https://wa.me/51987654321"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-reygas-red hover:bg-reygas-redDark text-white text-xs font-bold rounded-xl shadow-lg shadow-reygas-red/30 transition-transform hover:scale-105 flex items-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Contactar Taller</span>
                </a>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
