"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);

  useEffect(() => {
    // 1. Initial sync on app mount
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
