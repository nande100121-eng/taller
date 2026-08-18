"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";

export function Toast() {
    const notification = useAppStore((s) => s.notification);
    const notify = useAppStore((s) => s.notify);
    const clearNotification = useAppStore((s) => s.clearNotification);

    useEffect(() => {
        if (!notification) return;
        const timer = setTimeout(() => clearNotification(), 4000);
        return () => clearTimeout(timer);
    }, [notification, clearNotification]);

    // Escucha el evento central de "guardado en la nube" emitido por las
    // funciones saveSupabase* (skill de congruencia Supabase). Muestra el toast
    // de confirmación SIN modificar el flujo de las páginas.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            const message = detail?.message || "Guardado en la nube ✓";
            notify("success", message);
        };
        window.addEventListener("reygas:cloud-saved", handler);
        return () => window.removeEventListener("reygas:cloud-saved", handler);
    }, [notify]);

    if (!notification) return null;

    const styles = {
        success: "border-emerald-500/50 bg-emerald-950/90 text-emerald-100",
        error: "border-red-500/50 bg-red-950/90 text-red-100",
        info: "border-amber-500/50 bg-amber-950/90 text-amber-100",
        warning: "border-amber-500/50 bg-amber-950/90 text-amber-100",
    } as const;

    const Icon = notification.type === "success" ? CheckCircle2 : notification.type === "error" ? AlertCircle : Info;
    const iconColor =
        notification.type === "success" ? "text-emerald-400" : notification.type === "error" ? "text-red-400" : "text-amber-400";

    return (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] animate-fadeIn pointer-events-none">
            <div
                role="status"
                className={`glass-panel rounded-2xl border px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl flex items-start gap-3 pointer-events-auto ${styles[notification.type]}`}
            >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
                <p className="text-xs font-bold leading-snug flex-1 pt-0.5">{notification.message}</p>
                <button
                    type="button"
                    onClick={clearNotification}
                    className="shrink-0 p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors touch-target"
                    aria-label="Cerrar notificación"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
