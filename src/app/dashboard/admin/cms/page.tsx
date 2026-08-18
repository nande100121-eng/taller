"use client";

import React, { useState } from "react";
import { PublicHome } from "@/components/home/public-home";
import { useAppStore } from "@/lib/store/app-store";
import { Globe, Eye, ExternalLink, Save, RefreshCw, CheckCircle2 } from "lucide-react";

export default function AdminCmsExactPage() {
  const { saveAllToSupabase, syncFromSupabase, notify } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveAll = async () => {
    setSaving(true);
    const ok = await saveAllToSupabase();
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleReload = async () => {
    await syncFromSupabase();
    notify("success", "¡Datos recargados exitosamente desde Supabase PostgreSQL!");
  };

  return (
    <div className="space-y-2 relative">
      {/* Toast Banner */}
      {savedSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white font-extrabold rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce border-2 border-white/20">
          <CheckCircle2 className="w-5 h-5" />
          <span>¡Todos los cambios han sido guardados exitosamente en Supabase PostgreSQL!</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="sticky top-0 z-40 glass-panel border-b border-white/10 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white">
              Estación #1: Editor Visual CMS de la Web Pública
            </h1>
            <p className="text-[10px] text-gray-400">
              Haga clic sobre el lápiz de cualquier elemento para modificarlo y luego presione Guardar Cambios.
            </p>
          </div>
        </div>

        {/* Master Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-emerald-600/30 transition-transform hover:scale-105 border border-emerald-400/40"
          >
            <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Guardando en Supabase..." : "💾 GUARDAR CAMBIOS EN SUPABASE"}</span>
          </button>

          <button
            onClick={handleReload}
            className="px-3.5 py-2 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-white/10"
            title="Recargar los últimos datos guardados en Supabase"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Recargar Supabase</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Ver Web Pública</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Render the EXACT same Public Website Component with Forced Inline Edit Icons */}
      <PublicHome forceEditing={true} />
    </div>
  );
}
