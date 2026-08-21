/**
 * Correlativos de comprobantes (estándar ReyGas): serie + folio de 8 dígitos.
 * Ticket -> TK01-00004545, Boleta -> B001-00000259, Factura -> F001-00000282.
 * El siguiente folio se calcula sobre el ÚLTIMO correlativo de ESA serie (nunca
 * mezclando dígitos de la serie con el folio, p.ej. TK01-00004545 NO es 1000004545).
 */

export type ReceiptKind = "Ticket" | "Boleta" | "Factura";

export const RECEIPT_SERIES: Record<ReceiptKind, string> = {
  Ticket: "TK01",
  Boleta: "B001",
  Factura: "F001",
};

/**
 * Extrae { serie, folio } de un correlativo.
 *   "TK01-00004545" -> { serie: "TK01", folio: 4545 }
 *   "00004545"      -> { serie: "", folio: 4545 }
 *   "4586"          -> { serie: "", folio: 4586 }
 *   inválido         -> { serie: "", folio: 0 }
 */
export function parseCorrelative(raw: string): { serie: string; folio: number } {
  const upper = String(raw || "").trim().toUpperCase();
  if (!upper) return { serie: "", folio: 0 };
  // Formato estándar: SERIE-FOLIO (ej. TK01-00004545, B001-00000259, F001-00000282)
  const m = upper.match(/^([A-Z]+\d*)-(\d+)$/);
  if (m) {
    const folio = parseInt(m[2], 10);
    return { serie: m[1], folio: isNaN(folio) ? 0 : folio };
  }
  // Solo folio numérico (históricos sin serie)
  if (/^\d+$/.test(upper)) {
    const folio = parseInt(upper, 10);
    return { serie: "", folio: isNaN(folio) ? 0 : folio };
  }
  return { serie: "", folio: 0 };
}

/**
 * Indica si un correlativo pertenece a la serie esperada del tipo de comprobante.
 * Si el correlativo trae serie, debe coincidir EXACTA (TK01/B001/F001); si es solo
 * número (histórico sin prefijo), se acepta para no perder la secuencia antigua.
 */
export function matchesReceiptSeries(raw: string, kind: ReceiptKind): boolean {
  const { serie } = parseCorrelative(raw);
  if (serie) return serie === RECEIPT_SERIES[kind];
  return /^\d+$/.test(String(raw || "").trim());
}

/**
 * Formatea un folio con la serie del tipo: "TK01-00004546".
 */
export function formatReceiptNumber(kind: ReceiptKind, folio: number): string {
  return `${RECEIPT_SERIES[kind]}-${String(folio).padStart(8, "0")}`;
}
