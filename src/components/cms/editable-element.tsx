"use client";

import React, { useState } from "react";
import { Edit3, Check, X } from "lucide-react";

interface EditableTextProps {
  value: string | number;
  onSave: (newValue: string) => void;
  isEditingEnabled?: boolean;
  multiline?: boolean;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "p" | "span" | "div";
}

export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onSave,
  isEditingEnabled = true,
  multiline = false,
  className = "",
  tag: Tag = "span",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value));

  if (!isEditingEnabled) {
    return <Tag className={className}>{value}</Tag>;
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(String(value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1 relative z-30">
        {multiline ? (
          <textarea
            rows={2}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="px-2 py-1 bg-reygas-dark border-2 border-reygas-red rounded-lg text-white font-bold text-sm focus:outline-none w-full"
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="px-2 py-1 bg-reygas-dark border-2 border-reygas-red rounded-lg text-white font-bold text-sm focus:outline-none"
            autoFocus
          />
        )}
        <button
          onClick={handleSave}
          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow shrink-0"
          title="Guardar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded shadow shrink-0"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <Tag className={`group relative inline-flex items-center gap-1 cursor-pointer ${className}`}>
      <span>{value}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setTempValue(String(value));
          setIsEditing(true);
        }}
        className="opacity-70 group-hover:opacity-100 p-1 bg-reygas-red/30 hover:bg-reygas-red text-reygas-red hover:text-white rounded transition-all shrink-0 ml-1"
        title="Editar elemento en línea"
      >
        <Edit3 className="w-3 h-3" />
      </span>
    </Tag>
  );
};
