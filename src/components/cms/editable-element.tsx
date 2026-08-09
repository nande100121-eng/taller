"use client";

import React, { useRef, useState, useEffect } from "react";
import { Edit3, Check } from "lucide-react";

interface EditableTextProps {
  value: string | number;
  onSave: (newValue: string) => void;
  isEditingEnabled?: boolean;
  multiline?: boolean;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
}

export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onSave,
  isEditingEnabled = true,
  multiline = false,
  className = "",
  tag: Tag = "span",
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Synchronize internal text content if external value changes
  useEffect(() => {
    if (ref.current && !isFocused) {
      ref.current.innerText = String(value);
    }
  }, [value, isFocused]);

  if (!isEditingEnabled) {
    return <Tag className={className}>{value}</Tag>;
  }

  const handleBlur = () => {
    setIsFocused(false);
    if (ref.current) {
      const newText = ref.current.innerText.trim();
      if (newText !== String(value)) {
        onSave(newText);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 1500);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <Tag className={`relative inline-group ${className}`}>
      <span
        ref={ref}
        contentEditable={isEditingEnabled}
        suppressContentEditableWarning={true}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`outline-none transition-all duration-200 rounded px-1 cursor-text ${
          isFocused
            ? "ring-2 ring-reygas-red bg-reygas-red/10 shadow-lg text-white"
            : "hover:outline-dashed hover:outline-2 hover:outline-reygas-red/70 hover:bg-reygas-red/5"
        }`}
        title="Haz clic directamente sobre la letra para borrar o añadir texto sin desordenar la web"
      >
        {value}
      </span>

      {/* Editing Hint Icon Badge */}
      <span
        onClick={() => {
          ref.current?.focus();
        }}
        className={`inline-flex items-center justify-center p-1 rounded-full transition-all shrink-0 ml-1.5 cursor-pointer ${
          isFocused
            ? "bg-reygas-red text-white scale-110 shadow-md"
            : "opacity-40 hover:opacity-100 bg-reygas-surface/80 text-reygas-red hover:bg-reygas-red hover:text-white"
        }`}
        title="Editar texto directamente"
      >
        {savedSuccess ? (
          <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
        ) : (
          <Edit3 className="w-3 h-3" />
        )}
      </span>
    </Tag>
  );
};
