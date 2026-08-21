// Utilidades de Métodos de Pago: desanidan cadenas "Mixto (Mixto (...))" obsoletas
// y limpian datos heredados para que el registro de taller muestre SOLO los pagos
// realmente vigentes (los abonos borrados no dejan rastro en el método).

export interface MethodPair {
  name: string;
  amount: number;
}

// Divide una cadena por comas de nivel superior (respeta paréntesis anidados).
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// Extrae pares {nombre, monto} de una cadena "Mixto (...)", desanidando grupos anidados.
// Ej: "Mixto (Efectivo: S/ 50.00, Yape: S/ 260.00)" -> [{Efectivo,50},{Yape,260}]
export function parseMethodPairs(method: string): MethodPair[] {
  const m = (method || "").trim();
  if (!m.startsWith("Mixto (") || !m.endsWith(")")) return [];
  const inner = m.slice(7, -1); // quita "Mixto (" y ")"
  const out: MethodPair[] = [];
  for (const part of splitTopLevel(inner)) {
    const idx = part.lastIndexOf(":");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const amount = parseFloat(part.slice(idx + 1).replace(/[^0-9.\-]/g, "")) || 0;
    if (/Mixto/i.test(name)) {
      const nested = parseMethodPairs(name.endsWith(")") ? name : name + ")");
      out.push(...nested);
    } else if (name) {
      out.push({ name, amount });
    }
  }
  return out;
}

// Representación limpia de un método para MOSTRAR:
// - Métodos simples se conservan tal cual ("Efectivo", "EFECTIVO, YAPE"...).
// - "Mixto (...)" de un solo nivel se conserva (ya es limpio).
// - "Mixto (Mixto (...))" anidado (dato obsoleto) se colapsa: si un único método
//   coincide con el monto indicado se muestra ese método; si son varios, "Mixto (M1, M2)".
export function cleanMethodDisplay(method?: string | null, amount?: number): string {
  const m = (method || "").trim();
  if (!m || m === "Sin Método") return "";
  if (!m.startsWith("Mixto (")) return m;
  if (!m.slice(7, -1).includes("Mixto (")) return m; // ya es un resumen mixto limpio
  const pairs = parseMethodPairs(m);
  if (pairs.length === 0) return "Mixto";
  let chosen = pairs;
  if (typeof amount === "number" && amount > 0) {
    const matching = pairs.filter((p) => Math.abs(p.amount - amount) < 0.01);
    if (matching.length > 0) chosen = matching;
  }
  const names = Array.from(new Set(chosen.map((p) => p.name).filter(Boolean)));
  if (names.length === 0) return "Mixto";
  if (names.length === 1) return names[0];
  return `Mixto (${names.join(", ")})`;
}

// Limpia un método antes de GUARDARLO: elimina anidamientos "Mixto (Mixto (...))".
// Conserva resúmenes mixtos válidos de un solo nivel con sus montos.
export function sanitizeMethod(method?: string | null, amount?: number): string {
  const m = (method || "").trim();
  if (!m || m === "Sin Método") return "";
  if (!m.startsWith("Mixto (")) return m;
  if (!m.slice(7, -1).includes("Mixto (")) return m;
  return cleanMethodDisplay(m, amount);
}

const METHOD_TITLES: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Yape",
  TRANSFERENCIA: "Transferencia",
  BCP: "Transferencia",
  BBVA: "Transferencia",
  CULQI: "Culqi",
  TARJETA: "Culqi",
  POS: "Culqi",
};

function normalizeMethodName(name: string): string {
  const up = (name || "").trim().toUpperCase();
  if (METHOD_TITLES[up]) return METHOD_TITLES[up];
  return (name || "").trim();
}

// Método base de arranque para prefills de formularios: devuelve UN solo nombre limpio.
export function defaultMethodFrom(method?: string | null): string {
  const m = (method || "").trim();
  if (!m || m === "Sin Método") return "Efectivo";
  const names: string[] = [];
  if (m.startsWith("Mixto (")) {
    for (const p of parseMethodPairs(m)) {
      const n = normalizeMethodName(p.name);
      if (n && !names.includes(n)) names.push(n);
    }
  } else {
    for (const part of m.split(",")) {
      const n = normalizeMethodName(part.replace(/^\(/, "").replace(/\)$/, "").trim());
      if (n && !names.includes(n)) names.push(n);
    }
  }
  return names.length > 0 ? names[0] : "Efectivo";
}

export interface MethodSource {
  method?: string | null;
  amount?: number | null;
  destination?: string | null;
  id?: string;
  receipt_number?: string | null;
  receipt_type?: string | null;
}

// Reconstruye el payment_method de la factura a partir del historial VIGENTE de abonos.
// Un solo registro -> su método limpio (colapsando anidamientos obsoletos).
// Varios registros -> "Mixto (Método1, Método2)" con nombres únicos.
export function rebuildMethodFromHistory(history: MethodSource[]): string {
  if (!history || history.length === 0) return "";
  if (history.length === 1) {
    return cleanMethodDisplay(history[0].method, Number(history[0].amount) || 0);
  }
  const names: string[] = [];
  for (const rec of history) {
    const m = (rec.method || "").trim();
    if (!m || m === "Sin Método") continue;
    const base = m.startsWith("Mixto (")
      ? Array.from(new Set(parseMethodPairs(m).map((p) => p.name)))
      : [m];
    for (const n of base) {
      const norm = normalizeMethodName(n);
      if (norm && !names.includes(norm)) names.push(norm);
    }
  }
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `Mixto (${names.join(", ")})`;
}

// Reconstruye el desglose (payment_breakdown) a partir del historial vigente.
// Un registro "Mixto (Efectivo: S/ 50.00, Yape: S/ 110.00)" se DESANIDA en sus métodos
// individuales (2 splits) para que la distribución por método (cada parte con su monto)
// no se pierda al editar/borrar un pago (bug: la matriz YAPES/TRANSFERENCIAS POR DESTINO
// veía un solo split "Mixto (...)" y no podía separar el efectivo del yape).
export function rebuildBreakdownFromHistory(history: MethodSource[]): any[] {
  if (!history || history.length === 0) return [];
  const out: any[] = [];
  history.forEach((rec, i) => {
    const m = (rec.method || "").trim();
    const amt = Number(rec.amount) || 0;
    if (m.startsWith("Mixto (")) {
      const pairs = parseMethodPairs(m);
      if (pairs.length > 1) {
        pairs.forEach((p, j) => {
          out.push({
            id: rec.id ? (rec.id + "-" + j) : ("split-" + i + "-" + j),
            method: normalizeMethodName(p.name) || "Efectivo",
            amount: p.amount,
            destination: rec.destination || undefined,
            receipt_number: rec.receipt_number || undefined,
            receipt_type: rec.receipt_type || undefined,
          });
        });
        return;
      }
    }
    out.push({
      id: rec.id || ("split-" + (i + 1)),
      method: cleanMethodDisplay(rec.method, amt) || "Efectivo",
      amount: amt,
      destination: rec.destination || undefined,
      receipt_number: rec.receipt_number || undefined,
      receipt_type: rec.receipt_type || undefined,
    });
  });
  return out;
}

// Reconstruye el destino de pago a partir del historial vigente: SIEMPRE un solo
// destino. Si todos los pagos coinciden se usa ese; si difieren, el del pago de MAYOR
// monto (el principal). NUNCA se concatenan ("CAJA / FRANCO") — la tabla
// YAPES/TRANSFERENCIAS POR DESTINO y la card muestran un único destino.
export function rebuildDestFromHistory(history: MethodSource[]): string {
  const recs = (history || []).filter(
    (r) => r && r.destination && String(r.destination).trim() && String(r.destination).trim() !== "Ninguno"
  );
  if (recs.length === 0) return "";
  const unique = Array.from(new Set(recs.map((r) => String(r.destination).trim())));
  if (unique.length === 1) return unique[0];
  const top = [...recs].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
  return String(top?.destination || "").trim();
}