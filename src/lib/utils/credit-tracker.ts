import { WorkOrder, Invoice } from "@/lib/store/app-store";
import { formatPeruDate } from "@/lib/utils/date-utils";

export interface CreditSettlementInfo {
  isSettled: boolean;
  settledDate?: string;
  settledAmount?: number;
  settledByOrderId?: string;
  originalCreditAmount?: number;
  hasCredit: boolean;
  creditAmount: number;
}

export interface CancellationInfo {
  isCancellation: boolean;
  cancelsOrderId?: string;
  originalService?: string;
  originalDate?: string;
  amount?: number;
}

export interface SplitPaymentDetail {
  hasSplit: boolean;
  efectivo: number;
  yape: number;
  transferencia: number;
  culqi: number;
  formattedSummary: string;
}

/**
 * Parses split payment codes from discount/notes strings (e.g. "E 50 Y 150", "C 70 E 230", "E:50, Y:150")
 */
export function parseSplitPaymentString(
  discountsRaw: any = "",
  notesRaw: string = "",
  methodRaw: string = "",
  finalAmount: number = 0,
  observationsRaw: string = ""
): SplitPaymentDetail {
  const result: SplitPaymentDetail = {
    hasSplit: false,
    efectivo: 0,
    yape: 0,
    transferencia: 0,
    culqi: 0,
    formattedSummary: "",
  };

  const combined = `${typeof discountsRaw === "string" ? discountsRaw : ""} ${notesRaw || ""} ${observationsRaw || ""} ${methodRaw || ""}`.toUpperCase();
  const regex = /([CEYTPB])\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/gi;
  const matches = [...combined.matchAll(regex)];

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
      result.hasSplit = true;
      const parts: string[] = [];
      if (result.efectivo > 0) parts.push(`💵 Efectivo: S/ ${result.efectivo.toFixed(2)}`);
      if (result.yape > 0) parts.push(`📱 Yape: S/ ${result.yape.toFixed(2)}`);
      if (result.transferencia > 0) parts.push(`🏦 Transf: S/ ${result.transferencia.toFixed(2)}`);
      if (result.culqi > 0) parts.push(`💳 Culqi: S/ ${result.culqi.toFixed(2)}`);
      result.formattedSummary = parts.join(" • ");
      return result;
    }
  }

  // Check if combined methods like "YAPE, EFECTIVO" without numeric letters
  const methodUpper = (methodRaw || "").toUpperCase();
  if (methodUpper.includes("YAPE") && methodUpper.includes("EFECTIVO")) {
    result.hasSplit = true;
    result.formattedSummary = "📱 Yape + 💵 Efectivo";
    return result;
  }
  if (methodUpper.includes("CULQI") && methodUpper.includes("EFECTIVO")) {
    result.hasSplit = true;
    result.formattedSummary = "💳 Culqi + 💵 Efectivo";
    return result;
  }

  // Single method
  if (methodUpper.includes("YAPE") || methodUpper.includes("PLIN")) {
    result.yape = finalAmount;
  } else if (
    methodUpper.includes("TRANSFERENCIA") ||
    methodUpper.includes("BCP") ||
    methodUpper.includes("BBVA") ||
    methodUpper.includes("BANCO")
  ) {
    result.transferencia = finalAmount;
  } else if (
    methodUpper.includes("CULQI") ||
    methodUpper.includes("CULQUI") ||
    methodUpper.includes("QULQUI") ||
    methodUpper.includes("TARJETA") ||
    methodUpper.includes("POS")
  ) {
    result.culqi = finalAmount;
  } else {
    result.efectivo = finalAmount;
  }

  return result;
}

/**
 * Builds cross-order credit settlement index for all vehicles:
 * Matches prior credit orders with subsequent "CANCELACION DE DEUDA" payments for the same plate.
 */
export function buildVehicleCreditSettlementMap(
  workOrders: WorkOrder[],
  invoicesData: Map<string, Invoice> | Invoice[] = new Map()
) {
  const settledOrdersMap = new Map<string, CreditSettlementInfo>();
  const cancellationsMap = new Map<string, CancellationInfo>();

  const getInvoice = (woId: string): Invoice | undefined => {
    if (invoicesData instanceof Map) {
      return invoicesData.get(woId);
    }
    if (Array.isArray(invoicesData)) {
      return invoicesData.find((inv) => inv.work_order_id === woId);
    }
    return undefined;
  };

  // Group work orders by vehicle plate
  const ordersByPlate = new Map<string, WorkOrder[]>();
  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i];
    const plate = wo.vehicle_plate?.toUpperCase().trim();
    if (!plate) continue;
    let list = ordersByPlate.get(plate);
    if (!list) {
      list = [];
      ordersByPlate.set(plate, list);
    }
    list.push(wo);
  }

  // Process each vehicle's chronological timeline
  ordersByPlate.forEach((plateOrders) => {
    // Sort oldest first
    const sorted = [...plateOrders].sort((a, b) => {
      const timeA = a.entry_time ? new Date(a.entry_time).getTime() : 0;
      const timeB = b.entry_time ? new Date(b.entry_time).getTime() : 0;
      return timeA - timeB;
    });

    const pendingCreditsQueue: Array<{
      order: WorkOrder;
      invoice?: Invoice;
      creditAmount: number;
      dateStr: string;
      service: string;
    }> = [];

    // First pass: identify explicit credit orders
    for (let i = 0; i < sorted.length; i++) {
      const wo = sorted[i];
      const inv = getInvoice(wo.id);
      const desc = `${wo.problem_description || ""} ${wo.spare_parts_services || ""} ${(wo.items || []).map((it) => it.description).join(" ")} ${wo.diagnostic_notes || ""}`.toUpperCase();

      let credit = inv?.credit_amount || 0;
      // Una factura PAGADA no tiene crédito pendiente: se ignoran las etiquetas
      // históricas ([CREDITO]: X en diagnostic_notes) que quedaron de cuando la deuda
      // existía, para que la card NO muestre "CRÉDITO PENDIENTE POR COBRAR" sobre un
      // pago ya completado (caso BBF-936 con [CREDITO]:150 pero factura PAGADA).
      const paidInvoice = !!inv && (inv.payment_status === "pagado" || String(inv.payment_condition || "").toUpperCase().includes("PAGADO"));
      const diag = `${wo.diagnostic_notes || ""} ${wo.observations || ""}`.toUpperCase();
      if (!paidInvoice && credit === 0 && diag.includes("[CREDITO]:")) {
        const m = diag.match(/\[CREDITO\]:\s*([0-9.]+)/i);
        if (m) credit = parseFloat(m[1]) || 0;
      }
      if (!paidInvoice && credit === 0) {
        const pendMatch = desc.match(/PENDIENTE\s+([0-9]+(?:\.[0-9]+)?)/i);
        if (pendMatch) credit = parseFloat(pendMatch[1]) || 0;
      }

      const conditionUpper = (inv?.payment_condition || "").toUpperCase();
      const isCreditCondition = !paidInvoice && (conditionUpper.includes("CREDIT") || conditionUpper.includes("PENDIENTE") || diag.includes("[CONDICION]: PENDIENTE"));

      if (credit > 0 || isCreditCondition) {
        const paidAmount = inv?.grand_total || (wo.items || []).reduce((s, it) => s + (it.subtotal || 0), 0);
        const serviceName = (wo.items || []).map((it) => it.description).join(" + ") || wo.problem_description || "Servicio Taller";
        const recordedCredit = credit > 0 ? credit : paidAmount;
        const dateStr = wo.entry_time ? formatPeruDate(wo.entry_time) : "Visita anterior";

        if (!settledOrdersMap.has(wo.id)) {
          settledOrdersMap.set(wo.id, {
            isSettled: false,
            hasCredit: true,
            creditAmount: recordedCredit,
            originalCreditAmount: recordedCredit,
          });
        }

        pendingCreditsQueue.push({
          order: wo,
          invoice: inv,
          creditAmount: recordedCredit,
          dateStr,
          service: serviceName,
        });
      }
    }

    // Second pass: match cancellation payments
    for (let i = 0; i < sorted.length; i++) {
      const wo = sorted[i];
      const inv = getInvoice(wo.id);
      const desc = `${wo.problem_description || ""} ${wo.spare_parts_services || ""} ${(wo.items || []).map((it) => it.description).join(" ")} ${wo.diagnostic_notes || ""}`.toUpperCase();

      const isCancellationPayment =
        desc.includes("CANCELACION DE DEUDA") ||
        desc.includes("CANCELACION DE SU DEUDA") ||
        desc.includes("CANCELACION DEUDA") ||
        desc.includes("CANCELACION DE") ||
        desc.includes("CANCELACION");

      if (isCancellationPayment) {
        const paidAmount = inv?.grand_total || (wo.items || []).reduce((s, it) => s + (it.subtotal || 0), 0);
        const dateStr = wo.entry_time ? formatPeruDate(wo.entry_time) : "Fecha posterior";

        let target = pendingCreditsQueue.length > 0 ? pendingCreditsQueue.shift() : null;

        // Fallback: match with previous non-cancellation visit if queue was empty
        if (!target) {
          for (let j = i - 1; j >= 0; j--) {
            const prevWo = sorted[j];
            if (!settledOrdersMap.has(prevWo.id) || !settledOrdersMap.get(prevWo.id)?.isSettled) {
              const prevService = (prevWo.items || []).map((it) => it.description).join(" + ") || prevWo.problem_description || "Servicio Taller";
              const prevDate = prevWo.entry_time ? formatPeruDate(prevWo.entry_time) : "Visita anterior";
              target = {
                order: prevWo,
                invoice: getInvoice(prevWo.id),
                creditAmount: paidAmount,
                dateStr: prevDate,
                service: prevService,
              };
              break;
            }
          }
        }

        if (target) {
          settledOrdersMap.set(target.order.id, {
            isSettled: true,
            settledDate: dateStr,
            settledAmount: paidAmount,
            settledByOrderId: wo.id,
            originalCreditAmount: target.creditAmount || paidAmount,
            hasCredit: true,
            creditAmount: target.creditAmount || paidAmount,
          });

          cancellationsMap.set(wo.id, {
            isCancellation: true,
            cancelsOrderId: target.order.id,
            originalService: target.service,
            originalDate: target.dateStr,
            amount: paidAmount,
          });
        }
      }
    }
  });

  return {
    settledOrdersMap,
    cancellationsMap,
  };
}
