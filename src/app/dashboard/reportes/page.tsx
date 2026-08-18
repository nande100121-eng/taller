"use client";

import React from "react";
import dynamic from "next/dynamic";

const WorkshopDailyReportView = dynamic(
  () => import("@/components/DailyWorkshopReportModal").then((m) => m.WorkshopDailyReportView),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 bg-white/10 rounded-lg w-64" />
        <div className="h-72 bg-white/5 rounded-xl" />
        <div className="h-40 bg-white/5 rounded-xl" />
      </div>
    ),
  }
);

export default function WorkshopReportsCenterPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <WorkshopDailyReportView isModal={false} initialTab="caja" />
    </div>
  );
}
