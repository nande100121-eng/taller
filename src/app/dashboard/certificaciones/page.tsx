"use client";

import React, { useState } from "react";
import { useAppStore, Certification } from "@/lib/store/app-store";
import {
  Award,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  Printer,
  Search,
  AlertCircle,
  Car,
  User,
  Phone,
  Wrench,
  X,
  Cpu,
  Calendar as CalendarIcon,
  Filter,
} from "lucide-react";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import { saveSupabaseWorkOrder } from "@/lib/supabase/services";

export default function CertificacionesPage() {
  const { certifications, addCertification, vehicles, workOrders, technicians } = useAppStore();

  // Filters State
  const [activeTab, setActiveTab] = useState<"hoy" | "pendientes" | "emitidos" | "todos">("hoy");
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State for Emitting / Editing a Certificate
  const [activeEmitModal, setActiveEmitModal] = useState<{
    isOpen: boolean;
    certification: Certification | null;
    workOrder?: any;
    vehicle?: any;
    chipCode: string;
    cylinderSerial: string;
    certificateNumber: string;
    expiryDate: string;
    notes?: string;
  } | null>(null);

  // Modal State for Creating a Manual Certificate from Scratch
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    vehicle_plate: "",
    client_name: "",
    chip_code: `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
    cylinder_serial: `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
    certification_type: "Certificado Anual GNV" as any,
    price: 80,
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });

  // Alert State
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const showAlert = (type: "success" | "warning", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4500);
  };

  // Fast lookups
  const vehiclesMap = React.useMemo(() => {
    const map = new Map<string, any>();
    vehicles.forEach((v) => {
      if (v?.plate) map.set(v.plate.toUpperCase().trim(), v);
    });
    return map;
  }, [vehicles]);

  const workOrdersMap = React.useMemo(() => {
    const map = new Map<string, any>();
    workOrders.forEach((wo) => {
      if (wo?.id) map.set(wo.id, wo);
    });
    return map;
  }, [workOrders]);

  const techniciansMap = React.useMemo(() => {
    const map = new Map<string, any>();
    technicians.forEach((t) => {
      if (t?.id) map.set(t.id, t);
    });
    return map;
  }, [technicians]);

  // Combined list of all certifications (from store)
  const allCertifications = React.useMemo(() => {
    return [...certifications].sort(
      (a, b) => new Date(b.issue_date || "").getTime() - new Date(a.issue_date || "").getTime()
    );
  }, [certifications]);

  // Counts
  const counts = React.useMemo(() => {
    const todayStr = queryDate || new Date().toISOString().slice(0, 10);
    const hoyCount = allCertifications.filter((c) => (c.issue_date || "").slice(0, 10) === todayStr).length;
    const pendientesCount = allCertifications.filter((c) => c.status === "Solicitado" || c.is_ready === false).length;
    const emitidosCount = allCertifications.filter((c) => c.status === "Vigente" || c.is_ready === true).length;
    return {
      hoy: hoyCount,
      pendientes: pendientesCount,
      emitidos: emitidosCount,
      todos: allCertifications.length,
    };
  }, [allCertifications, queryDate]);

  // Filtered list
  const filteredCertifications = React.useMemo(() => {
    return allCertifications.filter((c) => {
      // Tab filter
      if (activeTab === "hoy") {
        const certDate = (c.issue_date || "").slice(0, 10);
        if (certDate !== queryDate) return false;
      } else if (activeTab === "pendientes") {
        if (c.status !== "Solicitado" && c.is_ready !== false) return false;
      } else if (activeTab === "emitidos") {
        if (c.status !== "Vigente" && c.is_ready !== true) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase().trim();
        const plate = (c.vehicle_plate || "").toUpperCase();
        const client = (c.client_name || "").toUpperCase();
        const type = (c.certification_type || "").toUpperCase();
        const chip = (c.chip_code || "").toUpperCase();
        if (!plate.includes(q) && !client.includes(q) && !type.includes(q) && !chip.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allCertifications, activeTab, queryDate, searchQuery]);

  // Handle open emit modal
  const handleOpenEmitModal = (cert: Certification) => {
    const wo = cert.work_order_id ? workOrdersMap.get(cert.work_order_id) : undefined;
    const veh = vehiclesMap.get(cert.vehicle_plate?.toUpperCase().trim());

    setActiveEmitModal({
      isOpen: true,
      certification: cert,
      workOrder: wo,
      vehicle: veh,
      chipCode: cert.chip_code || `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
      cylinderSerial: cert.cylinder_serial || `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
      certificateNumber: `CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: cert.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      notes: "Inspección técnica satisfactoria. Cumple normativa MTC / Produce.",
    });
  };

  // Submit emission confirmation
  const handleConfirmEmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmitModal?.certification) return;

    const cert = activeEmitModal.certification;
    const updatedCert: Certification = {
      ...cert,
      chip_code: activeEmitModal.chipCode,
      cylinder_serial: activeEmitModal.cylinderSerial,
      expiry_date: activeEmitModal.expiryDate,
      status: "Vigente",
      is_ready: true,
    };

    useAppStore.setState((state) => {
      const updatedCerts = state.certifications.map((item) =>
        item.id === cert.id ? updatedCert : item
      );

      const updatedWorkOrders = state.workOrders.map((wo) => {
        if (wo.id === cert.work_order_id || wo.vehicle_plate === cert.vehicle_plate) {
          const uWo = { ...wo, certification_issued: true };
          saveSupabaseWorkOrder(uWo);
          return uWo;
        }
        return wo;
      });

      return {
        certifications: updatedCerts,
        workOrders: updatedWorkOrders,
      };
    });

    showAlert(
      "success",
      `¡Certificado "${cert.certification_type}" para ${cert.vehicle_plate} emitido con éxito! Notificado a Taller y Caja.`
    );
    setActiveEmitModal(null);
  };

  // Create manual cert
  const handleCreateManualCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.vehicle_plate.trim()) {
      showAlert("warning", "Ingrese una placa válida.");
      return;
    }

    addCertification({
      vehicle_plate: manualForm.vehicle_plate.toUpperCase().trim(),
      client_name: manualForm.client_name.trim() || "Cliente Particular",
      chip_code: manualForm.chip_code,
      cylinder_serial: manualForm.cylinder_serial,
      certification_type: manualForm.certification_type,
      issue_date: manualForm.issue_date,
      expiry_date: manualForm.expiry_date,
      price: manualForm.price,
      status: "Vigente",
      is_ready: true,
    });

    showAlert("success", `¡Certificado para ${manualForm.vehicle_plate.toUpperCase()} registrado correctamente!`);
    setIsManualModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all animate-fadeIn ${
            alertMsg.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
              : "bg-amber-950/90 text-amber-300 border border-amber-500/50"
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Certificaciones Vehiculares</h1>
            <p className="text-xs text-gray-400">
              Notificaciones de emisión de certificados requeridas por Taller, chips de carga e inspecciones reglamentarias.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsManualModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>+ Emitir Nuevo Certificado Manual</span>
        </button>
      </div>

      {/* Filter Toolbar with Tabs, Mini Calendar, and Search */}
      <div className="bg-reygas-dark p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs: Del Día / Hoy vs Pendientes vs Emitidos vs Todos */}
          <div className="flex flex-wrap items-center gap-1.5 bg-reygas-surface p-1 rounded-xl border border-white/10 text-xs font-bold w-full sm:w-auto">
            {/* 1. Del Día / Hoy */}
            <button
              onClick={() => setActiveTab("hoy")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "hoy"
                  ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-600/30 font-black scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Del Día / Hoy ({counts.hoy})</span>
            </button>

            {/* 2. Pendientes */}
            <button
              onClick={() => setActiveTab("pendientes")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "pendientes"
                  ? "bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes ({counts.pendientes})</span>
            </button>

            {/* 3. Emitidos */}
            <button
              onClick={() => setActiveTab("emitidos")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "emitidos"
                  ? "bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Emitidos ({counts.emitidos})</span>
            </button>

            {/* 4. Todos */}
            <button
              onClick={() => setActiveTab("todos")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "todos"
                  ? "bg-blue-600 text-white font-black shadow-lg shadow-blue-600/30 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>Todos ({counts.todos})</span>
            </button>
          </div>

          {/* Mini Calendar Picker (Web Dark Theme) */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <MiniDatePicker
              value={queryDate}
              onChange={(newDate) => {
                setQueryDate(newDate);
                setActiveTab("hoy");
              }}
            />

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar placa, cliente, tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-cyan-400 font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid Representation */}
      <div className="space-y-4">
        {filteredCertifications.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-400 space-y-3 rounded-2xl border border-white/10">
            <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">No hay certificaciones que coincidan con los filtros seleccionados.</p>
            {activeTab === "hoy" && (
              <button
                onClick={() => setActiveTab("pendientes")}
                className="px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-bold rounded-xl border border-cyan-500/30 transition-colors"
              >
                Ver certificaciones pendientes de emisión ({counts.pendientes})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCertifications.map((c) => {
              const veh = vehiclesMap.get(c.vehicle_plate?.toUpperCase().trim());
              const wo = c.work_order_id ? workOrdersMap.get(c.work_order_id) : undefined;
              const tech = wo?.assigned_technician_id ? techniciansMap.get(wo.assigned_technician_id) : undefined;
              const isPending = c.status === "Solicitado" || c.is_ready === false;

              return (
                <div
                  key={c.id}
                  className={`glass-panel p-5 rounded-2xl border transition-all space-y-4 shadow-xl ${
                    isPending
                      ? "border-cyan-500/50 bg-cyan-950/20 hover:border-cyan-400"
                      : "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                  }`}
                >
                  {/* Card Header: Plate, Status & Type */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xl text-white bg-reygas-surface px-3 py-0.5 rounded-xl border border-white/10 tracking-wider shadow">
                          {c.vehicle_plate}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                            isPending
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {isPending ? "⏳ Solicitado por Taller" : "✅ Emitido / Vigente"}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-cyan-300 flex items-center gap-1.5 pt-0.5">
                        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{c.certification_type}</span>
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Monto</span>
                      <span className="font-mono font-black text-base text-amber-300 bg-reygas-dark px-2.5 py-1 rounded-xl border border-amber-500/30">
                        S/ {(c.price || 80).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Vehicle & Customer Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1 bg-reygas-dark/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span>Cliente / Propietario:</span>
                      </span>
                      <p className="font-bold text-white truncate">
                        {c.client_name || veh?.owner_name || "Cliente Particular"}
                      </p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-gray-500" />
                        <span>{veh?.owner_phone || "Sin celular"}</span>
                      </p>
                    </div>

                    <div className="space-y-1 bg-reygas-dark/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                        <Car className="w-3 h-3 text-amber-400" />
                        <span>Vehículo:</span>
                      </span>
                      <p className="font-bold text-white truncate">
                        {veh ? `${veh.brand} ${veh.model}` : "Gas Vehicular"}
                      </p>
                      <p className="text-[11px] text-amber-300 font-semibold">
                        {veh?.fuel_type || "GNV"} • {veh?.color || "Color s/e"}
                      </p>
                    </div>
                  </div>

                  {/* Technical & Chips Info */}
                  <div className="p-2.5 bg-reygas-dark/90 rounded-xl border border-white/10 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400">Código Chip:</span>
                      <span className="font-bold text-cyan-300">{c.chip_code || "Sin asignar"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400">Serie Cilindro:</span>
                      <span className="font-bold text-white">{c.cylinder_serial || "Sin asignar"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-1">
                      <span className="text-gray-400 font-sans">Fecha Emisión:</span>
                      <span className="text-gray-200">{(c.issue_date || "").slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400 font-sans">Vencimiento:</span>
                      <span className="text-amber-400 font-bold">{(c.expiry_date || "").slice(0, 10)}</span>
                    </div>
                    {tech && (
                      <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-1 font-sans">
                        <span className="text-gray-400">Mecánico de Taller:</span>
                        <span className="text-gray-200 font-semibold">{tech.full_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <span className="text-[11px] text-gray-400 font-semibold">
                      {isPending ? "⚠️ Requiere emisión oficial" : "📜 Certificado emitido y vigente"}
                    </span>

                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <button
                          onClick={() => handleOpenEmitModal(c)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-transform hover:scale-105"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Emitir & Notificar Listo a Caja</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 bg-reygas-surface hover:bg-white/10 text-gray-200 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Imprimir Ficha</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: EMIT OFFICIAL CERTIFICATE (CERTIFICADOR FLOW) */}
      {activeEmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-reygas-dark border border-cyan-500/50 max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Emitir Certificado Oficial de Inspección</h3>
                  <p className="text-xs text-gray-400">
                    Vehículo: <strong className="text-white font-mono">{activeEmitModal.certification?.vehicle_plate}</strong> • {activeEmitModal.certification?.certification_type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveEmitModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEmission} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Código Chip de Carga *</label>
                  <input
                    type="text"
                    required
                    value={activeEmitModal.chipCode}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, chipCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Serie Cilindro Gas *</label>
                  <input
                    type="text"
                    required
                    value={activeEmitModal.cylinderSerial}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, cylinderSerial: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">N° de Certificado Oficial</label>
                  <input
                    type="text"
                    value={activeEmitModal.certificateNumber}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, certificateNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={activeEmitModal.expiryDate}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">Observaciones Técnicas del Certificador</label>
                <textarea
                  rows={2}
                  value={activeEmitModal.notes}
                  onChange={(e) => setActiveEmitModal({ ...activeEmitModal, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white focus:border-cyan-400"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Al emitir, la orden de trabajo en Taller se marcará como lista y se habilitará el comprobante en Caja.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveEmitModal(null)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmar & Emitir Certificado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL CERTIFICATE CREATION */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-reygas-dark border border-teal-500/50 max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Emitir Nueva Certificación Particular</h3>
                  <p className="text-xs text-gray-400">Ingreso manual de inspección vehicular reglamentaria</p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCert} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Placa Vehicular *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ABC-123"
                    value={manualForm.vehicle_plate}
                    onChange={(e) => setManualForm({ ...manualForm, vehicle_plate: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Tipo de Certificación *</label>
                  <select
                    value={manualForm.certification_type}
                    onChange={(e) => setManualForm({ ...manualForm, certification_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-bold focus:border-teal-400"
                  >
                    <option value="Certificado Anual GNV">Certificado Anual GNV (S/ 80.00)</option>
                    <option value="Certificado Anual GLP">Certificado Anual GLP (S/ 80.00)</option>
                    <option value="Prueba Hidrostática de Cilindro GNV">Prueba Hidrostática (5 Años) (S/ 180.00)</option>
                    <option value="Desbloqueo de Chip GNV">Desbloqueo de Chip (S/ 25.00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Propietario / Cliente</label>
                  <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={manualForm.client_name}
                    onChange={(e) => setManualForm({ ...manualForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Precio Cobrado (S/) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Código Chip de Carga</label>
                  <input
                    type="text"
                    value={manualForm.chip_code}
                    onChange={(e) => setManualForm({ ...manualForm, chip_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Serie Cilindro</label>
                  <input
                    type="text"
                    value={manualForm.cylinder_serial}
                    onChange={(e) => setManualForm({ ...manualForm, cylinder_serial: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    value={manualForm.issue_date}
                    onChange={(e) => setManualForm({ ...manualForm, issue_date: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={manualForm.expiry_date}
                    onChange={(e) => setManualForm({ ...manualForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-black rounded-xl shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Certificado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
