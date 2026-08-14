"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
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
  Coins
} from "lucide-react";

export default function ReportesCajaPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
  } = useAppStore();

  // Selected date filter (default today)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchFilter, setSearchFilter] = useState("");

  // O(1) Maps for fast joining
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
        map.set(v.plate.toUpperCase(), v);
      }
    }
    return map;
  }, [vehicles]);

  // List of active staff authorized for payment destination
  const authorizedStaff = useMemo(() => {
    const list = technicians.filter((t) => t.is_active && t.can_receive_payment).map((t) => t.full_name.toUpperCase());
    // Ensure default staff from sample sheets if not in store
    const defaults = ["JAIME", "ISABEL", "FRANCO"];
    defaults.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    return list;
  }, [technicians]);

  // Navigate date by +/- 1 day
  const changeDateByDays = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Format date display (e.g. "12/08/2026")
  const formattedDateTitle = useMemo(() => {
    try {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return selectedDate;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Parser for split payments encoded in discounts or method column (e.g., C 70 E 230)
  const parsePaymentBreakdown = (
    methodRaw: string = "",
    discountsRaw: any = "",
    notesRaw: string = "",
    totalAmount: number = 0,
    isPending: boolean = false
  ) => {
    if (isPending) {
      return { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };
    }

    const result = { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };
    const methodUpper = (methodRaw || "EFECTIVO").toUpperCase();

    // Check discount string or diagnostic notes for split codes (e.g. C 70 E 230)
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

      const sum = result.efectivo + result.yape + result.transferencia + result.culqi;
      if (sum > 0) {
        return result;
      }
    }

    // Single payment allocation fallback
    if (methodUpper.includes("YAPE") || methodUpper.includes("PLIN")) {
      result.yape = totalAmount;
    } else if (
      methodUpper.includes("TRANSFERENCIA") ||
      methodUpper.includes("BCP") ||
      methodUpper.includes("BBVA") ||
      methodUpper.includes("BANCO")
    ) {
      result.transferencia = totalAmount;
    } else if (
      methodUpper.includes("CULQI") ||
      methodUpper.includes("QULQUI") ||
      methodUpper.includes("TARJETA") ||
      methodUpper.includes("POS")
    ) {
      result.culqi = totalAmount;
    } else {
      result.efectivo = totalAmount;
    }

    return result;
  };

  // Build daily records for Table 1
  const dailyReportRows = useMemo(() => {
    // Collect all orders or standalone invoices matching selectedDate
    const matchingOrders = workOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      const invDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
      const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";

      return (
        orderDateStr === selectedDate ||
        invDateStr === selectedDate ||
        paidDateStr === selectedDate
      );
    });

    const rows = matchingOrders.map((wo, index) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase());

      const partsTotal = (wo.items || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;

      // Extract service description
      let serviceType = "SERVICIO";
      const hasServices = (wo.items || []).some((i: any) => i.item_type === "servicio" || i.description?.toLowerCase().includes("mantenimiento") || i.description?.toLowerCase().includes("servicio") || i.description?.toLowerCase().includes("anual") || i.description?.toLowerCase().includes("quinquenal"));
      const hasParts = (wo.items || []).some((i: any) => i.item_type === "repuesto" || i.description?.toLowerCase().includes("filtro") || i.description?.toLowerCase().includes("sensor") || i.description?.toLowerCase().includes("bujía") || i.description?.toLowerCase().includes("valvula"));

      if (hasServices && hasParts) serviceType = "SERVICIO+REPUESTOS";
      else if (hasParts && !hasServices) serviceType = "REPUESTO";
      else if (wo.problem_description?.toLowerCase().includes("deuda") || inv?.receipt_type?.toLowerCase().includes("deuda")) serviceType = "CANCELACIÓN DE DEUDA";
      else if (wo.problem_description?.toLowerCase().includes("venta")) serviceType = "VENTA";
      else serviceType = "SERVICIO";

      // Determine price & credit
      let grandTotal = inv?.grand_total !== undefined && inv.grand_total > 0 ? inv.grand_total : partsTotal + certFee;
      if (grandTotal === 0 && (inv?.credit_amount || 0) > 0) {
        grandTotal = inv!.credit_amount!;
      }

      // Check if paid or pending/credit
      const condition = (inv?.payment_condition || "").toUpperCase().trim();
      const hasCredit = (inv?.credit_amount || 0) > 0 || (wo.diagnostic_notes && wo.diagnostic_notes.includes("[CREDITO]:"));
      const isPending =
        inv?.payment_status === "pendiente" ||
        condition === "PENDIENTE" ||
        condition.includes("CREDIT") ||
        hasCredit ||
        wo.status === "por_cobrar" ||
        (wo.status as any) === "pendiente_pago" ||
        (wo.problem_description && /PENDIENTE\s+\d+/i.test(wo.problem_description));

      const isPaid = !isPending && (inv?.payment_status === "pagado" || wo.status === "pagado_autorizado" || wo.status === "finalizado");

      const method = inv?.payment_method || "Efectivo";
      const destination = (inv?.payment_destination || (isPending ? "PENDIENTE" : "EMPRESA")).toUpperCase();

      let pendiente = 0;
      let breakdown = { efectivo: 0, yape: 0, transferencia: 0, culqi: 0 };

      if (isPending) {
        pendiente = grandTotal;
      } else {
        breakdown = parsePaymentBreakdown(
          method,
          inv?.discounts,
          wo.diagnostic_notes || "",
          grandTotal,
          false
        );
      }

      return {
        item: index + 1,
        id: wo.id,
        placa: wo.vehicle_plate || "S/P",
        servicio: serviceType,
        detalleItems: (wo.items || []).map((i: any) => i.description).join(" + ") || wo.problem_description || "Servicio General",
        total: grandTotal,
        pendiente,
        efectivo: breakdown.efectivo,
        yape: breakdown.yape,
        transferencia: breakdown.transferencia,
        culqi: breakdown.culqi,
        responsable: destination,
        isPaid,
        clientName: vehicle?.owner_name || inv?.client_name || "Cliente",
      };
    });

    if (!searchFilter.trim()) return rows;
    const term = searchFilter.trim().toUpperCase();
    return rows.filter((r) => r.placa.includes(term) || r.responsable.includes(term) || r.servicio.includes(term));
  }, [workOrders, invoicesByWorkOrderId, vehiclesByPlate, selectedDate, searchFilter]);

  // Aggregate Totals for Table 1
  const table1Totals = useMemo(() => {
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalEfectivo = 0;
    let totalYape = 0;
    let totalTransferencia = 0;
    let totalCulqi = 0;

    dailyReportRows.forEach((r) => {
      totalPendiente += r.pendiente;
      totalEfectivo += r.efectivo;
      totalYape += r.yape;
      totalTransferencia += r.transferencia;
      totalCulqi += r.culqi;
      totalCobrado += (r.efectivo + r.yape + r.transferencia + r.culqi);
    });

    const totalGeneral = totalCobrado + totalPendiente;

    return {
      totalCobrado,
      totalPendiente,
      totalEfectivo,
      totalYape,
      totalTransferencia,
      totalCulqi,
      totalGeneral,
    };
  }, [dailyReportRows]);

  // Build Yapes & Transfers breakdown for Table 2 (Arqueo por Responsable)
  const table2Breakdown = useMemo(() => {
    // Extract Yape payments and group by responsible
    const yapeRows = dailyReportRows.filter((r) => r.yape > 0);
    const transferRows = dailyReportRows.filter((r) => r.transferencia > 0);

    const maxRows = Math.max(15, yapeRows.length, transferRows.length);

    const rows: Array<{
      index: number;
      byStaff: Record<string, number>;
      empresaYape: number;
      empresaTransfer: number;
    }> = [];

    // Totals per column
    const staffTotals: Record<string, number> = {};
    authorizedStaff.forEach((s) => (staffTotals[s] = 0));
    let empresaYapeTotal = 0;
    let empresaTransferTotal = 0;

    // Distribute yape amounts across rows
    for (let i = 0; i < maxRows; i++) {
      const yapeItem = yapeRows[i];
      const transferItem = transferRows[i];

      const rowStaffAmounts: Record<string, number> = {};
      authorizedStaff.forEach((s) => (rowStaffAmounts[s] = 0));

      let empYape = 0;
      let empTrans = 0;

      if (yapeItem) {
        const dest = yapeItem.responsable;
        const matchedStaff = authorizedStaff.find((s) => dest.includes(s));
        if (matchedStaff) {
          rowStaffAmounts[matchedStaff] = yapeItem.yape;
          staffTotals[matchedStaff] += yapeItem.yape;
        } else {
          empYape = yapeItem.yape;
          empresaYapeTotal += yapeItem.yape;
        }
      }

      if (transferItem) {
        empTrans = transferItem.transferencia;
        empresaTransferTotal += transferItem.transferencia;
      }

      rows.push({
        index: i + 1,
        byStaff: rowStaffAmounts,
        empresaYape: empYape,
        empresaTransfer: empTrans,
      });
    }

    const totalYapesAll = Object.values(staffTotals).reduce((a, b) => a + b, 0) + empresaYapeTotal;

    return {
      rows,
      staffTotals,
      empresaYapeTotal,
      empresaTransferTotal,
      totalYapesAll,
    };
  }, [dailyReportRows, authorizedStaff]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const headers = [
      "ITEM",
      "TOTAL",
      "PLACA",
      "SERVICIO O REPUESTO",
      "DETALLE",
      "PENDIENTE",
      "EFECTIVO",
      "YAPE",
      "TRANSFERENCIA",
      "CULQI",
      "RESPONSABLE",
    ];

    const csvLines = [headers.join(";")];

    dailyReportRows.forEach((r) => {
      csvLines.push(
        [
          r.item,
          `$${r.total.toFixed(2)}`,
          r.placa,
          r.servicio,
          `"${r.detalleItems.replace(/"/g, '""')}"`,
          r.pendiente > 0 ? `$${r.pendiente.toFixed(2)}` : "",
          r.efectivo > 0 ? `$${r.efectivo.toFixed(2)}` : "",
          r.yape > 0 ? `$${r.yape.toFixed(2)}` : "",
          r.transferencia > 0 ? `$${r.transferencia.toFixed(2)}` : "",
          r.culqi > 0 ? `$${r.culqi.toFixed(2)}` : "",
          r.responsable,
        ].join(";")
      );
    });

    // Totals line
    csvLines.push(
      [
        "TOTALES",
        `$${table1Totals.totalGeneral.toFixed(2)}`,
        "",
        "",
        "",
        `$${table1Totals.totalPendiente.toFixed(2)}`,
        `$${table1Totals.totalEfectivo.toFixed(2)}`,
        `$${table1Totals.totalYape.toFixed(2)}`,
        `$${table1Totals.totalTransferencia.toFixed(2)}`,
        `$${table1Totals.totalCulqi.toFixed(2)}`,
        `COBRADO: $${table1Totals.totalCobrado.toFixed(2)}`,
      ].join(";")
    );

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Caja_Liquidacion_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <span>Reporte de Caja & Liquidación Diaria</span>
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 font-mono">
                {formattedDateTitle}
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              Arqueo consolidado de ingresos en Efectivo, Yapes, Transferencias y Cuentas por Cobrar.
            </p>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-reygas-surface rounded-xl border border-white/10 p-1">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              title="Día Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => changeDateByDays(1)}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              title="Día Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
          >
            Hoy
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Download className="w-4 h-4" />
            <span>Excel / CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1">
          <span className="text-[10px] text-emerald-400 uppercase font-bold block">💵 Total Efectivo</span>
          <span className="text-xl font-black text-white font-mono">S/ {table1Totals.totalEfectivo.toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase font-bold block">📱 Total Yapes</span>
          <span className="text-xl font-black text-white font-mono">S/ {table1Totals.totalYape.toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 space-y-1">
          <span className="text-[10px] text-blue-400 uppercase font-bold block">🏦 Total Transferencias</span>
          <span className="text-xl font-black text-white font-mono">S/ {table1Totals.totalTransferencia.toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-orange-950/40 border border-orange-500/40 space-y-1">
          <span className="text-[10px] text-orange-400 uppercase font-bold block">💳 Total Culqi / Tarjeta</span>
          <span className="text-xl font-black text-white font-mono">S/ {table1Totals.totalCulqi.toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-1">
          <span className="text-[10px] text-red-400 uppercase font-bold block">⏳ Total Pendiente / Crédito</span>
          <span className="text-xl font-black text-red-300 font-mono">S/ {table1Totals.totalPendiente.toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-400/50 space-y-1">
          <span className="text-[10px] text-amber-300 uppercase font-bold block">🏆 Total Liquidación</span>
          <span className="text-xl font-black text-amber-300 font-mono">S/ {table1Totals.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      {/* Main Dual Table Layout matching Image 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* TABLE 1: LIQUIDACIÓN DIARIA DE INGRESOS (Left Column - 8 Cols) */}
        {/* ========================================================================= */}
        <div className="xl:col-span-8 space-y-4">
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Table 1 Header Title */}
            <div className="p-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-black font-black text-center text-sm uppercase tracking-wider flex items-center justify-between">
              <span className="text-xs opacity-75">ReyGas Taller</span>
              <span className="text-base font-black">REPORTE DE CAJA {formattedDateTitle}</span>
              <span className="text-xs font-mono font-bold bg-black/20 px-2 py-0.5 rounded text-white">
                {dailyReportRows.length} Atenciones
              </span>
            </div>

            {/* Table 1 Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-amber-100 text-black font-black border-b border-black/30 uppercase text-[11px]">
                    <th className="py-2.5 px-2 text-center border-r border-black/20 w-12 bg-sky-200">ITEM</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-amber-200">TOTAL</th>
                    <th className="py-2.5 px-2 text-center border-r border-black/20 w-24 bg-sky-200">PLACA</th>
                    <th className="py-2.5 px-2 text-left border-r border-black/20 min-w-[140px] bg-purple-200">SERVICIO O REPUESTO</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-red-600 text-white">PENDIENTE</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-emerald-600 text-white">EFECTIVO</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-fuchsia-600 text-white">YAPE</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-blue-600 text-white">TRANSFERENCIA</th>
                    <th className="py-2.5 px-2 text-right border-r border-black/20 w-24 bg-amber-500 text-black">CULQI</th>
                    <th className="py-2.5 px-2 text-center w-28 bg-gray-300">RESPONSABLE</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5 text-gray-200 font-medium">
                  {dailyReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400 italic">
                        No hay movimientos registrados para la fecha {formattedDateTitle}.
                      </td>
                    </tr>
                  ) : (
                    dailyReportRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-white/[0.04] transition-colors odd:bg-black/20 even:bg-black/40"
                      >
                        <td className="py-2 px-2 text-center font-bold text-gray-400 border-r border-white/5">
                          {row.item}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-white border-r border-white/5 bg-amber-500/5">
                          S/ {row.total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-extrabold text-amber-300 border-r border-white/5">
                          {row.placa}
                        </td>
                        <td className="py-2 px-2 text-left border-r border-white/5 truncate max-w-[180px]" title={row.detalleItems}>
                          <span className="font-bold text-gray-300 text-[11px] block">{row.servicio}</span>
                          <span className="text-[10px] text-gray-400 block truncate">{row.detalleItems}</span>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold border-r border-white/5 ${row.pendiente > 0 ? "bg-red-950/60 text-red-300" : "text-gray-600"}`}>
                          {row.pendiente > 0 ? `S/ ${row.pendiente.toFixed(2)}` : "-"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold border-r border-white/5 ${row.efectivo > 0 ? "bg-emerald-950/60 text-emerald-300" : "text-gray-600"}`}>
                          {row.efectivo > 0 ? `S/ ${row.efectivo.toFixed(2)}` : "-"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold border-r border-white/5 ${row.yape > 0 ? "bg-fuchsia-950/60 text-fuchsia-300" : "text-gray-600"}`}>
                          {row.yape > 0 ? `S/ ${row.yape.toFixed(2)}` : "-"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold border-r border-white/5 ${row.transferencia > 0 ? "bg-blue-950/60 text-blue-300" : "text-gray-600"}`}>
                          {row.transferencia > 0 ? `S/ ${row.transferencia.toFixed(2)}` : "-"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold border-r border-white/5 ${row.culqi > 0 ? "bg-amber-950/60 text-amber-300" : "text-gray-600"}`}>
                          {row.culqi > 0 ? `S/ ${row.culqi.toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-[11px]">
                          <span className={`px-2 py-0.5 rounded-md font-mono ${
                            row.responsable.includes("EMPRESA")
                              ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
                              : row.responsable === "PENDIENTE"
                              ? "bg-red-950/60 text-red-400 border border-red-500/30"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                          }`}>
                            {row.responsable}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table 1 Totals Footer */}
                <tfoot>
                  <tr className="bg-black/90 font-black border-t-2 border-amber-500/50 text-xs">
                    <td className="py-3 px-2 text-center uppercase text-emerald-400 font-extrabold border-r border-white/10" colSpan={1}>
                      COBRADO
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-300 font-black border-r border-white/10 bg-emerald-950/40">
                      S/ {table1Totals.totalCobrado.toFixed(2)}
                    </td>
                    <td colSpan={2} className="border-r border-white/10"></td>
                    <td className="py-3 px-2 text-right font-mono text-red-300 bg-red-950/80 border-r border-white/10">
                      S/ {table1Totals.totalPendiente.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-300 bg-emerald-950/80 border-r border-white/10">
                      S/ {table1Totals.totalEfectivo.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-fuchsia-300 bg-fuchsia-950/80 border-r border-white/10">
                      S/ {table1Totals.totalYape.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-blue-300 bg-blue-950/80 border-r border-white/10">
                      S/ {table1Totals.totalTransferencia.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-amber-300 bg-amber-950/80 border-r border-white/10">
                      S/ {table1Totals.totalCulqi.toFixed(2)}
                    </td>
                    <td className="border-white/10"></td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-black font-black text-sm">
                    <td colSpan={3} className="py-3 px-4 text-left font-black tracking-widest text-base">
                      TOTAL GENERAL
                    </td>
                    <td colSpan={7} className="py-3 px-6 text-center font-mono font-black text-2xl tracking-wider">
                      S/ {table1Totals.totalGeneral.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TABLE 2: ARQUEO DE YAPES & TRANSFERENCIAS (Right Column - 4 Cols) */}
        {/* ========================================================================= */}
        <div className="xl:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Table 2 Header */}
            <div className="grid grid-cols-12 text-center text-xs font-black uppercase border-b border-white/10">
              <div className="col-span-9 bg-fuchsia-700 text-white py-2.5 tracking-wider font-extrabold flex items-center justify-center gap-1.5">
                <span>📱 YAPES POR DESTINO</span>
              </div>
              <div className="col-span-3 bg-blue-700 text-white py-2.5 tracking-wider font-extrabold text-[10px] flex items-center justify-center">
                <span>TRANSFERENCIA</span>
              </div>
            </div>

            {/* Column Headers for Staff */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-sky-200 text-black font-black border-b border-black/30 uppercase text-[10px]">
                    <th className="py-2 px-1.5 text-center border-r border-black/20 w-8">N°</th>
                    {authorizedStaff.map((staff) => (
                      <th key={staff} className="py-2 px-1.5 text-center border-r border-black/20 bg-sky-100">
                        {staff}
                      </th>
                    ))}
                    <th className="py-2 px-1.5 text-center border-r border-black/20 bg-emerald-200">
                      EMPRESA
                    </th>
                    <th className="py-2 px-1.5 text-center bg-blue-200">
                      EMPRESA
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5 text-gray-200 font-medium">
                  {table2Breakdown.rows.map((row) => (
                    <tr key={row.index} className="hover:bg-white/[0.04] odd:bg-black/20 even:bg-black/40">
                      <td className="py-1.5 px-1.5 text-center font-bold text-gray-500 border-r border-white/5 text-[10px]">
                        {row.index}
                      </td>
                      {authorizedStaff.map((staff) => {
                        const amount = row.byStaff[staff] || 0;
                        return (
                          <td
                            key={staff}
                            className={`py-1.5 px-1.5 text-right font-mono text-[11px] border-r border-white/5 ${
                              amount > 0 ? "font-bold text-fuchsia-300 bg-fuchsia-950/30" : "text-gray-600"
                            }`}
                          >
                            {amount > 0 ? `S/ ${amount.toFixed(2)}` : ""}
                          </td>
                        );
                      })}
                      <td className={`py-1.5 px-1.5 text-right font-mono text-[11px] border-r border-white/5 ${
                        row.empresaYape > 0 ? "font-bold text-emerald-300 bg-emerald-950/30" : "text-gray-600"
                      }`}>
                        {row.empresaYape > 0 ? `S/ ${row.empresaYape.toFixed(2)}` : ""}
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-mono text-[11px] ${
                        row.empresaTransfer > 0 ? "font-bold text-blue-300 bg-blue-950/30" : "text-gray-600"
                      }`}>
                        {row.empresaTransfer > 0 ? `S/ ${row.empresaTransfer.toFixed(2)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Table 2 Totals */}
                <tfoot>
                  <tr className="bg-black/90 font-black border-t border-white/20 text-xs">
                    <td className="py-2.5 px-1.5 text-center border-r border-white/10 text-[10px] text-gray-400">
                      Σ
                    </td>
                    {authorizedStaff.map((staff) => {
                      const total = table2Breakdown.staffTotals[staff] || 0;
                      return (
                        <td
                          key={staff}
                          className={`py-2.5 px-1.5 text-right font-mono font-black text-[11px] border-r border-white/10 ${
                            total > 0 ? "bg-emerald-950/80 text-emerald-300" : "bg-red-950/80 text-red-300"
                          }`}
                        >
                          S/ {total.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-1.5 text-right font-mono font-black text-[11px] border-r border-white/10 bg-emerald-950/80 text-emerald-300">
                      S/ {table2Breakdown.empresaYapeTotal.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono font-black text-[11px] bg-red-950/80 text-red-300">
                      S/ {table2Breakdown.empresaTransferTotal.toFixed(2)}
                    </td>
                  </tr>

                  {/* Yapes Consolidated Total */}
                  <tr className="bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500 text-black font-black text-sm">
                    <td colSpan={authorizedStaff.length + 1} className="py-3 px-3 text-left font-black">
                      TOTAL YAPES
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-right font-mono font-black text-base">
                      S/ {table2Breakdown.totalYapesAll.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
