/**
 * Utility to normalize barcode scanner input and multi-word product searches.
 * Handheld barcode scanners (like SEISA YHD-8200L, Netum, Honeywell) emulate US keyboards.
 * On computers with Spanish / Latin American keyboard layouts, keycodes for hyphen '-'
 * produce apostrophe "'", "’", "´", "`", or "¿".
 * This function automatically fixes those keyboard layout translation artifacts,
 * deduplicates repeated scanner buffer dumps (e.g. RYG-ABR-0001YG-ABR-0001), and
 * cleanly preserves spaces for typing product names (e.g. "abrazadera doradita").
 */
export function normalizeScannerCode(raw: string): string {
  if (!raw) return "";
  let clean = raw
    .trim()
    .replace(/['’´`¿?_]/g, "-") // Convert Spanish keyboard translation artifacts back to hyphen
    .replace(/\s+/g, " ") // Normalize multiple spaces to single space
    .toUpperCase();

  // If it's a SKU pattern with hyphens (e.g. RYG - ABR - 0001), remove the whitespace around hyphens
  if (/^[A-Z0-9]+\s*-\s*[A-Z0-9]+/i.test(clean)) {
    clean = clean.replace(/\s+/g, "");
  }

  // 1. Detect and extract standard SKU pattern if duplicated (e.g. RYG-ABR-0001YG-ABR-0001)
  const standardSkuMatch = clean.match(/^([A-Z0-9]+-[A-Z0-9]+-[0-9]+)/);
  if (standardSkuMatch && standardSkuMatch[1]) {
    return standardSkuMatch[1];
  }

  // 2. Detect generic 2-segment code duplication (e.g. SKU-0001SKU-0001)
  const twoPartMatch = clean.match(/^([A-Z0-9]+-[0-9]+)/);
  if (twoPartMatch && twoPartMatch[1] && clean.length > twoPartMatch[1].length * 1.5) {
    return twoPartMatch[1];
  }

  // 3. Exact half duplication check (e.g. 775123456775123456 -> 775123456)
  if (clean.length >= 6 && clean.length % 2 === 0) {
    const half = clean.slice(0, clean.length / 2);
    if (half + half === clean) {
      return half;
    }
  }

  return clean;
}
