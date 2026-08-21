"use client";

// ============================================================================
// ReyGasTooltip — Ventana informativa / tooltip con el diseño corporativo ReyGas.
//
// Reemplaza el tooltip NATIVO del navegador (title="...", gris y ajeno al diseño)
// por un popup oscuro glassmórfico acorde a la web. Se renderiza con createPortal
// al body + position:fixed (mismo patrón que el mini-date-picker) para que NUNCA
// quede recortado detrás de contenedores con overflow/scroll (tablas, paneles,
// modales).
//
// Uso estándar:
//   <ReyGasTooltip label={<div className="space-y-1">...info...</div>} className="cursor-help">
//     <span className="...">monto / placa / dato</span>
//   </ReyGasTooltip>
//
// - label   : contenido de la ventana informativa (ReactNode). Si es falsy NO se muestra.
// - side    : "top" (por defecto, encima del elemento) | "bottom" (debajo).
// - maxW    : ancho máximo en px (por defecto 260).
// - className: clases extra del elemento envolvente (ej. "cursor-help").
//
// Comportamiento:
// - Desktop: hover abre, salir cierra (pointer-events-none en el popup: nunca
//   bloquea clicks).
// - Tablet/táctil: un TAP abre y otro tap cierra (stopPropagation para no
//   disparar el click de la fila/padre).
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ReyGasTooltipProps {
  label?: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  maxW?: number;
  className?: string;
}

export default function ReyGasTooltip({
  label,
  children,
  side = "top",
  maxW = 260,
  className = "",
}: ReyGasTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const compute = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const tipW = Math.min(maxW, window.innerWidth - 16);
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(window.innerWidth - tipW - 8, left));
    const top = side === "top" ? rect.top - 8 : rect.bottom + 8;
    return { top, left };
  }, [side, maxW]);

  const show = useCallback(() => {
    if (!label) return;
    const p = compute();
    if (p) setPos(p);
  }, [label, compute]);

  const hide = useCallback(() => setPos(null), []);

  // Reposiciona al scrollear/redimensionar (el popup vive en un portal al body).
  useEffect(() => {
    if (!pos) return;
    const recompute = () => {
      const p = compute();
      if (p) setPos(p);
    };
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [pos, compute]);

  return (
    <>
      <span
        ref={anchorRef}
        className={"inline-flex items-center " + className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) hide();
          else show();
        }}
      >
        {children}
      </span>
      {pos && label && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl glass-panel bg-reygas-dark/95 border border-white/15 shadow-2xl shadow-black/60 px-2.5 py-1.5"
          style={{
            top: pos.top,
            left: pos.left,
            maxWidth: maxW,
            transform: side === "top" ? "translateY(-100%)" : undefined,
          }}
        >
          {label}
        </div>,
        document.body
      )}
    </>
  );
}
