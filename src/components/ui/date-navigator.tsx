"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import MiniDatePicker from "./mini-date-picker";
import { getPeruDateString } from "@/lib/utils/date-utils";

// =============================================================================
// NAVEGADOR DE FECHA UNIVERSAL (estándar ReyGas)
// Patrón único para TODA sección con filtro/navegación de calendario:
//   [◀ Día Anterior] [📅 fecha a seleccionar] [Día Siguiente ▶] [Hoy]
// Definido por el usuario según Portería & Patio. Usar SIEMPRE en filtros de
// fecha; NO usar en campos de formulario (esos van con input type="date").
// Ver skill reygas-ui-design-system (sección Calendario).
// =============================================================================

interface DateNavigatorProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  /** Clase extra para el contenedor (opcional) */
  className?: string;
  /** Etiqueta opcional junto al selector (ej. "Fecha:") */
  label?: string;
  variant?: "default" | "compact";
  align?: "left" | "right";
}

export default function DateNavigator({
  value,
  onChange,
  className = "",
  label,
  variant = "default",
  align = "left",
}: DateNavigatorProps) {
  const changeDate = (days: number) => {
    const d = new Date(value + "T12:00:00");
    if (isNaN(d.getTime())) {
      onChange(getPeruDateString());
      return;
    }
    d.setDate(d.getDate() + days);
    onChange(getPeruDateString(d));
  };

  const isToday = value === getPeruDateString();

  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-1 bg-black/60 rounded-2xl border border-white/15 shadow-inner ${className}`}>
      {label && (
        <span className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
          {label}
        </span>
      )}

      {/* Día Anterior */}
      <button
        type="button"
        onClick={() => changeDate(-1)}
        className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
        title="Día Anterior (-1 Día)"
      >
        <ChevronLeft className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="hidden sm:inline">Día Anterior</span>
      </button>

      {/* Fecha a seleccionar (calendario) */}
      <MiniDatePicker value={value} onChange={onChange} variant={variant} align={align} />

      {/* Día Siguiente */}
      <button
        type="button"
        onClick={() => changeDate(1)}
        className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
        title="Día Siguiente (+1 Día)"
      >
        <span className="hidden sm:inline">Día Siguiente</span>
        <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
      </button>

      {/* Hoy */}
      <button
        type="button"
        onClick={() => onChange(getPeruDateString())}
        className={`px-3 py-2 rounded-xl text-xs font-black transition-transform active:scale-95 ${isToday
          ? "bg-white/10 text-gray-400 border border-white/10"
          : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 hover:scale-105"
          }`}
      >
        Hoy
      </button>
    </div>
  );
}
