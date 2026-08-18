"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAppStore, PaymentSplit } from "@/lib/store/app-store";
import {
  buildVehicleCreditSettlementMap,
  parseSplitPaymentString,
} from "@/lib/utils/credit-tracker";
import { getWorkshopCSVRecord, WORKSHOP_CSV_LOOKUP } from "@/lib/workshop-csv-lookup";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import { getPeruDateString, formatPeruDateTime, formatPeruDate, buildPeruISOString } from "@/lib/utils/date-utils";
import { formatPlate, titleCase, capitalizeFirst } from "@/lib/utils/text-format";
import {
  CreditCard,
  TrendingUp,
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
  SearchCheck,
  Plus,
  Wrench,
  Fuel,
  Car,
  Phone,
  User,
  Gauge,
  Sparkles,
  Trash2,
  Split,
  Check,
} from "lucide-react";

const ThermalReceiptModal = dynamic(
  () => import("@/components/caja/thermal-receipt-modal"),
  { ssr: false }
);
const DailyWorkshopReportModal = dynamic(
  () => import("@/components/DailyWorkshopReportModal").then((m) => m.DailyWorkshopReportModal),
  { ssr: false }
);

export default function CajaPage() {
  const { notify } = useAppStore();
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    correlativeConfig,
    updateCorrelativeConfig,
    getAndIncrementReceiptNumber,
    createInvoiceForOrder,
    togglePayInvoice,
    toggleOrderPayment,
    undoLastPayment,
    confirmInvoicePayment,
    registerDirectWorkshopPayment,
    registerInvoicePayment,
    toggleAllowModificationsInWorkshop,
  } = useAppStore();

  // Configuración: si está permitido editar el N° de ticket/boleta/factura al confirmar el pago
  const allowEditReceiptNumber = correlativeConfig?.allowEditReceiptNumber !== false;

  const [activeMainTab, setActiveMainTab] = useState<"caja" | "consultas">("caja");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"hoy" | "pendientes" | "pagados" | "todos">("hoy");
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<"TODOS" | "Ticket" | "Boleta" | "Factura">("TODOS");

  // Search Filters
  const [searchPlate, setSearchPlate] = useState("");
  const deferredSearchPlate = React.useDeferredValue(searchPlate);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"todos" | "pendientes" | "pagados">("todos");
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [queryDate, setQueryDate] = useState<string>(getPeruDateString()); // Default today in Peru

  // Reset pagination on search or tab change
  React.useEffect(() => {
    setVisibleLimit(30);
  }, [deferredSearchPlate, activeStatusFilter, receiptTypeFilter]);

  // Modal State for Mandatory Payment Confirmation
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    workOrder: any;
    invoice: any;
    grandTotal: number;
    breakdownItems: Array<{ description: string; quantity: number; unit_price: number; subtotal: number }>;
    discountAmount: number;
    paymentMethod: string;
    paymentDestination: string;
    isSplitPayment?: boolean;
    paymentSplits?: PaymentSplit[];
    splitTicketMode?: "single" | "perMethod";
    receiptNumber: string;
    receiptType: "Ticket" | "Boleta" | "Factura" | "Sin Comprobante";
    customerDoc: string;
    customerName: string;
    customerAddress: string;
    observations: string;
    isSearchingRuc?: boolean;
  } | null>(null);

  // Modal State for Partial / Installment Payment (Abonos sobre saldo pendiente por placa)
  const [partialPaymentModal, setPartialPaymentModal] = useState<{
    isOpen: boolean;
    workOrder: any;
    invoice: any;
    totalDue: number;            // Saldo total pendiente de la factura
    paidSoFar: number;           // Monto ya abonado (historial)
    amount: number;              // Abono de este pago (total o parcial)
    paymentMethod: string;
    paymentDestination: string;
    isSplitPayment?: boolean;
    paymentSplits?: PaymentSplit[];
    splitTicketMode?: "single" | "perMethod";
    receiptNumber: string;
    receiptType: "Ticket" | "Boleta" | "Factura" | "Sin Comprobante";
    customerDoc: string;
    customerName: string;
    customerAddress: string;
    observation?: string;        // Observación del saldo pendiente / abono
    responsible?: string;        // Responsable del saldo pendiente (FRANCO, JAIME, ...)
  } | null>(null);

  // Modal State for Manual / Direct Payment Confirmation (Registro Taller)
  const [manualPaymentModal, setManualPaymentModal] = useState<{
    isOpen: boolean;
    entryDate: string;
    entryTime: string;
    quinquennialDate: string;
    chipExpiryDate: string;
    vehicleType: string;
    fuelType: "GNV" | "GLP" | "Gasolina" | "Bifuel";
    brand: string;
    currentMileage: number;
    vehiclePlate: string;
    receiptNumber: string;
    receiptType: "Ticket" | "Boleta" | "Factura" | "Sin Comprobante";
    clientName: string;
    clientPhone: string;
    customerDoc: string;
    customerAddress: string;
    technicianName: string;
    maintenanceService: string;
    sparePartsServices: string;
    price: number;
    discounts: string;
    creditAmount: number;
    paymentCondition: "PAGADO" | "CREDITO" | "PENDIENTE";
    paymentMethod: string;
    paymentDestination: string;
    isSplitPayment?: boolean;
    paymentSplits?: PaymentSplit[];
    splitTicketMode?: "single" | "perMethod";
    isSearchingRuc?: boolean;
    debtObservation?: string;  // Observación del saldo pendiente (si condición CREDITO/PENDIENTE)
    debtResponsible?: string;  // Responsable del saldo pendiente (si condición CREDITO/PENDIENTE)
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
    paymentBreakdown?: PaymentSplit[];
    issuedAt?: string;
  } | null>(null);


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

  // List of eligible payment destinations: EMPRESA + ONLY staff with can_receive_payment enabled
  const eligibleDestinations = React.useMemo(() => {
    const list = ["EMPRESA", "CAJA"];
    const seen = new Set<string>(["EMPRESA", "CAJA"]);

    (technicians || [])
      .filter((t) => {
        const isActive = t.is_active !== false;
        const canReceive = t.can_receive_payment === true || (t.can_receive_payment as any) === "true" || (t.can_receive_payment as any) === 1;
        return isActive && canReceive;
      })
      .forEach((t) => {
        const name = (t.full_name || "").trim().toUpperCase();
        if (name && !seen.has(name)) {
          seen.add(name);
          list.push(name);
        }
      });

    // If currently open modal has a destination, preserve it
    const currentDest = paymentModal?.paymentDestination?.trim().toUpperCase();
    if (currentDest && currentDest !== "NINGUNO" && !seen.has(currentDest)) {
      seen.add(currentDest);
      list.push(currentDest);
    }
    const manualDest = manualPaymentModal?.paymentDestination?.trim().toUpperCase();
    if (manualDest && manualDest !== "NINGUNO" && !seen.has(manualDest)) {
      seen.add(manualDest);
      list.push(manualDest);
    }

    return list;
  }, [technicians, paymentModal?.paymentDestination, manualPaymentModal?.paymentDestination]);

  // Personal habilitado como RESPONSABLE DEL SALDO PENDIENTE (flag is_debt_responsible + activo)
  const debtResponsibles = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    (technicians || [])
      .filter((t) => {
        const isActive = t.is_active !== false;
        const isDebtResp = t.is_debt_responsible === true || (t.is_debt_responsible as any) === "true" || (t.is_debt_responsible as any) === 1;
        return isActive && isDebtResp;
      })
      .forEach((t) => {
        const name = (t.full_name || "").trim().toUpperCase();
        if (name && !seen.has(name)) {
          seen.add(name);
          list.push(name);
        }
      });

    // Preservar el responsable ya asignado en el modal abierto (aunque ya no esté en la lista)
    const preserve = (current?: string) => {
      const cur = (current || "").trim().toUpperCase();
      if (cur && cur !== "NINGUNO" && !seen.has(cur)) {
        seen.add(cur);
        list.push(cur);
      }
    };
    preserve(partialPaymentModal?.responsible);
    preserve(manualPaymentModal?.debtResponsible);

    return list;
  }, [technicians, partialPaymentModal?.responsible, manualPaymentModal?.debtResponsible]);

  // Cross-order credit settlement index (matches earlier credits with subsequent debt cancellations)
  const creditSettlementMap = React.useMemo(() => {
    return buildVehicleCreditSettlementMap(workOrders, invoicesByWorkOrderId);
  }, [workOrders, invoicesByWorkOrderId]);

  // Comprehensive, real-time function to determine if order is paid or pending credit
  const isOrderPaid = React.useCallback((wo: any, inv?: any) => {
    if (!wo && !inv) return false;

    // 0. Explicit payment status flags have HIGHEST priority (user action)
    if (inv?.payment_status === "pendiente" || wo?.status === "por_cobrar" || wo?.status === "pendiente_pago") {
      return false;
    }

    if (inv?.payment_status === "pagado" || wo?.status === "pagado_autorizado" || wo?.status === "finalizado") {
      return true;
    }

    // 1. If credit was settled/paid in a subsequent debt cancellation visit -> Paid!
    const settledInfo = creditSettlementMap.settledOrdersMap.get(wo.id);
    if (settledInfo?.isSettled) return true;

    // 2. Condition from CSV or credit record
    const condition = (inv?.payment_condition || "").toUpperCase().trim();
    const hasCredit = (inv?.credit_amount || 0) > 0;

    if (condition.includes("PENDIENTE") || condition.includes("CREDIT") || hasCredit) {
      return false;
    }

    if (condition.includes("PAGADO") && !hasCredit) {
      return true;
    }

    // 3. If grandTotal is 0 and no credit amount -> Fully covered / paid (warranty/courtesy)
    const grandTotal = inv?.grand_total !== undefined ? inv.grand_total : (wo?.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    if (grandTotal === 0 && !hasCredit) {
      return true;
    }

    // 4. If there is a receipt number and no credit -> Paid
    const receiptNum = (inv?.receipt_number || "").trim();
    if (receiptNum && receiptNum !== "0" && !hasCredit) {
      return true;
    }

    return false;
  }, [creditSettlementMap]);

  // Helper to compute correct Net Total considering Taller discount_amount and Invoice
  const computeOrderNetTotal = React.useCallback((wo: any, inv?: any) => {
    const partsSum = (wo.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    const certFee = wo.requires_certification ? (wo.certification_price || 0) : 0;
    const gross = partsSum + certFee;
    const discount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);

    if (inv?.grand_total !== undefined && inv.grand_total > 0 && (!wo.discount_amount || inv.discounts === wo.discount_amount)) {
      return inv.grand_total;
    }
    return Math.max(0, gross - discount);
  }, []);

  // Orders that reached billing or have an invoice registered
  const allBillingWorkOrders = React.useMemo(() => {
    return workOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const total = computeOrderNetTotal(wo, inv);
      const hasItems = (wo.items || []).length > 0;
      const receiptNum = (inv?.receipt_number || "").trim();
      const hasReceipt = receiptNum && receiptNum !== "0";
      const isPaid = isOrderPaid(wo, inv);

      // Include if it's a valid billing order (has items or price or receipt) OR if it is pending payment
      return total > 0 || hasItems || hasReceipt || !isPaid;
    });
  }, [workOrders, invoicesByWorkOrderId, isOrderPaid, computeOrderNetTotal]);

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
        const total = computeOrderNetTotal(wo, inv);
        return sum + total;
      }, 0);
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid, computeOrderNetTotal]);

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
          : computeOrderNetTotal(wo, inv);
        return sum + credit;
      }, 0);
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid, computeOrderNetTotal]);

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
    const targetDate = queryDate || getPeruDateString();
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
      const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";
      return orderDateStr === targetDate || invoiceDateStr === targetDate || paidDateStr === targetDate;
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate]);

  // Saldos pendientes por placa: monto total, ya abonado (historial) y saldo restante.
  // Es la fuente para el cobro de saldo total / pago parcial buscando por placa.
  const pendingBalances = React.useMemo(() => {
    const list: Array<{
      wo: any;
      invoice: any;
      totalDue: number;
      paidSoFar: number;
      balance: number;
    }> = [];
    allBillingWorkOrders.forEach((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      if (isOrderPaid(wo, inv)) return;
      const totalDue = computeOrderNetTotal(wo, inv);
      const history: Array<{ amount?: number }> = Array.isArray(inv?.payment_history)
        ? inv.payment_history
        : [];
      const paidSoFar = history.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      // Si hay credit_amount explícito, es el saldo real; si no, el total menos abonado
      const balance = (inv?.credit_amount && inv.credit_amount > 0)
        ? Number(inv.credit_amount)
        : Math.max(0, totalDue - paidSoFar);
      if (balance <= 0.01) return;
      list.push({ wo, invoice: inv, totalDue, paidSoFar, balance });
    });
    return list;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, isOrderPaid, computeOrderNetTotal]);

  const totalPendingBalances = React.useMemo(() => {
    return pendingBalances.reduce((s, p) => s + p.balance, 0);
  }, [pendingBalances]);

  // Helper to extract numeric correlative from a receipt string
  const parseReceiptNumber = (raw?: string) => {
    if (!raw) return 0;
    const clean = raw.replace(/[^0-9]/g, "");
    return parseInt(clean, 10) || 0;
  };

  // Maximum correlative present in the workshop register (tabla "registro taller" / CSV) per receipt type
  const workshopMaxCorrelative = React.useMemo(() => {
    const max = { Ticket: 0, Boleta: 0, Factura: 0 };
    for (const key in WORKSHOP_CSV_LOOKUP) {
      if (key.startsWith("REC_")) continue;
      const rec = WORKSHOP_CSV_LOOKUP[key];
      const numStr = String(rec.receiptNumber || "").trim();
      if (!numStr || numStr === "0") continue;
      const clean = parseInt(numStr.replace(/\D/g, ""), 10);
      if (isNaN(clean) || clean >= 99999999) continue;
      const rt = String(rec.receiptType || "").toUpperCase();
      if (rt.includes("FACTURA")) {
        if (clean > max.Factura) max.Factura = clean;
      } else if (rt.includes("BOLETA")) {
        if (clean > max.Boleta) max.Boleta = clean;
      } else if (rt.includes("TICKET")) {
        if (clean > max.Ticket) max.Ticket = clean;
      }
    }
    return max;
  }, []);

  // Calculate latest registered correlatives from invoices and fallback config
  const latestCorrelatives = React.useMemo(() => {
    const config = correlativeConfig || {
      ticketSeries: "TK01",
      ticketLastNumber: 4545,
      boletaSeries: "B001",
      boletaLastNumber: 259,
      facturaSeries: "F001",
      facturaLastNumber: 282,
    };

    // 1. Tickets
    const ticketInvoices = invoices.filter(
      (inv) =>
        inv.receipt_number &&
        inv.receipt_number !== "0" &&
        ((inv.receipt_type && inv.receipt_type.toLowerCase().includes("ticket")) ||
          inv.receipt_number.toUpperCase().startsWith("TK") ||
          inv.receipt_number.toUpperCase().startsWith("T"))
    );
    const sortedTickets = [...ticketInvoices].sort((a, b) => {
      const numA = parseReceiptNumber(a.receipt_number);
      const numB = parseReceiptNumber(b.receipt_number);
      if (numB !== numA) return numB - numA;
      return (b.paid_at || b.issued_at || "").localeCompare(a.paid_at || a.issued_at || "");
    });
    const lastTicket = sortedTickets[0];

    // 2. Boletas
    const boletaInvoices = invoices.filter(
      (inv) =>
        inv.receipt_number &&
        inv.receipt_number !== "0" &&
        ((inv.receipt_type && inv.receipt_type.toLowerCase().includes("boleta")) ||
          inv.receipt_number.toUpperCase().startsWith("B"))
    );
    const sortedBoletas = [...boletaInvoices].sort((a, b) => {
      const numA = parseReceiptNumber(a.receipt_number);
      const numB = parseReceiptNumber(b.receipt_number);
      if (numB !== numA) return numB - numA;
      return (b.paid_at || b.issued_at || "").localeCompare(a.paid_at || a.issued_at || "");
    });
    const lastBoleta = sortedBoletas[0];

    // 3. Facturas
    const facturaInvoices = invoices.filter(
      (inv) =>
        inv.receipt_number &&
        inv.receipt_number !== "0" &&
        ((inv.receipt_type && inv.receipt_type.toLowerCase().includes("factura")) ||
          inv.receipt_number.toUpperCase().startsWith("F"))
    );
    const sortedFacturas = [...facturaInvoices].sort((a, b) => {
      const numA = parseReceiptNumber(a.receipt_number);
      const numB = parseReceiptNumber(b.receipt_number);
      if (numB !== numA) return numB - numA;
      return (b.paid_at || b.issued_at || "").localeCompare(a.paid_at || a.issued_at || "");
    });
    const lastFactura = sortedFacturas[0];

    // If no invoice exists in Supabase yet, the last effective correlative is the maximum
    // between the manually configured number and the highest found in the workshop register (CSV).
    const effectiveTicketBase = Math.max(Number(config.ticketLastNumber) || 0, workshopMaxCorrelative.Ticket);
    const effectiveBoletaBase = Math.max(Number(config.boletaLastNumber) || 0, workshopMaxCorrelative.Boleta);
    const effectiveFacturaBase = Math.max(Number(config.facturaLastNumber) || 0, workshopMaxCorrelative.Factura);

    return {
      ticket: {
        number: lastTicket?.receipt_number || `${config.ticketSeries || "TK01"}-${effectiveTicketBase.toString().padStart(8, "0")}`,
        plate: lastTicket?.vehicle_plate || "",
        client: lastTicket?.client_name || "",
        total: lastTicket?.grand_total,
        date: lastTicket?.paid_at || lastTicket?.issued_at,
        count: ticketInvoices.length,
      },
      boleta: {
        number: lastBoleta?.receipt_number || `${config.boletaSeries || "B001"}-${effectiveBoletaBase.toString().padStart(8, "0")}`,
        plate: lastBoleta?.vehicle_plate || "",
        client: lastBoleta?.client_name || "",
        total: lastBoleta?.grand_total,
        date: lastBoleta?.paid_at || lastBoleta?.issued_at,
        count: boletaInvoices.length,
      },
      factura: {
        number: lastFactura?.receipt_number || `${config.facturaSeries || "F001"}-${effectiveFacturaBase.toString().padStart(8, "0")}`,
        plate: lastFactura?.vehicle_plate || "",
        client: lastFactura?.client_name || "",
        total: lastFactura?.grand_total,
        date: lastFactura?.paid_at || lastFactura?.issued_at,
        count: facturaInvoices.length,
      },
    };
  }, [invoices, correlativeConfig, workshopMaxCorrelative]);

  // Filtered orders for Caja Tab (Pending payments first, then newest entry_time)
  const filteredCajaOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";
    const targetDate = queryDate || getPeruDateString();

    const filtered = allBillingWorkOrders.filter((wo) => {
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

      let matchReceiptType = true;
      if (receiptTypeFilter !== "TODOS") {
        const rType = (inv?.receipt_type || "").toLowerCase();
        const rNum = (inv?.receipt_number || "").toUpperCase();
        if (receiptTypeFilter === "Ticket") {
          matchReceiptType = rType.includes("ticket") || rNum.startsWith("TK") || rNum.startsWith("T");
        } else if (receiptTypeFilter === "Boleta") {
          matchReceiptType = rType.includes("boleta") || rNum.startsWith("B");
        } else if (receiptTypeFilter === "Factura") {
          matchReceiptType = rType.includes("factura") || rNum.startsWith("F");
        }
      }

      return matchPlate && matchStatus && matchReceiptType;
    });

    // Priority Sort: Pendientes de pago first, then newest entry_time descending
    return filtered.sort((a, b) => {
      const invA = invoicesByWorkOrderId.get(a.id);
      const invB = invoicesByWorkOrderId.get(b.id);
      const paidA = isOrderPaid(a, invA);
      const paidB = isOrderPaid(b, invB);

      if (!paidA && paidB) return -1;
      if (paidA && !paidB) return 1;

      const timeA = a.entry_time || "";
      const timeB = b.entry_time || "";
      return timeB.localeCompare(timeA);
    });
  }, [allBillingWorkOrders, invoicesByWorkOrderId, deferredSearchPlate, activeStatusFilter, receiptTypeFilter, isOrderPaid, queryDate]);

  // Filtered orders for Consultas (Historical Query by Selected Date) Tab
  const filteredConsultasOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";

    const filtered = allBillingWorkOrders.filter((wo) => {
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

      let matchReceiptType = true;
      if (receiptTypeFilter !== "TODOS") {
        const rType = (inv?.receipt_type || "").toLowerCase();
        const rNum = (inv?.receipt_number || "").toUpperCase();
        if (receiptTypeFilter === "Ticket") {
          matchReceiptType = rType.includes("ticket") || rNum.startsWith("TK") || rNum.startsWith("T");
        } else if (receiptTypeFilter === "Boleta") {
          matchReceiptType = rType.includes("boleta") || rNum.startsWith("B");
        } else if (receiptTypeFilter === "Factura") {
          matchReceiptType = rType.includes("factura") || rNum.startsWith("F");
        }
      }

      return matchPlate && matchDate && matchReceiptType;
    });

    // Priority Sort: Pendientes de pago first, then newest entry_time descending
    return filtered.sort((a, b) => {
      const invA = invoicesByWorkOrderId.get(a.id);
      const invB = invoicesByWorkOrderId.get(b.id);
      const paidA = isOrderPaid(a, invA);
      const paidB = isOrderPaid(b, invB);

      if (!paidA && paidB) return -1;
      if (paidA && !paidB) return 1;

      const timeA = a.entry_time || "";
      const timeB = b.entry_time || "";
      return timeB.localeCompare(timeA);
    });
  }, [allBillingWorkOrders, invoicesByWorkOrderId, deferredSearchPlate, receiptTypeFilter, queryDate, isOrderPaid]);

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
      const base = Math.max(Number(config.facturaLastNumber) || 0, workshopMaxCorrelative.Factura);
      return `${config.facturaSeries || "F001"}-${(base + 1).toString().padStart(8, "0")}`;
    } else if (type === "Boleta") {
      const base = Math.max(Number(config.boletaLastNumber) || 0, workshopMaxCorrelative.Boleta);
      return `${config.boletaSeries || "B001"}-${(base + 1).toString().padStart(8, "0")}`;
    } else {
      const base = Math.max(Number(config.ticketLastNumber) || 0, workshopMaxCorrelative.Ticket);
      return `${config.ticketSeries || "TK01"}-${(base + 1).toString().padStart(8, "0")}`;
    }
  };

  // Increment a correlative string like "TK01-00000455" -> "TK01-00000456"
  const incrementReceiptNumber = (num: string): string => {
    const parts = String(num || "").split("-");
    const numPart = parseInt(parts.length > 1 ? parts[1] : parts[0], 10);
    const next = isNaN(numPart) ? 1 : numPart + 1;
    if (parts.length > 1) {
      const digits = parts[1] || "";
      const pad = digits.length >= 8 ? digits.length : 8;
      return parts[0] + "-" + String(next).padStart(pad, "0");
    }
    return String(next).padStart(8, "0");
  };

  // Advance the correlative config to the MAX number actually used (mixed multi-ticket)
  const advanceCorrelativeToMax = (type: "Ticket" | "Boleta" | "Factura", numbers: Array<string | undefined>) => {
    let maxNum = -1;
    let series = "";
    for (const n of numbers) {
      const parts = String(n || "").split("-");
      const numPart = parseInt(parts.length > 1 ? parts[1] : parts[0], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
        if (parts.length > 1) series = parts[0];
      }
    }
    if (maxNum < 0) return;
    const typeKey = type === "Factura" ? "facturaLastNumber" : (type === "Boleta" ? "boletaLastNumber" : "ticketLastNumber");
    const seriesKey = type === "Factura" ? "facturaSeries" : (type === "Boleta" ? "boletaSeries" : "ticketSeries");
    updateCorrelativeConfig({
      [typeKey]: maxNum,
      ...(series ? { [seriesKey]: series } : {}),
      lastUpdateDate: queryDate || getPeruDateString(),
    });
  };

  // Stamp every split with a sequential ticket number starting from `base`
  const stampSplitTicketNumbers = (
    splits: PaymentSplit[],
    base: string,
    type: "Ticket" | "Boleta" | "Factura"
  ): PaymentSplit[] => {
    let cursor = base || getCorrelativePreview(type);
    return splits.map((s, i) => {
      const existing = s.receipt_number && String(s.receipt_number).trim();
      const num = i === 0 ? (existing || cursor) : (existing || incrementReceiptNumber(cursor));
      cursor = num;
      return { ...s, receipt_number: num, receipt_type: type };
    });
  };

  // Handle open payment confirmation modal
  const handleOpenPaymentModal = (wo: any, inv?: any, total: number = 0) => {
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());

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

    const isZero = total === 0;
    const initialType = (isZero ? "Sin Comprobante" : "Ticket") as "Ticket" | "Boleta" | "Factura" | "Sin Comprobante";
    const previewNum = isZero
      ? ""
      : inv?.receipt_number && inv.receipt_number !== "0" && inv.receipt_number.toLowerCase() !== "s/n"
        ? inv.receipt_number
        : getCorrelativePreview(initialType as any);

    const hasExistingSplits = Array.isArray(inv?.payment_breakdown) && inv.payment_breakdown.length > 1;
    const initialSplits: PaymentSplit[] = (Array.isArray(inv?.payment_breakdown) && inv.payment_breakdown.length > 0)
      ? inv.payment_breakdown.map((s: any, idx: number) => ({
        id: s.id || `split-${Date.now()}-${idx}`,
        method: s.method || "Efectivo",
        destination: s.destination || eligibleDestinations[0] || "EMPRESA",
        amount: typeof s.amount === "number" ? s.amount : Number(s.amount) || 0,
      }))
      : [
        {
          id: `split-1`,
          method: (inv?.payment_method as any) || "Efectivo",
          destination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
          amount: total,
        },
      ];

    const effectiveDiscount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);

    setPaymentModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      grandTotal: total,
      breakdownItems: breakdown,
      discountAmount: effectiveDiscount,
      paymentMethod: isZero ? "" : (inv?.payment_method as any) || "Efectivo",
      paymentDestination: isZero ? "" : inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
      isSplitPayment: hasExistingSplits,
      paymentSplits: initialSplits,
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
      notify("warning", "Ingrese un RUC válido de 11 dígitos numéricos.");
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
        notify("success", `RUC verificado: ${data.razonSocial}`);
      } else {
        setPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
        notify("warning", data.error || "No se pudo consultar el RUC. Ingréselo manualmente.");
      }
    } catch (err) {
      setPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
      notify("warning", "Error de conexión al consultar RUC.");
    }
  };

  // Submit payment confirmation
  const handleConfirmPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;

    const isZeroAmount = (paymentModal.grandTotal || 0) === 0;
    const isSinComprobante = paymentModal.receiptType === "Sin Comprobante";

    if (!isZeroAmount && !paymentModal.isSplitPayment && !paymentModal.paymentMethod && paymentModal.paymentMethod !== "Sin Método") {
      notify("warning", "Debe seleccionar un Método de Pago.");
      return;
    }

    if (!isZeroAmount && !paymentModal.isSplitPayment && !paymentModal.paymentDestination && paymentModal.paymentDestination !== "Ninguno") {
      notify("warning", "Debe seleccionar el Destino del Pago (Personal o Empresa).");
      return;
    }

    if (paymentModal.receiptType === "Factura" && (!paymentModal.customerDoc || paymentModal.customerDoc.length !== 11)) {
      notify("warning", "Para emitir Factura es obligatorio ingresar un RUC de 11 dígitos.");
      return;
    }

    // Process Split Payments vs Single Payment
    let finalMethod = (isZeroAmount && (!paymentModal.paymentMethod || paymentModal.paymentMethod === "Sin Método")) ? "" : (paymentModal.paymentMethod === "Sin Método" ? "" : paymentModal.paymentMethod || "");
    let finalDest = (isZeroAmount && (!paymentModal.paymentDestination || paymentModal.paymentDestination === "Ninguno")) ? "" : (paymentModal.paymentDestination === "Ninguno" ? "" : paymentModal.paymentDestination || "");
    let paymentBreakdown: PaymentSplit[] | undefined = undefined;
    // Pago parcial permitido: si la suma del desglose es menor al total, la diferencia
    // se registra como SALDO PENDIENTE (crédito) en la factura.
    let isPartialSplit = false;
    let paidSplitAmount = 0;

    if (!isZeroAmount && paymentModal.isSplitPayment && paymentModal.paymentSplits && paymentModal.paymentSplits.length > 0) {
      const totalSplits = paymentModal.paymentSplits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (totalSplits > paymentModal.grandTotal + 0.05) {
        notify("warning", `La suma de los pagos parciales (S/ ${totalSplits.toFixed(2)}) no puede exceder el total a cobrar (S/ ${paymentModal.grandTotal.toFixed(2)}).`);
        return;
      }
      // Abono parcial: registrar la diferencia como saldo pendiente
      isPartialSplit = paymentModal.grandTotal - totalSplits > 0.05;
      paidSplitAmount = totalSplits;
      let splits = paymentModal.paymentSplits;
      if (paymentModal.splitTicketMode === "perMethod" && !isSinComprobante) {
        // Pago mixto multi-ticket: cada método lleva su propio TIPO (Ticket/Boleta/Factura) y N° de comprobante
        splits = splits.map((s) => {
          const st = (s.receipt_type === "Boleta" || s.receipt_type === "Factura"
            ? s.receipt_type
            : (paymentModal.receiptType === "Boleta" || paymentModal.receiptType === "Factura" ? paymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
          const num = (s.receipt_number && String(s.receipt_number).trim()) || getCorrelativePreview(st);
          return { ...s, receipt_type: st, receipt_number: num };
        });
        // Avanzar el correlativo al máximo usado, por cada tipo de comprobante emitido
        const typesUsed = Array.from(new Set(splits.map((s) => s.receipt_type))) as Array<"Ticket" | "Boleta" | "Factura">;
        for (const t of typesUsed) {
          advanceCorrelativeToMax(t, splits.filter((s) => s.receipt_type === t).map((s) => s.receipt_number));
        }
      } else {
        // Ticket único: el desglose queda como referencia, sin N° propio por método
        splits = splits.map((s) => ({ ...s, receipt_number: undefined, receipt_type: undefined }));
      }
      paymentBreakdown = splits;
      const methodSummary = paymentModal.paymentSplits.map((p) => `${p.method}: S/ ${(Number(p.amount) || 0).toFixed(2)}`).join(", ");
      finalMethod = `Mixto (${methodSummary})`;
      finalDest = Array.from(new Set(paymentModal.paymentSplits.map((p) => p.destination))).join(" / ");
    }

    // Auto-advance correlative sequence in store and sync to Supabase only if standard receipt type
    let assignedReceiptNum = "";
    if (!isSinComprobante && (paymentModal.receiptType === "Ticket" || paymentModal.receiptType === "Boleta" || paymentModal.receiptType === "Factura")) {
      if (paymentModal.splitTicketMode === "perMethod" && paymentBreakdown && paymentBreakdown.length > 0) {
        // Pago mixto multi-ticket: el N° principal del comprobante es el primer ticket del desglose
        assignedReceiptNum = paymentBreakdown[0].receipt_number || paymentModal.receiptNumber || "";
      } else if (paymentModal.receiptNumber) {
        assignedReceiptNum = paymentModal.receiptNumber;
        const parts = assignedReceiptNum.split("-");
        const numPart = parseInt(parts.length > 1 ? parts[1] : parts[0], 10);
        if (!isNaN(numPart)) {
          const typeKey = paymentModal.receiptType === "Factura" ? "facturaLastNumber" : (paymentModal.receiptType === "Boleta" ? "boletaLastNumber" : "ticketLastNumber");
          const seriesKey = paymentModal.receiptType === "Factura" ? "facturaSeries" : (paymentModal.receiptType === "Boleta" ? "boletaSeries" : "ticketSeries");
          updateCorrelativeConfig({
            [typeKey]: numPart,
            ...(parts.length > 1 ? { [seriesKey]: parts[0] } : {}),
            lastUpdateDate: queryDate || getPeruDateString(),
          });
        }
      } else {
        assignedReceiptNum = getAndIncrementReceiptNumber(paymentModal.receiptType, queryDate || getPeruDateString());
      }
    }

    const finalReceiptType = isSinComprobante
      ? ""
      : (paymentModal.splitTicketMode === "perMethod" && paymentBreakdown && paymentBreakdown.length > 0
          ? (paymentBreakdown[0].receipt_type || paymentModal.receiptType)
          : paymentModal.receiptType);

    const pendingSplitBalance = Math.max(0, Number((paymentModal.grandTotal - paidSplitAmount).toFixed(2)));

    if (isPartialSplit) {
      // Abono parcial desde el modal de cobro: registrar el pago recibido y dejar
      // la diferencia como SALDO PENDIENTE (crédito) en la factura.
      registerInvoicePayment({
        invoiceId: paymentModal.invoice?.id,
        workOrderId: paymentModal.workOrder?.id,
        amount: paidSplitAmount,
        paymentMethod: finalMethod,
        paymentDestination: finalDest,
        receiptNumber: assignedReceiptNum,
        receiptType: finalReceiptType,
        paymentBreakdown: paymentBreakdown,
        observation: paymentModal.observations || undefined,
      });
      notify("success", `¡Abono parcial de S/ ${paidSplitAmount.toFixed(2)} registrado con ${paymentModal.receiptType} ${assignedReceiptNum}! Saldo pendiente: S/ ${pendingSplitBalance.toFixed(2)}`);
    } else {
      confirmInvoicePayment({
        invoiceId: paymentModal.invoice?.id,
        workOrderId: paymentModal.workOrder?.id,
        paymentMethod: finalMethod,
        paymentDestination: finalDest,
        receiptNumber: assignedReceiptNum,
        receiptType: finalReceiptType,
        customerDoc: paymentModal.customerDoc,
        customerName: paymentModal.customerName,
        customerAddress: paymentModal.customerAddress,
        paymentBreakdown: paymentBreakdown,
      });

      notify("success", isZeroAmount
        ? `¡Atención (S/ 0.00) de ${paymentModal.workOrder?.vehicle_plate} confirmada y registrada con éxito!`
        : `¡Cobro de S/ ${paymentModal.grandTotal.toFixed(2)} registrado con ${paymentModal.receiptType} ${assignedReceiptNum}!`);
    }

    // Prepare active receipt modal for immediate print / download only if not Sin Comprobante
    const currentWo = paymentModal.workOrder;
    const currentInv = paymentModal.invoice;
    const currentTotal = isPartialSplit ? paidSplitAmount : paymentModal.grandTotal;
    const currentItems = paymentModal.breakdownItems;
    const currentMethod = finalMethod;
    const currentDoc = paymentModal.customerDoc;
    const currentName = paymentModal.customerName;
    const currentAddress = paymentModal.customerAddress;
    const currentType = finalReceiptType;
    const currentObs = isPartialSplit
      ? `ABONO PARCIAL - SALDO PENDIENTE S/ ${pendingSplitBalance.toFixed(2)}${paymentModal.observations ? ` | ${paymentModal.observations}` : ""}`
      : paymentModal.observations;
    const currentBreakdown = paymentBreakdown;

    setPaymentModal(null);

    // Open Thermal Receipt modal for printing only if not Sin Comprobante and total > 0
    if (!isSinComprobante && currentTotal > 0) {
      setActiveReceiptModal({
        isOpen: true,
        workOrder: currentWo,
        invoice: currentInv,
        receiptType: (currentType || "Ticket") as any,
        receiptNumber: assignedReceiptNum,
        customerDoc: currentDoc,
        customerName: currentName,
        customerAddress: currentAddress,
        plate: currentWo?.vehicle_plate,
        observations: currentObs,
        grandTotal: currentTotal,
        items: currentItems,
        paymentMethod: currentMethod,
        paymentBreakdown: currentBreakdown,
        issuedAt: new Date().toISOString(),
      });
    }
  };

  // Open Partial / Installment Payment Modal (Abono sobre saldo pendiente por placa)
  const handleOpenPartialPaymentModal = (wo: any, inv?: any) => {
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
    const totalDue = computeOrderNetTotal(wo, inv);
    const history: Array<{ amount?: number }> = Array.isArray(inv?.payment_history)
      ? inv.payment_history
      : [];
    const paidSoFar = history.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = (inv?.credit_amount && inv.credit_amount > 0)
      ? Number(inv.credit_amount)
      : Math.max(0, totalDue - paidSoFar);

    const initialType = "Ticket" as "Ticket" | "Boleta" | "Factura";
    const previewNum = inv?.receipt_number && inv.receipt_number !== "0" && inv.receipt_number.toLowerCase() !== "s/n"
      ? inv.receipt_number
      : getCorrelativePreview(initialType);

    setPartialPaymentModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      totalDue,
      paidSoFar,
      amount: balance, // Por defecto: abonar el saldo total
      paymentMethod: inv?.payment_method || "Efectivo",
      paymentDestination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
      isSplitPayment: false,
      paymentSplits: [
        {
          id: `split-1`,
          method: inv?.payment_method || "Efectivo",
          destination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
          amount: balance,
        },
      ],
      receiptNumber: previewNum,
      receiptType: initialType,
      customerDoc: inv?.customer_doc || "",
      customerName: inv?.client_name || vehicle?.owner_name || "CLIENTES VARIOS",
      customerAddress: inv?.customer_address || "-",
      observation: inv?.debt_observation || inv?.observations || wo.observations || "",
      responsible: inv?.debt_responsible || "",
    });
  };

  // Submit partial / installment payment (abono)
  const handleConfirmPartialPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialPaymentModal) return;

    const amount = Number(partialPaymentModal.amount) || 0;
    const balance = Math.max(0, partialPaymentModal.totalDue - partialPaymentModal.paidSoFar);
    if (amount <= 0) {
      notify("warning", "Ingrese un monto de abono mayor a cero.");
      return;
    }
    if (amount > balance + 0.01) {
      notify("warning", `El abono (S/ ${amount.toFixed(2)}) supera el saldo pendiente (S/ ${balance.toFixed(2)}).`);
      return;
    }

    let finalMethod = partialPaymentModal.paymentMethod === "Sin Método" ? "" : partialPaymentModal.paymentMethod || "";
    let finalDest = partialPaymentModal.paymentDestination === "Ninguno" ? "" : partialPaymentModal.paymentDestination || "";
    let paymentBreakdown: PaymentSplit[] | undefined = undefined;

    if (partialPaymentModal.isSplitPayment && partialPaymentModal.paymentSplits && partialPaymentModal.paymentSplits.length > 0) {
      const totalSplits = partialPaymentModal.paymentSplits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const diff = Math.abs(amount - totalSplits);
      if (diff > 0.05) {
        notify("warning", `La suma de los abonos parciales (S/ ${totalSplits.toFixed(2)}) debe coincidir con el monto a abonar (S/ ${amount.toFixed(2)}).`);
        return;
      }
      let splits = partialPaymentModal.paymentSplits;
      if (partialPaymentModal.splitTicketMode === "perMethod" && partialPaymentModal.receiptType !== "Sin Comprobante") {
        // Pago mixto multi-ticket: cada método lleva su propio TIPO (Ticket/Boleta/Factura) y N° de comprobante
        splits = splits.map((s) => {
          const st = (s.receipt_type === "Boleta" || s.receipt_type === "Factura"
            ? s.receipt_type
            : (partialPaymentModal.receiptType === "Boleta" || partialPaymentModal.receiptType === "Factura" ? partialPaymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
          const num = (s.receipt_number && String(s.receipt_number).trim()) || getCorrelativePreview(st);
          return { ...s, receipt_type: st, receipt_number: num };
        });
        // Avanzar el correlativo al máximo usado, por cada tipo de comprobante emitido
        const typesUsed = Array.from(new Set(splits.map((s) => s.receipt_type))) as Array<"Ticket" | "Boleta" | "Factura">;
        for (const t of typesUsed) {
          advanceCorrelativeToMax(t, splits.filter((s) => s.receipt_type === t).map((s) => s.receipt_number));
        }
      } else {
        // Ticket único: el desglose queda como referencia, sin N° propio por método
        splits = splits.map((s) => ({ ...s, receipt_number: undefined, receipt_type: undefined }));
      }
      paymentBreakdown = splits;
      const methodSummary = partialPaymentModal.paymentSplits.map((p) => `${p.method}: S/ ${(Number(p.amount) || 0).toFixed(2)}`).join(", ");
      finalMethod = `Mixto (${methodSummary})`;
      finalDest = Array.from(new Set(partialPaymentModal.paymentSplits.map((p) => p.destination))).join(" / ");
    }

    // Auto-advance correlative sequence
    let assignedReceiptNum = "";
    if (partialPaymentModal.receiptType !== "Sin Comprobante" && (partialPaymentModal.receiptType === "Ticket" || partialPaymentModal.receiptType === "Boleta" || partialPaymentModal.receiptType === "Factura")) {
      if (partialPaymentModal.splitTicketMode === "perMethod" && paymentBreakdown && paymentBreakdown.length > 0) {
        // Pago mixto multi-ticket: el N° principal del comprobante es el primer ticket del desglose
        assignedReceiptNum = paymentBreakdown[0].receipt_number || partialPaymentModal.receiptNumber || "";
      } else if (partialPaymentModal.receiptNumber) {
        assignedReceiptNum = partialPaymentModal.receiptNumber;
        const parts = assignedReceiptNum.split("-");
        const numPart = parseInt(parts.length > 1 ? parts[1] : parts[0], 10);
        if (!isNaN(numPart)) {
          const typeKey = partialPaymentModal.receiptType === "Factura" ? "facturaLastNumber" : (partialPaymentModal.receiptType === "Boleta" ? "boletaLastNumber" : "ticketLastNumber");
          const seriesKey = partialPaymentModal.receiptType === "Factura" ? "facturaSeries" : (partialPaymentModal.receiptType === "Boleta" ? "boletaSeries" : "ticketSeries");
          updateCorrelativeConfig({
            [typeKey]: numPart,
            ...(parts.length > 1 ? { [seriesKey]: parts[0] } : {}),
            lastUpdateDate: queryDate || getPeruDateString(),
          });
        }
      } else {
        assignedReceiptNum = getAndIncrementReceiptNumber(partialPaymentModal.receiptType, queryDate || getPeruDateString());
      }
    }

    const finalReceiptType = partialPaymentModal.receiptType === "Sin Comprobante"
      ? ""
      : (partialPaymentModal.splitTicketMode === "perMethod" && paymentBreakdown && paymentBreakdown.length > 0
          ? (paymentBreakdown[0].receipt_type || partialPaymentModal.receiptType)
          : partialPaymentModal.receiptType);
    const isFullyPaid = Math.abs(balance - amount) <= 0.01;

    registerInvoicePayment({
      invoiceId: partialPaymentModal.invoice?.id,
      workOrderId: partialPaymentModal.workOrder?.id,
      amount,
      paymentMethod: finalMethod,
      paymentDestination: finalDest,
      receiptNumber: assignedReceiptNum,
      receiptType: finalReceiptType,
      paymentBreakdown: paymentBreakdown,
      observation: partialPaymentModal.observation,
      responsible: partialPaymentModal.responsible,
    });

    notify("success", isFullyPaid
      ? `¡Saldo de ${partialPaymentModal.workOrder?.vehicle_plate} cancelado! Abono de S/ ${amount.toFixed(2)} registrado.`
      : `Abono parcial de S/ ${amount.toFixed(2)} registrado para ${partialPaymentModal.workOrder?.vehicle_plate}. Saldo restante: S/ ${(balance - amount).toFixed(2)}`);

    setPartialPaymentModal(null);
  };

  // Open Manual / Direct Payment Modal for Workshop Registration
  const handleOpenManualPaymentModal = () => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setManualPaymentModal({
      isOpen: true,
      entryDate: queryDate || getPeruDateString(),
      entryTime: currentTime,
      quinquennialDate: "",
      chipExpiryDate: "",
      vehicleType: "Automóvil",
      fuelType: "GNV",
      brand: "Toyota",
      currentMileage: 0,
      vehiclePlate: "",
      receiptNumber: getCorrelativePreview("Ticket"),
      receiptType: "Ticket",
      clientName: "CLIENTES VARIOS",
      clientPhone: "",
      customerDoc: "",
      customerAddress: "",
      technicianName: technicians[0]?.full_name || "EDGAR",
      maintenanceService: "MANTENIMIENTO GENERAL",
      sparePartsServices: "",
      price: 0,
      discounts: "0",
      creditAmount: 0,
      paymentCondition: "PAGADO",
      paymentMethod: "Efectivo",
      paymentDestination: eligibleDestinations[0] || "EMPRESA",
      isSplitPayment: false,
      paymentSplits: [
        {
          id: `split-1`,
          method: "Efectivo",
          destination: eligibleDestinations[0] || "EMPRESA",
          amount: 0,
        },
      ],
      isSearchingRuc: false,
      debtObservation: "",
      debtResponsible: "",
    });
  };

  // Lookup RUC for Manual Payment Modal
  const handleLookupRucManual = async () => {
    if (!manualPaymentModal?.customerDoc || manualPaymentModal.customerDoc.length !== 11) {
      notify("warning", "Ingrese un RUC válido de 11 dígitos numéricos.");
      return;
    }
    setManualPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: true } : null));
    try {
      const res = await fetch(`/api/consulta-ruc?ruc=${manualPaymentModal.customerDoc}`);
      const data = await res.json();
      if (data.success) {
        setManualPaymentModal((prev) =>
          prev
            ? {
              ...prev,
              isSearchingRuc: false,
              clientName: data.razonSocial || prev.clientName,
              customerAddress: data.direccion || prev.customerAddress,
            }
            : null
        );
        notify("success", `RUC verificado: ${data.razonSocial}`);
      } else {
        setManualPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
        notify("warning", data.error || "No se pudo consultar el RUC. Ingréselo manualmente.");
      }
    } catch (err) {
      setManualPaymentModal((prev) => (prev ? { ...prev, isSearchingRuc: false } : null));
      notify("warning", "Error de conexión al consultar RUC.");
    }
  };

  // Submit Manual / Direct Workshop Payment
  const handleSaveManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPaymentModal) return;

    const plate = manualPaymentModal.vehiclePlate.toUpperCase().trim();
    if (!plate) {
      notify("warning", "Ingrese una placa de vehículo válida.");
      return;
    }

    const newDateTimeISO = buildPeruISOString(manualPaymentModal.entryDate, manualPaymentModal.entryTime || "08:30");
    const isZeroAmount = (manualPaymentModal.price || 0) === 0;
    const isSinComprobante = manualPaymentModal.receiptType === "Sin Comprobante";

    if (!isZeroAmount && !manualPaymentModal.isSplitPayment && !manualPaymentModal.paymentMethod && manualPaymentModal.paymentMethod !== "Sin Método") {
      notify("warning", "Debe seleccionar un Método de Pago.");
      return;
    }

    if (!isZeroAmount && !manualPaymentModal.isSplitPayment && !manualPaymentModal.paymentDestination && manualPaymentModal.paymentDestination !== "Ninguno") {
      notify("warning", "Debe seleccionar el Destino del Pago.");
      return;
    }

    if (manualPaymentModal.receiptType === "Factura" && (!manualPaymentModal.customerDoc || manualPaymentModal.customerDoc.length !== 11)) {
      notify("warning", "Para emitir Factura es obligatorio ingresar un RUC de 11 dígitos.");
      return;
    }

    // Process Split Payments vs Single Payment
    let finalMethod = (isZeroAmount && (!manualPaymentModal.paymentMethod || manualPaymentModal.paymentMethod === "Sin Método")) ? "" : (manualPaymentModal.paymentMethod === "Sin Método" ? "" : manualPaymentModal.paymentMethod || "");
    let finalDest = (isZeroAmount && (!manualPaymentModal.paymentDestination || manualPaymentModal.paymentDestination === "Ninguno")) ? "" : (manualPaymentModal.paymentDestination === "Ninguno" ? "" : manualPaymentModal.paymentDestination || "");
    let paymentBreakdown: PaymentSplit[] | undefined = undefined;

    if (!isZeroAmount && manualPaymentModal.isSplitPayment && manualPaymentModal.paymentSplits && manualPaymentModal.paymentSplits.length > 0) {
      const priceNum = Number(manualPaymentModal.price) || 0;
      const totalSplits = manualPaymentModal.paymentSplits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const diff = Math.abs(priceNum - totalSplits);
      if (diff > 0.05) {
        notify("warning", `La suma de los pagos parciales (S/ ${totalSplits.toFixed(2)}) debe coincidir exactamente con el precio total (S/ ${priceNum.toFixed(2)}). Diferencia: S/ ${diff.toFixed(2)}`);
        return;
      }
      let splits = manualPaymentModal.paymentSplits;
      if (manualPaymentModal.splitTicketMode === "perMethod" && !isSinComprobante) {
        // Pago mixto multi-ticket: 1 N° de ticket por método, correlativo avanzado al máximo usado
        const baseType = (manualPaymentModal.receiptType === "Factura" || manualPaymentModal.receiptType === "Boleta" ? manualPaymentModal.receiptType : "Ticket") as "Ticket" | "Boleta" | "Factura";
        splits = stampSplitTicketNumbers(splits, manualPaymentModal.receiptNumber || getCorrelativePreview(baseType), baseType);
        advanceCorrelativeToMax(baseType, splits.map((s) => s.receipt_number));
      } else {
        // Ticket único: el desglose queda como referencia, sin N° propio por método
        splits = splits.map((s) => ({ ...s, receipt_number: undefined, receipt_type: undefined }));
      }
      paymentBreakdown = splits;
      const methodSummary = manualPaymentModal.paymentSplits.map((p) => `${p.method}: S/ ${(Number(p.amount) || 0).toFixed(2)}`).join(", ");
      finalMethod = `Mixto (${methodSummary})`;
      finalDest = Array.from(new Set(manualPaymentModal.paymentSplits.map((p) => p.destination))).join(" / ");
    }

    // Auto-advance correlative sequence in store and sync to Supabase only if standard receipt type
    let assignedReceiptNum = "";
    if (!isSinComprobante && (manualPaymentModal.receiptType === "Ticket" || manualPaymentModal.receiptType === "Boleta" || manualPaymentModal.receiptType === "Factura")) {
      if (manualPaymentModal.splitTicketMode === "perMethod" && paymentBreakdown && paymentBreakdown.length > 0) {
        // Pago mixto multi-ticket: el N° principal del comprobante es el primer ticket del desglose
        assignedReceiptNum = paymentBreakdown[0].receipt_number || manualPaymentModal.receiptNumber || "";
      } else if (manualPaymentModal.receiptNumber) {
        assignedReceiptNum = manualPaymentModal.receiptNumber;
        const parts = assignedReceiptNum.split("-");
        const numPart = parseInt(parts.length > 1 ? parts[1] : parts[0], 10);
        if (!isNaN(numPart)) {
          const typeKey = manualPaymentModal.receiptType === "Factura" ? "facturaLastNumber" : (manualPaymentModal.receiptType === "Boleta" ? "boletaLastNumber" : "ticketLastNumber");
          const seriesKey = manualPaymentModal.receiptType === "Factura" ? "facturaSeries" : (manualPaymentModal.receiptType === "Boleta" ? "boletaSeries" : "ticketSeries");
          updateCorrelativeConfig({
            [typeKey]: numPart,
            ...(parts.length > 1 ? { [seriesKey]: parts[0] } : {}),
            lastUpdateDate: queryDate || getPeruDateString(),
          });
        }
      } else {
        assignedReceiptNum = getAndIncrementReceiptNumber(manualPaymentModal.receiptType, queryDate || getPeruDateString());
      }
    }

    const finalReceiptType = isSinComprobante ? "" : manualPaymentModal.receiptType;

    const { workOrder: newWo, invoice: newInv } = registerDirectWorkshopPayment({
      vehicle_plate: plate,
      brand: manualPaymentModal.brand || "Automóvil",
      fuel_type: manualPaymentModal.fuelType,
      vehicle_type: manualPaymentModal.vehicleType,
      current_mileage: Number(manualPaymentModal.currentMileage) || 0,
      owner_name: manualPaymentModal.clientName || "Cliente Taller",
      owner_phone: manualPaymentModal.clientPhone || "",
      customer_doc: manualPaymentModal.customerDoc || "",
      customer_address: manualPaymentModal.customerAddress || "",
      entry_time: newDateTimeISO,
      technician_name: manualPaymentModal.technicianName,
      problem_description: manualPaymentModal.maintenanceService,
      general_maintenance_service: manualPaymentModal.maintenanceService,
      spare_parts_services: manualPaymentModal.sparePartsServices,
      price: Number(manualPaymentModal.price) || 0,
      discounts: manualPaymentModal.discounts || "0",
      credit_amount: Number(manualPaymentModal.creditAmount) || 0,
      payment_condition: manualPaymentModal.paymentCondition || "PAGADO",
      payment_method: finalMethod,
      payment_destination: finalDest,
      receipt_type: finalReceiptType,
      receipt_number: assignedReceiptNum,
      quinquennial_date: manualPaymentModal.quinquennialDate,
      chip_expiry_date: manualPaymentModal.chipExpiryDate,
      payment_breakdown: paymentBreakdown,
      debt_observation: manualPaymentModal.debtObservation,
      debt_responsible: manualPaymentModal.debtResponsible,
    });

    notify("success", `¡Cobro directo de ${plate} (S/ ${Number(manualPaymentModal.price).toFixed(2)}) registrado y sincronizado en la Tabla de Registro Taller!`);

    const shouldPrint = !isSinComprobante && Number(manualPaymentModal.price) > 0;
    const modalData = { ...manualPaymentModal };
    const currentBreakdown = paymentBreakdown;
    setManualPaymentModal(null);

    if (shouldPrint) {
      setActiveReceiptModal({
        isOpen: true,
        workOrder: newWo,
        invoice: newInv,
        receiptType: (finalReceiptType || "Ticket") as any,
        receiptNumber: assignedReceiptNum,
        customerDoc: modalData.customerDoc,
        customerName: modalData.clientName,
        customerAddress: modalData.customerAddress,
        plate: plate,
        observations: modalData.sparePartsServices || modalData.maintenanceService || "",
        grandTotal: Number(modalData.price) || 0,
        items: newWo.items,
        paymentMethod: finalMethod,
        paymentBreakdown: currentBreakdown,
        issuedAt: newDateTimeISO,
      });
    }
  };

  // Open receipt viewer from card
  const handleOpenReceiptViewer = (wo: any, inv?: any, total: number = 0) => {
    const csvRec = getWorkshopCSVRecord(wo.vehicle_plate, wo.entry_time);
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());

    const effectiveReceiptNum = inv?.receipt_number && inv.receipt_number !== "0" && inv.receipt_number !== "S/N"
      ? inv.receipt_number
      : (csvRec?.receiptNumber || "");

    const rawType = (inv?.receipt_type || csvRec?.receiptType || "").toUpperCase().trim();
    const rType = (rawType.includes("FACTURA")
      ? "Factura"
      : rawType.includes("BOLETA")
        ? "Boleta"
        : (effectiveReceiptNum.startsWith("F") || (parseInt(effectiveReceiptNum) < 1000 && parseInt(effectiveReceiptNum) > 0) ? "Factura" : "Ticket")) as "Ticket" | "Boleta" | "Factura";

    const clientName = inv?.client_name && inv.client_name !== "Cliente Taller"
      ? inv.client_name
      : (vehicle?.owner_name && vehicle.owner_name !== "Cliente Taller"
        ? vehicle.owner_name
        : (csvRec?.clientName || (rType === "Ticket" ? "CLIENTES VARIOS" : "Cliente General")));

    const effectiveMethod = inv?.payment_method || csvRec?.method || "Efectivo";

    const effectiveDoc = inv?.customer_doc || csvRec?.rucFactura || "";

    const effectiveDiscount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);

    setActiveReceiptModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      receiptType: rType,
      receiptNumber: effectiveReceiptNum,
      customerDoc: effectiveDoc,
      customerName: clientName,
      customerAddress: inv?.customer_address || "-",
      plate: wo.vehicle_plate,
      observations: inv?.observations || wo.observations || "",
      grandTotal: total > 0 ? total : (inv?.grand_total || csvRec?.price || 80),
      items: wo.items && wo.items.length > 0 ? wo.items : undefined,
      discountAmount: effectiveDiscount,
      paymentMethod: effectiveMethod,
      issuedAt: inv?.issued_at || wo.entry_time || new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
                Recaudado ({queryDate === getPeruDateString() ? "Hoy" : queryDate})
              </span>
              <span className="text-xl font-black text-emerald-400">S/ {totalPaidToday.toFixed(2)}</span>
            </div>
          </div>

          {/* 2. Por Cobrar / Pendiente en la fecha */}
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold block">
                Por Cobrar ({queryDate === getPeruDateString() ? "Hoy" : queryDate})
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

        {/* Global Search Filters (Plate & Date) & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Daily Report to Management Button */}
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform hover:scale-105"
            title="Abrir Informe Diario de Taller & Caja a Gerencia"
          >
            <TrendingUp className="w-4 h-4 text-amber-200" />
            <span>Informe Diario a Gerencia</span>
          </button>

          <button
            type="button"
            onClick={handleOpenManualPaymentModal}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
            title="Registrar una atención directa o manual con todos los datos para la Tabla Registro Taller"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Cobro Manual (Registro Taller)</span>
          </button>

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

      {/* Últimos Correlativos Registrados & Filtro Rápido */}
      <div className="space-y-2.5 bg-reygas-dark/80 p-4 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                Últimos Correlativos Emitidos & Filtro Rápido
              </span>
              <span className="text-[11px] text-gray-400">
                Haz clic en una tarjeta para filtrar por tipo de comprobante o ver el último folio emitido.
              </span>
            </div>
          </div>
          {receiptTypeFilter !== "TODOS" && (
            <button
              onClick={() => setReceiptTypeFilter("TODOS")}
              className="text-xs text-amber-300 hover:text-white font-black flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Mostrar Todos los Comprobantes (Filtro {receiptTypeFilter} Activo)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card Ticket */}
          <button
            type="button"
            onClick={() => setReceiptTypeFilter(receiptTypeFilter === "Ticket" ? "TODOS" : "Ticket")}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${receiptTypeFilter === "Ticket"
              ? "bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/30 scale-[1.01]"
              : "glass-panel border-white/10 hover:border-amber-400/50 hover:bg-white/5"
              }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span className="text-sm">🎫</span> Ticket
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${receiptTypeFilter === "Ticket"
                ? "bg-amber-500 text-black border-amber-400 font-black shadow-sm"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30 group-hover:border-amber-400/60"
                }`}>
                {receiptTypeFilter === "Ticket" ? "✓ Filtro Activo" : `${latestCorrelatives.ticket.count} registrados`}
              </span>
            </div>
            <div className="text-lg font-black text-white font-mono tracking-tight">
              {latestCorrelatives.ticket.number}
            </div>
            <div className="text-[11px] text-gray-400 truncate mt-1 flex items-center gap-1">
              {latestCorrelatives.ticket.plate ? (
                <>
                  <span className="text-gray-500">Último:</span>
                  <span className="font-bold text-amber-300 font-mono">{latestCorrelatives.ticket.plate}</span>
                  {latestCorrelatives.ticket.total !== undefined && (
                    <span className="text-gray-300 font-semibold">• S/ {latestCorrelatives.ticket.total.toFixed(2)}</span>
                  )}
                </>
              ) : (
                <span className="text-gray-500 italic">Folio configurado en sistema</span>
              )}
            </div>
          </button>

          {/* Card Boleta */}
          <button
            type="button"
            onClick={() => setReceiptTypeFilter(receiptTypeFilter === "Boleta" ? "TODOS" : "Boleta")}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${receiptTypeFilter === "Boleta"
              ? "bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/60 shadow-lg shadow-cyan-500/30 scale-[1.01]"
              : "glass-panel border-white/10 hover:border-cyan-400/50 hover:bg-white/5"
              }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <span className="text-sm">📄</span> Boleta
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${receiptTypeFilter === "Boleta"
                ? "bg-cyan-500 text-black border-cyan-400 font-black shadow-sm"
                : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 group-hover:border-cyan-400/60"
                }`}>
                {receiptTypeFilter === "Boleta" ? "✓ Filtro Activo" : `${latestCorrelatives.boleta.count} registradas`}
              </span>
            </div>
            <div className="text-lg font-black text-white font-mono tracking-tight">
              {latestCorrelatives.boleta.number}
            </div>
            <div className="text-[11px] text-gray-400 truncate mt-1 flex items-center gap-1">
              {latestCorrelatives.boleta.plate ? (
                <>
                  <span className="text-gray-500">Último:</span>
                  <span className="font-bold text-cyan-300 font-mono">{latestCorrelatives.boleta.plate}</span>
                  {latestCorrelatives.boleta.total !== undefined && (
                    <span className="text-gray-300 font-semibold">• S/ {latestCorrelatives.boleta.total.toFixed(2)}</span>
                  )}
                </>
              ) : (
                <span className="text-gray-500 italic">Folio configurado en sistema</span>
              )}
            </div>
          </button>

          {/* Card Factura */}
          <button
            type="button"
            onClick={() => setReceiptTypeFilter(receiptTypeFilter === "Factura" ? "TODOS" : "Factura")}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${receiptTypeFilter === "Factura"
              ? "bg-purple-950/70 border-purple-400 ring-2 ring-purple-400/60 shadow-lg shadow-purple-500/30 scale-[1.01]"
              : "glass-panel border-white/10 hover:border-purple-400/50 hover:bg-white/5"
              }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span className="text-sm">📑</span> Factura
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${receiptTypeFilter === "Factura"
                ? "bg-purple-500 text-black border-purple-400 font-black shadow-sm"
                : "bg-purple-500/20 text-purple-300 border-purple-500/30 group-hover:border-purple-400/60"
                }`}>
                {receiptTypeFilter === "Factura" ? "✓ Filtro Activo" : `${latestCorrelatives.factura.count} registradas`}
              </span>
            </div>
            <div className="text-lg font-black text-white font-mono tracking-tight">
              {latestCorrelatives.factura.number}
            </div>
            <div className="text-[11px] text-gray-400 truncate mt-1 flex items-center gap-1">
              {latestCorrelatives.factura.plate ? (
                <>
                  <span className="text-gray-500">Último:</span>
                  <span className="font-bold text-purple-300 font-mono">{latestCorrelatives.factura.plate}</span>
                  {latestCorrelatives.factura.total !== undefined && (
                    <span className="text-gray-300 font-semibold">• S/ {latestCorrelatives.factura.total.toFixed(2)}</span>
                  )}
                </>
              ) : (
                <span className="text-gray-500 italic">Folio configurado en sistema</span>
              )}
            </div>
          </button>
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
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeStatusFilter === "hoy"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 font-black scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>📅 Del Día / Hoy ({todayCount})</span>
            </button>

            {/* 2. Pendientes */}
            <button
              onClick={() => setActiveStatusFilter("pendientes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeStatusFilter === "pendientes"
                ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20 scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>⏳ Pendientes ({pendingCount})</span>
            </button>

            {/* 3. Pagados */}
            <button
              onClick={() => setActiveStatusFilter("pagados")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeStatusFilter === "pagados"
                ? "bg-emerald-600 text-white font-extrabold shadow-lg shadow-emerald-600/20 scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>✅ Pagados ({paidCount})</span>
            </button>

            {/* 4. Todos */}
            <button
              onClick={() => setActiveStatusFilter("todos")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeStatusFilter === "todos"
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
                const grossSubtotal = partsTotal + certFee;
                const discountVal = (wo.discount_amount && wo.discount_amount > 0)
                  ? Number(wo.discount_amount)
                  : (invoice?.discounts ? (typeof invoice.discounts === "number" ? invoice.discounts : Number(invoice.discounts) || 0) : 0);

                let grandTotal = 0;
                if (invoice?.grand_total !== undefined && invoice.grand_total > 0 && (!wo.discount_amount || invoice.discounts === wo.discount_amount)) {
                  grandTotal = invoice.grand_total;
                } else {
                  grandTotal = Math.max(0, grossSubtotal - discountVal);
                }
                if (grandTotal === 0 && (invoice?.credit_amount || 0) > 0) {
                  grandTotal = invoice!.credit_amount!;
                }
                const splitPayment = parseSplitPaymentString(invoice?.discounts, wo.diagnostic_notes, invoice?.payment_method, grandTotal);
                const isPaid = settledInfo?.isSettled || isOrderPaid(wo, invoice);
                // Pago parcial: hay abonos registrados y aún queda saldo pendiente (crédito)
                const partialHistory = Array.isArray(invoice?.payment_history) ? invoice.payment_history : [];
                const totalPaidSoFar = partialHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const isPartiallyPaid = !isPaid && partialHistory.length > 0 && (invoice?.credit_amount || 0) > 0;
                const allowModInWorkshop = wo.allow_modifications;

                const csvRec = getWorkshopCSVRecord(wo.vehicle_plate, wo.entry_time);

                const effectiveClient = invoice?.client_name && invoice.client_name !== "Cliente Taller"
                  ? invoice.client_name
                  : (vehicle?.owner_name && vehicle.owner_name !== "Cliente Taller"
                    ? vehicle.owner_name
                    : (csvRec?.clientName || "Cliente General"));

                const effectivePhone = vehicle?.owner_phone && vehicle.owner_phone !== "S/T" && vehicle.owner_phone !== "+51 900000000"
                  ? vehicle.owner_phone
                  : (csvRec?.clientPhone || "S/T");

                const effectiveBrand = vehicle?.brand && vehicle.brand !== "Automóvil" ? vehicle.brand : (csvRec?.brand || "Automóvil");

                const isSinComp = invoice?.receipt_type === "Sin Comprobante" || (invoice && invoice.receipt_type === "" && !invoice.receipt_number);
                const effectiveReceiptNum = isSinComp
                  ? ""
                  : invoice?.receipt_number && invoice.receipt_number !== "0" && invoice.receipt_number !== "S/N"
                    ? invoice.receipt_number
                    : (csvRec?.receiptNumber || "");

                const rawType = (invoice?.receipt_type || csvRec?.receiptType || "").toUpperCase().trim();
                const effectiveReceiptType = isSinComp
                  ? "Sin Comprobante"
                  : rawType.includes("FACTURA")
                    ? "Factura"
                    : rawType.includes("BOLETA")
                      ? "Boleta"
                      : (effectiveReceiptNum.startsWith("F") || (parseInt(effectiveReceiptNum) < 1000 && parseInt(effectiveReceiptNum) > 0) ? "Factura" : "Ticket");

                const effectiveMethod = invoice?.payment_method || csvRec?.method || "Efectivo";
                const effectiveDestination = invoice?.payment_destination || csvRec?.destination || "EMPRESA";

                const buttonReceiptLabel = isSinComp
                  ? "Sin Comp."
                  : effectiveReceiptNum && effectiveReceiptNum !== "0"
                    ? (effectiveReceiptType === "Factura" ? `F001-${effectiveReceiptNum.replace(/[^0-9]/g, "").padStart(8, "0")}` : effectiveReceiptNum)
                    : "S/N";

                return (
                  <div
                    key={wo.id}
                    className={`p-5 rounded-2xl border transition-all glass-panel hover:border-purple-500/40 ${isPaid
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
                                {effectiveBrand} {vehicle?.model || ""} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                              </span>
                              <span className="text-xs text-reygas-red font-semibold">
                                Cliente: {effectiveClient} • Teléfono: {effectivePhone}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-500/30">
                              📅 <strong>Registro:</strong>{" "}
                              {wo.entry_time ? formatPeruDateTime(wo.entry_time) : "Hoy"}
                            </span>

                            <span className="text-xs px-2.5 py-1 rounded-lg bg-reygas-surface text-gray-300 border border-white/10">
                              Técnico: <strong className="text-amber-400">{tech?.full_name || ""}</strong>
                            </span>

                            {wo.quinquennial_date && (
                              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-950/80 text-purple-300 border border-purple-500/40 font-mono font-bold">
                                📅 5ta: <strong className="text-white">{wo.quinquennial_date}</strong>
                              </span>
                            )}

                            {wo.chip_expiry_date && (
                              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                                🏷️ Chip: <strong className="text-white">{wo.chip_expiry_date}</strong>
                              </span>
                            )}
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
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-gray-400 block">
                              Detalle de Servicio y Repuestos en Orden #{wo.id}:
                            </span>
                            {discountVal > 0 && (
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                <Tag className="w-3 h-3 text-emerald-400" />
                                <span>Desc. Taller: - S/ {discountVal.toFixed(2)}</span>
                              </span>
                            )}
                          </div>

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

                            {discountVal > 0 && (
                              <div className="flex justify-between items-center text-emerald-300 bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30 sm:col-span-2">
                                <span className="flex items-center gap-1.5 font-bold">
                                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Descuento Asignado en Taller:</span>
                                </span>
                                <span className="font-mono font-bold text-emerald-300">
                                  - S/ {discountVal.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Payment Metadata pill */}
                          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-gray-300 border-t border-white/5 font-mono">
                            {splitPayment.hasSplit ? (
                              <span className="px-2.5 py-1 rounded-lg bg-fuchsia-950/80 border border-fuchsia-500/50 text-fuchsia-300 font-black">
                                💰 {splitPayment.formattedSummary}
                              </span>
                            ) : (
                              <span>💳 <strong>Método:</strong> {effectiveMethod}</span>
                            )}
                            <span>🏢 <strong>Destino:</strong> <strong className="text-amber-300">{effectiveDestination}</strong></span>
                            {effectiveReceiptNum && (
                              <span>🧾 <strong>Recibo/Comp:</strong> {effectiveReceiptNum} ({effectiveReceiptType})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Total Amount & Action Buttons */}
                      <div className="flex flex-col items-end justify-center gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">
                            {isPaid ? "Monto Cobrado" : isPartiallyPaid ? "Monto Total" : "Monto por Cobrar"}
                          </span>
                          <span className={`text-3xl font-black font-mono ${isPaid ? "text-white" : "text-amber-400"}`}>
                            S/ {grandTotal.toFixed(2)}
                          </span>
                          {isPartiallyPaid && (
                            <div className="text-right text-[11px] text-gray-300 mt-1 space-y-0.5">
                              <div>Pagado: <strong className="text-emerald-400 font-mono">S/ {totalPaidSoFar.toFixed(2)}</strong></div>
                              <div>Saldo: <strong className="text-amber-400 font-mono">S/ {(invoice?.credit_amount || 0).toFixed(2)}</strong></div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => handleOpenReceiptViewer(wo, invoice, grandTotal)}
                            className="px-3.5 py-2 rounded-xl bg-blue-950/60 text-blue-300 hover:bg-blue-900/80 border border-blue-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow hover:scale-105"
                            title="Visualizar o Imprimir Comprobante Térmico / PDF"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span>Ver Comprobante ({buttonReceiptLabel})</span>
                          </button>

                          {isPaid ? (
                            <>
                              <button
                                onClick={() => {
                                  toggleOrderPayment(wo.id, invoice?.id);
                                  notify("warning", `Pago de ${wo.vehicle_plate} desmarcado (Estado: Pendiente de Cobro).`);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-amber-500/20 hover:text-amber-400 border border-emerald-500/40 hover:border-amber-500/40 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow"
                                title="Haga clic para desmarcar pago y revertir a Pendiente"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>PAGADO (Desmarcar Pago)</span>
                              </button>

                              <button
                                onClick={() => {
                                  toggleAllowModificationsInWorkshop(wo.id);
                                  notify("success", !allowModInWorkshop ? `🔓 Modificaciones habilitadas en Taller para ${wo.vehicle_plate}.` : `🔒 Modificaciones bloqueadas en Taller para ${wo.vehicle_plate}.`);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${allowModInWorkshop
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : "bg-gray-800 text-gray-400 border-white/10 hover:text-white hover:bg-gray-700"
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
                            <>
                              <button
                                onClick={() => handleOpenPartialPaymentModal(wo, invoice)}
                                className="px-4 py-2.5 bg-cyan-600/80 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl border border-cyan-400/40 shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition-transform hover:scale-105"
                                title="Abonar el saldo pendiente total o hacer un pago parcial por placa"
                              >
                                <History className="w-4 h-4 stroke-[2.5]" />
                                <span>Abonar Saldo (Total / Parcial)</span>
                              </button>
                              {isPartiallyPaid ? (
                                <button
                                  onClick={() => {
                                    if (invoice?.id) undoLastPayment(invoice.id);
                                    notify("warning", `Abono parcial de ${wo.vehicle_plate} desmarcado. La factura vuelve a estar pendiente de cobro completo.`);
                                  }}
                                  className="px-5 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 font-extrabold text-xs rounded-xl border border-amber-500/40 shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-all cursor-pointer"
                                  title="Desmarcar el abono parcial: la factura vuelve a estar pendiente de cobro completo"
                                >
                                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                  <span>Pagado Parcialmente (Desmarcar Pago)</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenPaymentModal(wo, invoice, grandTotal)}
                                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                                >
                                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                  <span>Confirmar Cobro (Método & Destino)</span>
                                </button>
                              )}
                            </>
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

                  {paymentModal.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-xs pt-1.5 text-emerald-300 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Descuento de Taller:</span>
                      </span>
                      <span className="font-mono text-emerald-400">
                        - S/ {paymentModal.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
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
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>1. Tipo de Comprobante a Emitir *</span>
                  {paymentModal.grandTotal === 0 && (
                    <span className="text-[10px] text-amber-300 font-bold">Monto S/ 0.00 (Gratuito / Sin Comprobante)</span>
                  )}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Ticket", "Boleta", "Factura", "Sin Comprobante"] as const).map((type) => {
                    const isSelected = paymentModal.receiptType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const nextNum = type === "Sin Comprobante" ? "" : getCorrelativePreview(type);
                          const stampedSplits = paymentModal.splitTicketMode === "perMethod" && type !== "Sin Comprobante"
                            ? stampSplitTicketNumbers(
                              paymentModal.paymentSplits || [],
                              nextNum,
                              (type === "Factura" || type === "Boleta" ? type : "Ticket") as "Ticket" | "Boleta" | "Factura"
                            )
                            : paymentModal.paymentSplits;
                          setPaymentModal({
                            ...paymentModal,
                            receiptType: type,
                            receiptNumber: nextNum,
                            paymentSplits: stampedSplits,
                            customerName:
                              type === "Ticket" && !paymentModal.customerName
                                ? "CLIENTES VARIOS"
                                : type === "Sin Comprobante"
                                  ? (paymentModal.customerName || "CLIENTES VARIOS")
                                  : paymentModal.customerName,
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                          ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                          : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                          }`}
                      >
                        <span>{type === "Ticket" ? "🎟️" : type === "Boleta" ? "🧾" : type === "Factura" ? "📑" : "🚫"}</span>
                        <span>{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Inputs according to Receipt Type */}
              <div className="p-3.5 bg-reygas-surface/60 rounded-2xl border border-white/10 space-y-3 text-xs">
                {paymentModal.receiptType !== "Sin Comprobante" ? (
                  <div>
                    <label className="text-gray-400 block mb-1 font-bold uppercase text-[11px]">
                      N° de Ticket / Comprobante{allowEditReceiptNumber ? " (editable):" : ":"}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: TK01-00000456"
                      value={paymentModal.receiptNumber}
                      readOnly={!allowEditReceiptNumber}
                      onChange={(e) => setPaymentModal({ ...paymentModal, receiptNumber: e.target.value })}
                      className={`w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-amber-300 font-mono font-bold focus:border-amber-400 ${!allowEditReceiptNumber ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                    {!allowEditReceiptNumber && (
                      <p className="text-[10px] text-gray-500 italic mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Correlativo automático (edición bloqueada en Configuración)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 italic">
                    Sin emisión de comprobante tributario (Atención de costo S/ 0 o exonerada).
                  </div>
                )}

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
                        onChange={(e) => setPaymentModal({ ...paymentModal, customerName: titleCase(e.target.value) })}
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

                {/* Ticket o Sin Comprobante Cliente */}
                {(paymentModal.receiptType === "Ticket" || paymentModal.receiptType === "Sin Comprobante") && (
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Nombre del Cliente / Receptor:</label>
                    <input
                      type="text"
                      placeholder="CLIENTES VARIOS"
                      value={paymentModal.customerName}
                      onChange={(e) => setPaymentModal({ ...paymentModal, customerName: titleCase(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* 2 & 3. Método y Destino de Pago (Pago Único o Pago Mixto / Parcial) */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Método y Destino de Pago</span>
                    {paymentModal.grandTotal === 0 && (
                      <span className="text-[10px] text-gray-400 font-normal">(Opcional para S/ 0.00)</span>
                    )}
                  </label>

                  {paymentModal.grandTotal > 0 && (
                    <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-xs self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentModal({
                            ...paymentModal,
                            isSplitPayment: false,
                          });
                        }}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${!paymentModal.isSplitPayment
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "text-gray-400 hover:text-white"
                          }`}
                      >
                        💵 Pago Único
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSplits = (paymentModal.paymentSplits && paymentModal.paymentSplits.length > 0)
                            ? paymentModal.paymentSplits
                            : [
                              {
                                id: `split-1`,
                                method: paymentModal.paymentMethod || "Efectivo",
                                destination: paymentModal.paymentDestination || "EMPRESA",
                                amount: paymentModal.grandTotal,
                              },
                            ];
                          setPaymentModal({
                            ...paymentModal,
                            isSplitPayment: true,
                            paymentSplits: currentSplits,
                          });
                        }}
                        className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${paymentModal.isSplitPayment
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "text-gray-400 hover:text-white"
                          }`}
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Pago Mixto / Parcial</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                          {(paymentModal.paymentSplits || []).length}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Single Payment Mode */}
                {!paymentModal.isSplitPayment ? (
                  <div className="space-y-3">
                    {/* Method Selector */}
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(["Efectivo", "Yape", "Transferencia", "Culqi", "Sin Método"] as const).map((method) => {
                          const isSelected = method === "Sin Método" ? (!paymentModal.paymentMethod || paymentModal.paymentMethod === "Sin Método") : paymentModal.paymentMethod === method;
                          return (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPaymentModal({ ...paymentModal, paymentMethod: method === "Sin Método" ? "" : method })}
                              className={`p-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                                ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]"
                                : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                                }`}
                            >
                              <span>{method === "Efectivo" ? "💵" : method === "Yape" ? "📱" : method === "Transferencia" ? "🏦" : method === "Culqi" ? "💳" : "🚫"}</span>
                              <span>{method}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Destination Selector */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1">
                        Destino del Pago / Responsable:
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={paymentModal.paymentDestination}
                          onChange={(e) => setPaymentModal({ ...paymentModal, paymentDestination: e.target.value })}
                          className="w-full pl-9 pr-4 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs font-bold text-white focus:border-emerald-400"
                        >
                          <option value="">(Ninguno / Dejar Vacío para S/ 0.00)</option>
                          {eligibleDestinations.map((dest) => (
                            <option key={dest} value={dest}>
                              {dest === "EMPRESA" ? "🏢 EMPRESA (Cuenta Principal / Caja)" : `👤 ${dest}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Multi-Method / Split Payment Mode */
                  <div className="space-y-3 p-3.5 rounded-2xl bg-black/40 border border-purple-500/30 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-purple-400" />
                        <span>Desglose de Métodos (Efectivo + Culqi + Yape...)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSum = (paymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                          const remaining = Math.max(0, Number((paymentModal.grandTotal - currentSum).toFixed(2)));
                          const splitsNow = paymentModal.paymentSplits || [];
                          const lastSplit = splitsNow.length > 0 ? splitsNow[splitsNow.length - 1] : undefined;
                          const lastSplitType = (lastSplit?.receipt_type === "Boleta" || lastSplit?.receipt_type === "Factura"
                            ? lastSplit.receipt_type
                            : (paymentModal.receiptType === "Boleta" || paymentModal.receiptType === "Factura" ? paymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
                          const nextTicketNum = paymentModal.splitTicketMode === "perMethod" && paymentModal.receiptType !== "Sin Comprobante"
                            ? (lastSplit?.receipt_number ? incrementReceiptNumber(lastSplit.receipt_number) : (paymentModal.receiptNumber || getCorrelativePreview(lastSplitType)))
                            : undefined;
                          const newSplits = [
                            ...splitsNow,
                            {
                              id: "split-" + Date.now() + "-" + Math.random(),
                              method: "Culqi",
                              destination: eligibleDestinations[0] || "EMPRESA",
                              amount: remaining,
                              ...(nextTicketNum
                                ? { receipt_number: nextTicketNum, receipt_type: lastSplitType }
                                : {}),
                            },
                          ];
                          setPaymentModal({ ...paymentModal, paymentSplits: newSplits });
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Añadir Método</span>
                      </button>
                    </div>

                    {/* Modo de asignación de N° de Comprobante en pago mixto */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 rounded-xl border border-white/10 p-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Asignación de N° de Comprobante:</span>
                      </span>
                      <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-[11px] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            const clearedSplits = (paymentModal.paymentSplits || []).map((p) => ({
                              ...p,
                              receipt_number: undefined,
                              receipt_type: undefined,
                            }));
                            setPaymentModal({ ...paymentModal, splitTicketMode: "single", paymentSplits: clearedSplits });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all ${paymentModal.splitTicketMode !== "perMethod"
                            ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          🎫 Un solo Comprobante
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentSplits = (paymentModal.paymentSplits && paymentModal.paymentSplits.length > 0)
                              ? paymentModal.paymentSplits
                              : [
                                {
                                  id: "split-1",
                                  method: paymentModal.paymentMethod || "Efectivo",
                                  destination: paymentModal.paymentDestination || "EMPRESA",
                                  amount: paymentModal.grandTotal,
                                },
                              ];
                            const baseType = (paymentModal.receiptType === "Factura" || paymentModal.receiptType === "Boleta" ? paymentModal.receiptType : "Ticket") as "Ticket" | "Boleta" | "Factura";
                            const base = paymentModal.receiptNumber || getCorrelativePreview(baseType);
                            const stamped = stampSplitTicketNumbers(currentSplits, base, baseType);
                            setPaymentModal({ ...paymentModal, splitTicketMode: "perMethod", paymentSplits: stamped });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${paymentModal.splitTicketMode === "perMethod"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          <Split className="w-3.5 h-3.5" />
                          <span>Comprobante por Método</span>
                        </button>
                      </div>
                    </div>

                    {/* Split Rows */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {(paymentModal.paymentSplits || []).map((split, idx) => {
                        const splitType = (split.receipt_type === "Boleta" || split.receipt_type === "Factura"
                          ? split.receipt_type
                          : (paymentModal.receiptType === "Boleta" || paymentModal.receiptType === "Factura" ? paymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
                        return (
                        <div
                          key={split.id || idx}
                          className="p-2.5 rounded-xl bg-reygas-surface/80 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                        >
                          <span className="text-[10px] font-mono font-bold text-purple-300 w-6 shrink-0 text-center py-1 bg-purple-950/60 rounded-md border border-purple-500/20">
                            #{idx + 1}
                          </span>

                          {/* Method Select */}
                          <div className="flex-1 min-w-[130px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Método:</label>
                            <select
                              value={split.method}
                              onChange={(e) => {
                                const updated = (paymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, method: e.target.value } : p
                                );
                                setPaymentModal({ ...paymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                            >
                              <option value="Efectivo">💵 Efectivo</option>
                              <option value="Culqi">💳 Culqi (Tarjeta)</option>
                              <option value="Yape">📱 Yape</option>
                              <option value="Plin">📱 Plin</option>
                              <option value="Transferencia">🏦 Transferencia BCP</option>
                            </select>
                          </div>

                          {/* Destination Select */}
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Destino:</label>
                            <select
                              value={split.destination}
                              onChange={(e) => {
                                const updated = (paymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, destination: e.target.value } : p
                                );
                                setPaymentModal({ ...paymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                            >
                              {eligibleDestinations.map((dest) => (
                                <option key={dest} value={dest}>
                                  {dest === "EMPRESA" ? "🏢 EMPRESA" : `👤 ${dest}`}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tipo + N° de comprobante propio del método (multi-ticket) */}
                          {paymentModal.splitTicketMode === "perMethod" && (
                            <>
                              <div className="w-full sm:w-28 shrink-0">
                                <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Tipo:</label>
                                <select
                                  value={splitType}
                                  onChange={(e) => {
                                    const newType = e.target.value as "Ticket" | "Boleta" | "Factura";
                                    const updated = (paymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx
                                        ? { ...p, receipt_type: newType, receipt_number: getCorrelativePreview(newType) }
                                        : p
                                    );
                                    setPaymentModal({ ...paymentModal, paymentSplits: updated });
                                  }}
                                  className="w-full px-2 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                                >
                                  <option value="Ticket">🎟️ Ticket</option>
                                  <option value="Boleta">🧾 Boleta</option>
                                  <option value="Factura">📑 Factura</option>
                                </select>
                              </div>
                              <div className="w-full sm:w-36 shrink-0">
                                <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">N° Comprobante:</label>
                                <input
                                  type="text"
                                  placeholder={splitType === "Factura" ? "F001-..." : splitType === "Boleta" ? "B001-..." : "TK01-..."}
                                  value={split.receipt_number || ""}
                                  readOnly={!allowEditReceiptNumber}
                                  onChange={(e) => {
                                    const updated = (paymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx ? { ...p, receipt_number: e.target.value } : p
                                    );
                                    setPaymentModal({ ...paymentModal, paymentSplits: updated });
                                  }}
                                  className={`w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-amber-300 font-mono font-bold focus:border-purple-400 ${!allowEditReceiptNumber ? "opacity-60 cursor-not-allowed" : ""}`}
                                />
                              </div>
                            </>
                          )}

                          {/* Amount Input */}
                          <div className="w-full sm:w-28 shrink-0">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Monto (S/):</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={split.amount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = (paymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, amount: val } : p
                                );
                                setPaymentModal({ ...paymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-emerald-300 font-mono font-black focus:border-purple-400"
                            />
                          </div>

                          {/* Delete Row */}
                          {(paymentModal.paymentSplits || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (paymentModal.paymentSplits || []).filter((_, i) => i !== idx);
                                setPaymentModal({ ...paymentModal, paymentSplits: updated });
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors self-end sm:self-center"
                              title="Eliminar este método"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    {/* Balance / Difference Checker */}
                    {(() => {
                      const totalSplits = (paymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      const diff = Number((paymentModal.grandTotal - totalSplits).toFixed(2));
                      const isBalanced = Math.abs(diff) < 0.01;

                      return (
                        <div
                          className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold ${isBalanced
                            ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                            : diff > 0
                              ? "bg-amber-950/50 border-amber-500/40 text-amber-300"
                              : "bg-red-950/50 border-red-500/40 text-red-300"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>Total Cobro: <strong>S/ {paymentModal.grandTotal.toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>Suma Desglose: <strong>S/ {totalSplits.toFixed(2)}</strong></span>
                          </div>
                          <div>
                            {isBalanced ? (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Cuadra Exacto (S/ {paymentModal.grandTotal.toFixed(2)})</span>
                              </span>
                            ) : diff > 0 ? (
                              <span className="flex items-center gap-1.5 text-amber-300">
                                <AlertCircle className="w-4 h-4" />
                                <span>Abono parcial: S/ {diff.toFixed(2)} quedarán como <strong>saldo pendiente</strong></span>
                              </span>
                            ) : (
                              <span>Excede por S/ {Math.abs(diff).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
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
      {/* MODAL DE CONFIRMACIÓN DE PAGO MANUAL (REGISTRO TALLER) */}
      {/* ========================================================================= */}
      {manualPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/20 shadow-2xl bg-[#0d121f]/95 overflow-hidden my-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-purple-950/30 to-reygas-surface">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Registro y Confirmación de Pago Directo (Taller)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      Tabla Registro Taller
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Ingreso manual de atenciones, comprobantes y datos completos del vehículo para la base de datos de Taller.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualPaymentModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveManualPayment} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
              {/* Sección 1: Fecha, Hora y Fechas Técnicas */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>1. Fecha, Hora de Ingreso e Inspecciones Técnicas</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Fecha de Ingreso / Atención *</label>
                    <input
                      type="date"
                      required
                      value={manualPaymentModal.entryDate}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, entryDate: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Hora de Ingreso *</label>
                    <input
                      type="time"
                      required
                      value={manualPaymentModal.entryTime}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, entryTime: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold flex items-center justify-between">
                      <span>Fecha Quinquenal (5ta)</span>
                      <span className="text-[10px] text-amber-400">GNV</span>
                    </label>
                    <input
                      type="date"
                      value={manualPaymentModal.quinquennialDate}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, quinquennialDate: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold flex items-center justify-between">
                      <span>Fecha Chip Anual</span>
                      <span className="text-[10px] text-purple-400">Revisión</span>
                    </label>
                    <input
                      type="date"
                      value={manualPaymentModal.chipExpiryDate}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, chipExpiryDate: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Datos del Vehículo & Cliente */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>2. Datos del Vehículo y del Cliente</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Placa del Vehículo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: ABC-123"
                      value={manualPaymentModal.vehiclePlate}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, vehiclePlate: formatPlate(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-amber-300 font-mono font-black focus:border-amber-400 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Tipo de Vehículo</label>
                    <select
                      value={manualPaymentModal.vehicleType}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, vehicleType: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    >
                      <option value="Automóvil">Automóvil (Sedán/Hatchback)</option>
                      <option value="Camioneta">Camioneta / SUV</option>
                      <option value="Station Wagon">Station Wagon</option>
                      <option value="Taxi">Taxi</option>
                      <option value="Pick-up">Pick-up</option>
                      <option value="Miniván">Miniván</option>
                      <option value="Bus / Microbús">Bus / Microbús</option>
                      <option value="Mototaxi">Mototaxi / Moto</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Sistema / Combustible</label>
                    <select
                      value={manualPaymentModal.fuelType}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, fuelType: e.target.value as any })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400 font-bold"
                    >
                      <option value="GNV">GNV (Gas Natural)</option>
                      <option value="GLP">GLP (Gas Licuado)</option>
                      <option value="Gasolina">Gasolina</option>
                      <option value="Bifuel">Bifuel (Dual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Marca</label>
                    <input
                      type="text"
                      placeholder="Ej: Toyota, Nissan"
                      value={manualPaymentModal.brand}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, brand: capitalizeFirst(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Kilometraje (KM)</label>
                    <input
                      type="number"
                      placeholder="Ej: 85000"
                      value={manualPaymentModal.currentMileage || ""}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, currentMileage: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Nombre del Cliente / Razón Social</label>
                    <input
                      type="text"
                      placeholder="CLIENTES VARIOS"
                      value={manualPaymentModal.clientName}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, clientName: titleCase(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Celular / Teléfono</label>
                    <input
                      type="text"
                      placeholder="Ej: 987654321"
                      value={manualPaymentModal.clientPhone}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, clientPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">DNI / RUC del Cliente</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="DNI (8) o RUC (11)"
                        value={manualPaymentModal.customerDoc}
                        onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, customerDoc: e.target.value.replace(/\D/g, "") })}
                        className="flex-1 px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-purple-400"
                      />
                      {manualPaymentModal.customerDoc.length === 11 && (
                        <button
                          type="button"
                          onClick={handleLookupRucManual}
                          disabled={manualPaymentModal.isSearchingRuc}
                          className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center gap-1 shrink-0"
                          title="Consultar RUC en SUNAT"
                        >
                          {manualPaymentModal.isSearchingRuc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SearchCheck className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-gray-300 block mb-1 font-bold">Dirección Fiscal / Domicilio</label>
                  <input
                    type="text"
                    placeholder="Dirección del cliente / empresa"
                    value={manualPaymentModal.customerAddress}
                    onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, customerAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Sección 3: Servicios del Taller & Técnico */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>3. Servicios de Taller y Técnico Asignado</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Técnico Responsable</label>
                    <select
                      value={manualPaymentModal.technicianName}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, technicianName: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-bold focus:border-amber-400"
                    >
                      {technicians.map((t) => (
                        <option key={t.id} value={t.full_name}>
                          👤 {t.full_name} ({t.specialty})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Mantenimiento General / Diagnóstico</label>
                    <input
                      type="text"
                      placeholder="Ej: Mantenimiento y Calibración 5ta Gen"
                      value={manualPaymentModal.maintenanceService}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, maintenanceService: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Repuestos & Servicios Adicionales</label>
                    <input
                      type="text"
                      placeholder="Ej: Filtro de gas, bujías, juego de orings"
                      value={manualPaymentModal.sparePartsServices}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, sparePartsServices: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Comprobante, Cobro y Liquidación */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>4. Comprobante de Pago, Condición & Liquidación</span>
                </h4>

                {/* Tipo de Comprobante */}
                <div>
                  <label className="text-gray-300 block mb-1.5 font-bold">Tipo de Comprobante a Emitir</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["Ticket", "Boleta", "Factura", "Sin Comprobante"] as const).map((type) => {
                      const isSelected = manualPaymentModal.receiptType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            const nextNum = type === "Sin Comprobante" ? "" : getCorrelativePreview(type);
                            const stampedSplits = manualPaymentModal.splitTicketMode === "perMethod" && type !== "Sin Comprobante"
                              ? stampSplitTicketNumbers(
                                manualPaymentModal.paymentSplits || [],
                                nextNum,
                                (type === "Factura" || type === "Boleta" ? type : "Ticket") as "Ticket" | "Boleta" | "Factura"
                              )
                              : manualPaymentModal.paymentSplits;
                            setManualPaymentModal({
                              ...manualPaymentModal,
                              receiptType: type,
                              receiptNumber: nextNum,
                              paymentSplits: stampedSplits,
                              clientName:
                                type === "Ticket" && (!manualPaymentModal.clientName || manualPaymentModal.clientName === "Cliente Taller")
                                  ? "CLIENTES VARIOS"
                                  : manualPaymentModal.clientName,
                            });
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                            ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                            : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                            }`}
                        >
                          <span>{type === "Ticket" ? "🎟️" : type === "Boleta" ? "🧾" : type === "Factura" ? "📑" : "🚫"}</span>
                          <span>{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">N° Comprobante</label>
                    <input
                      type="text"
                      placeholder={manualPaymentModal.receiptType === "Sin Comprobante" ? "(Sin comprobante)" : "N° Comprobante"}
                      value={manualPaymentModal.receiptNumber}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, receiptNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-amber-300 font-mono font-bold focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Precio Total a Cobrar (S/) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={manualPaymentModal.price}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-emerald-400 font-mono font-black text-sm focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Condición de Pago</label>
                    <select
                      value={manualPaymentModal.paymentCondition}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, paymentCondition: e.target.value as any })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-bold focus:border-amber-400"
                    >
                      <option value="PAGADO">PAGADO (Confirmado)</option>
                      <option value="CREDITO">CREDITO (Por Cobrar)</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">Descuentos</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={manualPaymentModal.discounts}
                      onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, discounts: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Saldo Pendiente: Observación y Responsable (solo si condición CREDITO/PENDIENTE) */}
                {manualPaymentModal.paymentCondition !== "PAGADO" && (
                  <div className="p-4 bg-amber-950/40 rounded-2xl border border-amber-500/30 space-y-3 animate-fadeIn">
                    <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Saldo Pendiente: Observación y Responsable</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-300 block mb-1.5 font-bold">
                          Responsable del Saldo (Opcional)
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={manualPaymentModal.debtResponsible || ""}
                            onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, debtResponsible: e.target.value })}
                            className="w-full pl-9 pr-4 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-bold text-white focus:border-amber-400"
                          >
                            <option value="">(Sin responsable asignado)</option>
                            {debtResponsibles.map((name) => (
                              <option key={name} value={name}>
                                👤 {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-gray-300 block mb-1.5 font-bold">
                          Observación del Saldo (Opcional)
                        </label>
                        <div className="relative">
                          <FileText className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                          <textarea
                            rows={2}
                            placeholder="Ej: SE PROGRAMA A CANCELAR EL DIA 31/07"
                            value={manualPaymentModal.debtObservation || ""}
                            onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, debtObservation: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-amber-400 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Método y Destino de Pago (Pago Único o Pago Mixto / Parcial) */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Método y Destino de Pago</span>
                      {manualPaymentModal.price === 0 && (
                        <span className="text-[10px] text-gray-400 font-normal">(Opcional para S/ 0.00)</span>
                      )}
                    </label>

                    {manualPaymentModal.price > 0 && (
                      <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-xs self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setManualPaymentModal({
                              ...manualPaymentModal,
                              isSplitPayment: false,
                            });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all ${!manualPaymentModal.isSplitPayment
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          💵 Pago Único
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentSplits = (manualPaymentModal.paymentSplits && manualPaymentModal.paymentSplits.length > 0)
                              ? manualPaymentModal.paymentSplits
                              : [
                                {
                                  id: `split-1`,
                                  method: manualPaymentModal.paymentMethod || "Efectivo",
                                  destination: manualPaymentModal.paymentDestination || "EMPRESA",
                                  amount: manualPaymentModal.price,
                                },
                              ];
                            setManualPaymentModal({
                              ...manualPaymentModal,
                              isSplitPayment: true,
                              paymentSplits: currentSplits,
                            });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${manualPaymentModal.isSplitPayment
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          <Split className="w-3.5 h-3.5" />
                          <span>Pago Mixto / Parcial</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                            {(manualPaymentModal.paymentSplits || []).length}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Single Payment Mode */}
                  {!manualPaymentModal.isSplitPayment ? (
                    <div className="space-y-3">
                      <div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {(["Efectivo", "Yape", "Transferencia", "Culqi", "Sin Método"] as const).map((method) => {
                            const isSelected = method === "Sin Método" ? (!manualPaymentModal.paymentMethod || manualPaymentModal.paymentMethod === "Sin Método") : manualPaymentModal.paymentMethod === method;
                            return (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setManualPaymentModal({ ...manualPaymentModal, paymentMethod: method === "Sin Método" ? "" : method })}
                                className={`p-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                                  ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]"
                                  : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                                  }`}
                              >
                                <span>{method === "Efectivo" ? "💵" : method === "Yape" ? "📱" : method === "Transferencia" ? "🏦" : method === "Culqi" ? "💳" : "🚫"}</span>
                                <span>{method}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-gray-300 block mb-1 font-bold text-xs">
                          Destino del Pago / Responsable:
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={manualPaymentModal.paymentDestination}
                            onChange={(e) => setManualPaymentModal({ ...manualPaymentModal, paymentDestination: e.target.value })}
                            className="w-full pl-9 pr-4 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-bold text-white focus:border-emerald-400"
                          >
                            <option value="">(Ninguno / Dejar Vacío para S/ 0.00)</option>
                            {eligibleDestinations.map((dest) => (
                              <option key={dest} value={dest}>
                                {dest === "EMPRESA" ? "🏢 EMPRESA (Cuenta Principal / Caja)" : `👤 ${dest}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Multi-Method / Split Payment Mode */
                    <div className="space-y-3 p-3.5 rounded-2xl bg-black/40 border border-purple-500/30 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                        <span className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-purple-400" />
                          <span>Desglose de Métodos (Efectivo + Culqi + Yape...)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentSum = (manualPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                            const remaining = Math.max(0, Number((manualPaymentModal.price - currentSum).toFixed(2)));
                            const splitsNow = manualPaymentModal.paymentSplits || [];
                            const lastNum = splitsNow.length > 0 ? splitsNow[splitsNow.length - 1].receipt_number : undefined;
                            const nextTicketNum = manualPaymentModal.splitTicketMode === "perMethod" && manualPaymentModal.receiptType !== "Sin Comprobante"
                              ? (lastNum ? incrementReceiptNumber(lastNum) : (manualPaymentModal.receiptNumber || getCorrelativePreview((manualPaymentModal.receiptType === "Factura" || manualPaymentModal.receiptType === "Boleta" ? manualPaymentModal.receiptType : "Ticket") as "Ticket" | "Boleta" | "Factura")))
                              : undefined;
                            const newSplits = [
                              ...splitsNow,
                              {
                                id: "split-" + Date.now() + "-" + Math.random(),
                                method: "Culqi",
                                destination: eligibleDestinations[0] || "EMPRESA",
                                amount: remaining,
                                ...(nextTicketNum
                                  ? { receipt_number: nextTicketNum, receipt_type: (manualPaymentModal.receiptType === "Factura" || manualPaymentModal.receiptType === "Boleta" ? manualPaymentModal.receiptType : "Ticket") }
                                  : {}),
                              },
                            ];
                            setManualPaymentModal({ ...manualPaymentModal, paymentSplits: newSplits });
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Añadir Método</span>
                        </button>
                      </div>

                      {/* Modo de asignación de N° de Ticket en pago mixto */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 rounded-xl border border-white/10 p-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>Asignación de N° de Ticket:</span>
                        </span>
                        <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-[11px] self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const clearedSplits = (manualPaymentModal.paymentSplits || []).map((p) => ({
                                ...p,
                                receipt_number: undefined,
                                receipt_type: undefined,
                              }));
                              setManualPaymentModal({ ...manualPaymentModal, splitTicketMode: "single", paymentSplits: clearedSplits });
                            }}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${manualPaymentModal.splitTicketMode !== "perMethod"
                              ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                              : "text-gray-400 hover:text-white"
                              }`}
                          >
                            🎫 Un solo Ticket
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const currentSplits = (manualPaymentModal.paymentSplits && manualPaymentModal.paymentSplits.length > 0)
                                ? manualPaymentModal.paymentSplits
                                : [
                                  {
                                    id: "split-1",
                                    method: manualPaymentModal.paymentMethod || "Efectivo",
                                    destination: manualPaymentModal.paymentDestination || "EMPRESA",
                                    amount: manualPaymentModal.price,
                                  },
                                ];
                              const baseType = (manualPaymentModal.receiptType === "Factura" || manualPaymentModal.receiptType === "Boleta" ? manualPaymentModal.receiptType : "Ticket") as "Ticket" | "Boleta" | "Factura";
                              const base = manualPaymentModal.receiptNumber || getCorrelativePreview(baseType);
                              const stamped = stampSplitTicketNumbers(currentSplits, base, baseType);
                              setManualPaymentModal({ ...manualPaymentModal, splitTicketMode: "perMethod", paymentSplits: stamped });
                            }}
                            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${manualPaymentModal.splitTicketMode === "perMethod"
                              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                              : "text-gray-400 hover:text-white"
                              }`}
                          >
                            <Split className="w-3.5 h-3.5" />
                            <span>Ticket por Método</span>
                          </button>
                        </div>
                      </div>

                      {/* Split Rows */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {(manualPaymentModal.paymentSplits || []).map((split, idx) => (
                          <div
                            key={split.id || idx}
                            className="p-2.5 rounded-xl bg-reygas-surface/80 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                          >
                            <span className="text-[10px] font-mono font-bold text-purple-300 w-6 shrink-0 text-center py-1 bg-purple-950/60 rounded-md border border-purple-500/20">
                              #{idx + 1}
                            </span>

                            {/* Method Select */}
                            <div className="flex-1 min-w-[130px]">
                              <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Método:</label>
                              <select
                                value={split.method}
                                onChange={(e) => {
                                  const updated = (manualPaymentModal.paymentSplits || []).map((p, i) =>
                                    i === idx ? { ...p, method: e.target.value } : p
                                  );
                                  setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                }}
                                className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                              >
                                <option value="Efectivo">💵 Efectivo</option>
                                <option value="Culqi">💳 Culqi (Tarjeta)</option>
                                <option value="Yape">📱 Yape</option>
                                <option value="Plin">📱 Plin</option>
                                <option value="Transferencia">🏦 Transferencia BCP</option>
                              </select>
                            </div>

                            {/* Destination Select */}
                            <div className="flex-1 min-w-[140px]">
                              <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Destino:</label>
                              <select
                                value={split.destination}
                                onChange={(e) => {
                                  const updated = (manualPaymentModal.paymentSplits || []).map((p, i) =>
                                    i === idx ? { ...p, destination: e.target.value } : p
                                  );
                                  setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                }}
                                className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                              >
                                {eligibleDestinations.map((dest) => (
                                  <option key={dest} value={dest}>
                                    {dest === "EMPRESA" ? "🏢 EMPRESA" : `👤 ${dest}`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* N° Ticket propio del método (multi-ticket) */}
                            {manualPaymentModal.splitTicketMode === "perMethod" && (
                              <div className="w-full sm:w-32 shrink-0">
                                <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">N° Ticket:</label>
                                <input
                                  type="text"
                                  placeholder="TK01-..."
                                  value={split.receipt_number || ""}
                                  onChange={(e) => {
                                    const updated = (manualPaymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx ? { ...p, receipt_number: e.target.value } : p
                                    );
                                    setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-amber-300 font-mono font-bold focus:border-purple-400"
                                />
                              </div>
                            )}

                            {/* Amount Input */}
                            <div className="w-full sm:w-28 shrink-0">
                              <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Monto (S/):</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={split.amount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = (manualPaymentModal.paymentSplits || []).map((p, i) =>
                                    i === idx ? { ...p, amount: val } : p
                                  );
                                  setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                }}
                                className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-emerald-300 font-mono font-black focus:border-purple-400"
                              />
                            </div>

                            {/* Delete Row */}
                            {(manualPaymentModal.paymentSplits || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (manualPaymentModal.paymentSplits || []).filter((_, i) => i !== idx);
                                  setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors self-end sm:self-center"
                                title="Eliminar este método"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Balance / Difference Checker */}
                      {(() => {
                        const totalSplits = (manualPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                        const diff = Number((manualPaymentModal.price - totalSplits).toFixed(2));
                        const isBalanced = Math.abs(diff) < 0.01;

                        return (
                          <div
                            className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold ${isBalanced
                              ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                              : diff > 0
                                ? "bg-amber-950/50 border-amber-500/40 text-amber-300"
                                : "bg-red-950/50 border-red-500/40 text-red-300"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>Precio Total: <strong>S/ {manualPaymentModal.price.toFixed(2)}</strong></span>
                              <span>•</span>
                              <span>Suma Desglose: <strong>S/ {totalSplits.toFixed(2)}</strong></span>
                            </div>
                            <div>
                              {isBalanced ? (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span>Cuadra Exacto (S/ {manualPaymentModal.price.toFixed(2)})</span>
                                </span>
                              ) : diff > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const lastIdx = (manualPaymentModal.paymentSplits || []).length - 1;
                                    if (lastIdx >= 0) {
                                      const updated = (manualPaymentModal.paymentSplits || []).map((p, i) =>
                                        i === lastIdx ? { ...p, amount: Number((p.amount + diff).toFixed(2)) } : p
                                      );
                                      setManualPaymentModal({ ...manualPaymentModal, paymentSplits: updated });
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 text-black rounded-lg text-[11px] font-black hover:bg-amber-400 transition-colors shadow"
                                >
                                  Falta S/ {diff.toFixed(2)} (Ajustar)
                                </button>
                              ) : (
                                <span>Excede por S/ {Math.abs(diff).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setManualPaymentModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar y Confirmar en Registro Taller</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE ABONO DE SALDO (TOTAL / PARCIAL POR PLACA) */}
      {/* ========================================================================= */}
      {partialPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-white/20 shadow-2xl bg-[#0d121f]/95 overflow-hidden my-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-emerald-950/30 to-reygas-surface">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Abonar Saldo Pendiente</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                      Total / Parcial
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Registra un abono sobre el saldo pendiente de la placa. El abono figurará como ingreso del día actual y reducirá la deuda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPartialPaymentModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmPartialPaymentSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
              {/* Sección 1: Resumen de Deuda del Vehículo */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>1. Resumen de Deuda por Placa</span>
                </h4>

                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Placa</span>
                    <span className="text-lg font-black text-cyan-300 font-mono">
                      {partialPaymentModal.workOrder?.vehicle_plate}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Cliente</span>
                    <span className="text-sm font-bold text-white">
                      {partialPaymentModal.customerName || "CLIENTES VARIOS"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total Factura</span>
                    <span className="text-sm font-black text-white font-mono">
                      S/ {partialPaymentModal.totalDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Abonado</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      S/ {partialPaymentModal.paidSoFar.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-500/30">
                    <span className="text-[10px] uppercase tracking-wider text-rose-300 font-bold">Saldo Pendiente</span>
                    <span className="text-lg font-black text-rose-300 font-mono">
                      S/ {Math.max(0, partialPaymentModal.totalDue - partialPaymentModal.paidSoFar).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 block mb-1.5 font-bold">Monto a Abonar Ahora (S/) *</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={Math.max(0, partialPaymentModal.totalDue - partialPaymentModal.paidSoFar)}
                      required
                      value={partialPaymentModal.amount || ""}
                      onChange={(e) => setPartialPaymentModal({ ...partialPaymentModal, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 pr-4 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-emerald-400 font-mono font-black text-base focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const bal = Math.max(0, partialPaymentModal.totalDue - partialPaymentModal.paidSoFar);
                        setPartialPaymentModal({
                          ...partialPaymentModal,
                          amount: Number(bal.toFixed(2)),
                          isSplitPayment: false,
                          paymentSplits: [{ id: "split-1", method: "Efectivo", destination: eligibleDestinations[0] || "EMPRESA", amount: Number(bal.toFixed(2)) }],
                        });
                      }}
                      className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-[11px] font-black rounded-lg flex items-center gap-1.5 transition-all shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saldo Total (S/ {Math.max(0, partialPaymentModal.totalDue - partialPaymentModal.paidSoFar).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const quickVal = Math.max(0, Number(((partialPaymentModal.totalDue - partialPaymentModal.paidSoFar) / 2).toFixed(2)));
                        setPartialPaymentModal({ ...partialPaymentModal, amount: quickVal });
                      }}
                      className="px-3 py-1.5 bg-cyan-600/70 hover:bg-cyan-500 text-white text-[11px] font-bold rounded-lg transition-all shadow"
                    >
                      50% (S/ {Math.max(0, Number(((partialPaymentModal.totalDue - partialPaymentModal.paidSoFar) / 2).toFixed(2))).toFixed(2)})
                    </button>
                  </div>
                </div>
              </div>

              {/* Sección 2: Comprobante del Abono */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>2. Comprobante del Abono</span>
                </h4>
                <div>
                  <label className="text-gray-300 block mb-1.5 font-bold">Tipo de Comprobante a Emitir</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["Ticket", "Boleta", "Factura", "Sin Comprobante"] as const).map((type) => {
                      const isSelected = partialPaymentModal.receiptType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            const nextNum = type === "Sin Comprobante" ? "" : getCorrelativePreview(type);
                            const stampedSplits = partialPaymentModal.splitTicketMode === "perMethod" && type !== "Sin Comprobante"
                              ? stampSplitTicketNumbers(
                                partialPaymentModal.paymentSplits || [],
                                nextNum,
                                (type === "Factura" || type === "Boleta" ? type : "Ticket") as "Ticket" | "Boleta" | "Factura"
                              )
                              : partialPaymentModal.paymentSplits;
                            setPartialPaymentModal({ ...partialPaymentModal, receiptType: type, receiptNumber: nextNum, paymentSplits: stampedSplits });
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                            ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                            : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                            }`}
                        >
                          <span>{type === "Ticket" ? "🎟️" : type === "Boleta" ? "🧾" : type === "Factura" ? "📑" : "🚫"}</span>
                          <span>{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1 font-bold">N° Comprobante del Abono</label>
                    <input
                      type="text"
                      placeholder={partialPaymentModal.receiptType === "Sin Comprobante" ? "(Sin comprobante)" : "N° Comprobante"}
                      value={partialPaymentModal.receiptNumber}
                      onChange={(e) => setPartialPaymentModal({ ...partialPaymentModal, receiptNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-amber-300 font-mono font-bold focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Método y Destino del Abono */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>3. Método y Destino del Abono</span>
                </h4>

                <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPartialPaymentModal({ ...partialPaymentModal, isSplitPayment: false })}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${!partialPaymentModal.isSplitPayment
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "text-gray-400 hover:text-white"
                      }`}
                  >
                    💵 Pago Único
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentSplits = (partialPaymentModal.paymentSplits && partialPaymentModal.paymentSplits.length > 0)
                        ? partialPaymentModal.paymentSplits
                        : [
                          {
                            id: "split-1",
                            method: partialPaymentModal.paymentMethod || "Efectivo",
                            destination: partialPaymentModal.paymentDestination || eligibleDestinations[0] || "EMPRESA",
                            amount: partialPaymentModal.amount || 0,
                          },
                        ];
                      setPartialPaymentModal({ ...partialPaymentModal, isSplitPayment: true, paymentSplits: currentSplits });
                    }}
                    className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${partialPaymentModal.isSplitPayment
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-gray-400 hover:text-white"
                      }`}
                  >
                    💳 Pago Mixto / Parcial
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                      {(partialPaymentModal.paymentSplits || []).length}
                    </span>
                  </button>
                </div>

                {!partialPaymentModal.isSplitPayment ? (
                  <div className="space-y-3">
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(["Efectivo", "Yape", "Transferencia", "Culqi", "Sin Método"] as const).map((method) => {
                          const isSelected = method === "Sin Método" ? (!partialPaymentModal.paymentMethod || partialPaymentModal.paymentMethod === "Sin Método") : partialPaymentModal.paymentMethod === method;
                          return (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPartialPaymentModal({ ...partialPaymentModal, paymentMethod: method === "Sin Método" ? "" : method })}
                              className={`p-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isSelected
                                ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]"
                                : "bg-reygas-surface border-white/10 text-gray-300 hover:border-white/30"
                                }`}
                            >
                              <span>{method === "Efectivo" ? "💵" : method === "Yape" ? "📱" : method === "Transferencia" ? "🏦" : method === "Culqi" ? "💳" : "🚫"}</span>
                              <span>{method}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-300 block mb-1 font-bold text-xs">
                        Destino del Abono / Responsable:
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={partialPaymentModal.paymentDestination}
                          onChange={(e) => setPartialPaymentModal({ ...partialPaymentModal, paymentDestination: e.target.value })}
                          className="w-full pl-9 pr-4 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-bold text-white focus:border-emerald-400"
                        >
                          <option value="">(Ninguno / Dejar Vacío)</option>
                          {eligibleDestinations.map((dest) => (
                            <option key={dest} value={dest}>
                              {dest === "EMPRESA" ? "🏢 EMPRESA (Cuenta Principal / Caja)" : `👤 ${dest}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-3.5 rounded-2xl bg-black/40 border border-purple-500/30 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-purple-400" />
                        <span>Desglose de Métodos del Abono</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSum = (partialPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                          const remaining = Math.max(0, Number(((partialPaymentModal.amount || 0) - currentSum).toFixed(2)));
                          const splitsNow = partialPaymentModal.paymentSplits || [];
                          const lastSplit = splitsNow.length > 0 ? splitsNow[splitsNow.length - 1] : undefined;
                          const lastSplitType = (lastSplit?.receipt_type === "Boleta" || lastSplit?.receipt_type === "Factura"
                            ? lastSplit.receipt_type
                            : (partialPaymentModal.receiptType === "Boleta" || partialPaymentModal.receiptType === "Factura" ? partialPaymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
                          const nextTicketNum = partialPaymentModal.splitTicketMode === "perMethod" && partialPaymentModal.receiptType !== "Sin Comprobante"
                            ? (lastSplit?.receipt_number ? incrementReceiptNumber(lastSplit.receipt_number) : (partialPaymentModal.receiptNumber || getCorrelativePreview(lastSplitType)))
                            : undefined;
                          const newSplits = [
                            ...splitsNow,
                            {
                              id: "split-" + Date.now() + "-" + Math.random(),
                              method: "Culqi",
                              destination: eligibleDestinations[0] || "EMPRESA",
                              amount: remaining,
                              ...(nextTicketNum
                                ? { receipt_number: nextTicketNum, receipt_type: lastSplitType }
                                : {}),
                            },
                          ];
                          setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: newSplits });
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Añadir Método</span>
                      </button>
                    </div>

                    {/* Modo de asignación de N° de Comprobante en pago mixto */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 rounded-xl border border-white/10 p-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Asignación de N° de Comprobante:</span>
                      </span>
                      <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/15 text-[11px] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            const clearedSplits = (partialPaymentModal.paymentSplits || []).map((p) => ({
                              ...p,
                              receipt_number: undefined,
                              receipt_type: undefined,
                            }));
                            setPartialPaymentModal({ ...partialPaymentModal, splitTicketMode: "single", paymentSplits: clearedSplits });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all ${partialPaymentModal.splitTicketMode !== "perMethod"
                            ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          🎫 Un solo Comprobante
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentSplits = (partialPaymentModal.paymentSplits && partialPaymentModal.paymentSplits.length > 0)
                              ? partialPaymentModal.paymentSplits
                              : [
                                {
                                  id: "split-1",
                                  method: partialPaymentModal.paymentMethod || "Efectivo",
                                  destination: partialPaymentModal.paymentDestination || "EMPRESA",
                                  amount: partialPaymentModal.amount || 0,
                                },
                              ];
                            const baseType = (partialPaymentModal.receiptType === "Factura" || partialPaymentModal.receiptType === "Boleta" ? partialPaymentModal.receiptType : "Ticket") as "Ticket" | "Boleta" | "Factura";
                            const base = partialPaymentModal.receiptNumber || getCorrelativePreview(baseType);
                            const stamped = stampSplitTicketNumbers(currentSplits, base, baseType);
                            setPartialPaymentModal({ ...partialPaymentModal, splitTicketMode: "perMethod", paymentSplits: stamped });
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${partialPaymentModal.splitTicketMode === "perMethod"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          <Split className="w-3.5 h-3.5" />
                          <span>Comprobante por Método</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {(partialPaymentModal.paymentSplits || []).map((split, idx) => {
                        const splitType = (split.receipt_type === "Boleta" || split.receipt_type === "Factura"
                          ? split.receipt_type
                          : (partialPaymentModal.receiptType === "Boleta" || partialPaymentModal.receiptType === "Factura" ? partialPaymentModal.receiptType : "Ticket")) as "Ticket" | "Boleta" | "Factura";
                        return (
                        <div
                          key={split.id || idx}
                          className="p-2.5 rounded-xl bg-reygas-surface/80 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                        >
                          <span className="text-[10px] font-mono font-bold text-purple-300 w-6 shrink-0 text-center py-1 bg-purple-950/60 rounded-md border border-purple-500/20">
                            #{idx + 1}
                          </span>

                          <div className="flex-1 min-w-[130px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Método:</label>
                            <select
                              value={split.method}
                              onChange={(e) => {
                                const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, method: e.target.value } : p
                                );
                                setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                            >
                              <option value="Efectivo">💵 Efectivo</option>
                              <option value="Culqi">💳 Culqi (Tarjeta)</option>
                              <option value="Yape">📱 Yape</option>
                              <option value="Plin">📱 Plin</option>
                              <option value="Transferencia">🏦 Transferencia BCP</option>
                            </select>
                          </div>

                          <div className="flex-1 min-w-[140px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Destino:</label>
                            <select
                              value={split.destination}
                              onChange={(e) => {
                                const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, destination: e.target.value } : p
                                );
                                setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                            >
                              {eligibleDestinations.map((dest) => (
                                <option key={dest} value={dest}>
                                  {dest === "EMPRESA" ? "🏢 EMPRESA" : `👤 ${dest}`}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tipo + N° de comprobante propio del método (multi-ticket) */}
                          {partialPaymentModal.splitTicketMode === "perMethod" && (
                            <>
                              <div className="w-full sm:w-28 shrink-0">
                                <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Tipo:</label>
                                <select
                                  value={splitType}
                                  onChange={(e) => {
                                    const newType = e.target.value as "Ticket" | "Boleta" | "Factura";
                                    const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx
                                        ? { ...p, receipt_type: newType, receipt_number: getCorrelativePreview(newType) }
                                        : p
                                    );
                                    setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                                  }}
                                  className="w-full px-2 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-white font-bold focus:border-purple-400"
                                >
                                  <option value="Ticket">🎟️ Ticket</option>
                                  <option value="Boleta">🧾 Boleta</option>
                                  <option value="Factura">📑 Factura</option>
                                </select>
                              </div>
                              <div className="w-full sm:w-36 shrink-0">
                                <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">N° Comprobante:</label>
                                <input
                                  type="text"
                                  placeholder={splitType === "Factura" ? "F001-..." : splitType === "Boleta" ? "B001-..." : "TK01-..."}
                                  value={split.receipt_number || ""}
                                  readOnly={!allowEditReceiptNumber}
                                  onChange={(e) => {
                                    const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx ? { ...p, receipt_number: e.target.value } : p
                                    );
                                    setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                                  }}
                                  className={`w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-amber-300 font-mono font-bold focus:border-purple-400 ${!allowEditReceiptNumber ? "opacity-60 cursor-not-allowed" : ""}`}
                                />
                              </div>
                            </>
                          )}

                          <div className="flex-1 min-w-[110px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Monto S/:</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={split.amount || ""}
                              onChange={(e) => {
                                const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                  i === idx ? { ...p, amount: parseFloat(e.target.value) || 0 } : p
                                );
                                setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-emerald-400 font-mono font-bold focus:border-purple-400"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={(partialPaymentModal.paymentSplits || []).length <= 1}
                            onClick={() => {
                              const updated = (partialPaymentModal.paymentSplits || []).filter((_, i) => i !== idx);
                              setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                            }}
                            className="px-2 py-1.5 bg-rose-600/70 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        );
                      })}
                    </div>

                    {(() => {
                      const sum = (partialPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      const amount = Number(partialPaymentModal.amount) || 0;
                      const diff = Number((amount - sum).toFixed(2));
                      const isBalanced = Math.abs(diff) <= 0.01;
                      return (
                        <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${isBalanced
                          ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                          : "bg-amber-950/50 border-amber-500/30 text-amber-300"
                          }`}>
                          <span>Total desglosado: S/ {sum.toFixed(2)}</span>
                          {isBalanced ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Cuadrado
                            </span>
                          ) : diff > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const lastIdx = (partialPaymentModal.paymentSplits || []).length - 1;
                                const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                  i === lastIdx ? { ...p, amount: Number((Number(p.amount) + diff).toFixed(2)) } : p
                                );
                                setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                              }}
                              className="px-2.5 py-1 bg-amber-500 text-black rounded-lg text-[11px] font-black hover:bg-amber-400 transition-colors shadow"
                            >
                              Falta S/ {diff.toFixed(2)} (Ajustar)
                            </button>
                          ) : (
                            <span>Excede por S/ {Math.abs(diff).toFixed(2)}</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Sección 4: Observación y Responsable del Saldo Pendiente */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>4. Observación y Responsable del Saldo Pendiente</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-300 block mb-1.5 font-bold">
                      Responsable del Saldo (Opcional)
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={partialPaymentModal.responsible || ""}
                        onChange={(e) => setPartialPaymentModal({ ...partialPaymentModal, responsible: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-bold text-white focus:border-rose-400"
                      >
                        <option value="">(Sin responsable asignado)</option>
                        {debtResponsibles.map((name) => (
                          <option key={name} value={name}>
                            👤 {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Solo aparece el personal con el flag "Responsable de Saldo" activado en Tabla Maestra de Personal.
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1.5 font-bold">
                      Observación del Saldo (Opcional)
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-rose-400 absolute left-3 top-3" />
                      <textarea
                        rows={2}
                        placeholder="Ej: SE PROGRAMA A CANCELAR EL DIA 31/07"
                        value={partialPaymentModal.observation || ""}
                        onChange={(e) => setPartialPaymentModal({ ...partialPaymentModal, observation: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-rose-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPartialPaymentModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Abono (Ingreso del Día)</span>
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
          paymentBreakdown={activeReceiptModal.paymentBreakdown || activeReceiptModal.invoice?.payment_breakdown}
          issuedAt={activeReceiptModal.issuedAt}
        />
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE DAILY WORKSHOP & CASH REPORT MODAL */}
      {/* ========================================================================= */}
      <DailyWorkshopReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        initialTab="caja"
      />
    </div>
  );
}

