/**
 * Utility to normalize barcode scanner input.
 * Handheld barcode scanners (like SEISA YHD-8200L, Netum, Honeywell) emulate US keyboards.
 * On computers with Spanish / Latin American keyboard layouts, keycodes for hyphen '-'
 * produce apostrophe "'", "’", "´", "`", or "¿".
 * This function automatically fixes those keyboard layout translation artifacts and
 * deduplicates repeated scanner buffer dumps (e.g. RYG-ABR-0001YG-ABR-0001).
 */
export function normalizeScannerCode(raw: string): string {
  if (!raw) return "";
  const clean = raw
    .trim()
    .replace(/['’´`¿?_]/g, "-") // Convert Spanish keyboard translation artifacts back to hyphen
    .replace(/\s+/g, "")
    .toUpperCase();

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
