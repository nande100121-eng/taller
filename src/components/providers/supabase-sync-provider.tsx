"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";
import { getLocalWorkshopCache } from "@/lib/storage/indexed-db";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);

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
    const broadcastChannel = supabase
      .channel("global-erp-sync")
      .on("broadcast", { event: "db_update" }, () => {
        syncFromSupabase();
      })
      .subscribe();

    // 5. Supabase Postgres changes listener on site_content and core tables
    const dbChannel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certifications" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => {
        syncFromSupabase();
      })
      .subscribe();

    // 6. Background safety heartbeat sync (every 15s) for resilient tablet networking
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 15000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [syncFromSupabase]);

  return <>{children}</>;
};
