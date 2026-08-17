"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeSvgProps {
  value: string;
  className?: string;
  width?: number;
  height?: number;
  margin?: number;
  fontSize?: number;
  displayValue?: boolean;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  className = "max-w-full h-auto",
  width = 1.8,
  height = 42,
  margin = 8,
  fontSize = 13,
  displayValue = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        const cleanValue = value.trim() || "SKU-000";
        JsBarcode(svgRef.current, cleanValue, {
          format: "CODE128",
          width,
          height,
          displayValue,
          fontSize,
          font: "monospace",
          textMargin: 3,
          margin,
          background: "#ffffff",
          lineColor: "#000000",
          valid: (valid) => {
            if (!valid) console.warn("JsBarcode invalid code for Code128:", cleanValue);
          },
        });

        // Ensure crisp vector rendering for optical/laser barcode readers (SEISA YHD-8200L, Honeywell, Zebra, etc.)
        if (svgRef.current) {
          svgRef.current.setAttribute("shape-rendering", "crispEdges");
          svgRef.current.setAttribute("data-barcode-value", cleanValue);
        }
      } catch (err) {
        console.error("JsBarcode render error:", err);
      }
    }
  }, [value, width, height, margin, fontSize, displayValue]);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0.5 rounded">
      <svg ref={svgRef} className={className} data-barcode-value={value} />
    </div>
  );
};
