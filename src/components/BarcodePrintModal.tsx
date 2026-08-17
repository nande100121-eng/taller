"use client";

import React, { useState, useMemo } from "react";
import { InventoryItem } from "@/lib/store/app-store";
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
  Sparkles
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
  // Configuration states
  const [selectionMode, setSelectionMode] = useState<"all" | "selected" | "letter">("all");
  const [selectedLetter, setSelectedLetter] = useState<string>("TODAS");
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [productImageUrl, setProductImageUrl] = useState<string>("/logo.jpg");
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const totalSheets = printPages.length;
  const currentPage = printPages[previewPageIndex] || printPages[0];

  return (
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
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black">
                  8 Etiquetas por Hoja A4 • Por Letra
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Imprime planchas ordenadas por letra inicial del producto, con espacio para foto, marca, serie y código de barras SKU.
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
          
          {/* LEFT: Controls & Configuration */}
          <div className="lg:col-span-5 space-y-4">
            
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
                    Abecedario de Productos (Letras A - Z):
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold">
                    {selectedLetter === "TODAS" ? "Viendo Todas las Letras" : `Filtrando por Letra "${selectedLetter}"`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1 bg-black/40 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode("letter");
                      setSelectedLetter("TODAS");
                      setPreviewPageIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
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
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-black border transition-all flex items-center gap-1 ${
                          isSelected
                            ? "bg-amber-500 text-black border-amber-400 shadow-md ring-2 ring-amber-300"
                            : count > 0
                            ? "bg-white/10 text-white border-white/20 hover:bg-amber-500/20 hover:border-amber-400"
                            : "bg-white/[0.02] text-gray-600 border-white/5 hover:text-gray-400"
                        }`}
                        title={count > 0 ? `${count} productos con letra ${ltr}` : `Sin productos con letra ${ltr}`}
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

            {/* 2. Imagen / Foto del Producto */}
            <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-white/10 space-y-3">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                2. Imagen / Foto en la Etiqueta
              </label>

              <div>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-black/60 border border-white/15 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={productImageUrl}
                      alt="Producto"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
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
                    <p className="text-[10px] text-gray-400">
                      Aparecerá en el recuadro izquierdo de cada una de las 8 etiquetas.
                    </p>
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

            {/* 3. Resumen y Regla de Separación por Letra */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-200">
                <span>Total de etiquetas calculadas:</span>
                <strong className="text-white font-mono text-sm">{baseItems.length} etiquetas</strong>
              </div>
              <div className="flex justify-between items-center text-gray-200">
                <span>Hojas A4 a imprimir (8 por hoja):</span>
                <strong className="text-amber-400 font-mono text-sm">{totalSheets} hojas</strong>
              </div>
              <p className="text-[11px] text-gray-300 pt-1 border-t border-white/10 leading-relaxed">
                ✓ <strong>Regla Estricta:</strong> Cada letra inicial (A, B, C...) empieza en una hoja nueva. Si una letra tiene 3 productos, la siguiente letra empezará automáticamente en la siguiente hoja A4.
              </p>
            </div>
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
                  
                  {/* 2 Columns x 4 Rows = 8 Labels Grid with Exact Height Allocation */}
                  <div className="grid grid-cols-2 grid-rows-4 gap-2 h-full">
                    {currentPage.items.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="border border-dashed border-gray-400 p-1.5 rounded-lg bg-white flex gap-1.5 items-center overflow-hidden shadow-sm h-full box-border"
                      >
                        {/* Espacio para Imagen del Producto */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 border border-gray-300 rounded bg-gray-50 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                          {productImageUrl ? (
                            <img
                              src={productImageUrl}
                              alt={item.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400" />
                          )}
                        </div>

                        {/* Información del Producto y Código de Barras */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                          <div>
                            {/* Nombre del Producto */}
                            <h4 className="text-[8.5px] font-black text-black leading-tight line-clamp-2 uppercase">
                              {item.name}
                            </h4>
                            {/* Marca y Serie */}
                            <p className="text-[7px] text-gray-600 font-semibold truncate mt-0.5">
                              {item.brand && <span>Marca: <strong className="text-black">{item.brand}</strong></span>}
                              {item.serial_number && item.serial_number !== "-" && (
                                <span> • S/N: <strong className="font-mono text-black">{item.serial_number}</strong></span>
                              )}
                            </p>
                          </div>

                          {/* Barcode SVG + SKU */}
                          <div className="mt-0.5 flex flex-col items-center">
                            <BarcodeSvg
                              value={item.sku_barcode}
                              className="w-full h-5"
                              width={1.1}
                              height={20}
                            />
                            <span className="text-[7.5px] font-mono font-black text-black tracking-wider">
                              {item.sku_barcode}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

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
                  No hay productos registrados que inicien con la letra "{selectedLetter}".
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-3.5 border-t border-white/10 shrink-0">
          <div className="text-xs text-gray-400">
            <span className="text-white font-bold">{baseItems.length}</span> etiquetas en{" "}
            <span className="text-amber-400 font-bold">{totalSheets}</span> hojas A4.
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

      {/* ========================================================================= */}
      {/* HIDDEN IN SCREEN - VISIBLE IN @media print FOR DIRECT A4 PRINTING */}
      {/* ========================================================================= */}
      <div id="barcode-print-sheets" className="hidden">
        {printPages.map((page, pIdx) => (
          <div key={`sheet-${pIdx}`} className="barcode-print-page">
            {/* 2 x 4 Grid = 8 Labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "repeat(4, 1fr)",
                gap: "3.5mm",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              {page.items.map((item, itemIdx) => (
                <div
                  key={`print-item-${item.id}-${itemIdx}`}
                  className="barcode-card-print"
                  style={{
                    padding: "3.5mm",
                    borderRadius: "3mm",
                    display: "flex",
                    alignItems: "center",
                    gap: "3mm",
                    overflow: "hidden",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Espacio para Imagen del Producto */}
                  <div
                    style={{
                      width: "28mm",
                      height: "28mm",
                      border: "1px solid #dddddd",
                      borderRadius: "2mm",
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
                    {productImageUrl && (
                      <img
                        src={productImageUrl}
                        alt={item.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    )}
                  </div>

                  {/* Información del Producto y Código de Barras */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    <div>
                      {/* Nombre del Producto */}
                      <div
                        style={{
                          fontSize: "9.5pt",
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
                          fontSize: "8pt",
                          color: "#444444",
                          fontWeight: "600",
                        }}
                      >
                        {item.brand && <span>Marca: <strong style={{ color: "#000000" }}>{item.brand}</strong></span>}
                        {item.serial_number && item.serial_number !== "-" && (
                          <span> • S/N: <strong style={{ fontFamily: "monospace", color: "#000000" }}>{item.serial_number}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Barcode SVG + SKU */}
                    <div style={{ textAlign: "center", marginTop: "1.5mm" }}>
                      <BarcodeSvg
                        value={item.sku_barcode}
                        className="w-full"
                        width={1.5}
                        height={34}
                      />
                      <div
                        style={{
                          fontSize: "8.5pt",
                          fontWeight: "900",
                          fontFamily: "monospace",
                          letterSpacing: "0.5px",
                          marginTop: "0.5mm",
                          color: "#000000",
                        }}
                      >
                        {item.sku_barcode}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

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
      </div>
    </div>
  );
};
