"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { Table, UserCheck, Plus, Phone, Award, CheckCircle2 } from "lucide-react";

export default function AdminTablesPage() {
  const {
    technicians,
    addTechnician,
    updateTechnician,
    toggleTechnicianActive,
  } = useAppStore();

  // New Technician form
  const [techForm, setTechForm] = useState({
    full_name: "",
    specialty: "Master GNV 5ta Generación",
    phone: "",
  });

  const handleAddTech = (e: React.FormEvent) => {
    e.preventDefault();
    addTechnician({
      full_name: techForm.full_name,
      specialty: techForm.specialty,
      phone: techForm.phone,
      is_active: true,
    });
    setTechForm({
      full_name: "",
      specialty: "Master GNV 5ta Generación",
      phone: "",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Tabla Maestra de Personal & Técnicos</h1>
            <p className="text-xs text-gray-400">
              Administración y edición en celda de Nombres, Especialidades y Teléfonos del equipo de taller.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 text-indigo-300 text-xs font-bold">
          <span>Técnicos Registrados: <strong>{technicians.length}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* New Technician Form */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Plus className="w-5 h-5 text-indigo-400" />
            <span>Registrar Nuevo Personal</span>
          </h2>

          <form onSubmit={handleAddTech} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Mario Alvarado"
                value={techForm.full_name}
                onChange={(e) => setTechForm({ ...techForm, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Especialidad Principal *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Diagnóstico ECU & Inyección Gas"
                value={techForm.specialty}
                onChange={(e) => setTechForm({ ...techForm, specialty: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Teléfono de Contacto</label>
              <input
                type="tel"
                placeholder="+51 987654321"
                value={techForm.phone}
                onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar a la Lista Maestra</span>
            </button>
          </form>
        </div>

        {/* Technicians Master Grid */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <span>Roster de Personal (Edición Directa en Celda)</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-reygas-dark text-xs uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="p-3">Nombre del Técnico</th>
                  <th className="p-3">Especialidad</th>
                  <th className="p-3">Teléfono (Editable)</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {technicians.map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-bold text-white">
                      <input
                        type="text"
                        value={t.full_name}
                        onChange={(e) => updateTechnician(t.id, { full_name: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-white font-bold rounded"
                      />
                    </td>
                    <td className="p-3 text-xs text-gray-300">
                      <input
                        type="text"
                        value={t.specialty}
                        onChange={(e) => updateTechnician(t.id, { specialty: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-gray-300 rounded"
                      />
                    </td>
                    <td className="p-3 text-xs font-mono">
                      <input
                        type="tel"
                        value={t.phone || ""}
                        placeholder="Sin teléfono"
                        onChange={(e) => updateTechnician(t.id, { phone: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-indigo-300 font-mono rounded"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleTechnicianActive(t.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          t.is_active
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-gray-800 text-gray-500 border border-gray-700"
                        }`}
                      >
                        {t.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
