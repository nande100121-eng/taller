"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { supabase } from "@/lib/supabase/client";

export const SupabaseSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncFromSupabase = useAppStore((state) => state.syncFromSupabase);

  useEffect(() => {
    // 1. Immediate sync on page load / mount
    syncFromSupabase();

    // 2. Lightweight 3.5s background interval polling for instant cross-device synchronization
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 3500);

    // 3. Supabase Realtime WebSocket listener for immediate instant push events
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => {
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
