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
  Edit3,
  CheckCircle2,
  Menu,
  X,
  Lock,
  LogOut,
  Table,
  UserCheck
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAuthenticated,
    userRole,
    currentUser,
    logout,
    isVisualEditing,
    toggleVisualEditing,
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
    { name: "9. Tablas Maestras", href: "/dashboard/admin/tables", icon: Table, color: "text-indigo-400" },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2">
            <ReyGasLogo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className={`text-sm font-semibold transition-colors ${
                pathname === "/"
                  ? "text-reygas-red"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Sitio Web Público
            </Link>

            {/* If inside ERP Dashboard, show Station Dropdown & Admin controls */}
            {isDashboard && isAuthenticated ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setErpDropdownOpen(!erpDropdownOpen)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-reygas-card hover:bg-reygas-surface border border-white/10 text-sm font-semibold text-white transition-all shadow-md"
                  >
                    <LayoutDashboard className="w-4 h-4 text-reygas-red" />
                    <span>Estaciones ERP</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {erpDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-72 glass-panel rounded-2xl shadow-2xl py-2 border border-white/10 z-50 divide-y divide-white/5"
                      onMouseLeave={() => setErpDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Seleccionar Estación Operativa
                      </div>
                      <div className="py-1">
                        {erpLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => setErpDropdownOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                                pathname === link.href
                                  ? "bg-reygas-red/20 text-white font-bold"
                                  : "text-gray-300"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${link.color}`} />
                              <span>{link.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pl-3 border-l border-white/10">
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
              </>
            ) : (
              /* CLEAN PUBLIC VISITORS NAVBAR (ON PUBLIC WEBSITE '/') */
              <div className="flex items-center gap-4">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard/admin/cms"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-reygas-red hover:bg-reygas-redDark text-white text-xs font-bold transition-all shadow-lg shadow-reygas-red/30"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Ir a Estación ERP Admin</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-reygas-surface hover:bg-reygas-red text-white text-xs font-bold transition-all border border-white/10 shadow-lg"
                  >
                    <Lock className="w-3.5 h-3.5 text-reygas-red" />
                    <span>Acceso ERP / Personal</span>
                  </Link>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Navigation Toggle */}
          <div className="md:hidden flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard/admin/cms"
                className="px-3 py-1.5 rounded-lg bg-reygas-red text-white text-xs font-bold"
              >
                Panel ERP
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-reygas-surface text-white text-xs font-bold"
              >
                Login ERP
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-b border-white/10 px-4 py-6 space-y-4">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-gray-200"
          >
            Sitio Web Público
          </Link>
          {isAuthenticated && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-xs font-bold text-gray-400 uppercase">
                Estaciones ERP
              </div>
              <div className="grid grid-cols-1 gap-1">
                {erpLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5"
                    >
                      <Icon className={`w-4 h-4 ${link.color}`} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
