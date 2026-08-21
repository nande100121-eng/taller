"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { getPeruDateString } from "@/lib/utils/date-utils";

interface MiniDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  className?: string;
  label?: string;
  variant?: "default" | "compact";
  align?: "left" | "right";
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DAYS_OF_WEEK = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

export default function MiniDatePicker({
  value,
  onChange,
  className = "",
  label,
  variant = "default",
  align = "left",
}: MiniDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  // Calcula la posición del popup en pantalla (fixed) para que NO sea recortado por
  // contenedores con overflow-hidden (bug Portería: el calendario se abría cortado/detrás
  // de la siguiente card porque su popup absolute quedaba dentro del overflow-hidden).
  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popupW = 256; // w-64
    let left = rect.left;
    if (align === "right") left = rect.right - popupW;
    // Evitar desbordar el viewport a la derecha
    if (left + popupW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popupW - 8);
    setPopupPos({ top: rect.bottom + 8, left });
    // Recalcular al hacer scroll/resize mientras está abierto
    const recompute = () => {
      const r = el.getBoundingClientRect();
      let l = r.left;
      if (align === "right") l = r.right - popupW;
      if (l + popupW > window.innerWidth - 8) l = Math.max(8, window.innerWidth - popupW - 8);
      setPopupPos({ top: r.bottom + 8, left: l });
    };
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [isOpen, align]);

  // Parse current value or default today
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  // Sync view when value changes from external navigation
  useEffect(() => {
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Generate days in month
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = getPeruDateString();

  const handleSelectDay = (day: number) => {
    const m = (viewMonth + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    const dateStr = `${viewYear}-${m}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const peruToday = getPeruDateString();
    const d = new Date(`${peruToday}T00:00:00`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    onChange(peruToday);
    setIsOpen(false);
  };

  // Format display text
  const formattedDisplay = React.useMemo(() => {
    if (!value) return "Seleccionar fecha";
    const d = new Date(`${value}T00:00:00`);
    if (isNaN(d.getTime())) return value;
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }, [value]);

  const isFullWidth = className.includes("w-full");

  return (
    <div ref={containerRef} className={`relative ${isFullWidth ? "w-full block" : "inline-block"} ${className}`}>
      {label && <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">{label}</label>}

      {variant === "compact" ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-transparent hover:bg-white/10 rounded-lg text-xs text-white font-mono font-bold hover:text-amber-300 transition-all cursor-pointer group"
          title="Abrir calendario"
        >
          <CalendarIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
          <span>{formattedDisplay}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3.5 py-2 bg-reygas-surface border border-white/15 hover:border-amber-400 focus:border-amber-400 rounded-xl text-xs text-white font-mono font-bold transition-all shadow-md group ${
            isFullWidth ? "w-full justify-between" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            <span>{formattedDisplay}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-400 transition-colors shrink-0 rotate-90" />
        </button>
      )}

      {/* Mini Calendar Popup - FIXED en pantalla para escapar de overflow-hidden */}
      {isOpen && popupPos && (
        <div
          style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
          className="p-4 bg-reygas-dark border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-xl w-64 animate-fadeIn text-xs"
        >
          {/* Calendar Header: Month + Year + Arrows */}
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-white uppercase text-xs tracking-wider">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] font-bold text-gray-400">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <span key={`empty-${idx}`} className="p-1" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const m = (viewMonth + 1).toString().padStart(2, "0");
              const d = day.toString().padStart(2, "0");
              const dateStr = `${viewYear}-${m}-${d}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-amber-500 text-black shadow font-black scale-105"
                      : isToday
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/40"
                      : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer with Today Shortcut */}
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors"
            >
              📅 Ir a Hoy
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
