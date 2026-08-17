"use client";

import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import { useAppStore, WorkOrder } from "@/lib/store/app-store";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import { getWorkshopDayRecords, getWorkshopCSVRecord, WorkshopCSVRecord } from "@/lib/workshop-csv-lookup";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import {
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
  Wrench,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building,
  UserCheck,
  Package,
  Layers,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  Coins,
  CheckCircle2,
  Award,
  ShieldAlert,
  Clock,
  Car,
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

export type ReportTabType =
  | "caja"
  | "taller"
  | "servicios"
  | "almacen"
  | "certificaciones"
  | "porteria"
  | "asistencia"
  | "resumen";

export interface WorkshopDailyReportViewProps {
  isModal?: boolean;
  onClose?: () => void;
  initialTab?: ReportTabType;
}

export function WorkshopDailyReportView({
  isModal = false,
  onClose,
  initialTab = "caja",
}: WorkshopDailyReportViewProps) {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    workshopServices,
    inventoryItems,
    currentUser,
  } = useAppStore();

  const [selectedDate, setSelectedDate] = useState<string>(getPeruDateString());
  const [activeTab, setActiveTab] = useState<ReportTabType>(initialTab);

  // Sync activeTab when component mounts or initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [responsibleName, setResponsibleName] = useState<string>(
    currentUser?.name || "Jefe de Taller / Caja"
  );
  const [managerName, setManagerName] = useState<string>("Gerencia General");
  const [observations, setObservations] = useState<string>(
    "Todas las órdenes y cobros del día han sido auditados contra las órdenes de trabajo e historial de patio. Los montos de Yape y Transferencias coinciden con los destinos autorizados."
  );

  // Navigate date
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(getPeruDateString(d));
  };

  const isToday = selectedDate === getPeruDateString();

  // Fast lookups
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

  // Authorized staff for payment destination columns
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
    if (isPending || totalAmount <= 0) {
      return { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };
    }

    const result = { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };
    const methodUpper = (methodRaw || "EFECTIVO").toUpperCase().trim();

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
    } else if (
      methodUpper.includes("TRANSFER") ||
      methodUpper.includes("BANCO") ||
      methodUpper.includes("BCP") ||
      methodUpper.includes("BBVA")
    ) {
      result.transferencia = totalAmount;
    } else if (
      methodUpper.includes("TARJETA") ||
      methodUpper.includes("CULQI") ||
      methodUpper.includes("CULQUI") ||
      methodUpper.includes("POS") ||
      methodUpper.includes("CARD")
    ) {
      result.culqi = totalAmount;
    } else {
      result.efectivo = totalAmount;
    }

    return result;
  };

  // Day's work orders in Supabase
  const dayOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const dateStr = (wo.entry_time || (wo as any).created_at || "").slice(0, 10);
      return dateStr === selectedDate;
    });
  }, [workOrders, selectedDate]);

  // Day's standalone invoices in Supabase
  const dayInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const dateStr = (inv.issued_at || "").slice(0, 10);
      return dateStr === selectedDate;
    });
  }, [invoices, selectedDate]);

  // Consolidated Rows for the Day's Table
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

    // 1. First Priority: Load exact day records from workshop CSV lookup (e.g. 14/08/2026, 15/08/2026, etc.)
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

    // 2. Map in-app Work Orders for this day (adds any new order created dynamically that isn't in CSV)
    dayOrders.forEach((wo) => {
      const plateKey = (wo.vehicle_plate || "").toUpperCase().trim();
      if (csvDayRecords.length > 0 && processedKeys.has(plateKey)) return;

      processedOrderIds.add(wo.id);
      const inv = invoicesByWorkOrderId.get(wo.id);
      const csvRec = getWorkshopCSVRecord(wo.vehicle_plate, wo.entry_time);

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

    // 3. Map Direct Invoices not linked to day's work orders
    dayInvoices.forEach((inv) => {
      if (inv.work_order_id && processedOrderIds.has(inv.work_order_id)) return;
      const plateKey = (inv.vehicle_plate || "").toUpperCase().trim();
      if (csvDayRecords.length > 0 && processedKeys.has(plateKey)) return;

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
        plate: (inv.vehicle_plate || "VENTA DIRECTA").toUpperCase(),
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
  }, [selectedDate, dayOrders, dayInvoices, invoicesByWorkOrderId, authorizedStaff, technicians]);

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

    const maxRows = Math.max(17, yapeRows.length, transfRows.length);
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

  // Technician Productivity Metrics
  const techPerformance = useMemo(() => {
    const map = new Map<string, { name: string; count: number; completed: number; totalSales: number }>();
    technicians.forEach((t) => {
      map.set(t.full_name, { name: t.full_name, count: 0, completed: 0, totalSales: 0 });
    });

    consolidatedRows.forEach((r) => {
      const techName = r.responsable || "TALLER";
      const existing = map.get(techName) || { name: techName, count: 0, completed: 0, totalSales: 0 };
      existing.count += 1;
      if (!r.isPending) existing.completed += 1;
      existing.totalSales += r.total;
      map.set(techName, existing);
    });

    return Array.from(map.values()).filter((tp) => tp.count > 0 || technicians.some((t) => t.full_name === tp.name && t.is_active));
  }, [technicians, consolidatedRows]);

  // Workshop Services and Parts Breakdown
  const itemsBreakdown = useMemo(() => {
    const map = new Map<string, { desc: string; type: "servicio" | "repuesto"; count: number; total: number }>();

    consolidatedRows.forEach((r) => {
      const key = r.description.trim().toUpperCase();
      const isServ = key.includes("MANT") || key.includes("SERVICIO") || key.includes("CALIBRA") || key.includes("ANUAL") || key.includes("PRUEBA") || key.includes("REVISION");
      const existing = map.get(key) || { desc: r.description, type: isServ ? "servicio" : "repuesto", count: 0, total: 0 };
      existing.count += 1;
      existing.total += r.total;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [consolidatedRows]);

  // Warehouse Inventory Metrics
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

  // Executive narrative summary
  const executiveSummary = useMemo(() => {
    const totalVehicles = consolidatedRows.length;
    const completed = consolidatedRows.filter((r) => !r.isPending).length;
    const inProgress = consolidatedRows.filter((r) => r.isPending).length;
    const pendingPay = totals.totalPendiente;

    return `Durante la jornada del ${formatPeruDate(selectedDate)}, el Taller ReyGas registró un movimiento total de ${totalVehicles} atenciones (${completed} pagadas/completadas, ${inProgress} pendientes/crédito). La facturación total ascendió a S/ ${formatPEN(totals.totalFacturado)}, lográndose una recaudación efectiva en caja de S/ ${formatPEN(totals.totalLiquidacion)} (Efectivo: S/ ${formatPEN(totals.cobradoEfectivo)}, Yapes: S/ ${formatPEN(totals.cobradoYapes)}, Transferencias: S/ ${formatPEN(totals.cobradoTransferencias)}, Tarjeta: S/ ${formatPEN(totals.cobradoCulqi)}). Se mantienen S/ ${formatPEN(pendingPay)} en cuentas pendientes de cobro o crédito.`;
  }, [consolidatedRows, totals, selectedDate]);

  // Helper component to render Main Report Table + Side Electronic Matrix
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
              <span className="text-base font-black">REPORTE DEL DÍA {formatPeruDate(selectedDate)}</span>
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
                <span>YAPES</span>
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

                {/* 1. Row Total Combined (1,565.00) */}
                <tr className="bg-[#f59e0b] text-black font-black text-xs border-t border-amber-600">
                  <td className="py-1.5 px-2 font-black uppercase tracking-wider text-[11px]" colSpan={electronicMatrix.yapeStaff.length + 1}>
                    TOTAL YAPES + TRANSF.
                  </td>
                  <td
                    className="py-1.5 px-2 text-right font-mono font-black text-xs"
                    colSpan={electronicMatrix.transfStaff.length}
                  >
                    S/ {formatPEN(electronicMatrix.grandElectronicTotal)}
                  </td>
                </tr>

                {/* 2. Row Total Efectivo */}
                <tr className="bg-emerald-950/70 text-emerald-300 font-extrabold text-xs border-t border-emerald-500/20">
                  <td className="py-1.5 px-2 font-extrabold uppercase tracking-wider text-[11px]" colSpan={electronicMatrix.yapeStaff.length + 1}>
                    💵 TOTAL EFECTIVO
                  </td>
                  <td
                    className="py-1.5 px-2 text-right font-mono font-black text-xs text-emerald-300"
                    colSpan={electronicMatrix.transfStaff.length}
                  >
                    S/ {formatPEN(totals.cobradoEfectivo)}
                  </td>
                </tr>

                {/* 3. Row Total Pendiente */}
                <tr className="bg-rose-950/70 text-rose-300 font-extrabold text-xs border-t border-rose-500/20">
                  <td className="py-1.5 px-2 font-extrabold uppercase tracking-wider text-[11px]" colSpan={electronicMatrix.yapeStaff.length + 1}>
                    ⏳ TOTAL PENDIENTE
                  </td>
                  <td
                    className="py-1.5 px-2 text-right font-mono font-black text-xs text-rose-300"
                    colSpan={electronicMatrix.transfStaff.length}
                  >
                    S/ {formatPEN(totals.totalPendiente)}
                  </td>
                </tr>

                {/* 4. Row Total Culqi / Tarjeta */}
                <tr className="bg-amber-950/70 text-amber-300 font-extrabold text-xs border-t border-amber-500/20">
                  <td className="py-1.5 px-2 font-extrabold uppercase tracking-wider text-[11px]" colSpan={electronicMatrix.yapeStaff.length + 1}>
                    💳 TOTAL CULQI / TARJETA
                  </td>
                  <td
                    className="py-1.5 px-2 text-right font-mono font-black text-xs text-amber-300"
                    colSpan={electronicMatrix.transfStaff.length}
                  >
                    S/ {formatPEN(totals.cobradoCulqi)}
                  </td>
                </tr>

                {/* 5. Row Total Validación Cuadre General del Día */}
                {(() => {
                  const grandCuadre = electronicMatrix.grandElectronicTotal + totals.cobradoEfectivo + totals.totalPendiente + totals.cobradoCulqi;
                  const isCuadrado = Math.abs(grandCuadre - totals.totalFacturado) < 0.05;

                  return (
                    <tr
                      className={`text-xs font-black border-t-2 ${
                        isCuadrado
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400"
                          : "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400"
                      }`}
                    >
                      <td
                        className="py-2 px-2 font-black uppercase tracking-wider text-[11px]"
                        colSpan={electronicMatrix.yapeStaff.length + 1}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>TOTAL GENERAL DEL DÍA</span>
                          {isCuadrado ? (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-200 border border-emerald-300 text-[10px] font-black flex items-center gap-1 shadow">
                              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                              <span>CUADRADO ✔</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-rose-200 border border-rose-300 text-[10px] font-black flex items-center gap-1 shadow">
                              <AlertTriangle className="w-3 h-3 text-rose-300" />
                              <span>VERIFICAR ⚠</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-2 px-2 text-right font-mono font-black text-sm text-white"
                        colSpan={electronicMatrix.transfStaff.length}
                      >
                        S/ {formatPEN(grandCuadre)}
                      </td>
                    </tr>
                  );
                })()}
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

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    let csv = `REPORTE DE TALLER & CAJA - REYGAS AUTOGAS EQUIPMENT\n`;
    csv += `Fecha: ${selectedDate}\n\n`;
    csv += `ITEM,PLACA,SERVICIO / REPUESTO,TOTAL,PENDIENTE,EFECTIVO,YAPE,TRANSFERENCIA,CULQI,RESPONSABLE\n`;

    consolidatedRows.forEach((r) => {
      csv += `"${r.itemNumber}","${r.plate}","${r.description.replace(/"/g, '""')}","${r.total.toFixed(2)}","${r.isPending ? r.total.toFixed(2) : "0.00"}","${r.efectivo.toFixed(2)}","${r.yape.toFixed(2)}","${r.transferencia.toFixed(2)}","${r.culqi.toFixed(2)}","${r.responsable}"\n`;
    });

    csv += `\nTOTALES,,,${totals.totalFacturado.toFixed(2)},${totals.totalPendiente.toFixed(2)},${totals.cobradoEfectivo.toFixed(2)},${totals.cobradoYapes.toFixed(2)},${totals.cobradoTransferencias.toFixed(2)},${totals.cobradoCulqi.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Taller_Caja_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Report Navigation Config
  const reportTabs = [
    { id: "caja", label: "1. Arqueo & Liquidación de Caja", icon: Coins, color: "text-amber-400" },
    { id: "taller", label: "2. Productividad & Órdenes de Taller", icon: Wrench, color: "text-indigo-400" },
    { id: "servicios", label: "3. Servicios & Repuestos Despachados", icon: Layers, color: "text-emerald-400" },
    { id: "almacen", label: "4. Almacén & Valorización", icon: Package, color: "text-cyan-400" },
    { id: "certificaciones", label: "5. Certificaciones GNV/GLP", icon: Award, color: "text-purple-400" },
    { id: "porteria", label: "6. Portería & Patio", icon: ShieldAlert, color: "text-rose-400" },
    { id: "asistencia", label: "7. Asistencia de Personal", icon: Clock, color: "text-teal-400" },
    { id: "resumen", label: "8. Resumen Ejecutivo & Firmas", icon: Sparkles, color: "text-amber-300" },
  ];

  return (
    <div className={`w-full ${isModal ? "flex flex-col h-full max-h-[92vh] overflow-hidden" : "glass-panel rounded-3xl border border-white/15 p-6 shadow-2xl space-y-6"}`}>
      {/* Top Header Bar */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isModal ? "p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-reygas-dark via-reygas-navy to-black/60 shrink-0" : "border-b border-white/10 pb-4"} print:hidden`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {isModal ? "Informe Diario de Taller & Caja a Gerencia" : "Centro de Reportes del Taller & Gerencia"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {formatPeruDate(selectedDate)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Arqueo consolidado de ingresos, productividad de técnicos, servicios, inventario y órdenes de trabajo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Standard Date Navigator */}
          <div className="flex items-center bg-black/60 rounded-xl border border-white/15 p-1 shrink-0">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => changeDate(1)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(getPeruDateString())}
                className="px-2 py-1 ml-1 text-[11px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-md transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel / CSV</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          {/* Close Button (Only in Modal Mode) */}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NAVIGATION TABS (SCREEN ONLY) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-black/40 border-b border-white/5 overflow-x-auto print:hidden rounded-2xl shrink-0">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-lg shadow-amber-500/20 scale-[1.02]"
                  : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* BODY CONTENT (SCROLLABLE ON SCREEN, CLEAN ON PRINT) */}
      {/* ========================================================================= */}
      <div className={`p-4 sm:p-6 space-y-6 print:p-0 ${isModal ? "overflow-y-auto flex-1 custom-scrollbar min-h-0" : ""}`}>
        
        {/* Printable Header (Visible Only When Printing) */}
        <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-black uppercase tracking-tight">
                ReyGas Autogas Equipment
              </h1>
              <p className="text-sm text-gray-700 font-bold">
                Informe Diario de Operaciones, Taller & Caja a Gerencia General
              </p>
              <p className="text-xs text-gray-600">
                Taller Especializado GNV / GLP • RUC 20608534431 • Av. Separadora Industrial
              </p>
            </div>
            <div className="text-right border-2 border-black p-2 rounded">
              <span className="text-xs font-bold block">FECHA DEL INFORME</span>
              <span className="text-lg font-mono font-black">{formatPeruDate(selectedDate)}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP KPI CARDS MATRIX: ONLY SHOWN FOR CAJA (AS REQUESTED) */}
        {/* ========================================================================= */}
        {activeTab === "caja" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: Efectivo */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>Total Efectivo</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                S/ {formatPEN(totals.cobradoEfectivo)}
              </span>
            </div>

            {/* Card 2: Yapes */}
            <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
                <Coins className="w-3 h-3" />
                <span>Total Yapes</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                S/ {formatPEN(totals.cobradoYapes)}
              </span>
            </div>

            {/* Card 3: Transferencias */}
            <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span>Total Transferencias</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                S/ {formatPEN(totals.cobradoTransferencias)}
              </span>
            </div>

            {/* Card 4: Culqi / Tarjeta */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                <span>Total Culqi / Tarjeta</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                S/ {formatPEN(totals.cobradoCulqi)}
              </span>
            </div>

            {/* Card 5: Pendiente / Crédito */}
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Total Pendiente / Crédito</span>
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
        {/* TAB 1: CAJA & LIQUIDACIÓN DIARIA (CON DESGLOSE DE CONCEPTOS) */}
        {/* ========================================================================= */}
        {activeTab === "caja" && renderMainReportAndMatrix(true)}

        {/* ========================================================================= */}
        {/* TAB 2: PRODUCTIVIDAD & ÓRDENES DE TRABAJO EN TALLER (SIN DESGLOSE DE CONCEPTOS) */}
        {/* ========================================================================= */}
        {activeTab === "taller" && (
          <div className="space-y-6">
            {/* Main Report Table + Side Electronic Matrix without concept breakdown */}
            {renderMainReportAndMatrix(false)}

            {/* Technician Production & Work Orders in Patio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Technician Production Summary (5 cols on lg) */}
              <div className="lg:col-span-5 glass-panel p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span>Rendimiento por Técnico / Mecánico</span>
                  </h3>
                  <span className="text-[10px] font-mono text-gray-400 font-bold">
                    {techPerformance.length} TÉCNICOS
                  </span>
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
                            <td className="py-2 px-2 font-sans font-bold text-white">
                              {tp.name}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-indigo-300">
                              {tp.count}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-400">
                              {tp.completed}
                            </td>
                            <td className="py-2 px-2 text-right font-black text-amber-300">
                              S/ {formatPEN(tp.totalSales)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Work Orders Detailed Activity (7 cols on lg) */}
              <div className="lg:col-span-7 glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Car className="w-4 h-4 text-cyan-400" />
                    <span>Órdenes de Trabajo del Día en Patio ({dayOrders.length} Vehículos)</span>
                  </h3>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10">
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
                          const desc = wo.items && wo.items.length > 0
                            ? wo.items.map((i) => i.description).join(", ")
                            : (wo as any).general_maintenance_service || "Mantenimiento General";

                          return (
                            <tr key={wo.id} className="hover:bg-white/5">
                              <td className="py-2 px-2 font-black text-cyan-300">
                                {wo.vehicle_plate}
                              </td>
                              <td className="py-2 px-2 font-sans text-gray-200">
                                {((wo.assigned_technician_id ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name : (wo as any).technician_name) || "Sin Asignar").split(" ")[0]}
                              </td>
                              <td className="py-2 px-2 font-sans text-gray-300 truncate max-w-xs" title={desc}>
                                {desc}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    wo.status === "finalizado" || wo.status === "pagado_autorizado"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {wo.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-amber-300">
                                S/ {formatPEN((wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0)}
                              </td>
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

        {/* ========================================================================= */}
        {/* TAB 3: SERVICIOS & REPUESTOS DESPACHADOS */}
        {/* ========================================================================= */}
        {activeTab === "servicios" && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Desglose de Servicios Realizados y Repuestos Utilizados</span>
              </h3>
              <span className="text-[11px] font-mono text-gray-400">
                {itemsBreakdown.length} CONCEPTOS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-300 text-[11px] font-extrabold uppercase border-b border-white/10">
                    <th className="py-2 px-3">Concepto / Servicio / Repuesto</th>
                    <th className="py-2 px-2 text-center">Tipo</th>
                    <th className="py-2 px-2 text-center">Cantidad</th>
                    <th className="py-2 px-3 text-right">Subtotal Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {itemsBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400 italic">
                        Sin ítems ni servicios registrados en esta fecha.
                      </td>
                    </tr>
                  ) : (
                    itemsBreakdown.map((it, idx) => (
                      <tr key={it.desc + idx} className="hover:bg-white/5">
                        <td className="py-2 px-3 font-sans font-bold text-white">
                          {it.desc}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              it.type === "servicio"
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {it.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-cyan-300">
                          {formatQty(it.count)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-amber-300">
                          S/ {formatPEN(it.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ALMACÉN & VALORIZACIÓN DE INVENTARIO */}
        {/* ========================================================================= */}
        {activeTab === "almacen" && (
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
                  <span>Repuestos con Stock Crítico o por Agotarse (Semáforo)</span>
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

        {/* ========================================================================= */}
        {/* TAB 5: CERTIFICACIONES GNV / GLP */}
        {/* ========================================================================= */}
        {activeTab === "certificaciones" && (
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

        {/* ========================================================================= */}
        {/* TAB 6: PORTERÍA, PATIO & ESTADÍA VEHICULAR */}
        {/* ========================================================================= */}
        {activeTab === "porteria" && (
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

        {/* ========================================================================= */}
        {/* TAB 7: ASISTENCIA BIOMÉTRICA & PERSONAL */}
        {/* ========================================================================= */}
        {activeTab === "asistencia" && (
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
        {/* TAB 8: EXECUTIVE SUMMARY NARRATIVE & SIGNATURES (IN RESUMEN TAB) */}
        {/* ========================================================================= */}
        {activeTab === "resumen" && (
          <div className="space-y-6">
            {renderMainReportAndMatrix(true)}

            <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-black/40 to-indigo-500/10 border border-amber-500/30 space-y-4 print:border-black print:rounded-none print:bg-none print:p-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase tracking-wide">
                  <Sparkles className="w-5 h-5" />
                  <span>Resumen Ejecutivo para Gerencia General</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">Estado de Operaciones:</span>
                  <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>CONFORME / CUADRADO</span>
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium print:text-black">
                {executiveSummary}
              </p>

              {/* Editable Observations Field */}
              <div className="space-y-1 pt-2 border-t border-white/10 print:border-black">
                <label className="text-[11px] font-bold uppercase text-gray-400 block print:text-black">
                  Observaciones y Novedades del Taller (Antes de Imprimir):
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors print:bg-white print:border-black print:text-black"
                  placeholder="Escriba incidencias, novedades de técnicos o justificaciones..."
                />
              </div>

              {/* Official Signatures Block */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-white/10 print:border-black">
                <div className="text-center space-y-1">
                  <div className="border-b border-gray-500 w-3/4 mx-auto pb-8 print:border-black"></div>
                  <input
                    type="text"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    className="bg-transparent text-center text-xs font-bold text-white w-full focus:outline-none print:text-black"
                    placeholder="Nombre del Responsable"
                  />
                  <span className="text-[10px] text-gray-400 block uppercase print:text-black">
                    Responsable de Taller & Caja
                  </span>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-b border-gray-500 w-3/4 mx-auto pb-8 print:border-black"></div>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="bg-transparent text-center text-xs font-bold text-white w-full focus:outline-none print:text-black"
                    placeholder="Nombre de Gerencia"
                  />
                  <span className="text-[10px] text-gray-400 block uppercase print:text-black">
                    Gerencia General / Auditoría ReyGas
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export interface DailyWorkshopReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ReportTabType;
}

export function DailyWorkshopReportModal({
  isOpen,
  onClose,
  initialTab = "caja",
}: DailyWorkshopReportModalProps) {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-7xl bg-reygas-navy border border-white/15 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col h-[92vh] max-h-[92vh] print:h-auto print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        <WorkshopDailyReportView
          isModal={true}
          onClose={onClose}
          initialTab={initialTab}
        />
      </div>
    </div>,
    document.body
  );
}
