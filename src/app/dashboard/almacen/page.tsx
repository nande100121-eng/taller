"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
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
  Check
} from "lucide-react";

export default function AlmacenPage() {
  const {
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
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

  // Form for new tool loan
  const [loanForm, setLoanForm] = useState({
    tool_name: "Escáner Automotriz Multimarca Launch X431",
    serial_number: "SN-987123",
    technician_name: technicians[0]?.full_name || "Carlos Mendoza",
    notes: "Uso en bahía de diagnóstico",
  });

  // Calculate pending requisitions
  const pendingOrders = workOrders.flatMap((wo) => {
    const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
    const tech = technicians.find((t) => t.id === wo.assigned_technician_id);

    return wo.items.map((item) => ({
      ...item,
      orderId: wo.id,
      plate: wo.vehicle_plate,
      vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year}) - ${vehicle.fuel_type}` : "Vehículo",
      ownerName: vehicle?.owner_name || "Cliente",
      techName: tech?.full_name || "Técnico de Taller",
    }));
  });

  const pendingRequisitionsCount = pendingOrders.filter((i) => !i.dispatched).length;

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
              Notificaciones de repuestos requeridos por el taller, confirmación de recojo y control de inventario.
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
            <span>Pedidos de Taller</span>
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
                <span>Notificaciones de Repuestos Solicitados por los Mecánicos</span>
              </div>
              <span className="text-xs text-amber-400 font-bold">
                {pendingRequisitionsCount} Pendientes de Recojo
              </span>
            </h2>

            {pendingOrders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No hay repuestos solicitados desde el taller en este momento.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((req) => (
                  <div
                    key={`${req.orderId}-${req.id}`}
                    className={`p-4 rounded-xl border transition-all ${
                      req.dispatched
                        ? "bg-emerald-950/20 border-emerald-500/30"
                        : "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-base text-white bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                            {req.plate}
                          </span>
                          <span className="text-xs font-bold text-amber-300">
                            {req.vehicleInfo}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-reygas-surface text-gray-300 font-bold">
                            Técnico: {req.techName}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-sm pt-1">
                          <span className="font-extrabold text-white">{req.description}</span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs">
                            Cantidad: {req.quantity}
                          </span>
                          <span className="font-mono text-gray-400 text-xs">
                            Subtotal: S/ {req.subtotal}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {req.dispatched ? (
                          <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>ENTREGADO Y LISTO</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => markWorkOrderItemDispatched(req.orderId, req.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Confirmar Repuesto Listo para Recojo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "inventario" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <span>Catálogo de Repuestos e Insumos GNV/GLP</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-reygas-dark text-xs uppercase text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">SKU / Código</th>
                    <th className="p-3">Nombre del Repuesto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Stock Actual</th>
                    <th className="p-3">Precio Unitario</th>
                    <th className="p-3">Acciones Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventoryItems.map((item) => {
                    const isLow = item.stock_quantity <= item.min_stock_alert;

                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-mono text-xs font-bold text-reygas-silver">
                          {item.sku_barcode}
                        </td>
                        <td className="p-3 font-bold text-white">{item.name}</td>
                        <td className="p-3 text-xs text-gray-400">{item.category}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isLow
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                            {item.stock_quantity} unidades
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">
                          S/ {item.unit_price.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateInventoryItem(item.id, {
                                  stock_quantity: item.stock_quantity + 5,
                                })
                              }
                              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-emerald-400 font-bold rounded"
                            >
                              +5 Stock
                            </button>
                            <button
                              onClick={() => deductStock(item.id, 1)}
                              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-red-400 font-bold rounded"
                            >
                              -1 Entregar
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
    </div>
  );
}
