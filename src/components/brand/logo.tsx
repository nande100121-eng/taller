"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { EditableText } from "@/components/cms/editable-element";
import { Edit3, Check, X } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  isEditingEnabled?: boolean;
}

export const ReyGasLogo: React.FC<LogoProps> = ({
  className = "",
  size = "md",
  showText = true,
  isEditingEnabled = false,
}) => {
  const { siteContent, updateSiteContent } = useAppStore();
  const navbar = siteContent.navbar || {
    brand_name: "REYGAS AUTOGAS EQUIPMENT",
    logo_image: "/logo.jpg",
  };

  const [editingImage, setEditingImage] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(navbar.logo_image || "/logo.jpg");

  const sizeMap = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
    xl: "w-28 h-28",
  };

  const handleSaveImage = () => {
    updateSiteContent("navbar", { logo_image: tempImageUrl });
    setEditingImage(false);
  };

  return (
    <div className={`flex items-center gap-3 relative group ${className}`}>
      {/* Logo Image Circle */}
      <div className={`relative ${sizeMap[size]} rounded-full overflow-hidden border-2 border-reygas-red shadow-lg shadow-reygas-red/20 bg-white flex items-center justify-center p-0.5 shrink-0`}>
        <img
          src={navbar.logo_image || "/logo.jpg"}
          alt="ReyGas Autogas Equipment Logo"
          className="w-full h-full object-cover rounded-full"
        />

        {isEditingEnabled && (
          <button
            onClick={() => setEditingImage(!editingImage)}
            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
            title="Cambiar URL de la imagen del logo"
          >
            <Edit3 className="w-4 h-4 text-reygas-red" />
          </button>
        )}
      </div>

      {/* Inline Input Popup for Logo Image URL */}
      {editingImage && (
        <div className="absolute top-12 left-0 z-50 p-3 glass-panel border border-reygas-red rounded-xl shadow-2xl flex items-center gap-2 bg-reygas-dark">
          <input
            type="text"
            placeholder="URL imagen logo..."
            value={tempImageUrl}
            onChange={(e) => setTempImageUrl(e.target.value)}
            className="px-2 py-1 bg-reygas-card border border-white/20 rounded text-xs text-white w-48"
          />
          <button
            onClick={handleSaveImage}
            className="p-1 bg-emerald-600 text-white rounded"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingImage(false)}
            className="p-1 bg-gray-800 text-gray-300 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-extrabold tracking-wider text-white uppercase font-sans">
            <EditableText
              value={navbar.brand_name || "REYGAS AUTOGAS EQUIPMENT"}
              isEditingEnabled={isEditingEnabled}
              onSave={(val) => updateSiteContent("navbar", { brand_name: val })}
            />
          </span>
        </div>
      )}
    </div>
  );
};
