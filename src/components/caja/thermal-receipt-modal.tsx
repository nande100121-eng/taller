"use client";

import React, { useRef, useState } from "react";
import { Printer, Download, X, CheckCircle2, QrCode as QrIcon, Copy, Check } from "lucide-react";
import { numberToSpanishWords } from "@/lib/utils/number-to-words";
import { buildSunatFiscalQrString, generateEscPosQrBytes } from "@/lib/utils/escpos-qr";
import { WorkOrder, Invoice } from "@/lib/store/app-store";

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
  issuedAt,
}: ThermalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedEscPos, setCopiedEscPos] = useState(false);
  const [sunatData, setSunatData] = useState<{ razonSocial?: string; direccion?: string } | null>(null);

  // Normalize Receipt Type case-insensitively (FACTURA -> Factura, BOLETA -> Boleta, TICKET -> Ticket)
  const rawType = (receiptType || invoice?.receipt_type || "").toUpperCase().trim();
  const effectiveType: "Ticket" | "Boleta" | "Factura" = rawType.includes("FACTURA")
    ? "Factura"
    : rawType.includes("BOLETA")
    ? "Boleta"
    : "Ticket";

  const rawDoc = (customerDoc || invoice?.customer_doc || "").replace(/[^0-9]/g, "").trim();
  const effectiveDoc = rawDoc && rawDoc !== "0" && rawDoc !== "00000000" && rawDoc !== "20600982860" ? rawDoc : "";

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

  const effectiveTotal =
    grandTotal !== undefined && grandTotal >= 0
      ? grandTotal
      : (invoice?.grand_total !== undefined ? invoice.grand_total : effectiveItems.reduce((s, it) => s + it.subtotal, 0));

  // Calculations for Tax breakdown (IGV 18%)
  const opGravadas = effectiveTotal > 0 ? effectiveTotal / 1.18 : 0;
  const igvAmount = effectiveTotal - opGravadas;
  const amountInWords = numberToSpanishWords(effectiveTotal);

  // Date formatted
  const rawDate = issuedAt || invoice?.issued_at || workOrder?.entry_time || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const dateFormatted = isNaN(dateObj.getTime())
    ? new Date().toLocaleDateString("es-PE")
    : dateObj.toLocaleDateString("es-PE");

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
    const itemsHtml = effectiveItems.map((item) => `
      <tr>
        <td colspan="3" style="padding:2px 0 0 0;font-weight:bold;font-size:10.5px;text-transform:uppercase;word-break:break-word;">${item.description}</td>
      </tr>
      <tr>
        <td style="width:20%;text-align:left;padding:1px 0;font-size:10.5px;">${Number(item.quantity).toFixed(2)}</td>
        <td style="width:40%;text-align:right;padding:1px 6px 1px 0;font-size:10.5px;">${Number(item.unit_price).toFixed(2)}</td>
        <td style="width:40%;text-align:right;padding:1px 4px 1px 0;font-size:10.5px;font-weight:bold;">${Number(item.subtotal).toFixed(2)}</td>
      </tr>
    `).join("");

    // Build totals rows
    const totalsData = [
      { label: "OP. GRAVADAS:", value: `S/ ${opGravadas.toFixed(2)}`, bold: true },
      { label: "OP. EXONERADAS:", value: "S/ 0.00", bold: false },
      { label: "OP. INAFECTAS:", value: "S/ 0.00", bold: false },
      { label: "OP. GRATUITAS:", value: "S/ 0.00", bold: false },
      { label: "SUBTOTAL:", value: `S/ ${opGravadas.toFixed(2)}`, bold: true },
      { label: "DESCUENTOS:", value: `S/ ${discountAmount.toFixed(2)}`, bold: false },
      { label: "IGV 18.0%:", value: `S/ ${igvAmount.toFixed(2)}`, bold: true },
      { label: "ICBPER:", value: "S/ 0.00", bold: false },
      { label: "ADELANTOS:", value: "S/ 0.00", bold: false },
    ];

    const totalsHtml = totalsData.map((row) => `
      <tr>
        <td style="padding:1px 0;font-size:10.5px;">${row.label}</td>
        <td style="text-align:right;padding:1px 4px 1px 0;font-size:10.5px;${row.bold ? "font-weight:bold;" : ""}">${row.value}</td>
      </tr>
    `).join("");

    // Document type label
    const docTypeLabel = effectiveType === "Factura"
      ? "FACTURA ELECTRÓNICA"
      : effectiveType === "Boleta"
      ? "BOLETA DE VENTA ELECTRÓNICA"
      : "TICKET DE VENTA";

    // QR section (only for Boleta / Factura)
    const qrSection = effectiveType !== "Ticket" ? `
      <div style="text-align:center;padding:6px 0;border-bottom:1px dashed #000;">
        <img src="${qrImageUrl}" alt="QR" style="width:115px;height:115px;display:block;margin:0 auto;" />
        <div style="font-size:8.5px;font-weight:bold;margin-top:2px;">Código QR Fiscal SUNAT</div>
      </div>
    ` : "";

    // Footer
    const footerHtml = effectiveType === "Ticket"
      ? `<div style="text-align:center;font-size:9px;padding-top:4px;font-weight:bold;">Gracias por su preferencia</div>`
      : `<div style="text-align:center;font-size:8.5px;padding-top:4px;line-height:1.15;">
          <div style="font-weight:bold;">Representación impresa de la ${effectiveType === "Factura" ? "Factura" : "Boleta de Venta"} Electrónica</div>
          <div>Autorizado mediante Resolución de Superintendencia</div>
          <div>Consulte su comprobante en: https://consulta.sunat.gob.pe</div>
        </div>`;

    // Print/Save timestamp (captured at the moment of printing)
    const printTimestamp = new Date().toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const printTimestampHtml = `<div style="text-align:center;font-size:8px;color:#555;padding-top:6px;border-top:1px dashed #aaa;margin-top:4px;">Fecha y hora de impresión: ${printTimestamp}</div>`;

    // Address section (only if address is present)
    const addressHtml = effectiveAddress && effectiveAddress !== "-"
      ? `<div><b>DIRECCION:</b> ${effectiveAddress}</div>` : "";

    const docRowHtml = effectiveType === "Factura"
      ? `<div><b>RUC:</b> ${effectiveDoc || "-"}</div>`
      : effectiveType === "Boleta"
      ? `<div><b>DNI:</b> ${effectiveDoc || "-"}</div>`
      : "";

    // Observation section
    const observationHtml = effectiveObservations
      ? `<div style="border-top:1px dashed #888;padding-top:2px;margin-top:2px;font-size:9.5px;"><b>OBSERVACION:</b> ${effectiveObservations}</div>` : "";

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${effectiveType} - ${effectiveNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body {
    width: 76mm; max-width: 76mm; margin: 0; padding: 0;
    height: auto !important; min-height: 0 !important;
    background: #fff; color: #000;
    font-family: 'Arial Narrow', Arial, 'Helvetica Neue', Helvetica, sans-serif;
    font-size: 11px; line-height: 1.25;
    -webkit-font-smoothing: antialiased;
  }
  .paper { width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm 2mm 3mm 2mm; }
</style>
</head>
<body>
<div class="paper">

  <!-- LOGO -->
  <div style="text-align:center;">
    <img src="/logo.jpg" alt="REYGAS" style="max-height:52px;max-width:170px;display:block;margin:0 auto;object-fit:contain;"
         onerror="this.style.display='none'" />
  </div>

  <!-- 2-LINE SPACER between logo and razón social -->
  <div style="height:14px;"></div>

  <!-- HEADER: Razón Social, Dirección, RUC (CENTERED + BOLD) -->
  <div style="text-align:center;font-weight:bold;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">REYGAS S.A.C.</div>
    <div style="font-size:9.5px;line-height:1.15;">AV. SAN MARTIN NRO. 279 LIMA - HUAURA - SANTA MARIA</div>
    <div style="font-size:10px;padding-top:1px;">RUC: 20600982860</div>
  </div>

  <!-- DOCUMENT TYPE & CORRELATIVE (CENTERED + BOLD) -->
  <div style="border-top:1px dashed #000;padding-top:4px;margin-top:4px;text-align:center;font-weight:bold;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:900;">${docTypeLabel}</div>
    <div style="font-size:11.5px;font-family:'Courier New',monospace;letter-spacing:1px;font-weight:bold;">${effectiveNumber}</div>
  </div>

  <!-- CLIENT & DOCUMENT INFO -->
  <div style="border-top:1px dashed #000;padding-top:3px;margin-top:3px;font-size:10px;line-height:1.35;">
    <div><b>CLIENTE:</b> ${effectiveClient}</div>
    ${docRowHtml}
    ${addressHtml}
    <div><b>FECHA DE EMISIÓN:</b> ${dateFormatted}</div>
    <div><b>FORMA DE PAGO:</b> ${paymentMethod || "Efectivo"}</div>
    <div><b>MONEDA:</b> SOLES</div>
    <div><b>PLACA:</b> ${effectivePlate || "S/P"}</div>
    ${observationHtml}
  </div>

  <!-- ITEMS TABLE HEADER (CENTERED + BOLD) -->
  <div style="border-top:1px dashed #000;margin-top:3px;padding-top:3px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px dashed #000;">
          <th style="width:20%;text-align:left;padding:3px 0;font-size:10.5px;font-weight:900;">CANT.</th>
          <th style="width:40%;text-align:right;padding:3px 6px 3px 0;font-size:10.5px;font-weight:900;">P.UNIT.</th>
          <th style="width:40%;text-align:right;padding:3px 4px 3px 0;font-size:10.5px;font-weight:900;">IMPORTE</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <!-- TAX BREAKDOWN & TOTALS (amounts aligned to right margin) -->
  <div style="border-top:1px dashed #000;padding-top:3px;margin-top:3px;">
    <table style="width:100%;border-collapse:collapse;">
      ${totalsHtml}
      <tr>
        <td colspan="2" style="padding:0;"><div style="border-top:1px solid #000;margin-top:3px;"></div></td>
      </tr>
      <tr style="font-weight:900;font-size:13px;">
        <td style="padding:4px 0;border-bottom:1px solid #000;">TOTAL:</td>
        <td style="text-align:right;padding:4px 4px 4px 0;border-bottom:1px solid #000;">S/ ${effectiveTotal.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <!-- QR CODE (only Boleta / Factura) -->
  ${qrSection}

  <!-- AMOUNT IN WORDS -->
  <div style="border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 1px;margin:4px 0;font-size:10px;font-weight:bold;text-transform:uppercase;text-align:center;">
    ${amountInWords}
  </div>

  <!-- FOOTER -->
  ${footerHtml}

  <!-- PRINT TIMESTAMP -->
  ${printTimestampHtml}

</div>
</body>
</html>`);
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
              {effectiveType}: {effectiveNumber}
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
                {effectiveType === "Factura"
                  ? "FACTURA ELECTRÓNICA"
                  : effectiveType === "Boleta"
                  ? "BOLETA DE VENTA ELECTRÓNICA"
                  : "TICKET DE VENTA"}
              </div>
              <div className="text-xs font-bold font-mono tracking-wider">{effectiveNumber}</div>
            </div>

            {/* 3. Client & Document Info */}
            <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[10px]">
              <div>
                <strong>CLIENTE:</strong> {effectiveClient}
              </div>
              {effectiveType === "Factura" ? (
                <div>
                  <strong>RUC:</strong> {effectiveDoc || "-"}
                </div>
              ) : effectiveType === "Boleta" ? (
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
                <strong>FORMA DE PAGO:</strong> {paymentMethod || "CONTADO"}
              </div>
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
                <span className="text-right pr-1 font-bold">S/ {opGravadas.toFixed(2)}</span>
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
                <span className="text-right pr-1 font-bold">S/ {opGravadas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>DESCUENTOS:</span>
                <span className="text-right pr-1">S/ {discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IGV 18.0%:</span>
                <span className="text-right pr-1 font-bold">S/ {igvAmount.toFixed(2)}</span>
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
                <span className="text-right pr-1 font-black">S/ {effectiveTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 6. SUNAT Dynamic Fiscal QR Code (ONLY for Boleta and Factura, NOT for Ticket) */}
            {effectiveType !== "Ticket" && (
              <div className="flex flex-col items-center justify-center py-2 border-b border-dashed border-black space-y-1">
                <img
                  src={qrImageUrl}
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
              {amountInWords}
            </div>

            {/* 8. Footer Legal Notes */}
            <div className="pt-1 text-center space-y-0.5 text-[8.5px] text-black leading-tight">
              <div className="font-bold">
                {effectiveType === "Ticket"
                  ? "Gracias por su preferencia"
                  : `Representación impresa de la ${effectiveType === "Factura" ? "Factura" : "Boleta de Venta"} Electrónica`}
              </div>
              {effectiveType !== "Ticket" && (
                <>
                  <div>Autorizado mediante Resolución de Superintendencia</div>
                  <div>Consulte su comprobante en: https://consulta.sunat.gob.pe</div>
                </>
              )}
            </div>

            {/* 9. Print/Save Timestamp */}
            <div className="text-center text-[8px] text-gray-500 pt-1.5 mt-1 border-t border-dashed border-gray-300">
              Fecha y hora de impresión: {new Date().toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
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

