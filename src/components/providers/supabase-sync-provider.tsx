"use client";

import React, { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";
import {
  getSharedRealtimeChannel,
  CLIENT_SESSION_ID,
  getLastLocalMutationTime,
  hasRecentLocalMutation,
} from "@/lib/supabase/services";
import { logTiming } from "@/lib/system-log";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);
  const syncOperationalOnly = useAppStore((state) => state.syncOperationalOnly);
  const syncServicesOnly = useAppStore((state) => state.syncServicesOnly);
  const syncCertificationsOnly = useAppStore((state) => state.syncCertificationsOnly);
  const syncInventoryOnly = useAppStore((state) => state.syncInventoryOnly);
  const syncTechniciansOnly = useAppStore((state) => state.syncTechniciansOnly);
  const syncScheduleOnly = useAppStore((state) => state.syncScheduleOnly);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce corto para el sync operativo ligero (realtime entre pestañas)
  const opTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedOperationalSync = () => {
    if (opTimerRef.current) clearTimeout(opTimerRef.current);
    opTimerRef.current = setTimeout(() => {
      if (Date.now() - getLastLocalMutationTime() < 800) return;
      const startMs = Date.now();
      syncOperationalOnly().then(() => {
        // TIMING LATENCIA REALTIME -> STORE: cuánto tardó desde que llegó la señal
        // (WebSocket) hasta que el store quedó actualizado (cards pintadas).
        try {
          const rt = (window as any).__REYGAS_LAST_REALTIME;
          logTiming("realtime.sync.duration", startMs, {
            totalMs: Date.now() - startMs,
            desdeLlegadaMs: rt ? Date.now() - rt.at : undefined,
            cloudToArrivalMs: rt?.fromCloudMs,
            eventType: rt?.eventType || "",
          }, "realtime:sync-operativo");
        } catch {
          // noop
        }
      });
    }, 120);
  };

  // Apply a single site_content section into the store without a full refetch
  const applySiteContentSection = (section: string, row: any) => {
    let value: any = row?.value !== undefined ? row.value : row?.content;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        // keep raw string
      }
    }
    if (value === undefined) return;
    useAppStore.setState((state: any) => ({
      siteContent: {
        ...state.siteContent,
        [section]: value,
      },
    }));
  };

  const debouncedFullSync = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      // Avoid overwriting local optimistic changes while the user is actively saving
      if (Date.now() - getLastLocalMutationTime() < 3500) {
        return;
      }
      syncFromSupabase();
    }, 400);
  };

  useEffect(() => {
    // 1. Cloud-First initial sync from Supabase on app mount
    // Carga escalonada (skill de optimización): primero los catálogos ligeros
    // que pintan la UI en <50ms, y en paralelo el sync completo en segundo plano
    // para los datos de operación (workOrders, invoices, vehicles, inventory).
    syncTechniciansOnly();
    syncServicesOnly();
    syncCertificationsOnly();
    syncScheduleOnly();
    syncFromSupabase();

    // 2. Window focus sync with 2s throttle protection: al volver a una pestaña se
    //    recarga el sync OPERATIVO ligero de inmediato (la card debe aparecer ya).
    //    El sync completo de 30s no debe bloquear la card visible (bug realtime).
    let lastFocusTime = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime > 2000) {
        lastFocusTime = now;
        debouncedOperationalSync();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    // 4. PRINCIPAL CROSS-DEVICE: Supabase Realtime Broadcast listener. La señal llega por
    //    WebSocket desde CUALQUIER tablet/dispositivo conectado y dispara el sync ligero
    //    (workOrders/invoices/vehicles) casi al instante en todas las estaciones.
    const broadcastChannel = getSharedRealtimeChannel();
    broadcastChannel.on("broadcast", { event: "db_update" }, (msg: any) => {
      // Ignore broadcast messages originating from this same browser window
      if (msg.payload?.senderId === CLIENT_SESSION_ID) {
        return;
      }
      // TIMING LATENCIA REALTIME: marca cuándo llegó la señal desde otra tablet/dispositivo
      // (WebSocket). El sync que dispara se mide al completarse (debouncedOperationalSync).
      const arrivalMs = Date.now();
      const sentAt = Number(msg.payload?.timestamp || 0);
      (window as any).__REYGAS_LAST_REALTIME = {
        at: arrivalMs,
        sentAt,
        fromCloudMs: sentAt > 0 ? Math.max(0, arrivalMs - sentAt) : undefined,
        eventType: msg.payload?.eventType || "",
      };
      const eventType = msg.payload?.eventType || "";
      if (eventType.includes("service")) {
        syncServicesOnly();
      } else if (eventType.includes("cert")) {
        syncCertificationsOnly();
      } else if (eventType.includes("inventory")) {
        syncInventoryOnly();
      } else if (eventType.includes("technician")) {
        syncTechniciansOnly();
      } else if (eventType.includes("schedule")) {
        syncScheduleOnly();
      } else if (eventType.includes("tool_loans")) {
        debouncedFullSync();
      } else if (eventType.includes("attendance")) {
        debouncedFullSync();
      } else {
        // Operativo (work_orders/invoices/vehicles): sync ligero inmediato
        debouncedOperationalSync();
      }
    });

    // 4b. EXTRA local (mismo navegador): BroadcastChannel nativo como refuerzo para
    //     pestañas del mismo navegador (no se suspende con el tab-throttling). El
    //     realtime ENTRE DISPOSITIVOS lo garantiza el canal 4 (Supabase Realtime).
    let localBC: BroadcastChannel | null = null;
    try {
      localBC = (window as any).__REYGAS_TAB_BC ||
        ((window as any).__REYGAS_TAB_BC = new BroadcastChannel("reygas-tab-sync"));
      const bcInstance = localBC as BroadcastChannel;
      bcInstance.onmessage = (e: MessageEvent) => {
        const msg = e.data || {};
        if (msg.senderId === CLIENT_SESSION_ID) return;
        if (Date.now() - getLastLocalMutationTime() < 800) return;
        const et = String(msg.eventType || "");
        if (et.includes("service")) syncServicesOnly();
        else if (et.includes("cert")) syncCertificationsOnly();
        else if (et.includes("inventory")) syncInventoryOnly();
        else if (et.includes("technician")) syncTechniciansOnly();
        else if (et.includes("schedule")) syncScheduleOnly();
        else debouncedOperationalSync();
      };
    } catch {
      // BroadcastChannel no disponible: sigue el canal Realtime de Supabase
    }

    // 5. Supabase Postgres changes listener on site_content and core tables (ultra-fast targeted handlers)
    const dbChannel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, (payload: any) => {
        // Ignore events originating from this same browser window
        if (Date.now() - getLastLocalMutationTime() < 3500) return;
        const row = payload.new || {};
        const section = row.section_key || row.key;
        if (!section) {
          // Fallback: unknown section, do a targeted services/technicians sync (previous behavior)
          if (hasRecentLocalMutation("workshopServices") || hasRecentLocalMutation("services") || hasRecentLocalMutation("technicians")) return;
          syncServicesOnly();
          syncTechniciansOnly();
          return;
        }
        if (hasRecentLocalMutation(section)) return;
        applySiteContentSection(section, row);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certifications" }, () => {
        if (hasRecentLocalMutation("certifications")) return;
        syncCertificationsOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => {
        if (hasRecentLocalMutation("technicians")) return;
        syncTechniciansOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        if (hasRecentLocalMutation("inventory")) return;
        syncInventoryOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_records" }, () => {
        if (hasRecentLocalMutation("schedule")) return;
        syncScheduleOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, (payload: any) => {
        // CROSS-DEVICE: la fila llega por WebSocket de Supabase desde CUALQUIER dispositivo.
        // Se aplica DIRECTA al store (<100ms) y el sync operativo completa el resto.
        if (payload?.eventType === "DELETE") {
          const oldId = payload?.old?.id;
          if (oldId) useAppStore.getState().removeDeletedWorkOrderLocal(oldId);
        } else if (payload?.new?.id) {
          useAppStore.getState().applyRemoteWorkOrderLocal(payload.new);
        }
        debouncedOperationalSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        debouncedOperationalSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, (payload: any) => {
        // CROSS-DEVICE: factura creada/editada en otra tablet se aplica directa.
        if (payload?.eventType === "DELETE") {
          const oldId = payload?.old?.id;
          if (oldId) useAppStore.getState().removeDeletedInvoiceLocal(oldId);
        } else if (payload?.new?.id) {
          useAppStore.getState().applyRemoteInvoiceLocal(payload.new);
        }
        debouncedOperationalSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tool_loans" }, () => {
        if (hasRecentLocalMutation("toolLoans")) return;
        debouncedFullSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => {
        if (hasRecentLocalMutation("attendanceLogs")) return;
        debouncedFullSync();
      })
      .subscribe();

    // 6. Background safety heartbeat sync (every 5 min) for resilient tablet networking.
    // El ERP tiene 41k+ órdenes y 118k+ facturas: re-descargar todo cada 90s satura la
    // red de la tablet. Los cambios en tiempo real llegan por broadcast/postgres_changes
    // (throttled a 30s en el store) y este heartbeat solo es la red de seguridad.
    const interval = setInterval(() => {
      if (Date.now() - getLastLocalMutationTime() < 5000) return;
      syncFromSupabase();
    }, 300000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(interval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (opTimerRef.current) clearTimeout(opTimerRef.current);
      supabase.removeChannel(dbChannel);
    };
  }, [syncFromSupabase, syncOperationalOnly, syncServicesOnly, syncCertificationsOnly, syncInventoryOnly, syncTechniciansOnly, syncScheduleOnly]);

  return <>{children}</>;
};
