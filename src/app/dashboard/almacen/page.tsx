"use client";

import React, { useState } from "react";
import { useAppStore, InventoryItem } from "@/lib/store/app-store";
import {
  Package,
  Barcode,
  Wrench,
  UserCheck,
  AlertTriangle,
  Plus,
  CheckCircle2,
  RotateCcw,
  Search,
  Check,
  Upload,
  Edit3,
  Trash2,
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertCircle,
  ShieldAlert
} from "lucide-react";

export default function AlmacenPage() {
  const {
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    deleteMultipleInventoryItems,
    clearAllInventory,
    importBulkInventoryItems,
    deductStock,
    toolLoans,
    addToolLoan,
    returnTool,
    technicians,
    workOrders,
    vehicles,
    markWorkOrderItemDispatched,
    toggleWorkOrderItemDispatched,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"pedidos" | "inventario" | "herramientas" | "scanner">("pedidos");
  const [scanSku, setScanSku] = useState("");
  const [scanResult, setScanResult] = useState<typeof inventoryItems[0] | null>(null);

  // Checkbox Row Selection State
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Styled Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    actionType: "delete_single" | "delete_selected" | "purge_all";
    targetId?: string;
    targetName?: string;
  } | null>(null);

  // Manual Exit Modal states
  const [manualExitModalOpen, setManualExitModalOpen] = useState(false);
  const [exitForm, setExitForm] = useState({
    itemId: "",
    quantity: 1,
    assignedToType: "vehicle" as "vehicle" | "responsible",
    vehiclePlate: "",
    responsibleName: "",
    reason: "Caso Urgente / Auxilio Mecánico",
  });

  // Styled Web Notification Modal State (Replaces browser alert)
  const [webAlert, setWebAlert] = useState<{
    open: boolean;
    type: "info" | "warning" | "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const showWebNotification = (
    type: "info" | "warning" | "success" | "error",
    title: string,
    message: string
  ) => {
    setWebAlert({ open: true, type, title, message });
  };

  const handleConfirmManualExit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventoryItems.find((i) => i.id === exitForm.itemId);
    if (!item) {
      showWebNotification("warning", "Selección Requerida", "Por favor seleccione un producto del inventario de almacén.");
      return;
    }
    if (exitForm.quantity <= 0) {
      showWebNotification("warning", "Cantidad Inválida", "Por favor ingrese una cantidad válida mayor a 0.");
      return;
    }

    const assignedTarget =
      exitForm.assignedToType === "vehicle"
        ? `Vehículo (Placa: ${exitForm.vehiclePlate || "General"})`
        : `Responsable: ${exitForm.responsibleName || "Taller"}`;

    updateInventoryItem(item.id, {
      stock_quantity: Math.max(0, item.stock_quantity - Number(exitForm.quantity)),
      exits: (item.exits || 0) + Number(exitForm.quantity),
    });

    showWebNotification(
      "success",
      "¡Salida Registrada con Éxito!",
      `${exitForm.quantity} unidades de "${item.name}" asignadas a ${assignedTarget}.`
    );
    setManualExitModalOpen(false);
    setExitForm({
      itemId: "",
      quantity: 1,
      assignedToType: "vehicle",
      vehiclePlate: "",
      responsibleName: "",
      reason: "Caso Urgente / Auxilio Mecánico",
    });
  };

  // Edit & New Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    sku_barcode: "",
    name: "",
    brand: "",
    serial_number: "",
    category: "Repuestos GNV/GLP",
    unit_price: 100,
    initial_stock: 10,
    entries: 0,
    exits: 0,
    stock_quantity: 10,
    counted_stock: 10,
    min_stock_alert: 2,
  });

  // Row selection handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === inventoryItems.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(inventoryItems.map((i) => i.id));
    }
  };

  // Deletion trigger handlers opening styled web modal
  const promptDeleteSingle = (id: string, name: string) => {
    setConfirmModal({
      open: true,
      title: "Confirmar Eliminación de Fila",
      message: `¿Estás seguro de eliminar el producto "${name}" del inventario de almacén?`,
      actionType: "delete_single",
      targetId: id,
      targetName: name,
    });
  };

  const promptDeleteSelected = () => {
    if (selectedRowIds.length === 0) return;
    setConfirmModal({
      open: true,
      title: "Confirmar Eliminación de Filas Seleccionadas",
      message: `¿Estás seguro de eliminar de forma permanente las ${selectedRowIds.length} filas seleccionadas del inventario?`,
      actionType: "delete_selected",
    });
  };

  const promptPurgeAll = () => {
    setConfirmModal({
      open: true,
      title: "⚠️ LIMPIAR BASE DE DATOS COMPLETA DE ALMACÉN",
      message: "¡PRECAUCIÓN! Esta acción vaciará y borrará TODOS los productos y filas cargadas en el inventario. ¿Deseas continuar?",
      actionType: "purge_all",
    });
  };

  const handleExecuteConfirmedAction = () => {
    if (!confirmModal) return;

    if (confirmModal.actionType === "delete_single" && confirmModal.targetId) {
      deleteInventoryItem(confirmModal.targetId);
      setSelectedRowIds((prev) => prev.filter((id) => id !== confirmModal.targetId));
    } else if (confirmModal.actionType === "delete_selected") {
      deleteMultipleInventoryItems(selectedRowIds);
      setSelectedRowIds([]);
    } else if (confirmModal.actionType === "purge_all") {
      clearAllInventory();
      setSelectedRowIds([]);
    }

    setConfirmModal(null);
  };

  const handleSkuInputChange = (newSku: string) => {
    const uppercaseSku = newSku.trim().toUpperCase();
    setItemForm((prev) => ({ ...prev, sku_barcode: uppercaseSku }));

    if (uppercaseSku.length >= 3 && !editingItem) {
      const existing = inventoryItems.find(
        (i) => i.sku_barcode.trim().toUpperCase() === uppercaseSku
      );
      if (existing) {
        setItemForm({
          sku_barcode: existing.sku_barcode,
          name: existing.name,
          brand: existing.brand || "",
          serial_number: existing.serial_number || "",
          category: existing.category || "Repuestos",
          unit_price: existing.unit_price,
          initial_stock: existing.initial_stock ?? existing.stock_quantity,
          entries: 1,
          exits: existing.exits || 0,
          stock_quantity: existing.stock_quantity + 1,
          counted_stock: existing.counted_stock ?? (existing.stock_quantity + 1),
          min_stock_alert: existing.min_stock_alert || 2,
        });
      }
    }
  };

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setItemForm({
      sku_barcode: `SKU-${Date.now().toString().slice(-4)}`,
      name: "",
      brand: "",
      serial_number: "",
      category: "Repuestos GNV/GLP",
      unit_price: 100,
      initial_stock: 0,
      entries: 1,
      exits: 0,
      stock_quantity: 1,
      counted_stock: 1,
      min_stock_alert: 2,
    });
    setEditModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      sku_barcode: item.sku_barcode,
      name: item.name,
      brand: item.brand || "",
      serial_number: item.serial_number || "",
      category: item.category || "Repuestos",
      unit_price: item.unit_price,
      initial_stock: item.initial_stock ?? item.stock_quantity,
      entries: 1,
      exits: item.exits || 0,
      stock_quantity: item.stock_quantity,
      counted_stock: item.counted_stock ?? item.stock_quantity,
      min_stock_alert: item.min_stock_alert || 2,
    });
    setEditModalOpen(true);
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateInventoryItem(editingItem.id, {
        sku_barcode: itemForm.sku_barcode,
        name: itemForm.name,
        brand: itemForm.brand,
        serial_number: itemForm.serial_number,
        category: itemForm.category,
        unit_price: Number(itemForm.unit_price),
        initial_stock: Number(itemForm.initial_stock),
        entries: Number(itemForm.entries),
        exits: Number(itemForm.exits),
        stock_quantity: Number(itemForm.stock_quantity),
        counted_stock: Number(itemForm.counted_stock),
        min_stock_alert: Number(itemForm.min_stock_alert),
      });
    } else {
      addInventoryItem({
        sku_barcode: itemForm.sku_barcode,
        name: itemForm.name,
        brand: itemForm.brand,
        serial_number: itemForm.serial_number,
        category: itemForm.category,
        unit_price: Number(itemForm.unit_price),
        initial_stock: Number(itemForm.initial_stock),
        entries: Number(itemForm.entries),
        exits: Number(itemForm.exits),
        stock_quantity: Number(itemForm.stock_quantity),
        counted_stock: Number(itemForm.counted_stock),
        min_stock_alert: Number(itemForm.min_stock_alert),
      });
    }
    setEditModalOpen(false);
  };

  // Sanitized CSV/Excel file parser preventing binary character corruption & column overflow
  const handleFileUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is a binary .xlsx file without proper text encoding
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      showWebNotification(
        "warning",
        "Formato de Excel Binario Detectado",
        "Ha seleccionado un archivo de Excel binario (.xlsx). Para evitar caracteres extraños o símbolos raros, guarde o exporte su hoja de Excel en formato CSV (.csv) y vuélvalo a cargar."
      );
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      let rawText = (evt.target?.result as string) || "";
      
      // Clean non-printable binary control characters
      rawText = rawText.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u0400-\u04FF]/g, "");

      const lines = rawText.split(/\r\n|\n/);
      const parsedItems: Omit<InventoryItem, "id">[] = [];

      lines.forEach((line, idx) => {
        if (idx === 0 || !line.trim()) return;
        const cols = line.split(/,|\t|;/).map((c) => c.trim().replace(/^"(.*)"$/, "$1").slice(0, 100));

        if (cols.length >= 2) {
          const cleanSku = cols[0].replace(/[^A-Za-z0-9_-]/g, "") || `SKU-IMP-${idx}`;
          const cleanName = cols[1] || `Producto ${idx}`;

          parsedItems.push({
            sku_barcode: cleanSku,
            name: cleanName,
            brand: cols[2] || "Genérico",
            serial_number: cols[3] || "S/N",
            unit_price: parseFloat(cols[4]) || 100,
            initial_stock: parseInt(cols[5]) || 10,
            entries: parseInt(cols[6]) || 0,
            exits: parseInt(cols[7]) || 0,
            stock_quantity: parseInt(cols[8]) || (parseInt(cols[5]) || 10),
            counted_stock: parseInt(cols[9]) || (parseInt(cols[8]) || 10),
            category: "Importación Excel",
            min_stock_alert: 2,
          });
        }
      });

      if (parsedItems.length > 0) {
        importBulkInventoryItems(parsedItems);
        showWebNotification(
          "success",
          "¡Importación Exitosa!",
          `Se importaron con éxito ${parsedItems.length} filas de productos totalmente limpias.`
        );
      } else {
        showWebNotification(
          "error",
          "Error de Interpretación",
          "No se pudieron interpretar productos. Verifique que el archivo esté en formato CSV separado por comas o tabulaciones."
        );
      }
    };
    reader.readAsText(file);
  };

  // Form for new tool loan
  const [loanForm, setLoanForm] = useState({
    tool_name: "Escáner Automotriz Multimarca Launch X431",
    serial_number: "SN-987123",
    technician_name: technicians[0]?.full_name || "Carlos Mendoza",
    notes: "Uso en bahía de diagnóstico",
  });

  // Group work orders with items by vehicle plate
  const vehiclePartGroups = workOrders
    .filter((wo) => wo.items.length > 0)
    .map((wo) => {
      const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
      const tech = technicians.find((t) => t.id === wo.assigned_technician_id);

      return {
        orderId: wo.id,
        plate: wo.vehicle_plate,
        brand: vehicle?.brand || "Marca",
        model: vehicle?.model || "Modelo",
        year: vehicle?.year || 2022,
        color: vehicle?.color || "Color",
        fuel_type: vehicle?.fuel_type || "GNV",
        ownerName: vehicle?.owner_name || "Cliente",
        techName: tech?.full_name || "Técnico No Asignado",
        items: wo.items,
      };
    });

  const pendingRequisitionsCount = workOrders
    .flatMap((wo) => wo.items)
    .filter((i) => !i.dispatched).length;

  const handleScanLookup = () => {
    const found = inventoryItems.find(
      (i) => i.sku_barcode.toLowerCase() === scanSku.trim().toLowerCase()
    );
    setScanResult(found || null);
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    addToolLoan({
      tool_name: loanForm.tool_name,
      serial_number: loanForm.serial_number,
      technician_name: loanForm.technician_name,
      notes: loanForm.notes,
    });
    setLoanForm({
      tool_name: "Escáner Automotriz Multimarca Launch X431",
      serial_number: "SN-987123",
      technician_name: technicians[0]?.full_name || "Carlos Mendoza",
      notes: "Uso en bahía de diagnóstico",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Almacén & Despacho a Taller</h1>
            <p className="text-xs text-gray-400">
              Notificaciones de repuestos requeridos agrupadas por vehículo, selección múltiple y eliminación limpia de inventario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "pedidos"
                ? "bg-amber-500 text-black font-extrabold shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span>Pedidos por Vehículo</span>
            {pendingRequisitionsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-reygas-red text-white text-[10px] font-black animate-bounce">
                {pendingRequisitionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("inventario")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "inventario"
                ? "bg-emerald-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Inventario & Stock ({inventoryItems.length})
          </button>
          <button
            onClick={() => setActiveTab("herramientas")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "herramientas"
                ? "bg-emerald-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Préstamo Herramientas ({toolLoans.length})
          </button>
          <button
            onClick={() => setActiveTab("scanner")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "scanner"
                ? "bg-emerald-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Escáner QR/Barras
          </button>
        </div>
      </div>

      {/* TAB 1: PEDIDOS POR VEHICULO */}
      {activeTab === "pedidos" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Solicitudes de Repuestos Agrupadas por Vehículo</span>
              </div>
              <span className="text-xs text-amber-400 font-bold">
                {pendingRequisitionsCount} Repuestos Pendientes de Entrega
              </span>
            </h2>

            {vehiclePartGroups.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No hay repuestos solicitados desde el taller en este momento.
              </p>
            ) : (
              <div className="space-y-6">
                {vehiclePartGroups.map((group) => {
                  const pendingCountInCard = group.items.filter((i) => !i.dispatched).length;

                  return (
                    <div
                      key={group.orderId}
                      className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                            {group.plate}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {group.brand} {group.model} ({group.year}) - {group.color}
                            </span>
                            <span className="text-xs text-reygas-red font-semibold">
                              Combustible: {group.fuel_type} • Cliente: {group.ownerName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-reygas-surface text-gray-200 border border-white/10">
                            Técnico Asignado: <strong className="text-amber-400">{group.techName}</strong>
                          </span>
                          {pendingCountInCard > 0 ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-extrabold">
                              {pendingCountInCard} pendientes
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold">
                              ✓ Todos entregados
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase text-gray-400 block">
                          Lista de Repuestos Asignados para este Vehículo:
                        </span>

                        <div className="grid grid-cols-1 gap-2.5">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                item.dispatched
                                  ? "bg-emerald-950/20 border-emerald-500/30"
                                  : "bg-amber-950/20 border-amber-500/40"
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span className="font-bold text-white text-sm">{item.description}</span>
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold">
                                    x{item.quantity}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 pt-0.5">
                                  <span>
                                    📅 <strong>Solicitado:</strong>{" "}
                                    {item.requested_at
                                      ? new Date(item.requested_at).toLocaleString()
                                      : "Reciente"}
                                  </span>
                                  {item.dispatched && item.dispatched_at && (
                                    <span className="text-emerald-400">
                                      ✓ <strong>Entregado:</strong>{" "}
                                      {new Date(item.dispatched_at).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0">
                                {item.dispatched ? (
                                  <button
                                    onClick={() => toggleWorkOrderItemDispatched(group.orderId, item.id)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition-all"
                                    title="Haga clic para revertir estado a pendiente"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ENTREGADO Y LISTO (Cambiar)</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleWorkOrderItemDispatched(group.orderId, item.id)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Confirmar Repuesto Listo para Recojo</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTARIO & STOCK CON SELECCION MULTIPLE Y LIMPIEZA */}
      {activeTab === "inventario" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>Catálogo de Inventario de Almacén</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Selección por casillas (checkboxes), eliminación de filas seleccionadas y vaciado completo de base de datos.
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Batch Delete Selection Button */}
                {selectedRowIds.length > 0 && (
                  <button
                    onClick={promptDeleteSelected}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Filas Seleccionadas ({selectedRowIds.length})</span>
                  </button>
                )}

                {/* Clear Database / Purge All Inventory Button */}
                <button
                  onClick={promptPurgeAll}
                  className="px-4 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-extrabold rounded-xl shadow-lg flex items-center gap-2 transition-all"
                  title="Vaciar y limpiar todo el inventario de la base de datos"
                >
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Limpiar Base de Datos Completa</span>
                </button>

                <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Cargar CSV / Excel</span>
                  <input
                    type="file"
                    accept=".csv, .txt, .xlsx, .xls"
                    onChange={handleFileUploadExcel}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setManualExitModalOpen(true)}
                  className="px-4 py-2.5 bg-reygas-red/90 hover:bg-reygas-red text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4 rotate-180" />
                  <span>Salida Urgente</span>
                </button>

                <button
                  onClick={handleOpenNewModal}
                  className="px-4 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Agregar Fila</span>
                </button>
              </div>
            </div>

            {/* Inventory Table with Overflow Protection & Max Width Truncate */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300 table-auto">
                <thead className="bg-reygas-dark text-[11px] uppercase text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-gray-400 hover:text-white"
                        title="Seleccionar todo"
                      >
                        {selectedRowIds.length > 0 && selectedRowIds.length === inventoryItems.length ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 font-extrabold w-16 text-center text-amber-400">ÍTEM (#)</th>
                    <th className="p-3 font-extrabold max-w-[140px]">CÓDIGO SKU</th>
                    <th className="p-3 font-extrabold max-w-[200px]">PRODUCTO</th>
                    <th className="p-3 font-extrabold max-w-[120px]">MARCA</th>
                    <th className="p-3 font-extrabold max-w-[120px]">SERIE</th>
                    <th className="p-3 font-extrabold">PRECIO VENTA</th>
                    <th className="p-3 font-extrabold">STOCK INICIAL</th>
                    <th className="p-3 font-extrabold">ENTRADAS</th>
                    <th className="p-3 font-extrabold">SALIDAS</th>
                    <th className="p-3 font-extrabold">STOCK VIGENTE</th>
                    <th className="p-3 font-extrabold">CONTADOS</th>
                    <th className="p-3 font-extrabold text-right">OPCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-gray-400 space-y-2">
                        <Package className="w-10 h-10 text-gray-600 mx-auto" />
                        <p className="font-bold text-sm">El inventario está completamente vacío.</p>
                        <p className="text-xs text-gray-500">
                          Utilice el botón "Agregar Fila" o "Cargar CSV / Excel" para añadir productos limpios.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    inventoryItems.map((item, idx) => {
                      const isLow = item.stock_quantity <= item.min_stock_alert;
                      const isSelected = selectedRowIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? "bg-emerald-950/30" : "hover:bg-white/5"
                          }`}
                        >
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleSelectRow(item.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-mono font-bold text-center text-amber-400 bg-amber-500/10 rounded">
                            #{idx + 1}
                          </td>
                          <td
                            className="p-3 font-mono font-bold text-reygas-silver max-w-[140px] truncate"
                            title={item.sku_barcode}
                          >
                            {item.sku_barcode}
                          </td>
                          <td
                            className="p-3 font-bold text-white max-w-[200px] truncate"
                            title={item.name}
                          >
                            {item.name}
                          </td>
                          <td
                            className="p-3 text-gray-300 max-w-[120px] truncate"
                            title={item.brand || "Genérico"}
                          >
                            {item.brand || "Genérico"}
                          </td>
                          <td
                            className="p-3 font-mono text-gray-400 max-w-[120px] truncate"
                            title={item.serial_number || "S/N"}
                          >
                            {item.serial_number || "S/N"}
                          </td>
                          <td className="p-3 font-bold text-white font-mono">
                            S/ {(item.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-gray-300">
                            {item.initial_stock ?? item.stock_quantity}
                          </td>
                          <td className="p-3 font-mono text-emerald-400 font-bold">
                            +{item.entries || 0}
                          </td>
                          <td className="p-3 font-mono text-red-400 font-bold">
                            -{item.exits || 0}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold ${
                                isLow
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              {isLow && <AlertTriangle className="w-3 h-3" />}
                              {item.stock_quantity} unids
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-200">
                            {item.counted_stock ?? item.stock_quantity}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                                title="Editar Fila"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => promptDeleteSingle(item.id, item.name)}
                                className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                                title="Eliminar Fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRESTAMO HERRAMIENTAS */}
      {activeTab === "herramientas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Wrench className="w-5 h-5 text-emerald-400" />
              <span>Asignar Herramienta a Técnico</span>
            </h2>

            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre del Equipo / Herramienta *
                </label>
                <input
                  type="text"
                  required
                  value={loanForm.tool_name}
                  onChange={(e) => setLoanForm({ ...loanForm, tool_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Número de Serie / Código Interno
                </label>
                <input
                  type="text"
                  value={loanForm.serial_number}
                  onChange={(e) => setLoanForm({ ...loanForm, serial_number: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Técnico Solicitante *
                </label>
                <select
                  value={loanForm.technician_name}
                  onChange={(e) => setLoanForm({ ...loanForm, technician_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-emerald-500"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.full_name}>
                      {t.full_name} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Notas / Uso</label>
                <input
                  type="text"
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Préstamo de Equipo</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <span>Registro de Equipos en Uso por Técnicos</span>
            </h2>

            <div className="space-y-3">
              {toolLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-4 rounded-xl glass-card border border-white/10 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{loan.tool_name}</span>
                      <span className="text-xs text-gray-400 font-mono">({loan.serial_number})</span>
                    </div>
                    <p className="text-xs text-amber-400 font-semibold">
                      Asignado a: {loan.technician_name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Fecha: {new Date(loan.borrowed_at).toLocaleString("es-PE")}
                    </p>
                  </div>

                  <div>
                    {loan.status === "prestado" ? (
                      <button
                        onClick={() => returnTool(loan.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Marcar Devuelto</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-gray-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
                        Devuelto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SCANNER QR / BARRAS */}
      {activeTab === "scanner" && (
        <div className="max-w-xl mx-auto glass-panel p-8 rounded-3xl border border-white/10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
            <Barcode className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Simulador Lector Código de Barras / QR</h2>
            <p className="text-xs text-gray-400">
              Ingrese el código SKU del repuesto o presione escaneo rápido.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: KIT-GNV-5G"
              value={scanSku}
              onChange={(e) => setScanSku(e.target.value)}
              className="flex-1 px-4 py-3 bg-reygas-dark border border-white/10 rounded-xl text-sm font-mono text-white focus:border-emerald-500"
            />
            <button
              onClick={handleScanLookup}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Buscar SKU
            </button>
          </div>

          {scanResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-left space-y-2">
              <h4 className="font-bold text-white text-base">{scanResult.name}</h4>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Stock Actual:</span>
                <span className="font-bold text-emerald-400">{scanResult.stock_quantity} unidades</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Precio Unitario:</span>
                <span className="font-bold text-white">S/ {scanResult.unit_price.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STYLED CONFIRMATION MODAL (MATCHING APP DESIGN SYSTEM) */}
      {/* ========================================================================= */}
      {confirmModal?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-red-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{confirmModal.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Ventana de Confirmación Web de Almacén</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteConfirmedAction}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs shadow-lg shadow-red-600/30 transition-transform hover:scale-105 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLED WEB NOTIFICATION MODAL (REPLACES BROWSER ALERT) */}
      {webAlert?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div
                className={`p-3 rounded-2xl border ${
                  webAlert.type === "warning"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : webAlert.type === "error"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : webAlert.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{webAlert.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Aviso Web de Almacén</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {webAlert.message}
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setWebAlert(null)}
                className="px-6 py-2.5 bg-reygas-red hover:bg-red-600 text-white font-black rounded-xl text-xs shadow-lg shadow-reygas-red/30 transition-transform hover:scale-105"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / New Item Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-xl w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{editingItem ? `Editar Fila - ${editingItem.name}` : "Agregar Nuevo Producto al Inventario"}</span>
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    CÓDIGO SKU * <span className="text-[10px] text-amber-400 font-normal">(Autocompleta)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. KIT-GNV-5G"
                    value={itemForm.sku_barcode}
                    onChange={(e) => handleSkuInputChange(e.target.value)}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono uppercase focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">PRODUCTO *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">MARCA</label>
                  <input
                    type="text"
                    placeholder="Ej. Tomasetto / BRC"
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">SERIE / NRO PARTE</label>
                  <input
                    type="text"
                    placeholder="Ej. SN-88192"
                    value={itemForm.serial_number}
                    onChange={(e) => setItemForm({ ...itemForm, serial_number: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">PRECIO DE VENTA EDITABLE (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={itemForm.unit_price}
                    onChange={(e) => setItemForm({ ...itemForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    STOCK VIGENTE / ACTUAL {!editingItem && <span className="text-[10px] text-emerald-400 font-normal">(Informativo)</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    readOnly={!editingItem}
                    value={itemForm.stock_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, stock_quantity: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                      !editingItem
                        ? "bg-reygas-surface/60 border-white/5 text-emerald-400 font-extrabold cursor-not-allowed"
                        : "bg-reygas-dark border-white/10 text-white focus:border-emerald-400"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">ENTRADAS</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.entries}
                    onChange={(e) => setItemForm({ ...itemForm, entries: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">SALIDAS</label>
                  <input
                    type="number"
                    min={0}
                    readOnly
                    value={itemForm.exits}
                    className="w-full px-3 py-2 bg-reygas-surface/50 border border-white/5 rounded-lg text-sm text-gray-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">CONTADOS</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.counted_stock}
                    onChange={(e) => setItemForm({ ...itemForm, counted_stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-reygas-surface text-gray-300 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg"
                >
                  Guardar Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Exit Modal */}
      {manualExitModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-red-400 rotate-180" />
                <span>Salida Manual Urgente de Repuesto</span>
              </h3>
              <button
                onClick={() => setManualExitModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmManualExit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">PRODUCTO A DESPACHAR *</label>
                <select
                  required
                  value={exitForm.itemId}
                  onChange={(e) => setExitForm({ ...exitForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-red-400"
                >
                  <option value="">-- Seleccionar Repuesto del Inventario --</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku_barcode} - {item.name} (Stock: {item.stock_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">CANTIDAD A SALIR *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={exitForm.quantity}
                  onChange={(e) => setExitForm({ ...exitForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">TIPO DE ASIGNACIÓN *</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="assignedToType"
                      value="vehicle"
                      checked={exitForm.assignedToType === "vehicle"}
                      onChange={() => setExitForm({ ...exitForm, assignedToType: "vehicle" })}
                    />
                    <span>Asignar a Vehículo (Placa)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="assignedToType"
                      value="responsible"
                      checked={exitForm.assignedToType === "responsible"}
                      onChange={() => setExitForm({ ...exitForm, assignedToType: "responsible" })}
                    />
                    <span>Asignar a Responsable</span>
                  </label>
                </div>
              </div>

              {exitForm.assignedToType === "vehicle" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">PLACA DEL VEHÍCULO *</label>
                  <select
                    value={exitForm.vehiclePlate}
                    onChange={(e) => setExitForm({ ...exitForm, vehiclePlate: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  >
                    <option value="">-- Seleccionar Vehículo Registrado --</option>
                    {vehicles.map((v) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} - {v.brand} {v.model} ({v.owner_name})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      SELECCIONAR DE LA TABLA MAESTRA DE PERSONAL
                    </label>
                    <select
                      value={exitForm.responsibleName}
                      onChange={(e) => setExitForm({ ...exitForm, responsibleName: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-red-400"
                    >
                      <option value="">-- Seleccionar Personal Registrado --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.full_name}>
                          {t.full_name} ({t.specialty})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      O ESCRIBIR NOMBRE DEL RESPONSABLE *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Técnico Carlos Mendoza / Ing. Miguel Torres"
                      value={exitForm.responsibleName}
                      onChange={(e) => setExitForm({ ...exitForm, responsibleName: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-red-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">MOTIVO / NOTAS</label>
                <input
                  type="text"
                  value={exitForm.reason}
                  onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setManualExitModalOpen(false)}
                  className="px-4 py-2 bg-reygas-surface text-gray-300 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-reygas-red hover:bg-red-600 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20"
                >
                  Confirmar Salida Urgente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
