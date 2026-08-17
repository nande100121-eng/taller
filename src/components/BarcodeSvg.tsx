"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeSvgProps {
  value: string;
  className?: string;
  width?: number;
  height?: number;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  className = "w-full h-10",
  width = 1.4,
  height = 36,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value.trim() || "SKU-000", {
          format: "CODE128",
          width,
          height,
          displayValue: false,
          margin: 2,
          background: "transparent",
          lineColor: "#000000",
        });
      } catch (err) {
        console.error("JsBarcode render error:", err);
      }
    }
  }, [value, width, height]);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg ref={svgRef} className={className} />
    </div>
  );
};
