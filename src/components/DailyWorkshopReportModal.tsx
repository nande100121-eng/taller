"use client";

import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import { useAppStore, WorkOrder } from "@/lib/store/app-store";
import { fetchSupabaseDayReport } from "@/lib/supabase/services";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import { parseMethodPairs } from "@/lib/utils/payment-method";
import { getWorkshopDayRecords, getWorkshopCSVRecord, WorkshopCSVRecord } from "@/lib/workshop-csv-lookup";
import { MANUAL_CONCEPT_SPLIT_BY_RECEIPT, normalizeReceiptKey } from "@/lib/report-concept-split";
import { matchDebtCsvByInvoice } from "@/lib/deuda-csv";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { titleCase, capitalizeFirst } from "@/lib/utils/text-format";
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
  ChevronDown,
  ChevronUp,
  Wallet,
  TrendingDown,
  Receipt,
  ReceiptText,
  User,
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
  | "pendientes"
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

// Detalle de factura con saldo pendiente para el sub-informe por placa
export interface PendingPlateInvoiceDetail {
  invoice_id: string;
  work_order_id: string;
  issued_at: string;
  receipt_number?: string;
  receipt_type?: string;
  grand_total: number;
  paid: number;
  balance: number;
  description: string;
  debt_observation?: string;
  debt_responsible?: string;
  payments: Array<{ date: string; amount: number; method: string; receipt_number?: string; observation?: string; responsible?: string }>;
}

// Agrupación de cuentas por cobrar por placa
export interface PendingPlateEntry {
  plate: string;
  client: string;
  totalDebt: number;
  invoiceCount: number;
  invoices: PendingPlateInvoiceDetail[];
}

export function WorkshopDailyReportView({
  isModal = false,
  onClose,
  initialTab = "caja",
}: WorkshopDailyReportViewProps) {
  const {
    technicians,
    inventoryItems,
    currentUser,
    invoices,
  } = useAppStore();

  const [selectedDate, setSelectedDate] = useState<string>(getPeruDateString());
  const [activeTab, setActiveTab] = useState<ReportTabType>(initialTab);
  const [dayData, setDayData] = useState<{ workOrders: WorkOrder[]; invoices: any[]; payments: any[]; expenses: any[] } | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(true);
  const [expandedPlate, setExpandedPlate] = useState<string | null>(null);
  // Concepto expandido en la tabla VENTAS POR CONCEPTO (serv / rep / cert)
  const [expandedConcept, setExpandedConcept] = useState<"serv" | "rep" | "cert" | null>(null);
  // Paneles colapsables del informe: TODO lo colapsable nace COLAPSADO por defecto
  const [showYapesPanel, setShowYapesPanel] = useState(false);
  const [showConceptPanel, setShowConceptPanel] = useState(false);
  // Card expandida en la pestaña PORTERÍA (vehículos ingresados del día)
  const [expandedPorteriaVehicle, setExpandedPorteriaVehicle] = useState<string | null>(null);

  // Sync activeTab when component mounts or initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Carga dirigida por fecha: consulta SOLO las órdenes y facturas del día
  // seleccionado en Supabase (en vez de esperar el sync global de 41k+ filas),
  // para que el reporte pinte en <1s en la tablet.
  useEffect(() => {
    let active = true;
    setReportLoading(true);
    fetchSupabaseDayReport(selectedDate)
      .then((data) => {
        if (!active) return;
        if (data) {
          setDayData({ workOrders: data.workOrders, invoices: data.invoices, payments: data.payments || [], expenses: data.expenses || [] });
        } else {
          setDayData(null);
        }
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDate]);

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

  // Fast lookups: solo invoices emitidas en el día seleccionado, para no cruzar
  // montos/cobros de otra fecha a un WO del día consultado.
  const dayInvoices = dayData?.invoices || [];
  const dayOrders = dayData?.workOrders || [];
  const dayPayments = dayData?.payments || [];
  const dayExpenses = dayData?.expenses || [];

  // Total de GASTOS del día (egresos de caja) — restan al total general
  const totalGastos = useMemo(
    () => (dayExpenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0),
    [dayExpenses]
  );

  const invoicesByWorkOrderId = useMemo(() => {
    const map = new Map<string, (typeof dayInvoices)[0]>();
    for (let i = 0; i < dayInvoices.length; i++) {
      const inv = dayInvoices[i];
      if (inv && inv.work_order_id) {
        const invDate = (inv.issued_at || "").slice(0, 10);
        if (invDate !== selectedDate) continue;
        // Si ya existe una invoice para el WO (duplicada), conservar la de mayor monto
        const prev = map.get(inv.work_order_id);
        const curTotal = Number(inv.grand_total) || Number((inv as any).total_amount) || 0;
        const prevTotal = prev ? Number(prev.grand_total) || Number((prev as any).total_amount) || 0 : 0;
        if (!prev || curTotal > prevTotal) {
          map.set(inv.work_order_id, inv);
        }
      }
    }
    return map;
  }, [dayInvoices, selectedDate]);


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

  // Desglose AUTORITATIVO: usa el desglose (payment_breakdown) y destino de pago de la
  // Tabla Maestra cuando existen; si no, el método único; SOLO como último recurso parsea
  // la cadena. Corrige casos donde el parseo de letras (C/Y/E/T) inventaba montos en Culqi
  // cuando en la tabla maestra el pago era Yape a EMPRESA.
  const breakdownFromSources = (
    methodRaw: string,
    paymentBreakdown: any[] | undefined,
    destination: string,
    amount: number
  ) => {
    const res = { efectivo: 0, yape: 0, transferencia: 0, culqi: 0, yapeDestino: "", transfDestino: "" };
    const dest = (destination || "EMPRESA").toUpperCase().trim() || "EMPRESA";
    const addMethod = (sm: string, a: number, sDest?: string) => {
      if (a <= 0) return;
      const d = (sDest || dest || "EMPRESA").toUpperCase().trim() || "EMPRESA";
      if (sm.includes("YAPE") || sm.includes("PLIN")) { res.yape += a; res.yapeDestino = d; }
      else if (sm.includes("TRANSFER") || sm.includes("BANCO") || sm.includes("BCP") || sm.includes("BBVA")) { res.transferencia += a; res.transfDestino = d; }
      else if (sm.includes("TARJETA") || sm.includes("CULQI") || sm.includes("CULQUI") || sm.includes("POS") || sm.includes("CARD")) { res.culqi += a; }
      else { res.efectivo += a; }
    };

    if (Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
      (paymentBreakdown as any[]).forEach((s: any) => {
        addMethod((s.method || "").toUpperCase(), Number(s.amount) || 0, s.destination || dest);
      });
      return res;
    }

    const m = (methodRaw || "").toUpperCase().trim();
    if (m.startsWith("MIXTO (") && m.endsWith(")")) {
      const pairs = parseMethodPairs(methodRaw);
      // Destino mixto separado por "/": cada método corresponde a su PROPIO destino (en orden).
      // Ej: "Mixto (Efectivo: S/ 100.00, Yape: S/ 260.00)" con destino "CAJA / GIANFRANCO REY..."
      // -> Efectivo -> CAJA, Yape -> GIANFRANCO REY... (la tabla de yapes muestra solo el suyo).
      const dests = dest.split("/").map((d) => d.trim()).filter(Boolean);
      pairs.forEach((p, idx) => {
        const pDest = dests.length > 1 ? dests[Math.min(idx, dests.length - 1)] : dest;
        addMethod((p.name || "").toUpperCase(), p.amount || 0, pDest);
      });
      return res;
    }
    if (m.includes("YAPE") || m.includes("PLIN")) { res.yape = amount; res.yapeDestino = dest; }
    else if (m.includes("TRANSFER") || m.includes("BANCO") || m.includes("BCP") || m.includes("BBVA")) { res.transferencia = amount; res.transfDestino = dest; }
    else if (m.includes("TARJETA") || m.includes("CULQI") || m.includes("CULQUI") || m.includes("POS") || m.includes("CARD")) { res.culqi = amount; }
    else if (m.includes("EFECTIVO") || m.includes("CASH") || m === "PENDIENTE" || m === "" || m === "SIN MÉTODO") { res.efectivo = amount; }
    else {
      const parsed = parsePaymentBreakdown(methodRaw, "", "", amount, amount <= 0);
      return { ...parsed, yapeDestino: dest, transfDestino: dest };
    }
    return res;
  };

  // Abonos del día: pagos parciales recibidos HOY sobre facturas de días anteriores.
  // Son ingresos reales de la jornada aunque la factura se haya emitido antes.
  const abonosDelDia = useMemo(() => {
    let efectivo = 0;
    let yape = 0;
    let transferencia = 0;
    let culqi = 0;
    let count = 0;
    (dayPayments || []).forEach((p: any) => {
      count += 1;
      const amt = Number(p.amount) || 0;
      const bd = Array.isArray(p.payment_breakdown) ? p.payment_breakdown : [];
      if (bd.length > 0) {
        (bd as any[]).forEach((s: any) => {
          const sm = (s.method || "").toUpperCase();
          const a = Number(s.amount) || 0;
          if (sm.includes("YAPE") || sm.includes("PLIN")) yape += a;
          else if (sm.includes("TRANSFER") || sm.includes("BANCO") || sm.includes("BCP") || sm.includes("BBVA")) transferencia += a;
          else if (sm.includes("TARJETA") || sm.includes("CULQI") || sm.includes("CULQUI") || sm.includes("POS")) culqi += a;
          else efectivo += a;
        });
      } else {
        const m = (p.method || "EFECTIVO").toUpperCase();
        if (m.includes("YAPE") || m.includes("PLIN")) yape += amt;
        else if (m.includes("TRANSFER") || m.includes("BANCO") || m.includes("BCP") || m.includes("BBVA")) transferencia += amt;
        else if (m.includes("TARJETA") || m.includes("CULQI") || m.includes("CULQUI") || m.includes("POS")) culqi += amt;
        else efectivo += amt;
      }
    });
    return { efectivo, yape, transferencia, culqi, count, total: efectivo + yape + transferencia + culqi };
  }, [dayPayments]);

  // Consolidated Rows for the Day's Table
  const consolidatedRows = useMemo(() => {
    const rows: Array<{
      id: string;
      itemNumber: number;
      plate: string;
      description: string;
      total: number;
      isPending: boolean;
      payState: "pagado" | "pendiente" | "parcial" | "trunco";
      pendingAmount: number;
      isTrunco: boolean;
      efectivo: number;
      yape: number;
      transferencia: number;
      culqi: number;
      responsable: string;
      yapeDestino: string;
      transfDestino: string;
      isInvoice: boolean;
      orderStatus: string;
      receiptNumber: string;
      // Desglose por concepto según la card del Taller (item_type + certificación):
      // cada fila reparte su monto en Servicios / Almacén (repuestos) / Certificados.
      catServ?: number;
      catRep?: number;
      catCert?: number;
    }> = [];

    let count = 1;
    const processedKeys = new Set<string>();

    // Reparto de una Orden de Taller en conceptos según lo ASIGNADO en la card:
    //  - item_type "servicio" (botón servicios)          -> Servicios
    //  - item_type "repuesto" (botón repuestos/Almacén)  -> Almacén
    //  - requires_certification                          -> Certificados
    const orderCategorySplit = (wo: any) => {
      const items = Array.isArray(wo.items) ? wo.items : [];
      let serv = 0;
      let rep = 0;
      let certFromItems = 0;
      items.forEach((it: any) => {
        const amt = Number(it.subtotal) || Number(it.quantity) * Number(it.unit_price) || 0;
        const descUp = String(it.description || "").toUpperCase();
        // Certificación agregada como ÍTEM sin item_type (ej. "CERTIFICACIÓN (Chip por
        // deterioro)"): se detecta por el texto para clasificarla en CERTIFICADOS.
        const isCertTxt = /CERTIFIC|ANUAL|QUINQUENAL|CHIP|CILINDRO|CONVERSI|HIDROST/.test(descUp);
        if (isCertTxt) {
          certFromItems += amt;
          return;
        }
        if (String(it.item_type || "").toLowerCase() === "repuesto" || it.inventory_item_id) rep += amt;
        else serv += amt;
      });
      // Certificación marcada en la card (+ Certificación)
      const cert = certFromItems + (wo.requires_certification ? Number(wo.certification_price) || 0 : 0);
      return { serv, rep, cert, total: serv + rep + cert };
    };

    // 1. First Priority: Load exact day records from workshop CSV lookup (e.g. 14/08/2026, 15/08/2026, etc.)
    const csvDayRecords = getWorkshopDayRecords(selectedDate);

    if (csvDayRecords && csvDayRecords.length > 0) {
      csvDayRecords.forEach((rec, idx) => {
        const uniqueKey = `csv_${rec.plate}_${rec.receiptNumber}_${idx}`;
        processedKeys.add(uniqueKey);
        processedKeys.add(rec.plate.toUpperCase().trim());

        const totalAmount = rec.price > 0 ? rec.price : (rec.credit > 0 ? rec.credit : 0);
        const condUpper = (rec.condition || "").toUpperCase().trim();
        let payState: "pagado" | "pendiente" | "parcial" | "trunco";
        let pendingAmount = 0;
        let paidAmount = totalAmount;
        if (condUpper === "PENDIENTE" || (rec.credit > 0 && rec.price === 0)) {
          payState = "pendiente";
          pendingAmount = totalAmount;
          paidAmount = 0;
        } else if (rec.credit > 0) {
          payState = "parcial";
          pendingAmount = Number(rec.credit) || 0;
          paidAmount = Math.max(0, totalAmount - pendingAmount);
        } else {
          payState = "pagado";
        }
        const isPending = payState === "pendiente" || payState === "parcial";
        const isTrunco = false;
        const paymentMethod = rec.method || (isPending ? "PENDIENTE" : "EFECTIVO");

        const breakdown = breakdownFromSources(paymentMethod, undefined, rec.destination || "EMPRESA", paidAmount);

        const yDest = breakdown.yapeDestino || (rec.destination ? rec.destination.toUpperCase() : "EMPRESA");
        const tDest = breakdown.transfDestino || (rec.destination ? rec.destination.toUpperCase() : "EMPRESA");

        const desc = [rec.service, rec.parts].filter(Boolean).join(" - ") || "Servicio de Taller";
        const techName = rec.technician || "Taller";

        rows.push({
          id: uniqueKey,
          itemNumber: count++,
          plate: (rec.plate || "S/P").toUpperCase(),
          description: desc,
          total: totalAmount,
          isPending,
          payState,
          pendingAmount,
          isTrunco,
          efectivo: breakdown.efectivo,
          yape: breakdown.yape,
          transferencia: breakdown.transferencia,
          culqi: breakdown.culqi,
          responsable: techName.split(",")[0].split("-")[0].split(" ")[0].toUpperCase() || "TALLER",
          yapeDestino: yDest,
          transfDestino: tDest,
          isInvoice: Boolean(rec.receiptNumber && rec.receiptNumber !== "0"),
          orderStatus: isPending ? "pendiente" : "finalizado",
          receiptNumber: (rec.receiptNumber && rec.receiptNumber !== "0" ? rec.receiptNumber : "") || "",
        });
      });
    }

    const processedOrderIds = new Set<string>();

    // 2. Map in-app Work Orders for this day (adds any new order created dynamically that isn't in CSV)
    dayOrders.forEach((wo) => {
      // Las filas "GASTO" (egresos de caja) no son atenciones: se muestran en la
      // sección GASTOS DEL DÍA del informe, no en las tablas de liquidación.
      if ((wo.vehicle_plate || "").toUpperCase() === "GASTO") return;
      const plateKey = (wo.vehicle_plate || "").toUpperCase().trim();
      if (csvDayRecords.length > 0 && processedKeys.has(plateKey)) return;

      processedOrderIds.add(wo.id);
      const inv = invoicesByWorkOrderId.get(wo.id);
      const csvRec = getWorkshopCSVRecord(wo.vehicle_plate, wo.entry_time);

      const statusRaw = (wo.status || "") as string;
      const isDone = ["finalizado", "pagado_autorizado", "completado", "por_cobrar", "pendiente_pago"].includes(statusRaw);
      const markedPaid = inv?.payment_status === "pagado" || statusRaw === "pagado_autorizado" || statusRaw === "finalizado";
      const orderCost = (wo.items || []).reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unit_price || 0), 0) + (wo.requires_certification ? (wo.certification_price || 0) : 0) || Number((wo as any).total_cost) || 0;
      let totalAmount = inv ? (Number(inv.grand_total) || Number((inv as any).total_amount) || 0) : orderCost;
      if (totalAmount === 0 && csvRec) {
        totalAmount = csvRec.price || csvRec.credit || 0;
      }

      // Reparto por concepto según la card (item_type + certificación)
      const catSplit = orderCategorySplit(wo);

      let payState: "pagado" | "pendiente" | "parcial" | "trunco";
      let pendingAmount = 0;
      let paidAmount = totalAmount;
      if (markedPaid) {
        const creditAmt = Number((inv as any)?.credit_amount) || 0;
        let paidPortion = 0;
        if (inv?.payment_breakdown && Array.isArray(inv.payment_breakdown)) {
          paidPortion = (inv.payment_breakdown as Array<{ amount?: number }>).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        }
        if (creditAmt > 0) {
          payState = "parcial";
          paidAmount = Math.max(0, totalAmount - creditAmt);
          pendingAmount = creditAmt;
        } else if (paidPortion > 0 && paidPortion < totalAmount - 0.01) {
          payState = "parcial";
          paidAmount = paidPortion;
          pendingAmount = Math.max(0, totalAmount - paidPortion);
        } else {
          payState = "pagado";
          paidAmount = totalAmount;
        }
      } else if (!isDone) {
        payState = "trunco";
        paidAmount = 0;
      } else {
        // BUG FIX (BEF-098): una factura "pendiente" con ABONOS reales en su historial
        // (pago parcial, ej. Transferencia S/ 1000 de un total S/ 2800) SÍ tiene ingreso
        // del día: se clasifica PARCIAL con la parte pagada como cobrado. Antes se
        // marcaba "pendiente" con pago 0 y la transferencia desaparecía del informe.
        const historyPaid = Array.isArray(inv?.payment_history)
          ? (inv.payment_history as any[]).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          : 0;
        const paidPortion = Math.min(totalAmount, historyPaid);
        if (paidPortion > 0.01) {
          payState = "parcial";
          paidAmount = paidPortion;
          pendingAmount = Math.max(0, totalAmount - paidPortion);
        } else {
          payState = "pendiente";
          paidAmount = 0;
          pendingAmount = totalAmount;
        }
      }
      const isPending = payState === "pendiente" || payState === "parcial";
      const isTrunco = payState === "trunco";

      const paymentMethod = inv?.payment_method || (csvRec?.method) || (isPending ? "PENDIENTE" : "EFECTIVO");

      // Desglose y destino AUTORITATIVOS de la Tabla Maestra (payment_breakdown + payment_destination)
      const breakdown = breakdownFromSources(
        paymentMethod,
        (inv as any)?.payment_breakdown,
        (inv as any)?.payment_destination || csvRec?.destination || "EMPRESA",
        paidAmount
      );

      let yDest = breakdown.yapeDestino || (csvRec?.destination ? csvRec.destination.toUpperCase() : "EMPRESA");
      let tDest = breakdown.transfDestino || (csvRec?.destination ? csvRec.destination.toUpperCase() : "EMPRESA");

      const desc =
        wo.items && wo.items.length > 0
          ? wo.items.map((i) => i.description).join(", ")
          : (wo as any).general_maintenance_service || (wo as any).diagnostic_notes || csvRec?.service || "Servicio de Taller";

      const techAssigned = wo.assigned_technician_id
        ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name
        : (wo as any).technician_name || csvRec?.technician;

      // Cada PAGO del historial con su N° de Ticket/Boleta/Factura se muestra en SU PROPIA
      // fila del informe (igual que el historial de la card de Caja).
      const histRecs = Array.isArray(inv?.payment_history) ? (inv.payment_history as any[]) : [];
      const comprobantes = histRecs.filter(
        (r) => r && r.receipt_number && String(r.receipt_number).trim() !== "" && String(r.receipt_number) !== "0" && String(r.receipt_number).toLowerCase() !== "s/n"
      );

      if (comprobantes.length > 1) {
        comprobantes.forEach((rec, si) => {
          const recAmount = Number(rec.amount) || 0;
          const subBd = breakdownFromSources(
            rec.method || "Efectivo",
            undefined,
            rec.destination || (inv as any)?.payment_destination || "EMPRESA",
            recAmount
          );
          rows.push({
            id: `${wo.id}-pay-${si}`,
            itemNumber: count++,
            plate: (wo.vehicle_plate || "S/P").toUpperCase(),
            description: desc,
            total: recAmount,
            isPending: false,
            payState: "pagado",
            pendingAmount: 0,
            isTrunco: false,
            efectivo: subBd.efectivo,
            yape: subBd.yape,
            transferencia: subBd.transferencia,
            culqi: subBd.culqi,
            responsable: (techAssigned || "Taller").split(" ")[0].toUpperCase(),
            yapeDestino: subBd.yapeDestino || yDest,
            transfDestino: subBd.transfDestino || tDest,
            isInvoice: true,
            orderStatus: "finalizado",
            receiptNumber: String(rec.receipt_number || ""),
            catServ: catSplit.total > 0 ? recAmount * (catSplit.serv / catSplit.total) : recAmount,
            catRep: catSplit.total > 0 ? recAmount * (catSplit.rep / catSplit.total) : 0,
            catCert: catSplit.total > 0 ? recAmount * (catSplit.cert / catSplit.total) : 0,
          });
        });
      } else {
        rows.push({
          id: wo.id,
          itemNumber: count++,
          plate: (wo.vehicle_plate || "S/P").toUpperCase(),
          description: desc,
          total: totalAmount,
          isPending,
          payState,
          pendingAmount,
          isTrunco,
          efectivo: breakdown.efectivo,
          yape: breakdown.yape,
          transferencia: breakdown.transferencia,
          culqi: breakdown.culqi,
          responsable: (techAssigned || "Taller").split(" ")[0].toUpperCase(),
          yapeDestino: yDest,
          transfDestino: tDest,
          isInvoice: Boolean(inv?.id),
          orderStatus: wo.status,
          receiptNumber: (inv?.receipt_number && String(inv.receipt_number) !== "0" ? String(inv.receipt_number) : "") || (csvRec?.receiptNumber && csvRec.receiptNumber !== "0" ? csvRec.receiptNumber : "") || "",
          catServ: catSplit.total > 0 ? totalAmount * (catSplit.serv / catSplit.total) : totalAmount,
          catRep: catSplit.total > 0 ? totalAmount * (catSplit.rep / catSplit.total) : 0,
          catCert: catSplit.total > 0 ? totalAmount * (catSplit.cert / catSplit.total) : 0,
        });
      }
    });

    // 3. Map Direct Invoices not linked to day's work orders
    // Solo se incluyen invoices REALES del día seleccionado:
    //  - Descarta huérfanas (work_order_id sin WO en work_orders)
    //  - Descarta invoices de WOs de otra fecha
    //  - Descarta invoices ya incluidas vía su WO del día
    //  - Deduplica por placa + recibo + monto (evita registros duplicados que inflan totales)
    const dayOrderIds = new Set(dayOrders.map((wo) => wo.id));
    const processedInvoiceKeys = new Set<string>();
    dayInvoices.forEach((inv) => {
      if (inv.work_order_id) {
        if (!dayOrderIds.has(inv.work_order_id)) return;
        if (processedOrderIds.has(inv.work_order_id)) return;
      }
      const plateKey = (inv.vehicle_plate || "").toUpperCase().trim();
      if (csvDayRecords.length > 0 && processedKeys.has(plateKey)) return;

      const dupKey = `${plateKey}|${inv.receipt_number || ""}|${Number(inv.grand_total) || 0}|${inv.payment_status || ""}`;
      if (processedInvoiceKeys.has(dupKey)) return;
      processedInvoiceKeys.add(dupKey);

      const totalAmount = Number(inv.grand_total) || Number((inv as any).total_amount) || 0;
      let payState: "pagado" | "pendiente" | "parcial" | "trunco";
      let pendingAmount = 0;
      let paidAmount = totalAmount;
      if (inv.payment_status === "pendiente") {
        const histPaid = Array.isArray(inv.payment_history)
          ? (inv.payment_history as any[]).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          : 0;
        const paidP = Math.min(totalAmount, histPaid);
        if (paidP > 0.01) {
          payState = "parcial";
          paidAmount = paidP;
          pendingAmount = Math.max(0, totalAmount - paidP);
        } else {
          payState = "pendiente";
          paidAmount = 0;
          pendingAmount = totalAmount;
        }
      } else {
        const creditAmt = Number((inv as any).credit_amount) || 0;
        let paidPortion = 0;
        if (inv.payment_breakdown && Array.isArray(inv.payment_breakdown)) {
          paidPortion = (inv.payment_breakdown as Array<{ amount?: number }>).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        }
        if (creditAmt > 0) {
          payState = "parcial";
          paidAmount = Math.max(0, totalAmount - creditAmt);
          pendingAmount = creditAmt;
        } else if (paidPortion > 0 && paidPortion < totalAmount - 0.01) {
          payState = "parcial";
          paidAmount = paidPortion;
          pendingAmount = Math.max(0, totalAmount - paidPortion);
        } else {
          payState = "pagado";
          paidAmount = totalAmount;
        }
      }
      const isPending = payState === "pendiente" || payState === "parcial";
      const isTrunco = false;
      const breakdown = breakdownFromSources(
        inv.payment_method || "EFECTIVO",
        (inv as any).payment_breakdown,
        (inv as any).payment_destination || "EMPRESA",
        paidAmount
      );

      let yDest = breakdown.yapeDestino || "EMPRESA";
      let tDest = breakdown.transfDestino || "EMPRESA";

      // Cada PAGO del historial con su N° de Ticket/Boleta/Factura se muestra en SU PROPIA fila.
      const histRecs = Array.isArray(inv?.payment_history) ? (inv.payment_history as any[]) : [];
      const comprobantes = histRecs.filter(
        (r) => r && r.receipt_number && String(r.receipt_number).trim() !== "" && String(r.receipt_number) !== "0" && String(r.receipt_number).toLowerCase() !== "s/n"
      );

      if (comprobantes.length > 1 && !isPending) {
        comprobantes.forEach((rec, si) => {
          const recAmount = Number(rec.amount) || 0;
          const subBd = breakdownFromSources(
            rec.method || "Efectivo",
            undefined,
            rec.destination || (inv as any).payment_destination || "EMPRESA",
            recAmount
          );
          rows.push({
            id: `${inv.id}-pay-${si}`,
            itemNumber: count++,
            plate: (inv.vehicle_plate || "VENTA DIRECTA").toUpperCase(),
            description: (inv as any).service_type || (inv as any).notes || "Certificación / Venta Directa",
            total: recAmount,
            isPending: false,
            payState: "pagado",
            pendingAmount: 0,
            isTrunco: false,
            efectivo: subBd.efectivo,
            yape: subBd.yape,
            transferencia: subBd.transferencia,
            culqi: subBd.culqi,
            responsable: "CAJA",
            yapeDestino: subBd.yapeDestino || yDest,
            transfDestino: subBd.transfDestino || tDest,
            isInvoice: true,
            orderStatus: "finalizado",
            receiptNumber: String(rec.receipt_number || ""),
          });
        });
      } else {
        rows.push({
          id: inv.id,
          itemNumber: count++,
          plate: (inv.vehicle_plate || "VENTA DIRECTA").toUpperCase(),
          description: (inv as any).service_type || (inv as any).notes || "Certificación / Venta Directa",
          total: totalAmount,
          isPending,
          payState,
          pendingAmount,
          isTrunco,
          efectivo: breakdown.efectivo,
          yape: breakdown.yape,
          transferencia: breakdown.transferencia,
          culqi: breakdown.culqi,
          responsable: "CAJA",
          yapeDestino: yDest,
          transfDestino: tDest,
          isInvoice: true,
          orderStatus: isPending ? "pendiente" : "finalizado",
          receiptNumber: (inv.receipt_number && String(inv.receipt_number) !== "0" ? String(inv.receipt_number) : "") || "",
        });
      }
    });

    return rows;
  }, [selectedDate, dayOrders, dayInvoices, invoicesByWorkOrderId, technicians]);

  // Filas reportables: SOLO servicios/repuestos con MONTO > 0 Y número de comprobante
  // (boleta/ticket/factura). Sin comprobante o sin monto NO se muestran en el informe.
  const hasComprobante = (r: any) => {
    const n = String(r.receiptNumber || "").trim();
    return n !== "" && n !== "0" && n.toLowerCase() !== "s/n";
  };
  const reportableRows = useMemo(() => consolidatedRows.filter((r) => Number(r.total) > 0 && hasComprobante(r)), [consolidatedRows]);

  // Liquidación del día: SOLO ingresos reales (facturas cobradas + abonos recibidos hoy).
  // Excluye pendientes/crédito y montos truncos (esos van a la pestaña Saldos Pendientes).
  const liquidacionRows = useMemo(() => {
    // Incluye PAGADO y PARCIAL (la parte pagada es ingreso real); excluye pendiente/trunco.
    const rows = reportableRows
      .filter((r) => r.payState !== "pendiente" && !r.isTrunco)
      .map((r) => ({ ...r }));

    (dayPayments || []).forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      const bd = breakdownFromSources(p.method || "EFECTIVO", p.payment_breakdown, p.destination || "EMPRESA", amt);
      const ef = bd.efectivo;
      const ya = bd.yape;
      const tr = bd.transferencia;
      const cu = bd.culqi;
      const dest = (p.destination || "EMPRESA").toUpperCase();
      rows.push({
        id: "abono_" + p.id,
        itemNumber: rows.length + 1,
        plate: (p.plate || "ABONO").toUpperCase(),
        description:
          (p.description || "Abono a factura pendiente") +
          (p.receipt_number ? ` — ${(p.receipt_type || "TICKET").toUpperCase()} ${p.receipt_number}` : ""),
        total: amt,
        isPending: false,
        payState: "pagado",
        pendingAmount: 0,
        isTrunco: false,
        efectivo: ef,
        yape: ya,
        transferencia: tr,
        culqi: cu,
        responsable: "ABONO",
        yapeDestino: bd.yapeDestino || dest,
        transfDestino: bd.transfDestino || dest,
        isInvoice: true,
        orderStatus: "finalizado",
        receiptNumber: (p.receipt_number && String(p.receipt_number) !== "0" ? String(p.receipt_number) : "") || "",
      });
    });

    rows.forEach((r, i) => {
      r.itemNumber = i + 1;
    });
    return rows;
  }, [reportableRows, dayPayments]);

  // Saldos pendientes por placa: agrupa facturas con saldo > 0 y su historial de
  // pagos (abonos) para el sub-informe gerencial de cuentas por cobrar.
  const pendingByPlate = useMemo(() => {
    const byPlate = new Map<string, PendingPlateEntry>();

    (invoices || []).forEach((inv: any) => {
      const grand = Number(inv.grand_total) || Number(inv.total_amount) || 0;
      if (grand <= 0) return;
      const status = inv.payment_status;
      const credit = Number(inv.credit_amount) || 0;
      const history: any[] = Array.isArray(inv.payment_history) ? inv.payment_history : [];
      const paidHistory = history.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const paidBreakdown = Array.isArray(inv.payment_breakdown)
        ? (inv.payment_breakdown as any[]).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
        : 0;
      const paid = Math.max(paidHistory, paidBreakdown, status === "pagado" ? grand : 0, credit > 0 ? grand - credit : 0);
      const balance = Math.max(0, grand - paid);
      if (balance <= 0.01) return;

      // La deuda oficial de la empresa vive en DEUDA 17.08.26.csv: se corrige la placa
      // y el nº de boleta con esa fuente (ej. 2035 -> D9B-201, B0Q-614 -> boleta 4469).
      const debtCsv = matchDebtCsvByInvoice(inv, balance);
      const plate = debtCsv ? debtCsv.placa.toUpperCase().trim() : (inv.vehicle_plate || "S/P").toUpperCase().trim();
      const entry: PendingPlateEntry = byPlate.get(plate) || {
        plate,
        client: inv.client_name || "",
        totalDebt: 0,
        invoiceCount: 0,
        invoices: [],
      };
      entry.totalDebt += balance;
      entry.invoiceCount += 1;
      if (!entry.client && inv.client_name) entry.client = inv.client_name;
      entry.invoices.push({
        invoice_id: inv.id,
        work_order_id: inv.work_order_id,
        issued_at: inv.issued_at || "",
        receipt_number: debtCsv ? debtCsv.boleta : inv.receipt_number,
        receipt_type: inv.receipt_type,
        grand_total: grand,
        paid: Math.min(grand, paid),
        balance,
        description: inv.observations || inv.notes || ((debtCsv ? debtCsv.boleta : inv.receipt_number) ? `Factura ${debtCsv ? debtCsv.boleta : inv.receipt_number}` : "Factura pendiente"),
        debt_observation: inv.debt_observation || "",
        debt_responsible: inv.debt_responsible || "",
        payments: history.map((p: any) => ({
          date: p.date || "",
          amount: Number(p.amount) || 0,
          method: p.method || "Efectivo",
          receipt_number: p.receipt_number,
          observation: p.observation || "",
          responsible: p.responsible || "",
        })),
      });
      byPlate.set(plate, entry);
    });

    return Array.from(byPlate.values()).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [invoices]);

  // Deuda pendiente por día (SEMANA de la fecha seleccionada) para el gráfico de curvas.
  // debt(día) = Σ de facturas emitidas hasta ese día de (total - pagado hasta ese día).
  // Incluye TODAS las facturas con monto (aunque hoy estén pagadas) para que la curva
  // SUBE cuando se registran créditos y BAJA cuando llegan abonos, fiel a lo registrado.
  const debtWeek = useMemo(() => {
    const paidUpToDate = (inv: any, day: string): number => {
      const grand = Number(inv.grand_total) || Number((inv as any).total_amount) || 0;
      const history: any[] = Array.isArray(inv.payment_history) ? inv.payment_history : [];
      if (history.length > 0) {
        return history.reduce((s: number, p: any) => {
          return s + ((p.date || "").slice(0, 10) <= day ? Number(p.amount) || 0 : 0);
        }, 0);
      }
      // Sin historial fechado: si fue pagada por desglose/estado, se considera pagada desde su emisión.
      const breakdownPaid = Array.isArray(inv.payment_breakdown)
        ? (inv.payment_breakdown as any[]).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
        : 0;
      const statusPaid = inv.payment_status === "pagado" ? grand : 0;
      const credit = Number(inv.credit_amount) || 0;
      const totalPaid = Math.max(breakdownPaid, statusPaid, credit > 0 ? grand - credit : 0);
      return (inv.issued_at || "").slice(0, 10) <= day ? totalPaid : 0;
    };

    const debtAt = (day: string): number => {
      let debt = 0;
      (invoices || []).forEach((inv: any) => {
        const grand = Number(inv.grand_total) || Number((inv as any).total_amount) || 0;
        if (grand <= 0) return;
        const issuedDay = (inv.issued_at || "").slice(0, 10);
        if (issuedDay > day) return;
        debt += Math.max(0, grand - paidUpToDate(inv, day));
      });
      return debt;
    };

    // Ventana de 7 días: la semana que termina en la fecha seleccionada.
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(selectedDate + "T12:00:00");
      d.setDate(d.getDate() - i);
      days.push(getPeruDateString(d));
    }
    const series = days.map((day) => ({ day, debt: debtAt(day) }));

    // Abonos registrados HOY: pagos con fecha = selectedDate, deduplicados por id
    // (el mismo pago puede estar en el snapshot de la factura y del work_order).
    const abonoById = new Map<string, number>();
    (invoices || []).forEach((inv: any) => {
      (Array.isArray(inv.payment_history) ? inv.payment_history : []).forEach((p: any) => {
        if ((p.date || "").slice(0, 10) !== selectedDate) return;
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;
        const k = p.id
          ? String(p.id)
          : `noid|${inv.id}|${(p.date || "").slice(0, 10)}|${p.receipt_number || ""}|${amt}`;
        if (!abonoById.has(k)) abonoById.set(k, amt);
      });
    });
    const abonosHoy = Array.from(abonoById.values()).reduce((s, a) => s + a, 0);

    const saldoActual = series[series.length - 1]?.debt || 0;
    const saldoAnterior = series.length > 1 ? series[series.length - 2].debt : saldoActual;
    // Identidad: actual = anterior + créditos del día - abonos del día
    const creditosHoy = Math.max(0, saldoActual - saldoAnterior + abonosHoy);

    return { series, saldoAnterior, saldoActual, abonosHoy, creditosHoy };
  }, [selectedDate, invoices]);

  // ===== Certificaciones del día (según lo ASIGNADO en la card del Taller) =====
  const dayCertifications = useMemo(() => {
    const map = new Map<string, any>();
    (dayOrders || []).forEach((wo) => {
      if (!wo.requires_certification) return;
      const inv = invoicesByWorkOrderId.get(wo.id);
      map.set(wo.id, {
        id: wo.id,
        plate: (wo.vehicle_plate || "S/P").toUpperCase(),
        client: inv?.client_name || "",
        certType: wo.certification_type || "Certificación",
        price: Number(wo.certification_price) || Number((inv as any)?.certification_fee) || 0,
        status: wo.status || "",
        issued: !!wo.certification_issued,
        receipt: inv?.receipt_number ? String(inv.receipt_number) : "",
      });
    });
    (dayInvoices || []).forEach((inv) => {
      const certFee = Number((inv as any).certification_fee) || 0;
      if (certFee <= 0) return;
      if (inv.work_order_id && map.has(inv.work_order_id)) return;
      map.set(inv.id, {
        id: inv.id,
        plate: (inv.vehicle_plate || "VENTA DIRECTA").toUpperCase(),
        client: inv.client_name || "",
        certType: "Certificación",
        price: certFee,
        status: inv.payment_status || "",
        issued: false,
        receipt: inv.receipt_number ? String(inv.receipt_number) : "",
      });
    });
    return Array.from(map.values()).sort((a: any, b: any) => String(a.plate).localeCompare(String(b.plate)));
  }, [dayOrders, dayInvoices, invoicesByWorkOrderId]);
  const totalCertDia = useMemo(
    () => dayCertifications.reduce((s: number, c: any) => s + (Number(c.price) || 0), 0),
    [dayCertifications]
  );

  // ===== Vehículos ingresados del día (Portería & Patio) =====
  const STATUS_LABEL: Record<string, string> = {
    ingresado: "INGRESADO",
    en_diagnostico: "EN DIAGNÓSTICO",
    esperando_repuestos: "ESPERANDO REPUESTOS",
    en_servicio: "EN SERVICIO",
    por_cobrar: "POR COBRAR",
    pendiente_pago: "PENDIENTE PAGO",
    pagado_autorizado: "PAGADO",
    finalizado: "FINALIZADO",
    entregado: "ENTREGADO",
  };
  const dayVehicles = useMemo(() => {
    return [...(dayOrders || [])]
      .filter((wo) => (wo.vehicle_plate || "").toUpperCase() !== "GASTO")
      .sort((a, b) => String(a.entry_time || "").localeCompare(String(b.entry_time || "")))
      .map((wo) => {
        const inv = invoicesByWorkOrderId.get(wo.id);
        const tech = wo.assigned_technician_id
          ? technicians.find((t) => t.id === wo.assigned_technician_id)?.full_name || wo.assigned_technician_id
          : (wo as any).technician_name || "";
        return {
          id: wo.id,
          plate: (wo.vehicle_plate || "S/P").toUpperCase(),
          entryTime: wo.entry_time || "",
          client: inv?.client_name || "",
          service: wo.general_maintenance_service || wo.problem_description || (wo.items && wo.items[0] ? wo.items[0].description : "") || "",
          tech: tech || "",
          status: wo.status || "",
        };
      });
  }, [dayOrders, invoicesByWorkOrderId, technicians]);
  const totalVehiclesDia = dayVehicles.length;

  // Financial Totals
  const totals = useMemo(() => {
    let cobradoEfectivo = 0;
    let cobradoYapes = 0;
    let cobradoTransferencias = 0;
    let cobradoCulqi = 0;
    let totalPendiente = 0;
    let totalTrunco = 0;
    let totalFacturado = 0;

    reportableRows.forEach((r) => {
      totalFacturado += r.total;
      if (r.payState === "trunco") {
        totalTrunco += r.total;
      } else if (r.payState === "pendiente") {
        totalPendiente += r.total;
      } else if (r.payState === "parcial") {
        totalPendiente += r.pendingAmount;
        cobradoEfectivo += r.efectivo;
        cobradoYapes += r.yape;
        cobradoTransferencias += r.transferencia;
        cobradoCulqi += r.culqi;
      } else {
        cobradoEfectivo += r.efectivo;
        cobradoYapes += r.yape;
        cobradoTransferencias += r.transferencia;
        cobradoCulqi += r.culqi;
      }
    });

    const totalAbonos = abonosDelDia.total;

    // Los ABONOS del día (ingresos sobre facturas de días anteriores) se suman en sus
    // propios métodos (EFECTIVO/YAPE/...), no solo como monto global: así la columna
    // EFECTIVO incluye abonos como el ticket TK01-00004588 (S/ 200 Efectivo) y el total
    // COBRADO coincide con el TOTAL.
    (dayPayments || []).forEach((p: any) => {
      const bd = breakdownFromSources(p.method || "EFECTIVO", p.payment_breakdown, p.destination || "EMPRESA", Number(p.amount) || 0);
      cobradoEfectivo += bd.efectivo;
      cobradoYapes += bd.yape;
      cobradoTransferencias += bd.transferencia;
      cobradoCulqi += bd.culqi;
      totalFacturado += Number(p.amount) || 0;
    });

    const totalLiquidacion =
      cobradoEfectivo + cobradoYapes + cobradoTransferencias + cobradoCulqi;

    return {
      cobradoEfectivo,
      cobradoYapes,
      cobradoTransferencias,
      cobradoCulqi,
      totalPendiente,
      totalTrunco,
      totalFacturado,
      totalLiquidacion,
      totalAbonos,
    };
  }, [reportableRows, abonosDelDia, dayPayments]);

  // Category Breakdown: Servicios vs Repuestos vs Certificaciones
  const categoryBreakdown = useMemo(() => {
    let servTotal = 0;
    let servCount = 0;
    let repTotal = 0;
    let repCount = 0;
    let certTotal = 0;
    let certCount = 0;

    // VENTAS POR CONCEPTO debe coincidir con el COBRADO del día: usa las mismas filas de la
    // liquidación (ingresos reales: facturas cobradas + abonos del día), no todas las filas.
    // También guarda los ITEMS de cada concepto (descripción, monto y N° de boleta) para
    // poder expandir la tabla VENTAS POR CONCEPTO y ver qué compone cada total.
    const servItems: Array<{ description: string; total: number; receiptNumber: string; plate: string }> = [];
    const repItems: Array<{ description: string; total: number; receiptNumber: string; plate: string }> = [];
    const certItems: Array<{ description: string; total: number; receiptNumber: string; plate: string }> = [];
    liquidacionRows.forEach((r) => {
      // 1) Reparto MANUAL por N° de comprobante: SOLO para registros históricos de la
      // Tabla Maestra (sin item_type). Los montos los definió el usuario y suman
      // exactamente el total de cada boleta. Los comprobantes de la card NO están aquí.
      const manualKey = normalizeReceiptKey(r.receiptNumber || "");
      // El reparto manual solo aplica al día definido por el usuario (17/08/2026):
      // así no choca con comprobantes del mismo número en otros días.
      const manual = selectedDate === "2026-08-17" && manualKey ? MANUAL_CONCEPT_SPLIT_BY_RECEIPT[manualKey] : undefined;
      if (manual) {
        if (manual.serv > 0) {
          servTotal += manual.serv;
          servCount += 1;
          servItems.push({ description: r.description, total: manual.serv, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        if (manual.rep > 0) {
          repTotal += manual.rep;
          repCount += 1;
          repItems.push({ description: r.description, total: manual.rep, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        if (manual.cert > 0) {
          certTotal += manual.cert;
          certCount += 1;
          certItems.push({ description: r.description, total: manual.cert, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        return;
      }

      // 2) Clasificación por la card del Taller: si la fila trae el desglose
      // (catServ/catRep/catCert), se reparte según lo ASIGNADO en la card, NO por keywords.
      // Una misma fila puede aportar a varios conceptos (ej: mantenimiento + repuestos + certificación).
      const catServ = Number(r.catServ) || 0;
      const catRep = Number(r.catRep) || 0;
      const catCert = Number(r.catCert) || 0;
      if (typeof r.catServ === "number" && typeof r.catRep === "number" && typeof r.catCert === "number") {
        if (catServ > 0) {
          servTotal += catServ;
          servCount += 1;
          servItems.push({ description: r.description, total: catServ, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        if (catRep > 0) {
          repTotal += catRep;
          repCount += 1;
          repItems.push({ description: r.description, total: catRep, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        if (catCert > 0) {
          certTotal += catCert;
          certCount += 1;
          certItems.push({ description: r.description, total: catCert, receiptNumber: r.receiptNumber || "", plate: r.plate });
        }
        return;
      }

      // 3) Fallback por texto (ventas directas / abonos / CSV sin desglose de card).
      // Normaliza acentos: "BUJÍAS" -> "BUJIAS" para que las keywords matcheen.
      const desc = r.description.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isCert = desc.includes("CERTIFIC") || desc.includes("ANUAL") || desc.includes("QUINQUENAL") || desc.includes("CHIP") || desc.includes("CILINDRO") || desc.includes("CONVERSI");
      const isRep = desc.includes("BUJIA") || desc.includes("BOBINA") || desc.includes("FILTRO") || desc.includes("CABLE") || desc.includes("VALVULA") || desc.includes("MEMBRANA") || desc.includes("RED") || desc.includes("INYECT") || desc.includes("EMULADOR") || desc.includes("VARIADOR") || desc.includes("KIT") || desc.includes("REPUESTO");
      const item = { description: r.description, total: Number(r.total) || 0, receiptNumber: r.receiptNumber || "", plate: r.plate };

      if (isCert) {
        certTotal += r.total;
        certCount += 1;
        certItems.push(item);
      } else if (isRep) {
        repTotal += r.total;
        repCount += 1;
        repItems.push(item);
      } else {
        servTotal += r.total;
        servCount += 1;
        servItems.push(item);
      }
    });

    const grandTotal = servTotal + repTotal + certTotal || totals.totalLiquidacion || 1;

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
      servItems,
      repItems,
      certItems,
    };
  }, [liquidacionRows, totals.totalLiquidacion]);

  // Electronic Destinations Matrix: Separating Yapes from Transferencias
  const electronicMatrix = useMemo(() => {
    // Columnas = DESTINO DE PAGO real de la Tabla Maestra (destinos presentes en los datos del día)
    const yapeRows: any[] = reportableRows.filter((r) => r.yape > 0).map((r) => ({ ...r }));
    const transfRows: any[] = reportableRows.filter((r) => r.transferencia > 0).map((r) => ({ ...r }));

    // ABONOS del día (pagos sobre facturas de otros días): también se distribuyen
    // por destino en la matriz electrónica (igual que el Reporte del Día y los totales).
    (dayPayments || []).forEach((p: any) => {
      const bd = breakdownFromSources(p.method || "EFECTIVO", p.payment_breakdown, p.destination || "EMPRESA", Number(p.amount) || 0);
      const dest = (p.destination || "EMPRESA").toUpperCase();
      if (bd.yape > 0) yapeRows.push({ yape: bd.yape, yapeDestino: bd.yapeDestino || dest });
      if (bd.transferencia > 0) transfRows.push({ transferencia: bd.transferencia, transfDestino: bd.transfDestino || dest });
    });
    const sortDests = (a: string, b: string) => (a === "EMPRESA" ? -1 : b === "EMPRESA" ? 1 : a.localeCompare(b));
    let yapeStaff = Array.from(new Set(yapeRows.map((r) => r.yapeDestino || "EMPRESA"))).sort(sortDests);
    let transfStaff = Array.from(new Set(transfRows.map((r) => r.transfDestino || "EMPRESA"))).sort(sortDests);
    if (yapeStaff.length === 0) yapeStaff = ["EMPRESA"];
    if (transfStaff.length === 0) transfStaff = ["EMPRESA"];

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
  }, [reportableRows, dayPayments]);

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
      if (r.payState === "pagado" || r.payState === "parcial") existing.completed += 1;
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
    const completed = consolidatedRows.filter((r) => r.payState === "pagado" || r.payState === "parcial").length;
    const inProgress = consolidatedRows.filter((r) => r.payState === "pendiente").length;
    const truncoCount = consolidatedRows.filter((r) => r.payState === "trunco").length;
    const pendingPay = totals.totalPendiente;
    const truncoTotal = totals.totalTrunco;

    return `Durante la jornada del ${formatPeruDate(selectedDate)}, el Taller ReyGas registró un movimiento total de ${totalVehicles} atenciones (${completed} pagadas/completadas, ${inProgress} pendientes/crédito, ${truncoCount} aún en taller sin culminar servicio). El valor total de atenciones del día fue S/ ${formatPEN(totals.totalFacturado)}, lográndose una recaudación efectiva en caja de S/ ${formatPEN(totals.totalLiquidacion)} (Efectivo: S/ ${formatPEN(totals.cobradoEfectivo)}, Yapes: S/ ${formatPEN(totals.cobradoYapes)}, Transferencias: S/ ${formatPEN(totals.cobradoTransferencias)}, Tarjeta: S/ ${formatPEN(totals.cobradoCulqi)}). Se mantienen S/ ${formatPEN(pendingPay)} en cuentas pendientes de cobro o crédito y S/ ${formatPEN(truncoTotal)} como monto trunco por no culminación del servicio (vehículos aún en taller).`;
  }, [consolidatedRows, totals, selectedDate]);

  // Helper component to render Main Report Table + Side Electronic Matrix.
  // En modo liquidación (pestaña Caja) solo se listan ingresos REALES del día
  // (facturas cobradas + abonos recibidos hoy); pendientes y truncos se omiten.
  const renderMainReportAndMatrix = (showConceptBreakdown: boolean, liquidacionOnly: boolean = false) => {
    const tableRows = (liquidacionOnly ? liquidacionRows : reportableRows).filter((r) => Number(r.total) > 0 && hasComprobante(r));
    const displayedTotalFacturado = liquidacionOnly ? totals.totalLiquidacion : totals.totalFacturado;
    const displayedCount = tableRows.length;

    return (
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

        <div className="space-y-4">

          {/* Main Cash & Workshop Table — ancho completo (antes 8/12 con la matriz al costado) */}
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">

              {/* Table Title Header Bar in Vibrant Gold */}
              <div className="bg-[#e58a00] text-black px-4 py-2.5 flex items-center justify-between font-black text-sm uppercase tracking-wider print:bg-gray-200 print:text-black">
                <span className="tracking-wide">REYGAS TALLER</span>
                <span className="text-base font-black">REPORTE DEL DÍA {formatPeruDate(selectedDate)}</span>
                <span className="text-xs bg-black/20 px-2.5 py-0.5 rounded-full font-mono">
                  {displayedCount} {liquidacionOnly ? "INGRESOS" : "ATENCIONES"}
                </span>
              </div>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#ffd269] text-black font-extrabold uppercase text-[11px] border-b border-amber-600/30 print:bg-gray-100">
                    <th className="py-2 px-2 text-center w-10 border-r border-amber-600/20">ITEM</th>
                    <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20">TOTAL</th>
                    <th className="py-2 px-2 text-center w-24 border-r border-amber-600/20 bg-[#aee2ff]">PLACA</th>
                    <th className="py-2 px-3 border-r border-amber-600/20 bg-[#d5cbfd]">SERVICIO O REPUESTO</th>
                    <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#a5f3fc] text-black" title="N° de Ticket / Boleta / Factura"># BOLETA</th>
                    <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#10b981] text-white">EFECTIVO</th>
                    <th className="py-2 px-2 text-center w-20 border-r border-amber-600/20 bg-[#c026d3] text-white">YAPE</th>
                    <th className="py-2 px-2 text-center w-24 border-r border-amber-600/20 bg-[#2563eb] text-white">TRANSFERENCIA</th>
                    <th className="py-2 px-2 text-center w-16 border-r border-amber-600/20 bg-[#eab308] text-black">CULQI</th>
                    <th className="py-2 px-2 text-center w-24 bg-[#e2e8f0] text-black">RESPONSABLE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {reportLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        <span className="inline-flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                          Consultando el día {formatPeruDate(selectedDate)} en la nube...
                        </span>
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400 italic">
                        No hay movimientos registrados para la fecha {formatPeruDate(selectedDate)}.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((r, idx) => (
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
                          {r.payState === "parcial" && (
                            <span className="block text-[9px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 rounded px-1 mt-0.5">
                              ⏳ parcial (saldo S/ {formatPEN(r.pendingAmount)})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-200 font-sans text-xs border-r border-white/5 truncate max-w-xs" title={r.description}>
                          {r.description}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-black text-cyan-200 bg-cyan-950/20 border-r border-white/5" title="N° de Ticket / Boleta / Factura">
                          {r.receiptNumber || "-"}
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
                    <td className="py-2 px-2 text-right font-mono font-black text-cyan-300 bg-cyan-950/40 border-r border-white/10">
                      —
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
                      S/ {formatPEN(displayedTotalFacturado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* YAPES & TRANSFERENCIAS POR DESTINO — colapsable (colapsado por defecto) */}
          <div className="overflow-hidden rounded-2xl border border-purple-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
            <div className="w-full bg-[#a21caf] text-white px-4 py-2.5 flex items-center justify-between gap-2 font-black text-xs uppercase tracking-wider print:bg-gray-200 print:text-black">
              <button
                type="button"
                onClick={() => setShowYapesPanel((p) => !p)}
                className="flex items-center gap-1.5 text-left flex-1"
                title="Expandir / Contraer panel"
              >
                <Coins className="w-4 h-4" />
                <span>YAPES & TRANSFERENCIAS POR DESTINO</span>
              </button>
              <span className="bg-black/30 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                TOTAL: S/ {formatPEN(electronicMatrix.grandElectronicTotal)}
              </span>
              {/* Botón expandir/colapsar — SIEMPRE al extremo derecho */}
              <button
                type="button"
                onClick={() => setShowYapesPanel((p) => !p)}
                className={`p-1 rounded-lg border transition-all shrink-0 ${showYapesPanel
                  ? "bg-white/20 text-white border-white/40"
                  : "bg-black/20 text-gray-200 border-white/20 hover:bg-black/40"
                  }`}
                title={showYapesPanel ? "Contraer panel" : "Expandir panel"}
              >
                {showYapesPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <div className={`${showYapesPanel ? "" : "hidden print:block"} overflow-x-auto`}>

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
                        className={`py-1.5 px-1 text-center font-black border-r border-purple-300 ${col === "EMPRESA" ? "bg-[#dcfce7] text-emerald-950" : ""
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
                            className={`py-1 px-1 text-right border-r border-white/5 ${val > 0 ? "font-bold text-purple-300 bg-purple-950/20" : "text-gray-700"
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
                            className={`py-1 px-1 text-right border-r border-white/5 ${val > 0 ? "font-bold text-blue-300 bg-blue-950/20" : "text-gray-700"
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

                  {/* 5. Row TOTAL GENERAL DEL DÍA (pertenece a la tabla YAPES & TRANSFERENCIAS) */}
                  {(() => {
                    const g = electronicMatrix.grandElectronicTotal + totals.cobradoEfectivo + totals.cobradoCulqi;
                    const isC = Math.abs(g - totals.totalFacturado) < 0.05;
                    return (
                      <tr className={`text-xs font-black border-t-2 ${isC
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400"
                        : "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400"
                        }`}>
                        <td
                          className="py-2 px-2 font-black uppercase tracking-wider text-[11px]"
                          colSpan={electronicMatrix.yapeStaff.length + 1}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>TOTAL GENERAL DEL DÍA</span>
                            {isC ? (
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
                          S/ {formatPEN(g)}
                        </td>
                      </tr>
                    );
                  })()}

                </tfoot>
              </table>
            </div>
          </div>

            {/* CUADRE / ARQUEO GENERAL DEL DÍA — siempre visible, ancho completo */}
            <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
              <div className="bg-gradient-to-r from-amber-700 to-yellow-800 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-200" />
                  <span>ARQUEO GENERAL DEL DÍA</span>
                </span>
                {(() => {
                  const g = electronicMatrix.grandElectronicTotal + totals.cobradoEfectivo + totals.cobradoCulqi;
                  const isC = Math.abs(g - totals.totalFacturado) < 0.05;
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isC ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                      {isC ? "CUADRADO ✔" : "VERIFICAR ⚠"}
                    </span>
                  );
                })()}
              </div>
              <table className="w-full text-xs text-left border-collapse font-mono">
                <tbody>
                  <tr className="bg-white/[0.04] text-gray-200 font-bold text-xs border-t border-white/10">
                    <td className="py-2 px-3 font-extrabold uppercase tracking-wider text-[11px]">💰 TOTAL EFECTIVO</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-xs text-white">S/ {formatPEN(totals.cobradoEfectivo)}</td>
                  </tr>
                  <tr className="bg-rose-950/40 text-rose-300 font-extrabold text-xs">
                    <td className="py-2 px-3 font-extrabold uppercase tracking-wider text-[11px]">💸 GASTOS</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-xs text-rose-300">− S/ {formatPEN(totalGastos)}</td>
                  </tr>
                  <tr className="bg-emerald-950/40 text-emerald-300 font-black text-xs border-t border-emerald-500/20">
                    <td className="py-2 px-3 font-extrabold uppercase tracking-wider text-[11px]">🏦 TOTAL EN EFECTIVO (CAJA)</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-xs text-emerald-300">S/ {formatPEN(totals.cobradoEfectivo - totalGastos)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* VENTAS POR CONCEPTO — colapsable (colapsado por defecto) */}
            {showConceptBreakdown && (
              <div className="overflow-hidden rounded-2xl border border-teal-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
                <div className="w-full bg-gradient-to-r from-teal-700 to-cyan-800 text-white px-4 py-2.5 flex items-center justify-between gap-2 font-black text-xs uppercase tracking-wider print:bg-gray-200 print:text-black">
                  <button
                    type="button"
                    onClick={() => setShowConceptPanel((p) => !p)}
                    className="flex items-center gap-1.5 text-left flex-1"
                    title="Expandir / Contraer panel"
                  >
                    <Layers className="w-4 h-4 text-cyan-300" />
                    <span>VENTAS POR CONCEPTO</span>
                  </button>
                  <span className="bg-black/30 text-teal-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    S/ {formatPEN(categoryBreakdown.grandTotal)}
                  </span>
                  {/* Botón expandir/colapsar — SIEMPRE al extremo derecho */}
                  <button
                    type="button"
                    onClick={() => setShowConceptPanel((p) => !p)}
                    className={`p-1 rounded-lg border transition-all shrink-0 ${showConceptPanel
                      ? "bg-white/20 text-white border-white/40"
                      : "bg-black/20 text-gray-200 border-white/20 hover:bg-black/40"
                      }`}
                    title={showConceptPanel ? "Contraer panel" : "Expandir panel"}
                  >
                    {showConceptPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                <div className={`${showConceptPanel ? "" : "hidden print:block"} overflow-x-auto`}>

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
                    <tr className="hover:bg-white/5 text-white cursor-pointer" onClick={() => setExpandedConcept(expandedConcept === "serv" ? null : "serv")}>
                      <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-teal-300">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedConcept === "serv" ? "rotate-90" : ""}`} />
                        <span>🔧</span>
                        <span>Servicios</span>
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
                    {expandedConcept === "serv" && categoryBreakdown.servItems.length > 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 bg-teal-950/20 border-t border-teal-500/20">
                          <div className="space-y-1">
                            {categoryBreakdown.servItems.map((it, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                                <span className="text-gray-300 truncate max-w-[45%]">{it.plate} · {it.description}</span>
                                <span className="text-gray-400">🧾 {it.receiptNumber || "S/N"}</span>
                                <span className="font-black text-teal-300">S/ {Number(it.total).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 2. Almacén (repuestos asignados) */}
                    <tr className="hover:bg-white/5 text-white cursor-pointer" onClick={() => setExpandedConcept(expandedConcept === "rep" ? null : "rep")}>
                      <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-emerald-300">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedConcept === "rep" ? "rotate-90" : ""}`} />
                        <span>📦</span>
                        <span>Almacén</span>
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
                    {expandedConcept === "rep" && categoryBreakdown.repItems.length > 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 bg-emerald-950/20 border-t border-emerald-500/20">
                          <div className="space-y-1">
                            {categoryBreakdown.repItems.map((it, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                                <span className="text-gray-300 truncate max-w-[45%]">{it.plate} · {it.description}</span>
                                <span className="text-gray-400">🧾 {it.receiptNumber || "S/N"}</span>
                                <span className="font-black text-emerald-300">S/ {Number(it.total).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 3. Certificaciones */}
                    <tr className="hover:bg-white/5 text-white cursor-pointer" onClick={() => setExpandedConcept(expandedConcept === "cert" ? null : "cert")}>
                      <td className="py-2 px-2.5 font-sans font-bold flex items-center gap-1.5 text-purple-300">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedConcept === "cert" ? "rotate-90" : ""}`} />
                        <span>📜</span>
                        <span>Certificados</span>
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
                    {expandedConcept === "cert" && categoryBreakdown.certItems.length > 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 bg-purple-950/20 border-t border-purple-500/20">
                          <div className="space-y-1">
                            {categoryBreakdown.certItems.map((it, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                                <span className="text-gray-300 truncate max-w-[45%]">{it.plate} · {it.description}</span>
                                <span className="text-gray-400">🧾 {it.receiptNumber || "S/N"}</span>
                                <span className="font-black text-purple-300">S/ {Number(it.total).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
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
              </div>
            )}
          </div>
        </div>
    );
  };

  // Print Report Handler — según skill de impresión: dar tiempo al navegador
  // para aplicar los estilos de @media print antes de abrir el diálogo.
  const handlePrint = () => {
    setTimeout(() => window.print(), 150);
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    let csv = `REPORTE DE TALLER & CAJA - REYGAS AUTOGAS EQUIPMENT\n`;
    csv += `Fecha: ${selectedDate}\n\n`;
    csv += `ITEM,PLACA,SERVICIO / REPUESTO,# BOLETA,EFECTIVO,YAPE,TRANSFERENCIA,CULQI,RESPONSABLE\n`;

    reportableRows.forEach((r) => {
      csv += `"${r.itemNumber}","${r.plate}","${r.description.replace(/"/g, '""')}","${r.receiptNumber || ""}","${r.efectivo.toFixed(2)}","${r.yape.toFixed(2)}","${r.transferencia.toFixed(2)}","${r.culqi.toFixed(2)}","${r.responsable}"\n`;
    });

    csv += `\nTOTALES,,,${totals.totalFacturado.toFixed(2)},${totals.cobradoEfectivo.toFixed(2)},${totals.cobradoYapes.toFixed(2)},${totals.cobradoTransferencias.toFixed(2)},${totals.cobradoCulqi.toFixed(2)}\n`;

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
    { id: "pendientes", label: "2. Saldos Pendientes por Placa", icon: TrendingDown, color: "text-rose-400" },
    { id: "taller", label: "3. Productividad & Órdenes de Taller", icon: Wrench, color: "text-indigo-400" },
    { id: "servicios", label: "4. Servicios & Repuestos Despachados", icon: Layers, color: "text-emerald-400" },
    { id: "almacen", label: "5. Almacén & Valorización", icon: Package, color: "text-cyan-400" },
    { id: "certificaciones", label: "6. Certificaciones GNV/GLP", icon: Award, color: "text-purple-400" },
    { id: "porteria", label: "7. Portería & Patio", icon: ShieldAlert, color: "text-rose-400" },
    { id: "asistencia", label: "8. Asistencia de Personal", icon: Clock, color: "text-teal-400" },
    { id: "resumen", label: "9. Resumen Ejecutivo & Firmas", icon: Sparkles, color: "text-amber-300" },
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
          {/* Navegador de Fecha Universal (estándar ReyGas): Día Anterior | fecha | Día Siguiente | Hoy */}
          <DateNavigator value={selectedDate} onChange={setSelectedDate} />

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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${isActive
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

            {/* Card 5: Gastos del Día (egresos de caja) */}
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
                <ReceiptText className="w-3 h-3" />
                <span>Gastos del Día ({dayExpenses.length})</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-rose-300 mt-1">
                − S/ {formatPEN(totalGastos)}
              </span>
            </div>

            {/* Card 6: Total Liquidación (solo ingresos reales del día) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/40 flex flex-col justify-between shadow-lg shadow-amber-500/10">
              <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Total Liquidación (Ingresos)</span>
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-amber-300 mt-1">
                S/ {formatPEN(totals.totalLiquidacion)}
              </span>
            </div>
          </div>
        )}

        {/* Gastos del Día (egresos de caja) — detalle (solo en tab Caja, NO en Saldos Pendientes) */}
        {activeTab === "caja" && totalGastos > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-rose-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
            <div className="bg-gradient-to-r from-rose-700 to-red-800 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-rose-300" />
                <span>GASTOS DEL DÍA</span>
              </div>
              <span className="bg-black/30 text-rose-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                − S/ {formatPEN(totalGastos)}
              </span>
            </div>
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="bg-[#fecdd3] text-rose-950 font-extrabold uppercase text-[10px] border-b border-rose-300">
                  <th className="py-1.5 px-2.5">DESCRIPCIÓN</th>
                  <th className="py-1.5 px-2 text-center">DESTINO</th>
                  <th className="py-1.5 px-2 text-center">ENTREGADO A</th>
                  <th className="py-1.5 px-2 text-right">MONTO (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {dayExpenses.map((e: any, i: number) => (
                  <tr key={e.id || i} className="hover:bg-white/5 text-gray-200">
                    <td className="py-2 px-2.5 font-sans font-bold text-rose-200">{e.description}</td>
                    <td className="py-2 px-2 text-center text-gray-300">{e.destination || "EMPRESA"}</td>
                    <td className="py-2 px-2 text-center text-gray-300">{e.delivered_to || "—"}</td>
                    <td className="py-2 px-2 text-right font-black text-rose-300">− S/ {formatPEN(Number(e.amount) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CAJA & LIQUIDACIÓN DIARIA (CON DESGLOSE DE CONCEPTOS) */}
        {/* ========================================================================= */}
        {activeTab === "caja" && renderMainReportAndMatrix(true, true)}

        {/* ========================================================================= */}
        {/* TAB PENDIENTES: SALDOS PENDIENTES POR PLACA + GRÁFICO DE DEUDA DIARIA */}
        {/* ========================================================================= */}
        {activeTab === "pendientes" && (
          <div className="space-y-6">
            {/* KPI row del sub-informe de cuentas por cobrar: evolución del saldo en la fecha seleccionada */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Saldo Anterior</span>
                </span>
                <span className="text-lg sm:text-xl font-mono font-black text-rose-300 mt-1">
                  S/ {formatPEN(debtWeek.saldoAnterior)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Créditos del Día</span>
                </span>
                <span className="text-lg sm:text-xl font-mono font-black text-amber-300 mt-1">
                  + S/ {formatPEN(debtWeek.creditosHoy)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  <span>Abonos del Día</span>
                </span>
                <span className="text-lg sm:text-xl font-mono font-black text-cyan-300 mt-1">
                  − S/ {formatPEN(debtWeek.abonosHoy)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-500/25 to-black/40 border border-rose-400/40 flex flex-col justify-between shadow-lg shadow-rose-500/10">
                <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Saldo Pendiente Actual</span>
                </span>
                <div className="mt-1">
                  <span className="text-lg sm:text-xl font-mono font-black text-rose-200">
                    S/ {formatPEN(debtWeek.saldoActual)}
                  </span>
                  <span className="block text-[10px] font-mono text-gray-400 font-bold">
                    {pendingByPlate.length} placas con saldo
                  </span>
                </div>
              </div>
            </div>

            {/* Narrativa ejecutiva del sub-informe */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-black/40 to-amber-500/10 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-black text-sm uppercase">
                <Sparkles className="w-5 h-5" />
                <span>Sub-Informe Gerencial: Cuentas por Cobrar</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium">
                Al inicio del día <strong>{formatPeruDate(selectedDate)}</strong> el saldo pendiente era de{" "}
                <strong>S/ {formatPEN(debtWeek.saldoAnterior)}</strong>. Durante el día se registraron{" "}
                <strong>S/ {formatPEN(debtWeek.creditosHoy)} en nuevos créditos</strong> y{" "}
                <strong>S/ {formatPEN(debtWeek.abonosHoy)} en abonos</strong>, quedando un saldo pendiente actual de{" "}
                <strong>S/ {formatPEN(debtWeek.saldoActual)}</strong> en <strong>{pendingByPlate.length} placas</strong>.
                Si hubo abonos el saldo disminuye; si se registraron créditos, aumenta. Esta información NO forma parte
                de la liquidación de caja del día (ahí solo se reportan los ingresos reales recibidos); sirve para el seguimiento
                y cobranza de deudas. Expandir cada placa muestra el detalle de sus facturas y el historial de abonos.
              </p>
            </div>

            {/* Gráfico de línea diario de la deuda pendiente (SVG, sin librería) */}
            <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-rose-500/30 space-y-3 print:border-black print:rounded-none">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span>Evolución Semanal de la Deuda Pendiente</span>
                </h3>
                <span className="text-[10px] font-mono text-gray-400 font-bold">
                  Semana del {formatPeruDate(debtWeek.series[0]?.day || selectedDate)} · S/ {formatPEN(debtWeek.saldoActual)} ACTUAL
                </span>
              </div>

              {(() => {
                const points = debtWeek.series;
                const W = 860;
                const H = 220;
                const padL = 64;
                const padR = 16;
                const padT = 16;
                const padB = 34;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const maxDebt = Math.max(1, ...points.map((p) => p.debt));
                const maxVal = Math.ceil(maxDebt * 1.1 / 100) * 100;
                const stepX = points.length > 1 ? plotW / (points.length - 1) : plotW;
                const coords = points.map((p, i) => ({
                  x: padL + i * stepX,
                  y: padT + plotH - (p.debt / maxVal) * plotH,
                  ...p,
                }));
                const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
                const areaPath = coords.length
                  ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
                  : "";
                const last = coords[coords.length - 1];
                const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
                  y: padT + plotH - f * plotH,
                  val: maxVal * f,
                }));

                return (
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px] h-auto">
                      {/* Grid horizontal */}
                      {yTicks.map((t) => (
                        <g key={t.val}>
                          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                          <text x={padL - 8} y={t.y + 3} textAnchor="end" fontSize="10" fill="#9ca3af" fontFamily="monospace">
                            S/ {formatPEN(t.val)}
                          </text>
                        </g>
                      ))}
                      {/* Eje X labels (cada día de la semana de la fecha seleccionada) */}
                      {coords.map((c, i) => (
                        <text
                          key={i}
                          x={c.x}
                          y={H - padB + 16}
                          textAnchor="middle"
                          fontSize="9"
                          fill={i === coords.length - 1 ? "#fda4af" : "#9ca3af"}
                          fontFamily="monospace"
                          fontWeight={i === coords.length - 1 ? "bold" : "normal"}
                        >
                          {c.day.slice(8)}/{c.day.slice(5, 7)}
                        </text>
                      ))}
                      {/* Área de relleno */}
                      {areaPath && <path d={areaPath} fill="rgba(244,63,94,0.12)" />}
                      {/* Línea principal */}
                      <path d={linePath} fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                      {/* Puntos */}
                      {coords.map((c, i) => (
                        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} fill={i === coords.length - 1 ? "#f43f5e" : "#fb7185"} />
                      ))}
                      {/* Etiqueta del último valor */}
                      {last && (
                        <text x={Math.min(last.x, W - padR - 50)} y={Math.max(last.y - 8, padT + 10)} fontSize="10" fill="#fda4af" fontFamily="monospace" fontWeight="bold">
                          S/ {formatPEN(last.debt)}
                        </text>
                      )}
                    </svg>
                  </div>
                );
              })()}
              <p className="text-[10px] text-gray-500 font-mono text-right">
                Semana de la fecha seleccionada ({formatPeruDate(debtWeek.series[0]?.day || selectedDate)} → {formatPeruDate(selectedDate)}).
                La curva sube cuando se registran créditos y baja cuando llegan abonos, según lo registrado en el día.
              </p>
            </div>

            {/* Detalle colapsable por placa */}
            <div className="space-y-3">
              {pendingByPlate.length === 0 ? (
                <div className="glass-panel p-6 rounded-2xl border border-white/10 text-center text-gray-400 text-sm italic">
                  🎉 No existen facturas con saldo pendiente. Todas las cuentas están al día.
                </div>
              ) : (
                pendingByPlate.map((entry) => {
                  const isOpen = expandedPlate === entry.plate;
                  return (
                    <div key={entry.plate} className="overflow-hidden rounded-2xl border border-rose-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
                      <button
                        type="button"
                        onClick={() => setExpandedPlate(isOpen ? null : entry.plate)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-rose-950/50 to-black/60 hover:bg-rose-950/70 transition-colors print:bg-gray-100 print:text-black"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black text-sm font-mono">
                            {entry.plate}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate print:text-black">
                              {entry.client || "Cliente no registrado"}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {entry.invoiceCount} factura(s) con saldo
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-mono font-black text-rose-300 print:text-black">
                            S/ {formatPEN(entry.totalDebt)}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-rose-300" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-rose-300" />
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-rose-500/20 p-4 space-y-3">
                          {entry.invoices.map((inv) => {
                            const totalPaid = entry.invoices.reduce((s, x) => s + x.paid, 0);
                            void totalPaid;
                            return (
                              <div key={inv.invoice_id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-bold text-white flex items-center gap-2">
                                    <Receipt className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{inv.receipt_type || "COMPROBANTE"}</span>
                                    {inv.receipt_number && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                                        {inv.receipt_number}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    Emitido: {inv.issued_at ? formatPeruDate(inv.issued_at.slice(0, 10)) : "—"}
                                  </span>
                                </div>
                                <div className="mt-2 text-[11px] font-sans text-gray-300">{inv.description}</div>
                                {(inv.debt_observation || inv.debt_responsible) && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-sans">
                                    {inv.debt_responsible && (
                                      <span className="px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        Resp: {inv.debt_responsible}
                                      </span>
                                    )}
                                    {inv.debt_observation && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {inv.debt_observation}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono">
                                  <div className="rounded-lg bg-white/5 px-2 py-1.5">
                                    <span className="block text-[9px] uppercase text-gray-400">Total</span>
                                    <span className="font-black text-white">S/ {formatPEN(inv.grand_total)}</span>
                                  </div>
                                  <div className="rounded-lg bg-emerald-950/30 px-2 py-1.5">
                                    <span className="block text-[9px] uppercase text-emerald-400">Pagado</span>
                                    <span className="font-black text-emerald-300">S/ {formatPEN(inv.paid)}</span>
                                  </div>
                                  <div className="rounded-lg bg-rose-950/30 px-2 py-1.5">
                                    <span className="block text-[9px] uppercase text-rose-400">Saldo</span>
                                    <span className="font-black text-rose-300">S/ {formatPEN(inv.balance)}</span>
                                  </div>
                                </div>
                                {inv.payments.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-white/5">
                                    <div className="text-[9px] uppercase text-gray-400 font-bold mb-1">Historial de Abonos</div>
                                    <div className="space-y-0.5">
                                      {inv.payments.map((p, pi) => (
                                        <div key={pi} className="flex items-center justify-between text-[11px] font-mono">
                                          <span className="text-gray-300">
                                            {p.date ? formatPeruDate(p.date.slice(0, 10)) : "—"} • {p.method}
                                            {p.receipt_number ? ` (${p.receipt_number})` : ""}
                                            {p.responsible ? ` • 👤 ${p.responsible}` : ""}
                                            {p.observation ? ` • 📝 ${p.observation}` : ""}
                                          </span>
                                          <span className="font-black text-emerald-300">S/ {formatPEN(p.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

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
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${wo.status === "finalizado" || wo.status === "pagado_autorizado"
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
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${it.type === "servicio"
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
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-cyan-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
              <div className="bg-gradient-to-r from-cyan-700 to-sky-800 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-cyan-300" />
                  <span>Certificaciones Realizadas el {formatPeruDate(selectedDate)}</span>
                </div>
                <span className="bg-black/30 text-cyan-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  {dayCertifications.length} CERTIFICADOS · S/ {formatPEN(totalCertDia)}
                </span>
              </div>
              {dayCertifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm italic">
                  No se asignaron certificaciones en las cards del taller para esta fecha.
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse font-mono">
                  <thead>
                    <tr className="bg-[#cffafe] text-cyan-950 font-extrabold uppercase text-[10px] border-b border-cyan-300">
                      <th className="py-1.5 px-2.5">PLACA</th>
                      <th className="py-1.5 px-2">CLIENTE</th>
                      <th className="py-1.5 px-2">TIPO DE CERTIFICACIÓN</th>
                      <th className="py-1.5 px-2 text-center">PRECIO (S/)</th>
                      <th className="py-1.5 px-2 text-center">ESTADO</th>
                      <th className="py-1.5 px-2 text-center"># COMPROBANTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[11px]">
                    {dayCertifications.map((c: any) => (
                      <tr key={c.id} className="hover:bg-white/5 text-gray-200">
                        <td className="py-2 px-2.5 font-black text-cyan-300">{c.plate}</td>
                        <td className="py-2 px-2 text-gray-300 truncate max-w-[160px]">{c.client || "—"}</td>
                        <td className="py-2 px-2 text-purple-300 font-bold">{c.certType}</td>
                        <td className="py-2 px-2 text-right font-black text-white">S/ {formatPEN(Number(c.price) || 0)}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${c.status === "pagado_autorizado" || c.status === "finalizado" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                            {STATUS_LABEL[c.status] || c.status || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-cyan-200">{c.receipt || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0891b2] text-white font-black text-xs">
                      <td className="py-2 px-2.5 font-black uppercase tracking-wider" colSpan={3}>
                        TOTAL CERTIFICACIONES DEL DÍA
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-sm">
                        S/ {formatPEN(totalCertDia)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <p className="text-[10px] text-gray-500 font-mono">
              Según lo ASIGNADO en la card del Taller (certificación marcada en la orden): anual GNV/GLP, quinquenal, chip. Se muestran solo las del día seleccionado.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: PORTERÍA, PATIO & ESTADÍA VEHICULAR */}
        {/* ========================================================================= */}
        {activeTab === "porteria" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-500/30 bg-black/40 shadow-xl print:border-black print:rounded-none">
              <div className="bg-gradient-to-r from-rose-700 to-red-800 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-300" />
                  <span>Vehículos Ingresados el {formatPeruDate(selectedDate)}</span>
                </div>
                <span className="bg-black/30 text-rose-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  {dayVehicles.length} VEHÍCULOS
                </span>
              </div>
              {dayVehicles.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm italic">
                  No se registraron ingresos de vehículos para esta fecha.
                </div>
              ) : (
                <div className="p-3 space-y-2.5">
                  {dayVehicles.map((v: any, i: number) => {
                    const isOpen = expandedPorteriaVehicle === v.id;
                    return (
                      <div
                        key={v.id}
                        className="overflow-hidden rounded-2xl border border-rose-500/30 bg-black/40 print:border-black print:rounded-none"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedPorteriaVehicle(isOpen ? null : v.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-rose-950/50 to-black/60 hover:bg-rose-950/70 transition-colors print:bg-gray-100 print:text-black"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black text-sm font-mono">
                              {v.plate}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate print:text-black">
                                {v.entryTime ? `${v.entryTime.slice(11, 16)} hrs · ` : ""}{v.client || "Cliente no registrado"}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono truncate">
                                {v.service || "Sin servicio asignado"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${v.status === "finalizado" || v.status === "entregado" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                              {STATUS_LABEL[v.status] || v.status || "—"}
                            </span>
                            {isOpen ? <ChevronUp className="w-4 h-4 text-rose-300" /> : <ChevronDown className="w-4 h-4 text-rose-300" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-rose-500/20 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] font-mono">
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">N° Ingreso</span>
                              <span className="font-black text-white print:text-black">#{i + 1}</span>
                            </div>
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">Hora Ingreso</span>
                              <span className="font-black text-rose-300">{v.entryTime ? v.entryTime.slice(11, 16) : "—"} hrs</span>
                            </div>
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">Cliente</span>
                              <span className="font-black text-white print:text-black">{v.client || "—"}</span>
                            </div>
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">Técnico</span>
                              <span className="font-black text-indigo-300">{v.tech || "—"}</span>
                            </div>
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 col-span-2 sm:col-span-1 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">Estado</span>
                              <span className="font-black text-amber-300">{STATUS_LABEL[v.status] || v.status || "—"}</span>
                            </div>
                            <div className="rounded-lg bg-white/5 px-2.5 py-2 col-span-2 print:bg-gray-50">
                              <span className="block text-[9px] uppercase text-gray-400">Servicio / Motivo</span>
                              <span className="font-sans text-gray-200 print:text-black">{v.service || "—"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="rounded-xl bg-gradient-to-r from-rose-700 to-red-800 text-white px-4 py-2.5 flex items-center justify-between font-black text-xs uppercase tracking-wider print:bg-gray-100 print:text-black">
                    <span>TOTAL VEHÍCULOS INGRESADOS</span>
                    <span className="font-mono font-black text-sm">{dayVehicles.length}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-500 font-mono">
              Registro de ingreso vehicular del día seleccionado (Portería & Patio). Haz clic en cada card para ver el detalle (todas colapsadas por defecto).
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
                  onChange={(e) => setObservations(capitalizeFirst(e.target.value))}
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
                    onChange={(e) => setResponsibleName(titleCase(e.target.value))}
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
                    onChange={(e) => setManagerName(titleCase(e.target.value))}
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
    <div className="reygas-print-container fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-7xl bg-reygas-navy border border-white/15 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col h-[92vh] max-h-[92vh] print:h-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:text-black">
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
