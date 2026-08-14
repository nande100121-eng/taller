"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  buildVehicleCreditSettlementMap,
  parseSplitPaymentString,
} from "@/lib/utils/credit-tracker";
import ThermalReceiptModal from "@/components/caja/thermal-receipt-modal";
import MiniDatePicker from "@/components/ui/mini-date-picker";
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
  Tag,
  Printer,
  Download,
  Eye,
  FileText,
  Loader2,
  SearchCheck
} from "lucide-react";

export default function CajaPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    correlativeConfig,
    getAndIncrementReceiptNumber,
    createInvoiceForOrder,
    togglePayInvoice,
    confirmInvoicePayment,
    toggleAllowModificationsInWorkshop,
  } = useAppStore();

  const [activeMainTab, setActiveMainTab] = useState<"caja" | "consultas">("caja");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"hoy" | "pendientes" | "pagados" | "todos">("hoy");

  // Search Filters
  const [searchPlate, setSearchPlate] = useState("");
  const deferredSearchPlate = React.useDeferredValue(searchPlate);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10)); // Default today

  // Reset pagination on search or tab change
  React.useEffect(() => {
    setVisibleLimit(30);
  }, [deferredSearchPlate, activeStatusFilter]);

  // Modal State for Mandatory Payment Confirmation
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    workOrder: any;
    invoice: any;
    grandTotal: number;
    breakdownItems: Array<{ description: string; quantity: number; unit_price: number; subtotal: number }>;
    discountAmount: number;
    paymentMethod: "Efectivo" | "Yape" | "Transferencia" | "Culqi";
    paymentDestination: string;
    receiptNumber: string;
    receiptType: "Ticket" | "Boleta" | "Factura";
    customerDoc: string;
    customerName: string;
    customerAddress: string;
    observations: string;
    isSearchingRuc?: boolean;
  } | null>(null);

  // Modal State for Viewing / Printing Thermal Receipt
  const [activeReceiptModal, setActiveReceiptModal] = useState<{
    isOpen: boolean;
    workOrder?: any;
    invoice?: any;
    receiptType?: "Ticket" | "Boleta" | "Factura";
    receiptNumber?: string;
    customerDoc?: string;
    customerName?: string;
    customerAddress?: string;
    plate?: string;
    observations?: string;
    grandTotal?: number;
    items?: any[];
    discountAmount?: number;
    paymentMethod?: string;
    issuedAt?: string;
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

  // Fast O(1) Lookups for Vehicles and Technicians
  const vehiclesByPlate = React.useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v?.plate) map.set(v.plate.toUpperCase().trim(), v);
    }
    return map;
  }, [vehicles]);

  const techniciansById = React.useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < technicians.length; i++) {
      const t = technicians[i];
      if (t?.id) map.set(t.id, t);
    }
    return map;
  }, [technicians]);

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

    // 1. Explicit condition from CSV: If payment_condition says PAGADO and no credit amount -> Paid!
    const condition = (inv?.payment_condition || "").toUpperCase().trim();
    const hasCredit = (inv?.credit_amount || 0) > 0;

    if (condition.includes("PAGADO") && !hasCredit) {
      return true;
    }

    if (condition.includes("PENDIENTE") || condition.includes("CREDIT") || hasCredit) {
      return false;
    }

    // 2. If grandTotal is 0 and no credit amount -> Fully covered / paid (warranty/courtesy)
    const grandTotal = inv?.grand_total !== undefined ? inv.grand_total : (wo?.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    if (grandTotal === 0 && !hasCredit) {
      return true;
    }

    // 3. Explicit payment_status / status
    if (inv?.payment_status === "pagado" || wo?.status === "pagado_autorizado" || wo?.status === "finalizado") {
      return true;
    }

    if (inv?.payment_status === "pendiente" || wo?.status === "por_cobrar" || wo?.status === "pendiente_pago") {
      return false;
    }

    // 4. If there is a receipt number and no credit -> Paid
    const receiptNum = (inv?.receipt_number || "").trim();
    if (receiptNum && receiptNum !== "0" && !hasCredit) {
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
    return allBillingWorkOrders
      .filter((wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
        const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
        const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";
        const matchesDate = orderDateStr === queryDate || invoiceDateStr === queryDate || paidDateStr === queryDate;
        return matchesDate && isOrderPaid(wo, inv);
      })
      .reduce((sum, wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const total = inv?.grand_total !== undefined && inv.grand_total > 0
          ? inv.grand_total
          : (wo.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
        return sum + total;
      }, 0);
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid]);

  const totalPendingToday = React.useMemo(() => {
    return allBillingWorkOrders
      .filter((wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
        const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
        const matchesDate = orderDateStr === queryDate || invoiceDateStr === queryDate;
        return matchesDate && !isOrderPaid(wo, inv);
      })
      .reduce((sum, wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const credit = inv?.credit_amount && inv.credit_amount > 0
          ? inv.credit_amount
          : (inv?.grand_total || (wo.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0));
        return sum + credit;
      }, 0);
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid]);

  const pendingCountToday = React.useMemo(() => {
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
      const matchesDate = orderDateStr === queryDate || invoiceDateStr === queryDate;
      return matchesDate && !isOrderPaid(wo, inv);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid]);

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

  const todayCount = React.useMemo(() => {
    const targetDate = queryDate || new Date().toISOString().slice(0, 10);
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
      const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";
      return orderDateStr === targetDate || invoiceDateStr === targetDate || paidDateStr === targetDate;
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate]);

  // Filtered orders for Caja Tab
  const filteredCajaOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";
    const targetDate = queryDate || new Date().toISOString().slice(0, 10);

    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const isPaid = isOrderPaid(wo, inv);

      const matchPlate = term ? wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term) : true;

      let matchStatus = true;
      if (activeStatusFilter === "hoy") {
        const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
        const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
        const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";
        matchStatus = orderDateStr === targetDate || invoiceDateStr === targetDate || paidDateStr === targetDate;
      } else if (activeStatusFilter === "pendientes") {
        matchStatus = !isPaid;
      } else if (activeStatusFilter === "pagados") {
        matchStatus = isPaid;
      } else {
        matchStatus = true;
      }

      return matchPlate && matchStatus;
    });
  }, [allBillingWorkOrders, invoicesByWorkOrderId, deferredSearchPlate, activeStatusFilter, isOrderPaid, queryDate]);

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

  // Helper to compute next correlative preview based on type
  const getCorrelativePreview = (type: "Ticket" | "Boleta" | "Factura") => {
    const config = correlativeConfig || {
      ticketSeries: "TK01",
      ticketLastNumber: 4545,
      boletaSeries: "B001",
      boletaLastNumber: 259,
      facturaSeries: "F001",
      facturaLastNumber: 282,
    };
    if (type === "Factura") {
      return `${config.facturaSeries || "F001"}-${((config.facturaLastNumber || 0) + 1).toString().padStart(8, "0")}`;
    } else if (type === "Boleta") {
      return `${config.boletaSeries || "B001"}-${((config.boletaLastNumber || 0) + 1).toString().padStart(8, "0")}`;
    } else {
      return `${config.ticketSeries || "TK01"}-${((config.ticketLastNumber || 0) + 1).toString().padStart(8, "0")}`;
    }
  };

  // Handle open payment confirmation modal
  const handleOpenPaymentModal = (wo: any, inv?: any, total: number = 0) => {
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
    const initialType: "Ticket" | "Boleta" | "Factura" = (inv?.receipt_type as any) || "Ticket";

    // Build itemized breakdown
    const breakdown: Array<{ description: string; quantity: number; unit_price: number; subtotal: number }> = [];
    if (wo.problem_description || wo.general_maintenance_service) {
      const desc = wo.general_maintenance_service || wo.problem_description;
      const partsSum = (wo.items || []).reduce((s: number, it: any) => s + (it.subtotal || 0), 0);
      const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
      const servicePrice = Math.max(0, total - partsSum - certFee);
      if (servicePrice > 0) {
        breakdown.push({
          description: desc,
          quantity: 1,
          unit_price: servicePrice,
          subtotal: servicePrice,
        });
      }
    }

    if (wo.items && wo.items.length > 0) {
      wo.items.forEach((it: any) => {
        breakdown.push({
          description: it.description,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || it.subtotal,
          subtotal: it.subtotal || 0,
        });
      });
    }

    if (wo.requires_certification && wo.certification_price && wo.certification_price > 0) {
      breakdown.push({
        description: `CERTIFICACIÓN (${wo.certification_type || "GNV/GLP"})`,
        quantity: 1,
        unit_price: wo.certification_price,
        subtotal: wo.certification_price,
      });
    }

    if (breakdown.length === 0) {
      breakdown.push({
        description: wo.problem_description || "SERVICIO DE TALLER",
        quantity: 1,
        unit_price: total,
        subtotal: total,
      });
    }

    const previewNum = inv?.receipt_number && inv.receipt_number !== "0" && inv.receipt_number.toLowerCase() !== "s/n"
      ? inv.receipt_number
      : getCorrelativePreview(initialType);

    setPaymentModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      grandTotal: total,
      breakdownItems: breakdown,
      discountAmount: inv?.discounts || 0,
      paymentMethod: (inv?.payment_method as any) || "Efectivo",
      paymentDestination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
      receiptNumber: previewNum,
      receiptType: initialType,
      customerDoc: inv?.customer_doc || "",
      customerName: inv?.client_name || vehicle?.owner_name || (initialType === "Ticket" ? "CLIENTES VARIOS" : ""),
      customerAddress: inv?.customer_address || "-",
      observations: inv?.observations || wo.observations || "",
      isSearchingRuc: false,
    });
  };

  // Query SUNAT RUC
  const handleLookupRuc = async () => {
    if (!paymentModal?.customerDoc || paymentModal.customerDoc.length !== 11) {
      showAlert("warning", "Ingrese un RUC válido de 11 dígitos numéricos.");
      return;
    }
    setPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: true } : null));
    try {
      const res = await fetch(`/api/consulta-ruc?ruc=${paymentModal.customerDoc}`);
      const data = await res.json();
      if (data.success) {
        setPaymentModal((prev) =>
          prev
            ? {
                ...prev,
                isSearchingRuc: false,
                customerName: data.razonSocial || prev.customerName,
                customerAddress: data.direccion || prev.customerAddress,
              }
            : null
        );
        showAlert("success", `RUC verificado: ${data.razonSocial}`);
      } else {
        setPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
        showAlert("warning", data.error || "No se pudo consultar el RUC. Ingréselo manualmente.");
      }
    } catch (err) {
      setPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
      showAlert("warning", "Error de conexión al consultar RUC.");
    }
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

    if (paymentModal.receiptType === "Factura" && (!paymentModal.customerDoc || paymentModal.customerDoc.length !== 11)) {
      showAlert("warning", "Para emitir Factura es obligatorio ingresar un RUC de 11 dígitos.");
      return;
    }

    // Auto-advance correlative sequence in store
    const assignedReceiptNum = getAndIncrementReceiptNumber(paymentModal.receiptType);

    confirmInvoicePayment({
      invoiceId: paymentModal.invoice?.id,
      workOrderId: paymentModal.workOrder?.id,
      paymentMethod: paymentModal.paymentMethod,
      paymentDestination: paymentModal.paymentDestination,
      receiptNumber: assignedReceiptNum,
      receiptType: paymentModal.receiptType,
      customerDoc: paymentModal.customerDoc,
      customerName: paymentModal.customerName,
      customerAddress: paymentModal.customerAddress,
    });

    showAlert("success", `¡Cobro de S/ ${paymentModal.grandTotal.toFixed(2)} registrado con ${paymentModal.receiptType} ${assignedReceiptNum}!`);

    // Prepare active receipt modal for immediate print / download
    const currentWo = paymentModal.workOrder;
    const currentInv = paymentModal.invoice;
    const currentTotal = paymentModal.grandTotal;
    const currentItems = paymentModal.breakdownItems;
    const currentMethod = paymentModal.paymentMethod;
    const currentDoc = paymentModal.customerDoc;
    const currentName = paymentModal.customerName;
    const currentAddress = paymentModal.customerAddress;
    const currentType = paymentModal.receiptType;
    const currentObs = paymentModal.observations;

    setPaymentModal(null);

    // Open Thermal Receipt modal for printing
    setActiveReceiptModal({
      isOpen: true,
      workOrder: currentWo,
      invoice: currentInv,
      receiptType: currentType,
      receiptNumber: assignedReceiptNum,
      customerDoc: currentDoc,
      customerName: currentName,
      customerAddress: currentAddress,
      plate: currentWo?.vehicle_plate,
      observations: currentObs,
      grandTotal: currentTotal,
      items: currentItems,
      paymentMethod: currentMethod,
      issuedAt: new Date().toISOString(),
    });
  };

  // Open receipt viewer from card
  const handleOpenReceiptViewer = (wo: any, inv?: any, total: number = 0) => {
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
    const rType = ((inv?.receipt_type as any) || (inv?.receipt_number?.startsWith("F") ? "Factura" : inv?.receipt_number?.startsWith("B") ? "Boleta" : "Ticket")) as "Ticket" | "Boleta" | "Factura";

    let rNum = inv?.receipt_number || "";
    if (!rNum || rNum === "0" || rNum.toLowerCase() === "s/n") {
      rNum = "S/N";
    }

    setActiveReceiptModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      receiptType: rType,
      receiptNumber: rNum,
      customerDoc: inv?.customer_doc || (rType === "Factura" ? "20600000000" : "00000000"),
      customerName: inv?.client_name || vehicle?.owner_name || (rType === "Ticket" ? "CLIENTES VARIOS" : "Cliente"),
      customerAddress: inv?.customer_address || "-",
      plate: wo.vehicle_plate,
      observations: inv?.observations || wo.observations || "",
      grandTotal: total,
      paymentMethod: inv?.payment_method || "Efectivo",
      issuedAt: inv?.issued_at || wo.entry_time || new Date().toISOString(),
    });
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

        {/* Cash Closure Summary Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Recaudado en la fecha */}
          <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-3">
            <Coins className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Recaudado ({queryDate === new Date().toISOString().slice(0, 10) ? "Hoy" : queryDate})
              </span>
              <span className="text-xl font-black text-emerald-400">S/ {totalPaidToday.toFixed(2)}</span>
            </div>
          </div>

          {/* 2. Por Cobrar / Pendiente en la fecha */}
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold block">
                Por Cobrar ({queryDate === new Date().toISOString().slice(0, 10) ? "Hoy" : queryDate})
              </span>
              <span className="text-xl font-black text-amber-400">
                S/ {totalPendingToday.toFixed(2)} <span className="text-xs font-normal text-amber-300/80">({pendingCountToday})</span>
              </span>
            </div>
          </div>

          {/* 3. Total General Pendientes */}
          <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <span className="text-[10px] text-red-300 uppercase font-bold block">Total Pendientes Histórico</span>
              <span className="text-xl font-black text-red-400">{pendingCount} Vehículos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-reygas-dark p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Control de Comprobantes ({allBillingWorkOrders.length} registros en total)</span>
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
              className="w-full sm:w-48 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400"
            />
          </div>

          <MiniDatePicker
            value={queryDate}
            onChange={(newDate) => setQueryDate(newDate)}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CAJA & COBROS DE COMPROBANTES */}
      {/* ========================================================================= */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Comprobantes y Liquidación de Taller</h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-reygas-dark p-1 rounded-xl border border-white/10 text-xs font-bold">
              {/* 1. Comprobantes del Día (Principal / Default) */}
              <button
                onClick={() => setActiveStatusFilter("hoy")}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeStatusFilter === "hoy"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 font-black scale-[1.02]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>📅 Del Día / Hoy ({todayCount})</span>
              </button>

              {/* 2. Pendientes */}
              <button
                onClick={() => setActiveStatusFilter("pendientes")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pendientes"
                    ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20 scale-[1.02]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>⏳ Pendientes ({pendingCount})</span>
              </button>

              {/* 3. Pagados */}
              <button
                onClick={() => setActiveStatusFilter("pagados")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pagados"
                    ? "bg-emerald-600 text-white font-extrabold shadow-lg shadow-emerald-600/20 scale-[1.02]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>✅ Pagados ({paidCount})</span>
              </button>

              {/* 4. Todos */}
              <button
                onClick={() => setActiveStatusFilter("todos")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "todos"
                    ? "bg-gray-700 text-white font-bold shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>Todos ({allBillingWorkOrders.length})</span>
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
            <>
              <div className="grid grid-cols-1 gap-4">
              {filteredCajaOrders.slice(0, visibleLimit).map((wo) => {
                const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
                const tech = wo.assigned_technician_id ? techniciansById.get(wo.assigned_technician_id) : undefined;
                const invoice = invoicesByWorkOrderId.get(wo.id);
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
                        ) : settledInfo?.hasCredit || (invoice?.credit_amount || 0) > 0 || (!isPaid && grandTotal > 0) ? (
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
                          <button
                            onClick={() => handleOpenReceiptViewer(wo, invoice, grandTotal)}
                            className="px-3.5 py-2 rounded-xl bg-blue-950/60 text-blue-300 hover:bg-blue-900/80 border border-blue-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow hover:scale-105"
                            title="Visualizar o Imprimir Comprobante Térmico / PDF"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span>Ver Comprobante ({invoice?.receipt_number && invoice.receipt_number !== "0" ? invoice.receipt_number : "S/N"})</span>
                          </button>

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

            {filteredCajaOrders.length > visibleLimit && (
              <div className="pt-4 text-center">
                <button
                  onClick={() => setVisibleLimit((prev) => prev + 30)}
                  className="px-6 py-3 bg-reygas-surface hover:bg-gray-700 text-amber-400 font-bold text-sm rounded-2xl border border-amber-500/30 shadow-lg transition-all touch-target inline-flex items-center gap-2"
                >
                  <span>Mostrar más comprobantes (+30)</span>
                  <span className="text-xs text-gray-400 font-mono">
                    (Mostrando {visibleLimit} de {filteredCajaOrders.length})
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MANDATORY PAYMENT CONFIRMATION MODAL WITH ITEM BREAKDOWN & RUC/DNI */}
      {/* ========================================================================= */}
      {paymentModal && paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl glass-panel bg-reygas-dark border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-500/10 space-y-5 max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Confirmación y Emisión de Cobro</h3>
                  <p className="text-xs text-gray-400">
                    Vehículo: <strong className="text-white font-mono">{paymentModal.workOrder?.vehicle_plate}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaymentSubmit} className="space-y-4">
              {/* Service & Items Breakdown Table */}
              <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between items-center border-b border-white/10 pb-1.5 text-[11px] font-bold text-amber-400 uppercase">
                  <span>Detalle de Servicios & Repuestos a Cobrar</span>
                  <span className="font-mono text-white">Placa: {paymentModal.workOrder?.vehicle_plate}</span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-white/5 pr-1">
                  {paymentModal.breakdownItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs pt-1">
                      <span className="text-gray-300">
                        {it.description} <strong className="text-gray-400 font-mono">(x{it.quantity})</strong>
                      </span>
                      <span className="font-mono font-bold text-white">
                        S/ {it.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-2 flex justify-between items-center font-bold text-xs">
                  <span className="text-gray-300">MONTO TOTAL A COBRAR:</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    S/ {paymentModal.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Receipt Type Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  1. Tipo de Comprobante a Emitir *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Ticket", "Boleta", "Factura"] as const).map((type) => {
                    const isSelected = paymentModal.receiptType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const nextNum = getCorrelativePreview(type);
                          setPaymentModal({
                            ...paymentModal,
                            receiptType: type,
                            receiptNumber: nextNum,
                            customerName:
                              type === "Ticket" && !paymentModal.customerName
                                ? "CLIENTES VARIOS"
                                : paymentModal.customerName,
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                            : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                        }`}
                      >
                        <span>{type === "Ticket" ? "🎟️" : type === "Boleta" ? "🧾" : "📑"}</span>
                        <span>{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Inputs according to Receipt Type */}
              <div className="p-3.5 bg-reygas-surface/60 rounded-2xl border border-white/10 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-bold uppercase text-[11px]">
                    Correlativo Asignado:
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {paymentModal.receiptNumber}
                  </span>
                </div>

                {/* Boleta DNI */}
                {paymentModal.receiptType === "Boleta" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-300 block mb-1 font-bold">DNI del Cliente (8 dígitos):</label>
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="Ej: 72137177"
                        value={paymentModal.customerDoc}
                        onChange={(e) =>
                          setPaymentModal({ ...paymentModal, customerDoc: e.target.value.replace(/\D/g, "") })
                        }
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 block mb-1 font-bold">Nombres y Apellidos:</label>
                      <input
                        type="text"
                        placeholder="Ej: Fernando García"
                        value={paymentModal.customerName}
                        onChange={(e) => setPaymentModal({ ...paymentModal, customerName: e.target.value })}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                {/* Factura RUC & Consulta RUC */}
                {paymentModal.receiptType === "Factura" && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-gray-300 block mb-1 font-bold">
                        RUC de la Empresa (11 dígitos) *:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={11}
                          placeholder="Ej: 20600982860"
                          value={paymentModal.customerDoc}
                          onChange={(e) =>
                            setPaymentModal({ ...paymentModal, customerDoc: e.target.value.replace(/\D/g, "") })
                          }
                          className="flex-1 px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-purple-400 font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleLookupRuc}
                          disabled={paymentModal.isSearchingRuc}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shrink-0"
                        >
                          {paymentModal.isSearchingRuc ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SearchCheck className="w-4 h-4" />
                          )}
                          <span>Consultar RUC</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-300 block mb-1 font-bold">Razón Social:</label>
                      <input
                        type="text"
                        placeholder="Razón Social de la Empresa"
                        value={paymentModal.customerName}
                        onChange={(e) => setPaymentModal({ ...paymentModal, customerName: e.target.value })}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-purple-400 font-bold uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-gray-300 block mb-1 font-bold">Dirección Fiscal:</label>
                      <input
                        type="text"
                        placeholder="Dirección Fiscal"
                        value={paymentModal.customerAddress}
                        onChange={(e) => setPaymentModal({ ...paymentModal, customerAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-purple-400 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Ticket Cliente */}
                {paymentModal.receiptType === "Ticket" && (
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Nombre del Cliente / Receptor:</label>
                    <input
                      type="text"
                      placeholder="CLIENTES VARIOS"
                      value={paymentModal.customerName}
                      onChange={(e) => setPaymentModal({ ...paymentModal, customerName: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Payment Method (Obligatorio) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Método de Pago *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Efectivo", "Yape", "Transferencia", "Culqi"] as const).map((method) => {
                    const isSelected = paymentModal.paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentModal({ ...paymentModal, paymentMethod: method })}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
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
                  <span>3. Destino del Pago / Responsable *</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={paymentModal.paymentDestination}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentDestination: e.target.value })}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs font-bold text-white focus:border-emerald-400"
                  >
                    {eligibleDestinations.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest === "EMPRESA" ? "🏢 EMPRESA (Cuenta Principal / Caja)" : `👤 ${dest}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Observaciones en el Comprobante (Concepto adicional escrito por el cajero) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  4. Observaciones en Comprobante (Opcional / Concepto libre)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mantenimiento y calibración de gas / Pago a cuenta"
                  value={paymentModal.observations}
                  onChange={(e) => setPaymentModal({ ...paymentModal, observations: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400"
                />
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
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar, Cobrar e Imprimir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THERMAL 80MM RECEIPT VIEWER / PRINT MODAL */}
      {/* ========================================================================= */}
      {activeReceiptModal && (
        <ThermalReceiptModal
          isOpen={activeReceiptModal.isOpen}
          onClose={() => setActiveReceiptModal(null)}
          workOrder={activeReceiptModal.workOrder}
          invoice={activeReceiptModal.invoice}
          receiptType={activeReceiptModal.receiptType}
          receiptNumber={activeReceiptModal.receiptNumber}
          customerDoc={activeReceiptModal.customerDoc}
          customerName={activeReceiptModal.customerName}
          customerAddress={activeReceiptModal.customerAddress}
          plate={activeReceiptModal.plate}
          observations={activeReceiptModal.observations}
          grandTotal={activeReceiptModal.grandTotal}
          items={activeReceiptModal.items}
          discountAmount={activeReceiptModal.discountAmount}
          paymentMethod={activeReceiptModal.paymentMethod}
          issuedAt={activeReceiptModal.issuedAt}
        />
      )}
    </div>
  );
}

