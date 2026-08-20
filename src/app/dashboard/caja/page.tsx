"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore, PaymentSplit, PaymentRecord, PaymentResource } from "@/lib/store/app-store";
import {
  buildVehicleCreditSettlementMap,
  parseSplitPaymentString,
} from "@/lib/utils/credit-tracker";
import { getWorkshopCSVRecord, WORKSHOP_CSV_LOOKUP } from "@/lib/workshop-csv-lookup";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { getPeruDateString, formatPeruDateTime, formatPeruDate, buildPeruISOString, toPeruDateKey } from "@/lib/utils/date-utils";
import { formatPlate, titleCase, capitalizeFirst } from "@/lib/utils/text-format";
import { cleanMethodDisplay, defaultMethodFrom, sanitizeMethod } from "@/lib/utils/payment-method";
import { logSystemEvent, logTiming } from "@/lib/system-log";
import { lookupPlateClientData } from "@/lib/utils/plate-autofill";
import { fetchDailyExpenses, saveDailyExpenses, DailyExpense } from "@/lib/supabase/expenses";
import { supabase } from "@/lib/supabase/client";
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
  Edit3,
  ChevronDown,
  ChevronUp,
  ReceiptText,
  Wallet,
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
    updateInvoice,
    updateWorkOrderStatus,
    undoLastPayment,
    deletePaymentRecord,
    updatePaymentRecord,
    clearInvoicePayments,
    confirmInvoicePayment,
    registerDirectWorkshopPayment,
    registerInvoicePayment,
    toggleAllowModificationsInWorkshop,
    createWorkOrder,
    deleteWorkOrder,
  } = useAppStore();

  // Configuración: si está permitido editar el N° de ticket/boleta/factura al confirmar el pago
  const allowEditReceiptNumber = correlativeConfig?.allowEditReceiptNumber !== false;

  const [activeMainTab, setActiveMainTab] = useState<"caja" | "consultas">("caja");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"hoy" | "pendientesHoy" | "pendientes" | "pagados" | "todos">("hoy");
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<"TODOS" | "Ticket" | "Boleta" | "Factura">("TODOS");

  // Search Filters
  const [searchPlate, setSearchPlate] = useState("");
  const deferredSearchPlate = React.useDeferredValue(searchPlate);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"todos" | "pendientes" | "pagados">("todos");
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  // Cards de placas colapsadas POR DEFECTO (se guardan los ids EXPANDIDOS; vacío = todas colapsadas)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Confirmación en dos pasos para "Borrar todos los pagos" de una card
  const [confirmClearCard, setConfirmClearCard] = useState<string | null>(null);

  // HISTORIAL EN VIVO desde Supabase: cuando el store local no tiene el payment_history
  // de una factura (por quedar fuera de la ventana de 1000 pagadas recientes, ej. pagos
  // con fecha 17/08), se consulta el snapshot inv_payhistory_* directo para que la card
  // SIEMPRE muestre el historial de pago y permita editar, sin depender del caché local.
  const [livePayhistory, setLivePayhistory] = useState<Record<string, any[]>>({});
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await supabase
          .from("site_content")
          .select("key, value")
          .like("key", "inv_payhistory_%");
        if (!active) return;
        const map: Record<string, any[]> = {};
        (res.data || []).forEach((row: any) => {
          const k = row.key || row.section_key;
          if (!k || !k.startsWith("inv_payhistory_")) return;
          let raw: any = row.value;
          if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
          if (Array.isArray(raw)) map[k.replace("inv_payhistory_", "")] = raw;
        });
        setLivePayhistory(map);
      } catch { /* silencioso */ }
    })();
    return () => { active = false; };
  }, []);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
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
    // Vínculo recurso -> pago (desde 17/08/2026): el cajero marca qué recursos
    // cubre este pago y cuánto de cada uno (pago total o parcial por recurso).
    resourceSelection?: Array<{
      key: string;
      description: string;
      category: "servicio" | "repuesto" | "certificado";
      fullAmount: number;
      pendingAmount?: number; // Saldo pendiente del recurso (total - pagado previo vinculado)
      payAmount: number;
      selected: boolean;
    }>;
    // Modo SOLO VINCULAR: abierto desde una card YA PAGADA para asignar recursos a un
    // pago existente sin re-cobrar (no crea nuevo pago en el historial ni cambia saldos).
    linkOnly?: boolean;
  } | null>(null);

  // Modal State for Partial / Installment Payment (Abonos sobre saldo pendiente por placa)
  const [partialPaymentModal, setPartialPaymentModal] = useState<{
    isOpen: boolean;
    workOrder: any;
    invoice: any;
    totalDue: number;            // Saldo total pendiente de la factura
    paidSoFar: number;           // Monto ya abonado (historial)
    amount: number;              // Abono de este pago (total o parcial)
    paymentDate: string;         // Fecha del pago/abono (por defecto hoy, editable)
    paymentMethod: string;
    paymentDestination: string;
    isSplitPayment?: boolean;
    // Cada split (método/comprobante) lleva SU PROPIA lista de recursos a vincular
    // (splitResources). El Monto Total del split = suma de los recursos marcados.
    paymentSplits?: (PaymentSplit & {
      splitResources?: Array<{
        key: string;
        description: string;
        category: "servicio" | "repuesto" | "certificado";
        fullAmount: number;
        pendingAmount: number; // Saldo pendiente del recurso
        payAmount: number;
        selected: boolean;
      }>;
    })[];
    splitTicketMode?: "single" | "perMethod";
    receiptNumber: string;
    receiptType: "Ticket" | "Boleta" | "Factura" | "Sin Comprobante";
    customerDoc: string;
    customerName: string;
    customerAddress: string;
    observation?: string;        // Observación del saldo pendiente / abono
    responsible?: string;        // Responsable del saldo pendiente (FRANCO, JAIME, ...)
    // Vínculo recurso -> pago (desde 17/08/2026): qué recursos cubre este abono.
    resourceSelection?: Array<{
      key: string;
      description: string;
      category: "servicio" | "repuesto" | "certificado";
      fullAmount: number;
      pendingAmount?: number; // Saldo pendiente del recurso (abonos: total - pagado previo)
      payAmount: number;
      selected: boolean;
    }>;
    // Modo EDICIÓN de un comprobante existente (abierto desde el historial de la card):
    // el mismo modal sirve para crear y para editar (guarda en el mismo registro).
    editingRecordId?: string;
    editingRecordAmount?: number; // Monto original del registro al abrir en edición
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

  // Modal de GASTOS del día (egresos de caja)
  const [expenseModal, setExpenseModal] = useState<{
    isOpen: boolean;
    description: string;
    amount: number;
    destination: string;
    deliveredTo: string;
    date: string;
  }>({
    isOpen: false,
    description: "",
    amount: 0,
    destination: "EMPRESA",
    deliveredTo: "",
    date: getPeruDateString(),
  });

  // Gastos registrados para la fecha consultada
  const [dayExpenses, setDayExpenses] = useState<DailyExpense[]>([]);

  // Cargar gastos de la fecha consultada
  React.useEffect(() => {
    let active = true;
    fetchDailyExpenses(queryDate || getPeruDateString()).then((list) => {
      if (active) setDayExpenses(list || []);
    });
    return () => {
      active = false;
    };
  }, [queryDate]);

  // Personal del ROSTER Y PERMISOS para el campo "Entregado a"
  const rosterPersonnel = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    (technicians || [])
      .filter((t) => t.is_active !== false)
      .forEach((t) => {
        const name = ((t.payment_nickname || t.full_name) || "").trim().toUpperCase();
        if (name && !seen.has(name)) {
          seen.add(name);
          list.push(name);
        }
      });
    return list;
  }, [technicians]);

  const handleSaveExpense = async () => {
    if (!expenseModal.isOpen) return;
    const desc = expenseModal.description.trim();
    const amount = Number(expenseModal.amount) || 0;
    const dest = (expenseModal.destination || "EMPRESA").trim().toUpperCase();
    const to = (expenseModal.deliveredTo || "").trim().toUpperCase();
    const date = (expenseModal.date || getPeruDateString()).slice(0, 10);
    if (!desc) { notify("error", "Escribe una descripción del gasto"); return; }
    if (amount <= 0) { notify("error", "El monto del gasto debe ser mayor a 0"); return; }
    if (!to) { notify("error", "Selecciona a quién se entregó el dinero"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { notify("error", "Selecciona la fecha del gasto"); return; }

    const expId = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Registro en la TABLA MAESTRA (Registro del Taller): se crea una Work Order
    // con placa "GASTO" para que el egreso aparezca en el registro del taller
    // (misma mecánica que el Cobro Manual). La placa "GASTO" se filtra de las
    // vistas operativas (Caja/Taller/Consultas) y solo se muestra en Tabla Maestra
    // y en el informe diario (como egreso).
    const woId = `gasto-${date}-${expId}`;
    const gastoItem = {
      id: `item-${expId}`,
      item_type: "servicio" as const,
      description: desc,
      quantity: 1,
      unit_price: amount,
      subtotal: amount,
    };
    const gastoDate = new Date(date + "T12:00:00");
    const entryISO = date === getPeruDateString()
      ? new Date().toISOString()
      : gastoDate.toISOString();
    createWorkOrder({
      id: woId,
      vehicle_plate: "GASTO",
      status: "finalizado",
      problem_description: `GASTO: ${desc}`,
      general_maintenance_service: `GASTO: ${desc}`,
      spare_parts_services: `Destino: ${dest} · Entregado a: ${to}`,
      assigned_technician_id: to,
      entry_time: entryISO,
      completion_time: entryISO,
      items: [gastoItem],
      observations: `Gasto de caja · Destino: ${dest} · Entregado a: ${to} · S/ ${amount.toFixed(2)}`,
      requires_certification: false,
      certification_price: 0,
      allow_modifications: true,
    });

    const newExpense: DailyExpense = {
      id: expId,
      date,
      description: desc,
      amount,
      destination: dest,
      delivered_to: to,
      created_at: new Date().toISOString(),
      wo_id: woId,
    };
    const existing = await fetchDailyExpenses(date);
    const ok = await saveDailyExpenses(date, [...existing, newExpense]);
    if (!ok) {
      notify("error", "No se pudo guardar el gasto en la nube");
      return;
    }
    notify("success", `Gasto de S/ ${amount.toFixed(2)} registrado en la Tabla Maestra (${desc.slice(0, 24)})`);
    setExpenseModal({ isOpen: false, description: "", amount: 0, destination: "EMPRESA", deliveredTo: "", date });
    if (date === (queryDate || getPeruDateString()).slice(0, 10)) {
      setDayExpenses(await fetchDailyExpenses(date));
    }
  };

  const handleDeleteExpense = async (expId: string) => {
    const date = (queryDate || getPeruDateString()).slice(0, 10);
    const list = await fetchDailyExpenses(date);
    const target = list.find((e) => e.id === expId);
    const next = list.filter((e) => e.id !== expId);
    const ok = await saveDailyExpenses(date, next);
    if (ok) {
      // Si el gasto estaba registrado en la Tabla Maestra, eliminar también su fila "GASTO"
      if (target?.wo_id) {
        try {
          deleteWorkOrder(target.wo_id);
        } catch {
          // el borrado de la work order ya se propaga vía realtime/delete
        }
      }
      setDayExpenses(next);
      notify("success", "Gasto eliminado");
    } else {
      notify("error", "No se pudo eliminar el gasto");
    }
  };

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
    pagoResumen?: { montoTotal: number; montoActual: number; montoPagadoAcumulado: number };
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
        // Si el personal tiene SOBRENOMBRE para Destino de Pago (Tabla Maestra), se usa ese
        // en lugar del nombre completo como opción del destino.
        const name = ((t.payment_nickname || t.full_name) || "").trim().toUpperCase();
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
        // Si el personal tiene SOBRENOMBRE para Destino de Pago (Tabla Maestra), se usa ese
        // en lugar del nombre completo como opción del destino.
        const name = ((t.payment_nickname || t.full_name) || "").trim().toUpperCase();
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

  // Vehículos que AÚN están en taller (no han culminado el trabajo): NO son crédito.
  // No deben contarse como "pendientes de cobro" (solo órdenes terminadas con saldo
  // deudor o crédito real son cuentas por cobrar). Ej.: H2W-236 esperando repuestos.
  const inWorkshopStatuses = new Set(["ingresado", "en_diagnostico", "esperando_repuestos", "en_servicio"]);
  const isInWorkshopNotCredit = (wo: any, inv?: any) =>
    inWorkshopStatuses.has(wo?.status) && !((inv?.credit_amount || 0) > 0);

  // Comprehensive, real-time function to determine if order is paid or pending credit
  const isOrderPaid = React.useCallback((wo: any, inv?: any) => {
    if (!wo && !inv) return false;

    // 0. Explicit payment status flags have HIGHEST priority (user action).
    // La factura PAGADA manda: si una OT quedó con estado viejo (por_cobrar/pendiente_pago)
    // tras un bug o una reparación, una factura en "pagado" se lee como PAGADA (saldo 0).
    if (inv?.payment_status === "pagado" || wo?.status === "pagado_autorizado" || wo?.status === "finalizado") {
      return true;
    }

    if (inv?.payment_status === "pendiente" || wo?.status === "por_cobrar" || wo?.status === "pendiente_pago") {
      return false;
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

  // Total REAL ya pagado de una factura: el historial de pagos, o si está vacío/incompleto
  // el pago implícito (total - crédito). Evita que un abono "borre" el adelanto previo
  // (ej. BBF-936: total 450, crédito 50 => ya pagado 400 aunque el historial esté vacío).
  const invoicePaidSoFar = React.useCallback((inv?: any) => {
    const grand = Number(inv?.grand_total) || 0;
    const credit = Number(inv?.credit_amount) || 0;
    const hist = Array.isArray(inv?.payment_history) ? inv.payment_history : [];
    const histSum = hist.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    // Solo con crédito (saldo pendiente) el "total - crédito" representa un pago previo
    // (adelanto) aunque el historial esté vacío. Sin crédito, el pagado es el historial.
    if (credit > 0) return Math.max(histSum, grand - credit);
    return histSum;
  }, []);

  // Helper to compute correct Net Total considering Taller discount_amount and Invoice
  const computeOrderNetTotal = React.useCallback((wo: any, inv?: any) => {
    const partsSum = (wo.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    const certFee = wo.requires_certification ? (wo.certification_price || 0) : 0;
    const gross = partsSum + certFee;
    const discount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);
    const otTotal = Math.max(0, gross - discount);

    // BUG FIX (BAG-123 22:02): si la factura quedó pendiente SIN pagos (ej. se desmarcó un
    // pago y luego Taller cambió el precio), su grand_total es el VIEJO y la card de Caja
    // mostraba el precio anterior aunque la OT ya tuviera el nuevo. El total visible debe
    // ser el de la OT (dato más reciente) cuando la factura NO tiene pagos registrados.
    // Solo facturas con historial de pagos/abonos o PAGADAS conservan su propio total.
    const hist = Array.isArray(inv?.payment_history) ? inv.payment_history : [];
    const isInvPaid = inv?.payment_status === "pagado" || (inv?.payment_condition || "").toUpperCase().includes("PAGADO");
    const hasPayments = hist.length > 0 || (Number(inv?.credit_amount) > 0 && Number(inv?.credit_amount) < (Number(inv?.grand_total) || 0));

    if (inv?.grand_total !== undefined && inv.grand_total > 0 && hasPayments && (!wo.discount_amount || inv.discounts === wo.discount_amount)) {
      return inv.grand_total;
    }
    if (inv?.grand_total !== undefined && inv.grand_total > 0 && isInvPaid && (!wo.discount_amount || inv.discounts === wo.discount_amount)) {
      return inv.grand_total;
    }
    return otTotal;
  }, []);

  // Orders that reached billing or have an invoice registered
  const allBillingWorkOrders = React.useMemo(() => {
    return workOrders.filter((wo) => {
      // Las filas "GASTO" (egresos de caja) se registran en la Tabla Maestra,
      // pero NO se muestran como cards de cobro en Caja (se ven en el panel Gastos).
      if ((wo.vehicle_plate || "").toUpperCase() === "GASTO") return false;
      const inv = invoicesByWorkOrderId.get(wo.id);
      const total = computeOrderNetTotal(wo, inv);
      const hasItems = (wo.items || []).length > 0;
      const receiptNum = (inv?.receipt_number || "").trim();
      const hasReceipt = receiptNum && receiptNum !== "0";
      const isPaid = isOrderPaid(wo, inv);

      // Include if it's a valid billing order (has items or price or receipt) OR if it is
      // pending payment OR if it is ALREADY PAID: el filtro "Pagados" del día debe mostrar
      // las cards cobradas aunque la OT no tenga ítems/precio/comprobante persistido
      // (ej. re-ingreso del 17/08 con OTs en pagado_autorizado sin items -> antes quedaban
      // fuera porque la factura vinculada podía faltar en la ventana del store local).
      return total > 0 || hasItems || hasReceipt || !isPaid || isPaid;
    });
  }, [workOrders, invoicesByWorkOrderId, isOrderPaid, computeOrderNetTotal]);

  // ¿La factura tiene un pago (historial) registrado en la fecha indicada?
  // Se usa en lugar de paid_at: el paid_at de muchas facturas históricas fue
  // sobrescrito en bloque (18/08) y ya no es confiable para filtrar por día.
  const hasPaymentOnDate = React.useCallback((inv: any, date: string) => {
    if (!inv || !date) return false;
    const history: any[] = Array.isArray(inv.payment_history) ? inv.payment_history : [];
    return history.some((p: any) => toPeruDateKey(p.date) === date);
  }, []);

  // Daily cash closure calculation for selected date
  const totalPaidToday = React.useMemo(() => {
    return allBillingWorkOrders
      .filter((wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
        const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
        const paidDateStr = inv?.paid_at ? toPeruDateKey(inv.paid_at) : "";
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
        const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
        const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
        const matchesDate = orderDateStr === queryDate || invoiceDateStr === queryDate;
        return matchesDate && !isOrderPaid(wo, inv) && !isInWorkshopNotCredit(wo, inv);
      })
      .reduce((sum, wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const credit = inv?.credit_amount && inv.credit_amount > 0
          ? inv.credit_amount
          : computeOrderNetTotal(wo, inv);
        return sum + credit;
      }, 0);
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid, computeOrderNetTotal]);

  // LOG DE ESTADO DE CARDS (diagnóstico): detecta estados inconsistentes para saber qué
  // ocurrió en el instante. Ej: card PENDIENTE con saldo 0 (bug "CRÉDITO PENDIENTE S/ 0.00")
  // o card con factura pero sin historial. Se loguea UNA vez por placa+estado (ref).
  const stateLogRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      allBillingWorkOrders.slice(0, 120).forEach((wo: any) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const isPaid = isOrderPaid(wo, inv);
        const totalDue = computeOrderNetTotal(wo, inv);
        const hist = Array.isArray(inv?.payment_history) ? inv.payment_history : [];
        const paid = hist.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const saldo = Math.max(0, totalDue - paid);
        const key = String(wo.id).slice(0, 8) + "|" + wo.status + "|" + (isPaid ? "P" : "N") + "|" + saldo.toFixed(2);
        if (stateLogRef.current.has(key)) return;
        stateLogRef.current.add(key);
        if (!isPaid && saldo === 0 && totalDue > 0) {
          logSystemEvent("warn", "caja.card_saldo_0_pendiente", {
            plate: wo.vehicle_plate || "",
            woId: String(wo.id).slice(0, 8),
            status: wo.status,
            totalDue,
            paid,
            invId: inv?.id ? String(inv.id).slice(0, 26) : null,
            invTotal: inv?.grand_total || 0,
            invCredit: inv?.credit_amount || 0,
            histCount: hist.length,
          }, "Caja:card-estado");
        } else if (inv && hist.length === 0 && (inv.payment_status === "pagado" || wo.status === "pagado_autorizado")) {
          logSystemEvent("warn", "caja.card_pagada_sin_historial", {
            plate: wo.vehicle_plate || "",
            woId: String(wo.id).slice(0, 8),
            status: wo.status,
            invId: String(inv.id).slice(0, 26),
            invTotal: inv.grand_total || 0,
            invStatus: inv.payment_status || "",
          }, "Caja:card-estado");
        } else {
          logSystemEvent("info", "caja.card_estado", {
            plate: wo.vehicle_plate || "",
            woId: String(wo.id).slice(0, 8),
            status: wo.status,
            isPaid,
            totalDue,
            paid,
            saldo,
            invId: inv?.id ? String(inv.id).slice(0, 26) : null,
          }, "Caja:card-estado");
        }
      });
    } catch {
      // noop: el log jamás rompe el render
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate]);

  // TIMING DE RENDER DE CARDS: mide cuánto tarda en actualizarse la lista de cards de
  // Caja cuando cambian los datos (realtime/sync). Con un ref del último tiempo se registra
  // el costo de render (ms) y cuántas cards se pintan.
  const cardRenderRef = React.useRef<{ count: number; last: number } | null>(null);
  React.useEffect(() => {
    try {
      const count = allBillingWorkOrders.length;
      const prev = cardRenderRef.current;
      const nowMs = Date.now();
      if (prev && prev.count === count && nowMs - prev.last > 300) {
        // Solo mide cuando el conteo cambió o tras >300ms (evita registrar cada re-render)
        return;
      }
      if (!prev) {
        cardRenderRef.current = { count, last: nowMs };
        return;
      }
      logTiming("caja.cards.render.duration", prev.last, {
        cards: count,
        delta: count - prev.count,
      }, "Caja:render-cards");
      cardRenderRef.current = { count, last: nowMs };
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBillingWorkOrders]);

  const pendingCountToday = React.useMemo(() => {
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      // Pendientes del DÍA = registrados HOY (fecha de ingreso al taller), sin pagar.
      // NO se cruza con la fecha de emisión de la factura: una orden registrada el 13/08
      // facturada hoy NO es un pendiente del día de hoy.
      const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
      return orderDateStr === queryDate && !isOrderPaid(wo, inv) && !isInWorkshopNotCredit(wo, inv);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid]);

  const pendingCount = React.useMemo(() => {
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      return !isOrderPaid(wo, inv) && !isInWorkshopNotCredit(wo, inv);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, isOrderPaid]);

  const paidCount = React.useMemo(() => {
    const targetDate = queryDate || getPeruDateString();
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      if (!isOrderPaid(wo, inv)) return false;
      const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
      const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
      return orderDateStr === targetDate || invoiceDateStr === targetDate || hasPaymentOnDate(inv, targetDate);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, isOrderPaid, hasPaymentOnDate]);

  const todayCount = React.useMemo(() => {
    const targetDate = queryDate || getPeruDateString();
    return allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
      const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
      return orderDateStr === targetDate || invoiceDateStr === targetDate || hasPaymentOnDate(inv, targetDate);
    }).length;
  }, [allBillingWorkOrders, invoicesByWorkOrderId, queryDate, hasPaymentOnDate]);

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
      if (isInWorkshopNotCredit(wo, inv)) return;
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
        // Del Día / Hoy: con actividad REAL en la fecha (ingreso, emisión o pago del
        // historial). NO se usa paid_at: fue sobrescrito en bloque en muchas facturas.
        // FLUJO COBRO: se EXCLUYEN las OTs que siguen en Taller (en_servicio/diagnóstico/
        // repuestos) y NO fueron enviadas a cobrar: su card no debe aparecer en Caja
        // hasta que Taller pulse "Enviar a Cobrar" (evita cobrar una OT a medio editar).
        const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
        const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
        const inWorkshopNotSent = isInWorkshopNotCredit(wo, inv);
        matchStatus = !inWorkshopNotSent && (orderDateStr === targetDate || invoiceDateStr === targetDate || hasPaymentOnDate(inv, targetDate));
      } else if (activeStatusFilter === "pendientesHoy") {
        // Pendientes del día / hoy: sin pagar y con fecha de REGISTRO (ingreso al taller) = hoy.
        // Las órdenes registradas en días anteriores (aunque se facturen hoy) NO entran aquí.
        // Se excluyen los vehículos que AÚN están en taller (no son crédito).
        const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
        matchStatus = !isPaid && orderDateStr === targetDate && !isInWorkshopNotCredit(wo, inv);
      } else if (activeStatusFilter === "pendientes") {
        // Pendientes totales (histórico): cuentas por cobrar reales (sin pagar en cualquier
        // fecha), excluyendo vehículos que aún están en taller (no son crédito).
        matchStatus = !isPaid && !isInWorkshopNotCredit(wo, inv);
      } else if (activeStatusFilter === "pagados") {
        // Pagados de la fecha seleccionada (ingreso/emisión/pago real de ese día)
        const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
        const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
        matchStatus = isPaid && (orderDateStr === targetDate || invoiceDateStr === targetDate || hasPaymentOnDate(inv, targetDate));
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

  // =========================================================================
  // BÚSQUEDA BAJO DEMANDA EN TODA LA BASE (historial completo por placa)
  // Mantiene la web RÁPIDA: NO se descarga el histórico completo (41k+ órdenes).
  // Cuando el usuario escribe una placa que NO está en la ventana cargada, se
  // consulta Supabase directamente por esa placa (órdenes + facturas) y se
  // muestran al inicio de la lista con una etiqueta de "historial completo".
  // =========================================================================
  const normalizeRemoteWorkOrder = (w: any) => {
    let items: any[] = [];
    try {
      items = typeof w.items === "string" ? JSON.parse(w.items || "[]") : (w.items || []);
    } catch {
      items = [];
    }
    return { ...w, items };
  };

  const [remoteSearch, setRemoteSearch] = useState<{
    loading: boolean;
    results: any[];
    invoices: any[];
  }>({ loading: false, results: [], invoices: [] });

  React.useEffect(() => {
    const term = (searchPlate || "").trim().toUpperCase();
    // Solo en el filtro "Todos": en Pendientes la deuda real ya está cargada localmente.
    if (term.length < 3 || activeStatusFilter !== "todos") {
      setRemoteSearch((s) =>
        s.loading || s.results.length > 0 ? { loading: false, results: [], invoices: [] } : s
      );
      return;
    }
    const localHits = allBillingWorkOrders.some(
      (wo) => wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term)
    );
    if (localHits) {
      setRemoteSearch((s) =>
        s.loading || s.results.length > 0 ? { loading: false, results: [], invoices: [] } : s
      );
      return;
    }
    let cancelled = false;
    setRemoteSearch((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const { data: wos } = await supabase
          .from("work_orders")
          .select("*")
          .ilike("vehicle_plate", "%" + term + "%")
          .order("entry_time", { ascending: false })
          .limit(40);
        const woIds = (wos || []).map((w: any) => w.id);
        let invs: any[] = [];
        if (woIds.length > 0) {
          const { data: invData } = await supabase
            .from("invoices")
            .select("*")
            .in("work_order_id", woIds)
            .limit(200);
          invs = invData || [];
          // Adjuntar el HISTORIAL DE PAGOS (snapshots inv_payhistory_<id>) a las facturas
          // del historial completo: así la card muestra los abonos aunque venga de la
          // consulta directa (ej. BBF-936 con adelanto 400 + abono 50).
          if (invs.length > 0) {
            const invIds = new Set(invs.map((i: any) => i.id));
            const { data: phSnaps } = await supabase
              .from("site_content")
              .select("key, value")
              .like("key", "inv_payhistory_%");
            const phMap = new Map<string, any[]>();
            (phSnaps || []).forEach((s: any) => {
              const idKey = (s.key || "").replace("inv_payhistory_", "");
              try {
                const val = typeof s.value === "string" ? JSON.parse(s.value) : s.value;
                if (Array.isArray(val)) phMap.set(idKey, val);
              } catch { /* ignore */ }
            });
            invs = invs.map((i: any) => {
              const hist = phMap.get(i.id);
              return hist ? { ...i, payment_history: hist } : i;
            });
          }
        }
        if (cancelled) return;
        setRemoteSearch({
          loading: false,
          results: (wos || []).map(normalizeRemoteWorkOrder),
          invoices: invs,
        });
      } catch {
        if (!cancelled) setRemoteSearch({ loading: false, results: [], invoices: [] });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPlate, activeStatusFilter, allBillingWorkOrders]);

  const remoteInvByWo = React.useMemo(() => {
    const m = new Map<string, any>();
    remoteSearch.invoices.forEach((i: any) => {
      const k = i?.work_order_id || i?.id;
      if (k) m.set(k, i);
    });
    return m;
  }, [remoteSearch.invoices]);

  const combinedInvoicesByWoId = React.useMemo(() => {
    const m = new Map(invoicesByWorkOrderId);
    remoteInvByWo.forEach((v, k) => m.set(k, v));
    return m;
  }, [invoicesByWorkOrderId, remoteInvByWo]);

  const effectiveOrders = React.useMemo(() => {
    if (remoteSearch.results.length === 0) return filteredCajaOrders;
    const seen = new Set(filteredCajaOrders.map((w) => w.id));
    const extra = remoteSearch.results.filter((w) => !seen.has(w.id));
    return [...extra, ...filteredCajaOrders];
  }, [filteredCajaOrders, remoteSearch.results]);

  // Filtered orders for Consultas (Historical Query by Selected Date) Tab
  const filteredConsultasOrders = React.useMemo(() => {
    const term = deferredSearchPlate ? deferredSearchPlate.trim().toUpperCase() : "";

    const filtered = allBillingWorkOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const matchPlate = term ? wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term) : true;

      // Compare date with entry_time or invoice issued_at / paid_at
      const orderDateStr = wo.entry_time ? toPeruDateKey(wo.entry_time) : "";
      const invoiceDateStr = inv?.issued_at ? toPeruDateKey(inv.issued_at) : "";
      const paidDateStr = inv?.paid_at ? toPeruDateKey(inv.paid_at) : "";

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
  const handleOpenPaymentModal = (wo: any, inv?: any, total: number = 0, linkOnly: boolean = false) => {
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
        method: defaultMethodFrom(s.method || "Efectivo"),
        destination: s.destination || eligibleDestinations[0] || "EMPRESA",
        amount: typeof s.amount === "number" ? s.amount : Number(s.amount) || 0,
      }))
      : [
        {
          id: `split-1`,
          method: defaultMethodFrom(inv?.payment_method),
          destination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
          amount: total,
        },
      ];

    const effectiveDiscount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);

    // Vínculo recurso -> pago: SOLO a partir del 17/08/2026 (hora Perú). Los pagos
    // anteriores conservan el flujo clásico (monto único/parcial/mixto sin marcar
    // recursos): no se debe aplicar la selección de recursos a toda la data histórica.
    const linkDateKey = toPeruDateKey((inv as any)?.issued_at || (wo as any).entry_time || "");
    const canLinkResources = linkDateKey >= "2026-08-17";
    // Vínculo recurso -> pago: convierte el desglose de la card en una lista marcable,
    // donde cada recurso lleva su categoría y un monto a pagar editable (pago total o
    // parcial por recurso). Si la factura YA tiene resource_payments (pago previo), se
    // precarga ese vínculo para poder editarlo/verlo. El monto a pagar de cada recurso
    // es su SALDO PENDIENTE (total - abonado previo vinculado): si un recurso ya fue
    // abonado parcialmente, solo se ofrece lo que falta por pagar.
    const existingResources: any[] = Array.isArray((inv as any)?.resource_payments) ? (inv as any).resource_payments : [];
    const payHistoryAll: any[] = Array.isArray((inv as any)?.payment_history) ? (inv as any).payment_history : [];
    const paidByDesc = new Map<string, number>();
    payHistoryAll.forEach((p: any) => {
      if (!Array.isArray(p.resources)) return;
      p.resources.forEach((x: any) => {
        const k = String(x.description || "").trim().toLowerCase();
        paidByDesc.set(k, (paidByDesc.get(k) || 0) + (Number(x.amount) || 0));
      });
    });
    const resourceSelection = canLinkResources ? breakdown.map((b, bi) => {
      const descUp = String(b.description || "").toUpperCase();
      const isCertTxt = /CERTIFIC|ANUAL|QUINQUENAL|CHIP|CILINDRO|CONVERSI|HIDROST/.test(descUp);
      const woItem = (wo.items || []).find((it: any) => it.description === b.description);
      let category: "servicio" | "repuesto" | "certificado" = "servicio";
      if (isCertTxt) category = "certificado";
      else if (woItem && (String(woItem.item_type || "").toLowerCase() === "repuesto" || woItem.inventory_item_id)) category = "repuesto";
      else if (woItem && String(woItem.item_type || "").toLowerCase() === "servicio") category = "servicio";
      const prev = existingResources.find((x: any) => String(x.description || "") === String(b.description || ""));
      const fullAmt = Number(b.subtotal) || 0;
      const alreadyPaid = paidByDesc.get(String(b.description || "").trim().toLowerCase()) || 0;
      const pendingAmt = Math.max(0, fullAmt - alreadyPaid);
      const prevPay = prev ? (Number(prev.amount) || 0) : 0;
      const initPay = pendingAmt > 0.01 ? Math.min(pendingAmt, prevPay > 0 ? prevPay : pendingAmt) : 0;
      return {
        key: `res-${bi}-${String(b.description || "").slice(0, 20).replace(/\s+/g, "-")}`,
        description: b.description,
        category,
        fullAmount: fullAmt,
        pendingAmount: pendingAmt,
        payAmount: Math.round(initPay * 100) / 100,
        selected: initPay > 0.01,
      };
    }) : [];

    setPaymentModal({
      resourceSelection: resourceSelection.length > 0 ? resourceSelection : undefined,
      linkOnly,
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      grandTotal: total,
      breakdownItems: breakdown,
      discountAmount: effectiveDiscount,
      paymentMethod: isZero ? "" : defaultMethodFrom(inv?.payment_method),
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
    // Modo SOLO VINCULAR: no exige método/destino/comprobante (no se cobra de nuevo).
    if (!paymentModal.linkOnly) {
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
    }

    // Vínculo recurso -> pago: si la card ya muestra recursos seleccionables (nuevo
    // flujo), al menos uno debe estar marcado con monto > 0 para confirmar el cobro.
    const selResources = (paymentModal.resourceSelection || []).filter((r) => r.selected && (Number(r.payAmount) || 0) > 0);
    if (!isZeroAmount && paymentModal.resourceSelection && paymentModal.resourceSelection.length > 0 && selResources.length === 0) {
      notify("warning", "Marque al menos un recurso (servicio, repuesto o certificación) a cobrar.");
      return;
    }

    // MODO SOLO VINCULAR: card ya pagada — se asigna recursos al pago existente SIN
    // crear un nuevo cobro ni tocar saldos. El vínculo queda en la factura (resource_payments)
    // y VENTAS POR CONCEPTO lo usa directo. NO se abre comprobante ni se avanza correlativo.
    if (paymentModal.linkOnly) {
      const linked = selResources.map((r) => ({
        description: r.description,
        category: r.category,
        amount: Number(r.payAmount) || 0,
      }));
      if (linked.length === 0) {
        notify("warning", "Marque al menos un recurso para vincular a este pago.");
        return;
      }
      if (paymentModal.invoice?.id) {
        updateInvoice(paymentModal.invoice.id, {
          resource_payments: linked,
        } as any);
        notify("success", `Recursos vinculados al pago de ${paymentModal.workOrder?.vehicle_plate}. VENTAS POR CONCEPTO actualizado.`);
      } else {
        notify("warning", "No se encontró la factura para vincular recursos.");
      }
      setPaymentModal(null);
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

    // Vínculo recurso -> pago: recursos seleccionados con su monto a pagar. Si el
    // cajero marcó recursos (nuevo flujo desde 17/08/2026), el total del pago es la
    // suma de lo seleccionado y el saldo NO cubierto queda como crédito pendiente.
    const selectedResources = (paymentModal.resourceSelection || [])
      .filter((r) => r.selected && (Number(r.payAmount) || 0) > 0)
      .map((r) => ({
        description: r.description,
        category: r.category,
        amount: Number(r.payAmount) || 0,
        receipt_number: assignedReceiptNum || undefined,
        receipt_type: finalReceiptType || undefined,
      }));
    const hasResourceSelection = selectedResources.length > 0;
    const resourceTotal = selectedResources.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    // Si hay selección de recursos, el monto a cobrar ES la suma seleccionada
    // (el resto del total queda pendiente, salvo que cubra todo).
    if (hasResourceSelection && !paymentModal.isSplitPayment) {
      paidSplitAmount = resourceTotal;
      isPartialSplit = paymentModal.grandTotal - resourceTotal > 0.05;
      if (isPartialSplit && paymentBreakdown && paymentBreakdown.length > 0) {
        // Escalar el desglose de métodos al monto seleccionado
        const oldTotal = paymentBreakdown.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        if (oldTotal > 0) {
          const scale = resourceTotal / oldTotal;
          paymentBreakdown = paymentBreakdown.map((p) => ({ ...p, amount: Math.round(Number(p.amount) * scale * 100) / 100 }));
        }
      }
    }

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
        resources: selectedResources.length > 0 ? selectedResources : undefined,
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
        resources: selectedResources.length > 0 ? selectedResources : undefined,
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
        // Resumen de pago: total, monto actual y pagado acumulado (saldo se calcula en el comprobante)
        pagoResumen: {
          montoTotal: paymentModal.grandTotal,
          montoActual: isPartialSplit ? paidSplitAmount : paymentModal.grandTotal,
          montoPagadoAcumulado: (Array.isArray(paymentModal.invoice?.payment_history)
            ? paymentModal.invoice.payment_history.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
            : 0) + (isPartialSplit ? paidSplitAmount : paymentModal.grandTotal),
        },
        issuedAt: new Date().toISOString(),
      });
    }
  };

  // Desmarcar pago de una card: si hay abonos registrados se limpian (para que al
  // re-confirmar NO se duplique el historial); si no hay historial, solo revierte el estado.
  // Confirmación DIRECTA de pago (botones "Confirmar Pago" / "Confirmar Abono Parcial"):
  // registra el saldo pendiente con el método/comprobante de la factura, bloquea la card y
  // NO abre el modal de abono. Si el pago ya está registrado no duplica (solo actualiza si
  // cambió el método o comprobante).
  const handleQuickConfirmPayment = (wo: any, inv?: any) => {
    const totalDue = Number(inv?.grand_total) || 0;
    const woItemsTotal = (wo.items || []).reduce((s: number, it: any) => s + (Number(it.subtotal) || 0), 0);
    const certFee = wo.requires_certification ? (Number(wo.certification_price) || 0) : 0;
    const isZeroAmount = totalDue <= 0.01 && (woItemsTotal + certFee) <= 0.01;

    // Card de MONTO 0 (consulta / revisión sin costo / sin ítems cobrables):
    // confirmar DIRECTAMENTE sin comprobante y sin método de pago.
    if (isZeroAmount) {
      if (inv?.id) {
        updateInvoice(inv.id, {
          payment_status: "pagado",
          payment_condition: "PAGADO",
          paid_at: new Date().toISOString(),
          payment_method: "",
          receipt_type: "Sin Comprobante",
          receipt_number: "",
        });
        updateWorkOrderStatus(wo.id, "pagado_autorizado");
      } else {
        // Crea factura de monto 0 sin método ni comprobante y la marca PAGADA
        createInvoiceForOrder(wo.id, 0, certFee, "");
        toggleOrderPayment(wo.id);
      }
      notify("success", `Atención sin costo de ${wo.vehicle_plate} confirmada como PAGADA (sin comprobante ni método).`);
      return;
    }

    if (!inv?.id) {
      notify("warning", "Esta orden aún no tiene factura para confirmar el pago.");
      return;
    }
    const history: any[] = Array.isArray(inv.payment_history) ? inv.payment_history : [];
    const paidSoFar = invoicePaidSoFar(inv);
    const pending = Math.max(0, totalDue - paidSoFar);

    const methodClean = defaultMethodFrom(inv.payment_method) || "Efectivo";
    const dest = inv.payment_destination || "EMPRESA";
    const receiptType = (inv.receipt_type === "Boleta" || inv.receipt_type === "Factura" ? inv.receipt_type : "Ticket") as "Ticket" | "Boleta" | "Factura";
    const receiptNumber = (inv.receipt_number && inv.receipt_number !== "0" ? inv.receipt_number : "") || getAndIncrementReceiptNumber(receiptType, queryDate || getPeruDateString());

    if (pending <= 0.01) {
      // El historial ya cubre el total: NO duplicar. Re-bloquear la card a PAGADO
      // (por si se había desmarcado) y actualizar método/comprobante si hubo cambio.
      const wasPaid = inv.payment_status === "pagado" || String(inv.payment_condition || "").toUpperCase().includes("PAGADO") || wo.status === "pagado_autorizado" || wo.status === "finalizado";
      if (!wasPaid) {
        toggleOrderPayment(wo.id, inv.id);
      }
      const lastRec = history[history.length - 1];
      if (lastRec && lastRec.id) {
        const lastMethod = cleanMethodDisplay(lastRec.method, Number(lastRec.amount) || 0) || lastRec.method || "";
        if (lastMethod.toUpperCase() !== methodClean.toUpperCase()) {
          updatePaymentRecord(inv.id, lastRec.id, {
            method: sanitizeMethod(methodClean, Number(lastRec.amount) || 0) || "Efectivo",
            receipt_number: receiptNumber || lastRec.receipt_number || undefined,
            receipt_type: receiptType || lastRec.receipt_type || undefined,
          });
          notify("success", "Pago re-confirmado (sin duplicar) — método/comprobante actualizado.");
        } else {
          notify("success", "Pago re-confirmado y registrado (no se duplicó el historial).");
        }
      } else {
        notify("success", "Pago re-confirmado y registrado.");
      }
      return;
    }

    // Registrar el saldo pendiente como pago directo (método y comprobante de la factura)
    registerInvoicePayment({
      invoiceId: inv.id,
      workOrderId: wo.id,
      amount: Number(pending.toFixed(2)),
      paymentMethod: sanitizeMethod(methodClean) || "Efectivo",
      paymentDestination: dest,
      receiptNumber,
      receiptType,
      paidAt: new Date().toISOString(),
    });
    notify("success", `Pago de S/ ${pending.toFixed(2)} confirmado y registrado para ${wo.vehicle_plate}. Card bloqueada.`);
  };

  const handleDesmarcarPago = (wo: any, invoice?: any) => {
    // Desmarcar pago = revertir a Pendiente de Cobro SIN borrar el historial de pagos:
    // los abonos registrados se conservan (la card queda editable y al re-confirmar
    // no se duplica el historial).
    toggleOrderPayment(wo.id, invoice?.id);
    notify("warning", "Pago de " + wo.vehicle_plate + " desmarcado (Pendiente de Cobro). El historial de pagos se conserva.");
  };

  // Construye la selección de recursos para un ABONO (crédito pendiente). Solo aplica
  // desde el 17/08/2026 (hora Perú): los abonos anteriores NO vinculan recursos.
  // Calcula el SALDO PENDIENTE por recurso (total - abonado previo con vínculo) y
  // reparte el monto de este abono entre los recursos pendientes, permitiendo que un
  // abono parcial cubra solo parte de un recurso (el resto queda pendiente para el
  // próximo abono, que verá SOLO los recursos aún por pagar).
  const buildAbonoResourceSelection = (wo: any, inv?: any, maxAmount: number = 0) => {
    const linkKey = toPeruDateKey((inv as any)?.issued_at || (wo as any).entry_time || "");
    if (linkKey < "2026-08-17") return undefined;
    const items: any[] = Array.isArray(wo?.items) ? wo.items : [];
    const resList: Array<{ description: string; category: "servicio" | "repuesto" | "certificado"; fullAmount: number }> = [];
    items.forEach((it: any) => {
      const amt = Number(it.subtotal) || 0;
      if (amt <= 0) return;
      const descUp = String(it.description || "").toUpperCase();
      const isCertTxt = /CERTIFIC|ANUAL|QUINQUENAL|CHIP|CILINDRO|CONVERSI|HIDROST/.test(descUp);
      const cat = isCertTxt ? ("certificado" as const) : (String(it.item_type || "").toLowerCase() === "repuesto" || it.inventory_item_id ? ("repuesto" as const) : ("servicio" as const));
      resList.push({ description: it.description, category: cat, fullAmount: amt });
    });
    if (wo?.requires_certification && Number(wo.certification_price) > 0) {
      resList.push({
        description: `CERTIFICACIÓN (${wo.certification_type || "GNV/GLP"})`,
        category: "certificado" as const,
        fullAmount: Number(wo.certification_price) || 0,
      });
    }
    if (resList.length === 0) return undefined;

    // Abonado PREVIO por recurso desde el historial con vínculo (rec.resources).
    // Los abonos registrados sin vínculo (antes del 17/08) no descuentan recursos:
    // ese pago previo queda sin asignar y los recursos muestran su saldo pendiente.
    const history: any[] = Array.isArray((inv as any)?.payment_history) ? (inv as any).payment_history : [];
    const paidByDesc = new Map<string, number>();
    history.forEach((p: any) => {
      if (!Array.isArray(p.resources)) return;
      p.resources.forEach((x: any) => {
        const k = String(x.description || "").trim().toLowerCase();
        paidByDesc.set(k, (paidByDesc.get(k) || 0) + (Number(x.amount) || 0));
      });
    });
    const pendientes = resList
      .map((rs) => {
        const paid = paidByDesc.get(String(rs.description || "").trim().toLowerCase()) || 0;
        const pending = Math.max(0, rs.fullAmount - paid);
        return { ...rs, pendingAmount: pending };
      })
      .filter((rs) => rs.pendingAmount > 0.01);
    if (pendientes.length === 0) return undefined;

    // Reparte el monto de este abono entre los recursos pendientes (greedy en orden):
    // si el abono no alcanza a cubrir un recurso completo, se asigna el monto parcial.
    let remaining = Math.max(0, maxAmount);
    return pendientes.map((rs, ri) => {
      const assigned = Math.max(0, Math.min(rs.pendingAmount, remaining));
      remaining = Math.max(0, remaining - assigned);
      return {
        key: `abono-res-${ri}-${String(rs.description || "").slice(0, 20).replace(/\s+/g, "-")}`,
        description: rs.description,
        category: rs.category,
        fullAmount: rs.fullAmount,
        pendingAmount: rs.pendingAmount,
        payAmount: Math.round(assigned * 100) / 100,
        selected: assigned > 0.01,
      };
    });
  };

  // Open Partial / Installment Payment Modal (Abono sobre saldo pendiente por placa)
  const handleOpenPartialPaymentModal = (wo: any, inv?: any) => {
    const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
    const totalDue = computeOrderNetTotal(wo, inv);
    const paidSoFar = invoicePaidSoFar(inv);
    const balance = (inv?.credit_amount && inv.credit_amount > 0)
      ? Number(inv.credit_amount)
      : Math.max(0, totalDue - paidSoFar);
    // LOG DE ESTADO DEL MODAL DE ABONO: registra total/saldo en el instante de abrir el
    // modal, para detectar el caso "CRÉDITO PENDIENTE S/ 0.00" o "abono supera el saldo".
    logSystemEvent("info", "caja.abono_modal_open", {
      plate: wo?.vehicle_plate || "",
      woId: String(wo?.id || "").slice(0, 8),
      invId: inv?.id ? String(inv.id).slice(0, 26) : null,
      invTotal: inv?.grand_total || 0,
      invCredit: inv?.credit_amount || 0,
      totalDue,
      paidSoFar,
      balance,
      status: wo?.status || "",
    }, "Caja:modal-abono");

    const initialType = "Ticket" as "Ticket" | "Boleta" | "Factura";
    const previewNum = inv?.receipt_number && inv.receipt_number !== "0" && inv.receipt_number.toLowerCase() !== "s/n"
      ? inv.receipt_number
      : getCorrelativePreview(initialType);

    // Recursos disponibles para vincular en este abono (solo desde 17/08/2026).
    // Se incrustan en CADA split del desglose: cada método/comprobante lleva su
    // propia lista y su Monto Total = suma de los recursos marcados en ese split.
    const abonoResourcesPool = buildAbonoResourceSelection(wo, inv, balance) || [];
    const initialSplitResources = abonoResourcesPool.map((r) => ({ ...r }));
    // Los recursos vienen PRESELECCIONADOS con su saldo pendiente (el reparto del balance
    // los deja marcados): el monto inicial del abono = suma de los recursos ya marcados,
    // para que la etiqueta muestre "A abonar: S/ 90.00 · Saldo restante: S/ 0.00" desde
    // el inicio y el abono quede "Cuadrado" por defecto (el usuario puede desmarcar).
    const initialMarkedSum = Number(initialSplitResources
      .filter((r) => r.selected && (Number(r.payAmount) || 0) > 0)
      .reduce((s, r) => s + (Number(r.payAmount) || 0), 0)
      .toFixed(2));
    setPartialPaymentModal({
      isOpen: true,
      workOrder: wo,
      invoice: inv,
      totalDue,
      paidSoFar,
      // Con recursos preseleccionados, el monto arranca en su suma; si no hay recursos
      // (factura pre-17/08) se usa el saldo y el monto es editable manual.
      amount: initialSplitResources.length > 0 ? initialMarkedSum : balance, // Por defecto: abonar el saldo total
      paymentDate: getPeruDateString(), // Fecha del pago: hoy por defecto, editable
      // Método limpio (nunca "Mixto (Mixto (...))" anidado) para no re-guardar basura
      paymentMethod: defaultMethodFrom(inv?.payment_method),
      paymentDestination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
      isSplitPayment: true,
      paymentSplits: [
        {
          id: `split-1`,
          method: defaultMethodFrom(inv?.payment_method),
          destination: inv?.payment_destination || eligibleDestinations[0] || "EMPRESA",
          amount: initialSplitResources.length > 0 ? initialMarkedSum : balance,
          // Recursos de ESTE comprobante: se van sumando al Monto Total del split
          splitResources: initialSplitResources.length > 0 ? initialSplitResources : undefined,
        },
      ],
      receiptNumber: previewNum,
      receiptType: initialType,
      customerDoc: inv?.customer_doc || "",
      customerName: inv?.client_name || vehicle?.owner_name || "CLIENTES VARIOS",
      customerAddress: inv?.customer_address || "-",
      observation: inv?.debt_observation || inv?.observations || wo.observations || "",
      responsible: inv?.debt_responsible || "",
      resourceSelection: abonoResourcesPool.length > 0 ? abonoResourcesPool : undefined,
    });
  };

  // Submit partial / installment payment (abono)
  const handleConfirmPartialPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialPaymentModal) return;

    // El monto del abono se DERIVA de la suma de recursos marcados: en PAGO MIXTO
    // se suman los recursos de TODOS los métodos (splitResources); en Pago Único
    // la selección global. El campo "Monto a Abonar Ahora" ya no existe.
    const splitResSum = Array.isArray(partialPaymentModal.paymentSplits)
      ? (partialPaymentModal.paymentSplits as any[]).reduce((acc, sp) => acc + (Array.isArray(sp.splitResources) ? sp.splitResources.filter((r2: any) => r2.selected).reduce((s2: number, r2: any) => s2 + (Number(r2.payAmount) || 0), 0) : 0), 0)
      : 0;
    const selectedSum = splitResSum > 0
      ? splitResSum
      : (partialPaymentModal.resourceSelection || [])
          .filter((r) => r.selected && (Number(r.payAmount) || 0) > 0)
          .reduce((s, r) => s + (Number(r.payAmount) || 0), 0);
    // Monto del abono: recursos marcados; si no hay recursos (factura pre-17/08), la suma
    // real de los montos editados manualmente en el desglose (evita que el monto global
    // desincronizado bloquee el submit cuando el usuario ajusta un método a mano).
    const totalSplitsSum = (partialPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const amount = selectedSum > 0
      ? Number(selectedSum.toFixed(2))
      : (totalSplitsSum > 0 ? Number(totalSplitsSum.toFixed(2)) : (Number(partialPaymentModal.amount) || 0));
    // Recalcula el saldo real con el pago implícito (adelanto) para que al abonar el saldo
    // total el crédito quede en 0 (fix BBF-936: antes quedaba total - abono como falso saldo).
    const invForBalance = partialPaymentModal.invoice;
    const paidSoFarReal = invoicePaidSoFar(invForBalance);
    // EN EDICIÓN: el pago que se está editando YA está contado en paidSoFarReal (historial).
    // Se excluye su monto original del "ya pagado" para que el saldo disponible refleje el
    // estado ANTES de este comprobante; si no, al cambiar solo la fecha se bloqueaba con
    // "El abono supera el saldo pendiente (S/ 0.00)" (el saldo era el propio pago).
    const editingExcluded = partialPaymentModal.editingRecordId
      ? (Number(partialPaymentModal.editingRecordAmount) || 0)
      : 0;
    const balance = Math.max(0, partialPaymentModal.totalDue - Math.max(0, paidSoFarReal - editingExcluded));
    if (amount <= 0) {
      notify("warning", "Marque al menos un recurso con monto a pagar para registrar el abono.");
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

    // Vínculo recurso -> pago en abonos: en PAGO MIXTO cada método/comprobante lleva
    // SUS propios recursos (splitResources) con su N° de comprobante; en Pago Único
    // se usa la selección global. Cada recurso va con el comprobante que lo cubre.
    const abonoResources: PaymentResource[] = [];
    if (partialPaymentModal.isSplitPayment && Array.isArray(partialPaymentModal.paymentSplits)) {
      (partialPaymentModal.paymentSplits as any[]).forEach((sp) => {
        const recNum = (sp as any).receipt_number || assignedReceiptNum || undefined;
        const recType = (sp as any).receipt_type || finalReceiptType || undefined;
        (Array.isArray((sp as any).splitResources) ? (sp as any).splitResources : [])
          .filter((r2: any) => r2.selected && (Number(r2.payAmount) || 0) > 0)
          .forEach((r2: any) => {
            abonoResources.push({
              description: r2.description,
              category: r2.category,
              amount: Number(r2.payAmount) || 0,
              receipt_number: recNum || undefined,
              receipt_type: recType || undefined,
            });
          });
      });
    } else {
      (partialPaymentModal.resourceSelection || [])
        .filter((r) => r.selected && (Number(r.payAmount) || 0) > 0)
        .forEach((r) => {
          abonoResources.push({
            description: r.description,
            category: r.category,
            amount: Number(r.payAmount) || 0,
            receipt_number: assignedReceiptNum || undefined,
            receipt_type: finalReceiptType || undefined,
          });
        });
    }
    if (partialPaymentModal.resourceSelection && partialPaymentModal.resourceSelection.length > 0 && abonoResources.length === 0) {
      notify("warning", "Marque al menos un recurso (servicio, repuesto o certificación) que cubra este abono.");
      return;
    }
    // Consistencia: la suma de los recursos marcados debe coincidir con el monto del
    // abono (permite abono parcial de un recurso: el monto asignado es lo que se paga).
    const abonoResSum = abonoResources.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    if (abonoResources.length > 0 && Math.abs(abonoResSum - amount) > 0.05) {
      notify("warning", `La suma de los recursos marcados (S/ ${abonoResSum.toFixed(2)}) no coincide con el monto del abono (S/ ${amount.toFixed(2)}). Ajuste los montos de los recursos.`);
      return;
    }

    // Fecha real del pago (por defecto hoy; editable en el modal). El abono se registra
    // en la fecha elegida (afecta al reporte diario de ese día).
    const payTimeNow = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    const paymentDateTime = buildPeruISOString(partialPaymentModal.paymentDate || getPeruDateString(), payTimeNow);

    // MODO EDICIÓN (comprobante existente desde el historial): actualiza el registro,
    // no crea uno nuevo ni reimprime comprobante.
    if (partialPaymentModal.editingRecordId && partialPaymentModal.invoice?.id) {
      updatePaymentRecord(partialPaymentModal.invoice.id, partialPaymentModal.editingRecordId, {
        amount,
        date: paymentDateTime,
        method: sanitizeMethod(finalMethod, amount) || "Efectivo",
        destination: finalDest || "EMPRESA",
        receipt_type: finalReceiptType || undefined,
        receipt_number: assignedReceiptNum || undefined,
        observation: partialPaymentModal.observation || undefined,
        responsible: partialPaymentModal.responsible || undefined,
        resources: abonoResources.length > 0 ? abonoResources : undefined,
      });
      notify("success", `Comprobante de ${partialPaymentModal.workOrder?.vehicle_plate} actualizado (S/ ${amount.toFixed(2)}). Recursos y saldos recalculados.`);
      setPartialPaymentModal(null);
      return;
    }

    registerInvoicePayment({
      invoiceId: partialPaymentModal.invoice?.id,
      workOrderId: partialPaymentModal.workOrder?.id,
      amount,
      paymentMethod: finalMethod,
      paymentDestination: finalDest,
      receiptNumber: assignedReceiptNum,
      receiptType: finalReceiptType,
      paymentBreakdown: paymentBreakdown,
      resources: abonoResources.length > 0 ? abonoResources : undefined,
      observation: partialPaymentModal.observation,
      responsible: partialPaymentModal.responsible,
      paidAt: paymentDateTime,
    });

    notify("success", isFullyPaid
      ? `¡Saldo de ${partialPaymentModal.workOrder?.vehicle_plate} cancelado! Abono de S/ ${amount.toFixed(2)} registrado.`
      : `Abono parcial de S/ ${amount.toFixed(2)} registrado para ${partialPaymentModal.workOrder?.vehicle_plate}. Saldo restante: S/ ${(balance - amount).toFixed(2)}`);

    // Visualización e impresión del comprobante del abono (igual que al confirmar pago)
    if (partialPaymentModal.receiptType !== "Sin Comprobante" && amount > 0) {
      setActiveReceiptModal({
        isOpen: true,
        workOrder: partialPaymentModal.workOrder,
        invoice: partialPaymentModal.invoice,
        receiptType: (finalReceiptType || "Ticket") as any,
        receiptNumber: assignedReceiptNum,
        customerDoc: partialPaymentModal.customerDoc,
        customerName: partialPaymentModal.customerName,
        customerAddress: partialPaymentModal.customerAddress,
        plate: partialPaymentModal.workOrder?.vehicle_plate,
        observations: "ABONO (" + (isFullyPaid ? "TOTAL" : "PARCIAL") + ")" + (partialPaymentModal.observation ? " | " + partialPaymentModal.observation : ""),
        grandTotal: amount,
        items: partialPaymentModal.workOrder?.items,
        paymentMethod: finalMethod,
        paymentBreakdown,
        // Resumen de pago: total, monto actual (este abono), pagado acumulado y saldo
        pagoResumen: {
          montoTotal: Number(partialPaymentModal.totalDue) || Number(partialPaymentModal.invoice?.grand_total) || 0,
          montoActual: amount,
          montoPagadoAcumulado: Math.max(0, (Number(partialPaymentModal.totalDue) || 0) - balance) + amount,
        },
        issuedAt: paymentDateTime,
      });
    }

    setPartialPaymentModal(null);
  };

  // Abrir modal de edición de un pago del historial (mismo modal de abono en modo
  // EDICIÓN: fecha, comprobante, método y recursos precargados del registro).
  const handleOpenEditPaymentRecord = (rec: PaymentRecord, invoiceId?: string) => {
    if (!invoiceId || !rec) return;
    const invEdit = (invoices || []).find((i: any) => i.id === invoiceId) || invoicesByWorkOrderId.get(invoiceId || "");
    const woEdit = workOrders.find((o) => o.id === (invEdit?.work_order_id || ""));
    if (!invEdit || !woEdit) return;
    // Reconstruye la selección de recursos del registro: los que ya estaban vinculados
    // aparecen marcados con su monto; los demás quedan visibles para poder añadirlos.
    const recRes: any[] = Array.isArray(rec.resources) ? rec.resources : [];
    const resList: Array<{ key: string; description: string; category: "servicio" | "repuesto" | "certificado"; fullAmount: number; pendingAmount: number; payAmount: number; selected: boolean }> = [];
    // DEDUP por descripción normalizada: evita que la CERTIFICACIÓN aparezca dos veces
    // cuando la OT tiene el ítem "CERTIFICACIÓN..." en items Y además requires_certification
    // (bug D1O-690: el recurso se duplicaba en el modal de edición).
    const seenResDesc = new Set<string>();
    (Array.isArray(woEdit.items) ? woEdit.items : []).forEach((it: any, ri: number) => {
      const amt = Number(it.subtotal) || 0;
      if (amt <= 0) return;
      const descUp = String(it.description || "").toUpperCase();
      const isCertTxt = /CERTIFIC|ANUAL|QUINQUENAL|CHIP|CILINDRO|CONVERSI|HIDROST/.test(descUp);
      // Si el ítem es la certificación y ya se agregará desde requires_certification,
      // se omite AQUÍ para no duplicarla.
      if (isCertTxt && woEdit.requires_certification && Number(woEdit.certification_price) > 0) return;
      const norm = String(it.description || "").trim().toLowerCase();
      if (seenResDesc.has(norm)) return;
      seenResDesc.add(norm);
      const cat = isCertTxt ? ("certificado" as const) : (String(it.item_type || "").toLowerCase() === "repuesto" || it.inventory_item_id ? ("repuesto" as const) : ("servicio" as const));
      const prev = recRes.find((x: any) => String(x.description || "").trim().toLowerCase() === norm);
      resList.push({
        key: `edit-res-${ri}-${String(it.description || "").slice(0, 20).replace(/\s+/g, "-")}`,
        description: it.description,
        category: cat,
        fullAmount: amt,
        pendingAmount: amt,
        payAmount: prev ? (Number(prev.amount) || 0) : 0,
        selected: prev ? (Number(prev.amount) || 0) > 0 : false,
      });
    });
    if (woEdit.requires_certification && Number(woEdit.certification_price) > 0) {
      const descCert = `CERTIFICACIÓN (${woEdit.certification_type || "GNV/GLP"})`;
      const normCert = descCert.trim().toLowerCase();
      // Dedup: si un ítem de la OT ya cubre la certificación con la misma descripción,
      // no volver a agregarla.
      const already = Array.isArray(woEdit.items) ? (woEdit.items as any[]).some((it: any) => String(it.description || "").trim().toLowerCase() === normCert) : false;
      if (!already && !seenResDesc.has(normCert)) {
        seenResDesc.add(normCert);
        const prevCert = recRes.find((x: any) => String(x.description || "").trim().toLowerCase() === normCert);
        resList.push({
          key: `edit-res-cert-${String(descCert).slice(0, 20).replace(/\s+/g, "-")}`,
          description: descCert,
          category: "certificado" as const,
          fullAmount: Number(woEdit.certification_price) || 0,
          pendingAmount: Number(woEdit.certification_price) || 0,
          payAmount: prevCert ? (Number(prevCert.amount) || 0) : 0,
          selected: prevCert ? (Number(prevCert.amount) || 0) > 0 : false,
        });
      }
    }
    setPartialPaymentModal({
      isOpen: true,
      workOrder: woEdit,
      invoice: invEdit,
      totalDue: Number(invEdit.grand_total) || 0,
      paidSoFar: invoicePaidSoFar(invEdit),
      amount: Number(rec.amount) || 0,
      paymentDate: (rec.date || "").slice(0, 10) || getPeruDateString(),
      paymentMethod: (rec.method || "").trim() === "Sin Método" ? "" : defaultMethodFrom(rec.method) || (rec.method || "Efectivo"),
      paymentDestination: rec.destination || invEdit.payment_destination || "EMPRESA",
      isSplitPayment: true,
      paymentSplits: [{ id: `split-1`, method: defaultMethodFrom(rec.method) || (rec.method || "Efectivo"), destination: rec.destination || invEdit.payment_destination || "EMPRESA", amount: Number(rec.amount) || 0, splitResources: resList.length > 0 ? resList.map((x) => ({ ...x })) : undefined }],
      receiptNumber: rec.receipt_number || invEdit.receipt_number || "",
      receiptType: (rec.receipt_type === "Boleta" || rec.receipt_type === "Factura" ? rec.receipt_type : (rec.receipt_type === "Sin Comprobante" ? "Sin Comprobante" : "Ticket")) as "Ticket" | "Boleta" | "Factura" | "Sin Comprobante",
      customerDoc: invEdit.customer_doc || "",
      customerName: invEdit.client_name || "CLIENTES VARIOS",
      customerAddress: invEdit.customer_address || "-",
      observation: rec.observation || invEdit.debt_observation || "",
      responsible: rec.responsible || invEdit.debt_responsible || "",
      resourceSelection: resList.length > 0 ? resList : undefined,
      editingRecordId: rec.id,
      editingRecordAmount: Number(rec.amount) || 0,
    });
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

    // Anti-duplicado: si la placa ya tiene una orden con el MISMO servicio el MISMO día,
    // no crear una card nueva: se trabaja sobre la misma card con Abonar Saldo / Confirmar Pago.
    const manualSameService = workOrders.find((o) =>
      o.vehicle_plate && o.vehicle_plate.toUpperCase() === plate &&
      o.entry_time && o.entry_time.slice(0, 10) === manualPaymentModal.entryDate &&
      ((o.general_maintenance_service || o.problem_description || "").toLowerCase().includes((manualPaymentModal.maintenanceService || "").trim().toLowerCase()) ||
        (manualPaymentModal.maintenanceService || "").trim().toLowerCase().includes((o.general_maintenance_service || o.problem_description || "").toLowerCase()))
    );
    if (manualSameService) {
      notify("warning", "La placa " + plate + " ya tiene una orden registrada hoy con el mismo servicio (OT #" + manualSameService.id + "). Use Abonar Saldo o Confirmar Pago en la card existente de Caja/Taller para no duplicar el registro.");
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

    const effectiveMethod = cleanMethodDisplay(inv?.payment_method) || csvRec?.method || "Efectivo";

    const effectiveDoc = inv?.customer_doc || csvRec?.rucFactura || "";

    const effectiveDiscount = (wo.discount_amount && wo.discount_amount > 0)
      ? Number(wo.discount_amount)
      : (inv?.discounts ? (typeof inv.discounts === "number" ? inv.discounts : Number(inv.discounts) || 0) : 0);

    // TODOS los comprobantes emitidos en esta factura (uno por abono/pago con su método):
    // cada pago del historial con su N° de Ticket/Boleta/Factura se muestra en una hoja y
    // al imprimir se envían todos a la impresora.
    const historySplits = (Array.isArray(inv?.payment_history) ? inv.payment_history : [])
      .filter((r: any) => r && (r.receipt_number || r.receipt_type || r.method))
      .map((r: any) => ({
        id: r.id || undefined,
        method: cleanMethodDisplay(r.method, Number(r.amount) || 0) || r.method || "Efectivo",
        destination: r.destination || "EMPRESA",
        amount: Number(r.amount) || 0,
        receipt_number: r.receipt_number || undefined,
        receipt_type: r.receipt_type || undefined,
      }));
    const breakdownForView = historySplits.length > 0
      ? historySplits
      : (Array.isArray(inv?.payment_breakdown) ? inv.payment_breakdown : undefined);

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
      paymentBreakdown: breakdownForView,
      // Resumen de pago al ver el comprobante: total, pagado acumulado y último monto
      pagoResumen: (() => {
        const hist = Array.isArray(inv?.payment_history) ? inv.payment_history : [];
        const acc = hist.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const last = hist.length > 0 ? Number(hist[hist.length - 1].amount) || 0 : acc;
        const invTotal = total > 0 ? total : (Number(inv?.grand_total) || 0);
        return { montoTotal: invTotal, montoActual: last, montoPagadoAcumulado: acc };
      })(),
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
            onClick={() => setExpenseModal((m) => ({ ...m, isOpen: true, date: queryDate || getPeruDateString(), destination: "EMPRESA" }))}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-transform hover:scale-105"
            title="Registrar un gasto del día (egreso de caja)"
          >
            <ReceiptText className="w-4 h-4" />
            <span>Gastos</span>
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

          <DateNavigator value={queryDate} onChange={setQueryDate} />
        </div>
      </div>

      {/* Gastos del Día (egresos de caja) */}
      <div className="space-y-2.5 bg-reygas-dark/80 p-4 rounded-2xl border border-rose-500/20 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                Gastos del Día ({queryDate === getPeruDateString() ? "Hoy" : queryDate})
              </span>
              <span className="text-[11px] text-gray-400">
                Egresos de caja que restan al total general del día en el informe diario.
              </span>
            </div>
          </div>
          <span className="text-sm font-mono font-black text-rose-300">
            {dayExpenses.length > 0
              ? `− S/ ${dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toFixed(2)} (${dayExpenses.length})`
              : "S/ 0.00"}
          </span>
        </div>
        {dayExpenses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {dayExpenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{e.description}</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {e.delivered_to} · {e.destination} · {formatPeruDate(e.date)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-mono font-black text-rose-300">− S/ {(Number(e.amount) || 0).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(e.id)}
                    className="p-1 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar gasto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">Sin gastos registrados para esta fecha. Usa el botón <strong className="text-rose-300">Gastos</strong> para registrar uno.</p>
        )}
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

            {/* 2. Pendientes del Día / Hoy */}
            <button
              onClick={() => setActiveStatusFilter("pendientesHoy")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeStatusFilter === "pendientesHoy"
                ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20 scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>⏳ Pendientes del Día / Hoy ({pendingCountToday})</span>
            </button>

            {/* 3. Pendientes Totales */}
            <button
              onClick={() => setActiveStatusFilter("pendientes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeStatusFilter === "pendientes"
                ? "bg-amber-600 text-white font-extrabold shadow-lg shadow-amber-500/20 scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>⏳ Pendientes Totales ({pendingCount})</span>
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

        {effectiveOrders.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Receipt className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-sm font-bold text-gray-400">
              {remoteSearch.loading
                ? "Buscando en todo el historial de la base de datos..."
                : "No hay vehículos en Caja con los filtros seleccionados."}
            </p>
            {remoteSearch.loading && <Loader2 className="w-6 h-6 text-amber-400 mx-auto animate-spin" />}
          </div>
        ) : (
          <>
            {/* Etiqueta de resultados del historial completo (búsqueda bajo demanda por placa) */}
            {remoteSearch.results.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-[11px] text-cyan-200 font-bold">
                <SearchCheck className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>
                  {remoteSearch.results.length} resultado(s) del HISTORIAL COMPLETO (búsqueda directa en la base de datos por la placa)
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4">
              {effectiveOrders.slice(0, visibleLimit).map((wo) => {
                const vehicle = vehiclesByPlate.get(wo.vehicle_plate?.toUpperCase().trim());
                const tech = wo.assigned_technician_id ? techniciansById.get(wo.assigned_technician_id) : undefined;
                const invoice = combinedInvoicesByWoId.get(wo.id);
                const settledInfo = creditSettlementMap.settledOrdersMap.get(wo.id);
                const cancellationInfo = creditSettlementMap.cancellationsMap.get(wo.id);
                const partsTotal = (wo.items || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
                const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
                const grossSubtotal = partsTotal + certFee;
                const discountVal = (wo.discount_amount && wo.discount_amount > 0)
                  ? Number(wo.discount_amount)
                  : (invoice?.discounts ? (typeof invoice.discounts === "number" ? invoice.discounts : Number(invoice.discounts) || 0) : 0);

                // BUG FIX (BAG-123 22:02): el total mostrado debe ser el de la OT (dato más
                // reciente) cuando la factura quedó pendiente SIN pagos (ej. se desmarcó un
                // pago y Taller cambió el precio). Solo facturas con pagos o PAGADAS usan su
                // propio grand_total. Igual que computeOrderNetTotal.
                const invHistLen = Array.isArray(invoice?.payment_history) ? invoice.payment_history.length : 0;
                const invPaidFlag = invoice?.payment_status === "pagado" || (invoice?.payment_condition || "").toUpperCase().includes("PAGADO");
                const invHasPayments = invHistLen > 0 || (Number(invoice?.credit_amount) > 0 && Number(invoice?.credit_amount) < (Number(invoice?.grand_total) || 0));
                let grandTotal = 0;
                if (invoice?.grand_total !== undefined && invoice.grand_total > 0 && (invHasPayments || invPaidFlag) && (!wo.discount_amount || invoice.discounts === wo.discount_amount)) {
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
                // Historial de pagos: usa payment_history; si la factura está PAGADA pero
                // no tiene historial (pagos confirmados antes del registro en historial o
                // importados), se RECONSTRUYE desde el desglose/recursos para que la card
                // muestre los pagos y permita ver/editar qué recursos cubrieron.
                let partialHistory: any[] = Array.isArray(invoice?.payment_history) ? invoice.payment_history : [];
                // Historial EN VIVO: si la factura NO trae payment_history en el store (undefined/null,
                // factura fuera de la ventana de pagadas recientes), se toma del snapshot inv_payhistory_*
                // de Supabase. IMPORTANTE: si el store trae un ARRAY (aunque vacío, ej. tras eliminar un
                // pago), NO se usa el snapshot: el [] es un estado legítimo de "pago eliminado" y el
                // snapshot viejo haría que la card mostrara el pago que ya se borró (bug: toast eliminado
                // pero el pago seguía visible).
                if (invoice?.payment_history === undefined || invoice?.payment_history === null) {
                  const liveHist = (invoice?.id ? livePayhistory[invoice.id] : undefined)
                    || (invoice?.work_order_id ? livePayhistory[invoice.work_order_id] : undefined)
                    || (wo?.id ? livePayhistory[wo.id] : undefined);
                  if (Array.isArray(liveHist) && liveHist.length > 0) {
                    partialHistory = liveHist.map((r: any) => ({ ...r, isLive: true }));
                  }
                }
                if (invoice?.payment_history === undefined || invoice?.payment_history === null) {
                  if (partialHistory.length === 0) {
                    const bdRecs: any[] = Array.isArray((invoice as any)?.payment_breakdown) ? (invoice as any).payment_breakdown : [];
                    if (bdRecs.length > 0) {
                      partialHistory = bdRecs.map((s: any, si: number) => ({
                        id: `bd-${invoice?.id}-${si}`,
                        date: (invoice as any)?.paid_at || (invoice as any)?.issued_at || "",
                        amount: Number(s.amount) || 0,
                        method: s.method || (invoice as any)?.payment_method || "Efectivo",
                        destination: s.destination || (invoice as any)?.payment_destination || "EMPRESA",
                        receipt_number: s.receipt_number || (invoice as any)?.receipt_number || undefined,
                        receipt_type: s.receipt_type || (invoice as any)?.receipt_type || undefined,
                        resources: Array.isArray((s as any).resources) ? (s as any).resources : undefined,
                        isReconstructed: true,
                      }));
                    } else if ((invoice as any)?.resource_payments && Array.isArray((invoice as any).resource_payments) && (invoice as any).resource_payments.length > 0) {
                      partialHistory = [{
                        id: `rp-${invoice?.id}`,
                        date: (invoice as any)?.paid_at || (invoice as any)?.issued_at || "",
                        amount: (invoice as any)?.grand_total || 0,
                        method: (invoice as any)?.payment_method || "Efectivo",
                        destination: (invoice as any)?.payment_destination || "EMPRESA",
                        receipt_number: (invoice as any)?.receipt_number || undefined,
                        receipt_type: (invoice as any)?.receipt_type || undefined,
                        resources: (invoice as any).resource_payments,
                        isReconstructed: true,
                      }];
                    }
                  }
                }
                const totalPaidSoFar = partialHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const isPartiallyPaid = !isPaid && partialHistory.length > 0 && (invoice?.credit_amount || 0) > 0;
                const isCardExpanded = expandedCards.has(wo.id);
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
                // BUG FIX (BAG-123): si NO hay factura local (se eliminó el pago/historial), NO
                // mostrar el comprobante viejo del CSV de la Tabla Maestra como si fuera el
                // vigente de la card: la OT re-enviada a cobrar debe verse SIN comprobante
                // hasta que se confirme el pago de nuevo. El CSV solo aplica a OTs históricas
                // ya pagadas (sin re-cobro pendiente).
                const invoiceHasReceipt = invoice?.receipt_number && invoice.receipt_number !== "0" && String(invoice.receipt_number).toUpperCase() !== "S/N";
                const showCsvReceipt = !invoice && isOrderPaid(wo, invoice) && csvRec?.receiptNumber;
                const effectiveReceiptNum: string = isSinComp
                  ? ""
                  : invoiceHasReceipt
                    ? (invoice.receipt_number || "")
                    : (showCsvReceipt ? (csvRec?.receiptNumber || "") : "");

                const rawType = (invoice?.receipt_type || csvRec?.receiptType || "").toUpperCase().trim();
                const effectiveReceiptType = isSinComp
                  ? "Sin Comprobante"
                  : rawType.includes("FACTURA")
                    ? "Factura"
                    : rawType.includes("BOLETA")
                      ? "Boleta"
                      : (effectiveReceiptNum.startsWith("F") || (parseInt(effectiveReceiptNum) < 1000 && parseInt(effectiveReceiptNum) > 0) ? "Factura" : "Ticket");

                const effectiveMethod = cleanMethodDisplay(invoice?.payment_method) || csvRec?.method || "Efectivo";
                const effectiveDestination = invoice?.payment_destination || csvRec?.destination || "EMPRESA";

                // COMPROBANTES de pago de la factura: si hay VARIOS, la card muestra
                // SIEMPRE el ÚLTIMO y la cantidad entre paréntesis (ej. "B001-276 · 2").
                const cardComprobantes = (Array.isArray(invoice?.payment_history) ? invoice.payment_history : [])
                  .filter((r: any) => r && r.receipt_number && String(r.receipt_number).trim() && String(r.receipt_number) !== "0" && String(r.receipt_number).toLowerCase() !== "s/n");
                const comprobanteCount = cardComprobantes.length;
                const lastComp = comprobanteCount > 1 ? cardComprobantes[cardComprobantes.length - 1] : null;
                const displayReceiptNum = lastComp?.receipt_number ? String(lastComp.receipt_number) : effectiveReceiptNum;
                const displayReceiptType = lastComp?.receipt_type
                  ? (String(lastComp.receipt_type).toUpperCase().includes("FACTURA")
                      ? "Factura"
                      : String(lastComp.receipt_type).toUpperCase().includes("BOLETA")
                        ? "Boleta"
                        : "Ticket")
                  : effectiveReceiptType;

                const buttonReceiptLabel = isSinComp
                  ? "Sin Comp."
                  : displayReceiptNum && displayReceiptNum !== "0"
                    ? (displayReceiptType === "Factura" ? `F001-${displayReceiptNum.replace(/[^0-9]/g, "").padStart(8, "0")}` : displayReceiptNum) + (comprobanteCount > 1 ? ` · ${comprobanteCount}` : "")
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
                            {/* N° de Orden de Trabajo: permite detectar placas DUPLICADAS con OTs distintas */}
                            <span
                              className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-1 rounded-lg border border-cyan-500/30"
                              title={"OT completa: " + wo.id}
                            >
                              OT: <strong>{wo.id.slice(0, 8)}</strong>
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

                            <button
                              type="button"
                              onClick={() => toggleCard(wo.id)}
                              className={`p-1.5 rounded-lg border transition-all ${isCardExpanded
                                ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                                : "bg-white/5 text-gray-400 hover:text-white border-white/10 hover:border-white/30"
                                }`}
                              title={isCardExpanded ? "Contraer tarjeta" : "Expandir tarjeta"}
                            >
                              {isCardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {isCardExpanded ? (
                          <>
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
                        ) : (!isPaid && (settledInfo?.hasCredit || (invoice?.credit_amount || 0) > 0 || grandTotal > 0)) ? (
                          <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏦</span>
                              <div>
                                <span className="font-black text-amber-300 text-xs block">
                                  {/* BUG FIX (BAG-123): el crédito pendiente real = total actual de la OT
                                      menos lo ya pagado. Antes usaba invoice.credit_amount (dato viejo de
                                      la factura pendiente) y la etiqueta quedaba desactualizada (decía 360
                                      cuando la card ya mostraba 365). */}
                                  CRÉDITO PENDIENTE POR COBRAR: S/ {Math.max(0, grandTotal - totalPaidSoFar).toFixed(2)}
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
                        ) : (!isPaid && grandTotal > 0) ? (
                          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⏳</span>
                              <div>
                                <span className="font-black text-amber-300 text-xs block">
                                  PENDIENTE DE PAGO: S/ {grandTotal.toFixed(2)}
                                </span>
                                <span className="text-[11px] text-gray-300">
                                  Atención registrada pendiente de cobro (sin saldo deudor).
                                </span>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-extrabold text-xs rounded-lg border border-amber-500/40 shrink-0 animate-pulse self-start sm:self-auto">
                              PENDIENTE DE PAGO ⏳
                            </span>
                          </div>
                        ) : null}

                        {/* Motivo de Ingreso y Observaciones */}
                        {(wo.problem_description || wo.observations || invoice?.observations) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(wo.problem_description || wo.general_maintenance_service) && (
                              <div className="p-3 bg-reygas-dark/60 rounded-xl border border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                                  Motivo de Ingreso
                                </span>
                                <p className="text-xs text-gray-200 mt-1.5 leading-relaxed">
                                  {wo.problem_description || wo.general_maintenance_service}
                                </p>
                              </div>
                            )}
                            {(wo.observations || invoice?.observations) && (
                              <div className="p-3 bg-reygas-dark/60 rounded-xl border border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                  Observaciones
                                </span>
                                <p className="text-xs text-gray-200 mt-1.5 leading-relaxed">
                                  {wo.observations || invoice?.observations}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

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
                            {displayReceiptNum && (
                              <span>🧾 <strong>Recibo/Comp:</strong> {displayReceiptNum} ({displayReceiptType}){comprobanteCount > 1 ? ` · ${comprobanteCount} comprobantes` : ""}</span>
                            )}
                          </div>

                          {/* Historial de pagos: SIEMPRE visible (aunque no haya factura/comprobante
                              vinculado). Si no hay pagos muestra el estado vacío para dejar claro que la
                              OT aún no se cobró (bug: card con "Recibo/Comp: F001-..." sin historial). */}
                          <div className="pt-2 border-t border-white/5 space-y-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-gray-400">
                                🧾 Historial de Pagos ({partialHistory.length}):
                              </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirmClearCard === wo.id) {
                                      if (invoice?.id) clearInvoicePayments(invoice.id);
                                      setConfirmClearCard(null);
                                      notify("warning", "Todos los pagos de " + wo.vehicle_plate + " fueron borrados. La factura vuelve a estar pendiente de cobro completo.");
                                    } else {
                                      setConfirmClearCard(wo.id);
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-lg border text-[9px] font-black flex items-center gap-1 transition-all ${confirmClearCard === wo.id
                                    ? "bg-red-600 text-white border-red-500"
                                    : "bg-red-500/10 text-red-400 hover:bg-red-500/25 border-red-500/30"
                                    }`}
                                  title="Borrar todos los pagos/abonos de esta factura (vuelve a Confirmar Cobro)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{confirmClearCard === wo.id ? "¿Confirmar borrado?" : "Borrar todos"}</span>
                                </button>
                              </div>
                              {partialHistory.map((rec, i) => (
                                <div key={i} className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-300">
                                  <span>
                                    <span className="text-gray-400 font-mono">{formatPeruDateTime(rec.date)}</span>
                                    {" — "}
                                    <strong>{cleanMethodDisplay(rec.method, Number(rec.amount) || 0) || rec.method}</strong>
                                    {rec.receipt_number ? " (" + (rec.receipt_type || "") + " " + rec.receipt_number + ")" : ""}
                                    {(() => {
                                      const recRes: any[] = Array.isArray((rec as any).resources) ? (rec as any).resources : [];
                                      const invRes: any[] = Array.isArray((invoice as any)?.resource_payments) ? (invoice as any).resource_payments : [];
                                      const shownRes = recRes.length > 0 ? recRes : (recRes.length === 0 && invRes.length > 0 ? invRes : []);
                                      const resLabel = shownRes.length > 0
                                        ? `${shownRes.length} recurso${shownRes.length !== 1 ? "s" : ""} vinculado${shownRes.length !== 1 ? "s" : ""}`
                                        : (rec as any).isReconstructed ? "sin recursos vinculados" : "";
                                      return shownRes.length > 0 ? (
                                        <span className={`ml-1 inline-flex items-center gap-0.5 text-[9px] rounded px-1 py-px font-bold ${recRes.length > 0
                                          ? "text-cyan-300 bg-cyan-950/40 border border-cyan-500/30"
                                          : "text-amber-300 bg-amber-950/40 border border-amber-500/30"
                                          }`} title={(shownRes as any[]).map((x: any) => `${x.description}: S/ ${Number(x.amount).toFixed(2)}`).join("\n")}>
                                          🔗 {resLabel}
                                        </span>
                                      ) : (rec as any).isReconstructed ? (
                                        <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-1 py-px font-bold" title="Este pago no tiene recursos vinculados. Pulse el lápiz para asignarlos.">
                                          ⚠ sin recursos vinculados
                                        </span>
                                      ) : null;
                                    })()}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <strong className="text-emerald-400 font-mono">S/ {Number(rec.amount).toFixed(2)}</strong>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditPaymentRecord(rec, invoice?.id)}
                                      className="p-0.5 rounded bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 transition-colors"
                                      title="Editar este comprobante (fecha, método, N° de comprobante y recursos vinculados)"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (invoice?.id && rec.id) {
                                          deletePaymentRecord(invoice.id, rec.id);
                                          notify("warning", "Pago de S/ " + Number(rec.amount).toFixed(2) + " (" + rec.method + ") eliminado del historial. Saldo recalculado.");
                                        }
                                      }}
                                      className="p-0.5 rounded bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                                      title="Eliminar este pago del historial"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </span>
                                </div>
                              ))}
                              {partialHistory.length === 0 && (
                                <div className="text-[11px] text-gray-500 flex items-center gap-1.5 py-1">
                                  <span className="text-gray-600">—</span>
                                  <span>Sin pagos registrados. Confirme el cobro para generar el comprobante.</span>
                                </div>
                              )}
                            </div>
                        </div>
                          </>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-reygas-dark/40 border border-white/5 text-[11px] text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>OT #{wo.id}</span>
                            <span>•</span>
                            <span>{wo.items.length} ítem(s)</span>
                            {settledInfo?.hasCredit || (invoice?.credit_amount || 0) > 0 || (!isPaid && grandTotal > 0) ? (
                              <>
                                <span>•</span>
                                {/* Saldo real = total actual - lo ya pagado (no credit_amount viejo de la factura) */}
                                <span className="text-amber-400 font-bold">Saldo: S/ {(settledInfo?.creditAmount ?? Math.max(0, grandTotal - totalPaidSoFar)).toFixed(2)}</span>
                              </>
                            ) : null}
                            {isPartiallyPaid && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">Pagado: S/ {totalPaidSoFar.toFixed(2)}</span>
                              </>
                            )}
                            <span className="ml-auto text-purple-300 font-bold">Pulse Expandir para ver detalle completo</span>
                          </div>
                        )}
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
                              <div>Saldo: <strong className="text-amber-400 font-mono">S/ {Math.max(0, grandTotal - totalPaidSoFar).toFixed(2)}</strong></div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {/* Monto 0 (consulta/revisión sin costo): no hay comprobante que ver */}
                          {grandTotal > 0 && (
                            <button
                              onClick={() => handleOpenReceiptViewer(wo, invoice, grandTotal)}
                              className="px-3.5 py-2 rounded-xl bg-blue-950/60 text-blue-300 hover:bg-blue-900/80 border border-blue-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow hover:scale-105"
                              title="Visualizar o Imprimir Comprobante Térmico / PDF"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
                              <span>Ver Comprobante ({buttonReceiptLabel})</span>
                            </button>
                          )}

                          {isPaid ? (
                            <>
                              <button
                                onClick={() => handleDesmarcarPago(wo, invoice)}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-amber-500/20 hover:text-amber-400 border border-emerald-500/40 hover:border-amber-500/40 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow"
                                title="Haga clic para desmarcar pago y revertir a Pendiente (sin duplicar el historial al re-confirmar)"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>PAGADO (Desmarcar Pago)</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Monto 0: NO se permite abonar (no hay saldo); solo confirmar directo */}
                              {grandTotal > 0 && (
                                <button
                                  onClick={() => handleOpenPartialPaymentModal(wo, invoice)}
                                  className="px-4 py-2.5 bg-cyan-600/80 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl border border-cyan-400/40 shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition-transform hover:scale-105"
                                  title="Abonar el saldo pendiente total o hacer un pago parcial (métodos, destinos y comprobante)"
                                >
                                  <History className="w-4 h-4 stroke-[2.5]" />
                                  <span>Abonar Total o Saldo</span>
                                </button>
                              )}

                              {partialHistory.length > 0 ? (
                                <button
                                  onClick={() => handleOpenPartialPaymentModal(wo, invoice)}
                                  className="px-5 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 font-extrabold text-xs rounded-xl border border-amber-500/40 shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-all cursor-pointer"
                                  title="Abonar el saldo pendiente con selección de recursos (desde 17/08/2026) o pago parcial clásico"
                                >
                                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                  <span>Abonar Saldo (Vincular Recursos)</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenPaymentModal(wo, invoice, grandTotal)}
                                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                                  title={grandTotal <= 0 ? "Confirmar atención sin costo — sin comprobante y sin método de pago" : "Cobrar con selección de recursos (desde 17/08/2026): marque qué cubre este pago y confirme"}
                                >
                                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                  <span>{grandTotal <= 0 ? "Confirmar (Sin Costo)" : "Confirmar Pago"}</span>
                                </button>
                              )}

                              {/* 🔒 Habilitar Modificación en Taller (solo mientras el pago NO esté confirmado/desmarcado) */}
                              <button
                                onClick={() => {
                                  toggleAllowModificationsInWorkshop(wo.id);
                                  notify("success", !allowModInWorkshop
                                    ? "🔓 Modificaciones habilitadas en Taller para " + wo.vehicle_plate + ". La card se ocultó de Caja hasta que Taller la envíe de nuevo a cobrar."
                                    : "🔒 Modificaciones bloqueadas en Taller para " + wo.vehicle_plate + ".");
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${allowModInWorkshop
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : "bg-gray-800 text-gray-400 border-white/10 hover:text-white hover:bg-gray-700"
                                  }`}
                                title="Enviar la orden de vuelta al Taller para modificar (la card se oculta de Caja). Al terminar, Taller debe pulsar 'Enviar a Cobrar' para que aparezca de nuevo aquí con los cambios."
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
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {effectiveOrders.length > visibleLimit && (
              <div className="pt-4 text-center">
                <button
                  onClick={() => setVisibleLimit((prev) => prev + 30)}
                  className="px-6 py-3 bg-reygas-surface hover:bg-gray-700 text-amber-400 font-bold text-sm rounded-2xl border border-amber-500/30 shadow-lg transition-all touch-target inline-flex items-center gap-2"
                >
                  <span>Mostrar más comprobantes (+30)</span>
                  <span className="text-xs text-gray-400 font-mono">
                    (Mostrando {visibleLimit} de {effectiveOrders.length})
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

                <div className="max-h-44 overflow-y-auto space-y-1 divide-y divide-white/5 pr-1">
                  {(paymentModal.resourceSelection && paymentModal.resourceSelection.length > 0 ? paymentModal.resourceSelection : paymentModal.breakdownItems.map((it, idx) => ({
                    key: `legacy-${idx}`,
                    description: it.description,
                    category: "servicio" as const,
                    fullAmount: Number(it.subtotal) || 0,
                    payAmount: Number(it.subtotal) || 0,
                    selected: Number(it.subtotal) > 0,
                  }))).map((it: any) => (
                    <div key={it.key} className="flex items-center gap-2 text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const sel = (paymentModal.resourceSelection || []).map((r: any) =>
                            r.key === it.key ? { ...r, selected: !r.selected, payAmount: !r.selected ? r.fullAmount : r.payAmount } : r
                          );
                          setPaymentModal({ ...paymentModal, resourceSelection: sel });
                        }}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${it.selected
                          ? "bg-emerald-500/30 border-emerald-400 text-emerald-300"
                          : "bg-black/40 border-white/20 text-transparent hover:border-white/40"
                          }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <span className={`flex-1 truncate ${it.selected ? "text-white" : "text-gray-500 line-through"}`}>
                        {it.category === "certificado" ? "🛡 " : it.category === "repuesto" ? "📦 " : "🔧 "}
                        {it.description}
                        {typeof it.pendingAmount === "number" && Math.abs(it.pendingAmount - it.fullAmount) > 0.01 && (
                          <span className="ml-1 text-[9px] text-amber-300 font-bold">pendiente S/ {it.pendingAmount.toFixed(2)}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-gray-500">total S/ {it.fullAmount.toFixed(2)}</span>
                        {it.selected && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={typeof it.pendingAmount === "number" ? it.pendingAmount : it.fullAmount}
                            value={it.payAmount || ""}
                            onChange={(e) => {
                              const cap = typeof it.pendingAmount === "number" ? it.pendingAmount : it.fullAmount;
                              const val = Math.max(0, Math.min(cap, parseFloat(e.target.value) || 0));
                              const sel = (paymentModal.resourceSelection || []).map((r: any) =>
                                r.key === it.key ? { ...r, payAmount: val, selected: val > 0 } : r
                              );
                              setPaymentModal({ ...paymentModal, resourceSelection: sel });
                            }}
                            className="w-20 px-2 py-1 bg-reygas-dark border border-white/10 rounded-lg text-emerald-400 font-mono font-bold text-xs text-right focus:border-emerald-400"
                            title="Monto a pagar de este recurso (puede ser parcial; no supera el saldo pendiente)"
                          />
                        )}
                      </div>
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
                    S/ {(paymentModal.resourceSelection && paymentModal.resourceSelection.length > 0
                      ? paymentModal.resourceSelection.filter((r) => r.selected).reduce((s, r) => s + (Number(r.payAmount) || 0), 0)
                      : paymentModal.grandTotal).toFixed(2)}
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
                              <option value="Transferencia">🏦 Transferencia</option>
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
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                  className={`px-6 py-2.5 rounded-xl text-white font-black text-xs shadow-lg flex items-center gap-2 transition-transform hover:scale-105 ${paymentModal.linkOnly
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/30"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30"
                    }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{paymentModal.linkOnly ? "Vincular Recursos al Pago" : "Confirmar, Cobrar e Imprimir"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE GASTOS DEL DÍA (EGRESOS DE CAJA) */}
      {/* ========================================================================= */}
      {expenseModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl border border-rose-500/30 shadow-2xl bg-[#0d121f]/95 overflow-hidden my-auto animate-fadeIn">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-rose-950/40 via-red-950/30 to-reygas-surface">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Registrar Gasto del Día</h3>
                  <p className="text-xs text-gray-400">Egreso de caja que resta al TOTAL GENERAL DEL DÍA del informe.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModal((m) => ({ ...m, isOpen: false }))}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveExpense();
              }}
              className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs"
            >
              {/* Descripción */}
              <div>
                <label className="text-gray-300 block mb-1 font-bold">Descripción del Gasto *</label>
                <input
                  type="text"
                  required
                  value={expenseModal.description}
                  onChange={(e) => setExpenseModal((m) => ({ ...m, description: e.target.value }))}
                  placeholder="Ej: Pasajes, útiles de oficina, recarga..."
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white focus:border-rose-400"
                />
              </div>

              {/* Monto */}
              <div>
                <label className="text-gray-300 block mb-1 font-bold">Monto (S/) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={expenseModal.amount || ""}
                  onChange={(e) => setExpenseModal((m) => ({ ...m, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-rose-400"
                />
              </div>

              {/* Destino */}
              <div>
                <label className="text-gray-300 block mb-1 font-bold">Destino *</label>
                <select
                  value={expenseModal.destination}
                  onChange={(e) => setExpenseModal((m) => ({ ...m, destination: e.target.value }))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-rose-400"
                >
                  {eligibleDestinations.map((d) => (
                    <option key={d} value={d} className="bg-reygas-dark">{d}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">EMPRESA = fondos de la empresa (opción principal).</p>
              </div>

              {/* Entregado a */}
              <div>
                <label className="text-gray-300 block mb-1 font-bold">Entregado a (Personal del roster y permisos) *</label>
                <select
                  value={expenseModal.deliveredTo}
                  onChange={(e) => setExpenseModal((m) => ({ ...m, deliveredTo: e.target.value }))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-rose-400"
                >
                  <option value="">— Seleccionar personal —</option>
                  {rosterPersonnel.map((name) => (
                    <option key={name} value={name} className="bg-reygas-dark">{name}</option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="text-gray-300 block mb-1 font-bold">Fecha del Gasto *</label>
                <input
                  type="date"
                  required
                  value={expenseModal.date}
                  onChange={(e) => setExpenseModal((m) => ({ ...m, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono focus:border-rose-400"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setExpenseModal((m) => ({ ...m, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <Check className="w-4 h-4" />
                  Guardar Gasto
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
                      onChange={(e) => {
                        const plate = formatPlate(e.target.value);
                        setManualPaymentModal((prev) => (prev ? { ...prev, vehiclePlate: plate } : prev));
                        // Autocompleta Nombre/Teléfono del cliente desde la Tabla Registro del Taller
                        if (plate.replace(/[^A-Z0-9-]/g, "").length >= 4) {
                          void lookupPlateClientData(plate, vehicles).then((data) => {
                            if (!data.found) return;
                            setManualPaymentModal((prev) =>
                              prev && prev.vehiclePlate === plate
                                ? {
                                  ...prev,
                                  clientName: data.client_name || prev.clientName,
                                  clientPhone: data.client_phone || prev.clientPhone,
                                }
                                : prev
                            );
                          });
                        }
                      }}
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
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                                <option value="Transferencia">🏦 Transferencia</option>
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
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                    <span>{partialPaymentModal.editingRecordId ? "Editar Comprobante de Pago" : "Abonar Saldo Pendiente"}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase border ${partialPaymentModal.editingRecordId
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      }`}>
                      {partialPaymentModal.editingRecordId ? "Edición" : "Total / Parcial"}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    {partialPaymentModal.editingRecordId
                      ? "Modifique fecha, comprobante, método o los recursos vinculados de este pago. Los saldos se recalculan al guardar."
                      : "Registra un abono sobre el saldo pendiente de la placa. El abono figurará como ingreso del día actual y reducirá la deuda."}
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
              {/* Sección 1: Resumen de Deuda y Fecha de Pago (fecha PRIMERO) */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>1. Resumen de Deuda y Fecha de Pago</span>
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

                {/* FECHA DE PAGO — primero, como pidió el usuario */}
                <div>
                  <label className="text-gray-300 block mb-1.5 font-bold">📅 Fecha de Pago</label>
                  <MiniDatePicker
                    value={partialPaymentModal.paymentDate || getPeruDateString()}
                    onChange={(d) => setPartialPaymentModal((prev) => (prev ? { ...prev, paymentDate: d || getPeruDateString() } : prev))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Por defecto hoy; puede registrar el abono con la fecha real del pago (afecta al informe diario de esa fecha).
                  </p>
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

                {/* SIEMPRE desglose de métodos: 1 método = Pago Único, varios = Pago Mixto / Parcial.
                    Cada método lleva SUS recursos vinculados; su Monto Total = suma de los
                    recursos marcados. El modo "Pago Único" ya no existe como sección aparte. */}
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
                          // El NUEVO método jala los recursos con SALDO PENDIENTE restante:
                          // los no usados y también los parcialmente pagados en otro método
                          // (con su saldo a pagar). El monto total del método = suma de los
                          // recursos que marque. Un recurso ya cubierto al 100% no se repite.
                          const paidByKey = new Map<string, number>();
                          (splitsNow || []).forEach((sp: any) => {
                            (Array.isArray(sp.splitResources) ? sp.splitResources : []).forEach((x: any) => {
                              if (x && x.selected) paidByKey.set(x.key, (paidByKey.get(x.key) || 0) + (Number(x.payAmount) || 0));
                            });
                          });
                          const pool = (partialPaymentModal.resourceSelection || [])
                            .map((x) => {
                              const paid = paidByKey.get(x.key) || 0;
                              const saldo = Math.max(0, (Number(x.pendingAmount) || Number(x.fullAmount) || 0) - paid);
                              return { ...x, pendingAmount: saldo, payAmount: 0, selected: false };
                            })
                            .filter((x) => x.pendingAmount > 0.01);
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
                              // Si el nuevo método hereda recursos, su Monto Total = suma de los
                              // marcados (parte en 0); si no hay recursos, arranca con el resto.
                              amount: pool.length > 0 ? 0 : remaining,
                              splitResources: pool.length > 0 ? pool.map((x) => ({ ...x, selected: false, payAmount: 0, pendingAmount: Number(x.pendingAmount) || Number(x.fullAmount) || 0 })) : undefined,
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
                        <>
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
                              <option value="Transferencia">🏦 Transferencia</option>
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

                          <div className="flex-1 min-w-[120px]">
                            <label className="text-[10px] text-gray-400 block mb-0.5 font-semibold">Monto Total:</label>
                            {/* Monto Total = suma de los recursos marcados de ESTE método;
                                si no hay recursos (factura anterior al 17/08), se edita manual. */}
                            {(() => {
                              const splitRes = Array.isArray((split as any).splitResources) ? (split as any).splitResources : [];
                              const sumRes = splitRes.filter((r: any) => r.selected).reduce((s: number, r: any) => s + (Number(r.payAmount) || 0), 0);
                              if (splitRes.length > 0) {
                                return (
                                  <div className="w-full px-2.5 py-1.5 bg-reygas-dark border border-emerald-500/30 rounded-lg text-emerald-400 font-mono font-bold text-right">
                                    S/ {sumRes.toFixed(2)}
                                  </div>
                                );
                              }
                              return (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                  value={split.amount || ""}
                                  onChange={(e) => {
                                    const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                      i === idx ? { ...p, amount: parseFloat(e.target.value) || 0 } : p
                                    );
                                    setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-emerald-400 font-mono font-bold focus:border-purple-400"
                                />
                              );
                            })()}
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
                        {/* RECURSOS DE ESTE MÉTODO/COMPROBANTE: marcar aquí hace subir el
                            Monto Total. Recurso usado en otro método = tachado/no disponible;
                            si se usó parcial, solo se ofrece el saldo restante. */}
                        {Array.isArray((split as any).splitResources) && (split as any).splitResources.length > 0 && (
                          <div className="mt-2 p-2.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                            <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
                              <span>🔗 Recursos de este comprobante</span>
                              <span className="font-mono text-emerald-300">
                                S/ {(split as any).splitResources.filter((r2: any) => r2.selected).reduce((s2: number, r2: any) => s2 + (Number(r2.payAmount) || 0), 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {(split as any).splitResources.map((rs: any, rsi: number) => {
                                // Saldo pendiente REAL del recurso: pendingAmount original menos lo
                                // ya pagado en OTROS métodos. Si otro método tomó un pago PARCIAL,
                                // este método puede tomar el saldo restante (no se tacha).
                                const paidOther = (partialPaymentModal.paymentSplits || [])
                                  .filter((_, oi) => oi !== idx)
                                  .reduce((acc: number, p: any) => acc + ((Array.isArray(p.splitResources) ? p.splitResources : []).filter((o: any) => o.key === rs.key && o.selected).reduce((s: number, o: any) => s + (Number(o.payAmount) || 0), 0)), 0);
                                const pendingBase = (() => {
                                  const base = (partialPaymentModal.resourceSelection || []).find((b: any) => b.key === rs.key);
                                  return Number(base?.pendingAmount) || Number(base?.fullAmount) || Number(rs.pendingAmount) || Number(rs.fullAmount) || 0;
                                })();
                                const saldoRestante = Math.max(0, pendingBase - paidOther);
                                const usedOther = saldoRestante <= 0.01;
                                const disabled = usedOther && !rs.selected;
                                return (
                                  <div key={rs.key} className={`flex items-center gap-2 text-[11px] pt-0.5 ${disabled ? "opacity-40" : ""}`}>
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => {
                                        const next = (split as any).splitResources.map((r2: any) =>
                                          r2.key === rs.key ? { ...r2, selected: !r2.selected, payAmount: !r2.selected ? Math.min(r2.fullAmount, saldoRestante) : r2.payAmount } : r2
                                        );
                                        const newAmount = Number(next.filter((r2: any) => r2.selected).reduce((s2: number, r2: any) => s2 + (Number(r2.payAmount) || 0), 0).toFixed(2));
                                        const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                          i === idx ? { ...p, splitResources: next, amount: newAmount } : p
                                        );
                                        // Monto global del abono = suma de recursos marcados en TODOS los métodos
                                        const totalGlobal = Number(updated.reduce((acc: number, sp: any) => acc + (Array.isArray(sp.splitResources) ? sp.splitResources.filter((r3: any) => r3.selected).reduce((s3: number, r3: any) => s3 + (Number(r3.payAmount) || 0), 0) : 0), 0).toFixed(2));
                                        setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated, amount: totalGlobal > 0 ? totalGlobal : partialPaymentModal.amount });
                                      }}
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${rs.selected
                                        ? "bg-emerald-500/30 border-emerald-400 text-emerald-300"
                                        : "bg-black/40 border-white/20 text-transparent hover:border-white/40"
                                        }`}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                    <span className={`flex-1 truncate ${rs.selected ? "text-white" : usedOther ? "text-gray-500 line-through" : "text-gray-400"}`}>
                                      {rs.category === "certificado" ? "🛡 " : rs.category === "repuesto" ? "📦 " : "🔧 "}
                                      {rs.description}
                                      <span className="text-gray-500"> (S/ {rs.fullAmount.toFixed(2)})</span>
                                      {usedOther && !rs.selected ? (
                                        <span className="ml-1 text-[9px] text-rose-300 font-bold">usado en otro comprobante</span>
                                      ) : paidOther > 0 && (
                                        <span className="ml-1 text-[9px] text-cyan-300 font-bold">saldo restante S/ {saldoRestante.toFixed(2)}</span>
                                      )}
                                    </span>
                                    {rs.selected && (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={Math.max(0.01, saldoRestante)}
                                        value={rs.payAmount || ""}
                                        onChange={(e) => {
                                          const val = Math.max(0, Math.min(saldoRestante, parseFloat(e.target.value) || 0));
                                          const next = (split as any).splitResources.map((r2: any) =>
                                            r2.key === rs.key ? { ...r2, payAmount: val, selected: val > 0 } : r2
                                          );
                                          const newAmount = Number(next.filter((r2: any) => r2.selected).reduce((s2: number, r2: any) => s2 + (Number(r2.payAmount) || 0), 0).toFixed(2));
                                          const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                            i === idx ? { ...p, splitResources: next, amount: newAmount } : p
                                          );
                                          // Monto global del abono = suma de recursos marcados en TODOS los métodos
                                          const totalGlobal = Number(updated.reduce((acc: number, sp: any) => acc + (Array.isArray(sp.splitResources) ? sp.splitResources.filter((r3: any) => r3.selected).reduce((s3: number, r3: any) => s3 + (Number(r3.payAmount) || 0), 0) : 0), 0).toFixed(2));
                                          setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated, amount: totalGlobal > 0 ? totalGlobal : partialPaymentModal.amount });
                                        }}
                                        className="w-20 px-2 py-1 bg-reygas-dark border border-white/10 rounded-lg text-emerald-400 font-mono font-bold text-xs text-right focus:border-purple-400"
                                      />
                                    )}
                                    {/* Eliminar ESTE recurso del comprobante (quita la fila; el
                                        Monto Total y el monto global se recalculan) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = (split as any).splitResources.filter((r2: any) => r2.key !== rs.key);
                                        const newAmount = Number(next.filter((r2: any) => r2.selected).reduce((s2: number, r2: any) => s2 + (Number(r2.payAmount) || 0), 0).toFixed(2));
                                        const updated = (partialPaymentModal.paymentSplits || []).map((p, i) =>
                                          i === idx ? { ...p, splitResources: next.length > 0 ? next : undefined, amount: newAmount } : p
                                        );
                                        const totalGlobal = Number(updated.reduce((acc: number, sp: any) => acc + (Array.isArray(sp.splitResources) ? sp.splitResources.filter((r3: any) => r3.selected).reduce((s3: number, r3: any) => s3 + (Number(r3.payAmount) || 0), 0) : 0), 0).toFixed(2));
                                        setPartialPaymentModal({ ...partialPaymentModal, paymentSplits: updated, amount: totalGlobal > 0 ? totalGlobal : partialPaymentModal.amount });
                                      }}
                                      className="p-1 bg-rose-950/40 hover:bg-rose-900/70 text-rose-400 rounded-md transition-colors shrink-0"
                                      title="Eliminar este recurso del comprobante"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        </>
                      );
                    })}
                  </div>

                    {(() => {
                      // Abono REAL = suma de los recursos marcados en todos los métodos.
                      // Se compara contra el SALDO PENDIENTE de la factura (no contra el
                      // monto global, que ahora se sincroniza con los recursos y siempre
                      // coincidiría): si el abono es parcial queda "A abonar / Saldo
                      // restante"; solo cuando cubre el 100% sale "Cuadrado".
                      const sum = (partialPaymentModal.paymentSplits || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      const saldoPendiente = Math.max(0, (partialPaymentModal.totalDue || 0) - (partialPaymentModal.paidSoFar || 0));
                      const saldoRestante = Math.max(0, saldoPendiente - sum);
                      const isBalanced = saldoRestante <= 0.01;
                      return (
                        <div className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs font-bold ${isBalanced
                          ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                          : "bg-amber-950/50 border-amber-500/30 text-amber-300"
                          }`}>
                          <span>
                            A abonar: <span className="font-mono font-black">S/ {sum.toFixed(2)}</span>
                            {!isBalanced && (
                              <span className="text-[10px] text-amber-200/80 ml-1">
                                · Saldo restante: S/ {saldoRestante.toFixed(2)}
                              </span>
                            )}
                          </span>
                          {isBalanced ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Cuadrado
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-200/90">Abono parcial</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
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
                  className={`px-6 py-2.5 rounded-xl text-white font-black text-xs shadow-lg flex items-center gap-2 transition-transform hover:scale-105 ${partialPaymentModal.editingRecordId
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30"
                    }`}
                  title={partialPaymentModal.editingRecordId
                    ? "Guardar los cambios de este comprobante (recalcula saldos y VENTAS POR CONCEPTO)"
                    : "Registrar el abono y vincular los recursos marcados"}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {partialPaymentModal.editingRecordId ? "Guardar Cambios del Comprobante" : "Confirmar Abono"}
                  </span>
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
          pagoResumen={activeReceiptModal.pagoResumen}
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

