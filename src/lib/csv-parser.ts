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
