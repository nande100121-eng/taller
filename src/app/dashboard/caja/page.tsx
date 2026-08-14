"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  buildVehicleCreditSettlementMap,
  parseSplitPaymentString,
} from "@/lib/utils/credit-tracker";
import {
  CreditCard,
  DollarSign,
  Receipt,
  CheckCircle2,
  Lock,
  Unlock,
  Coins,
  Clock,
  Search,
  Calendar,
  History,
  AlertCircle,
  X,
  Building,
  UserCheck,
  Tag
} from "lucide-react";

export default function CajaPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    createInvoiceForOrder,
    togglePayInvoice,
    confirmInvoicePayment,
    toggleAllowModificationsInWorkshop,
  } = useAppStore();

  const [activeMainTab, setActiveMainTab] = useState<"caja" | "consultas">("caja");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"todos" | "pendientes" | "pagados">("todos");

  // Search Filters
  const [searchPlate, setSearchPlate] = useState("");
  const deferredSearchPlate = React.useDeferredValue(searchPlate);
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10)); // Default today

  // Modal State for Mandatory Payment Confirmation
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    workOrder: any;
    invoice: any;
    grandTotal: number;
    paymentMethod: "Efectivo" | "Yape" | "Transferencia" | "Culqi";
    paymentDestination: string;
    receiptNumber: string;
    receiptType: "Boleta" | "Factura" | "Nota de Venta";
  } | null>(null);

  // Alert State
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const showAlert = (type: "success" | "warning", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // O(1) Invoices lookup map
  const invoicesByWorkOrderId = React.useMemo(() => {
    const map = new Map<string, (typeof invoices)[0]>();
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (inv && inv.work_order_id) {
        map.set(inv.work_order_id, inv);
      }
    }
    return map;
  }, [invoices]);

  // List of eligible payment destinations: EMPRESA + staff with can_receive_payment
  const eligibleDestinations = React.useMemo(() => {
    const list = ["EMPRESA"];
    technicians
      .filter((t) => t.is_active && t.can_receive_payment)
      .forEach((t) => {
        const name = t.full_name.toUpperCase();
        if (!list.includes(name)) list.push(name);
      });
    return list;
  }, [technicians]);

  // Cross-order credit settlement index (matches earlier credits with subsequent debt cancellations)
  const creditSettlementMap = React.useMemo(() => {
    return buildVehicleCreditSettlementMap(workOrders, invoicesByWorkOrderId);
  }, [workOrders, invoicesByWorkOrderId]);

  // Comprehensive, real-time function to determine if order is paid or pending credit
  const isOrderPaid = React.useCallback((wo: any, inv?: any) => {
    if (!wo && !inv) return false;

    // 0. If credit was settled/paid in a subsequent debt cancellation visit -> Paid!
    const settledInfo = creditSettlementMap.settledOrdersMap.get(wo.id);
    if (settledInfo?.isSettled) return true;

    // 1. Explicitly pending payment_status
    if (inv?.payment_status === "pendiente") return false;

    // 2. Explicit condition PENDIENTE or CREDITO
    const condition = (inv?.payment_condition || "").toUpperCase().trim();
    if (condition === "PENDIENTE" || condition.includes("CREDIT")) return false;

    // 3. Explicit credit amount registered
    if ((inv?.credit_amount || 0) > 0) return false;

    // 4. Tagged in diagnostic notes
    const diagNotes = (wo?.diagnostic_notes || "").toUpperCase();
    if (diagNotes.includes("[CREDITO]:") || diagNotes.includes("[CONDICION]: PENDIENTE")) return false;

    // 5. Text patterns in descriptions or items (e.g. 'PENDIENTE 35', 'DEUDA', 'A CUENTA', 'RESPONSABLE DE PAGO', 'CANCELE')
    const probDesc = (wo?.problem_description || "").toUpperCase();
    const spareDesc = (wo?.spare_parts_services || "").toUpperCase();
    const itemDescs = (wo?.items || []).map((i: any) => (i.description || "").toUpperCase()).join(" ");

    const combinedText = `${probDesc} ${spareDesc} ${itemDescs} ${diagNotes}`;
    if (
      combinedText.includes("PENDIENTE") ||
      combinedText.includes("CREDITO") ||
      combinedText.includes("RESPONSABLE DE PAGO") ||
      combinedText.includes("A CUENTA") ||
      combinedText.includes("CANCELE EL MONTO")
    ) {
      return false;
    }

    // 6. Explicit pending statuses
    if (wo?.status === "por_cobrar" || wo?.status === "pendiente_pago") return false;

    // 7. Non-billing zero inspection entries (no total, no items, receipt is 0 or empty) -> Not a paid invoice
    const grandTotal = inv?.grand_total || (wo?.items || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
    const receiptNum = (inv?.receipt_number || "").trim();
    if (grandTotal === 0 && (!receiptNum || receiptNum === "0") && (wo?.items || []).length === 0) {
      return false;
    }

    // 8. Completed paid invoice
    if (inv?.payment_status === "pagado" || wo?.status === "pagado_autorizado" || wo?.status === "finalizado") {
      return true;
    }

    return false;
  }, [creditSettlementMap]);

  // Orders that reached billing or have an invoice registered
  const allBillingWorkOrders = React.useMemo(() => {
    return workOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const total = inv?.grand_total || (wo.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
      const hasItems = (wo.items || []).length > 0;
      const receiptNum = (inv?.receipt_number || "").trim();
      const hasReceipt = receiptNum && receiptNum !== "0";
      const isPaid = isOrderPaid(wo, inv);

      // Include if it's a valid billing order (has items or price or receipt) OR if it is pending payment
      return total > 0 || hasItems || hasReceipt || !isPaid;
    });
  }, [workOrders, invoicesByWorkOrderId, isOrderPaid]);

  // Daily cash closure calculation for selected date
  const totalPaidToday = React.useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          inv.payment_status === "pagado" &&
          ((inv.paid_at && inv.paid_at.startsWith(queryDate)) ||
            (inv.issued_at && inv.issued_at.startsWith(queryDate)))
      )
      .reduce((sum, inv) => sum + inv.grand_total, 0);
  }, [invoices, queryDate]);

  const pendingCount = React.useMemo(() => {
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      return !isOrderPaid(wo, inv);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, isOrderPaid]);

  const paidCount = React.useMemo(() => {
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      return isOrderPaid(wo, inv);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, isOrderPaid]);

  // Filtered orders for Caja Tab
  const filteredCajaOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";

    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const isPaid = isOrderPaid(wo, inv);

      const matchPlate = term ? wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term) : true;
      const matchStatus =
        activeStatusFilter === "todos"
          ? true
          : activeStatusFilter === "pendientes"
          ? !isPaid
          : isPaid;

      return matchPlate && matchStatus;
    });
  }, [allBillingWorkOrders, invoicesByWorkOrderId, deferredSearchPlate, activeStatusFilter, isOrderPaid]);

  // Filtered orders for Consultas (Historical Query by Selected Date) Tab
  const filteredConsultasOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";

    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const matchPlate = term ? wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term) : true;

      // Compare date with entry_time or invoice issued_at / paid_at
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
      const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";

      const matchDate =
        !queryDate ||
        orderDateStr === queryDate ||
        invoiceDateStr === queryDate ||
        paidDateStr === queryDate;

      return matchPlate && matchDate;
    });
  }, [allBillingWorkOrders, invoicesByWorkOrderId, deferredSearchPlate, queryDate]);

  // Handle open payment confirmation modal
  const handleOpenPaymentModal = (wo: any, inv?: any, total: number = 0) => {
    setPaymentModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      grandTotal: total,
      paymentMethod: (inv?.payment_method as any) || "Efectivo",
      paymentDestination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
      receiptNumber: inv?.receipt_number || "",
      receiptType: (inv?.receipt_type as any) || "Boleta",
    });
  };

  // Submit payment confirmation
  const handleConfirmPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;

    if (!paymentModal.paymentMethod) {
      showAlert("warning", "Debe seleccionar un Método de Pago.");
      return;
    }

    if (!paymentModal.paymentDestination) {
      showAlert("warning", "Debe seleccionar el Destino del Pago (Personal o Empresa).");
      return;
    }

    confirmInvoicePayment({
      invoiceId: paymentModal.invoice?.id,
      workOrderId: paymentModal.workOrder?.id,
      paymentMethod: paymentModal.paymentMethod,
      paymentDestination: paymentModal.paymentDestination,
      receiptNumber: paymentModal.receiptNumber,
      receiptType: paymentModal.receiptType,
    });

    showAlert("success", `¡Pago de S/ ${paymentModal.grandTotal.toFixed(2)} confirmado correctamente!`);
    setPaymentModal(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Alert Notifications */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all animate-fadeIn ${
            alertMsg.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
              : "bg-amber-950/90 text-amber-300 border border-amber-500/50"
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Caja, Facturación & Cobros</h1>
            <p className="text-xs text-gray-400">
              Gestión obligatoria de métodos de pago, destino por personal/empresa y liquidación diaria.
            </p>
          </div>
        </div>

        {/* Cash Closure Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-3">
            <Coins className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Recaudado ({queryDate === new Date().toISOString().slice(0, 10) ? "Hoy" : queryDate})
              </span>
              <span className="text-xl font-black text-white">S/ {totalPaidToday.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Pendientes de Pago</span>
              <span className="text-xl font-black text-amber-400">{pendingCount} Vehículos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-reygas-dark p-2 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveMainTab("caja")}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
              activeMainTab === "caja"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>📌 Caja & Cobros Activos ({allBillingWorkOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab("consultas")}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
              activeMainTab === "consultas"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <History className="w-4 h-4" />
            <span>📊 Histórico por Fecha</span>
          </button>
        </div>

        {/* Global Search Filters (Plate & Date) */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              className="w-full sm:w-44 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400"
            />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={queryDate}
              onChange={(e) => setQueryDate(e.target.value)}
              className="w-full sm:w-40 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CAJA & COBROS ACTIVOS */}
      {/* ========================================================================= */}
      {activeMainTab === "caja" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Comprobantes y Liquidación de Taller</h2>
            </div>

            <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveStatusFilter("todos")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "todos"
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Todos ({allBillingWorkOrders.length})
              </button>
              <button
                onClick={() => setActiveStatusFilter("pendientes")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pendientes"
                    ? "bg-amber-500 text-black font-extrabold shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Pendientes ({pendingCount})
              </button>
              <button
                onClick={() => setActiveStatusFilter("pagados")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pagados"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Pagados ({paidCount})
              </button>
            </div>
          </div>

          {filteredCajaOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Receipt className="w-12 h-12 text-gray-500 mx-auto" />
              <p className="text-sm font-bold text-gray-400">
                No hay vehículos en Caja con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCajaOrders.map((wo) => {
                const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const settledInfo = creditSettlementMap.settledOrdersMap.get(wo.id);
                const cancellationInfo = creditSettlementMap.cancellationsMap.get(wo.id);
                const partsTotal = (wo.items || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
                const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
                let grandTotal = invoice?.grand_total !== undefined && invoice.grand_total > 0
                  ? invoice.grand_total
                  : partsTotal + certFee;
                if (grandTotal === 0 && (invoice?.credit_amount || 0) > 0) {
                  grandTotal = invoice!.credit_amount!;
                }
                const splitPayment = parseSplitPaymentString(invoice?.discounts, wo.diagnostic_notes, invoice?.payment_method, grandTotal);
                const isPaid = settledInfo?.isSettled || isOrderPaid(wo, invoice);
                const allowModInWorkshop = wo.allow_modifications;

                return (
                  <div
                    key={wo.id}
                    className={`p-5 rounded-2xl border transition-all glass-panel hover:border-purple-500/40 ${
                      isPaid
                        ? "bg-emerald-950/20 border-emerald-500/40"
                        : "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Vehicle & Client Info */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                              {wo.vehicle_plate}
                            </span>
                            <div>
                              <span className="text-sm font-bold text-white block">
                                {vehicle?.brand} {vehicle?.model} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                              </span>
                              <span className="text-xs text-reygas-red font-semibold">
                                Cliente: {vehicle?.owner_name || "Cliente Taller"} • Teléfono: {vehicle?.owner_phone || "S/T"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-500/30">
                              📅 <strong>Registro:</strong>{" "}
                              {wo.entry_time ? new Date(wo.entry_time).toLocaleString() : "Hoy"}
                            </span>

                            <span className="text-xs px-2.5 py-1 rounded-lg bg-reygas-surface text-gray-300 border border-white/10">
                              Técnico: <strong className="text-amber-400">{tech?.full_name || "Asignado"}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Dynamic Credit & Debt Status Banner */}
                        {settledInfo?.isSettled ? (
                          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <span className="font-black text-emerald-300 text-xs block">
                                  CRÉDITO DE S/ {(settledInfo.originalCreditAmount || settledInfo.settledAmount || 0).toFixed(2)} CANCELADO EL {settledInfo.settledDate}
                                </span>
                                <span className="text-[11px] text-gray-300">
                                  En esta fecha se pagó <strong>S/ {grandTotal.toFixed(2)}</strong> y quedó un crédito de <strong>S/ {(settledInfo.originalCreditAmount || settledInfo.settledAmount || 0).toFixed(2)}</strong> que ya fue saldado posteriormente.
                                </span>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-extrabold text-xs rounded-lg border border-emerald-500/40 shrink-0 self-start sm:self-auto">
                              CRÉDITO SALDADO ✓
                            </span>
                          </div>
                        ) : cancellationInfo?.isCancellation ? (
                          <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💳</span>
                              <div>
                                <span className="font-black text-cyan-300 text-xs block">
                                  PAGO DE DEUDA: Atención del {cancellationInfo.originalDate} ({cancellationInfo.originalService})
                                </span>
                                <span className="text-[11px] text-gray-300">
                                  Este cobro de <strong>S/ {grandTotal.toFixed(2)}</strong> cancela el crédito pendiente de la visita anterior.
                                </span>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 font-extrabold text-xs rounded-lg border border-cyan-500/40 shrink-0 self-start sm:self-auto">
                              DEUDA CANCELADA ✓
                            </span>
                          </div>
                        ) : settledInfo?.hasCredit || (invoice?.credit_amount || 0) > 0 || !isPaid ? (
                          <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏦</span>
                              <div>
                                <span className="font-black text-amber-300 text-xs block">
                                  CRÉDITO PENDIENTE POR COBRAR: S/ {(settledInfo?.creditAmount || invoice?.credit_amount || grandTotal).toFixed(2)}
                                </span>
                                <span className="text-[11px] text-gray-300">
                                  Atención registrada con saldo deudor pendiente de cobro.
                                </span>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-extrabold text-xs rounded-lg border border-amber-500/40 shrink-0 animate-pulse self-start sm:self-auto">
                              PENDIENTE DE PAGO ⏳
                            </span>
                          </div>
                        ) : null}

                        {/* Parts and Concept Detail */}
                        <div className="p-3 bg-reygas-dark/60 rounded-xl border border-white/5 space-y-2">
                          <span className="text-[11px] font-bold uppercase text-gray-400 block">
                            Detalle de Servicio y Repuestos en Orden #{wo.id}:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {wo.requires_certification && (
                              <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                                <span>📜 Certificado ({wo.certification_type}):</span>
                                <span className="font-mono font-bold text-cyan-300">
                                  S/ {(wo.certification_price || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {wo.items.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-gray-300 bg-white/5 p-2 rounded-lg"
                              >
                                <span>{item.item_type === "servicio" ? "🛠️" : "📦"} {item.description} (x{item.quantity})</span>
                                <span className="font-mono font-bold text-amber-300">
                                  S/ {(item.subtotal > 0 ? item.subtotal : grandTotal).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Payment Metadata pill */}
                          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-gray-300 border-t border-white/5 font-mono">
                            {splitPayment.hasSplit ? (
                              <span className="px-2.5 py-1 rounded-lg bg-fuchsia-950/80 border border-fuchsia-500/50 text-fuchsia-300 font-black">
                                💰 {splitPayment.formattedSummary}
                              </span>
                            ) : (
                              <span>💳 <strong>Método:</strong> {invoice?.payment_method || "Efectivo"}</span>
                            )}
                            <span>🏢 <strong>Destino:</strong> <strong className="text-amber-300">{invoice?.payment_destination || "EMPRESA"}</strong></span>
                            {invoice?.receipt_number && <span>🧾 <strong>Recibo/Comp:</strong> {invoice.receipt_number} ({invoice.receipt_type || "Boleta"})</span>}
                          </div>
                        </div>
                      </div>

                      {/* Total Amount & Action Buttons */}
                      <div className="flex flex-col items-end justify-center gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">
                            {isPaid ? "Monto Cobrado" : "Monto por Cobrar"}
                          </span>
                          <span className={`text-3xl font-black font-mono ${isPaid ? "text-white" : "text-amber-400"}`}>
                            S/ {grandTotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {isPaid ? (
                            <>
                              <button
                                onClick={() => {
                                  if (invoice) togglePayInvoice(invoice.id);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-black flex items-center gap-2 transition-all"
                                title="Haga clic para revertir estado a pendiente"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>PAGADO (Desmarcar Pago)</span>
                              </button>

                              <button
                                onClick={() => toggleAllowModificationsInWorkshop(wo.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                  allowModInWorkshop
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                    : "bg-gray-800 text-gray-400 border-white/10 hover:text-white"
                                }`}
                              >
                                {allowModInWorkshop ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>🔓 Modificación Habilitada en Taller</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                                    <span>🔒 Habilitar Modificación en Taller</span>
                                  </>
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenPaymentModal(wo, invoice, grandTotal)}
                              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                            >
                              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                              <span>Confirmar Cobro (Método & Destino)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CONSULTAS & HISTORICO POR DIA (CARDS DE HISTORIAL) */}
      {/* ========================================================================= */}
      {activeMainTab === "consultas" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Histórico de Consultas por Día & Placa</h2>
                <p className="text-xs text-gray-400">
                  Mostrando registros de vehículos y comprobantes registrados el día{" "}
                  <strong className="text-amber-400 font-mono">{queryDate}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-reygas-dark px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-gray-300 font-bold">Día de Consulta:</span>
              <input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="bg-transparent text-white font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          {filteredConsultasOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto" />
              <p className="text-sm font-bold text-gray-400">
                No hay registros ni vehículos ingresados en la fecha <span className="text-amber-400">{queryDate}</span>.
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Seleccione otra fecha en el selector superior o limpie la búsqueda por placa para explorar el histórico.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredConsultasOrders.map((wo) => {
                const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const isPaid = isOrderPaid(wo, invoice);
                const partsTotal = (wo.items || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
                const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
                const grandTotal = invoice?.grand_total !== undefined && invoice.grand_total > 0
                  ? invoice.grand_total
                  : partsTotal + certFee;

                return (
                  <div
                    key={wo.id}
                    className="p-5 rounded-2xl border border-white/10 glass-panel bg-reygas-dark/90 space-y-4 hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Vehicle & Client Info */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                            {wo.vehicle_plate}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {vehicle?.brand} {vehicle?.model} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                            </span>
                            <span className="text-xs text-reygas-red font-semibold">
                              Propietario: {vehicle?.owner_name || "Cliente Taller"} • Contacto: {vehicle?.owner_phone || "S/T"}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1 ml-auto">
                            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                              📅 <strong>Fecha Ingreso:</strong>{" "}
                              {wo.entry_time ? new Date(wo.entry_time).toLocaleString() : "Hoy"}
                            </span>

                            {isPaid ? (
                              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                💳 <strong>Estado Pago:</strong> PAGADO ✓
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                                ⏳ <strong>Estado Pago:</strong> PENDIENTE
                              </span>
                            )}

                            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-reygas-surface text-gray-300 border border-white/10">
                              Mecánico: <strong className="text-amber-400">{tech?.full_name || "Asignado"}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Concept Breakdown */}
                        <div className="p-3 bg-reygas-surface/80 rounded-xl border border-white/5 space-y-2">
                          <span className="text-[11px] font-bold uppercase text-amber-400 block">
                            Resumen de Servicios & Repuestos en la Consulta:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {wo.requires_certification && (
                              <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                                <span>📜 Certificado ({wo.certification_type}):</span>
                                <span className="font-mono font-bold text-cyan-300">
                                  S/ {(wo.certification_price || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {wo.items.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-gray-300 bg-black/20 p-2 rounded-lg"
                              >
                                <span>{item.item_type === "servicio" ? "🛠️" : "📦"} {item.description} (x{item.quantity})</span>
                                <span className="font-mono font-bold text-amber-300">
                                  S/ {(item.subtotal > 0 ? item.subtotal : grandTotal).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Total Amount Badge */}
                      <div className="flex flex-col items-end justify-center gap-2 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">
                          {isPaid ? "Monto Cobrado" : "Monto por Cobrar"}
                        </span>
                        <span className={`text-3xl font-black font-mono ${isPaid ? "text-white" : "text-amber-400"}`}>
                          S/ {grandTotal.toFixed(2)}
                        </span>
                        <span className="text-[11px] px-3 py-1 rounded-full bg-reygas-surface text-gray-300 font-bold border border-white/10">
                          Orden #{wo.id}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANDATORY PAYMENT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {paymentModal && paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg glass-panel bg-reygas-dark border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-500/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Confirmación Obligatoria de Cobro</h3>
                  <p className="text-xs text-gray-400">
                    Placa: <strong className="text-white font-mono">{paymentModal.workOrder?.vehicle_plate}</strong> • Total: <strong className="text-emerald-400 font-mono text-sm">S/ {paymentModal.grandTotal.toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaymentSubmit} className="space-y-4">
              {/* Payment Method (Obligatorio) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  1. Método de Pago (Obligatorio) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Efectivo", "Yape", "Transferencia", "Culqi"] as const).map((method) => {
                    const isSelected = paymentModal.paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentModal({ ...paymentModal, paymentMethod: method })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]"
                            : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                        }`}
                      >
                        <span>{method === "Efectivo" ? "💵" : method === "Yape" ? "📱" : method === "Transferencia" ? "🏦" : "💳"}</span>
                        <span>{method}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Destination / Responsable (Obligatorio) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>2. Destino del Pago / Responsable *</span>
                  <span className="text-[10px] text-amber-400 font-normal">Personal habilitado en Tablas Maestras</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={paymentModal.paymentDestination}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentDestination: e.target.value })}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-reygas-surface border border-white/10 rounded-xl text-sm font-bold text-white focus:border-emerald-400"
                  >
                    {eligibleDestinations.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest === "EMPRESA" ? "🏢 EMPRESA (Cuenta Principal / Caja)" : `👤 ${dest}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Receipt Details (Opcional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Tipo de Comprobante</label>
                  <select
                    value={paymentModal.receiptType}
                    onChange={(e) => setPaymentModal({ ...paymentModal, receiptType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="Boleta">Boleta</option>
                    <option value="Factura">Factura</option>
                    <option value="Nota de Venta">Nota de Venta / Recibo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">N° de Recibo / Comprobante</label>
                  <input
                    type="text"
                    placeholder="Ej: B001-004523"
                    value={paymentModal.receiptNumber}
                    onChange={(e) => setPaymentModal({ ...paymentModal, receiptNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase font-mono"
                  />
                </div>
              </div>

              {/* Summary of what will be recorded */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1 text-gray-300">
                <div className="flex justify-between">
                  <span>Monto Total a Confirmar:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">S/ {paymentModal.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Método & Destino:</span>
                  <span className="text-white font-bold">{paymentModal.paymentMethod} &rarr; {paymentModal.paymentDestination}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar y Registrar Cobro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
