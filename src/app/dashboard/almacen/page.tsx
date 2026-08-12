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
  FileSpreadsheet
} from "lucide-react";

export default function AlmacenPage() {
  const {
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    importBulkInventoryItems,
    deductStock,
    toolLoans,
    addToolLoan,
    returnTool,
    technicians,
    workOrders,
    vehicles,
    markWorkOrderItemDispatched,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"pedidos" | "inventario" | "herramientas" | "scanner">("pedidos");
  const [scanSku, setScanSku] = useState("");
  const [scanResult, setScanResult] = useState<typeof inventoryItems[0] | null>(null);

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

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setItemForm({
      sku_barcode: `SKU-${Date.now().toString().slice(-4)}`,
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
      entries: item.entries || 0,
      exits: item.exits || 0,
      stock_quantity: item.stock_quantity,
      counted_stock: item.counted_stock ?? item.stock_quantity,
      min_stock_alert: item.min_stock_alert || 2,
    });
    setEditModalOpen(true);
  };

  const handleDeleteRow = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el producto "${name}" del inventario?`)) {
      deleteInventoryItem(id);
    }
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

  const handleFileUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      const parsedItems: Omit<InventoryItem, "id">[] = [];

      lines.forEach((line, idx) => {
        if (idx === 0 || !line.trim()) return; // skip header or empty lines
        const cols = line.split(/,|\t|;/).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));

        if (cols.length >= 2) {
          parsedItems.push({
            sku_barcode: cols[0] || `SKU-IMP-${idx}`,
            name: cols[1] || `Producto ${idx}`,
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
        alert(`¡Se importaron con éxito ${parsedItems.length} filas desde el archivo!`);
      } else {
        alert("No se pudieron interpretar productos. Verifique que el archivo CSV/Excel contenga filas con formato separado por comas o tabulaciones.");
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
              Notificaciones de repuestos requeridos agrupadas por vehículo, confirmación de recojo y horas de solicitud/entrega.
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

      {activeTab === "pedidos" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Solicitudes de Repuestos Agrupadadas por Vehículo</span>
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
                      {/* Vehicle Header */}
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

                      {/* Items List Inside Vehicle Card */}
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
                                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ENTREGADO Y LISTO</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => markWorkOrderItemDispatched(group.orderId, item.id)}
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

      {activeTab === "inventario" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>Catálogo de Inventario de Almacén</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Gestión de catálogo, edición/eliminación de filas y carga masiva desde Excel o Google Sheets (CSV).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Cargar Excel / Google Sheets (.csv/.xlsx)</span>
                  <input
                    type="file"
                    accept=".csv, .txt, .xlsx, .xls"
                    onChange={handleFileUploadExcel}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleOpenNewModal}
                  className="px-4 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Agregar Producto Manual</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-reygas-dark text-[11px] uppercase text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3 font-extrabold">CÓDIGO SKU</th>
                    <th className="p-3 font-extrabold">PRODUCTO</th>
                    <th className="p-3 font-extrabold">MARCA</th>
                    <th className="p-3 font-extrabold">SERIE</th>
                    <th className="p-3 font-extrabold">PRECIO DE VENTA</th>
                    <th className="p-3 font-extrabold">STOCK INICIAL</th>
                    <th className="p-3 font-extrabold">ENTRADAS</th>
                    <th className="p-3 font-extrabold">SALIDAS</th>
                    <th className="p-3 font-extrabold">STOCK VIGENTE</th>
                    <th className="p-3 font-extrabold">CONTADOS</th>
                    <th className="p-3 font-extrabold text-right">OPCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventoryItems.map((item) => {
                    const isLow = item.stock_quantity <= item.min_stock_alert;

                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-mono font-bold text-reygas-silver">
                          {item.sku_barcode}
                        </td>
                        <td className="p-3 font-bold text-white">{item.name}</td>
                        <td className="p-3 text-gray-300">{item.brand || "Generico"}</td>
                        <td className="p-3 font-mono text-gray-400">{item.serial_number || "S/N"}</td>
                        <td className="p-3 font-bold text-white font-mono">
                          S/ {(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="p-3 font-mono text-gray-300">{item.initial_stock ?? item.stock_quantity}</td>
                        <td className="p-3 font-mono text-emerald-400 font-bold">+{item.entries || 0}</td>
                        <td className="p-3 font-mono text-red-400 font-bold">-{item.exits || 0}</td>
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
                        <td className="p-3 font-mono text-gray-200">{item.counted_stock ?? item.stock_quantity}</td>
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
                              onClick={() => handleDeleteRow(item.id, item.name)}
                              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                              title="Eliminar Fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "herramientas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* New Loan Form */}
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

          {/* Active Loans List */}
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
                  <label className="block text-xs font-semibold text-gray-300 mb-1">CÓDIGO SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.sku_barcode}
                    onChange={(e) => setItemForm({ ...itemForm, sku_barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">PRECIO DE VENTA (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={itemForm.unit_price}
                    onChange={(e) => setItemForm({ ...itemForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">STOCK INICIAL</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.initial_stock}
                    onChange={(e) => setItemForm({ ...itemForm, initial_stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">STOCK VIGENTE</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.stock_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, stock_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
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
                    value={itemForm.exits}
                    onChange={(e) => setItemForm({ ...itemForm, exits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
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
    </div>
  );
}
