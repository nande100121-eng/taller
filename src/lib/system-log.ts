// =====================================================================
// SISTEMA DE LOG INTERNO DE PROCESOS (diagnóstico de bugs)
// Guarda cada evento/flujo en Supabase (site_content, category system_logs)
// SIN mostrar nada en la interfaz web. Se consulta directo en la base:
//   select * from site_content where key like 'syslog_%' order by key desc
// =====================================================================
import { supabase } from "@/lib/supabase/client";

export type LogLevel = "info" | "warn" | "error";

let logSessionId = "sess_" + Date.now().toString(36);

// Versión del build (Vercel inyecta el SHA del commit; en dev queda "dev")
export const BUILD_SHA =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || "dev").slice(0, 8)
    : "dev";

/** Registra un evento interno del sistema (fire-and-forget, NUNCA rompe el flujo). */
export function logSystemEvent(level: LogLevel, action: string, details?: Record<string, unknown> | null) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      level,
      action,
      details: details || null,
      url: typeof window !== "undefined" ? window.location.pathname + window.location.search : "server",
      build: BUILD_SHA,
      session: logSessionId,
    };
    // Consola local para desarrollo
    if (level === "error") console.error("[syslog]", action, details || "");
    else if (level === "warn") console.warn("[syslog]", action, details || "");
    // Persistencia en la nube (resiliente: si falla, no afecta al flujo)
    const key = "syslog_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    supabase
      .from("site_content")
      .upsert({
        section_key: key,
        key,
        value: JSON.stringify(entry),
        content: entry,
        category: "system_logs",
        updated_at: new Date().toISOString(),
      })
      .then((r: { error?: { message?: string } | null }) => {
        if (r.error) console.warn("syslog save:", r.error.message);
      });
  } catch {
    // noop: el log jamás debe interrumpir el flujo del sistema
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
export function logFlow(level: LogLevel, action: string, details?: Record<string, unknown> | null) {
  logSystemEvent(level, action, details);
}
