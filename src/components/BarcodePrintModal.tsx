"use client";

import React, { useState, useMemo } from "react";
import { InventoryItem } from "@/lib/store/app-store";
import { BarcodeSvg } from "./BarcodeSvg";
import {
  X,
  Printer,
  Image as ImageIcon,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckSquare,
  Sparkles,
  Upload,
  Eye,
  FileText
} from "lucide-react";

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
  selectedRowIds?: string[];
}

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
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showSerial, setShowSerial] = useState<boolean>(true);
  const [showBrand, setShowBrand] = useState<boolean>(true);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("/logo.jpg");
  const [headerTitle, setHeaderTitle] = useState<string>("REYGAS AUTOGAS");
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);

  // Available initial letters
  const availableLetters = useMemo(() => {
    const setOfLetters = new Set<string>();
    inventoryItems.forEach((item) => {
      const letter = (item.name.trim().charAt(0) || "#").toUpperCase();
      setOfLetters.add(letter);
    });
    return Array.from(setOfLetters).sort();
  }, [inventoryItems]);

  // Base list of items to consider
  const baseItems = useMemo(() => {
    let items = [...inventoryItems];

    if (selectionMode === "selected" && selectedRowIds.length > 0) {
      items = items.filter((i) => selectedRowIds.includes(i.id));
    } else if (selectionMode === "letter" && selectedLetter !== "TODAS") {
      items = items.filter(
        (i) => (i.name.trim().charAt(0) || "#").toUpperCase() === selectedLetter
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
      const letter = (item.name.trim().charAt(0) || "#").toUpperCase();
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

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setCustomLogoUrl(reader.result);
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
      <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-4 sm:p-6 max-w-6xl w-full shadow-2xl shadow-black/95 space-y-6 my-auto max-h-[94vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>Impresión de Códigos de Barra</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  8 por Hoja A4 • Separación por Letra
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Genera planchas de etiquetas listas para imprimir con logotipo, nombre, marca, serie y código de barras SKU.
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
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Selection Mode */}
            <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-white/10 space-y-3">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                1. Selección de Productos a Imprimir
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("all")}
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
                  onClick={() => setSelectionMode("selected")}
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
                  onClick={() => setSelectionMode("letter")}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                    selectionMode === "letter"
                      ? "bg-amber-500 text-black border-amber-400 font-black shadow"
                      : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
                  }`}
                >
                  Por Letra
                </button>
              </div>

              {/* Selector de Letra Específica */}
              {selectionMode === "letter" && (
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-[11px] font-bold text-gray-300 mb-1.5 uppercase">
                    Seleccionar Letra Inicial:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setSelectedLetter("TODAS")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        selectedLetter === "TODAS"
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-white/5 text-gray-400 border-white/10"
                      }`}
                    >
                      Todas
                    </button>
                    {availableLetters.map((ltr) => (
                      <button
                        key={ltr}
                        type="button"
                        onClick={() => setSelectedLetter(ltr)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-black border transition-colors flex items-center justify-center ${
                          selectedLetter === ltr
                            ? "bg-amber-500 text-black border-amber-400 shadow"
                            : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
                        }`}
                      >
                        {ltr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Etiqueta & Logo Configuration */}
            <div className="p-4 rounded-2xl bg-reygas-surface/80 border border-white/10 space-y-3">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                2. Personalización de la Etiqueta
              </label>

              {/* Imagen / Logotipo */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Logo / Imagen de Cabecera:
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/15 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={customLogoUrl}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Subir Imagen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCustomLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setCustomLogoUrl("/logo.jpg")}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-gray-300 border border-white/10"
                      >
                        Logo ReyGas
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Título de Cabecera */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Nombre de Empresa / Encabezado:
                </label>
                <input
                  type="text"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/15 rounded-xl text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
                  placeholder="Ej. REYGAS AUTOGAS"
                />
              </div>

              {/* Checkboxes de Visibilidad */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-white/20 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Precio (S/)</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showBrand}
                    onChange={(e) => setShowBrand(e.target.checked)}
                    className="rounded border-white/20 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Marca</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showSerial}
                    onChange={(e) => setShowSerial(e.target.checked)}
                    className="rounded border-white/20 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Serie / Nro</span>
                </label>
              </div>

              {/* Copias por producto */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs text-gray-300 font-semibold">Copias por cada producto:</span>
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

            {/* 3. Resumen de Impresión y Regla de Separación por Letra */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-200">
                <span>Total de etiquetas:</span>
                <strong className="text-white font-mono text-sm">{baseItems.length} unidades</strong>
              </div>
              <div className="flex justify-between items-center text-gray-200">
                <span>Hojas A4 resultantes (8 por hoja):</span>
                <strong className="text-amber-400 font-mono text-sm">{totalSheets} hojas</strong>
              </div>
              <p className="text-[11px] text-gray-300 pt-1 border-t border-white/10 leading-relaxed">
                ✓ <strong>Regla de Partición Activa:</strong> Cada letra inicial (A, B, C...) comienza en una hoja nueva. Si una letra tiene 3 productos, esa hoja imprimirá solo esos 3 y la siguiente letra iniciará en la siguiente hoja A4.
              </p>
            </div>
          </div>

          {/* RIGHT: A4 Live Sheet Preview & Page Navigator */}
          <div className="lg:col-span-7 space-y-4 flex flex-col">
            <div className="flex items-center justify-between bg-reygas-surface p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Vista Previa Hoja A4 ({previewPageIndex + 1} de {totalSheets || 1})
                </span>
                {currentPage && (
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 text-amber-400 font-mono font-bold text-xs border border-amber-500/30">
                    Letra: {currentPage.letter} ({currentPage.items.length} productos)
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
                <span className="text-xs font-mono text-gray-300">
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

            {/* Simulated A4 Printable Sheet (White Sheet Container for Maximum Contrast) */}
            <div className="flex-1 bg-gray-200 p-3 sm:p-4 rounded-2xl border border-white/20 overflow-y-auto max-h-[500px] flex items-center justify-center">
              {currentPage && currentPage.items.length > 0 ? (
                <div className="bg-white text-black w-full max-w-[500px] aspect-[1/1.414] p-3 rounded-lg shadow-xl flex flex-col justify-between border border-gray-400">
                  {/* Top Sheet Header Indicator */}
                  <div className="flex items-center justify-between border-b border-gray-300 pb-1 mb-2 text-[9px] font-bold text-gray-600 uppercase font-mono">
                    <span>REYGAS • ALMACÉN DE REPUESTOS</span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">
                      SECCIÓN: LETRA {currentPage.letter} ({currentPage.pageInLetter}/{currentPage.totalLetterPages})
                    </span>
                  </div>

                  {/* 2 Columns x 4 Rows = 8 Labels Grid */}
                  <div className="grid grid-cols-2 grid-rows-4 gap-2 flex-1">
                    {currentPage.items.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="border border-dashed border-gray-400 p-1.5 rounded bg-white flex flex-col justify-between overflow-hidden shadow-sm"
                      >
                        {/* Label Header */}
                        <div className="flex items-center justify-between gap-1 border-b border-gray-200 pb-1">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            {customLogoUrl && (
                              <img
                                src={customLogoUrl}
                                alt="Logo"
                                className="w-4 h-4 object-contain shrink-0"
                              />
                            )}
                            <span className="text-[8px] font-black text-gray-800 uppercase tracking-tighter truncate">
                              {headerTitle}
                            </span>
                          </div>
                          {showBrand && item.brand && (
                            <span className="text-[7px] font-bold text-amber-700 bg-amber-50 px-1 rounded truncate shrink-0">
                              {item.brand}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <div className="my-0.5">
                          <h4 className="text-[9px] font-extrabold text-black leading-tight line-clamp-2 uppercase">
                            {item.name}
                          </h4>
                          {showSerial && item.serial_number && item.serial_number !== "-" && (
                            <p className="text-[7px] text-gray-500 font-mono">
                              S/N: {item.serial_number}
                            </p>
                          )}
                        </div>

                        {/* Barcode SVG */}
                        <div className="my-0.5 bg-white p-0.5 rounded flex flex-col items-center">
                          <BarcodeSvg
                            value={item.sku_barcode}
                            className="w-full h-7"
                            width={1.2}
                            height={26}
                          />
                          <span className="text-[8px] font-mono font-black text-black tracking-wider">
                            {item.sku_barcode}
                          </span>
                        </div>

                        {/* Label Footer: Price / Info */}
                        <div className="flex items-center justify-between border-t border-gray-200 pt-0.5 text-[8px]">
                          <span className="text-gray-500 text-[7px] uppercase font-semibold">
                            Cat. {currentPage.letter}
                          </span>
                          {showPrice && item.unit_price > 0 && (
                            <span className="font-black text-black font-mono">
                              S/ {item.unit_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Empty Placeholders if page has less than 8 items */}
                    {Array.from({ length: 8 - currentPage.items.length }).map((_, emptyIdx) => (
                      <div
                        key={`empty-${emptyIdx}`}
                        className="border border-dotted border-gray-300 p-2 rounded bg-gray-50/50 flex items-center justify-center text-[8px] text-gray-400 font-mono"
                      >
                        [ Espacio Disponible ]
                      </div>
                    ))}
                  </div>

                  {/* Sheet Footer */}
                  <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between text-[8px] text-gray-500 font-mono">
                    <span>Pág. {currentPage.globalPageIndex} de {totalSheets}</span>
                    <span>8 Etiquetas por Hoja A4</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 text-xs">
                  No hay productos seleccionados para imprimir.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10 shrink-0">
          <div className="text-xs text-gray-400">
            <span className="text-white font-bold">{baseItems.length}</span> etiquetas listas en{" "}
            <span className="text-amber-400 font-bold">{totalSheets}</span> hojas de impresión A4.
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
              <span>Imprimir {totalSheets} Hojas A4 ({baseItems.length} Códigos)</span>
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
            {/* Sheet Top Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #999999",
                paddingBottom: "2mm",
                marginBottom: "3mm",
                fontSize: "10pt",
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
            >
              <span>{headerTitle} • PLANCHA DE CÓDIGOS DE BARRA</span>
              <span
                style={{
                  background: "#f0f0f0",
                  padding: "1mm 3mm",
                  borderRadius: "2mm",
                  fontWeight: "900",
                }}
              >
                LETRA: {page.letter} (Hoja {page.pageInLetter} de {page.totalLetterPages})
              </span>
            </div>

            {/* 2 x 4 Grid = 8 Labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "repeat(4, 1fr)",
                gap: "4mm",
                flex: "1",
              }}
            >
              {page.items.map((item, itemIdx) => (
                <div
                  key={`print-item-${item.id}-${itemIdx}`}
                  className="barcode-card-print"
                  style={{
                    padding: "3mm",
                    borderRadius: "3mm",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #eeeeee",
                      paddingBottom: "1.5mm",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
                      {customLogoUrl && (
                        <img
                          src={customLogoUrl}
                          alt="Logo"
                          style={{ height: "6mm", width: "auto", objectFit: "contain" }}
                        />
                      )}
                      <span style={{ fontSize: "8pt", fontWeight: "900", textTransform: "uppercase" }}>
                        {headerTitle}
                      </span>
                    </div>
                    {showBrand && item.brand && (
                      <span
                        style={{
                          fontSize: "7.5pt",
                          fontWeight: "bold",
                          background: "#f5f5f5",
                          padding: "0.5mm 2mm",
                          borderRadius: "1mm",
                        }}
                      >
                        {item.brand}
                      </span>
                    )}
                  </div>

                  {/* Card Body: Product Name & Serial */}
                  <div style={{ margin: "2mm 0" }}>
                    <div
                      style={{
                        fontSize: "9.5pt",
                        fontWeight: "900",
                        color: "#000000",
                        lineHeight: "1.2",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.name}
                    </div>
                    {showSerial && item.serial_number && item.serial_number !== "-" && (
                      <div style={{ fontSize: "7.5pt", color: "#555555", fontFamily: "monospace" }}>
                        S/N: {item.serial_number}
                      </div>
                    )}
                  </div>

                  {/* Barcode SVG */}
                  <div style={{ textAlign: "center", margin: "1mm 0" }}>
                    <BarcodeSvg
                      value={item.sku_barcode}
                      className="w-full"
                      width={1.6}
                      height={40}
                    />
                    <div
                      style={{
                        fontSize: "9pt",
                        fontWeight: "900",
                        fontFamily: "monospace",
                        letterSpacing: "1px",
                        marginTop: "1mm",
                      }}
                    >
                      {item.sku_barcode}
                    </div>
                  </div>

                  {/* Card Footer: Category Letter & Price */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid #eeeeee",
                      paddingTop: "1.5mm",
                      fontSize: "8pt",
                    }}
                  >
                    <span style={{ color: "#777777", fontSize: "7.5pt", fontWeight: "bold" }}>
                      SECCIÓN: {page.letter}
                    </span>
                    {showPrice && item.unit_price > 0 && (
                      <span style={{ fontWeight: "900", fontSize: "9pt", fontFamily: "monospace" }}>
                        S/ {item.unit_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty place filler */}
              {Array.from({ length: 8 - page.items.length }).map((_, emptyIdx) => (
                <div
                  key={`empty-print-${emptyIdx}`}
                  style={{
                    border: "1px dotted #cccccc",
                    borderRadius: "3mm",
                    padding: "3mm",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#aaaaaa",
                    fontSize: "8pt",
                    fontFamily: "monospace",
                  }}
                >
                  [ Espacio Libre ]
                </div>
              ))}
            </div>

            {/* Sheet Bottom Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #cccccc",
                paddingTop: "2mm",
                marginTop: "3mm",
                fontSize: "8pt",
                color: "#666666",
                fontFamily: "monospace",
              }}
            >
              <span>Plancha {page.globalPageIndex} de {totalSheets} • Letra {page.letter}</span>
              <span>8 Etiquetas por Hoja A4 • ReyGas Autogas Equipment</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
