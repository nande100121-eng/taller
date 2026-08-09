"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
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
  Car
} from "lucide-react";

export default function RecepcionPage() {
  const {
    appointments,
    updateAppointmentStatus,
    vehicles,
    technicians,
    workOrders,
    createWorkOrder,
    assignTechnicianToOrder,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"citas" | "radar">("citas");
  const [selectedOrderForTech, setSelectedOrderForTech] = useState<string | null>(null);

  // Filter vehicles with mileage >= 15,000 for maintenance alerts
  const maintenanceRadarVehicles = vehicles.filter(
    (v) => v.current_mileage >= 15000
  );

  const handleSendWhatsApp = (v: typeof vehicles[0]) => {
    const message = encodeURIComponent(
      `Hola *${v.owner_name}*, le saludamos de *REYGAS AUTOGAS EQUIPMENT*. Su vehículo con placa *${v.plate}* ha superado los *${v.current_mileage.toLocaleString()} KM* y le corresponde su mantenimiento preventivo de GNV/GLP para conservar la potencia de motor y evitar obstrucción de inyectores. ¿Desea agendar su cita para esta semana?`
    );
    window.open(`https://wa.me/${v.owner_phone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Recepción & Citas</h1>
            <p className="text-xs text-gray-400">
              Gestión de reservas de la web, asignación de técnicos y radar de mantenimiento 15,000 km con WhatsApp.
            </p>
          </div>
        </div>

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

      {activeTab === "citas" ? (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Solicitudes de Citas y Reservas Web</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appointments.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-xl glass-card border border-white/10 space-y-4 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-lg text-white bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                      {app.plate}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        app.status === "confirmado"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : app.status === "completado"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-base">{app.client_name}</h3>
                    <p className="text-xs text-gray-400">{app.client_phone}</p>
                    <span className="inline-block mt-2 text-xs font-semibold text-reygas-red">
                      {app.service_type}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 pt-2 border-t border-white/10">
                    <span>Fecha Agendada:</span>
                    <span className="block font-bold text-white">
                      {new Date(app.scheduled_date).toLocaleString("es-PE")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {app.status === "pendiente" && (
                      <button
                        onClick={() => updateAppointmentStatus(app.id, "confirmado")}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmar Cita</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                  <p className="text-xs text-gray-400">{v.brand} {v.model} ({v.fuel_type})</p>
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
    </div>
  );
}
