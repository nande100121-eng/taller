"use client";

import React, { useRef } from "react";
import { Printer, Download, X, CheckCircle2, QrCode } from "lucide-react";
import { numberToSpanishWords } from "@/lib/utils/number-to-words";
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
  receiptType = "Ticket",
  receiptNumber,
  customerDoc,
  customerName,
  customerAddress,
  plate,
  grandTotal,
  items,
  discountAmount = 0,
  paymentMethod = "CONTADO",
  issuedAt,
}: ThermalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Resolve Values
  const effectivePlate = (plate || workOrder?.vehicle_plate || invoice?.vehicle_plate || "").toUpperCase();
  const effectiveType = (receiptType || invoice?.receipt_type || "Ticket") as "Ticket" | "Boleta" | "Factura";

  // Determine receipt number / series
  let effectiveNumber = receiptNumber || invoice?.receipt_number || "";
  if (!effectiveNumber || effectiveNumber === "0" || effectiveNumber.toLowerCase() === "s/n") {
    if (effectiveType === "Factura") effectiveNumber = "F001-00000282";
    else if (effectiveType === "Boleta") effectiveNumber = "B001-00000259";
    else effectiveNumber = "TK01-00004545";
  } else if (!effectiveNumber.includes("-")) {
    if (effectiveType === "Factura") effectiveNumber = `F001-${effectiveNumber.padStart(8, "0")}`;
    else if (effectiveType === "Boleta") effectiveNumber = `B001-${effectiveNumber.padStart(8, "0")}`;
    else effectiveNumber = `TK01-${effectiveNumber.padStart(8, "0")}`;
  }

  // Customer info
  const effectiveClient = customerName || invoice?.client_name || "CLIENTES VARIOS";
  const effectiveDoc = customerDoc || invoice?.customer_doc || (effectiveType === "Factura" ? "20600000000" : "00000000");
  const effectiveAddress = customerAddress || invoice?.customer_address || "-";

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
            description: workOrder?.problem_description || "SERVICIO DE TALLER",
            quantity: 1,
            unit_price: grandTotal || invoice?.grand_total || 0,
            subtotal: grandTotal || invoice?.grand_total || 0,
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
    grandTotal !== undefined && grandTotal > 0
      ? grandTotal
      : invoice?.grand_total || effectiveItems.reduce((s, it) => s + it.subtotal, 0);

  // Calculations for Tax breakdown (IGV 18%)
  const opGravadas = effectiveTotal / 1.18;
  const igvAmount = effectiveTotal - opGravadas;
  const amountInWords = numberToSpanishWords(effectiveTotal);

  // Date formatted
  const rawDate = issuedAt || invoice?.issued_at || workOrder?.entry_time || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const dateFormatted = isNaN(dateObj.getTime())
    ? new Date().toLocaleDateString("es-PE")
    : dateObj.toLocaleDateString("es-PE");
  const timeFormatted = isNaN(dateObj.getTime())
    ? new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
    : dateObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-reygas-dark border border-amber-500/40 max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls Header */}
        <div className="p-4 bg-reygas-surface border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Comprobante Generado: {effectiveNumber}
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-gray-900/50 flex justify-center">
          {/* Exact Thermal 80mm / POS Ticket Container */}
          <div
            ref={receiptRef}
            id="thermal-receipt-printable"
            className="w-full max-w-[340px] bg-white text-black p-4 rounded-lg shadow-xl font-mono text-[11px] leading-tight space-y-2 border border-gray-300"
          >
            {/* Header with Logo Text */}
            <div className="text-center space-y-0.5">
              <div className="border-b border-black pb-1 mb-1">
                <span className="text-base font-black tracking-widest block font-sans">REYGAS</span>
                <span className="text-[9px] tracking-wider block font-bold text-gray-700 font-sans">AUTOGAS EQUIPMENT</span>
              </div>

              <div className="font-bold text-xs">REYGAS S.A.C.</div>
              <div className="text-[10px] text-gray-800">
                AV. SAN MARTIN NRO. 279 LIMA - HUAURA - SANTA MARIA
              </div>
              <div className="font-bold text-[10px]">RUC 20600982860</div>
            </div>

            <div className="border-t border-black pt-1 text-center font-bold">
              {effectiveType === "Factura" && (
                <>
                  <div className="text-xs">FACTURA ELECTRÓNICA</div>
                  <div className="text-xs">{effectiveNumber}</div>
                </>
              )}
              {effectiveType === "Boleta" && (
                <>
                  <div className="text-xs">BOLETA DE VENTA ELECTRÓNICA</div>
                  <div className="text-xs">{effectiveNumber}</div>
                </>
              )}
              {effectiveType === "Ticket" && (
                <>
                  <div className="text-xs">TICKET DE VENTA</div>
                  <div className="text-xs">{effectiveNumber}</div>
                </>
              )}
            </div>

            {/* Client & Document Metadata */}
            <div className="border-t border-black pt-1 space-y-0.5 text-[10px]">
              <div>
                <strong>CLIENTE:</strong> {effectiveClient}
              </div>
              {effectiveType === "Factura" ? (
                <div>
                  <strong>RUC:</strong> {effectiveDoc}
                </div>
              ) : (
                <div>
                  <strong>DNI:</strong> {effectiveDoc}
                </div>
              )}
              <div>
                <strong>DIRECCION:</strong> {effectiveAddress}
              </div>
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
                <strong>OBSERVACION:</strong> {effectivePlate || "S/P"}
              </div>
            </div>

            {/* Items Table */}
            <div className="border-t border-black pt-1">
              <div className="flex justify-between font-bold border-b border-dashed border-black pb-0.5 text-[10px]">
                <span className="w-12">CANT.</span>
                <span className="flex-1 px-1">DESCRIPCIÓN</span>
                <span className="w-12 text-right">P.UNIT.</span>
                <span className="w-12 text-right">IMPORTE</span>
              </div>

              <div className="divide-y divide-gray-200 py-1 space-y-1">
                {effectiveItems.map((item, idx) => (
                  <div key={idx} className="pt-0.5">
                    <div className="font-bold text-[10px] break-words uppercase">{item.description}</div>
                    <div className="flex justify-between text-[10px]">
                      <span className="w-12">{item.quantity.toFixed(2)}</span>
                      <span className="flex-1"></span>
                      <span className="w-12 text-right font-mono">{item.unit_price.toFixed(2)}</span>
                      <span className="w-12 text-right font-mono font-bold">{item.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Details for Boleta and Factura */}
            {effectiveType !== "Ticket" ? (
              <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[10px] text-right">
                <div className="flex justify-between">
                  <span>OP. GRAVADAS:</span>
                  <span className="font-mono">S/ {opGravadas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>OP. EXONERADAS:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>OP. INAFECTAS:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>OP. GRATUITAS:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="font-mono">S/ {opGravadas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DESCUENTOS:</span>
                  <span className="font-mono">S/ {discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IGV 18.0%:</span>
                  <span className="font-mono">S/ {igvAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ICBPER:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>ADELANTOS:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
                <div className="flex justify-between font-black text-xs border-t border-black pt-0.5">
                  <span>TOTAL:</span>
                  <span className="font-mono">S/ {effectiveTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[10px] text-right">
                <div className="flex justify-between">
                  <span>DESCUENTOS:</span>
                  <span className="font-mono">S/ {discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-xs border-t border-black pt-0.5">
                  <span>TOTAL:</span>
                  <span className="font-mono">S/ {effectiveTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* QR Code Placeholder matching electronic tickets */}
            {effectiveType !== "Ticket" && (
              <div className="flex justify-center py-2 border-t border-dashed border-black">
                <div className="p-1 border border-black bg-white inline-block">
                  <QrCode className="w-16 h-16 text-black" />
                </div>
              </div>
            )}

            {/* Amount in words */}
            <div className="border-t border-black pt-1 text-[10px] font-bold uppercase text-center">
              {amountInWords}
            </div>

            {/* Footer Notes */}
            <div className="border-t border-black pt-1 text-center space-y-0.5 text-[9px]">
              <div className="font-bold">GRACIAS POR SU PREFERENCIA</div>
              <div>
                USUARIO: reygas-caja {dateFormatted} {timeFormatted}
              </div>

              {effectiveType === "Ticket" ? (
                <>
                  <div className="italic text-gray-700 pt-0.5">
                    Este es un comprobante interno, no tiene ninguna validez tributaria.
                  </div>
                  <div className="text-gray-800">Consulte su comprobante en www.smartclic.pe</div>
                </>
              ) : effectiveType === "Factura" ? (
                <div className="text-gray-700 italic pt-0.5">
                  Representación impresa de FACTURA ELECTRÓNICA
                </div>
              ) : (
                <div className="text-gray-700 italic pt-0.5">
                  Representación impresa de BOLETA DE VENTA ELECTRÓNICA
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 bg-reygas-surface border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Térmico (80mm)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl border border-white/10 flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Guardar como PDF</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-reygas-dark hover:bg-gray-800 text-gray-300 font-bold text-xs rounded-xl border border-white/10"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Global CSS for Clean Thermal Printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-printable,
          #thermal-receipt-printable * {
            visibility: visible;
          }
          #thermal-receipt-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
