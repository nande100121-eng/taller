"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import { getWorkshopDayRecords, getWorkshopCSVRecord, WorkshopCSVRecord } from "@/lib/workshop-csv-lookup";
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

  // Authorized staff for payment destination
  const authorizedStaff = useMemo(() => {
    const list = technicians.filter((t) => t.is_active && t.can_receive_payment).map((t) => t.full_name.toUpperCase());
    const defaults = ["JAIME", "ISABEL", "FRANCO"];
    defaults.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    return list;
  }, [technicians]);

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

  // Consolidated Rows for Caja & Taller Tables
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
      isInvoice: boolean;
      orderStatus: string;
    }> = [];

    let count = 1;
    const processedKeys = new Set<string>();

    // 1. First Priority: Load exact day records from workshop CSV lookup (e.g. 15/08/2026, 14/08/2026, etc.)
    const csvDayRecords = getWorkshopDayRecords(selectedDate);

    if (csvDayRecords && csvDayRecords.length > 0) {
      csvDayRecords.forEach((rec, idx) => {
        const uniqueKey = `csv_${rec.plate}_${rec.receiptNumber}_${idx}`;
        processedKeys.add(uniqueKey);
        processedKeys.add(rec.plate.toUpperCase().trim());

        const totalAmount = rec.price > 0 ? rec.price : (rec.credit > 0 ? rec.credit : 0);
        const condUpper = (rec.condition || "").toUpperCase().trim();
        const isPending = condUpper === "PENDIENTE" || (rec.credit > 0 && rec.price === 0);
        const paymentMethod = rec.method || (isPending ? "PENDIENTE" : "EFECTIVO");

        const breakdown = parsePaymentBreakdown(
          paymentMethod,
          rec.discounts || "",
          (rec.service || "") + " " + (rec.parts || ""),
          totalAmount,
          isPending
        );

        const yDest = rec.destination ? rec.destination.toUpperCase() : "EMPRESA";
        const tDest = rec.destination ? rec.destination.toUpperCase() : "EMPRESA";

        const desc = [rec.service, rec.parts].filter(Boolean).join(" - ") || "Servicio de Taller";
        const techName = rec.technician || "Taller";

        rows.push({
          id: uniqueKey,
          itemNumber: count++,
          plate: (rec.plate || "S/P").toUpperCase(),
          description: desc,
          total: totalAmount,
          isPending,
          efectivo: breakdown.efectivo,
          yape: breakdown.yape,
          transferencia: breakdown.transferencia,
          culqi: breakdown.culqi,
          responsable: techName.split(",")[0].split("-")[0].split(" ")[0].toUpperCase() || "TALLER",
          yapeDestino: yDest,
          transfDestino: tDest,
          isInvoice: Boolean(rec.receiptNumber && rec.receiptNumber !== "0"),
          orderStatus: isPending ? "pendiente" : "finalizado",
        });
      });
    }

    const processedOrderIds = new Set<string>();

    // 2. Map Work Orders
    dayOrders.forEach((wo) => {
      const plateKey = (wo.vehicle_plate || "").toUpperCase().trim();
      if (csvDayRecords.length > 0 && processedKeys.has(plateKey)) return;
      processedOrderIds.add(wo.id);
      const inv = invoicesByWorkOrderId.get(wo.id);
      const csvRec = getWorkshopCSVRecord(wo.vehicle_plate || "");

      const isDone = wo.status === "finalizado" || wo.status === "pagado_autorizado" || (wo.status as string) === "completado";
      const isPending = !inv || inv.payment_status === "pendiente" || !isDone;
      const orderCost = (wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0;
      let totalAmount = inv ? (Number(inv.grand_total) || Number((inv as any).total_amount) || 0) : orderCost;
      if (totalAmount === 0 && csvRec) {
        totalAmount = csvRec.price || csvRec.credit || 0;
      }

      const paymentMethod = inv?.payment_method || (csvRec?.method) || (isPending ? "PENDIENTE" : "EFECTIVO");

      const breakdown = parsePaymentBreakdown(
        paymentMethod,
        (inv as any)?.discounts || csvRec?.discounts || "",
        (wo as any)?.diagnostic_notes || (inv as any)?.notes || (csvRec?.parts) || "",
        totalAmount,
        isPending
      );

      // Determine payment destination
      const notesLower = ((wo as any)?.diagnostic_notes || (inv as any)?.notes || (csvRec?.destination) || "").toLowerCase();
      let yDest = csvRec?.destination ? csvRec.destination.toUpperCase() : "EMPRESA";
      let tDest = csvRec?.destination ? csvRec.destination.toUpperCase() : "EMPRESA";

      const desc =
        wo.items && wo.items.length > 0
          ? wo.items.map((i) => i.description).join(", ")
          : (wo as any).general_maintenance_service || (wo as any).diagnostic_notes || csvRec?.service || "Servicio de Taller";

      const techAssigned = wo.assigned_technician_id
        ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name
        : (wo as any).technician_name || csvRec?.technician;

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
        isInvoice: Boolean(inv?.id),
        orderStatus: wo.status,
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
        isInvoice: true,
        orderStatus: isPending ? "pendiente" : "finalizado",
      });
    });

    return rows;
  }, [dayOrders, dayInvoices, invoicesByWorkOrderId, authorizedStaff, selectedDate, technicians]);

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

  // Category Breakdown: Servicios vs Repuestos vs Certificaciones
  const categoryBreakdown = useMemo(() => {
    let servTotal = 0;
    let servCount = 0;
    let repTotal = 0;
    let repCount = 0;
    let certTotal = 0;
    let certCount = 0;

    consolidatedRows.forEach((r) => {
      const desc = r.description.toUpperCase();
      const isCert = desc.includes("CERTIFIC") || desc.includes("ANUAL") || desc.includes("QUINQUENAL") || desc.includes("CHIP") || desc.includes("CILINDRO") || desc.includes("CONVERSI");
      const isRep = desc.includes("BUJIA") || desc.includes("BOBINA") || desc.includes("FILTRO") || desc.includes("CABLE") || desc.includes("VALVULA") || desc.includes("MEMBRANA") || desc.includes("RED") || desc.includes("INYECT") || desc.includes("EMULADOR") || desc.includes("VARIADOR") || desc.includes("KIT") || desc.includes("REPUESTO");

      if (isCert) {
        certTotal += r.total;
        certCount += 1;
      } else if (isRep) {
        repTotal += r.total;
        repCount += 1;
      } else {
        servTotal += r.total;
        servCount += 1;
      }
    });

    const grandTotal = servTotal + repTotal + certTotal || totals.totalFacturado || 1;

    return {
      servTotal,
      servCount,
      servPercent: (servTotal / grandTotal) * 100,
      repTotal,
      repCount,
      repPercent: (repTotal / grandTotal) * 100,
      certTotal,
      certCount,
      certPercent: (certTotal / grandTotal) * 100,
      grandTotal: servTotal + repTotal + certTotal,
    };
  }, [consolidatedRows, totals.totalFacturado]);

  // Electronic Destinations Matrix: Separating Yapes from Transferencias
  const electronicMatrix = useMemo(() => {
    const yapeStaff = ["JAIME", "ISABEL", "FRANCO", "EMPRESA"];
    const transfStaff = ["EMPRESA"];

    const yapeRows = consolidatedRows.filter((r) => r.yape > 0);
    const transfRows = consolidatedRows.filter((r) => r.transferencia > 0);

    const maxRows = Math.max(12, yapeRows.length, transfRows.length);
    const matrixRows: Array<{
      rowIdx: number;
      yapeValues: Record<string, number>;
      transfValues: Record<string, number>;
    }> = [];

    const sumYapesByCol: Record<string, number> = {};
    const sumTransfByCol: Record<string, number> = {};
    yapeStaff.forEach((s) => (sumYapesByCol[s] = 0));
    transfStaff.forEach((s) => (sumTransfByCol[s] = 0));

    for (let i = 0; i < maxRows; i++) {
      const yRow = yapeRows[i];
      const tRow = transfRows[i];

      const yObj: Record<string, number> = {};
      const tObj: Record<string, number> = {};
      yapeStaff.forEach((s) => (yObj[s] = 0));
      transfStaff.forEach((s) => (tObj[s] = 0));

      if (yRow) {
        const dest = yapeStaff.includes(yRow.yapeDestino) ? yRow.yapeDestino : "EMPRESA";
        yObj[dest] = yRow.yape;
        sumYapesByCol[dest] = (sumYapesByCol[dest] || 0) + yRow.yape;
      }

      if (tRow) {
        const dest = transfStaff.includes(tRow.transfDestino) ? tRow.transfDestino : "EMPRESA";
        tObj[dest] = tRow.transferencia;
        sumTransfByCol[dest] = (sumTransfByCol[dest] || 0) + tRow.transferencia;
      }

      matrixRows.push({
        rowIdx: i + 1,
        yapeValues: yObj,
        transfValues: tObj,
      });
    }

    const totalYapes = Object.values(sumYapesByCol).reduce((a, b) => a + b, 0);
    const totalTransf = Object.values(sumTransfByCol).reduce((a, b) => a + b, 0);
    const grandElectronicTotal = totalYapes + totalTransf;

    return {
      yapeStaff,
      transfStaff,
      matrixRows,
      sumYapesByCol,
      sumTransfByCol,
      totalYapes,
      totalTransf,
      grandElectronicTotal,
    };
  }, [consolidatedRows]);

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

  // Helper component to render Main Report Table + Side Electronic Matrix (Used in Caja, Taller and Consolidado)
  const renderMainReportAndMatrix = (showConceptBreakdown: boolean) => (
    <div className="space-y-4">
      {/* Category Breakdown 3-Card Summary Banner (Only when showConceptBreakdown is true) */}
      {showConceptBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Servicios */}
          <div className="p-3 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-teal-300 tracking-wider block">
                  Venta en Servicios
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  Mano de obra, calibraciones ({categoryBreakdown.servCount})
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-black text-white block">
                S/ {formatPEN(categoryBreakdown.servTotal)}
              </span>
              <span className="text-[10px] font-bold text-teal-400">
                {categoryBreakdown.servPercent.toFixed(1)}% del total
              </span>
            </div>
          </div>

          {/* 2. Repuestos */}
          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider block">
                  Venta en Repuestos
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  Bujías, bobinas, filtros, cables ({categoryBreakdown.repCount})
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-black text-white block">
                S/ {formatPEN(categoryBreakdown.repTotal)}
              </span>
              <span className="text-[10px] font-bold text-emerald-400">
                {categoryBreakdown.repPercent.toFixed(1)}% del total
              </span>
            </div>
          </div>

          {/* 3. Certificaciones */}
          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider block">
                  Venta en Certificaciones
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  Anual GNV/GLP, Quinquenal, Chip ({categoryBreakdown.certCount})
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-black text-white block">
                S/ {formatPEN(categoryBreakdown.certTotal)}
              </span>
              <span className="text-[10px] font-bold text-purple-400">
                {categoryBreakdown.certPercent.toFixed(1)}% del total
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Main Cash & Workshop Table (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-2">
          <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
            
            {/* Table Title Header Bar in Vibrant Gold */}
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
                    <tr
                      key={r.id + idx}
                      className="hover:bg-white/5 transition-colors text-white"
                    >
                      <td className="py-2 px-2 text-center text-gray-400 font-bold border-r border-white/5">
                        {r.itemNumber}
                      </td>
                      <td className="py-2 px-2 text-right font-black text-amber-300 border-r border-white/5">
                        {formatPEN(r.total)}
                      </td>
                      <td className="py-2 px-2 text-center font-black text-cyan-300 bg-cyan-950/20 border-r border-white/5">
                        {r.plate}
                      </td>
                      <td className="py-2 px-3 text-gray-200 font-sans text-xs border-r border-white/5 truncate max-w-xs" title={r.description}>
                        {r.description}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-rose-400 bg-rose-950/10 border-r border-white/5">
                        {r.isPending ? formatPEN(r.total) : "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-400 bg-emerald-950/10 border-r border-white/5">
                        {r.efectivo > 0 ? formatPEN(r.efectivo) : "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-purple-400 bg-purple-950/10 border-r border-white/5">
                        {r.yape > 0 ? formatPEN(r.yape) : "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-blue-400 bg-blue-950/10 border-r border-white/5">
                        {r.transferencia > 0 ? formatPEN(r.transferencia) : "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-amber-400 bg-amber-950/10 border-r border-white/5">
                        {r.culqi > 0 ? formatPEN(r.culqi) : "-"}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-gray-300 bg-white/[0.02] text-[10px]">
                        {r.responsable}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                {/* Summary Bar 1: COBRADO */}
                <tr className="bg-black text-xs font-black border-t-2 border-amber-500/40">
                  <td className="py-2 px-2 text-emerald-400 font-extrabold uppercase border-r border-white/10" colSpan={3}>
                    COBRADO
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-emerald-400 border-r border-white/10">
                    S/ {formatPEN(totals.totalLiquidacion)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-rose-400 bg-rose-950/40 border-r border-white/10">
                    S/ {formatPEN(totals.totalPendiente)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-emerald-400 bg-emerald-950/40 border-r border-white/10">
                    S/ {formatPEN(totals.cobradoEfectivo)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-purple-400 bg-purple-950/40 border-r border-white/10">
                    S/ {formatPEN(totals.cobradoYapes)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-blue-400 bg-blue-950/40 border-r border-white/10">
                    S/ {formatPEN(totals.cobradoTransferencias)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-amber-400 bg-amber-950/40 border-r border-white/10">
                    S/ {formatPEN(totals.cobradoCulqi)}
                  </td>
                  <td className="py-2 px-2 bg-black"></td>
                </tr>

                {/* Summary Bar 2: TOTAL GENERAL (4,325.00) */}
                <tr className="bg-[#f59e0b] text-black font-black text-sm">
                  <td className="py-3 px-4 font-black uppercase tracking-wider" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-base" colSpan={7}>
                    S/ {formatPEN(totals.totalFacturado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Side Table: YAPES & TRANSFERENCIAS POR DESTINO (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-purple-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
            
            {/* Header with dual tabs Yape / Transferencia */}
            <div className="bg-[#a21caf] text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                <span>YAPES POR DESTINO</span>
              </div>
              <span className="bg-[#2563eb] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                TRANSFERENCIA
              </span>
            </div>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {/* Master Group Headers */}
                <tr className="border-b border-purple-300 font-black text-[10px] text-center">
                  <th className="bg-[#e9d5ff] text-black py-1 px-1 border-r border-purple-300 w-8">N°</th>
                  <th
                    colSpan={electronicMatrix.yapeStaff.length}
                    className="bg-[#c026d3] text-white py-1 uppercase tracking-wider border-r border-purple-300"
                  >
                    YAPES
                  </th>
                  <th
                    colSpan={electronicMatrix.transfStaff.length}
                    className="bg-[#2563eb] text-white py-1 uppercase tracking-wider"
                  >
                    TRANSFERENCIA
                  </th>
                </tr>

                {/* Sub-column Staff Headers */}
                <tr className="bg-[#e9d5ff] text-black font-extrabold uppercase text-[10px] border-b border-purple-300">
                  <th className="py-1 px-1 text-center border-r border-purple-300"></th>
                  {electronicMatrix.yapeStaff.map((col) => (
                    <th
                      key={"y_" + col}
                      className={`py-1.5 px-1 text-center font-black border-r border-purple-300 ${
                        col === "EMPRESA" ? "bg-[#dcfce7] text-emerald-950" : ""
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                  {electronicMatrix.transfStaff.map((col) => (
                    <th
                      key={"t_" + col}
                      className="py-1.5 px-1 text-center font-black border-r border-purple-300 bg-[#dbeafe] text-blue-950"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {electronicMatrix.matrixRows.map((row) => (
                  <tr key={row.rowIdx} className="hover:bg-white/5 text-white">
                    <td className="py-1 px-1 text-center text-gray-500 font-bold border-r border-white/5 text-[10px]">
                      {row.rowIdx}
                    </td>
                    {/* Yape Columns */}
                    {electronicMatrix.yapeStaff.map((col) => {
                      const val = row.yapeValues[col] || 0;
                      return (
                        <td
                          key={"y_val_" + col}
                          className={`py-1 px-1 text-right border-r border-white/5 ${
                            val > 0 ? "font-bold text-purple-300 bg-purple-950/20" : "text-gray-700"
                          }`}
                        >
                          {val > 0 ? formatPEN(val) : "-"}
                        </td>
                      );
                    })}
                    {/* Transfer Columns */}
                    {electronicMatrix.transfStaff.map((col) => {
                      const val = row.transfValues[col] || 0;
                      return (
                        <td
                          key={"t_val_" + col}
                          className={`py-1 px-1 text-right border-r border-white/5 ${
                            val > 0 ? "font-bold text-blue-300 bg-blue-950/20" : "text-gray-700"
                          }`}
                        >
                          {val > 0 ? formatPEN(val) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Row Sums per individual column */}
                <tr className="bg-black text-[11px] font-black border-t-2 border-purple-500/40">
                  <td className="py-2 px-1 text-center text-purple-400 font-black border-r border-white/10">
                    Σ
                  </td>
                  {electronicMatrix.yapeStaff.map((col) => {
                    const sum = electronicMatrix.sumYapesByCol[col] || 0;
                    return (
                      <td
                        key={"y_sum_" + col}
                        className="py-2 px-1 text-right font-mono font-black text-purple-300 border-r border-white/10"
                      >
                        S/ {formatPEN(sum)}
                      </td>
                    );
                  })}
                  {electronicMatrix.transfStaff.map((col) => {
                    const sum = electronicMatrix.sumTransfByCol[col] || 0;
                    return (
                      <td
                        key={"t_sum_" + col}
                        className="py-2 px-1 text-right font-mono font-black text-blue-300 border-r border-white/10"
                      >
                        S/ {formatPEN(sum)}
                      </td>
                    );
                  })}
                </tr>

                {/* Row Total Combined (1,565.00) */}
                <tr className="bg-[#f59e0b] text-black font-black text-xs">
                  <td className="py-2 px-2 font-black uppercase tracking-wider" colSpan={electronicMatrix.yapeStaff.length + 1}>
                    TOTAL YAPES + TRANSF.
                  </td>
                  <td
                    className="py-2 px-2 text-right font-mono font-black text-sm"
                    colSpan={electronicMatrix.transfStaff.length}
                  >
                    S/ {formatPEN(electronicMatrix.grandElectronicTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Concept Breakdown Table: SERVICIOS vs REPUESTOS vs CERTIFICACIONES (Only in Caja tab) */}
          {showConceptBreakdown && (
            <div className="overflow-x-auto rounded-2xl border border-teal-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
              <div className="bg-gradient-to-r from-teal-700 to-cyan-800 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-300" />
                  <span>VENTAS POR CONCEPTO</span>
                </div>
                <span className="bg-black/30 text-teal-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  S/ {formatPEN(categoryBreakdown.grandTotal)}
                </span>
              </div>

              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-[#ccfbf1] text-teal-950 font-extrabold uppercase text-[10px] border-b border-teal-300">
                    <th className="py-1.5 px-2.5">CONCEPTO</th>
                    <th className="py-1.5 px-2 text-center">ATENCIONES</th>
                    <th className="py-1.5 px-2 text-right">TOTAL (S/)</th>
                    <th className="py-1.5 px-2 text-right">% DEL TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[11px]">
                  {/* 1. Servicios */}
                  <tr className="hover:bg-white/5 text-white">
                    <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-teal-300">
                      <span>🔧</span>
                      <span>Servicios & Mano de Obra</span>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-300 font-bold">
                      {categoryBreakdown.servCount}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-teal-300">
                      S/ {formatPEN(categoryBreakdown.servTotal)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-bold text-[10px]">
                      {categoryBreakdown.servPercent.toFixed(1)}%
                    </td>
                  </tr>

                  {/* 2. Repuestos */}
                  <tr className="hover:bg-white/5 text-white">
                    <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-emerald-300">
                      <span>📦</span>
                      <span>Repuestos & Autopartes</span>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-300 font-bold">
                      {categoryBreakdown.repCount}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-emerald-300">
                      S/ {formatPEN(categoryBreakdown.repTotal)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-bold text-[10px]">
                      {categoryBreakdown.repPercent.toFixed(1)}%
                    </td>
                  </tr>

                  {/* 3. Certificaciones */}
                  <tr className="hover:bg-white/5 text-white">
                    <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-purple-300">
                      <span>📜</span>
                      <span>Certificaciones GNV / GLP</span>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-300 font-bold">
                      {categoryBreakdown.certCount}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-purple-300">
                      S/ {formatPEN(categoryBreakdown.certTotal)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-bold text-[10px]">
                      {categoryBreakdown.certPercent.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-[#f59e0b] text-black font-black text-xs">
                    <td className="py-2 px-2.5 font-black uppercase tracking-wider" colSpan={2}>
                      TOTAL GENERAL
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-black text-sm">
                      S/ {formatPEN(categoryBreakdown.grandTotal)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-[10px]">
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );

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

      {/* ========================================================================= */}
      {/* 6 TOP FINANCIAL KPI CARDS: ONLY SHOWN FOR CAJA (AS REQUESTED) */}
      {/* ========================================================================= */}
      {selectedReportType === "caja" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Efectivo */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span>Efectivo en Caja</span>
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
              S/ {formatPEN(totals.cobradoEfectivo)}
            </span>
          </div>

          {/* Card 2: Yapes */}
          <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
              <Coins className="w-3 h-3" />
              <span>Yapes Recaudados</span>
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
              S/ {formatPEN(totals.cobradoYapes)}
            </span>
          </div>

          {/* Card 3: Transferencias */}
          <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1">
              <Building className="w-3 h-3" />
              <span>Transferencias</span>
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
              S/ {formatPEN(totals.cobradoTransferencias)}
            </span>
          </div>

          {/* Card 4: Culqi */}
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              <span>Culqi / Tarjeta</span>
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
              S/ {formatPEN(totals.cobradoCulqi)}
            </span>
          </div>

          {/* Card 5: Pendiente */}
          <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Pendiente / Crédito</span>
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-rose-300 mt-1">
              S/ {formatPEN(totals.totalPendiente)}
            </span>
          </div>

          {/* Card 6: Total Liquidación */}
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
      )}

      {/* ========================================================================= */}
      {/* REPORT CONTENT VIEW BASED ON SELECTED TAB */}
      {/* ========================================================================= */}

      {/* 1. CAJA & LIQUIDACIÓN DIARIA */}
      {(selectedReportType === "caja" || selectedReportType === "consolidado") && (
        <div>
          {renderMainReportAndMatrix(true)}
        </div>
      )}

      {/* 2. TALLER & PRODUCTIVIDAD DE TÉCNICOS */}
      {(selectedReportType === "taller" || selectedReportType === "consolidado") && (
        <div className="space-y-6">
          {/* Main Table without concept breakdown banner/table */}
          {selectedReportType === "taller" && renderMainReportAndMatrix(false)}

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
                    {techPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400 italic">
                          Sin actividad registrada en taller para este día.
                        </td>
                      </tr>
                    ) : (
                      techPerformance.map((tp) => (
                        <tr key={tp.name} className="hover:bg-white/5">
                          <td className="py-2 px-2 font-sans font-bold text-white">{tp.name}</td>
                          <td className="py-2 px-2 text-center font-bold text-indigo-300">{tp.count}</td>
                          <td className="py-2 px-2 text-center font-bold text-emerald-400">{tp.completed}</td>
                          <td className="py-2 px-2 text-right font-black text-amber-300">S/ {formatPEN(tp.totalSales)}</td>
                        </tr>
                      ))
                    )}
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
                    {dayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                          No se abrieron órdenes de trabajo para la fecha seleccionada.
                        </td>
                      </tr>
                    ) : (
                      dayOrders.map((wo) => {
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
          Al corte del día <strong>{formatPeruDate(selectedDate)}</strong>, el Taller ReyGas registró un total de <strong>{consolidatedRows.length} atenciones</strong> con una facturación general de <strong>S/ {formatPEN(totals.totalFacturado)}</strong> y una liquidación neta recaudada en caja de <strong>S/ {formatPEN(totals.totalLiquidacion)}</strong>. El inventario total en almacén asciende a <strong>{formatQty(totalStockUnits)} unidades</strong> valorizadas en <strong>S/ {formatPEN(totalStockValuation)}</strong>.
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
