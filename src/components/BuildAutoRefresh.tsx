"use client";

import React from "react";
import { BUILD_SHA, logSystemEvent } from "@/lib/system-log";

// Cada 3 min + al volver a la pestaña: compara el build local con el desplegado
// (/api/build-info). Si hay una versión nueva (otra tablet/PC ya recibió el deploy),
// avisa y RECARGA SOLO la página: así TODOS los dispositivos corren el mismo build
// y los builds viejos dejan de pisar datos con estructuras/merge distintos.
const CHECK_INTERVAL_MS = 3 * 60 * 1000;
const RELOAD_DELAY_MS = 6000;

export default function BuildAutoRefresh() {
  const [stale, setStale] = React.useState(false);
  const [remoteSha, setRemoteSha] = React.useState("");

  React.useEffect(() => {
    let disposed = false;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const res = await fetch("/api/build-info", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const sha = String(data?.sha || "").trim();
        if (!sha || !BUILD_SHA || sha === BUILD_SHA) return;
        if (disposed) return;
        logSystemEvent("warn", "app.build.stale", {
          local: BUILD_SHA,
          remote: sha,
          reloadIn: RELOAD_DELAY_MS,
        }, "web:BuildAutoRefresh");
        setRemoteSha(sha);
        setStale(true);
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          try { window.location.reload(); } catch { /* noop */ }
        }, RELOAD_DELAY_MS);
      } catch {
        // Sin red: no molestar, se reintenta en el próximo intervalo.
      }
    };

    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => { check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    return () => {
      disposed = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/60 bg-black/85 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-md">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
        <div className="text-sm">
          <p className="font-bold text-amber-300">
            🆕 Nueva versión ({remoteSha}) disponible
          </p>
          <p className="text-xs text-zinc-400">
            Tu build es {BUILD_SHA}. Recargando automáticamente…
          </p>
        </div>
        <button
          onClick={() => { try { window.location.reload(); } catch { /* noop */ } }}
          className="ml-2 shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
        >
          Recargar ahora
        </button>
      </div>
    </div>
  );
}
