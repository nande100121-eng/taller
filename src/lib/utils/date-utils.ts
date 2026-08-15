/**
 * Peru Timezone (America/Lima, UTC-5) Utility Helpers
 * Ensures consistent date and time calculations across all client and server environments.
 */

export const PERU_TIMEZONE = "America/Lima";

/**
 * Returns today's date in Peru formatted as "YYYY-MM-DD" (e.g. "2026-08-14")
 */
export function getPeruDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Formats date into Peru standard format "DD/MM/YYYY" (e.g. "14/08/2026")
 */
export function formatPeruDate(date: Date | string | number = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: PERU_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Formats date and time into Peru standard format "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY HH:MM"
 */
export function formatPeruDateTime(
  date: Date | string | number = new Date(),
  includeSeconds = true
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: PERU_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (includeSeconds) {
    options.second = "2-digit";
  }

  return new Intl.DateTimeFormat("es-PE", options).format(d);
}

/**
 * Returns datetime-local string (YYYY-MM-DDTHH:MM) in Peru timezone
 */
export function getPeruDateTimeLocal(date: Date | string | number = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  return `${map.year}-${map.month}-${map.day}T${map.hour || "00"}:${map.minute || "00"}`;
}

/**
 * Parses date string safely taking into account Peru local time
 */
export function parseDateToPeruString(rawDateStr?: string): string {
  if (!rawDateStr) return getPeruDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) return rawDateStr;

  // If DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(rawDateStr)) {
    const parts = rawDateStr.split("/");
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    let year = parts[2];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }

  return getPeruDateString(new Date(rawDateStr));
}
