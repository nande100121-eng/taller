"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);

  useEffect(() => {
    // 1. Immediate sync on page load / mount
    syncFromSupabase();

    // 2. Background interval polling (30s interval, skipped while user is actively typing or tab is hidden)
    const interval = setInterval(() => {
      if (typeof document !== "undefined") {
        if (document.hidden) return;
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
          return; // Skip sync while user is filling out forms or typing search query
        }
      }
      syncFromSupabase();
    }, 30000);

    // 3. Supabase Realtime WebSocket listener for immediate instant push events
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => {
          if (typeof document !== "undefined") {
            const activeTag = document.activeElement?.tagName;
            if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
          }
          syncFromSupabase();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [syncFromSupabase]);

  return <>{children}</>;
};
