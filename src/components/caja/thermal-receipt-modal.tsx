"use client";

import React, { useRef, useState } from "react";
import { Printer, Download, X, CheckCircle2, QrCode as QrIcon, Copy, Check } from "lucide-react";
import { numberToSpanishWords } from "@/lib/utils/number-to-words";
import { buildSunatFiscalQrString, generateEscPosQrBytes } from "@/lib/utils/escpos-qr";
import { formatPeruDate, formatPeruDateTime } from "@/lib/utils/date-utils";
import { WorkOrder, Invoice, PaymentSplit } from "@/lib/store/app-store";

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder?: WorkOrder | null;
  invoice?: Invoice | null;
  receiptType?: "Ticket" | "Boleta" | "Factura";
  receiptNumber?: string;
  customerDoc?: string;
  customerName?: string;
  customerAddress?: string;
  plate?: string;
  observations?: string;
  grandTotal?: number;
  items?: Array<{ description: string; quantity: number; unit_price: number; subtotal: number }>;
  discountAmount?: number;
  paymentMethod?: string;
  paymentBreakdown?: PaymentSplit[];
  multiTicket?: boolean;
  issuedAt?: string;
}

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  workOrder,
  invoice,
  receiptType = "Factura",
  receiptNumber,
  customerDoc,
  customerName,
  customerAddress,
  plate,
  observations,
  grandTotal,
  items,
  discountAmount = 0,
  paymentMethod = "CONTADO",
  paymentBreakdown,
  multiTicket,
  issuedAt,
}: ThermalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedEscPos, setCopiedEscPos] = useState(false);
  const [sunatData, setSunatData] = useState<{ razonSocial?: string; direccion?: string } | null>(null);
  // Navegación entre comprobantes cuando el pago se hizo con varios tickets/boletas/facturas
  const [previewIdx, setPreviewIdx] = useState(0);

  // Normalize Receipt Type case-insensitively (FACTURA -> Factura, BOLETA -> Boleta, TICKET -> Ticket)
  const rawType = (receiptType || invoice?.receipt_type || "").toUpperCase().trim();
  const effectiveType: "Ticket" | "Boleta" | "Factura" = rawType.includes("FACTURA")
    ? "Factura"
    : rawType.includes("BOLETA")
    ? "Boleta"
    : "Ticket";

  const rawDoc = (customerDoc || invoice?.customer_doc || "").replace(/[^0-9]/g, "").trim();
  const effectiveDoc = rawDoc && rawDoc !== "0" && rawDoc !== "00000000" && rawDoc !== "20600982860" ? rawDoc : "";

  // Reiniciar la navegación de comprobantes al abrir o cambiar el desglose
  React.useEffect(() => {
    setPreviewIdx(0);
  }, [isOpen, (paymentBreakdown && paymentBreakdown.length) || (invoice?.payment_breakdown || []).length]);

  // Auto-query SUNAT if 11-digit RUC is available
  React.useEffect(() => {
    if (!isOpen) return;
    if (effectiveDoc && effectiveDoc.length === 11) {
      fetch(`/api/consulta-ruc?ruc=${effectiveDoc}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.razonSocial) {
            setSunatData({
              razonSocial: data.razonSocial,
              direccion: data.direccion && data.direccion !== "-" ? data.direccion : undefined,
            });
          }
        })
        .catch(() => {});
    } else {
      setSunatData(null);
    }
  }, [isOpen, effectiveDoc]);

  if (!isOpen) return null;

  // Determine receipt number & series format accurately from record (e.g. 281 -> F001-00000281)
  let rawNumber = (receiptNumber || invoice?.receipt_number || "").trim();
  let effectiveNumber = "";

  if (rawNumber && rawNumber !== "0" && rawNumber.toLowerCase() !== "s/n") {
    if (rawNumber.includes("-")) {
      effectiveNumber = rawNumber;
    } else {
      const cleanDigits = rawNumber.replace(/[^0-9]/g, "");
      if (effectiveType === "Factura") {
        effectiveNumber = `F001-${cleanDigits.padStart(8, "0")}`;
      } else if (effectiveType === "Boleta") {
        effectiveNumber = `B001-${cleanDigits.padStart(8, "0")}`;
      } else {
        effectiveNumber = `TK01-${cleanDigits.padStart(8, "0")}`;
      }
    }
  } else {
    // Default fallback series if not specified
    if (effectiveType === "Factura") effectiveNumber = "F001-00000001";
    else if (effectiveType === "Boleta") effectiveNumber = "B001-00000001";
    else effectiveNumber = "TK01-00000001";
  }

  // Resolve Values accurately from props / invoice / workOrder
  const effectivePlate = (plate || workOrder?.vehicle_plate || invoice?.vehicle_plate || "").toUpperCase().trim();
  const effectiveObservations = observations || invoice?.observations || workOrder?.observations || "";

  // Customer info from real record or SUNAT lookup
  const effectiveClient = (
    (effectiveType === "Factura" && sunatData?.razonSocial)
      ? sunatData.razonSocial
      : (customerName && customerName !== "Cliente Taller" && customerName !== "Cliente General"
          ? customerName
          : (invoice?.client_name && invoice.client_name !== "Cliente Taller"
              ? invoice.client_name
              : (effectiveType === "Ticket" ? "CLIENTES VARIOS" : (effectiveType === "Factura" ? "-" : "Cliente General"))))
  ).toUpperCase();

  const rawAddress = (effectiveType === "Factura" && sunatData?.direccion)
    ? sunatData.direccion
    : (customerAddress || invoice?.customer_address || "");
  const effectiveAddress = rawAddress && rawAddress !== "-" ? rawAddress.toUpperCase() : "";

  const effectiveSplits: PaymentSplit[] = (
    paymentBreakdown && paymentBreakdown.length > 0
      ? paymentBreakdown
      : (invoice?.payment_breakdown || [])
  );

  // Pago mixto multi-ticket: cada método tiene su propio N° de ticket/comprobante
  const useMultiTickets =
    (multiTicket === true) ||
    (multiTicket !== false &&
      effectiveSplits.length > 1 &&
      effectiveSplits.every((s) => s.receipt_number) &&
      new Set(effectiveSplits.map((s) => s.receipt_number)).size > 1);

  // Items
  const effectiveItems =
    items ||
    (workOrder?.items && workOrder.items.length > 0
      ? workOrder.items.map((it) => ({
          description: it.description,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || it.subtotal,
          subtotal: it.subtotal,
        }))
      : [
          {
            description: workOrder?.problem_description || "CERTIFICACION ANUAL GNV",
            quantity: 1,
            unit_price: grandTotal || invoice?.grand_total || 80,
            subtotal: grandTotal || invoice?.grand_total || 80,
          },
        ]);

  // If certification is required, add line
  if (workOrder?.requires_certification && workOrder.certification_price && workOrder.certification_price > 0) {
    effectiveItems.push({
      description: `CERTIFICACIÓN (${workOrder.certification_type || "GNV/GLP"})`,
      quantity: 1,
      unit_price: workOrder.certification_price,
      subtotal: workOrder.certification_price,
    });
  }

  const effectiveDiscount = discountAmount > 0
    ? discountAmount
    : (workOrder?.discount_amount || (typeof invoice?.discounts === "number" ? invoice.discounts : Number(invoice?.discounts) || 0));

  const effectiveTotal =
    grandTotal !== undefined && grandTotal >= 0
      ? grandTotal
      : (invoice?.grand_total !== undefined ? invoice.grand_total : Math.max(0, effectiveItems.reduce((s, it) => s + it.subtotal, 0) - effectiveDiscount));

  // Calculations for Tax breakdown (IGV 18%)
  const opGravadas = effectiveTotal > 0 ? effectiveTotal / 1.18 : 0;
  const igvAmount = effectiveTotal - opGravadas;
  const amountInWords = numberToSpanishWords(effectiveTotal);

  // Date formatted in Peru timezone
  const rawDate = issuedAt || invoice?.issued_at || workOrder?.entry_time || new Date().toISOString();
  const dateFormatted = formatPeruDate(rawDate);

  // Comprobante actual en la navegación (vista previa página por página)
  const previewSplit = useMultiTickets ? (effectiveSplits[previewIdx] || null) : null;
  const viewType: "Ticket" | "Boleta" | "Factura" = previewSplit
    ? (previewSplit.receipt_type === "Factura" || previewSplit.receipt_type === "Boleta" ? previewSplit.receipt_type : "Ticket")
    : effectiveType;
  const viewNumber = previewSplit ? (previewSplit.receipt_number || effectiveNumber) : effectiveNumber;
  const viewMethod = previewSplit ? previewSplit.method : (paymentMethod || "CONTADO");
  const viewTotal = previewSplit ? (Number(previewSplit.amount) || 0) : effectiveTotal;
  const viewSplits = previewSplit ? [previewSplit] : effectiveSplits;
  const viewOpGravadas = viewTotal > 0 ? viewTotal / 1.18 : 0;
  const viewIgv = viewTotal - viewOpGravadas;
  const viewAmountInWords = previewSplit ? numberToSpanishWords(viewTotal) : amountInWords;
  const viewQrUrl = viewType !== "Ticket"
    ? (() => {
        const igv = viewTotal > 0 ? viewTotal - viewTotal / 1.18 : 0;
        const qr = buildSunatFiscalQrString({
          rucEmisor: "20600982860",
          receiptType: viewType,
          receiptNumber: viewNumber,
          igvAmount: igv,
          grandTotal: viewTotal,
          dateStr: dateFormatted,
          customerDoc: effectiveDoc,
        });
        return "https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=" + encodeURIComponent(qr);
      })()
    : "";

  // Build standard SUNAT fiscal QR String
  const sunatQrString = buildSunatFiscalQrString({
    rucEmisor: "20600982860",
    receiptType: effectiveType,
    receiptNumber: effectiveNumber,
    igvAmount,
    grandTotal: effectiveTotal,
    dateStr: dateFormatted,
    customerDoc: effectiveDoc,
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(sunatQrString)}`;

  // Bulletproof 1-Page 80mm Print Trigger using Isolated Hidden Frame with FULLY INLINE STYLES
  // This generates its own HTML so it doesn't depend on Tailwind classes from the web preview.
  const handlePrint = () => {
    let printFrame = document.getElementById("thermal-print-iframe") as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "thermal-print-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.style.opacity = "0";
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    // Build items rows HTML
    const itemsHtml = effectiveItems.map((item) =>
      "<tr>" +
      '<td colspan="3" style="padding:2px 0 0 0;font-weight:bold;font-size:10.5px;text-transform:uppercase;word-break:break-word;">' + item.description + "</td>" +
      "</tr>" +
      "<tr>" +
      '<td style="width:20%;text-align:left;padding:1px 0;font-size:10.5px;">' + Number(item.quantity).toFixed(2) + "</td>" +
      '<td style="width:40%;text-align:right;padding:1px 6px 1px 0;font-size:10.5px;">' + Number(item.unit_price).toFixed(2) + "</td>" +
      '<td style="width:40%;text-align:right;padding:1px 4px 1px 0;font-size:10.5px;font-weight:bold;">' + Number(item.subtotal).toFixed(2) + "</td>" +
      "</tr>"
    ).join("");

    // Build tax & totals rows for a given ticket total
    const buildTotalsHtml = (total: number) => {
      const opG = total > 0 ? total / 1.18 : 0;
      const igv = total - opG;
      const rows = [
        { label: "OP. GRAVADAS:", value: "S/ " + opG.toFixed(2), bold: true },
        { label: "OP. EXONERADAS:", value: "S/ 0.00", bold: false },
        { label: "OP. INAFECTAS:", value: "S/ 0.00", bold: false },
        { label: "OP. GRATUITAS:", value: "S/ 0.00", bold: false },
        { label: "SUBTOTAL:", value: "S/ " + (opG + effectiveDiscount).toFixed(2), bold: true },
        { label: "DESCUENTOS:", value: "S/ " + effectiveDiscount.toFixed(2), bold: false },
        { label: "IGV 18.0%:", value: "S/ " + igv.toFixed(2), bold: true },
        { label: "ICBPER:", value: "S/ 0.00", bold: false },
        { label: "ADELANTOS:", value: "S/ 0.00", bold: false },
      ];
      return rows.map((row) =>
        "<tr>" +
        '<td style="padding:1px 0;font-size:10.5px;">' + row.label + "</td>" +
        '<td style="text-align:right;padding:1px 4px 1px 0;font-size:10.5px;' + (row.bold ? "font-weight:bold;" : "") + '">' + row.value + "</td>" +
        "</tr>"
      ).join("");
    };

    // Document type label (per ticket type)
    const buildDocTypeLabel = (type: "Ticket" | "Boleta" | "Factura") =>
      type === "Factura"
        ? "FACTURA ELECTRÓNICA"
        : type === "Boleta"
        ? "BOLETA DE VENTA ELECTRÓNICA"
        : "TICKET DE VENTA";

    // QR section per ticket (only for Boleta / Factura)
    const buildQrSection = (num: string, total: number, type: "Ticket" | "Boleta" | "Factura") => {
      if (type === "Ticket") return "";
      const igv = total > 0 ? total - total / 1.18 : 0;
      const qr = buildSunatFiscalQrString({
        rucEmisor: "20600982860",
        receiptType: type,
        receiptNumber: num,
        igvAmount: igv,
        grandTotal: total,
        dateStr: dateFormatted,
        customerDoc: effectiveDoc,
      });
      const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=" + encodeURIComponent(qr);
      return '<div style="text-align:center;padding:6px 0;border-bottom:1px dashed #000;">' +
        '<img src="' + qrUrl + '" alt="QR" style="width:115px;height:115px;display:block;margin:0 auto;" />' +
        '<div style="font-size:8.5px;font-weight:bold;margin-top:2px;">Código QR Fiscal SUNAT</div>' +
        "</div>";
    };

    // Footer (per ticket type)
    const buildFooterHtml = (type: "Ticket" | "Boleta" | "Factura") =>
      type === "Ticket"
        ? '<div style="text-align:center;font-size:9px;padding-top:4px;font-weight:bold;">Gracias por su preferencia</div>'
        : '<div style="text-align:center;font-size:8.5px;padding-top:4px;line-height:1.15;">' +
          '<div style="font-weight:bold;">Representación impresa de la ' + (type === "Factura" ? "Factura" : "Boleta de Venta") + " Electrónica</div>" +
          "<div>Autorizado mediante Resolución de Superintendencia</div>" +
          "<div>Consulte su comprobante en: https://consulta.sunat.gob.pe</div>" +
          "</div>";

    // Print/Save timestamp in Peru timezone (captured at the moment of printing)
    const printTimestamp = formatPeruDateTime(new Date(), true);
    const printTimestampHtml = '<div style="text-align:center;font-size:8px;color:#555;padding-top:6px;border-top:1px dashed #aaa;margin-top:4px;">Fecha y hora de impresión: ' + printTimestamp + "</div>";

    // Address section (only if address is present)
    const addressHtml = effectiveAddress && effectiveAddress !== "-"
      ? "<div><b>DIRECCION:</b> " + effectiveAddress + "</div>" : "";

    const buildDocRowHtml = (type: "Ticket" | "Boleta" | "Factura") =>
      type === "Factura"
        ? "<div><b>RUC:</b> " + (effectiveDoc || "-") + "</div>"
        : type === "Boleta"
        ? "<div><b>DNI:</b> " + (effectiveDoc || "-") + "</div>"
        : "";

    // Observation section
    const observationHtml = effectiveObservations
      ? '<div style="border-top:1px dashed #888;padding-top:2px;margin-top:2px;font-size:9.5px;"><b>OBSERVACION:</b> ' + effectiveObservations + "</div>" : "";

    // Payment method breakdown HTML
    const buildPaymentMethodHtml = (splits: PaymentSplit[], methodLabel: string) => {
      if (splits.length > 1) {
        return "<div><b>FORMA DE PAGO:</b> MIXTO</div>" +
          splits.map((p) => '<div style="padding-left:6px;font-size:9px;">• ' + p.method + ": S/ " + Number(p.amount).toFixed(2) + " (" + p.destination + ")</div>").join("");
      }
      return "<div><b>FORMA DE PAGO:</b> " + (methodLabel || "Efectivo") + "</div>";
    };

    // Single 80mm paper builder (one ticket / one method)
    const buildPaper = (num: string, methodLabel: string, total: number, splits: PaymentSplit[], note?: string, type: "Ticket" | "Boleta" | "Factura" = effectiveType) => {
      const noteHtml = note
        ? '<div style="border-top:1px dashed #888;padding-top:2px;margin-top:2px;font-size:9.5px;font-weight:bold;"><b>NOTA:</b> ' + note + "</div>"
        : "";
      const words = numberToSpanishWords(total);
      return (
        '<div class="paper">' +
        '<div style="text-align:center;">' +
        '<img src="/logo.jpg" alt="REYGAS" style="max-height:52px;max-width:170px;display:block;margin:0 auto;object-fit:contain;" onerror="this.style.display=\'none\'" />' +
        "</div>" +
        '<div style="height:14px;"></div>' +
        '<div style="text-align:center;font-weight:bold;">' +
        '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">REYGAS S.A.C.</div>' +
        '<div style="font-size:9.5px;line-height:1.15;">AV. SAN MARTIN NRO. 279 LIMA - HUAURA - SANTA MARIA</div>' +
        '<div style="font-size:10px;padding-top:1px;">RUC: 20600982860</div>' +
        "</div>" +
        '<div style="border-top:1px dashed #000;padding-top:4px;margin-top:4px;text-align:center;font-weight:bold;">' +
        '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:900;">' + buildDocTypeLabel(type) + "</div>" +
        '<div style="font-size:11.5px;font-family:Courier New,monospace;letter-spacing:1px;font-weight:bold;">' + num + "</div>" +
        "</div>" +
        '<div style="border-top:1px dashed #000;padding-top:3px;margin-top:3px;font-size:10px;line-height:1.35;">' +
        "<div><b>CLIENTE:</b> " + effectiveClient + "</div>" +
        buildDocRowHtml(type) +
        addressHtml +
        "<div><b>FECHA DE EMISIÓN:</b> " + dateFormatted + "</div>" +
        buildPaymentMethodHtml(splits, methodLabel) +
        "<div><b>MONEDA:</b> SOLES</div>" +
        "<div><b>PLACA:</b> " + (effectivePlate || "S/P") + "</div>" +
        noteHtml +
        observationHtml +
        "</div>" +
        '<div style="border-top:1px dashed #000;margin-top:3px;padding-top:3px;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        "<thead>" +
        '<tr style="border-bottom:1px dashed #000;">' +
        '<th style="width:20%;text-align:left;padding:3px 0;font-size:10.5px;font-weight:900;">CANT.</th>' +
        '<th style="width:40%;text-align:right;padding:3px 6px 3px 0;font-size:10.5px;font-weight:900;">P.UNIT.</th>' +
        '<th style="width:40%;text-align:right;padding:3px 4px 3px 0;font-size:10.5px;font-weight:900;">IMPORTE</th>' +
        "</tr>" +
        "</thead>" +
        "<tbody>" + itemsHtml + "</tbody>" +
        "</table>" +
        "</div>" +
        '<div style="border-top:1px dashed #000;padding-top:3px;margin-top:3px;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        buildTotalsHtml(total) +
        '<tr><td colspan="2" style="padding:0;"><div style="border-top:1px solid #000;margin-top:3px;"></div></td></tr>' +
        '<tr style="font-weight:900;font-size:13px;">' +
        '<td style="padding:4px 0;border-bottom:1px solid #000;">TOTAL:</td>' +
        '<td style="text-align:right;padding:4px 4px 4px 0;border-bottom:1px solid #000;">S/ ' + total.toFixed(2) + "</td>" +
        "</tr>" +
        "</table>" +
        "</div>" +
        buildQrSection(num, total, type) +
        '<div style="border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 1px;margin:4px 0;font-size:10px;font-weight:bold;text-transform:uppercase;text-align:center;">' + words + "</div>" +
        buildFooterHtml(type) +
        printTimestampHtml +
        "</div>"
      );
    };

    // Decide papers: one ticket per method (multi-ticket) or a single combined ticket
    let papersHtml = "";
    if (useMultiTickets) {
      papersHtml = effectiveSplits.map((s, i) => {
        const total = Number(s.amount) || 0;
        const st = (s.receipt_type === "Boleta" || s.receipt_type === "Factura" ? s.receipt_type : "Ticket") as "Ticket" | "Boleta" | "Factura";
        const paper = buildPaper(s.receipt_number || effectiveNumber, s.method, total, [s], "PAGO PARCIAL CON " + s.method.toUpperCase(), st);
        return paper + (i < effectiveSplits.length - 1 ? '<div style="page-break-after:always;"></div>' : "");
      }).join("");
    } else {
      papersHtml = buildPaper(effectiveNumber, paymentMethod || "Efectivo", effectiveTotal, effectiveSplits);
    }

    doc.open();
    doc.write(
      "<!DOCTYPE html>" +
      "<html>" +
      "<head>" +
      '<meta charset="utf-8" />' +
      "<title>" + effectiveType + " - " + effectiveNumber + "</title>" +
      "<style>" +
      "  @page { size: 80mm auto; margin: 0; }" +
      "  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }" +
      "  html, body {" +
      "    width: 76mm; max-width: 76mm; margin: 0; padding: 0;" +
      "    height: auto !important; min-height: 0 !important;" +
      "    background: #fff; color: #000;" +
      '    font-family: "Arial Narrow", Arial, "Helvetica Neue", Helvetica, sans-serif;' +
      "    font-size: 11px; line-height: 1.25;" +
      "    -webkit-font-smoothing: antialiased;" +
      "  }" +
      "  .paper { width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm 2mm 3mm 2mm; }" +
      "</style>" +
      "</head>" +
      "<body>" +
      papersHtml +
      "</body>" +
      "</html>"
    );
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    }, 350);
  };
  const handleCopyEscPos = () => {
    const bytes = generateEscPosQrBytes(sunatQrString);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    navigator.clipboard.writeText(hex);
    setCopiedEscPos(true);
    setTimeout(() => setCopiedEscPos(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-reygas-dark border border-amber-500/40 max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls Header */}
        <div className="p-4 bg-reygas-surface border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {viewType}: {viewNumber}
              {useMultiTickets && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold">
                  {previewIdx + 1} de {effectiveSplits.length}
                </span>
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black/40 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Printable Receipt Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-black/70 flex flex-col items-center">
          {/* Multi-ticket notice: pago mixto con 1 ticket por método */}
          {useMultiTickets && (
            <div className="w-full max-w-[310px] mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-200 font-bold">
              <div className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Pago mixto multi-ticket: se imprimirá 1 ticket por método ({effectiveSplits.length} tickets)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {effectiveSplits.map((s, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[9px] text-white">
                    {s.method}: {s.receipt_type || effectiveType} {s.receipt_number || "-"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Navegación página por página de los comprobantes del pago */}
          {useMultiTickets && (
            <div className="w-full max-w-[310px] mb-2 flex items-center justify-between gap-2 p-2 rounded-xl bg-purple-950/40 border border-purple-500/40 text-[10px] text-purple-200 font-bold">
              <button
                type="button"
                disabled={previewIdx === 0}
                onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Anterior
              </button>
              <span className="text-center">
                Comprobante {previewIdx + 1} de {effectiveSplits.length} — {viewType} {viewNumber}
              </span>
              <button
                type="button"
                disabled={previewIdx >= effectiveSplits.length - 1}
                onClick={() => setPreviewIdx(Math.min(effectiveSplits.length - 1, previewIdx + 1))}
                className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente ›
              </button>
            </div>
          )}

          {/* Exact Thermal 80mm / POS Ticket Container with Arial Narrow Typography */}
          <div
            ref={receiptRef}
            id="thermal-receipt-printable"
            style={{ fontFamily: "'Arial Narrow', Arial, 'Helvetica Neue', sans-serif" }}
            className="w-full max-w-[310px] bg-white text-black p-4 pb-3 rounded-xl shadow-2xl text-[11px] leading-tight space-y-1.5 border border-gray-300 shrink-0 my-2"
          >
            {/* 1. Header with Centered Logo */}
            <div className="flex flex-col items-center justify-center text-center w-full">
              <img
                src="/logo.jpg"
                alt="REYGAS AUTOGAS EQUIPMENT"
                className="max-h-14 max-w-[170px] w-auto mx-auto block object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />

              {/* 2 Rows Separation between Logo and Razón Social */}
              <div className="h-3.5 w-full"></div>

              {/* Centered and Bold: Razón Social, Dirección, RUC, Tipo Comprobante, Número */}
              <div className="font-bold text-xs uppercase tracking-wide">REYGAS S.A.C.</div>
              <div className="font-bold text-[9.5px] text-black leading-tight">
                AV. SAN MARTIN NRO. 279 LIMA - HUAURA - SANTA MARIA
              </div>
              <div className="font-bold text-[10px] text-black pt-0.5">
                RUC: 20600982860
              </div>
            </div>

            {/* 2. Document Title & Correlative (Centered & Bold) */}
            <div className="border-t border-dashed border-black pt-1 text-center font-bold">
              <div className="text-xs uppercase font-black tracking-wider">
                {viewType === "Factura"
                  ? "FACTURA ELECTRÓNICA"
                  : viewType === "Boleta"
                  ? "BOLETA DE VENTA ELECTRÓNICA"
                  : "TICKET DE VENTA"}
              </div>
              <div className="text-xs font-bold font-mono tracking-wider">{viewNumber}</div>
            </div>

            {/* 3. Client & Document Info */}
            <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[10px]">
              <div>
                <strong>CLIENTE:</strong> {effectiveClient}
              </div>
              {viewType === "Factura" ? (
                <div>
                  <strong>RUC:</strong> {effectiveDoc || "-"}
                </div>
              ) : viewType === "Boleta" ? (
                <div>
                  <strong>DNI:</strong> {effectiveDoc || "-"}
                </div>
              ) : null}
              {effectiveAddress && effectiveAddress !== "-" && (
                <div>
                  <strong>DIRECCION:</strong> {effectiveAddress}
                </div>
              )}
              <div>
                <strong>FECHA DE EMISIÓN:</strong> {dateFormatted}
              </div>
              <div>
                <strong>FORMA DE PAGO:</strong> {viewSplits.length > 1 ? "MIXTO" : viewMethod}
              </div>
              {viewSplits.length > 1 && (
                <div className="pl-2 space-y-0.5 text-[9px] border-l-2 border-black/30 my-0.5">
                  {viewSplits.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-gray-800">
                      <span>• {p.method} ({p.destination}):</span>
                      <span className="font-mono font-bold">S/ {Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <strong>MONEDA:</strong> SOLES
              </div>
              <div>
                <strong>PLACA:</strong> {effectivePlate || "S/P"}
              </div>
              {effectiveObservations ? (
                <div className="border-t border-dashed border-gray-400 pt-0.5 mt-0.5 text-[9.5px]">
                  <strong>OBSERVACION:</strong> {effectiveObservations}
                </div>
              ) : null}
            </div>

            {/* 4. Items Table (CANT. P.UNIT. IMPORTE aligned horizontally and in bold) */}
            <div className="border-t border-dashed border-black pt-1">
              <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 text-[10px]">
                <span className="w-14 text-left font-black">CANT.</span>
                <span className="flex-1 text-right pr-4 font-black">P.UNIT.</span>
                <span className="w-16 text-right pr-1 font-black">IMPORTE</span>
              </div>

              <div className="py-1 space-y-1">
                {effectiveItems.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-[10px] uppercase break-words leading-tight">
                      {item.description}
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="w-14 text-left">{Number(item.quantity).toFixed(2)}</span>
                      <span className="flex-1 text-right pr-4">{Number(item.unit_price).toFixed(2)}</span>
                      <span className="w-16 text-right pr-1 font-bold">{Number(item.subtotal).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Tax Breakdown / Totals (Prices aligned to right margin with comfort padding) */}
            <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>OP. GRAVADAS:</span>
                <span className="text-right pr-1 font-bold">S/ {viewOpGravadas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>OP. EXONERADAS:</span>
                <span className="text-right pr-1">S/ 0.00</span>
              </div>
              <div className="flex justify-between">
                <span>OP. INAFECTAS:</span>
                <span className="text-right pr-1">S/ 0.00</span>
              </div>
              <div className="flex justify-between">
                <span>OP. GRATUITAS:</span>
                <span className="text-right pr-1">S/ 0.00</span>
              </div>
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span className="text-right pr-1 font-bold">S/ {(viewOpGravadas + effectiveDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>DESCUENTOS:</span>
                <span className="text-right pr-1">S/ {effectiveDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IGV 18.0%:</span>
                <span className="text-right pr-1 font-bold">S/ {viewIgv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ICBPER:</span>
                <span className="text-right pr-1">S/ 0.00</span>
              </div>
              <div className="flex justify-between">
                <span>ADELANTOS:</span>
                <span className="text-right pr-1">S/ 0.00</span>
              </div>
              <div className="flex justify-between font-black text-xs border-t border-b border-black py-1 mt-0.5">
                <span>TOTAL:</span>
                <span className="text-right pr-1 font-black">S/ {viewTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 6. SUNAT Dynamic Fiscal QR Code (ONLY for Boleta and Factura, NOT for Ticket) */}
            {viewType !== "Ticket" && (
              <div className="flex flex-col items-center justify-center py-2 border-b border-dashed border-black space-y-1">
                <img
                  src={viewQrUrl}
                  alt="Código QR Fiscal SUNAT"
                  className="w-24 h-24 object-contain bg-white mx-auto block"
                />
                <span className="text-[8.5px] text-black font-bold tracking-tight text-center block">
                  Código QR Fiscal SUNAT
                </span>
              </div>
            )}

            {/* 7. Amount in words (SON OCHENTA CON 00/100 SOLES) */}
            <div className="border-b border-black py-1 text-[9.5px] font-bold uppercase text-center tracking-tight">
              {viewAmountInWords}
            </div>

            {/* 8. Footer Legal Notes */}
            <div className="pt-1 text-center space-y-0.5 text-[8.5px] text-black leading-tight">
              <div className="font-bold">
                {viewType === "Ticket"
                  ? "Gracias por su preferencia"
                  : "Representación impresa de la " + (viewType === "Factura" ? "Factura" : "Boleta de Venta") + " Electrónica"}
              </div>
              {viewType !== "Ticket" && (
                <>
                  <div>Autorizado mediante Resolución de Superintendencia</div>
                  <div>Consulte su comprobante en: https://consulta.sunat.gob.pe</div>
                </>
              )}
            </div>

            {/* 9. Print/Save Timestamp */}
            <div className="text-center text-[8px] text-gray-500 pt-1.5 mt-1 border-t border-dashed border-gray-300">
              Fecha y hora de impresión: {formatPeruDateTime(new Date(), true)}
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 bg-reygas-surface border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          {/* ESC/POS Raw Command Tool (Only for Boleta/Factura) */}
          {effectiveType !== "Ticket" ? (
            <button
              onClick={handleCopyEscPos}
              className="px-3.5 py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow"
              title="Copiar Secuencia de Comandos Nativos ESC/POS (Epson/Generic QR)"
            >
              {copiedEscPos ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedEscPos ? "¡Comandos ESC/POS Copiados!" : "Copiar ESC/POS QR"}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Térmico (80mm)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl border border-white/10 flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-reygas-dark hover:bg-gray-800 text-gray-300 font-bold text-xs rounded-xl border border-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Direct Media Print rules */}
      <style jsx global>{`
        @page {
          size: auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: 76mm !important;
            max-width: 76mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

