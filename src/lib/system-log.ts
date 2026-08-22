// =====================================================================
// SISTEMA DE LOG INTERNO DE PROCESOS (diagnóstico de bugs y RENDIMIENTO)
// ALMACENAMIENTO LOCAL (localStorage) - NO usa Supabase para no sobrecargar
// la base cuando crezca el volumen. Buffer en memoria con persistencia
// diferida y tope FIFO (3000 entradas).
//   Consulta: getLocalLogs() / descarga: exportLocalLogs()
// =====================================================================

export type LogLevel = "info" | "warn" | "error";

let logSessionId = "sess_" + Date.now().toString(36);

// Versión del build (Vercel inyecta el SHA del commit; en dev queda "dev")
export const BUILD_SHA =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || "dev").slice(0, 8)
    : "dev";

// Página/componente activo (lo setea el layout con setCurrentLogPage() al navegar)
let currentLogPage = "desconocida";
export function setCurrentLogPage(page: string) {
  currentLogPage = page;
  try {
    (window as any).__REYGAS_PAGE = page;
  } catch {
    // noop
  }
}
export function getCurrentLogPage(): string {
  return currentLogPage;
}

// ===== ALMACENAMIENTO LOCAL =====
const LOG_STORAGE_KEY = "reygas-syslog-local";
// FIFO ampliado: el log debe captar TODAS las acciones/respuestas/clics (debug total).
// Aunque el FIFO conserva solo las más recientes (localStorage finito), el "Descargar
// log" exporta todo lo capturado en vivo; nada se omite al momento de registrar.
const LOG_MAX_ENTRIES = 12000;
const LOG_FLUSH_INTERVAL = 2000; // persistir cada 2s como máximo

interface LogEntry {
  ts: string;
  tsMs: number;
  level: LogLevel;
  action: string;
  source: string;
  page: string;
  details: Record<string, unknown> | null;
  build: string;
  session: string;
}

// Buffer en memoria: las escrituras NO tocan localStorage en caliente (evita bloquear
// el hilo principal de la tablet). Un timer diferido persiste el buffer completo.
const localBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLocalBuffer();
  }, LOG_FLUSH_INTERVAL);
}

function flushLocalBuffer() {
  try {
    if (typeof window === "undefined" || localBuffer.length === 0) return;
    const batch = localBuffer.splice(0, localBuffer.length);
    let existing: LogEntry[] = [];
    try {
      const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
      if (raw) existing = JSON.parse(raw);
    } catch {
      existing = [];
    }
    const merged = existing.concat(batch);
    // FIFO: conservar las últimas LOG_MAX_ENTRIES
    const trimmed = merged.length > LOG_MAX_ENTRIES ? merged.slice(merged.length - LOG_MAX_ENTRIES) : merged;
    try {
      window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Cuota llena o modo privado: reintentar con menos entradas
      try {
        const smaller = trimmed.slice(trimmed.length - 500);
        window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(smaller));
      } catch {
        // noop
      }
    }
  } catch {
    // noop
  }
}

/** Lee los logs locales (más recientes primero). */
export function getLocalLogs(limit = 500): LogEntry[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    const all: LogEntry[] = JSON.parse(raw);
    return all.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/** Descarga los logs locales como JSON (diagnóstico). */
export function exportLocalLogs() {
  try {
    if (typeof window === "undefined") return;
    flushLocalBuffer();
    const all = getLocalLogs(LOG_MAX_ENTRIES);
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reygas-log-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // noop
  }
}

/** Registra un evento interno del sistema (buffer local, NUNCA rompe el flujo). */
export function logSystemEvent(
  level: LogLevel,
  action: string,
  details?: Record<string, unknown> | null,
  source?: string
) {
  try {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      tsMs: Date.now(),
      level,
      action,
      source: source || currentLogPage || (typeof window !== "undefined" ? window.location.pathname : "server"),
      page: currentLogPage || (typeof window !== "undefined" ? window.location.pathname : "server"),
      details: details || null,
      build: BUILD_SHA,
      session: logSessionId,
    };
    localBuffer.push(entry);
    scheduleFlush();
    // Consola local para desarrollo
    if (level === "error") console.error("[syslog]", action, "src:", entry.source, details || "");
    else if (level === "warn") console.warn("[syslog]", action, "src:", entry.source, details || "");
  } catch {
    // noop: el log jamás debe interrumpir el flujo del sistema
  }
}

/** Registra la DURACIÓN de una operación (rendimiento). */
export function logTiming(action: string, start: number, meta?: Record<string, unknown> | null, source?: string) {
  try {
    const end = Date.now();
    logSystemEvent("info", action, {
      ...(meta || {}),
      durationMs: Math.max(0, end - start),
    }, source || "timing");
  } catch {
    // noop
  }
}

/** Igual que logTiming pero alerta (warn) si supera un umbral en ms. */
export function logTimingThreshold(action: string, start: number, warnMs: number, meta?: Record<string, unknown> | null, source?: string) {
  try {
    const end = Date.now();
    const durationMs = Math.max(0, end - start);
    logSystemEvent(durationMs >= warnMs ? "warn" : "info", action, {
      ...(meta || {}),
      durationMs,
      thresholdMs: warnMs,
      slow: durationMs >= warnMs,
    }, source || "timing");
  } catch {
    // noop
  }
}

/** Captura errores globales no controlados (window.onerror + unhandledrejection). */
export function initGlobalErrorLogger() {
  if (typeof window === "undefined") return;
  try {
    window.addEventListener("error", (e) => {
      logSystemEvent("error", "window.onerror", {
        message: e.message || String(e.error || ""),
        file: e.filename || "",
        line: e.lineno,
        col: e.colno,
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = (e as PromiseRejectionEvent)?.reason;
      logSystemEvent("error", "unhandledrejection", {
        reason: typeof reason === "string" ? reason : reason instanceof Error ? reason.message : JSON.stringify(reason || "").slice(0, 400),
      });
    });
  } catch {
    // noop
  }
}

/** Conveniencia: log de entrada a cada acción clave del flujo. */
export function logFlow(level: LogLevel, action: string, details?: Record<string, unknown> | null, source?: string) {
  logSystemEvent(level, action, details, source);
}

/** Log de estado del canal Realtime (para diagnóstico desde Configuración → Ver Log) */
export function logRealtimeStatus(status: string, detail?: Record<string, unknown>) {
  logSystemEvent(
    status === "SUBSCRIBED" ? "info" : "warn",
    "realtime.channel.status",
    { status, ...detail },
    "realtime"
  );
}

// =====================================================================
// CAPTURA TOTAL LOCAL ("que el log capte TODO, cada acción y cada respuesta").
// TODO queda en localStorage del dispositivo — NUNCA se sube a la nube.
// =====================================================================
let networkLogInstalled = false;

/** Instala la captura global SIN OMITIR NADA:
 *  (1) errores globales (window.error + unhandledrejection);
 *  (2) CADA CLIC de la web (ui.click: tag, id, name, texto, clase, ruta del elemento);
 *  (3) CADA CAMBIO de campo/select (ui.change: tag, id, name, valor);
 *  (4) interceptor de red: CADA petición a Supabase REST (método, ruta, status, ms).
 *  Todo queda en localStorage del dispositivo — NUNCA se sube a la nube. */
export function initGlobalLogging() {
  if (typeof window === "undefined" || networkLogInstalled) return;
  networkLogInstalled = true;
  try {
    initGlobalErrorLogger();

    // ---- CLICS: todo lo que el usuario toca/pulsa (también en tablet: tap = click) ----
    const compactTarget = (t: any): Record<string, unknown> | null => {
      try {
        if (!t || !t.tagName) return null;
        const info: Record<string, unknown> = { tag: String(t.tagName).toLowerCase() };
        if (t.id) info.id = String(t.id).slice(0, 40);
        const nameAttr = t.getAttribute && t.getAttribute("name");
        if (nameAttr) info.name = String(nameAttr).slice(0, 40);
        const txt = (t.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        if (txt) info.txt = txt;
        const cls = typeof t.className === "string" ? t.className.split(/\s+/).slice(0, 3).join(".") : "";
        if (cls) info.cls = cls.slice(0, 40);
        // ruta: sube hasta 3 ancestros (tag + #id) para ubicar el elemento
        let path = "";
        let el: HTMLElement | null = t;
        for (let i = 0; i < 3 && el; i++) {
          const seg = String(el.tagName || "").toLowerCase() + (el.id ? "#" + String(el.id).slice(0, 20) : "");
          path = path ? seg + ">" + path : seg;
          el = el.parentElement;
        }
        info.path = path.slice(0, 70);
        return info;
      } catch {
        return null;
      }
    };
    document.addEventListener("click", (e: Event) => {
      const info = compactTarget(e.target);
      if (info) logSystemEvent("info", "ui.click", info, "ui");
    }, true);

    // ---- CAMBIOS de campos (input/select/textarea): qué se escribió/se eligió ----
    document.addEventListener("change", (e: Event) => {
      try {
        const t = e.target as any;
        if (!t || !t.tagName) return;
        const info: Record<string, unknown> = { tag: String(t.tagName).toLowerCase() };
        if (t.id) info.id = String(t.id).slice(0, 40);
        const nameAttr = t.getAttribute && t.getAttribute("name");
        if (nameAttr) info.name = String(nameAttr).slice(0, 40);
        if (t.type) info.type = String(t.type).slice(0, 20);
        let val = t.value;
        if (typeof val === "string") val = val.trim().slice(0, 60);
        if (val !== undefined && val !== "") info.val = val;
        logSystemEvent("info", "ui.change", info, "ui");
      } catch {}
    }, true);

    // ---- RED: peticiones/respuestas a Supabase REST ----
    // ANTI-RUIDO (el log se inundaba con los GET de sync y empujaba fuera las acciones
    // reales): se registra (a) TODOS los writes (POST/PATCH/DELETE = cada guardado),
    // (b) TODOS los errores (status != 200 o fallo de red), y (c) los GET lentos
    // (>1500ms). Los GET 200 rápidos de sync se omiten: no son acciones ni errores.
    const origFetch = window.fetch.bind(window);
    (window as any).fetch = (input: any, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (!url.includes("supabase.co/rest/v1")) return origFetch(input, init);
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const start = Date.now();
        return origFetch(input, init)
          .then((res: Response) => {
            try {
              const ms = Date.now() - start;
              const isWrite = method !== "GET";
              const isErr = res.status >= 400;
              const slow = ms > 1500;
              if (isWrite || isErr || slow) {
                logSystemEvent(isErr ? "warn" : "info", isWrite ? "net.write" : "net.rest", {
                  m: method,
                  p: url.split("/rest/v1/")[1] ? url.split("/rest/v1/")[1].split("?")[0].slice(0, 70) : url.slice(0, 70),
                  s: res.status,
                  ms,
                }, "net");
              }
            } catch {}
            return res;
          })
          .catch((err: any) => {
            try {
              logSystemEvent("warn", "net.rest.error", {
                m: method,
                p: url.split("/rest/v1/")[1] ? url.split("/rest/v1/")[1].split("?")[0].slice(0, 70) : url.slice(0, 70),
                err: err instanceof Error ? err.message : String(err),
                ms: Date.now() - start,
              }, "net");
            } catch {}
            throw err;
          });
      } catch {
        return origFetch(input, init);
      }
    };
  } catch {
    // noop: el log jamás debe romper el sistema
  }
}
