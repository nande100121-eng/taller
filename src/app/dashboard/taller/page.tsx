"use client";

import React, { useState } from "react";
import { useAppStore, WorkOrderStatus } from "@/lib/store/app-store";
import {
  Wrench,
  UserCheck,
  PackagePlus,
  FileCheck2,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  X,
  Cpu,
  Search,
  Check,
  ChevronRight,
  User,
  Phone,
  AlertCircle,
  Package,
  Trash2,
  Edit3
} from "lucide-react";

export default function TallerPage() {
  const {
    workOrders,
    updateWorkOrderStatus,
    assignTechnicianToOrder,
    technicians,
    vehicles,
    inventoryItems,
    addWorkOrderItem,
    removeWorkOrderItem,
    updateDiagnosticNotes,
  } = useAppStore();

  const [searchPlate, setSearchPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Modals for actions
  const [activeOrderModal, setActiveOrderModal] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"diagnostic" | "parts" | "technician">("diagnostic");

  // Form states inside modals
  const [diagnosticText, setDiagnosticText] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");

  // Requisition form (Catalog or Custom text)
  const [isCustomPart, setIsCustomPart] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryItems[0]?.id || "custom");
  const [customPartName, setCustomPartName] = useState("");
  const [customUnitPrice, setCustomUnitPrice] = useState(50);
  const [partQty, setPartQty] = useState(1);

  const statusSteps: Array<{ status: WorkOrderStatus; label: string; color: string }> = [
    { status: "ingresado", label: "1. Ingresado", color: "bg-blue-500" },
    { status: "en_diagnostico", label: "2. Diagnóstico", color: "bg-purple-500" },
    { status: "esperando_repuestos", label: "3. Repuestos", color: "bg-amber-500" },
    { status: "en_servicio", label: "4. En Servicio", color: "bg-teal-500" },
    { status: "por_cobrar", label: "5. Por Cobrar", color: "bg-emerald-500" },
  ];

  const handleOpenDiagnostic = (orderId: string, currentNotes?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("diagnostic");
    setDiagnosticText(currentNotes || "");
  };

  const handleOpenParts = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("parts");
    setIsCustomPart(false);
    setCustomPartName("");
    setCustomUnitPrice(50);
    setPartQty(1);
  };

  const handleOpenTechnician = (orderId: string, currentTechId?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("technician");
    setSelectedTechId(currentTechId || technicians[0]?.id || "");
  };

  const handleSaveDiagnostic = () => {
    if (activeOrderModal) {
      updateDiagnosticNotes(activeOrderModal, diagnosticText);
      setActiveOrderModal(null);
    }
  };

  const handleSaveTechnician = () => {
    if (activeOrderModal && selectedTechId) {
      assignTechnicianToOrder(activeOrderModal, selectedTechId);
      setActiveOrderModal(null);
    }
  };

  const handleAddPartRequisition = () => {
    if (!activeOrderModal) return;

    if (isCustomPart) {
      if (!customPartName.trim()) return;
      addWorkOrderItem(activeOrderModal, {
        description: customPartName.trim(),
        quantity: Number(partQty),
        unit_price: Number(customUnitPrice),
      });
      updateWorkOrderStatus(activeOrderModal, "esperando_repuestos");
    } else {
      const item = inventoryItems.find((i) => i.id === selectedInventoryId);
      if (item) {
        addWorkOrderItem(activeOrderModal, {
          inventory_item_id: item.id,
          description: item.name,
          quantity: Number(partQty),
          unit_price: item.unit_price,
        });
        updateWorkOrderStatus(activeOrderModal, "esperando_repuestos");
      }
    }
    setActiveOrderModal(null);
  };

  const filteredOrders = [...workOrders]
    .filter((wo) => {
      const matchPlate = searchPlate ? wo.vehicle_plate.includes(searchPlate) : true;
      const matchStatus = statusFilter === "todos" ? true : wo.status === statusFilter;
      return matchPlate && matchStatus;
    })
    .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Taller & Bahías de Trabajo</h1>
            <p className="text-xs text-gray-400">
              Vista tecnológica por Cards Horizontales ordenadas por hora de llegada, con Pipeline interactivo de estado.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              className="pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-amber-400"
          >
            <option value="todos">Todos los Estados ({workOrders.length})</option>
            <option value="ingresado">1. Ingresados</option>
            <option value="en_diagnostico">2. En Diagnóstico</option>
            <option value="esperando_repuestos">3. Esperando Repuestos</option>
            <option value="en_servicio">4. En Servicio / Bahía</option>
            <option value="por_cobrar">5. Por Cobrar</option>
          </select>
        </div>
      </div>

      {/* Horizontal Cards List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-400 space-y-3 rounded-2xl border border-white/10">
            <Wrench className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">No hay órdenes de trabajo que coincidan con los filtros.</p>
          </div>
        ) : (
          filteredOrders.map((wo) => {
            const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
            const tech = technicians.find((t) => t.id === wo.assigned_technician_id);

            // Current step index in pipeline
            const currentStepIdx = statusSteps.findIndex((s) => s.status === wo.status);

            return (
              <div
                key={wo.id}
                className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-amber-500/30 transition-all space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left Column: Vehicle Info */}
                  <div className="lg:col-span-3 space-y-2 border-b lg:border-b-0 lg:border-r border-white/10 pb-4 lg:pb-0 lg:pr-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-2xl text-white tracking-widest bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                        {wo.vehicle_plate}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase">
                        OT #{wo.id}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year})` : "Vehículo"}
                      </h3>
                      <p className="text-xs text-gray-400 font-semibold">{vehicle?.color || "Color no especificado"} • <span className="text-reygas-red">{vehicle?.fuel_type || "GNV"}</span></p>
                    </div>

                    <div className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 space-y-1 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Llegada: {new Date(wo.entry_time).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-200 font-medium">{vehicle?.owner_name || "Cliente Garita"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        <span>{vehicle?.owner_phone || "Sin teléfono"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Column: Interactive Progress Stepper & Description */}
                  <div className="lg:col-span-6 space-y-4 px-0 lg:px-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Estado Actual y Flujo de Servicio:
                      </span>
                      {/* Stepper Pipeline */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {statusSteps.map((step, idx) => {
                          const isCurrent = wo.status === step.status;
                          const isPassed = idx <= currentStepIdx;

                          return (
                            <button
                              key={step.status}
                              onClick={() => updateWorkOrderStatus(wo.id, step.status)}
                              className={`py-2 px-1.5 rounded-lg text-[10px] font-extrabold transition-all text-center flex flex-col items-center justify-center gap-1 border ${
                                isCurrent
                                  ? `${step.color} text-black border-white shadow-lg`
                                  : isPassed
                                  ? "bg-reygas-surface text-gray-200 border-white/20 hover:border-amber-400"
                                  : "bg-reygas-dark/60 text-gray-500 border-white/5 hover:border-white/20"
                              }`}
                            >
                              <span>{step.label}</span>
                              {isCurrent && <Check className="w-3 h-3 text-black stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-reygas-dark/80 border border-white/5 text-xs text-gray-300">
                      <span className="font-bold text-amber-400 block text-[11px] uppercase">
                        Reporte / Motivo de Ingreso:
                      </span>
                      <p className="mt-0.5 line-clamp-2">{wo.problem_description}</p>
                    </div>

                    {/* Diagnostic notes preview if present */}
                    {wo.diagnostic_notes && (
                      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                        <span className="font-bold text-purple-400 block text-[11px] uppercase">
                          Diagnóstico Técnico ECU:
                        </span>
                        <p className="mt-0.5 line-clamp-2">{wo.diagnostic_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Assigned Technician & Actions */}
                  <div className="lg:col-span-3 space-y-3 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-4">
                    {/* Technician selector dropdown */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Mecánico Asignado
                      </label>
                      <div className="relative">
                        <select
                          value={wo.assigned_technician_id || ""}
                          onChange={(e) => assignTechnicianToOrder(wo.id, e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-semibold text-white focus:border-amber-400"
                        >
                          <option value="">-- Sin Técnico Asignado --</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name} ({t.specialty})
                            </option>
                          ))}
                        </select>
                        <UserCheck className="w-4 h-4 text-amber-400 absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {/* Requisitions & Assigned Parts List */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          Repuestos Solicitados a Almacén ({wo.items.length}):
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          Total: S/ {wo.items.reduce((acc, i) => acc + i.subtotal, 0)}
                        </span>
                      </div>

                      {wo.items.length === 0 ? (
                        <p className="text-[11px] text-gray-500 italic">No hay repuestos solicitados aún.</p>
                      ) : (
                        <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                          {wo.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-white font-semibold truncate">{item.description}</span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  x{item.quantity}
                                </span>
                                {item.dispatched ? (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase">
                                    ✓ Entregado por Almacén
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">
                                    ⏳ Pendiente Almacén
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-gray-300 text-xs">S/ {item.subtotal}</span>
                                <button
                                  onClick={() => removeWorkOrderItem(wo.id, item.id)}
                                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                  title="Quitar repuesto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Assigned Technician & Actions */}
                  <div className="lg:col-span-3 space-y-3 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-4">
                    {/* Technician selector dropdown */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Mecánico Asignado
                      </label>
                      <div className="relative">
                        <select
                          value={wo.assigned_technician_id || ""}
                          onChange={(e) => assignTechnicianToOrder(wo.id, e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs font-semibold text-white focus:border-amber-400"
                        >
                          <option value="">-- Sin Técnico Asignado --</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name} ({t.specialty})
                            </option>
                          ))}
                        </select>
                        <UserCheck className="w-4 h-4 text-amber-400 absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes)}
                        className="py-2 px-2 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-purple-500/30 transition-colors"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Diagnóstico</span>
                      </button>

                      <button
                        onClick={() => handleOpenParts(wo.id)}
                        className="py-2 px-2 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-amber-500/30 transition-colors"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Pedir Repuestos</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals for Diagnostic and Parts Requisition */}
      {activeOrderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalMode === "diagnostic" ? (
                  <>
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <span>Registrar Diagnóstico de Falla ECU</span>
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-5 h-5 text-amber-400" />
                    <span>Solicitar Repuestos a Almacén</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveOrderModal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMode === "diagnostic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">
                    Notas y Códigos de Error Escáner OBD2 / ECU
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Ej. Código P0300 Misfire detectado en cilindro 2. Inyector de gas tapado."
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(e.target.value)}
                    className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-purple-400"
                  />
                </div>
                <button
                  onClick={handleSaveDiagnostic}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Guardar Diagnóstico y Cambiar a En Diagnóstico
                </button>
              </div>
            )}

            {modalMode === "parts" && (
              <div className="space-y-4">
                {/* Mode Selector: Catalog vs Custom */}
                <div className="flex items-center gap-2 p-1 bg-reygas-dark rounded-xl border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsCustomPart(false)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      !isCustomPart ? "bg-amber-500 text-black shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Seleccionar de Inventario
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomPart(true)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      isCustomPart ? "bg-amber-500 text-black shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Ingreso Libre (Repuesto Especial)
                  </button>
                </div>

                {!isCustomPart ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
                      Seleccionar Producto del Catálogo de Almacén
                    </label>
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => setSelectedInventoryId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400"
                    >
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (Stock: {item.stock_quantity}) - S/ {item.unit_price}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Nombre / Descripción del Repuesto Especial *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Kit Inyectores Hana de 4 Cilindros con Adaptador"
                        value={customPartName}
                        onChange={(e) => setCustomPartName(e.target.value)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Precio Estimado Unitario (S/)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={customUnitPrice}
                        onChange={(e) => setCustomUnitPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={partQty}
                    onChange={(e) => setPartQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>

                <button
                  onClick={handleAddPartRequisition}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Notificar y Enviar Pedido a Almacén</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
