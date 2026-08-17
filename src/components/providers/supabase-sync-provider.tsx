"use client";

import React, { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";
import { getSharedRealtimeChannel } from "@/lib/supabase/services";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);
  const syncServicesOnly = useAppStore((state) => state.syncServicesOnly);
  const syncCertificationsOnly = useAppStore((state) => state.syncCertificationsOnly);
  const syncInventoryOnly = useAppStore((state) => state.syncInventoryOnly);
  const syncTechniciansOnly = useAppStore((state) => state.syncTechniciansOnly);
  const syncScheduleOnly = useAppStore((state) => state.syncScheduleOnly);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFullSync = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      syncFromSupabase();
    }, 400);
  };

  useEffect(() => {
    // 1. Cloud-First initial sync from Supabase on app mount
    syncFromSupabase();

    // 2. Instant Cross-Tab Sync in the same browser (0ms delay between tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "reygas-autogas-storage" || !e.key) {
        useAppStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Window focus sync with 15s throttle protection (prevents request storms on tablet tab switching)
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
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        syncServicesOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, () => {
        syncServicesOnly();
        syncTechniciansOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certifications" }, () => {
        syncCertificationsOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => {
        syncTechniciansOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        syncInventoryOnly();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_records" }, () => {
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
      syncFromSupabase();
    }, 90000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(dbChannel);
    };
  }, [syncFromSupabase, syncServicesOnly, syncCertificationsOnly, syncInventoryOnly, syncTechniciansOnly, syncScheduleOnly]);

  return <>{children}</>;
};
