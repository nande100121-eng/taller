"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAppStore, Appointment, WorkOrderStatus } from "@/lib/store/app-store";
import {
  Calendar,
  MessageSquare,
  Wrench,
  UserCheck,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Plus,
  Car,
  Edit3,
  Trash2,
  X,
  ArrowRight,
  FileText,
  Check,
  Phone
} from "lucide-react";
import { getPeruDateTimeLocal, formatPeruDateTime } from "@/lib/utils/date-utils";

export default function RecepcionPage() {
  const {
    appointments,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    vehicles,
    registerVehicle,
    technicians,
    workOrders,
    createWorkOrder,
    assignTechnicianToOrder,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"citas" | "radar">("citas");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New appointment modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    client_name: "",
    client_phone: "",
    plate: "",
    service_type: "Conversión a GNV 5ta Gen",
    scheduled_date: getPeruDateTimeLocal(new Date(Date.now() + 86400000)),
    notes: "",
  });

  // Edit appointment modal
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<Appointment | null>(null);

  // Workshop transfer modal
  const [transferApp, setTransferApp] = useState<Appointment | null>(null);
  const [transferForm, setTransferForm] = useState<{
    target_status: WorkOrderStatus;
    technician_id: string;
    problem_description: string;
  }>({
    target_status: "ingresado",
    technician_id: "",
    problem_description: "",
  });

  // Filter vehicles with mileage >= 15,000 for maintenance alerts
  const maintenanceRadarVehicles = vehicles.filter((v) => v.current_mileage >= 15000);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleSendWhatsApp = (v: (typeof vehicles)[0]) => {
    const message = encodeURIComponent(
      `Hola *${v.owner_name}*, le saludamos de *REYGAS AUTOGAS EQUIPMENT*. Su vehículo con placa *${v.plate}* ha superado los *${v.current_mileage.toLocaleString()} KM* y le corresponde su mantenimiento preventivo de GNV/GLP para conservar la potencia de motor y evitar obstrucción de inyectores. ¿Desea agendar su cita para esta semana?`
    );
    window.open(`https://wa.me/${v.owner_phone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
  };

  const handleCreateNewAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    addAppointment({
      client_name: newForm.client_name,
      client_phone: newForm.client_phone,
      plate: newForm.plate.toUpperCase(),
      service_type: newForm.service_type,
      scheduled_date: newForm.scheduled_date,
      notes: newForm.notes,
    });
    setNewModalOpen(false);
    showSuccess(`¡Cita para ${newForm.plate.toUpperCase()} registrada con éxito!`);
  };

  const handleOpenEditModal = (app: Appointment) => {
    setEditingApp(app);
    setEditForm({ ...app });
  };

  const handleSaveEditAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp || !editForm) return;

    updateAppointment(editingApp.id, {
      client_name: editForm.client_name,
      client_phone: editForm.client_phone,
      plate: editForm.plate.toUpperCase(),
      service_type: editForm.service_type,
      scheduled_date: editForm.scheduled_date,
      status: editForm.status,
      notes: editForm.notes,
    });

    setEditingApp(null);
    setEditForm(null);
    showSuccess("¡Reserva/Cita modificada con éxito!");
  };

  const handleDeleteAppointment = (id: string, plate: string) => {
    if (confirm(`¿Estás seguro de eliminar la cita del vehículo ${plate}?`)) {
      deleteAppointment(id);
      showSuccess(`Cita de ${plate} eliminada.`);
    }
  };

  const handleOpenTransferModal = (app: Appointment) => {
    setTransferApp(app);
    setTransferForm({
      target_status: "ingresado",
      technician_id: technicians[0]?.id || "",
      problem_description: `${app.service_type} - Cita web solicitada por ${app.client_name}. ${app.notes || ""}`,
    });
  };

  const handleConfirmWorkshopTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferApp) return;

    // 1. Ensure vehicle is registered
    registerVehicle({
      plate: transferApp.plate.toUpperCase(),
      brand: "Automóvil",
      model: "Genérico",
      year: new Date().getFullYear(),
      color: "Plateado",
      fuel_type: transferApp.service_type.includes("GLP") ? "GLP" : "GNV",
      owner_name: transferApp.client_name,
      owner_phone: transferApp.client_phone,
      current_mileage: 20000,
      last_visit_date: new Date().toISOString(),
    });

    // 2. Create work order in Workshop ERP
    createWorkOrder({
      vehicle_plate: transferApp.plate.toUpperCase(),
      status: transferForm.target_status,
      assigned_technician_id: transferForm.technician_id || undefined,
      problem_description: transferForm.problem_description,
      diagnostic_notes: `Ingresado desde Recepción/Citas el ${formatPeruDateTime(new Date())}`,
    });

    // 3. Mark appointment as completed
    updateAppointmentStatus(transferApp.id, "completado");

    setTransferApp(null);
    showSuccess(`¡Vehículo ${transferApp.plate} ingresado al Taller ERP con estado ${transferForm.target_status.toUpperCase()}!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Recepción & Citas</h1>
            <p className="text-xs text-gray-400">
              Gestión, edición y eliminación de reservas, ingreso directo al Taller ERP y radar 15,000 km WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setNewModalOpen(true)}
            className="px-4 py-2.5 bg-reygas-red hover:bg-reygas-redDark text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Cita Manual</span>
          </button>

          <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("citas")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "citas"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Reservas & Citas Web ({appointments.length})
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "radar"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Radar 15k KM WhatsApp ({maintenanceRadarVehicles.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "citas" ? (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>Solicitudes de Citas y Reservas Registradas</span>
              </h2>
              <span className="text-xs text-gray-400">
                Puedes editar datos, cancelar, eliminar o enviar directamente al Taller Kanban.
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-2">
                <Calendar className="w-12 h-12 mx-auto text-gray-600" />
                <p className="text-sm">No hay citas registradas en el sistema.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appointments.map((app) => (
                  <div
                    key={app.id}
                    className="p-5 rounded-2xl glass-card border border-white/10 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-4 relative group"
                  >
                    <div className="space-y-3">
                      {/* Top Plate & Status */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-lg text-white bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow-inner">
                          {app.plate}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider ${
                            app.status === "confirmado"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : app.status === "completado"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : app.status === "cancelado"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>

                      {/* Client Info */}
                      <div>
                        <h3 className="font-bold text-white text-base flex items-center justify-between">
                          <span>{app.client_name}</span>
                        </h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-reygas-red" />
                          <span>{app.client_phone}</span>
                        </p>
                        <span className="inline-block mt-2 text-xs font-extrabold text-reygas-red uppercase tracking-wider bg-reygas-red/10 px-2 py-0.5 rounded border border-reygas-red/30">
                          {app.service_type}
                        </span>
                      </div>

                      {/* Date & Notes */}
                      <div className="text-xs text-gray-300 pt-3 border-t border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Fecha Agendada:</span>
                          <span className="font-bold text-white">
                            {formatPeruDateTime(app.scheduled_date, false)}
                          </span>
                        </div>
                        {app.notes && (
                          <p className="text-[11px] text-gray-400 italic bg-reygas-dark/60 p-2 rounded border border-white/5 mt-1">
                            "{app.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      {/* Top Buttons: Transfer to Workshop & Edit */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenTransferModal(app)}
                          className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-transform hover:scale-102 shadow-md shadow-blue-600/30"
                          title="Convertir esta cita en Orden de Trabajo ERP Taller"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Enviar a Taller</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(app)}
                          className="py-2 px-3 bg-reygas-surface hover:bg-gray-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-white/10"
                          title="Editar detalles de la cita"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Editar Cita</span>
                        </button>
                      </div>

                      {/* Bottom Buttons: Confirm Status & Delete */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {app.status === "pendiente" ? (
                          <button
                            onClick={() => {
                              updateAppointmentStatus(app.id, "confirmado");
                              showSuccess(`Cita de ${app.plate} confirmada.`);
                            }}
                            className="flex-1 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirmar Cita</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" /> Cita Gestionada
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteAppointment(app.id, app.plate)}
                          className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-red-500/30 transition-colors"
                          title="Eliminar cita del sistema"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* WhatsApp 15k KM Radar */
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>Radar de Mantenimiento Preventivo 15,000 KM</span>
            </h2>
            <span className="text-xs text-gray-400">
              Despacho inteligente directo a WhatsApp del Propietario.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceRadarVehicles.map((v) => (
              <div
                key={v.plate}
                className="p-5 rounded-xl glass-card border border-amber-500/30 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-lg text-white bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                      {v.plate}
                    </span>
                    <span className="text-xs font-bold text-amber-400">
                      {v.current_mileage.toLocaleString()} KM Acumulados
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{v.owner_name}</h3>
                  <p className="text-xs text-gray-400">
                    {v.brand} {v.model} ({v.fuel_type})
                  </p>
                </div>

                <button
                  onClick={() => handleSendWhatsApp(v)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-emerald-600/30 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Alerta WhatsApp</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT APPOINTMENT / REQUEST */}
      {/* ========================================================================= */}
      {editingApp && editForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/20 space-y-4 relative">
            <button
              onClick={() => {
                setEditingApp(null);
                setEditForm(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>Editar Reserva / Cita ({editingApp.plate})</span>
              </h3>
              <p className="text-xs text-gray-400">
                Modifique los datos del cliente, servicio o fecha agendada.
              </p>
            </div>

            <form onSubmit={handleSaveEditAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.client_name}
                  onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Teléfono WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.client_phone}
                    onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.plate}
                    onChange={(e) => setEditForm({ ...editForm, plate: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Tipo de Servicio
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Estado de la Cita
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Appointment["status"] })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha y Hora Agendada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editForm.scheduled_date ? editForm.scheduled_date.slice(0, 16) : ""}
                  onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Observaciones / Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  placeholder="Detalles adicionales del requerimiento..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingApp(null);
                    setEditForm(null);
                  }}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/30"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRANSFER APPOINTMENT TO WORKSHOP ERP (KANBAN) */}
      {/* ========================================================================= */}
      {transferApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-blue-500/40 space-y-4 relative">
            <button
              onClick={() => setTransferApp(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-400" />
                <span>Ingresar Vehículo a Taller ERP ({transferApp.plate})</span>
              </h3>
              <p className="text-xs text-gray-400">
                Seleccione el estado de inicio en el flujo Kanban y asigne un técnico operativo.
              </p>
            </div>

            <form onSubmit={handleConfirmWorkshopTransfer} className="space-y-4">
              <div className="p-3 bg-reygas-dark rounded-xl border border-white/10 space-y-1 text-xs">
                <span className="text-gray-400">Datos de la Cita:</span>
                <p className="text-white font-bold">{transferApp.client_name} ({transferApp.client_phone})</p>
                <p className="text-reygas-red font-semibold">{transferApp.service_type}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Etapa de Inicio en Taller Kanban *
                </label>
                <select
                  value={transferForm.target_status}
                  onChange={(e) => setTransferForm({ ...transferForm, target_status: e.target.value as WorkOrderStatus })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ingresado">1. Ingresado (Espera de Turno en Portería)</option>
                  <option value="en_diagnostico">2. En Diagnóstico (Computadora & Regulador)</option>
                  <option value="esperando_repuestos">3. Esperando Repuestos / Kit de Gas</option>
                  <option value="en_servicio">4. En Servicio (Conversión / Mantenimiento Activo)</option>
                  <option value="por_cobrar">5. Por Cobrar (Liquidación en Caja)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Asignar Técnico Máster Responsable
                </label>
                <select
                  value={transferForm.technician_id}
                  onChange={(e) => setTransferForm({ ...transferForm, technician_id: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Sin Técnico Asignado --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Descripción del Trabajo / Diagnóstico Inicial
                </label>
                <textarea
                  rows={3}
                  required
                  value={transferForm.problem_description}
                  onChange={(e) => setTransferForm({ ...transferForm, problem_description: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferApp(null)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Confirmar Ingreso a Taller</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANUAL APPOINTMENT CREATION */}
      {/* ========================================================================= */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/20 space-y-4 relative">
            <button
              onClick={() => setNewModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-reygas-red" />
                <span>Registrar Nueva Cita Manual</span>
              </h3>
              <p className="text-xs text-gray-400">
                Para reservas telefónicas o presenciales en recepción.
              </p>
            </div>

            <form onSubmit={handleCreateNewAppointment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Ramírez"
                  value={newForm.client_name}
                  onChange={(e) => setNewForm({ ...newForm, client_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+51 987654321"
                    value={newForm.client_phone}
                    onChange={(e) => setNewForm({ ...newForm, client_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={newForm.plate}
                    onChange={(e) => setNewForm({ ...newForm, plate: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Tipo de Servicio
                </label>
                <select
                  value={newForm.service_type}
                  onChange={(e) => setNewForm({ ...newForm, service_type: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                >
                  <option value="Conversión a GNV 5ta Gen">Conversión a GNV 5ta Gen</option>
                  <option value="Conversión a GLP 5ta Gen">Conversión a GLP 5ta Gen</option>
                  <option value="Mantenimiento Preventivo 15,000 km">Mantenimiento Preventivo 15,000 km</option>
                  <option value="Certificación Anual & Prueba Hidrostática">Certificación Anual & Prueba Hidrostática</option>
                  <option value="Diagnóstico de Inyección / Escáner ECU">Diagnóstico de Inyección / Escáner ECU</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha y Hora Agendada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newForm.scheduled_date}
                  onChange={(e) => setNewForm({ ...newForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el vehículo..."
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-xs shadow-lg shadow-reygas-red/30"
                >
                  Guardar Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
