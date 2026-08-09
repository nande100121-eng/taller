"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  ShieldAlert,
  Car,
  Camera,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  Fuel,
  User,
  Phone,
  Plus
} from "lucide-react";

export default function PorteriaPage() {
  const { vehicles, workOrders, registerVehicle, createWorkOrder, updateWorkOrderStatus } = useAppStore();

  const [searchPlate, setSearchPlate] = useState("");
  const [ocrActive, setOcrActive] = useState(false);

  // Form for vehicle entry
  const [entryForm, setEntryForm] = useState({
    plate: "",
    brand: "",
    model: "",
    year: 2022,
    color: "",
    fuel_type: "GNV" as const,
    owner_name: "",
    owner_phone: "",
    current_mileage: 50000,
    problem_description: "Ingreso para mantenimiento general y revisión",
  });

  const handleSimulateOCR = () => {
    setOcrActive(true);
    setTimeout(() => {
      const samplePlates = ["ABC-123", "XYZ-987", "B7V-456", "F9K-112"];
      const randomPlate = samplePlates[Math.floor(Math.random() * samplePlates.length)];
      setEntryForm({
        ...entryForm,
        plate: randomPlate,
        brand: "Toyota",
        model: "Corolla",
        color: "Plata",
        owner_name: "Gonzalo Vargas",
        owner_phone: "+51 987112233",
      });
      setOcrActive(false);
    }, 1200);
  };

  const handleRegisterEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const plate = entryForm.plate.toUpperCase();

    // 1. Register or update vehicle
    registerVehicle({
      plate,
      brand: entryForm.brand,
      model: entryForm.model,
      year: Number(entryForm.year),
      color: entryForm.color,
      fuel_type: entryForm.fuel_type,
      owner_name: entryForm.owner_name,
      owner_phone: entryForm.owner_phone,
      current_mileage: Number(entryForm.current_mileage),
      last_visit_date: new Date().toISOString(),
    });

    // 2. Create work order
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: entryForm.problem_description,
    });

    // Reset form
    setEntryForm({
      plate: "",
      brand: "",
      model: "",
      year: 2022,
      color: "",
      fuel_type: "GNV",
      owner_name: "",
      owner_phone: "",
      current_mileage: 50000,
      problem_description: "Ingreso para mantenimiento general y revisión",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Portería & Control de Garita</h1>
            <p className="text-xs text-gray-400">
              Registro de ingreso vehicular con OCR simulado y Semáforo Inteligente de Salida.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateOCR}
            disabled={ocrActive}
            className="px-4 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-2 transition-colors"
          >
            <Camera className="w-4 h-4 text-reygas-red" />
            <span>{ocrActive ? "Escaneando Placa..." : "Simular Escaneo OCR Cámara"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Entry Registration Form */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Car className="w-5 h-5 text-reygas-red" />
            <span>Registrar Ingreso de Vehículo</span>
          </h2>

          <form onSubmit={handleRegisterEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Placa Vehículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ABC-123"
                  value={entryForm.plate}
                  onChange={(e) => setEntryForm({ ...entryForm, plate: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono font-bold uppercase focus:border-reygas-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Tipo Combustible
                </label>
                <select
                  value={entryForm.fuel_type}
                  onChange={(e) => setEntryForm({ ...entryForm, fuel_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-reygas-red"
                >
                  <option value="GNV">GNV</option>
                  <option value="GLP">GLP</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Bifuel">Bifuel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Marca</label>
                <input
                  type="text"
                  required
                  placeholder="Toyota"
                  value={entryForm.brand}
                  onChange={(e) => setEntryForm({ ...entryForm, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Modelo</label>
                <input
                  type="text"
                  required
                  placeholder="Yaris"
                  value={entryForm.model}
                  onChange={(e) => setEntryForm({ ...entryForm, model: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Color</label>
                <input
                  type="text"
                  placeholder="Plata"
                  value={entryForm.color}
                  onChange={(e) => setEntryForm({ ...entryForm, color: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Propietario / Conductor
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre Apellido"
                  value={entryForm.owner_name}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Teléfono Contacto
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+51 987654321"
                  value={entryForm.owner_phone}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Motivo de Ingreso / Falla Reportada
              </label>
              <textarea
                rows={3}
                required
                value={entryForm.problem_description}
                onChange={(e) => setEntryForm({ ...entryForm, problem_description: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-reygas-red/30"
            >
              <Plus className="w-5 h-5" />
              <span>Registrar Ingreso y Abrir OT</span>
            </button>
          </form>
        </div>

        {/* Exit Semaphore & Active Vehicles List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Semáforo de Salida e Inspección de Garita</span>
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por placa..."
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                  className="pl-9 pr-3 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white uppercase"
                />
              </div>
            </div>

            {/* List of Active Vehicles */}
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {workOrders
                .filter((wo) =>
                  searchPlate ? wo.vehicle_plate.includes(searchPlate) : true
                )
                .map((wo) => {
                  const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                  const isPaidAndAuthorized = wo.status === "pagado_autorizado" || wo.status === "finalizado";

                  return (
                    <div
                      key={wo.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPaidAndAuthorized
                          ? "bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                          : "bg-reygas-card/80 border-white/10"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                              {wo.vehicle_plate}
                            </span>
                            <span className="text-xs font-bold text-gray-300">
                              {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehículo"}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-reygas-red/20 text-reygas-red font-bold">
                              {vehicle?.fuel_type || "GNV"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1">
                            <span className="text-gray-300 font-semibold">Reporte:</span> {wo.problem_description}
                          </p>
                          <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" />
                              {vehicle?.owner_name || "Cliente"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {vehicle?.owner_phone}
                            </span>
                          </div>
                        </div>

                        {/* Semaphore Status Badge & Action */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {isPaidAndAuthorized ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black animate-pulse">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>🟢 VERDE (AUTORIZADO)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black">
                              <XCircle className="w-4 h-4" />
                              <span>🔴 ROJO (SALDO/TRABAJO PENDIENTE)</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Estado: {wo.status.replace("_", " ")}
                            </span>
                            {isPaidAndAuthorized && (
                              <button
                                onClick={() => updateWorkOrderStatus(wo.id, "finalizado")}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                              >
                                Registrar Salida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
