/**
 * Robust CSV / TSV Parser for ReyGas ERP
 * Correctly detects delimiters (; , \t) and preserves numbers with commas (e.g. 126,459 KM),
 * quoted cells, and multiline descriptions.
 */

export function parseCSVRows(rawText: string): string[][] {
  if (!rawText) return [];

  // Clean invalid binary/control chars while preserving utf-8 and newlines
  const sanitized = rawText.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u0400-\u04FF\u0100-\u017F\u0180-\u024F]/g, "");
  const lines = sanitized.split(/\r\n|\n/);

  // Detect delimiter from sample lines
  const sample = lines.slice(0, 15).join("\n");
  let delimiter = ";";
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;

  if (semiCount >= commaCount && semiCount >= tabCount && semiCount > 0) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  } else {
    delimiter = ",";
  }

  const rows: string[][] = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (!line || !line.trim()) continue;

    // Fast path: No quotes present in line -> split strictly by the file delimiter
    if (!line.includes('"')) {
      const cols = line.split(delimiter).map((c) => c.trim());
      rows.push(cols);
      continue;
    }

    // Standard path with quote handling
    const cols: string[] = [];
    let insideQuotes = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        cols.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cols.push(currentCell.trim());
    rows.push(cols);
  }

  return rows;
}

export interface ParsedWorkshopRecord {
  dateISO: string;
  rawDate: string;
  quinquennialDate: string;
  chipExpiryDate: string;
  vehicleType: string; // TIPO (column 4 / index 3)
  fuelType: string; // Sistema (column 5 / index 4)
  brand: string; // Marca (column 6 / index 5)
  mileage: number; // KILOMETRAJE (column 7 / index 6)
  rawMileage: string;
  plate: string; // PLACA (column 8 / index 7)
  receiptNumber: string; // N° de boleta/Factura (column 9 / index 8)
  clientName: string; // Cliente (column 10 / index 9)
  clientPhone: string; // Celular (column 11 / index 10)
  technicianName: string; // Técnico (column 12 / index 11)
  maintenanceService: string; // MANT. GENERAL / SERVICIO (column 13 / index 12)
  sparePartsServices: string; // REPUESTOS Y SERVICIOS (column 14 / index 13)
  price: number; // Precio (column 15 / index 14)
  rawPrice: string;
  discounts: string | number; // DESCUENTOS (column 16 / index 15)
  creditAmount: number; // Credito (column 17 / index 16)
  rawCredit: string;
  paymentCondition: string; // Condicion (column 18 / index 17)
  paymentMethod: string; // METODO DE PAGO (column 19 / index 18)
  paymentDestination: string; // DESTINO DE PAGO (column 20 / index 19)
  receiptType: string; // COMPROBANTE (column 21 / index 20)
  customerDoc: string; // RUC FACTURA (column 22 / index 21)
}

export function parseWorkshopRow(cols: string[]): ParsedWorkshopRecord | null {
  if (!cols || cols.length === 0) return null;

  // 1. Date is in cols[0]
  const rawDate = (cols[0] || "").trim();
  if (!rawDate || rawDate.toLowerCase().includes("fecha")) return null;
  const dateISO = parseISODate(rawDate);

  // Find Plate index dynamically (usually 7 in 21/22-col format)
  let plateIdx = 7;
  if (cols.length >= 8 && cols[7] && cols[7].trim()) {
    plateIdx = 7;
  } else {
    for (let i = 5; i < Math.min(cols.length, 12); i++) {
      const val = (cols[i] || "").trim().toUpperCase();
      if (!val) continue;
      if (val === "VENTA" || /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/.test(val)) {
        plateIdx = i;
        break;
      }
    }
  }

  const rawPlate = (cols[plateIdx] || "").trim().toUpperCase();
  const plate = rawPlate.replace(/[^A-Z0-9-]/g, "");
  if (!plate || plate.length < 3) return null;

  const quinquennialDate = (cols[1] || "").trim();
  const chipExpiryDate = (cols[2] || "").trim();
  const vehicleType = (cols[3] || "").trim();
  const fuelType = (cols[4] || "").trim();
  const brand = (cols[5] || "").trim();
  const rawMileage = (cols[6] || "").trim();
  const mileage = rawMileage ? (parseInt(rawMileage.replace(/[^0-9]/g, ""), 10) || 0) : 0;

  const receiptNumber = (cols[8] || cols[plateIdx + 1] || "").trim();
  const clientName = (cols[9] || cols[plateIdx + 2] || "").trim();
  const clientPhone = (cols[10] || cols[plateIdx + 3] || "").trim();
  const technicianName = (cols[11] || cols[plateIdx + 4] || "").trim();

  const maintenanceService = (cols[12] || "").trim();
  const sparePartsServices = (cols[13] || "").trim();

  const rawPrice = (cols[14] || "").trim();
  const priceClean = rawPrice.replace(/[$S/,\s]/g, "");
  const price = priceClean && !isNaN(Number(priceClean)) ? parseFloat(priceClean) : 0;

  const rawDiscounts = (cols[15] || "").trim();
  const discounts = rawDiscounts;

  const rawCredit = (cols[16] || "").trim();
  const creditClean = rawCredit.replace(/[$S/,\s]/g, "");
  const creditAmount = creditClean && !isNaN(Number(creditClean)) ? parseFloat(creditClean) : 0;

  const paymentCondition = (cols[17] || "").trim();
  const paymentMethod = (cols[18] || "").trim();
  const paymentDestination = (cols[19] || "").trim();
  const receiptType = (cols[20] || "").trim();
  const customerDoc = (cols[21] || "").trim();

  return {
    dateISO,
    rawDate,
    quinquennialDate,
    chipExpiryDate,
    vehicleType,
    fuelType,
    brand,
    mileage,
    rawMileage,
    plate,
    receiptNumber,
    clientName,
    clientPhone,
    technicianName,
    maintenanceService,
    sparePartsServices,
    price,
    rawPrice,
    discounts,
    creditAmount,
    rawCredit,
    paymentCondition,
    paymentMethod,
    paymentDestination,
    receiptType,
    customerDoc,
  };
}

export function parseISODate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return new Date().toISOString();

  const clean = dateStr.trim();
  // Standard Peruvian date dd/mm/yyyy or dd-mm-yyyy
  const parts = clean.split(/\/|-/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const fullYear = year < 100 ? 2000 + year : year;
      const d = new Date(fullYear, month - 1, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return new Date().toISOString();
}
