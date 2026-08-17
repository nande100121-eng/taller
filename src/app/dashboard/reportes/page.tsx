"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import {
  FileText,
  Calendar,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Coins,
  Wrench,
  Package,
  Award,
  ShieldAlert,
  Car,
  Layers,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3
} from "lucide-react";

// Universal Formatting Helpers
const formatPEN = (amount: number | null | undefined): string => {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return safe.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatQty = (qty: number | null | undefined): string => {
  const safe = typeof qty === "number" && !isNaN(qty) ? Math.round(qty) : 0;
  return safe.toLocaleString("es-PE");
};

export default function WorkshopReportsCenterPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    inventoryItems,
    workshopServices,
    recentIngresos,
    toolLoans,
    currentUser,
  } = useAppStore();

  // Selected date filter (default today in Peru)
  const [selectedDate, setSelectedDate] = useState<string>(getPeruDateString());
  const [selectedReportType, setSelectedReportType] = useState<
    "caja" | "taller" | "almacen" | "certificaciones" | "porteria" | "asistencia" | "consolidado"
  >("caja");

  const [responsibleName, setResponsibleName] = useState<string>(
    currentUser?.name || "Jefe de Operaciones / Caja"
  );
  const [managerName, setManagerName] = useState<string>("Gerencia General");
  const [observations, setObservations] = useState<string>(
    "Reporte generado automáticamente conforme a los registros y órdenes operativas del día en el sistema ERP ReyGas."
  );

  // Navigate date
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(getPeruDateString(d));
  };

  const isToday = selectedDate === getPeruDateString();

  // Fast O(1) lookups
  const invoicesByWorkOrderId = useMemo(() => {
    const map = new Map<string, (typeof invoices)[0]>();
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (inv && inv.work_order_id) {
        map.set(inv.work_order_id, inv);
      }
    }
    return map;
  }, [invoices]);

  const vehiclesByPlate = useMemo(() => {
    const map = new Map<string, (typeof vehicles)[0]>();
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v && v.plate) {
        map.set(v.plate.toUpperCase().trim(), v);
      }
    }
    return map;
  }, [vehicles]);

  // Authorized staff for payment destination
  const authorizedStaff = useMemo(() => {
    const list = technicians.filter((t) => t.is_active && t.can_receive_payment).map((t) => t.full_name.toUpperCase());
    const defaults = ["JAIME", "ISABEL", "FRANCO"];
    defaults.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    return list;
  }, [technicians]);

  // Split payment parser
  const parsePaymentBreakdown = (
    methodRaw: string = "",
    discountsRaw: any = "",
    notesRaw: string = "",
    totalAmount: number = 0,
    isPending: boolean = false
  ) => {
    if (isPending) return { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };

    const result = { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };
    const methodUpper = (methodRaw || "EFECTIVO").toUpperCase();

    const combinedStr = `${typeof discountsRaw === "string" ? discountsRaw : ""} ${notesRaw}`.toUpperCase();
    const regex = /([CEYTPB])\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/gi;
    const matches = [...combinedStr.matchAll(regex)];

    if (matches.length >= 2) {
      matches.forEach((m) => {
        const code = m[1].toUpperCase();
        const val = parseFloat(m[2]) || 0;
        if (code === "E") result.efectivo += val;
        else if (code === "Y" || code === "P") result.yape += val;
        else if (code === "T" || code === "B") result.transferencia += val;
        else if (code === "C") result.culqi += val;
      });

      const parsedSum = result.efectivo + result.yape + result.transferencia + result.culqi;
      if (parsedSum > 0 && Math.abs(parsedSum - totalAmount) > 0.1) {
        const factor = totalAmount / parsedSum;
        result.efectivo = +(result.efectivo * factor).toFixed(2);
        result.yape = +(result.yape * factor).toFixed(2);
        result.transferencia = +(result.transferencia * factor).toFixed(2);
        result.culqi = +(result.culqi * factor).toFixed(2);
      }
      return result;
    }

    if (methodUpper.includes("EFECTIVO") || methodUpper === "CASH") {
      result.efectivo = totalAmount;
    } else if (methodUpper.includes("YAPE") || methodUpper.includes("PLIN")) {
      result.yape = totalAmount;
    } else if (methodUpper.includes("TRANSFER") || methodUpper.includes("BANCO") || methodUpper.includes("BCP") || methodUpper.includes("BBVA")) {
      result.transferencia = totalAmount;
    } else if (methodUpper.includes("TARJETA") || methodUpper.includes("CULQI") || methodUpper.includes("POS") || methodUpper.includes("CARD")) {
      result.culqi = totalAmount;
    } else {
      result.efectivo = totalAmount;
    }

    return result;
  };

  // Day's work orders
  const dayOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const dateStr = (wo.entry_time || (wo as any).created_at || "").slice(0, 10);
      return dateStr === selectedDate;
    });
  }, [workOrders, selectedDate]);

  // Day's direct invoices
  const dayInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const dateStr = (inv.issued_at || "").slice(0, 10);
      return dateStr === selectedDate;
    });
  }, [invoices, selectedDate]);

  // Consolidated Rows for Caja Table
  const consolidatedRows = useMemo(() => {
    const rows: Array<{
      id: string;
      itemNumber: number;
      plate: string;
      description: string;
      total: number;
      isPending: boolean;
      efectivo: number;
      yape: number;
      transferencia: number;
      culqi: number;
      responsable: string;
      yapeDestino: string;
      transfDestino: string;
    }> = [];

    let count = 1;
    const processedOrderIds = new Set<string>();

    // 1. Map Work Orders
    dayOrders.forEach((wo) => {
      processedOrderIds.add(wo.id);
      const inv = invoicesByWorkOrderId.get(wo.id);
      const isDone = wo.status === "finalizado" || wo.status === "pagado_autorizado" || (wo.status as string) === "completado";
      const isPending = !inv || inv.payment_status === "pendiente" || !isDone;
      const orderCost = (wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0;
      const totalAmount = inv ? (Number(inv.grand_total) || Number((inv as any).total_amount) || 0) : orderCost;
      const paymentMethod = inv?.payment_method || (isPending ? "PENDIENTE" : "EFECTIVO");

      const breakdown = parsePaymentBreakdown(
        paymentMethod,
        (inv as any)?.discounts || "",
        (wo as any)?.diagnostic_notes || (inv as any)?.notes || "",
        totalAmount,
        isPending
      );

      const notesLower = ((wo as any)?.diagnostic_notes || (inv as any)?.notes || "").toLowerCase();
      let yDest = "EMPRESA";
      let tDest = "EMPRESA";

      for (const st of authorizedStaff) {
        if (notesLower.includes(st.toLowerCase())) {
          if (breakdown.yape > 0) yDest = st;
          if (breakdown.transferencia > 0) tDest = st;
          break;
        }
      }

      const desc =
        wo.items && wo.items.length > 0
          ? wo.items.map((i) => i.description).join(", ")
          : (wo as any).general_maintenance_service || (wo as any).diagnostic_notes || "Servicio de Taller";

      const techAssigned = wo.assigned_technician_id
        ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name
        : (wo as any).technician_name;

      rows.push({
        id: wo.id,
        itemNumber: count++,
        plate: (wo.vehicle_plate || "S/P").toUpperCase(),
        description: desc,
        total: totalAmount,
        isPending,
        efectivo: breakdown.efectivo,
        yape: breakdown.yape,
        transferencia: breakdown.transferencia,
        culqi: breakdown.culqi,
        responsable: (techAssigned || "Taller").split(" ")[0].toUpperCase(),
        yapeDestino: yDest,
        transfDestino: tDest,
      });
    });

    // 2. Map Standalone Invoices
    dayInvoices.forEach((inv) => {
      if (inv.work_order_id && processedOrderIds.has(inv.work_order_id)) return;

      const isPending = inv.payment_status === "pendiente";
      const totalAmount = Number(inv.grand_total) || Number((inv as any).total_amount) || 0;
      const breakdown = parsePaymentBreakdown(
        inv.payment_method || "EFECTIVO",
        (inv as any).discounts || "",
        (inv as any).notes || "",
        totalAmount,
        isPending
      );

      const notesLower = ((inv as any).notes || "").toLowerCase();
      let yDest = "EMPRESA";
      let tDest = "EMPRESA";

      for (const st of authorizedStaff) {
        if (notesLower.includes(st.toLowerCase())) {
          if (breakdown.yape > 0) yDest = st;
          if (breakdown.transferencia > 0) tDest = st;
          break;
        }
      }

      rows.push({
        id: inv.id,
        itemNumber: count++,
        plate: (inv.vehicle_plate || "DIRECTA").toUpperCase(),
        description: (inv as any).service_type || (inv as any).notes || "Certificación / Venta Directa",
        total: totalAmount,
        isPending,
        efectivo: breakdown.efectivo,
        yape: breakdown.yape,
        transferencia: breakdown.transferencia,
        culqi: breakdown.culqi,
        responsable: "CAJA",
        yapeDestino: yDest,
        transfDestino: tDest,
      });
    });

    return rows;
  }, [dayOrders, dayInvoices, invoicesByWorkOrderId, authorizedStaff]);

  // Financial Totals
  const totals = useMemo(() => {
    let cobradoEfectivo = 0;
    let cobradoYapes = 0;
    let cobradoTransferencias = 0;
    let cobradoCulqi = 0;
    let totalPendiente = 0;
    let totalFacturado = 0;

    consolidatedRows.forEach((r) => {
      totalFacturado += r.total;
      if (r.isPending) {
        totalPendiente += r.total;
      } else {
        cobradoEfectivo += r.efectivo;
        cobradoYapes += r.yape;
        cobradoTransferencias += r.transferencia;
        cobradoCulqi += r.culqi;
      }
    });

    const totalLiquidacion = cobradoEfectivo + cobradoYapes + cobradoTransferencias + cobradoCulqi;

    return {
      cobradoEfectivo,
      cobradoYapes,
      cobradoTransferencias,
      cobradoCulqi,
      totalPendiente,
      totalFacturado,
      totalLiquidacion,
    };
  }, [consolidatedRows]);

  // Yapes Matrix
  const yapeDestinations = useMemo(() => {
    const cols = [...authorizedStaff, "EMPRESA"];
    const rowsList: Array<{ rowIdx: number; values: Record<string, number> }> = [];
    const sumByCol: Record<string, number> = {};
    cols.forEach((c) => (sumByCol[c] = 0));

    let maxIdx = 15;
    const yapeRows = consolidatedRows.filter((r) => r.yape > 0);
    if (yapeRows.length > maxIdx) maxIdx = yapeRows.length;

    for (let i = 0; i < maxIdx; i++) {
      const r = yapeRows[i];
      const valObj: Record<string, number> = {};
      cols.forEach((c) => (valObj[c] = 0));

      if (r) {
        const dest = cols.includes(r.yapeDestino) ? r.yapeDestino : "EMPRESA";
        valObj[dest] = r.yape;
        sumByCol[dest] = (sumByCol[dest] || 0) + r.yape;
      }
      rowsList.push({ rowIdx: i + 1, values: valObj });
    }

    return { cols, rowsList, sumByCol };
  }, [consolidatedRows, authorizedStaff]);

  // Technician Metrics
  const techPerformance = useMemo(() => {
    const map = new Map<string, { name: string; count: number; completed: number; totalSales: number }>();
    technicians.forEach((t) => {
      map.set(t.full_name, { name: t.full_name, count: 0, completed: 0, totalSales: 0 });
    });

    dayOrders.forEach((wo) => {
      const techAssigned = wo.assigned_technician_id
        ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name
        : (wo as any).technician_name;
      const techName = techAssigned || "Sin Asignar";
      const existing = map.get(techName) || { name: techName, count: 0, completed: 0, totalSales: 0 };
      existing.count += 1;
      const isDone = wo.status === "finalizado" || wo.status === "pagado_autorizado" || (wo.status as string) === "completado";
      if (isDone) existing.completed += 1;
      const orderCost = (wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0;
      existing.totalSales += orderCost;
      map.set(techName, existing);
    });

    return Array.from(map.values()).filter((tp) => tp.count > 0 || technicians.some((t) => t.full_name === tp.name && t.is_active));
  }, [technicians, dayOrders]);

  // Warehouse Metrics
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

  const highValueMaterials = useMemo(() => {
    return [...inventoryItems]
      .map((item) => {
        const qty = Number(item.stock_quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return {
          ...item,
          totalValue: qty * price,
        };
      })
      .filter((i) => i.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [inventoryItems]);

  const criticalStockItems = useMemo(() => {
    return inventoryItems.filter((i) => (Number(i.stock_quantity) || 0) <= (Number(i.min_stock_alert) || 3));
  }, [inventoryItems]);

  // Report Navigation Config
  const reportTabs = [
    { id: "caja", label: "1. Caja & Liquidación Diaria", icon: Coins, color: "text-amber-400" },
    { id: "taller", label: "2. Taller & Productividad", icon: Wrench, color: "text-indigo-400" },
    { id: "almacen", label: "3. Almacén & Valorización", icon: Package, color: "text-emerald-400" },
    { id: "certificaciones", label: "4. Certificaciones GNV/GLP", icon: Award, color: "text-cyan-400" },
    { id: "porteria", label: "5. Portería & Patio", icon: ShieldAlert, color: "text-rose-400" },
    { id: "asistencia", label: "6. Asistencia de Personal", icon: Clock, color: "text-purple-400" },
    { id: "consolidado", label: "7. Informe Consolidado 360°", icon: Sparkles, color: "text-amber-300" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Centro de Reportes del Taller & Gerencia
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {formatPeruDate(selectedDate)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Seleccione cualquier módulo para auditar arqueos, producción de taller, valorización de almacén y certificaciones.
            </p>
          </div>
        </div>

        {/* Universal Date Navigator & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Universal Date Navigator */}
          <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-2xl border border-white/15 shadow-inner">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
              title="Día Anterior (-1 Día)"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Día Anterior</span>
            </button>

            <MiniDatePicker
              value={selectedDate}
              onChange={(newDate) => setSelectedDate(newDate)}
            />

            <button
              type="button"
              onClick={() => changeDate(1)}
              className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
              title="Día Siguiente (+1 Día)"
            >
              <span className="hidden sm:inline">Día Siguiente</span>
              <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(getPeruDateString())}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-transform active:scale-95 ${
                isToday
                  ? "bg-white/10 text-gray-400 border border-white/10"
                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 hover:scale-105"
              }`}
            >
              Hoy
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir A4</span>
          </button>
        </div>
      </div>

      {/* Selector Tabs for All 7 Area Reports */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-reygas-dark border border-white/10 overflow-x-auto shadow-inner">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedReportType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedReportType(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shrink-0 active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-lg shadow-amber-500/20 scale-[1.02]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            <span>Efectivo en Caja</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
            S/ {formatPEN(totals.cobradoEfectivo)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
            <Coins className="w-3 h-3" />
            <span>Yapes Recaudados</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
            S/ {formatPEN(totals.cobradoYapes)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1">
            <Building className="w-3 h-3" />
            <span>Transferencias</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
            S/ {formatPEN(totals.cobradoTransferencias)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            <span>Culqi / Tarjeta</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
            S/ {formatPEN(totals.cobradoCulqi)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Pendiente / Crédito</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-rose-300 mt-1">
            S/ {formatPEN(totals.totalPendiente)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/40 flex flex-col justify-between shadow-lg shadow-amber-500/10">
          <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Total Liquidación</span>
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-amber-300 mt-1">
            S/ {formatPEN(totals.totalLiquidacion)}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REPORT CONTENT VIEW BASED ON SELECTED TAB */}
      {/* ========================================================================= */}

      {/* 1. CAJA & LIQUIDACIÓN DIARIA (EXACT LAYOUT FROM USER SCREENSHOT) */}
      {(selectedReportType === "caja" || selectedReportType === "consolidado") && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Main Table (8 cols on lg) */}
            <div className="lg:col-span-8 space-y-2">
              <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
                <div className="bg-[#e58a00] text-black px-4 py-2.5 flex items-center justify-between font-black text-sm uppercase tracking-wider print:bg-gray-200 print:text-black">
                  <span className="tracking-wide">REYGAS TALLER</span>
                  <span className="text-base font-black">REPORTE DE CAJA {formatPeruDate(selectedDate)}</span>
                  <span className="text-xs bg-black/20 px-2.5 py-0.5 rounded-full font-mono">
                    {consolidatedRows.length} ATENCIONES
                  </span>
                </div>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#ffd269] text-black font-extrabold uppercase text-[11px] border-b border-amber-600/30 print:bg-gray-100">
                      <th className="py-2 px-2 text-center w-10 border-r border-amber-600/20">ITEM</th>
                      <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20">TOTAL</th>
                      <th className="py-2 px-2 text-center w-24 border-r border-amber-600/20 bg-[#aee2ff]">PLACA</th>
                      <th className="py-2 px-3 border-r border-amber-600/20 bg-[#d5cbfd]">SERVICIO O REPUESTO</th>
                      <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#f43f5e] text-white">PENDIENTE</th>
                      <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#10b981] text-white">EFECTIVO</th>
                      <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#c026d3] text-white">YAPE</th>
                      <th className="py-2 px-2 text-center w-24 border-r border-amber-600/20 bg-[#2563eb] text-white">TRANSFERENCIA</th>
                      <th className="py-2 px-2 text-center w-16 border-r border-amber-600/20 bg-[#eab308] text-black">CULQI</th>
                      <th className="py-2 px-2 text-center w-24 bg-[#e2e8f0] text-black">RESPONSABLE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {consolidatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-gray-400 italic">
                          No hay movimientos registrados para la fecha {formatPeruDate(selectedDate)}.
                        </td>
                      </tr>
                    ) : (
                      consolidatedRows.map((r, idx) => (
                        <tr key={r.id + idx} className="hover:bg-white/5 transition-colors text-white">
                          <td className="py-2 px-2 text-center text-gray-400 font-bold border-r border-white/5">{r.itemNumber}</td>
                          <td className="py-2 px-2 text-right font-black text-amber-300 border-r border-white/5">{formatPEN(r.total)}</td>
                          <td className="py-2 px-2 text-center font-black text-cyan-300 bg-cyan-950/20 border-r border-white/5">{r.plate}</td>
                          <td className="py-2 px-3 text-gray-200 font-sans text-xs border-r border-white/5 truncate max-w-xs" title={r.description}>{r.description}</td>
                          <td className="py-2 px-2 text-right font-bold text-rose-400 bg-rose-950/10 border-r border-white/5">{r.isPending ? formatPEN(r.total) : "-"}</td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400 bg-emerald-950/10 border-r border-white/5">{r.efectivo > 0 ? formatPEN(r.efectivo) : "-"}</td>
                          <td className="py-2 px-2 text-right font-bold text-purple-400 bg-purple-950/10 border-r border-white/5">{r.yape > 0 ? formatPEN(r.yape) : "-"}</td>
                          <td className="py-2 px-2 text-right font-bold text-blue-400 bg-blue-950/10 border-r border-white/5">{r.transferencia > 0 ? formatPEN(r.transferencia) : "-"}</td>
                          <td className="py-2 px-2 text-right font-bold text-amber-400 bg-amber-950/10 border-r border-white/5">{r.culqi > 0 ? formatPEN(r.culqi) : "-"}</td>
                          <td className="py-2 px-2 text-center font-bold text-gray-300 bg-white/[0.02] text-[10px]">{r.responsable}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black text-xs font-black border-t-2 border-amber-500/40">
                      <td className="py-2 px-2 text-cyan-400 font-extrabold uppercase border-r border-white/10" colSpan={3}>COBRADO</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-white border-r border-white/10">S/ {formatPEN(totals.totalLiquidacion)}</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-rose-400 bg-rose-950/40 border-r border-white/10">S/ {formatPEN(totals.totalPendiente)}</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-emerald-400 bg-emerald-950/40 border-r border-white/10">S/ {formatPEN(totals.cobradoEfectivo)}</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-purple-400 bg-purple-950/40 border-r border-white/10">S/ {formatPEN(totals.cobradoYapes)}</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-blue-400 bg-blue-950/40 border-r border-white/10">S/ {formatPEN(totals.cobradoTransferencias)}</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-amber-400 bg-amber-950/40 border-r border-white/10">S/ {formatPEN(totals.cobradoCulqi)}</td>
                      <td className="py-2 px-2 bg-black"></td>
                    </tr>
                    <tr className="bg-[#f59e0b] text-black font-black text-sm">
                      <td className="py-3 px-4 font-black uppercase tracking-wider" colSpan={3}>TOTAL GENERAL</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-base" colSpan={7}>S/ {formatPEN(totals.totalFacturado)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Side Table: Yapes por Destino (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-2">
              <div className="overflow-x-auto rounded-2xl border border-purple-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
                <div className="bg-[#a21caf] text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    <span>YAPES POR DESTINO</span>
                  </div>
                  <span className="bg-[#2563eb] text-white px-2 py-0.5 rounded text-[10px] font-bold">TRANSFERENCIA</span>
                </div>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#e9d5ff] text-black font-extrabold uppercase text-[10px] border-b border-purple-300">
                      <th className="py-1.5 px-1 text-center w-8 border-r border-purple-300">N°</th>
                      {yapeDestinations.cols.map((col) => (
                        <th key={col} className={`py-1.5 px-1.5 text-center font-black border-r border-purple-300 ${col === "EMPRESA" ? "bg-[#bbf7d0] text-emerald-950" : ""}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {yapeDestinations.rowsList.map((row) => (
                      <tr key={row.rowIdx} className="hover:bg-white/5 text-white">
                        <td className="py-1 px-1 text-center text-gray-500 font-bold border-r border-white/5 text-[10px]">{row.rowIdx}</td>
                        {yapeDestinations.cols.map((col) => {
                          const val = row.values[col] || 0;
                          return (
                            <td key={col} className={`py-1 px-1.5 text-right border-r border-white/5 ${val > 0 ? "font-bold text-purple-300 bg-purple-950/20" : "text-gray-700"}`}>
                              {val > 0 ? formatPEN(val) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black text-[11px] font-black border-t-2 border-purple-500/40">
                      <td className="py-2 px-1 text-center text-purple-400 font-black border-r border-white/10">Σ</td>
                      {yapeDestinations.cols.map((col) => {
                        const sum = yapeDestinations.sumByCol[col] || 0;
                        return (
                          <td key={col} className="py-2 px-1.5 text-right font-mono font-black text-purple-300 border-r border-white/10">
                            S/ {formatPEN(sum)}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-[#f59e0b] text-black font-black text-xs">
                      <td className="py-2 px-2 font-black uppercase tracking-wider" colSpan={2}>TOTAL YAPES</td>
                      <td className="py-2 px-2 text-right font-mono font-black text-sm" colSpan={yapeDestinations.cols.length - 1}>
                        S/ {formatPEN(totals.cobradoYapes)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. TALLER & PRODUCTIVIDAD DE TÉCNICOS */}
      {(selectedReportType === "taller" || selectedReportType === "consolidado") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 glass-panel p-5 rounded-3xl border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>Rendimiento por Técnico / Mecánico</span>
              </h3>
              <span className="text-xs font-mono text-indigo-300 font-bold">{techPerformance.length} TÉCNICOS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10">
                    <th className="py-2 px-2">Técnico</th>
                    <th className="py-2 px-2 text-center">Atenciones</th>
                    <th className="py-2 px-2 text-center">Listos</th>
                    <th className="py-2 px-2 text-right">Producción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {techPerformance.map((tp) => (
                    <tr key={tp.name} className="hover:bg-white/5">
                      <td className="py-2 px-2 font-sans font-bold text-white">{tp.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-indigo-300">{tp.count}</td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-400">{tp.completed}</td>
                      <td className="py-2 px-2 text-right font-black text-amber-300">S/ {formatPEN(tp.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-7 glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                <span>Órdenes de Trabajo del Día ({dayOrders.length} Vehículos)</span>
              </h3>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10 sticky top-0 bg-reygas-dark">
                    <th className="py-2 px-2">Placa</th>
                    <th className="py-2 px-2">Mecánico</th>
                    <th className="py-2 px-2">Servicios</th>
                    <th className="py-2 px-2 text-center">Estado</th>
                    <th className="py-2 px-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {dayOrders.map((wo) => {
                    const techAssigned = wo.assigned_technician_id
                      ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name
                      : (wo as any).technician_name;
                    return (
                      <tr key={wo.id} className="hover:bg-white/5">
                        <td className="py-2 px-2 font-black text-cyan-300">{wo.vehicle_plate}</td>
                        <td className="py-2 px-2 font-sans text-gray-200">{(techAssigned || "Sin Asignar").split(" ")[0]}</td>
                      <td className="py-2 px-2 font-sans text-gray-300 truncate max-w-xs">
                        {wo.items?.map((i) => i.description).join(", ") || (wo as any).general_maintenance_service || "Mantenimiento"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${wo.status === "finalizado" || wo.status === "pagado_autorizado" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                          {wo.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-amber-300">S/ {formatPEN((wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. ALMACÉN & VALORIZACIÓN DE INVENTARIO */}
      {(selectedReportType === "almacen" || selectedReportType === "consolidado") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 glass-panel p-5 rounded-3xl border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Materiales de Mayor Valorización (Capital en Almacén)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10">
                    <th className="py-2 px-2">Material / Repuesto</th>
                    <th className="py-2 px-2 text-center">Stock</th>
                    <th className="py-2 px-2 text-right">P. Unitario</th>
                    <th className="py-2 px-2 text-right">Valorización Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {highValueMaterials.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="py-2 px-2 font-sans font-bold text-white">{item.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-cyan-300">{formatQty(item.stock_quantity)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">S/ {formatPEN(item.unit_price)}</td>
                      <td className="py-2 px-2 text-right font-black text-emerald-400">S/ {formatPEN(item.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-6 glass-panel p-5 rounded-3xl border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Repuestos con Stock Crítico o por Agotarse (Semáforo Rojo/Amarillo)</span>
              </h3>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10">
                    <th className="py-2 px-2">Repuesto</th>
                    <th className="py-2 px-2 text-center">Stock Actual</th>
                    <th className="py-2 px-2 text-center">Alerta Mínima</th>
                    <th className="py-2 px-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {criticalStockItems.slice(0, 10).map((item) => {
                    const isZero = (Number(item.stock_quantity) || 0) <= 0;
                    return (
                      <tr key={item.id} className="hover:bg-white/5">
                        <td className="py-2 px-2 font-sans font-bold text-white">{item.name}</td>
                        <td className={`py-2 px-2 text-center font-black ${isZero ? "text-rose-400" : "text-amber-400"}`}>
                          {formatQty(item.stock_quantity)}
                        </td>
                        <td className="py-2 px-2 text-center text-gray-400">{formatQty(item.min_stock_alert || 3)}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isZero ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                            {isZero ? "AGOTADO (0)" : "REPOSICIÓN"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. CERTIFICACIONES GNV / GLP */}
      {(selectedReportType === "certificaciones" || selectedReportType === "consolidado") && (
        <div className="glass-panel p-5 rounded-3xl border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Certificaciones GNV / GLP & Pruebas Quinquenales</span>
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Todas las revisiones técnicas, certificados anuales y chips emitidos son registrados e integrados en tiempo real al consolidado de caja e historial vehicular de la nube.
          </p>
        </div>
      )}

      {/* 5. PORTERÍA, PATIO & ESTADÍA VEHICULAR */}
      {(selectedReportType === "porteria" || selectedReportType === "consolidado") && (
        <div className="glass-panel p-5 rounded-3xl border border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Control de Tránsito Vehicular & Inventario de Patio</span>
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Registro de ingreso y salida vehicular con inspección de cabina, kilometraje y semáforo de tiempo de permanencia en taller.
          </p>
        </div>
      )}

      {/* 6. ASISTENCIA BIOMÉTRICA & PERSONAL */}
      {(selectedReportType === "asistencia" || selectedReportType === "consolidado") && (
        <div className="glass-panel p-5 rounded-3xl border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Consolidado de Asistencia y Puntualidad de Técnicos</span>
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Registro de marcas biométricas de entrada, salida, horas efectivas laboradas y cálculo de tardanzas por colaborador.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE SUMMARY & SIGNATURES BLOCK */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-black/40 to-indigo-500/10 border border-amber-500/30 space-y-4 print:border-black print:rounded-none print:bg-none print:p-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase tracking-wide">
            <Sparkles className="w-5 h-5" />
            <span>Resumen Ejecutivo para Gerencia General</span>
          </div>
          <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>OPERACIONES CONFORMES</span>
          </span>
        </div>

        <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium print:text-black">
          Al corte del día <strong>{formatPeruDate(selectedDate)}</strong>, el Taller ReyGas registró un total de <strong>{dayOrders.length} vehículos atendidos</strong> con una facturación general de <strong>S/ {formatPEN(totals.totalFacturado)}</strong> y una liquidación neta recaudada en caja de <strong>S/ {formatPEN(totals.totalLiquidacion)}</strong>. El inventario total en almacén asciende a <strong>{formatQty(totalStockUnits)} unidades</strong> valorizadas en <strong>S/ {formatPEN(totalStockValuation)}</strong>.
        </p>

        {/* Editable Observations */}
        <div className="space-y-1 pt-2 border-t border-white/10 print:border-black">
          <label className="text-[11px] font-bold uppercase text-gray-400 block print:text-black">
            Observaciones e Incidencias del Responsable de Operaciones:
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={2}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors print:bg-white print:border-black print:text-black"
          />
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-white/10 print:border-black">
          <div className="text-center space-y-1">
            <div className="border-b border-gray-500 w-3/4 mx-auto pb-8 print:border-black"></div>
            <input
              type="text"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              className="bg-transparent text-center text-xs font-bold text-white w-full focus:outline-none print:text-black"
            />
            <span className="text-[10px] text-gray-400 block uppercase print:text-black">
              Responsable de Operaciones & Caja
            </span>
          </div>

          <div className="text-center space-y-1">
            <div className="border-b border-gray-500 w-3/4 mx-auto pb-8 print:border-black"></div>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="bg-transparent text-center text-xs font-bold text-white w-full focus:outline-none print:text-black"
            />
            <span className="text-[10px] text-gray-400 block uppercase print:text-black">
              Gerencia General / Auditoría ReyGas
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
