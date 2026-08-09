"use client";

import React from "react";
import { PublicHome } from "@/components/home/public-home";
import { Globe, Eye, ExternalLink } from "lucide-react";

export default function AdminCmsExactPage() {
  return (
    <div className="space-y-2">
      {/* Top Status Bar */}
      <div className="sticky top-0 z-40 glass-panel border-b border-white/10 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white">
              Estación #1: Editor Visual de la Web Pública (100% Idéntico con Encabezado)
            </h1>
            <p className="text-[10px] text-gray-400">
              Haga clic sobre el lápiz de cualquier elemento (Encabezado, Hero, Badges, Tarifas, Footer) para modificarlo en línea.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Ver Web Pública Real</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Render the EXACT same Public Website Component with Forced Inline Edit Icons */}
      <PublicHome forceEditing={true} />
    </div>
  );
}
