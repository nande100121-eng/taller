"use client";

import React, { useState, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import JsBarcode from "jsbarcode";
import { InventoryItem, useAppStore } from "@/lib/store/app-store";
import { BarcodeSvg } from "./BarcodeSvg";
import {
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  Upload,
  Eye,
  Package,
  Layers,
  Sparkles,
  Camera,
  Trash2,
  Search,
  CheckCircle2,
  ImageIcon,
  Sliders
} from "lucide-react";

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
  selectedRowIds?: string[];
}

const ALL_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "#"
];

// Helper to get normalized first letter (e.g. Á -> A)
const getNormalizedFirstLetter = (name: string): string => {
  const clean = (name || "").trim();
  if (!clean) return "#";
  const first = clean.charAt(0).toUpperCase();
  const normalized = first.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /^[A-Z]$/.test(normalized) ? normalized : "#";
};

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  inventoryItems,
  selectedRowIds = [],
}) => {
  const updateInventoryItem = useAppStore((s) => s.updateInventoryItem);

  // Configuration states
  const [activeTab, setActiveTab] = useState<"settings" | "photos">("settings");
  const [selectionMode, setSelectionMode] = useState<"all" | "selected" | "letter">("all");
  const [selectedLetter, setSelectedLetter] = useState<string>("TODAS");
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [productImageUrl, setProductImageUrl] = useState<string>("/logo.jpg");
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);
  const [searchPhotoQuery, setSearchPhotoQuery] = useState<string>("");
  const [photoFilterStatus, setPhotoFilterStatus] = useState<"all" | "with_photo" | "without_photo">("all");
  // Laser scanner calibration state
  const [barcodeWidth, setBarcodeWidth] = useState<number>(1.9);
  const [barcodeHeight, setBarcodeHeight] = useState<number>(42);

  // Count products for each letter of the alphabet
  const letterCounts = useMemo(() => {
    const counts: { [letter: string]: number } = {};
    inventoryItems.forEach((item) => {
      const letter = getNormalizedFirstLetter(item.name);
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [inventoryItems]);

  // Base list of items to consider based on user filter
  const baseItems = useMemo(() => {
    let items = [...inventoryItems];

    if (selectionMode === "selected" && selectedRowIds.length > 0) {
      items = items.filter((i) => selectedRowIds.includes(i.id));
    } else if (selectionMode === "letter" && selectedLetter !== "TODAS") {
      items = items.filter(
        (i) => getNormalizedFirstLetter(i.name) === selectedLetter
      );
    }

    // Multiply by copiesPerItem
    if (copiesPerItem > 1) {
      const multiplied: InventoryItem[] = [];
      items.forEach((item) => {
        for (let c = 0; c < copiesPerItem; c++) {
          multiplied.push(item);
        }
      });
      return multiplied;
    }

    return items;
  }, [inventoryItems, selectionMode, selectedRowIds, selectedLetter, copiesPerItem]);

  // STRICT LETTER PARTITIONING (8 PRODUCTS PER PAGE, NEVER MIX LETTERS ON SAME PAGE)
  const printPages = useMemo(() => {
    // 1. Sort items alphabetically by name
    const sorted = [...baseItems].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );

    // 2. Group items by their starting letter
    const letterGroups: { [letter: string]: InventoryItem[] } = {};
    sorted.forEach((item) => {
      const letter = getNormalizedFirstLetter(item.name);
      if (!letterGroups[letter]) {
        letterGroups[letter] = [];
      }
      letterGroups[letter].push(item);
    });

    // 3. Partition each letter group into pages of up to 8 products
    const pages: {
      letter: string;
      pageInLetter: number;
      totalLetterPages: number;
      globalPageIndex: number;
      items: InventoryItem[];
    }[] = [];

    const sortedLetters = Object.keys(letterGroups).sort();
    let globalIndex = 1;

    sortedLetters.forEach((letter) => {
      const itemsInLetter = letterGroups[letter];
      const totalPagesForThisLetter = Math.ceil(itemsInLetter.length / 8) || 1;

      for (let p = 0; p < totalPagesForThisLetter; p++) {
        const pageItems = itemsInLetter.slice(p * 8, (p + 1) * 8);
        pages.push({
          letter,
          pageInLetter: p + 1,
          totalLetterPages: totalPagesForThisLetter,
          globalPageIndex: globalIndex++,
          items: pageItems,
        });
      }
    });

    return pages;
  }, [baseItems]);

  // Handle global/default fallback image upload
  const handleGlobalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setProductImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle specific product image upload
  const handleSpecificProductImageUpload = (itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateInventoryItem(itemId, { image_url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle removing specific product image
  const handleRemoveProductImage = (itemId: string) => {
    updateInventoryItem(itemId, { image_url: undefined });
  };

  // Filter products for the dedicated photo management tab
  const filteredPhotoItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      const matchesQuery =
        !searchPhotoQuery.trim() ||
        item.name.toLowerCase().includes(searchPhotoQuery.toLowerCase()) ||
        item.sku_barcode.toLowerCase().includes(searchPhotoQuery.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchPhotoQuery.toLowerCase()));

      if (!matchesQuery) return false;

      if (photoFilterStatus === "with_photo") {
        return !!item.image_url;
      }
      if (photoFilterStatus === "without_photo") {
        return !item.image_url;
      }
      return true;
    });
  }, [inventoryItems, searchPhotoQuery, photoFilterStatus]);

  const itemsWithCustomPhotoCount = useMemo(() => {
    return inventoryItems.filter((i) => !!i.image_url).length;
  }, [inventoryItems]);

  const handlePrint = () => {
    // Ensure the print container exists at body level before printing
    const el = document.getElementById("barcode-print-sheets");
    if (el) {
      // Force all child SVGs to re-render (some browsers skip invisible SVGs)
      el.querySelectorAll("svg").forEach((svg) => {
        const val = svg.getAttribute("data-barcode-value");
        if (val && typeof JsBarcode !== "undefined") {
          try {
            JsBarcode(svg, val.trim() || "SKU-000", {
              format: "CODE128",
              width: barcodeWidth,
              height: barcodeHeight,
              displayValue: false,
              margin: 10,
              background: "#ffffff",
              lineColor: "#000000",
            });
          } catch {}
        }
      });
    }
    setTimeout(() => window.print(), 150);
  };

  if (!isOpen) return null;

  const totalSheets = printPages.length;
  const currentPage = printPages[previewPageIndex] || printPages[0];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* Modal Container with ReyGas Dark Glassmorphic Design */}
      <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-4 sm:p-6 max-w-6xl w-full shadow-2xl shadow-black/95 space-y-5 my-auto max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>Impresión de Etiquetas con Código de Barras</span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black">
                  Optimizado para Pistola Láser SEISA YHD-8200L
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                8 Etiquetas por hoja A4, fotos individuales por producto, código Code128 de alta definición con zona de silencio (Quiet Zone).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Columns (Controls on Left, A4 Page Preview on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1 pr-1">
          
          {/* LEFT: Controls & Tabs */}
          <div className="lg:col-span-5 space-y-3 flex flex-col">
            
            {/* Tab Navigation Switcher */}
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "settings"
                    ? "bg-amber-500 text-black font-black shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Ajustes & Letras</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("photos")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${
                  activeTab === "photos"
                    ? "bg-amber-500 text-black font-black shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Fotos por Producto</span>
                {itemsWithCustomPhotoCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === "photos" ? "bg-black text-amber-300" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {itemsWithCustomPhotoCount}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: SETTINGS & LETTERS */}
            {activeTab === "settings" && (
              <div className="space-y-3.5 overflow-y-auto pr-1">
                {/* 1. Selection Mode */}
                <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-white/10 space-y-3">
                  <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                    1. Modo de Selección
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode("all");
                        setSelectedLetter("TODAS");
                        setPreviewPageIndex(0);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                        selectionMode === "all"
                          ? "bg-amber-500 text-black border-amber-400 font-black shadow"
                          : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Todos ({inventoryItems.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode("selected");
                        setSelectedLetter("TODAS");
                        setPreviewPageIndex(0);
                      }}
                      disabled={selectedRowIds.length === 0}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectionMode === "selected"
                          ? "bg-amber-500 text-black border-amber-400 font-black shadow"
                          : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Marcados ({selectedRowIds.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode("letter");
                        setPreviewPageIndex(0);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                        selectionMode === "letter"
                          ? "bg-amber-500 text-black border-amber-400 font-black shadow"
                          : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Filtrar Letra
                    </button>
                  </div>

                  {/* Selector Completo del Abecedario (A a Z) */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black text-gray-300 uppercase tracking-wider">
                        Abecedario de Productos (A - Z):
                      </label>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        {selectedLetter === "TODAS" ? "Todas las Letras" : `Letra "${selectedLetter}"`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 bg-black/40 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode("letter");
                          setSelectedLetter("TODAS");
                          setPreviewPageIndex(0);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          selectedLetter === "TODAS"
                            ? "bg-emerald-600 text-white border-emerald-500 font-black shadow"
                            : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                        }`}
                      >
                        Todas ({inventoryItems.length})
                      </button>

                      {ALL_LETTERS.map((ltr) => {
                        const count = letterCounts[ltr] || 0;
                        const isSelected = selectedLetter === ltr;
                        return (
                          <button
                            key={ltr}
                            type="button"
                            onClick={() => {
                              setSelectionMode("letter");
                              setSelectedLetter(ltr);
                              setPreviewPageIndex(0);
                            }}
                            className={`px-1.5 py-0.5 rounded-lg text-xs font-mono font-black border transition-all flex items-center gap-1 ${
                              isSelected
                                ? "bg-amber-500 text-black border-amber-400 shadow-md ring-2 ring-amber-300"
                                : count > 0
                                ? "bg-white/10 text-white border-white/20 hover:bg-amber-500/20 hover:border-amber-400"
                                : "bg-white/[0.02] text-gray-600 border-white/5 hover:text-gray-400"
                            }`}
                          >
                            <span>{ltr}</span>
                            {count > 0 && (
                              <span
                                className={`text-[9px] px-1 rounded-full ${
                                  isSelected ? "bg-black/80 text-amber-300 font-black" : "bg-black/60 text-emerald-400"
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Calibración de Escaneo Láser (SEISA YHD-8200L) */}
                <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Calibración de Pistola Láser (SEISA)</span>
                    </label>
                    <span className="text-[10px] text-emerald-300 font-mono font-bold">Code128 HQ</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Grosor de Barras:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: "1.7mm", val: 1.7 },
                          { label: "1.9mm (Recomendado)", val: 1.9 },
                          { label: "2.2mm (Grueso)", val: 2.2 },
                        ].map((w) => (
                          <button
                            key={w.val}
                            type="button"
                            onClick={() => setBarcodeWidth(w.val)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                              barcodeWidth === w.val
                                ? "bg-emerald-500 text-black border-emerald-400 font-black"
                                : "bg-white/5 text-gray-400 border-white/10"
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-400 leading-tight">
                      ✓ El código se imprime en fondo blanco puro con zona de silencio de 10px a los lados para lectura instantánea a distancia con láser.
                    </p>
                  </div>
                </div>

                {/* 3. Imagen Global / Logo por Defecto & Copias */}
                <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Foto por Defecto / Logo
                    </label>
                    <span className="text-[10px] text-gray-400">Para productos sin foto propia</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/15 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={productImageUrl}
                        alt="Logo Defecto"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleGlobalImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setProductImageUrl("/logo.jpg")}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-gray-300 border border-white/10"
                        >
                          Logo ReyGas
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Copias por producto */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-xs text-gray-300 font-semibold">Copias por producto:</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 4].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCopiesPerItem(c)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            copiesPerItem === c
                              ? "bg-amber-500 text-black border-amber-400 font-black"
                              : "bg-white/5 text-gray-300 border-white/10"
                          }`}
                        >
                          {c} {c === 1 ? "etiqueta" : "etiquetas"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Resumen */}
                <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-gray-200">
                    <span>Etiquetas calculadas:</span>
                    <strong className="text-white font-mono">{baseItems.length} etiquetas</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-200">
                    <span>Hojas A4 (8 por hoja):</span>
                    <strong className="text-amber-400 font-mono">{totalSheets} hojas</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-200">
                    <span>Productos con foto propia:</span>
                    <strong className="text-emerald-400 font-mono">{itemsWithCustomPhotoCount} de {inventoryItems.length}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DEDICATED PER-PRODUCT PHOTO MANAGER */}
            {activeTab === "photos" && (
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre, SKU o marca..."
                      value={searchPhotoQuery}
                      onChange={(e) => setSearchPhotoQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                    />
                    {searchPhotoQuery && (
                      <button
                        onClick={() => setSearchPhotoQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPhotoFilterStatus("all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        photoFilterStatus === "all"
                          ? "bg-amber-500 text-black border-amber-400 font-black"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Todos ({inventoryItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoFilterStatus("with_photo")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                        photoFilterStatus === "with_photo"
                          ? "bg-emerald-600 text-white border-emerald-500 font-black"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Con Foto ({itemsWithCustomPhotoCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoFilterStatus("without_photo")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        photoFilterStatus === "without_photo"
                          ? "bg-amber-500 text-black border-amber-400 font-black"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Sin Foto ({inventoryItems.length - itemsWithCustomPhotoCount})
                    </button>
                  </div>
                </div>

                {/* Product List with Individual Photo Uploaders */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
                  {filteredPhotoItems.length > 0 ? (
                    filteredPhotoItems.map((item) => {
                      const displayImg = item.image_url || productImageUrl || "/logo.jpg";
                      return (
                        <div
                          key={`photo-item-${item.id}`}
                          className="p-2.5 rounded-xl bg-reygas-surface/90 border border-white/10 hover:border-amber-500/40 transition-colors flex items-center gap-3"
                        >
                          {/* Miniatura de Foto */}
                          <div className="relative group w-12 h-12 rounded-lg bg-black/60 border border-white/15 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            <img
                              src={displayImg}
                              alt={item.name}
                              className="max-h-full max-w-full object-contain"
                            />
                            {item.image_url && (
                              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
                            )}
                          </div>

                          {/* Info del Producto */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                {item.sku_barcode}
                              </span>
                              {item.image_url ? (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                  Foto Propia
                                </span>
                              ) : (
                                <span className="text-[9px] text-gray-500">
                                  (Foto por Defecto)
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-white truncate mt-0.5" title={item.name}>
                              {item.name}
                            </h5>
                            <p className="text-[10px] text-gray-400 truncate">
                              {item.brand ? `Marca: ${item.brand}` : "Sin marca"} • {item.serial_number && item.serial_number !== "-" ? `S/N: ${item.serial_number}` : ""}
                            </p>
                          </div>

                          {/* Botones de Acción de Foto */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="cursor-pointer p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/40 flex items-center gap-1 transition-colors" title="Subir / Cambiar Foto">
                              <Camera className="w-3.5 h-3.5" />
                              <span className="text-[11px] hidden sm:inline">{item.image_url ? "Cambiar" : "Subir"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSpecificProductImageUpload(item.id, file);
                                  e.target.value = "";
                                }}
                                className="hidden"
                              />
                            </label>

                            {item.image_url && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductImage(item.id)}
                                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs border border-red-500/40 transition-colors"
                                title="Quitar foto personalizada y usar logo por defecto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      No se encontraron productos que coincidan con la búsqueda.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: A4 Live Sheet Preview & Page Navigator */}
          <div className="lg:col-span-7 space-y-3 flex flex-col">
            <div className="flex items-center justify-between bg-reygas-surface p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Vista Previa Hoja A4 ({previewPageIndex + 1} de {totalSheets || 1})
                </span>
                {currentPage && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-black/60 text-amber-400 font-mono font-black text-xs border border-amber-500/30">
                    Letra: {currentPage.letter} (Hoja {currentPage.pageInLetter} de {currentPage.totalLetterPages} • {currentPage.items.length} productos)
                  </span>
                )}
              </div>

              {/* Page navigation in preview */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPageIndex((p) => Math.max(0, p - 1))}
                  disabled={previewPageIndex <= 0}
                  className="p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  title="Hoja Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-gray-300 font-bold">
                  {previewPageIndex + 1} / {totalSheets || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPageIndex((p) => Math.min(totalSheets - 1, p + 1))}
                  disabled={previewPageIndex >= totalSheets - 1}
                  className="p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  title="Hoja Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated A4 Printable Sheet (Proportioned Exactly to A4: 1 : 1.414) */}
            <div className="flex-1 bg-gray-300 p-2 sm:p-3 rounded-2xl border border-white/20 overflow-y-auto max-h-[540px] flex items-center justify-center">
              {currentPage && currentPage.items.length > 0 ? (
                <div className="bg-white text-black w-full max-w-[430px] h-[600px] p-2.5 rounded-lg shadow-2xl flex flex-col justify-between border border-gray-400 box-border">
                  
                  {/* 2 Columns x 4 Rows = 8 Labels Grid with High-Readability 2-Tier Layout */}
                  <div className="grid grid-cols-2 grid-rows-4 gap-2 h-full">
                    {currentPage.items.map((item, idx) => {
                      const itemPhoto = item.image_url || productImageUrl || "/logo.jpg";
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className="border border-dashed border-gray-400 p-1.5 rounded-lg bg-white flex flex-col justify-between overflow-hidden shadow-sm h-full box-border group/card relative"
                        >
                          {/* TOP TIER: Image + Product Details */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Espacio para Imagen del Producto con Subida Directa en Hover */}
                            <div className="relative group/img w-10 h-10 border border-gray-300 rounded bg-gray-50 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                              <img
                                src={itemPhoto}
                                alt={item.name}
                                className="max-h-full max-w-full object-contain"
                              />

                              {/* Overlay de Subir Foto en Hover */}
                              <label className="absolute inset-0 bg-black/75 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity text-center p-0.5" title="Cambiar foto">
                                <Camera className="w-3 h-3 text-amber-400" />
                                <span className="text-[6.5px] font-bold text-amber-300">Foto</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleSpecificProductImageUpload(item.id, file);
                                    e.target.value = "";
                                  }}
                                  className="hidden"
                                />
                              </label>

                              {/* Badge Verde si tiene foto propia */}
                              {item.image_url && (
                                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" title="Foto personalizada" />
                              )}
                            </div>

                            {/* Información del Producto */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[8px] font-black text-black leading-tight line-clamp-2 uppercase">
                                {item.name}
                              </h4>
                              <p className="text-[6.5px] text-gray-600 font-semibold truncate mt-0.5">
                                {item.brand && <span>Marca: <strong className="text-black">{item.brand}</strong></span>}
                                {item.serial_number && item.serial_number !== "-" && (
                                  <span> • S/N: <strong className="font-mono text-black">{item.serial_number}</strong></span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* BOTTOM TIER: Full Width Laser-Scannable Barcode */}
                          <div className="bg-white flex flex-col items-center justify-center pt-0.5 border-t border-gray-100">
                            <BarcodeSvg
                              value={item.sku_barcode}
                              className="w-full h-6"
                              width={barcodeWidth}
                              height={32}
                              margin={6}
                            />
                            <span className="text-[7.5px] font-mono font-black text-black tracking-wider leading-none">
                              {item.sku_barcode}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty Placeholders if page has less than 8 items */}
                    {Array.from({ length: 8 - currentPage.items.length }).map((_, emptyIdx) => (
                      <div
                        key={`empty-${emptyIdx}`}
                        className="border border-dotted border-gray-300 p-2 rounded-lg bg-gray-50/60 flex items-center justify-center text-[7.5px] text-gray-400 font-mono h-full"
                      >
                        [ Espacio Disponible ]
                      </div>
                    ))}
                  </div>

                </div>
              ) : (
                <div className="text-center text-gray-600 text-xs font-bold py-12">
                  No hay productos registrados que inicien con la letra &quot;{selectedLetter}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-3.5 border-t border-white/10 shrink-0">
          <div className="text-xs text-gray-400">
            <span className="text-white font-bold">{baseItems.length}</span> etiquetas en{" "}
            <span className="text-amber-400 font-bold">{totalSheets}</span> hojas A4 •{" "}
            <span className="text-emerald-400 font-bold">{itemsWithCustomPhotoCount}</span> con foto propia.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={printPages.length === 0}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>Imprimir {totalSheets} Hojas A4 ({baseItems.length} Etiquetas)</span>
            </button>
          </div>
        </div>

      </div>
    </div>

    {/* ========================================================================= */}
    {/* PRINT-ONLY CONTAINER — Rendered via Portal at <body> level.              */}
    {/* Uses inline style to hide on screen and show only when printing.         */}
    {/* ========================================================================= */}
    {typeof document !== "undefined" &&
      ReactDOM.createPortal(
        <div
          id="barcode-print-sheets"
          style={{
            display: "none",
            visibility: "hidden",
            position: "fixed",
            left: "-9999px",
            top: 0,
          }}
        >
          {printPages.map((page, pIdx) => (
            <div key={`sheet-${pIdx}`} className="barcode-print-page">
              {/* 2 x 4 Grid = 8 Labels */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "repeat(4, 1fr)",
                  gap: "4mm",
                  height: "100%",
                  boxSizing: "border-box",
                }}
              >
                {page.items.map((item, itemIdx) => {
                  const itemPhoto = item.image_url || productImageUrl || "/logo.jpg";
                  return (
                    <div
                      key={`print-item-${item.id}-${itemIdx}`}
                      className="barcode-card-print"
                      style={{
                        padding: "3.5mm 4mm 2.5mm 4mm",
                        borderRadius: "3mm",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        overflow: "hidden",
                        background: "#ffffff",
                        boxSizing: "border-box",
                        border: "1.5px dashed #333333",
                      }}
                    >
                      {/* TOP TIER: Photo + Product Details */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "3mm",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Espacio para Imagen del Producto */}
                        <div
                          style={{
                            width: "22mm",
                            height: "22mm",
                            border: "1px solid #cccccc",
                            borderRadius: "1.5mm",
                            background: "#fafafa",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "1mm",
                            flexShrink: 0,
                            overflow: "hidden",
                            boxSizing: "border-box",
                          }}
                        >
                          {itemPhoto && (
                            <img
                              src={itemPhoto}
                              alt={item.name}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                              }}
                            />
                          )}
                        </div>

                        {/* Información del Producto */}
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                          }}
                        >
                          {/* Nombre del Producto */}
                          <div
                            style={{
                              fontSize: "9pt",
                              fontWeight: "900",
                              color: "#000000",
                              lineHeight: "1.15",
                              textTransform: "uppercase",
                              marginBottom: "1mm",
                            }}
                          >
                            {item.name}
                          </div>

                          {/* Marca y Serie */}
                          <div
                            style={{
                              fontSize: "7.5pt",
                              color: "#444444",
                              fontWeight: "600",
                              lineHeight: "1.2",
                            }}
                          >
                            {item.brand && <span>Marca: <strong style={{ color: "#000000" }}>{item.brand}</strong></span>}
                            {item.serial_number && item.serial_number !== "-" && (
                              <span> • S/N: <strong style={{ fontFamily: "monospace", color: "#000000" }}>{item.serial_number}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM TIER: Full Width High-Contrast Laser Barcode */}
                      <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#ffffff",
                          paddingTop: "1mm",
                          boxSizing: "border-box",
                        }}
                      >
                        <BarcodeSvg
                          value={item.sku_barcode}
                          className="w-full"
                          width={barcodeWidth}
                          height={barcodeHeight}
                          margin={8}
                        />
                        <div
                          style={{
                            fontSize: "8.5pt",
                            fontWeight: "900",
                            fontFamily: "monospace",
                            letterSpacing: "0.5px",
                            color: "#000000",
                            marginTop: "0.5mm",
                            lineHeight: "1",
                          }}
                        >
                          {item.sku_barcode}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty place filler if page has less than 8 items */}
                {Array.from({ length: 8 - page.items.length }).map((_, emptyIdx) => (
                  <div
                    key={`empty-print-${emptyIdx}`}
                    style={{
                      border: "1px dotted #dddddd",
                      borderRadius: "3mm",
                      padding: "3mm",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#cccccc",
                      fontSize: "8pt",
                      fontFamily: "monospace",
                    }}
                  >
                    [ Espacio Libre ]
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};


