"use client";

import React, { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";
import { getLocalWorkshopCache } from "@/lib/storage/indexed-db";
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
    // 0. Immediate 5ms Hydration from IndexedDB on refresh / initial mount
    getLocalWorkshopCache().then((cached) => {
      if (cached) {
        useAppStore.setState((s) => ({
          workOrders: s.workOrders.length > 0 ? s.workOrders : (cached.workOrders || []),
          vehicles: s.vehicles.length > 0 ? s.vehicles : (cached.vehicles || []),
          invoices: s.invoices.length > 0 ? s.invoices : (cached.invoices || []),
          scheduleRecords: s.scheduleRecords.length > 0 ? s.scheduleRecords : (cached.scheduleRecords || []),
          workshopServices: s.workshopServices.length > 0 ? s.workshopServices : (cached.workshopServices || s.workshopServices),
          hasSyncedOnce: true,
        }));
      }
    }).catch(() => {});

    // 1. Initial cloud sync on app mount
    syncFromSupabase();

    // 2. Instant Cross-Tab Sync in the same browser (0ms delay between tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "reygas-autogas-storage" || !e.key) {
        useAppStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Window focus sync (when switching between apps / devices / tablets)
    const handleFocus = () => syncFromSupabase();
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

    // 6. Background safety heartbeat sync (every 30s) for resilient tablet networking
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 30000);

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
