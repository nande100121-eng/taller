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
  Edit3,
  ShieldCheck,
  Lock,
  Unlock
} from "lucide-react";

export default function TallerPage() {
  const {
    workOrders,
    updateWorkOrderStatus,
    assignTechnicianToOrder,
    technicians,
    vehicles,
    inventoryItems,
    invoices,
    addWorkOrderItem,
    removeWorkOrderItem,
    updateDiagnosticNotes,
    requestCertificationForWorkOrder,
  } = useAppStore();

  const [searchPlate, setSearchPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Modals for actions
  const [activeOrderModal, setActiveOrderModal] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"diagnostic" | "parts" | "technician" | "certificate">("diagnostic");

  // Form states inside modals
  const [diagnosticText, setDiagnosticText] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [certType, setCertType] = useState<"Anual GNV" | "Anual GLP" | "Prueba Hidrostática">("Anual GNV");
  const [certPrice, setCertPrice] = useState<number>(120);

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
    setPartQty(1);
  };

  const handleOpenCertModal = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("certificate");
    setCertType("Anual GNV");
    setCertPrice(120);
  };

  const handleSaveCertification = () => {
    if (activeOrderModal) {
      requestCertificationForWorkOrder(activeOrderModal, certType, Number(certPrice));
      alert(`¡Certificación "${certType}" (S/ ${certPrice}) solicitada e ingresada al flujo de cobro en Caja! Se notificó al Encargado de Certificaciones.`);
      setActiveOrderModal(null);
    }
  };

  // Requisition form (Catalog or Custom text)
  const [isCustomPart, setIsCustomPart] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryItems[0]?.id || "custom");
  const [customPartName, setCustomPartName] = useState("");
  const [partQty, setPartQty] = useState(1);

  const handleSaveDiagnostic = () => {
    if (activeOrderModal) {
      // Automatic status switch to "en_diagnostico" upon adding/modifying diagnostic
      updateDiagnosticNotes(activeOrderModal, diagnosticText);
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
        unit_price: 0,
      });
      updateWorkOrderStatus(activeOrderModal, "esperando_repuestos");
    } else {
      const item = inventoryItems.find((i) => i.id === selectedInventoryId);
      if (item) {
        addWorkOrderItem(activeOrderModal, {
          inventory_item_id: item.id,
          description: item.name,
          quantity: Number(partQty),
          unit_price: item.unit_price || 0,
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
            const invoice = invoices.find((i) => i.work_order_id === wo.id);
            const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
            const isLocked = isPaid && !wo.allow_modifications;

            // Current step index in pipeline
            const currentStepIdx = statusSteps.findIndex((s) => s.status === wo.status);

            return (
              <div
                key={wo.id}
                className={`glass-panel p-6 rounded-2xl border transition-all space-y-6 ${
                  isLocked
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : "border-white/10 hover:border-amber-500/30"
                }`}
              >
                {/* Locked Banner if Paid */}
                {isLocked && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        🔒 ORDEN PAGADA EN CAJA - MODIFICACIONES BLOQUEADAS EN TALLER
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-200 font-normal">
                      (Para modificar, desmarcar pago o pulsar "Permitir Modificación" en la pestaña Caja & Facturación)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
                      <p className="text-xs text-gray-400 font-semibold">
                        {vehicle?.color || "Color no especificado"} •{" "}
                        <span className="text-reygas-red">{vehicle?.fuel_type || "GNV"}</span>
                      </p>
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

                  {/* Center Column: Interactive Progress Stepper, Description, DIAGNOSTICO & MECANICO ASIGNADO */}
                  <div className="lg:col-span-5 space-y-4 px-0 lg:px-2">
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
                              disabled={isLocked}
                              onClick={() => updateWorkOrderStatus(wo.id, step.status)}
                              className={`py-2 px-1.5 rounded-lg text-[10px] font-extrabold transition-all text-center flex flex-col items-center justify-center gap-1 border ${
                                isCurrent
                                  ? `${step.color} text-black border-white shadow-lg`
                                  : isPassed
                                  ? "bg-reygas-surface text-gray-200 border-white/20 hover:border-amber-400"
                                  : "bg-reygas-dark/60 text-gray-500 border-white/5 hover:border-white/20"
                              } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
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

                    {/* Diagnostic Notes */}
                    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                      <span className="font-bold text-purple-400 block text-[11px] uppercase flex items-center justify-between">
                        <span>Diagnóstico Técnico ECU:</span>
                        {!isLocked && (
                          <button
                            onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes)}
                            className="text-[10px] text-purple-300 hover:text-white underline font-normal"
                          >
                            {wo.diagnostic_notes ? "Editar Diagnóstico" : "+ Añadir Diagnóstico"}
                          </button>
                        )}
                      </span>
                      <p className="mt-0.5 text-xs italic">
                        {wo.diagnostic_notes || "Pendiente de diagnóstico computarizado."}
                      </p>
                    </div>

                    {/* REQUERIMIENTO #2: EL MECANICO ASIGNADO DEBAJO DEL DIAGNOSTICO */}
                    <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-amber-400">
                        👨‍🔧 Mecánico Asignado Responsable:
                      </label>
                      <div className="relative">
                        <select
                          disabled={isLocked}
                          value={wo.assigned_technician_id || ""}
                          onChange={(e) => assignTechnicianToOrder(wo.id, e.target.value)}
                          className={`w-full pl-8 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs font-semibold text-white focus:border-amber-400 ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
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
                  </div>

                  {/* Right Column: REPUESTOS SOLICITADOS A ALMACEN & DEBAJO SERVICIO DE CERTIFICADO */}
                  <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-4">
                    {/* Action buttons toolbar */}
                    {!isLocked && (
                      <div className="grid grid-cols-3 gap-2">
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

                        <button
                          onClick={() => handleOpenCertModal(wo.id)}
                          className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors ${
                            wo.requires_certification
                              ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/40"
                              : "bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 border-blue-500/30"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{wo.requires_certification ? "Certificado Solicitado" : "+ Certificado"}</span>
                        </button>
                      </div>
                    )}

                    {/* REQUERIMIENTO #1: SECCION DE REPUESTOS SOLICITADOS */}
                    <div className="space-y-2 p-3 bg-reygas-dark/60 rounded-xl border border-white/5">
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
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
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
                                    ✓ Entregado
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">
                                    ⏳ Pendiente
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-gray-300 text-xs">S/ {item.subtotal}</span>
                                {!isLocked && (
                                  <button
                                    onClick={() => removeWorkOrderItem(wo.id, item.id)}
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                    title="Quitar repuesto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* REQUERIMIENTO #1: SERVICIO DE CERTIFICADO DEBAJO DE REPUESTOS SOLICITADOS */}
                    {wo.requires_certification ? (
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-cyan-400" />
                            <span>Servicio de Certificación DEBAJO de Repuestos</span>
                          </span>
                          <span className="font-mono text-cyan-200 font-bold bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
                            S/ {(wo.certification_price || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-cyan-200">
                          Tipo: <strong>{wo.certification_type}</strong> • State:{" "}
                          {wo.certification_issued ? "✅ Emitido en Certificaciones" : "⏳ Notificado y Pendiente"}
                        </p>
                      </div>
                    ) : (
                      !isLocked && (
                        <button
                          onClick={() => handleOpenCertModal(wo.id)}
                          className="w-full py-2 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>+ Agregar Servicio de Certificación a esta Orden</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals for Diagnostic, Parts Requisition and Certification */}
      {activeOrderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalMode === "diagnostic" && (
                  <>
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <span>Registrar / Editar Diagnóstico de Falla ECU</span>
                  </>
                )}
                {modalMode === "parts" && (
                  <>
                    <PackagePlus className="w-5 h-5 text-amber-400" />
                    <span>Solicitar Repuestos a Almacén</span>
                  </>
                )}
                {modalMode === "certificate" && (
                  <>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <span>Solicitar Certificación de Vehículo</span>
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

            {modalMode === "certificate" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    TIPO DE CERTIFICACIÓN REQUERIDA *
                  </label>
                  <select
                    value={certType}
                    onChange={(e) => setCertType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400"
                  >
                    <option value="Anual GNV">Certificado Anual GNV</option>
                    <option value="Anual GLP">Certificado Anual GLP</option>
                    <option value="Prueba Hidrostática">Prueba Hidrostática de Cilindro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    PRECIO DE CERTIFICACIÓN (S/) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={certPrice}
                    onChange={(e) => setCertPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-cyan-400"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Este servicio se colocará debajo de la sección de repuestos solicitados y se cargará a Caja.
                  </p>
                </div>

                <button
                  onClick={handleSaveCertification}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guardar Servicio de Certificado Debajo de Repuestos</span>
                </button>
              </div>
            )}

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
                  Guardar Diagnóstico y Seleccionar Estado "2. En Diagnóstico"
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
