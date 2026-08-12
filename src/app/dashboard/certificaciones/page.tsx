"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { Award, ShieldCheck, FileText, CheckCircle2, AlertTriangle, Plus, Printer } from "lucide-react";

export default function CertificacionesPage() {
  const { certifications, addCertification, vehicles } = useAppStore();

  const [certForm, setCertForm] = useState({
    vehicle_plate: "ABC-123",
    client_name: "Luis Fernando Alva",
    chip_code: "GNV-PE-987123",
    cylinder_serial: "CYL-2026-0099",
    certification_type: "Anual GNV" as const,
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 31536000000).toISOString().slice(0, 10),
  });

  const handleCreateCert = (e: React.FormEvent) => {
    e.preventDefault();
    addCertification({
      vehicle_plate: certForm.vehicle_plate.toUpperCase(),
      client_name: certForm.client_name,
      chip_code: certForm.chip_code,
      cylinder_serial: certForm.cylinder_serial,
      certification_type: certForm.certification_type,
      issue_date: certForm.issue_date,
      expiry_date: certForm.expiry_date,
      status: "Vigente",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Certificaciones GNV / GLP</h1>
            <p className="text-xs text-gray-400">
              Control de inspecciones anuales, chips de carga y notificaciones de emisión requeridas por Taller.
            </p>
          </div>
        </div>
      </div>

      {/* PENDING NOTIFICATIONS FROM WORKSHOP */}
      {certifications.filter((c) => c.status === "Solicitado" || c.is_ready === false).length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <h2 className="text-base font-extrabold text-cyan-300 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span>Solicitudes de Certificado Notificadas por Taller (Pendientes de Emisión)</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/40">
              {certifications.filter((c) => c.status === "Solicitado" || c.is_ready === false).length} Pendiente(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications
              .filter((c) => c.status === "Solicitado" || c.is_ready === false)
              .map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-reygas-dark/80 border border-cyan-500/40 flex flex-col justify-between gap-3 shadow-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-black text-lg text-white bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                        {c.vehicle_plate}
                      </span>
                      <h4 className="text-xs font-bold text-cyan-300 mt-1.5">{c.certification_type}</h4>
                    </div>
                    <span className="font-mono font-bold text-xs text-amber-300 bg-amber-950/60 px-2 py-1 rounded border border-amber-500/30">
                      Monto a Cobrar: S/ {(c.price || 120).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[11px] text-gray-400">
                      Estado: <strong>Solicitado por Taller</strong>
                    </span>
                    <button
                      onClick={() => {
                        useAppStore.setState((state) => ({
                          certifications: state.certifications.map((item) =>
                            item.id === c.id ? { ...item, status: "Vigente", is_ready: true } : item
                          ),
                          workOrders: state.workOrders.map((wo) =>
                            wo.id === c.work_order_id || wo.vehicle_plate === c.vehicle_plate
                              ? { ...wo, certification_issued: true }
                              : wo
                          ),
                        }));
                        alert(`¡Certificación para ${c.vehicle_plate} emitida con éxito! Notificado a Caja para cobro.`);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Emitir & Notificar Listo a Caja</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <span>Emitir Nueva Certificación Anual</span>
          </h2>

          <form onSubmit={handleCreateCert} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Placa Vehículo *
                </label>
                <input
                  type="text"
                  required
                  value={certForm.vehicle_plate}
                  onChange={(e) => setCertForm({ ...certForm, vehicle_plate: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Tipo de Certificación
                </label>
                <select
                  value={certForm.certification_type}
                  onChange={(e) => setCertForm({ ...certForm, certification_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-teal-500"
                >
                  <option value="Anual GNV">Anual GNV</option>
                  <option value="Anual GLP">Anual GLP</option>
                  <option value="Prueba Hidrostática">Prueba Hidrostática (5 Años)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Propietario</label>
              <input
                type="text"
                required
                value={certForm.client_name}
                onChange={(e) => setCertForm({ ...certForm, client_name: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Código Chip de Carga
                </label>
                <input
                  type="text"
                  value={certForm.chip_code}
                  onChange={(e) => setCertForm({ ...certForm, chip_code: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Serie Cilindro
                </label>
                <input
                  type="text"
                  value={certForm.cylinder_serial}
                  onChange={(e) => setCertForm({ ...certForm, cylinder_serial: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha Emisión
                </label>
                <input
                  type="date"
                  value={certForm.issue_date}
                  onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha Vencimiento
                </label>
                <input
                  type="date"
                  value={certForm.expiry_date}
                  onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Certificado Oficial</span>
            </button>
          </form>
        </div>

        {/* Certificates Table */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span>Certificados Registrados</span>
          </h2>

          <div className="space-y-3">
            {certifications.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl glass-card border border-white/10 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-lg text-white bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                      {c.vehicle_plate}
                    </span>
                    <span className="text-xs font-bold text-teal-400">{c.certification_type}</span>
                  </div>
                  <p className="text-xs text-gray-300 font-semibold">{c.client_name}</p>
                  <div className="flex items-center gap-4 text-[11px] text-gray-500 font-mono">
                    <span>Chip: {c.chip_code}</span>
                    <span>Cilindro: {c.cylinder_serial}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      c.status === "Vigente"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {c.status} (Expira: {c.expiry_date})
                  </span>

                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-bold rounded flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Ficha</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
