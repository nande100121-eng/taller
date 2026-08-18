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

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);
  const syncServicesOnly = useAppStore((state) => state.syncServicesOnly);
  const syncCertificationsOnly = useAppStore((state) => state.syncCertificationsOnly);
  const syncInventoryOnly = useAppStore((state) => state.syncInventoryOnly);
  const syncTechniciansOnly = useAppStore((state) => state.syncTechniciansOnly);
  const syncScheduleOnly = useAppStore((state) => state.syncScheduleOnly);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    // 2. Window focus sync with 15s throttle protection (prevents request storms on tablet tab switching)
    let lastFocusTime = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime > 15000) {
        lastFocusTime = now;
        debouncedFullSync();
      }
    };
    window.addEventListener("focus", handleFocus);

    // 4. Supabase Realtime Broadcast channel listener (instant push across all devices/tablets)
    const broadcastChannel = getSharedRealtimeChannel();
    broadcastChannel.on("broadcast", { event: "db_update" }, (msg: any) => {
      // Ignore broadcast messages originating from this same browser window
      if (msg.payload?.senderId === CLIENT_SESSION_ID) {
        return;
      }
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
      } else {
        debouncedFullSync();
      }
    });

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
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => {
        debouncedFullSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        debouncedFullSync();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        debouncedFullSync();
      })
      .subscribe();

    // 6. Background safety heartbeat sync (every 90s) for resilient tablet networking without draining CPU/battery
    const interval = setInterval(() => {
      if (Date.now() - getLastLocalMutationTime() < 5000) return;
      syncFromSupabase();
    }, 90000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(dbChannel);
    };
  }, [syncFromSupabase, syncServicesOnly, syncCertificationsOnly, syncInventoryOnly, syncTechniciansOnly, syncScheduleOnly]);

  return <>{children}</>;
};
