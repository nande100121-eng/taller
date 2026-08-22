import { createClient } from "@supabase/supabase-js";
import { logSystemEvent } from "@/lib/system-log";

// =====================================================================
// SUPABASE AUTH (usuario@reygas.com) — vinculado al Roster y Permisos.
// Cliente DEDICADO con storage propio ("reygas-auth-session"): la sesión
// de Auth NUNCA se adjunta al cliente de datos principal (client.ts sigue
// siendo 100% anon), así un login real en auth.users no rompe las consultas
// REST si hubiera RLS sin políticas para el rol "authenticated".
// =====================================================================

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zpbwgodtjxhdecgsosxv.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndnb2R0anhoZGVjZ3Nvc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzE5NjIsImV4cCI6MjEwMTgwNzk2Mn0.c81Bo6tmArG0Voq2EPmaQEoWk2jB6a6VuDVzHVv4H1M";

export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "reygas-auth-session",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Convierte un identificador en el email de Supabase Auth: "jreyes" -> "jreyes@reygas.com". */
export function composeAuthEmail(identifier: string): string {
  const clean = String(identifier || "").trim().toLowerCase();
  if (!clean) return "";
  if (clean.includes("@")) return clean;
  return clean + "@reygas.com";
}

/** Parte local de un email: "jreyes@reygas.com" -> "jreyes". */
export function authLocalPart(email: string): string {
  return String(email || "").trim().toLowerCase().split("@")[0] || "";
}

export interface ProvisionResult {
  ok: boolean;
  status: "linked" | "created" | "password_mismatch" | "skipped" | "error";
  message?: string;
}

/**
 * Vincula un personal del roster con Supabase Auth (email = usuario@reygas.com,
 * contraseña = la del roster). Idempotente:
 *  - si el auth user ya existe con la MISMA contraseña -> "linked" (no hace nada);
 *  - si no existe -> lo crea con signUp ("created"; si el proyecto tiene
 *    "Confirm email" ON quedará sin confirmar y el login cae al fallback roster);
 *  - si existe con OTRA contraseña -> "password_mismatch" (ajustar en dashboard,
 *    el cliente no puede sobrescribir la contraseña de otro usuario).
 */
export async function provisionSupabaseAuthUser(tech: {
  username?: string;
  password?: string;
  full_name?: string;
}): Promise<ProvisionResult> {
  try {
    const username = String(tech.username || "").trim();
    const password = String(tech.password || "").trim();
    if (!username || !password) {
      return { ok: false, status: "skipped", message: "Sin usuario o contraseña en el roster" };
    }
    const email = composeAuthEmail(username);

    // 1. ¿Ya vinculado con la misma contraseña?
    const check = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (!check.error) {
      await supabaseAuth.auth.signOut().catch(() => {});
      return { ok: true, status: "linked" };
    }

    // 2. Crear en auth.users (signUp anon; con "Confirm email" ON requiere confirmación)
    const res = await supabaseAuth.auth.signUp({ email, password });
    await supabaseAuth.auth.signOut().catch(() => {});
    if (res.error) {
      const msg = String(res.error.message || "");
      if (/already registered/i.test(msg)) {
        logSystemEvent("warn", "auth.provision.password_mismatch", { email, usuario: username }, "services:auth");
        return { ok: false, status: "password_mismatch", message: "El usuario ya existe en Supabase Auth con otra contraseña (ajustar en el dashboard)." };
      }
      logSystemEvent("warn", "auth.provision.error", { email, usuario: username, err: msg }, "services:auth");
      return { ok: false, status: "error", message: msg };
    }
    logSystemEvent("info", "auth.provision.created", { email, usuario: username }, "services:auth");
    return { ok: true, status: "created", message: "Creado en Supabase Auth (si 'Confirm email' está activo, requiere confirmación)." };
  } catch (err) {
    logSystemEvent("error", "auth.provision.exception", { err: err instanceof Error ? err.message : String(err) }, "services:auth");
    return { ok: false, status: "error" };
  }
}

/** Verifica credenciales contra Supabase Auth con email = usuario@reygas.com. */
export async function verifySupabaseAuthLogin(
  identifier: string,
  password: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const email = composeAuthEmail(identifier);
    if (!email || !String(password || "").trim()) return { ok: false, error: "empty" };
    const res = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (res.error) return { ok: false, error: String(res.error.message || "invalid") };
    return { ok: true, email };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cierra la sesión de Supabase Auth (storage propio; no toca el cliente de datos). */
export async function signOutSupabaseAuth(): Promise<void> {
  try {
    await supabaseAuth.auth.signOut();
  } catch {
    /* noop */
  }
}