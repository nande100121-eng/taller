"use client";

import React from "react";
import { WorkshopDailyReportView } from "@/components/DailyWorkshopReportModal";

export default function WorkshopReportsCenterPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <WorkshopDailyReportView isModal={false} initialTab="caja" />
    </div>
  );
}
