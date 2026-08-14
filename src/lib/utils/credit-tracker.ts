import { WorkOrder, Invoice } from "@/lib/store/app-store";

export interface CreditSettlementInfo {
  isSettled: boolean;
  settledDate?: string;
  settledAmount?: number;
  settledByOrderId?: string;
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
  finalAmount: number = 0
): SplitPaymentDetail {
  const result: SplitPaymentDetail = {
    hasSplit: false,
    efectivo: 0,
    yape: 0,
    transferencia: 0,
    culqi: 0,
    formattedSummary: "",
  };

  const combined = `${typeof discountsRaw === "string" ? discountsRaw : ""} ${notesRaw}`.toUpperCase();
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

  // Single method
  const methodUpper = (methodRaw || "EFECTIVO").toUpperCase();
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
  invoicesByWorkOrderId: Map<string, Invoice>
) {
  const settledOrdersMap = new Map<string, CreditSettlementInfo>();
  const cancellationsMap = new Map<string, CancellationInfo>();

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

    sorted.forEach((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);

      // Check if order was a debt cancellation payment
      const desc = `${wo.problem_description || ""} ${wo.spare_parts_services || ""} ${(wo.items || []).map((i) => i.description).join(" ")}`.toUpperCase();
      const isCancellationPayment = desc.includes("CANCELACION DE DEUDA") || desc.includes("CANCELACION DE SU DEUDA") || desc.includes("CANCELACION");

      const paidAmount = inv?.grand_total || (wo.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
      const dateStr = wo.entry_time ? new Date(wo.entry_time).toLocaleDateString("es-PE") : "";

      if (isCancellationPayment && pendingCreditsQueue.length > 0) {
        // Find best matching pending credit from earlier visits
        const matchedIndex = pendingCreditsQueue.findIndex(
          (pc) => Math.abs(pc.creditAmount - paidAmount) < 5 || pc.creditAmount <= paidAmount || pendingCreditsQueue.length === 1
        );

        const target = matchedIndex >= 0 ? pendingCreditsQueue.splice(matchedIndex, 1)[0] : pendingCreditsQueue.shift()!;

        if (target) {
          // Mark earlier order as settled
          settledOrdersMap.set(target.order.id, {
            isSettled: true,
            settledDate: dateStr || "Fecha posterior",
            settledAmount: paidAmount,
            settledByOrderId: wo.id,
          });

          // Mark cancellation order with info about the original service
          cancellationsMap.set(wo.id, {
            isCancellation: true,
            cancelsOrderId: target.order.id,
            originalService: target.service,
            originalDate: target.dateStr,
            amount: paidAmount,
          });
        }
      }

      // Check if this order has a credit/pending amount
      let credit = inv?.credit_amount || 0;
      const diag = wo.diagnostic_notes || "";
      if (credit === 0 && diag.includes("[CREDITO]:")) {
        const m = diag.match(/\[CREDITO\]:\s*([0-9.]+)/i);
        if (m) credit = parseFloat(m[1]) || 0;
      }
      if (credit === 0) {
        const pendMatch = desc.match(/PENDIENTE\s+([0-9]+(?:\.[0-9]+)?)/i);
        if (pendMatch) credit = parseFloat(pendMatch[1]) || 0;
      }

      const isCreditCondition = (inv?.payment_condition || "").toUpperCase().includes("CREDIT") || (inv?.payment_condition || "").toUpperCase().includes("PENDIENTE");

      if (credit > 0 || isCreditCondition) {
        const serviceName = (wo.items || []).map((i) => i.description).join(" + ") || wo.problem_description || "Servicio Taller";
        pendingCreditsQueue.push({
          order: wo,
          invoice: inv,
          creditAmount: credit > 0 ? credit : paidAmount,
          dateStr: dateStr || "Visita anterior",
          service: serviceName,
        });
      }
    });
  });

  return {
    settledOrdersMap,
    cancellationsMap,
  };
}
