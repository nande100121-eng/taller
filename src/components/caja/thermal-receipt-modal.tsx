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

  if (!isOpen) return null;

  // Resolve Values
  const effectivePlate = (plate || workOrder?.vehicle_plate || invoice?.vehicle_plate || "").toUpperCase();
  const effectiveType = (receiptType || invoice?.receipt_type || "Factura") as "Ticket" | "Boleta" | "Factura";
  const effectiveObservations = observations || invoice?.observations || workOrder?.observations || "";

  // Determine receipt number / series format e.g. F001-00000281
  let effectiveNumber = receiptNumber || invoice?.receipt_number || "";
  if (!effectiveNumber || effectiveNumber === "0" || effectiveNumber.toLowerCase() === "s/n") {
    if (effectiveType === "Factura") effectiveNumber = "F001-00000281";
    else if (effectiveType === "Boleta") effectiveNumber = "B001-00000259";
    else effectiveNumber = "TK01-00004513";
  } else if (!effectiveNumber.includes("-")) {
    if (effectiveType === "Factura") effectiveNumber = `F001-${effectiveNumber.padStart(8, "0")}`;
    else if (effectiveType === "Boleta") effectiveNumber = `B001-${effectiveNumber.padStart(8, "0")}`;
    else effectiveNumber = `TK01-${effectiveNumber.padStart(8, "0")}`;
  }

  // Customer info
  const effectiveClient = customerName || invoice?.client_name || (effectiveType === "Factura" ? "CORPORACION MEFRAK S.A.C." : "CLIENTES VARIOS");
  const effectiveDoc = customerDoc || invoice?.customer_doc || (effectiveType === "Factura" ? "20613454595" : "00000000");
  const effectiveAddress = customerAddress || invoice?.customer_address || (effectiveType === "Factura" ? "CAL. AMBROSIO VUCETICH 130 - Z.I. SEC PARQUE INDUSTRIAL MZA. K LOTE. 2 INT. 906 A ESPALDAS DEL MERCADO GRATERSA AREQUIPA-AREQUIPA-AREQUIPA" : "-");

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

  // Bulletproof 1-Page 80mm Print Trigger using Isolated Hidden Frame
  const handlePrint = () => {
    const printable = document.getElementById("thermal-receipt-printable");
    if (!printable) {
      window.print();
      return;
    }

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

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${effectiveType} - ${effectiveNumber}</title>
          <style>
            @page {
              size: auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 76mm;
              max-width: 76mm;
              margin: 0;
              padding: 0;
              height: auto !important;
              min-height: 0 !important;
              background: #fff;
              color: #000;
              font-family: 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif;
              font-size: 11px;
              line-height: 1.2;
              -webkit-font-smoothing: antialiased;
            }
            .paper {
              width: 72mm;
              max-width: 72mm;
              margin: 0 auto;
              padding: 2mm 2mm 4mm 2mm;
              height: auto !important;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .border-t { border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px; }
            .border-b { border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px; }
            .border-t-solid { border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
            .border-b-solid { border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
            .logo-img {
              max-height: 52px;
              max-width: 170px;
              display: block;
              margin: 0 auto;
              object-fit: contain;
            }
            .spacer-2lines {
              height: 12px;
            }
            .qr-img {
              width: 115px;
              height: 115px;
              display: block;
              margin: 0 auto;
              object-fit: contain;
            }
            table { width: 100%; border-collapse: collapse; }
            table.items th { border-bottom: 1px dashed #000; padding: 3px 2px; font-size: 10.5px; font-weight: bold; }
            table.items td { padding: 2px 2px; font-size: 10.5px; vertical-align: top; }
            .col-cant { width: 18%; text-align: left; }
            .col-punit { width: 42%; text-align: right; padding-right: 6px; }
            .col-imp { width: 40%; text-align: right; padding-right: 2px; }
            .table-totals { width: 100%; font-size: 10.5px; }
            .table-totals td { padding: 1px 2px; }
            .table-totals td.val { text-align: right; padding-right: 2px; font-weight: bold; }
            .total-row { font-size: 12.5px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 2px; margin-top: 3px; }
            .amount-words { font-size: 10px; font-weight: bold; text-align: center; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 1px; margin: 4px 0; }
            .legal-footer { font-size: 9px; text-align: center; color: #000; margin-top: 4px; line-height: 1.15; }
          </style>
        </head>
        <body>
          <div class="paper">
            ${printable.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    }, 300);
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
              <div>
                <strong>{effectiveType === "Factura" ? "RUC:" : "DNI:"}</strong> {effectiveDoc}
              </div>
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

