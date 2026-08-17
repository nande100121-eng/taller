/**
 * Utility to normalize barcode scanner input.
 * Handheld barcode scanners (like SEISA YHD-8200L, Netum, Honeywell) emulate US keyboards.
 * On computers with Spanish / Latin American keyboard layouts, keycodes for hyphen '-'
 * produce apostrophe "'", "’", "´", "`", or "¿".
 * This function automatically fixes those keyboard layout translation artifacts.
 */
export function normalizeScannerCode(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/['’´`¿?_]/g, "-") // Convert Spanish keyboard translation artifacts back to hyphen
    .replace(/\s+/g, "")
    .toUpperCase();
}
