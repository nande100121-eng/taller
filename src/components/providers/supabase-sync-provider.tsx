"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);

  useEffect(() => {
    // 1. Initial sync on app mount
    syncFromSupabase();

    // 2. Window focus sync (when switching between apps / devices)
    const handleFocus = () => syncFromSupabase();
    window.addEventListener("focus", handleFocus);

    // 3. Supabase Realtime Broadcast channel listener (instant push across devices)
    const broadcastChannel = supabase
      .channel("global-erp-sync")
      .on("broadcast", { event: "db_update" }, () => {
        syncFromSupabase();
      })
      .subscribe();

    // 4. Supabase Postgres changes listener
    const dbChannel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        syncFromSupabase();
      })
      .subscribe();

    // 5. Automatic Heartbeat Polling every 5 seconds for cross-device sync resilience
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
      clearInterval(interval);
    };
  }, [syncFromSupabase]);

  return <>{children}</>;
};
