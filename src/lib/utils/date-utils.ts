/**
 * Peru Timezone (America/Lima, UTC-5) Utility Helpers
 * Ensures consistent date and time calculations across all client and server environments.
 */

export const PERU_TIMEZONE = "America/Lima";

/**
 * Returns today's date in Peru formatted as "YYYY-MM-DD" (e.g. "2026-08-14")
 */
export function getPeruDateString(date: Date | string | number = new Date()): string {
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = typeof date === "number" ? new Date(date) : date instanceof Date ? date : new Date(date);
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
 * Returns ISO string anchored to Peru timezone (-05:00)
 */
export function buildPeruISOString(dateStr: string, timeStr = "08:30"): string {
  const cleanDate = dateStr.slice(0, 10);
  const cleanTime = (timeStr || "08:30").slice(0, 5);
  return `${cleanDate}T${cleanTime}:00-05:00`;
}

/**
 * Devuelve la FECHA de Perú (YYYY-MM-DD) de un timestamp ISO, convirtiendo
 * correctamente desde UTC. Fix: la base guarda timestamps en UTC (+00:00) y un
 * ingreso de la noche en Perú (ej. 19/08 20:45) queda como 2026-08-20T01:45Z;
 * con esto el filtro por fecha SIEMPRE ve el día correcto de Perú.
 */
export function toPeruDateKey(isoLike: string | Date | null | undefined): string {
  if (!isoLike) return "";
  if (isoLike instanceof Date) {
    return isNaN(isoLike.getTime()) ? "" : getPeruDateString(isoLike);
  }
  const trimmed = String(isoLike).trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return getPeruDateString(d);
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

/**
 * Re-ancla un timestamp ISO a la hora local de Perú con offset -05:00, manteniendo
 * el MISMO instante (no cambia cuándo ocurrió). Así `slice(0,10)` de los consumidores
 * da la fecha correcta de Perú aunque la base lo devuelva en UTC.
 */
export function toPeruAnchoredISO(isoLike: string | null | undefined): string | null | undefined {
  if (!isoLike) return isoLike;
  const trimmed = String(isoLike).trim();
  if (!trimmed) return isoLike;
  // Ya está anclado a Perú (termina en -05:00) o es solo fecha: se devuelve igual
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || /-05:00$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return isoLike;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-05:00`;
}

/**
 * Formats date into Peru standard format "DD/MM/YYYY" (e.g. "14/08/2026")
 * Guaranteed never to roll back to the previous day due to UTC midnight parsing.
 */
export function formatPeruDate(date: Date | string | number = new Date()): string {
  if (!date) return "";
  if (typeof date === "string") {
    const trimmed = date.trim();
    // If format YYYY-MM-DD or starts with YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d}/${m}/${y}`;
    }
    // If format DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
      const parts = trimmed.split("/");
      return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
    }
  }

  const d = typeof date === "number" ? new Date(date) : date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: PERU_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Formats date and time into Peru standard format "DD/MM/YYYY HH:MM" or "DD/MM/YYYY HH:MM:SS"
 * Guaranteed never to roll back date.
 */
export function formatPeruDateTime(
  date: Date | string | number = new Date(),
  includeSeconds = false
): string {
  if (!date) return "";
  if (typeof date === "string") {
    const trimmed = date.trim();
    // Check if it matches ISO with time: YYYY-MM-DDTHH:mm
    const timeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const [, y, m, d, hh, mm, ss] = timeMatch;
      if (includeSeconds && ss) {
        return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
      }
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
    // Check if it's date only: YYYY-MM-DD
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      return `${d}/${m}/${y}`;
    }
  }

  const d = typeof date === "number" ? new Date(date) : date instanceof Date ? date : new Date(date);
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
