/**
 * Utility to normalize barcode scanner input and multi-word product searches.
 * Handheld barcode scanners (like SEISA YHD-8200L, Netum, Honeywell) emulate US keyboards.
 * On computers with Spanish / Latin American keyboard layouts, keycodes for hyphen '-'
 * produce apostrophe "'", "’", "´", "`", or "¿".
 * This function automatically fixes those keyboard layout translation artifacts while
 * fully allowing and preserving spaces so users can type product names with multiple words.
 */
export function normalizeScannerCode(raw: string): string {
  if (!raw) return "";
  const translated = raw.replace(/['’´`¿]/g, "-");

  // Check if it is a duplicated continuous barcode scanner buffer (no spaces inside)
  if (!translated.includes(" ")) {
    const standardSkuMatch = translated.toUpperCase().match(/^([A-Z0-9]+-[A-Z0-9]+-[0-9]+)/);
    if (standardSkuMatch && standardSkuMatch[1] && translated.length > standardSkuMatch[1].length) {
      return standardSkuMatch[1];
    }

    // Exact half duplication check (e.g. 775123456775123456 -> 775123456)
    if (translated.length >= 6 && translated.length % 2 === 0) {
      const half = translated.slice(0, translated.length / 2);
      if (half + half === translated) {
        return half;
      }
    }
  }

  return translated;
}
