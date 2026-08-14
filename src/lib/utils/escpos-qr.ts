/**
 * Utility for generating ESC/POS QR Code command buffers and SUNAT Fiscal QR text strings.
 * 
 * Standard SUNAT Peru Fiscal QR String format:
 * [RUC Emisor]|[Tipo Comprobante (01=Factura, 03=Boleta, 00=Ticket)]|[Serie]|[Número]|[IGV]|[Total]|[Fecha (YYYY-MM-DD o DD/MM/YYYY)]|[Tipo Doc Adquiriente (6=RUC, 1=DNI, 0=Sin Doc)]|[Num Doc Adquiriente]|[Digest/Hash]
 */

export function buildSunatFiscalQrString(params: {
  rucEmisor?: string;
  receiptType: "Factura" | "Boleta" | "Ticket";
  receiptNumber: string;
  igvAmount: number;
  grandTotal: number;
  dateStr: string;
  customerDoc: string;
}): string {
  const rucEmisor = params.rucEmisor || "20600982860";
  const docType = params.receiptType === "Factura" ? "01" : params.receiptType === "Boleta" ? "03" : "00";

  let serie = "F001";
  let numero = "00000001";
  if (params.receiptNumber.includes("-")) {
    const parts = params.receiptNumber.split("-");
    serie = parts[0];
    numero = parts[1];
  } else {
    numero = params.receiptNumber.padStart(8, "0");
    serie = params.receiptType === "Factura" ? "F001" : params.receiptType === "Boleta" ? "B001" : "TK01";
  }

  const clientDocType = params.customerDoc.length === 11 ? "6" : params.customerDoc.length === 8 ? "1" : "0";

  return `${rucEmisor}|${docType}|${serie}|${numero}|${params.igvAmount.toFixed(2)}|${params.grandTotal.toFixed(2)}|${params.dateStr}|${clientDocType}|${params.customerDoc}|`;
}

/**
 * Generates Epson / Generic ESC/POS Native QR Code Commands
 * (Model 2, Error Correction Level M / 48, Module Size 4, Store Data, Print)
 */
export function generateEscPosQrBytes(qrText: string): Uint8Array {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(qrText);
  const dataLen = dataBytes.length + 3; // pL, pH calculation

  const pL = dataLen % 256;
  const pH = Math.floor(dataLen / 256);

  const commands = [
    // 1. Model: GS ( k 0x04 0x00 0x31 0x41 0x32 0x00 (Model 2)
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,

    // 2. Module Size: GS ( k 0x03 0x00 0x31 0x43 0x04 (Size 4 = standard 80mm width)
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04,

    // 3. Error Correction: GS ( k 0x03 0x00 0x31 0x45 0x31 (Level M = 15%)
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,

    // 4. Store Data: GS ( k pL pH 0x31 0x50 0x30 d1...dk
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,
    ...Array.from(dataBytes),

    // 5. Print QR Code: GS ( k 0x03 0x00 0x31 0x51 0x30
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,

    // Line feed
    0x0a, 0x0a
  ];

  return new Uint8Array(commands);
}
