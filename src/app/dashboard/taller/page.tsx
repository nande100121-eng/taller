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
  Cpu
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
    updateDiagnosticNotes,
  } = useAppStore();

  const [activeOrderModal, setActiveOrderModal] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"diagnostic" | "parts" | "technician">("diagnostic");

  // Local state for modal forms
  const [diagnosticText, setDiagnosticText] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryItems[0]?.id || "");
  const [partQty, setPartQty] = useState(1);

  const columns: Array<{ status: WorkOrderStatus; title: string; color: string }> = [
    { status: "ingresado", title: "1. Ingresados", color: "border-blue-500/40 text-blue-400" },
    { status: "en_diagnostico", title: "2. En Diagnóstico", color: "border-purple-500/40 text-purple-400" },
    { status: "esperando_repuestos", title: "3. Esperando Repuestos", color: "border-amber-500/40 text-amber-400" },
    { status: "en_servicio", title: "4. En Servicio / Bahía", color: "border-teal-500/40 text-teal-400" },
    { status: "por_cobrar", title: "5. Por Cobrar en Caja", color: "border-emerald-500/40 text-emerald-400" },
  ];

  const handleOpenDiagnostic = (orderId: string, currentNotes?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("diagnostic");
    setDiagnosticText(currentNotes || "");
  };

  const handleOpenParts = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("parts");
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
    if (activeOrderModal && selectedInventoryId) {
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
      setActiveOrderModal(null);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Taller & Bahía de Diagnóstico</h1>
            <p className="text-xs text-gray-400">
              Tablero Kanban técnico en tiempo real, asignación de mecánicos y pedidos a Almacén.
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-6">
        {columns.map((col) => {
          const ordersInCol = workOrders.filter((wo) => wo.status === col.status);

          return (
            <div
              key={col.status}
              className="glass-panel p-4 rounded-2xl border border-white/10 space-y-4 min-w-[280px] flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className={`flex items-center justify-between border-b pb-3 ${col.color}`}>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">{col.title}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-bold text-white">
                    {ordersInCol.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {ordersInCol.map((wo) => {
                    const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                    const tech = technicians.find((t) => t.id === wo.assigned_technician_id);

                    return (
                      <div
                        key={wo.id}
                        className="p-4 rounded-xl glass-card border border-white/10 hover:border-amber-500/40 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-base text-white bg-reygas-surface px-2 py-0.5 rounded border border-white/10">
                            {wo.vehicle_plate}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            OT: #{wo.id}
                          </span>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-white block">
                            {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehículo"}
                          </span>
                          <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                            {wo.problem_description}
                          </p>
                        </div>

                        {/* Assigned Technician Badge */}
                        <div
                          onClick={() => handleOpenTechnician(wo.id, wo.assigned_technician_id)}
                          className="flex items-center justify-between p-2 rounded-lg bg-reygas-dark border border-white/5 cursor-pointer hover:border-amber-500/40"
                        >
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-semibold text-gray-200">
                              {tech ? tech.full_name : "Sin Técnico"}
                            </span>
                          </div>
                          <span className="text-[10px] text-reygas-red font-bold">Cambiar</span>
                        </div>

                        {/* Diagnostic Notes Preview */}
                        {wo.diagnostic_notes && (
                          <div className="p-2 rounded bg-purple-950/20 border border-purple-500/30 text-[11px] text-purple-200">
                            <span className="font-bold block text-purple-400">ECU Diagnóstico:</span>
                            {wo.diagnostic_notes}
                          </div>
                        )}

                        {/* Requisition Items */}
                        {wo.items.length > 0 && (
                          <div className="text-[11px] text-gray-300 space-y-1 pt-1 border-t border-white/5">
                            <span className="font-bold text-amber-400 block">
                              Repuestos Solicitados ({wo.items.length}):
                            </span>
                            {wo.items.map((item) => (
                              <div key={item.id} className="flex justify-between text-gray-400">
                                <span>{item.quantity}x {item.description}</span>
                                <span>S/ {item.subtotal}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes)}
                            className="py-1.5 px-2 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-[11px] font-bold rounded flex items-center justify-center gap-1"
                          >
                            <Cpu className="w-3 h-3" />
                            <span>Diagnóstico</span>
                          </button>
                          <button
                            onClick={() => handleOpenParts(wo.id)}
                            className="py-1.5 px-2 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-[11px] font-bold rounded flex items-center justify-center gap-1"
                          >
                            <PackagePlus className="w-3 h-3" />
                            <span>Pedir Insumo</span>
                          </button>
                        </div>

                        {/* Status Advancement Button */}
                        <div className="pt-1">
                          {wo.status === "ingresado" && (
                            <button
                              onClick={() => updateWorkOrderStatus(wo.id, "en_diagnostico")}
                              className="w-full py-1.5 bg-purple-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                            >
                              <span>Iniciar Diagnóstico</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {wo.status === "en_diagnostico" && (
                            <button
                              onClick={() => updateWorkOrderStatus(wo.id, "en_servicio")}
                              className="w-full py-1.5 bg-teal-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                            >
                              <span>Pasar a Servicio en Bahía</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {wo.status === "esperando_repuestos" && (
                            <button
                              onClick={() => updateWorkOrderStatus(wo.id, "en_servicio")}
                              className="w-full py-1.5 bg-teal-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                            >
                              <span>Repuesto Recibido ➔ En Servicio</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {wo.status === "en_servicio" && (
                            <button
                              onClick={() => updateWorkOrderStatus(wo.id, "por_cobrar")}
                              className="w-full py-1.5 bg-emerald-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                            >
                              <span>Finalizar ➔ Enviar a Caja</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALS */}
      {activeOrderModal && modalMode === "diagnostic" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/20 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <span>Checklist de Diagnóstico Computarizado ECU</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Resultados de Escáner y Notas de Diagnóstico
              </label>
              <textarea
                rows={5}
                placeholder="Presión de regulador: 1.2 bar. Mapa de inyección corregido. Inyector #3 limpiado por ultrasonido..."
                value={diagnosticText}
                onChange={(e) => setDiagnosticText(e.target.value)}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setActiveOrderModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDiagnostic}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-lg"
              >
                Guardar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}

      {activeOrderModal && modalMode === "parts" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/20 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-amber-400" />
              <span>Requisición Digital de Insumo a Almacén</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Seleccionar Repuesto del Catálogo
                </label>
                <select
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-amber-500"
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stock: {item.stock_quantity}) - S/ {item.unit_price}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={partQty}
                  onChange={(e) => setPartQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setActiveOrderModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPartRequisition}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-lg"
              >
                Enviar Solicitud a Almacén
              </button>
            </div>
          </div>
        </div>
      )}

      {activeOrderModal && modalMode === "technician" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/20 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-reygas-red" />
              <span>Asignar Técnico Responsable</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Mecánico de la Lista Maestra
              </label>
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setActiveOrderModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTechnician}
                className="px-4 py-2 bg-reygas-red text-white text-xs font-bold rounded-lg shadow-lg"
              >
                Asignar Técnico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
