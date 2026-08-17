"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useAppStore } from "@/lib/store/app-store";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import {
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  DollarSign,
  ShieldAlert,
  Sparkles,
  Car,
  BarChart3,
  Coins
} from "lucide-react";

interface DailyWarehouseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Universal Formatting Helpers with Thousands Separator
export const formatPEN = (amount: number | null | undefined): string => {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return safe.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatQty = (qty: number | null | undefined): string => {
  const safe = typeof qty === "number" && !isNaN(qty) ? Math.round(qty) : 0;
  return safe.toLocaleString("es-PE");
};

export function DailyWarehouseReportModal({ isOpen, onClose }: DailyWarehouseReportModalProps) {
  const {
    inventoryItems,
    recentIngresos,
    workOrders,
    vehicles,
    technicians,
    toolLoans,
    currentUser,
  } = useAppStore();

  // Selected date for report (defaults to today in Peru)
  const [selectedDate, setSelectedDate] = useState<string>(getPeruDateString());
  const [responsibleName, setResponsibleName] = useState<string>(
    currentUser?.name || "Responsable de Almacén"
  );
  const [managerName, setManagerName] = useState<string>("Gerencia General");
  const [observations, setObservations] = useState<string>(
    "Todo el material despachado a taller cuenta con requerimiento validado por orden de trabajo. Se recomienda revisar el gráfico de materiales más valorizados y la lista de compras prioritarias para optimizar el capital de trabajo."
  );

  // Active view tab inside modal
  const [activeReportTab, setActiveReportTab] = useState<"resumen" | "inmovilizado" | "ingresos" | "salidas" | "criticos" | "herramientas">("resumen");

  // Date navigation helpers
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(getPeruDateString(d));
  };

  const isToday = selectedDate === getPeruDateString();

  // Vehicles lookup map
  const vehiclesMap = useMemo(() => {
    const map = new Map<string, (typeof vehicles)[0]>();
    vehicles.forEach((v) => {
      if (v.plate) map.set(v.plate.toUpperCase().trim(), v);
    });
    return map;
  }, [vehicles]);

  // Total Catalog Metrics
  const totalCatalogItems = inventoryItems.length;
  const totalStockUnits = useMemo(() => {
    return inventoryItems.reduce((acc, item) => acc + (Number(item.stock_quantity) || 0), 0);
  }, [inventoryItems]);

  const totalStockValuation = useMemo(() => {
    return inventoryItems.reduce((acc, item) => {
      const qty = Number(item.stock_quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return acc + (qty * price);
    }, 0);
  }, [inventoryItems]);

  // TOP VALORIZED MATERIALS (CAPITAL INMOVILIZADO / DINERO DURMIENDO SIN SALIDA)
  const sleepingCapitalItems = useMemo(() => {
    return inventoryItems
      .map((item) => {
        const qty = Number(item.stock_quantity) || 0;
        const price = Number(item.unit_price) || 0;
        const valuation = qty * price;
        const exits = Number(item.exits) || 0;
        return {
          ...item,
          valuation,
          exits,
        };
      })
      .filter((item) => item.valuation > 0)
      .sort((a, b) => b.valuation - a.valuation)
      .slice(0, 10);
  }, [inventoryItems]);

  const maxItemValuation = useMemo(() => {
    return sleepingCapitalItems.length > 0 ? sleepingCapitalItems[0].valuation : 1;
  }, [sleepingCapitalItems]);

  const totalTopSleepingCapital = useMemo(() => {
    return sleepingCapitalItems.reduce((acc, item) => acc + item.valuation, 0);
  }, [sleepingCapitalItems]);

  // Filter Ingresos for the Selected Date
  const dayIngresos = useMemo(() => {
    if (isToday) return recentIngresos;
    return [];
  }, [recentIngresos, isToday]);

  const totalDayIngresoUnits = useMemo(() => {
    return dayIngresos.reduce((acc, ing) => acc + (Number(ing.quantity) || 0), 0);
  }, [dayIngresos]);

  // Filter Dispatched Items (Salidas) strictly for the Selected Date
  const dayDispatchedItems = useMemo(() => {
    const results: Array<{
      orderId: string;
      plate: string;
      clientName: string;
      technicianName: string;
      service: string;
      partName: string;
      skuBarcode: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      dispatched: boolean;
      dispatchedAt: string;
    }> = [];

    workOrders.forEach((order) => {
      const orderDate = order.entry_time ? order.entry_time.split("T")[0] : "";
      const veh = vehiclesMap.get(order.vehicle_plate?.toUpperCase().trim());
      const client = veh?.owner_name || "Cliente General";
      const techObj = technicians.find((t) => t.id === order.assigned_technician_id);
      const tech = techObj?.full_name || "Técnico de Taller";

      (order.items || []).forEach((item) => {
        const itemDate = item.dispatched_at
          ? item.dispatched_at.split("T")[0]
          : item.requested_at
          ? item.requested_at.split("T")[0]
          : orderDate;

        // Strictly check if date matches selectedDate AND item was dispatched
        const isDateMatch = itemDate === selectedDate && !!item.dispatched;

        if (isDateMatch) {
          const inv = inventoryItems.find(
            (i) => i.name.toLowerCase() === item.description.toLowerCase() || (item.inventory_item_id && i.id === item.inventory_item_id)
          );
          const qty = Math.max(0, Number(item.quantity) || 1);
          const rawPrice = Number(item.unit_price) || (inv ? Number(inv.unit_price) : 0);
          const price = isNaN(rawPrice) ? 0 : Math.max(0, rawPrice);

          results.push({
            orderId: order.id,
            plate: order.vehicle_plate || "S/P",
            clientName: client,
            technicianName: tech,
            service: order.general_maintenance_service || "Conversión / Mantenimiento",
            partName: item.description,
            skuBarcode: inv?.sku_barcode || "-",
            quantity: qty,
            unitPrice: price,
            totalPrice: qty * price,
            dispatched: !!item.dispatched,
            dispatchedAt: item.dispatched_at || order.entry_time || "Hoy",
          });
        }
      });
    });

    return results;
  }, [workOrders, selectedDate, vehiclesMap, inventoryItems, technicians]);

  const totalDayDispatchedUnits = useMemo(() => {
    return dayDispatchedItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [dayDispatchedItems]);

  const totalDayDispatchedValuation = useMemo(() => {
    return dayDispatchedItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [dayDispatchedItems]);

  // Critical Low Stock / Zero Stock Items
  const criticalItems = useMemo(() => {
    return inventoryItems
      .filter((item) => item.stock_quantity <= item.min_stock_alert)
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }, [inventoryItems]);

  const zeroStockCount = useMemo(() => {
    return criticalItems.filter((i) => i.stock_quantity <= 0).length;
  }, [criticalItems]);

  const lowStockCount = useMemo(() => {
    return criticalItems.filter((i) => i.stock_quantity > 0 && i.stock_quantity <= i.min_stock_alert).length;
  }, [criticalItems]);

  // Active Tool Loans
  const activeToolLoans = useMemo(() => {
    return toolLoans.filter((tl) => tl.status === "prestado");
  }, [toolLoans]);

  // Print Handler
  const handlePrint = () => {
    const el = document.getElementById("daily-warehouse-report-print");
    if (el) {
      // Force repaint
    }
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* SCREEN UI (DARK GLASSMORPHIC MODAL) */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn">
        <div className="glass-panel bg-reygas-dark/95 border border-amber-500/30 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl shadow-black/90 overflow-hidden">
          
          {/* Top Modal Header */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40 shadow-lg shadow-amber-500/10">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Informe Diario de Almacén a Gerencia
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-black uppercase">
                    ReyGas Oficial
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Balance ejecutivo diario de stock, dinero inmovilizado, compras, despachos y compras prioritarias.
                </p>
              </div>
            </div>

            {/* Date Navigator + Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date navigator */}
              <div className="flex items-center bg-black/60 rounded-xl border border-white/15 p-1">
                <button
                  type="button"
                  onClick={() => changeDate(-1)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Día anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white font-mono focus:outline-none cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => changeDate(1)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Día siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(getPeruDateString())}
                    className="ml-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black border border-amber-500/30 transition-all"
                  >
                    Hoy
                  </button>
                )}
              </div>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF A4</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Tabs Bar */}
          <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-white/10 shrink-0 bg-black/40 overflow-x-auto">
            <button
              onClick={() => setActiveReportTab("resumen")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "resumen"
                  ? "bg-amber-500 text-black font-black shadow-md shadow-amber-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resumen Ejecutivo</span>
            </button>

            <button
              onClick={() => setActiveReportTab("inmovilizado")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "inmovilizado"
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black shadow-md shadow-orange-500/20"
                  : "text-amber-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Gráfico: Dinero Durmiendo / Más Caros</span>
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black">
                Top 10
              </span>
            </button>

            <button
              onClick={() => setActiveReportTab("ingresos")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "ingresos"
                  ? "bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ingresos de Hoy ({formatQty(dayIngresos.length)})</span>
            </button>

            <button
              onClick={() => setActiveReportTab("salidas")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "salidas"
                  ? "bg-blue-500 text-white font-black shadow-md shadow-blue-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400" />
              <span>Despachos a Taller ({formatQty(dayDispatchedItems.length)})</span>
            </button>

            <button
              onClick={() => setActiveReportTab("criticos")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "criticos"
                  ? "bg-red-600 text-white font-black shadow-md shadow-red-600/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Compras Urgentes ({formatQty(criticalItems.length)})</span>
              {zeroStockCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-black">
                  {formatQty(zeroStockCount)} Agotados
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveReportTab("herramientas")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReportTab === "herramientas"
                  ? "bg-purple-600 text-white font-black shadow-md shadow-purple-600/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span>Herramientas Prestadas ({formatQty(activeToolLoans.length)})</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* 1. EXECUTIVE KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  Catálogo
                </span>
                <p className="text-xl font-black text-white font-mono">{formatQty(totalCatalogItems)}</p>
                <p className="text-[10px] text-gray-500 font-medium">{formatQty(totalStockUnits)} unid. totales</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  Valorización
                </span>
                <p className="text-xl font-black text-amber-400 font-mono">
                  S/ {formatPEN(totalStockValuation)}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">En stock físico</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-1">
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-orange-400" />
                  Top 10 Inmovilizado
                </span>
                <p className="text-xl font-black text-orange-400 font-mono">
                  S/ {formatPEN(totalTopSleepingCapital)}
                </p>
                <p className="text-[10px] text-orange-300/80 font-medium">Dinero sin rotación</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                  Ingresos Hoy
                </span>
                <p className="text-xl font-black text-emerald-400 font-mono">+{formatQty(totalDayIngresoUnits)}</p>
                <p className="text-[10px] text-emerald-300/80 font-medium">{formatQty(dayIngresos.length)} registros cargados</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400" />
                  Despachos Hoy
                </span>
                <p className="text-xl font-black text-blue-400 font-mono">-{formatQty(totalDayDispatchedUnits)}</p>
                <p className="text-[10px] text-blue-300/80 font-medium">S/ {formatPEN(totalDayDispatchedValuation)} consumido</p>
              </div>

              <div className={`p-3.5 rounded-2xl border space-y-1 ${
                zeroStockCount > 0
                  ? "bg-red-500/15 border-red-500/30 text-red-300"
                  : "bg-white/[0.03] border-white/10 text-gray-300"
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  Agotados
                </span>
                <p className="text-xl font-black text-red-400 font-mono">{formatQty(zeroStockCount)}</p>
                <p className="text-[10px] text-gray-400 font-medium">Stock en 0 unid.</p>
              </div>
            </div>

            {/* TAB CONTENT 1: RESUMEN EJECUTIVO */}
            {activeReportTab === "resumen" && (
              <div className="space-y-6">
                
                {/* Visual Narrative Summary Box */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-black/40 to-emerald-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      Resumen Ejecutivo para Gerencia General
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium">
                    Al corte del día <strong className="text-white">{formatPeruDate(selectedDate)}</strong>, el almacén de <strong className="text-amber-400">ReyGas</strong> cuenta con <strong className="text-white">{formatQty(totalCatalogItems)} repuestos</strong> catalogados con un stock total físico de <strong className="text-white">{formatQty(totalStockUnits)} unidades</strong> valorizadas en <strong className="text-amber-400">S/ {formatPEN(totalStockValuation)}</strong>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-gray-300">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2">
                      <Coins className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Dinero Durmiendo:</strong> En los 10 materiales más caros hay <strong className="text-orange-400 font-mono font-bold">S/ {formatPEN(totalTopSleepingCapital)}</strong> inmovilizados sin rotación constante.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Movimientos del Día:</strong> Se registraron <span className="text-emerald-400 font-bold">{formatQty(dayIngresos.length)} ingresos (+{formatQty(totalDayIngresoUnits)} unid.)</span> y se despacharon <span className="text-blue-400 font-bold">{formatQty(dayDispatchedItems.length)} repuestos (-{formatQty(totalDayDispatchedUnits)} unid.)</span> a taller por un valor de <strong className="text-amber-300 font-mono">S/ {formatPEN(totalDayDispatchedValuation)}</strong>.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Atención Gerencial:</strong> Hay <span className="text-red-400 font-bold">{formatQty(criticalItems.length)} ítems en nivel crítico</span> (<span className="text-red-300 font-extrabold">{formatQty(zeroStockCount)} en Stock 0</span>) que requieren reposición prioritaria.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Responsible & Gerencia Metadata Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-black/30 border border-white/10">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Responsable de Almacén (Emite)
                    </label>
                    <select
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white text-xs font-bold focus:border-amber-400 focus:outline-none"
                    >
                      <option value={currentUser?.name || "Responsable de Almacén"}>
                        {currentUser?.name || "Usuario Actual"} (Encargado)
                      </option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.full_name}>
                          {t.full_name} ({t.specialty || "Técnico"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Destinatario (Gerencia)
                    </label>
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="Ej. Gerencia General / Ing. Franco"
                      className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white text-xs font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Fecha del Informe
                    </label>
                    <div className="px-3 py-2 bg-reygas-surface/60 border border-white/10 rounded-xl text-amber-400 font-mono text-xs font-bold">
                      {formatPeruDate(selectedDate)} (Corte Oficial)
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Observaciones y Conclusiones del Responsable para Gerencia
                    </label>
                    <textarea
                      rows={2}
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      placeholder="Escriba notas adicionales para gerencia..."
                      className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white text-xs font-medium focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* SNEAK PEEK: TOP 4 SLEEPING CAPITAL CARDS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-orange-400" />
                      Materiales Más Valorizados en Almacén (Mayor Capital Inmovilizado)
                    </h4>
                    <button
                      onClick={() => setActiveReportTab("inmovilizado")}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      Ver gráfico completo &rarr;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {sleepingCapitalItems.slice(0, 4).map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-white/[0.03] border border-orange-500/30 space-y-2 hover:border-orange-500/60 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-amber-400 border border-amber-500/20">
                            #{idx + 1} {item.sku_barcode}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {formatQty(item.stock_quantity)} unid.
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-white truncate" title={item.name}>
                          {item.name}
                        </h5>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">Total S/:</span>
                            <strong className="text-orange-400 font-mono font-black">
                              S/ {formatPEN(item.valuation)}
                            </strong>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/10">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full"
                              style={{ width: `${Math.max(5, (item.valuation / maxItemValuation) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: GRÁFICO DINÁMICO DE MATERIALES MÁS CAROS / CAPITAL INMOVILIZADO */}
            {activeReportTab === "inmovilizado" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-orange-400" />
                      Gráfico: Materiales Más Caros en Almacén (Dinero Durmiendo sin Salida)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ranking de los repuestos con mayor valor monetario inmovilizado en stock físico.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 font-mono text-xs font-black">
                      Total Top 10: S/ {formatPEN(totalTopSleepingCapital)}
                    </span>
                  </div>
                </div>

                {/* Interactive Visual Bar Chart */}
                <div className="p-5 rounded-3xl bg-black/40 border border-white/10 space-y-4">
                  <div className="space-y-3.5">
                    {sleepingCapitalItems.map((item, idx) => {
                      const percentage = Math.round((item.valuation / maxItemValuation) * 100);
                      const isZeroExits = item.exits === 0;

                      return (
                        <div key={item.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-amber-500/30 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-mono text-xs font-black flex items-center justify-center border border-orange-500/30 shrink-0">
                                #{idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold text-amber-400 bg-black/60 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    {item.sku_barcode}
                                  </span>
                                  <h4 className="text-xs sm:text-sm font-black text-white">{item.name}</h4>
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  Marca: {item.brand || "Genérico"} • P. Venta: S/ {formatPEN(item.unit_price)} c/u
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 sm:text-right shrink-0">
                              <div>
                                <div className="font-mono font-black text-sm sm:text-base text-orange-400">
                                  S/ {formatPEN(item.valuation)}
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono">
                                  {formatQty(item.stock_quantity)} unidades en stock
                                </div>
                              </div>

                              {isZeroExits ? (
                                <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-black uppercase">
                                  0 Salidas (Inmóvil)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-black uppercase">
                                  {formatQty(item.exits)} Salidas
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Graphical Bar */}
                          <div className="space-y-1">
                            <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-white/10 p-0.5">
                              <div
                                className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(4, percentage)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                              <span>0%</span>
                              <span>{percentage}% del máximo (S/ {formatPEN(maxItemValuation)})</span>
                              <span>100%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: INGRESOS DEL DÍA */}
            {activeReportTab === "ingresos" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                    Detalle de Ingresos y Abastecimientos del Día ({formatQty(dayIngresos.length)})
                  </h3>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black rounded-xl border border-emerald-500/30">
                    Total Ingresado: +{formatQty(totalDayIngresoUnits)} unidades
                  </span>
                </div>

                {dayIngresos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 space-y-2 rounded-2xl bg-black/30 border border-white/10">
                    <ArrowDownToLine className="w-8 h-8 mx-auto text-gray-600" />
                    <p className="text-xs font-medium">No se han registrado ingresos de material para esta fecha.</p>
                    <p className="text-[11px] text-gray-600">
                      Utilice la pestaña &quot;Ingreso de Material&quot; en Almacén para registrar ingresos de stock.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-gray-400 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">HORA</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">PRODUCTO / MATERIAL</th>
                          <th className="p-3 text-center">CANT. INGRESADA</th>
                          <th className="p-3 text-center">STOCK ANTERIOR &rarr; NUEVO</th>
                          <th className="p-3 text-center">TIPO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {dayIngresos.map((ing) => (
                          <tr key={ing.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono text-gray-400">{ing.timestamp}</td>
                            <td className="p-3 font-mono text-amber-400 font-bold">{ing.sku}</td>
                            <td className="p-3 text-white font-bold">{ing.name}</td>
                            <td className="p-3 text-center font-mono font-black text-emerald-400">
                              +{formatQty(ing.quantity)} unid.
                            </td>
                            <td className="p-3 text-center font-mono text-gray-300">
                              <span className="text-gray-400">{formatQty(ing.previousStock)}</span> &rarr;{" "}
                              <strong className="text-emerald-400">{formatQty(ing.newStock)}</strong>
                            </td>
                            <td className="p-3 text-center">
                              {ing.isNew ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                                  NUEVO CATÁLOGO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                                  REABASTECIMIENTO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: SALIDAS / DESPACHOS A TALLER */}
            {activeReportTab === "salidas" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ArrowUpFromLine className="w-4 h-4 text-blue-400" />
                    Detalle de Repuestos Despachados a Vehículos en Taller ({formatQty(dayDispatchedItems.length)})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 font-mono text-xs font-black rounded-xl border border-blue-500/30">
                      Total Despachado: -{formatQty(totalDayDispatchedUnits)} unidades
                    </span>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-mono text-xs font-black rounded-xl border border-amber-500/30">
                      S/ {formatPEN(totalDayDispatchedValuation)}
                    </span>
                  </div>
                </div>

                {dayDispatchedItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 space-y-2 rounded-2xl bg-black/30 border border-white/10">
                    <Car className="w-8 h-8 mx-auto text-gray-600" />
                    <p className="text-xs font-medium">No se registran despachos de repuestos a vehículos en esta fecha.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-gray-400 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">PLACA</th>
                          <th className="p-3">CLIENTE / VEHÍCULO</th>
                          <th className="p-3">REPUESTO ENTREGADO</th>
                          <th className="p-3 text-center">CANTIDAD</th>
                          <th className="p-3 text-right">P. UNIT (S/)</th>
                          <th className="p-3 text-right">TOTAL (S/)</th>
                          <th className="p-3">TÉCNICO RECEPTOR</th>
                          <th className="p-3 text-center">ESTADO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {dayDispatchedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono text-amber-400 font-bold">{item.plate}</td>
                            <td className="p-3 text-white font-medium">{item.clientName}</td>
                            <td className="p-3 text-gray-200 font-bold">
                              <div>{item.partName}</div>
                              <span className="font-mono text-[10px] text-gray-500">{item.skuBarcode}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-blue-400">
                              {formatQty(item.quantity)} unid.
                            </td>
                            <td className="p-3 text-right font-mono text-gray-300">
                              S/ {formatPEN(item.unitPrice)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-amber-300">
                              S/ {formatPEN(item.totalPrice)}
                            </td>
                            <td className="p-3 text-gray-300">{item.technicianName}</td>
                            <td className="p-3 text-center">
                              {item.dispatched ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                                  DESPACHADO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/30">
                                  PENDIENTE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 5: SEMÁFORO DE CRÍTICOS / COMPRAS URGENTES */}
            {activeReportTab === "criticos" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Lista Prioritaria de Repuestos para Compra Urgente ({formatQty(criticalItems.length)})
                  </h3>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 font-mono text-xs font-black rounded-xl border border-red-500/30">
                    {formatQty(zeroStockCount)} Agotados | {formatQty(lowStockCount)} Bajo Nivel Mínimo
                  </span>
                </div>

                {criticalItems.length === 0 ? (
                  <div className="p-8 text-center text-emerald-400 space-y-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                    <p className="text-xs font-bold">¡Inventario 100% óptimo!</p>
                    <p className="text-[11px] text-gray-400">No hay ningún repuesto en stock 0 o por debajo del mínimo de alerta.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-gray-400 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">REPUESTO / MATERIAL</th>
                          <th className="p-3">MARCA</th>
                          <th className="p-3 text-center">STOCK ACTUAL</th>
                          <th className="p-3 text-center">STOCK MÍNIMO</th>
                          <th className="p-3 text-center">ESTADO CRÍTICO</th>
                          <th className="p-3 text-right">P. VENTA (S/)</th>
                          <th className="p-3 text-center">ACCIÓN SUGERIDA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {criticalItems.map((item) => (
                          <tr key={item.id} className={item.stock_quantity === 0 ? "bg-red-500/5" : "hover:bg-white/[0.02]"}>
                            <td className="p-3 font-mono text-amber-400 font-bold">{item.sku_barcode}</td>
                            <td className="p-3 text-white font-bold">{item.name}</td>
                            <td className="p-3 text-gray-400">{item.brand || "Genérico"}</td>
                            <td className="p-3 text-center font-mono font-black">
                              <span className={item.stock_quantity === 0 ? "text-red-400 font-extrabold" : "text-amber-400"}>
                                {formatQty(item.stock_quantity)} unid.
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-gray-400">{formatQty(item.min_stock_alert)} unid.</td>
                            <td className="p-3 text-center">
                              {item.stock_quantity === 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                                  AGOTADO TOTAL
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 uppercase">
                                  STOCK BAJO
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-gray-300">S/ {formatPEN(item.unit_price)}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-amber-300">
                                Emitir O/C Inmediata
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 6: HERRAMIENTAS EN PRÉSTAMO */}
            {activeReportTab === "herramientas" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-purple-400" />
                    Control de Herramientas de Taller en Préstamo ({formatQty(activeToolLoans.length)})
                  </h3>
                </div>

                {activeToolLoans.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 space-y-2 rounded-2xl bg-black/30 border border-white/10">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                    <p className="text-xs font-bold text-gray-300">Todas las herramientas están en almacén.</p>
                    <p className="text-[11px] text-gray-500">No hay herramientas pendientes de devolución.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-gray-400 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">HERRAMIENTA</th>
                          <th className="p-3">SERIE / CÓDIGO</th>
                          <th className="p-3">TÉCNICO RESPONSABLE</th>
                          <th className="p-3">FECHA Y HORA DE PRESTAMO</th>
                          <th className="p-3 text-center">ESTADO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {activeToolLoans.map((tl) => (
                          <tr key={tl.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 text-white font-bold">{tl.tool_name}</td>
                            <td className="p-3 font-mono text-gray-400">{tl.serial_number || "-"}</td>
                            <td className="p-3 text-amber-300 font-bold">{tl.technician_name}</td>
                            <td className="p-3 font-mono text-gray-400">
                              {new Date(tl.borrowed_at).toLocaleString("es-PE")}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                                PRESTADO
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Bottom Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div className="text-xs text-gray-400">
              Visualizando corte: <strong className="text-white">{formatPeruDate(selectedDate)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl border border-white/10 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Informe Oficial A4</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMAL A4 PRINT PORTAL CONTAINER (STRICT REYGAS-PRINTING STANDARD) */}
      {/* ========================================================================= */}
      {typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            id="daily-warehouse-report-print"
            className="reygas-print-container"
            style={{
              display: "none",
              visibility: "hidden",
              position: "fixed",
              left: "-9999px",
              top: 0,
            }}
          >
            {/* HOJA A4: RESUMEN EJECUTIVO, CAPITAL INMOVILIZADO, MOVIMIENTOS Y SEMÁFORO */}
            <div className="reygas-print-page" style={{ fontFamily: "Arial, sans-serif", color: "#000000", padding: "10mm" }}>
              
              {/* Membrete Oficial */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2.5px solid #000", paddingBottom: "6px", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#000", letterSpacing: "-0.5px" }}>
                    REYGAS AUTOGAS EQUIPMENT E.I.R.L.
                  </div>
                  <div style={{ fontSize: "9.5px", color: "#333", marginTop: "1px" }}>
                    RUC: 20608557341 | TALLER DE CONVERSIÓN & MANTENIMIENTO GNV / GLP
                  </div>
                  <div style={{ fontSize: "8.5px", color: "#555" }}>
                    Av. Separadora Industrial Nro. 647, Ate, Lima, Perú | Central: (01) 987-654-321
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: "900", background: "#f0f0f0", border: "1.5px solid #000", padding: "3px 6px", borderRadius: "4px" }}>
                    INFORME DIARIO DE ALMACÉN
                  </div>
                  <div style={{ fontSize: "9.5px", fontWeight: "bold", marginTop: "3px" }}>
                    FECHA DE CORTE: {formatPeruDate(selectedDate)}
                  </div>
                </div>
              </div>

              {/* Meta information bar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", background: "#f9f9f9", border: "1px solid #ddd", padding: "6px", borderRadius: "4px", fontSize: "9.5px", marginBottom: "10px" }}>
                <div>
                  <strong>EMITIDO POR:</strong> {responsibleName}
                </div>
                <div>
                  <strong>DIRIGIDO A:</strong> {managerName}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>HORA IMPRESIÓN:</strong> {new Date().toLocaleTimeString("es-PE")}
                </div>
              </div>

              {/* KPI Summary Matrix */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px", marginBottom: "10px" }}>
                <div style={{ border: "1.5px solid #333", padding: "5px", borderRadius: "4px", textAlign: "center" }}>
                  <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#555" }}>TOTAL CATÁLOGO</div>
                  <div style={{ fontSize: "13px", fontWeight: "900" }}>{formatQty(totalCatalogItems)} ítems</div>
                  <div style={{ fontSize: "7.5px", color: "#666" }}>{formatQty(totalStockUnits)} unid.</div>
                </div>
                <div style={{ border: "1.5px solid #333", padding: "5px", borderRadius: "4px", textAlign: "center", background: "#fafafa" }}>
                  <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#555" }}>VALORIZACIÓN TOTAL</div>
                  <div style={{ fontSize: "11px", fontWeight: "900" }}>S/ {formatPEN(totalStockValuation)}</div>
                  <div style={{ fontSize: "7.5px", color: "#666" }}>Stock vigente</div>
                </div>
                <div style={{ border: "1.5px solid #e65100", padding: "5px", borderRadius: "4px", textAlign: "center", background: "#fff3e0" }}>
                  <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#e65100" }}>TOP 10 INMOVILIZADO</div>
                  <div style={{ fontSize: "11px", fontWeight: "900", color: "#e65100" }}>S/ {formatPEN(totalTopSleepingCapital)}</div>
                  <div style={{ fontSize: "7.5px", color: "#666" }}>Dinero durmiendo</div>
                </div>
                <div style={{ border: "1.5px solid #1565c0", padding: "5px", borderRadius: "4px", textAlign: "center", background: "#e3f2fd" }}>
                  <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#1565c0" }}>DESPACHOS A TALLER</div>
                  <div style={{ fontSize: "13px", fontWeight: "900", color: "#1565c0" }}>-{formatQty(totalDayDispatchedUnits)} unid.</div>
                  <div style={{ fontSize: "7.5px", color: "#555" }}>S/ {formatPEN(totalDayDispatchedValuation)}</div>
                </div>
                <div style={{ border: "1.5px solid #c62828", padding: "5px", borderRadius: "4px", textAlign: "center", background: "#ffebee" }}>
                  <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#c62828" }}>COMPRAS URGENTES</div>
                  <div style={{ fontSize: "13px", fontWeight: "900", color: "#c62828" }}>{formatQty(criticalItems.length)} ítems</div>
                  <div style={{ fontSize: "7.5px", color: "#c62828", fontWeight: "bold" }}>{formatQty(zeroStockCount)} en Stock 0</div>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div style={{ border: "1px solid #ccc", padding: "6px 8px", borderRadius: "4px", background: "#fdfdfd", fontSize: "9px", lineHeight: "1.35", marginBottom: "10px" }}>
                <strong>RESUMEN EJECUTIVO:</strong> Al corte del día <strong>{formatPeruDate(selectedDate)}</strong>, el almacén cuenta con <strong>{formatQty(totalCatalogItems)} repuestos</strong> valorizados en <strong>S/ {formatPEN(totalStockValuation)}</strong>. Se identifican <strong>S/ {formatPEN(totalTopSleepingCapital)}</strong> concentrados en los 10 materiales más costosos sin alta rotación. Se despacharon <strong>{formatQty(totalDayDispatchedUnits)} unidades</strong> a vehículos en taller por un valor de <strong>S/ {formatPEN(totalDayDispatchedValuation)}</strong> y se reportan <strong>{formatQty(criticalItems.length)} repuestos en semáforo crítico</strong> para compra urgente.
              </div>

              {/* Section 1: Top Materiales Más Valorizados (Dinero Durmiendo) */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: "900", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                  1. MATERIALES MÁS VALORIZADOS EN ALMACÉN (CAPITAL INMOVILIZADO / DINERO DURMIENDO)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0", borderBottom: "1px solid #000", textAlign: "left" }}>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", width: "25px" }}>#</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", width: "90px" }}>SKU</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>MATERIAL / REPUESTO</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center", width: "50px" }}>STOCK</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "right", width: "70px" }}>P. VENTA</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "right", width: "80px" }}>VALORIZACIÓN TOTAL</th>
                      <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center", width: "65px" }}>ESTADO ROTACIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sleepingCapitalItems.slice(0, 6).map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold", textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{item.sku_barcode}</td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{item.name}</td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>{formatQty(item.stock_quantity)} unid.</td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "right" }}>S/ {formatPEN(item.unit_price)}</td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold", color: "#e65100" }}>
                          S/ {formatPEN(item.valuation)}
                        </td>
                        <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontSize: "8px" }}>
                          {item.exits === 0 ? "⚠️ Sin Salidas" : `${formatQty(item.exits)} salidas`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Section 2: Despachos a Taller del Día */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: "900", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                  2. DESPACHOS A VEHÍCULOS EN TALLER (SALIDAS DEL DÍA)
                </div>
                {dayDispatchedItems.length === 0 ? (
                  <div style={{ fontSize: "8.5px", fontStyle: "italic", color: "#666", padding: "3px 0" }}>
                    No se registraron salidas de repuestos en esta fecha.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
                    <thead>
                      <tr style={{ background: "#f0f0f0", borderBottom: "1px solid #000", textAlign: "left" }}>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>PLACA</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>CLIENTE</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>REPUESTO ENTREGADO</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center" }}>CANT.</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "right" }}>TOTAL S/</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>TÉCNICO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayDispatchedItems.slice(0, 6).map((d, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{d.plate}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd" }}>{d.clientName}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{d.partName}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>{formatQty(d.quantity)}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold" }}>S/ {formatPEN(d.totalPrice)}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd" }}>{d.technicianName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 3: Semáforo de Compras Críticas */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: "900", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                  3. SEMÁFORO DE COMPRAS URGENTES (STOCK 0 Y BAJO MÍNIMO)
                </div>
                {criticalItems.length === 0 ? (
                  <div style={{ fontSize: "8.5px", color: "#2e7d32", padding: "3px 0", fontWeight: "bold" }}>
                    Stock 100% balanceado. No hay productos críticos en esta fecha.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
                    <thead>
                      <tr style={{ background: "#f0f0f0", borderBottom: "1px solid #000", textAlign: "left" }}>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>SKU</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc" }}>REPUESTO</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center" }}>STOCK ACTUAL</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center" }}>STOCK MÍNIMO</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center" }}>ESTADO</th>
                        <th style={{ padding: "3px 4px", border: "1px solid #ccc", textAlign: "center" }}>ACCIÓN SUGERIDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalItems.slice(0, 5).map((c) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid #eee", background: c.stock_quantity === 0 ? "#fff5f5" : "transparent" }}>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{c.sku_barcode}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", fontWeight: "bold" }}>{c.name}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontWeight: "900", color: c.stock_quantity === 0 ? "#c62828" : "#000" }}>
                            {formatQty(c.stock_quantity)}
                          </td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center" }}>{formatQty(c.min_stock_alert)}</td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold", color: c.stock_quantity === 0 ? "#c62828" : "#f57f17" }}>
                            {c.stock_quantity === 0 ? "AGOTADO" : "BAJO MÍNIMO"}
                          </td>
                          <td style={{ padding: "2.5px 4px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>
                            Emitir O/C Urgente
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Observations Box */}
              <div style={{ border: "1px solid #bbb", padding: "6px 8px", borderRadius: "4px", fontSize: "9px", marginBottom: "18px" }}>
                <strong>OBSERVACIONES DEL RESPONSABLE:</strong> {observations || "Sin observaciones adicionales."}
              </div>

              {/* Signatures */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", marginTop: "15px", textAlign: "center" }}>
                <div>
                  <div style={{ borderTop: "1.5px solid #000", paddingTop: "4px", fontSize: "9.5px", fontWeight: "bold" }}>
                    {responsibleName}
                  </div>
                  <div style={{ fontSize: "8px", color: "#555" }}>RESPONSABLE DE ALMACÉN REYGAS</div>
                </div>
                <div>
                  <div style={{ borderTop: "1.5px solid #000", paddingTop: "4px", fontSize: "9.5px", fontWeight: "bold" }}>
                    {managerName}
                  </div>
                  <div style={{ fontSize: "8px", color: "#555" }}>V°B° GERENCIA GENERAL</div>
                </div>
              </div>

            </div>
          </div>,
          document.body
        )}
    </>
  );
}
