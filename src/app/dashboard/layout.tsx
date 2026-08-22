"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReyGasLogo } from "@/components/brand/logo";
import { Toast } from "@/components/ui/toast";
import BuildAutoRefresh from "@/components/BuildAutoRefresh";
import { useAppStore, ALL_ERP_STATIONS_DEFAULT } from "@/lib/store/app-store";
import { initGlobalErrorLogger, logSystemEvent, setCurrentLogPage } from "@/lib/system-log";
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
  const { currentUser, userRole, isAuthenticated, logout, isVisualEditing, toggleVisualEditing } = useAppStore();

  // GUARD DE AUTENTICACIÓN: sin sesión activa el dashboard NUNCA se renderiza
  // (un cambio de URL o recarga no debe dejar entrar sin usuario, ni mostrar
  // 'Administrador ReyGas' por fallback). La sesión persiste en el store.
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  // Log interno de procesos: captura errores globales, registra la sesión/build y
  // setea la PÁGINA ACTIVA para que cada evento del log indique de qué pantalla vino.
  React.useEffect(() => {
    initGlobalErrorLogger();
    const pageMap: Record<string, string> = {
      "/dashboard/caja": "Caja",
      "/dashboard/taller": "Taller",
      "/dashboard/almacen": "Almacén",
      "/dashboard/porteria": "Portería",
      "/dashboard/recepcion": "Recepción",
      "/dashboard/certificaciones": "Certificaciones",
      "/dashboard/asistencia": "Asistencia",
      "/dashboard/consultas": "Consultas",
      "/dashboard/reportes": "Reportes",
      "/dashboard/configuracion": "Configuración",
    };
    const pageName = pageMap[pathname] || pathname || "desconocida";
    setCurrentLogPage(pageName);
    logSystemEvent("info", "app.load", {
      path: pathname,
      page: pageName,
      user: (currentUser as any)?.username || (currentUser as any)?.name || "",
      role: userRole || "",
    });

    // LISTENER GLOBAL DE CLICS: registra CADA acción del usuario en la web (botón pulsado,
    // texto visible, contexto), para que el log NUNCA omita lo que ocurrió en la interfaz
    // (diagnóstico A1D-031: el servicio "se agregó" pero no aparecía en el log porque el
    // agregado venía de un camino sin instrumentar). Con esto, cualquier clic queda rastreado.
    const clickHandler = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        if (!target || !target.closest) return;
        const btn = target.closest("button, [role='button'], a, input[type='button'], [onclick]") as HTMLElement | null;
        if (!btn) return;
        // Ignorar clics repetidos del mismo botón en <800ms (evita saturar el log)
        const now = Date.now();
        const btnKey = pageName + "|" + (btn.textContent || "").trim().slice(0, 40) + "|" + (btn.getAttribute("title") || "");
        const lastClick = (window as any).__REYGAS_LAST_CLICK;
        if (lastClick && lastClick.key === btnKey && now - lastClick.at < 800) return;
        (window as any).__REYGAS_LAST_CLICK = { key: btnKey, at: now };
        const text = (btn.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
        const title = btn.getAttribute("title") || "";
        const aria = btn.getAttribute("aria-label") || "";
        logSystemEvent("info", "web.click", {
          page: pageName,
          btn: text || aria || title || "(sin texto)",
          title: title || undefined,
          dataAction: btn.getAttribute("data-action") || undefined,
        }, "web:" + pageName);
      } catch {
        // noop
      }
    };
    document.addEventListener("click", clickHandler, true);
    return () => {
      document.removeEventListener("click", clickHandler, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // En TABLET (<1280px) el panel izquierdo nace SIEMPRE COLAPSADO (también al
  // recargar la web) para dejar el mayor espacio al contenido.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1280;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Al cambiar de pestaña (ruta) en tablet, el panel izquierdo siempre vuelve
  // a estar colapsado (por defecto colapsado, sin importar lo que se haya hecho).
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setSidebarCollapsed(true);
    }
  }, [pathname]);

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
      name: "7. Reportes del Taller",
      href: "/dashboard/reportes",
      icon: Table,
      color: "text-amber-400",
    },
    {
      name: "8. Certificaciones GNV / GLP",
      href: "/dashboard/certificaciones",
      icon: Award,
      color: "text-cyan-400",
    },
    {
      name: "9. Asistencia Biométrica",
      href: "/dashboard/asistencia",
      icon: Clock,
      color: "text-indigo-400",
    },
    {
      name: "10. Consultas & Histórico por Día",
      href: "/dashboard/consultas",
      icon: History,
      color: "text-amber-400",
    },
    {
      name: "11. Tabla Maestra de Personal",
      href: "/dashboard/admin/tables",
      icon: Table,
      color: "text-pink-400",
    },
    {
      name: "12. Configuración & Exportación",
      href: "/dashboard/configuracion",
      icon: Settings,
      color: "text-purple-400",
    },
  ];

  // Permission checking
  const isAdmin = userRole === "admin";
  const allowedTabs = currentUser?.allowed_tabs || [];
  // SIN BYPASS: si el personal no tiene pestañas configuradas usa el set por defecto
  // (ALL_ERP_STATIONS_DEFAULT); NUNCA "todas". El guard 403 aplica a rutas no
  // autorizadas (acceso por enlace directo).
  const effectiveAllowedTabs = allowedTabs.length > 0 ? allowedTabs : ALL_ERP_STATIONS_DEFAULT;

  const visibleSidebarItems = sidebarItems.filter((item) => {
    if (isAdmin) return true;
    return effectiveAllowedTabs.includes(item.href);
  });

  const isCurrentPathAllowed = () => {
    if (isAdmin) return true;
    return effectiveAllowedTabs.some((tab) => pathname === tab || pathname.startsWith(tab + "/"));
  };

  const isAuthorized = isCurrentPathAllowed();

  return (
    <div className="min-h-screen flex bg-reygas-dark text-white">
      {/* LEFT VERTICAL SIDEBAR FOR DESKTOP & TABLETS */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 glass-panel transition-all duration-300 z-40 sticky top-0 h-screen ${sidebarCollapsed ? "w-20" : "w-64 lg:w-72"
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
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"
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
                  {currentUser?.name || "Sesión sin perfil"}
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

          {visibleSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all group ${isActive
                  ? "bg-reygas-red text-white shadow-lg shadow-reygas-red/30"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                title={item.name}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : item.color
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
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-2 ${isVisualEditing
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
            {visibleSidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${isActive ? "bg-reygas-red text-white" : "text-gray-300 hover:bg-white/5"
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

      {/* MAIN CONTENT AREA WITH ROUTE GUARD */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {!isAuthorized ? (
          <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl inline-block text-red-400 shadow-2xl">
              <ShieldAlert className="w-16 h-16 mx-auto animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white">403 - Acceso No Autorizado</h1>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                No tienes permisos activos para acceder a esta estación operativa (<strong>{pathname}</strong>).
                Por favor comunícate con el Administrador para habilitar esta pestaña en la Tabla Maestra de Personal.
              </p>
            </div>
            <div>
              <Link
                href={visibleSidebarItems[0]?.href || "/dashboard/taller"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-reygas-red hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-reygas-red/30"
              >
                <span>Volver a mi Estación Permitida</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
      <Toast />
      <BuildAutoRefresh />
    </div>
  );
}
