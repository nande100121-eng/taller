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
  fuelType: string;
  brand: string;
  mileage: number;
  plate: string;
  receiptNumber: string;
  clientName: string;
  clientPhone: string;
  technicianName: string;
  maintenanceService: string;
  sparePartsServices: string;
  price: number;
  discounts: string | number;
  creditAmount: number;
  paymentCondition: string;
  paymentMethod: string;
  paymentDestination: string;
  receiptType: string;
}

export function parseWorkshopRow(cols: string[]): ParsedWorkshopRecord | null {
  if (!cols || cols.length === 0) return null;

  // 1. Date is in cols[0]
  const rawDate = (cols[0] || "").trim();
  if (!rawDate || rawDate.toLowerCase().includes("fecha")) return null;
  const dateISO = parseISODate(rawDate);

  // 2. Find Plate Column dynamically (between index 5 and index 10)
  let plateIdx = -1;
  for (let i = 5; i < Math.min(cols.length, 12); i++) {
    const val = (cols[i] || "").trim().toUpperCase();
    if (!val) continue;
    if (val === "VENTA" || /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/.test(val)) {
      const nextVal = (cols[i + 1] || "").trim();
      if (/^[0-9]+$/.test(nextVal) || nextVal === "S/N" || nextVal === "0" || nextVal === "") {
        plateIdx = i;
        break;
      }
    }
  }

  // Fallback scan for hyphenated plate
  if (plateIdx === -1) {
    for (let i = 5; i < Math.min(cols.length, 10); i++) {
      const val = (cols[i] || "").trim().toUpperCase();
      if (val.length >= 3 && val.includes("-")) {
        plateIdx = i;
        break;
      }
    }
    if (plateIdx === -1) plateIdx = 6;
  }

  const rawPlate = (cols[plateIdx] || "").trim().toUpperCase();
  const plate = rawPlate.replace(/[^A-Z0-9-]/g, "");
  if (!plate || plate.length < 3) return null;

  // 3. Pre-Plate Columns: Quinquenal, Chip, Fuel, Brand, Mileage
  const quinquennialDate = (cols[1] || "").trim();
  const chipExpiryDate = (cols[2] || "").trim();

  let fuelType = "";
  let brand = "";
  let mileage = 0;

  for (let i = 3; i < plateIdx; i++) {
    const val = (cols[i] || "").trim();
    if (!val) continue;
    const upper = val.toUpperCase();
    if (upper === "GNV" || upper === "GLP" || upper === "GASOLINA" || upper === "DUAL") {
      fuelType = upper;
    } else if (upper.includes("KM") || /^[0-9,.]+$/.test(val)) {
      mileage = parseInt(val.replace(/[^0-9]/g, ""), 10) || 0;
    } else if (val !== "-" && !brand) {
      brand = val;
    }
  }

  // 4. Post-Plate Columns: Receipt, Client, Phone, Tech
  const receiptNumber = (cols[plateIdx + 1] || "").trim();
  const clientName = (cols[plateIdx + 2] || "").trim();
  const clientPhone = (cols[plateIdx + 3] || "").trim();
  const technicianName = (cols[plateIdx + 4] || "").trim();

  // 5. Post-Tech Columns: Find Condition (PAGADO / PENDIENTE / CREDITO)
  let conditionIdx = -1;
  for (let i = plateIdx + 5; i < cols.length; i++) {
    const upper = (cols[i] || "").trim().toUpperCase();
    if (upper === "PAGADO" || upper === "PENDIENTE" || upper === "CREDITO" || upper.includes("PAGADO") || upper.includes("PENDIENTE")) {
      conditionIdx = i;
      break;
    }
  }

  let paymentCondition = "";
  let paymentMethod = "";
  let paymentDestination = "";
  let receiptType = "";
  let price = 0;
  let discounts: string | number = "";
  let creditAmount = 0;
  let maintenanceService = "";
  let sparePartsServices = "";

  if (conditionIdx !== -1) {
    paymentCondition = (cols[conditionIdx] || "").trim();
    paymentMethod = (cols[conditionIdx + 1] || "").trim();
    paymentDestination = (cols[conditionIdx + 2] || "").trim();
    receiptType = (cols[conditionIdx + 3] || "").trim();

    const creditRaw = (cols[conditionIdx - 1] || "").trim();
    const discountRaw = (cols[conditionIdx - 2] || "").trim();
    const priceRaw = (cols[conditionIdx - 3] || "").trim();

    if (creditRaw) {
      creditAmount = parseFloat(creditRaw.replace(/[^0-9.]/g, "")) || 0;
    }
    if (discountRaw) {
      discounts = discountRaw;
    }
    if (priceRaw) {
      price = parseFloat(priceRaw.replace(/[^0-9.]/g, "")) || 0;
    } else {
      for (let i = plateIdx + 5; i < conditionIdx; i++) {
        const cVal = (cols[i] || "").trim();
        if (cVal.startsWith("$") || /^[0-9,.]+$/.test(cVal.replace("$", ""))) {
          const num = parseFloat(cVal.replace(/[^0-9.]/g, "")) || 0;
          if (num > 0 || cVal.includes("0")) {
            price = num;
            break;
          }
        }
      }
    }

    const serviceStrings: string[] = [];
    for (let i = plateIdx + 5; i < conditionIdx - 3; i++) {
      const s = (cols[i] || "").trim();
      if (s && !s.startsWith("$") && isNaN(Number(s.replace(/[^0-9.]/g, "")))) {
        serviceStrings.push(s);
      }
    }
    if (serviceStrings.length > 0) {
      maintenanceService = serviceStrings[0] || "";
      sparePartsServices = serviceStrings.slice(1).join(" + ") || serviceStrings[0];
    }
  } else {
    maintenanceService = (cols[11] || "").trim();
    sparePartsServices = (cols[12] || "").trim();
    const rawPrice = (cols[13] || "").trim();
    price = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;
    discounts = (cols[14] || "").trim();
    const rawCredit = (cols[15] || "").trim();
    creditAmount = parseFloat(rawCredit.replace(/[^0-9.]/g, "")) || 0;
    paymentCondition = (cols[16] || "").trim();
    paymentMethod = (cols[17] || "").trim();
    paymentDestination = (cols[18] || "").trim();
    receiptType = (cols[19] || "").trim();
  }

  if (creditAmount > 0 && !paymentCondition) {
    paymentCondition = "PENDIENTE";
  }

  return {
    dateISO,
    rawDate,
    quinquennialDate,
    chipExpiryDate,
    fuelType,
    brand,
    mileage,
    plate,
    receiptNumber,
    clientName,
    clientPhone,
    technicianName,
    maintenanceService,
    sparePartsServices,
    price,
    discounts,
    creditAmount,
    paymentCondition,
    paymentMethod,
    paymentDestination,
    receiptType,
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
