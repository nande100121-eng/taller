"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  DollarSign,
  Receipt,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Wrench,
  Package,
  ShieldCheck,
  Coins,
  Filter,
  Car
} from "lucide-react";

export default function ConsultasPage() {
  const { workOrders, invoices, vehicles, technicians } = useAppStore();

  // Search Filters & Date Navigation State
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10)); // Default today YYYY-MM-DD
  const [searchPlate, setSearchPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pagados" | "pendientes">("todos");

  // State for Plate History Timeline Modal
  const [selectedPlateHistory, setSelectedPlateHistory] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<string | null>(null);

  // Helper functions to advance or regress date by 1 day
  const handlePrevDay = () => {
    const current = new Date(queryDate + "T12:00:00");
    current.setDate(current.getDate() - 1);
    setQueryDate(current.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const current = new Date(queryDate + "T12:00:00");
    current.setDate(current.getDate() + 1);
    setQueryDate(current.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    setQueryDate(new Date().toISOString().slice(0, 10));
  };

  // Filter orders matching the selected date and plate
  const filteredOrders = workOrders.filter((wo) => {
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    const isPaid = wo.status === "pagado_autorizado" || inv?.payment_status === "pagado";

    // Plate match
    const matchPlate = searchPlate ? wo.vehicle_plate.includes(searchPlate.toUpperCase()) : true;

    // Status match
    const matchStatus =
      statusFilter === "todos" ? true : statusFilter === "pagados" ? isPaid : !isPaid;

    // Date match comparing entry_time, invoice issued_at or paid_at with selected date
    const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
    const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
    const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";

    const matchDate =
      !queryDate ||
      orderDateStr === queryDate ||
      invoiceDateStr === queryDate ||
      paidDateStr === queryDate;

    return matchPlate && matchStatus && matchDate;
  });

  // Daily statistics for selected queryDate
  const totalRevenueOnDate = invoices
    .filter(
      (inv) =>
        inv.payment_status === "pagado" &&
        ((inv.paid_at && inv.paid_at.startsWith(queryDate)) ||
          (inv.issued_at && inv.issued_at.startsWith(queryDate)))
    )
    .reduce((sum, inv) => sum + inv.grand_total, 0);

  const totalVehiclesOnDate = filteredOrders.length;
  const paidCountOnDate = filteredOrders.filter((wo) => {
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    return wo.status === "pagado_autorizado" || inv?.payment_status === "pagado";
  }).length;

  // Get all work orders for the selected plate sorted by date (newest first)
  const plateHistoryOrders = selectedPlateHistory
    ? workOrders
        .filter((wo) => wo.vehicle_plate === selectedPlateHistory)
        .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
    : [];

  const activePlateVehicle = selectedPlateHistory
    ? vehicles.find((v) => v.plate === selectedPlateHistory)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <History className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Consultas & Histórico por Día</h1>
            <p className="text-xs text-gray-400">
              Módulo de consulta general. Haga clic en cualquier tarjeta para abrir el historial completo de todas las fechas de dicha placa.
            </p>
          </div>
        </div>

        {/* Date Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3">
            <Coins className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Total Recaudado ({queryDate})
              </span>
              <span className="text-xl font-black text-white">S/ {totalRevenueOnDate.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-3">
            <Car className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-purple-300 uppercase font-bold block">Vehículos en Registro</span>
              <span className="text-xl font-black text-white">{totalVehiclesOnDate} Atendidos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Navigation & Search Controls Toolbar */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Interactive Date Selector with Prev & Next Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="px-3 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all"
              title="Día Anterior (-1 Día)"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Día Anterior</span>
            </button>

            <div className="flex items-center gap-2 bg-reygas-dark px-3 py-2 rounded-xl border border-amber-500/40 text-xs shadow-lg">
              <Calendar className="w-4 h-4 text-amber-400" />
              <input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="bg-transparent text-white font-mono font-black text-sm focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="px-3 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all"
              title="Día Siguiente (+1 Día)"
            >
              <span className="hidden sm:inline">Día Siguiente</span>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </button>

            <button
              onClick={handleToday}
              className="px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs shadow-md transition-transform hover:scale-105"
            >
              Hoy
            </button>
          </div>

          {/* Search Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por placa..."
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                className="w-full sm:w-48 pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-amber-400"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pagados">Solo Pagados ({paidCountOnDate})</option>
              <option value="pendientes">Solo Pendientes ({totalVehiclesOnDate - paidCountOnDate})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Historical Query Cards List */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>Histórico de Atenciones Registradas el {queryDate}</span>
          </h2>
          <span className="text-xs text-amber-400 font-bold font-mono">
            {filteredOrders.length} Registros Encontrados (Haga clic en una tarjeta para ver todas sus fechas)
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-bold text-gray-400">
              No hay registros de atenciones para la fecha <span className="text-amber-400 font-mono">{queryDate}</span>.
            </p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Utilice las flechas <strong>◀ Día Anterior</strong> o <strong>Día Siguiente ▶</strong> para navegar entre fechas, o limpie la búsqueda por placa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map((wo) => {
              const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
              const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
              const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
              const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
              const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
              const laborFee = 150;
              const certFee = wo.requires_certification ? wo.certification_price || 120 : 0;
              const grandTotal = invoice?.grand_total || partsTotal + laborFee + certFee;

              return (
                <div
                  key={wo.id}
                  onClick={() => {
                    setSelectedPlateHistory(wo.vehicle_plate);
                    setSelectedOrderDetails(wo.id);
                  }}
                  className="p-5 rounded-2xl border border-white/10 glass-panel bg-reygas-dark/90 space-y-4 hover:border-amber-500/60 hover:shadow-2xl transition-all cursor-pointer group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Vehicle & Client Info */}
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow inline-block group-hover:border-amber-400">
                              {wo.vehicle_plate}
                            </span>
                            <span className="text-[10px] px-2.5 py-1 bg-amber-500/20 text-amber-300 font-extrabold rounded-full border border-amber-500/30">
                              🔍 Click para Ver Histórico Completo
                            </span>
                          </div>
                          <span className="text-sm font-bold text-white block break-words">
                            {vehicle?.brand} {vehicle?.model} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                          </span>
                          <span className="text-xs text-reygas-red font-semibold block break-words">
                            Propietario: {vehicle?.owner_name || "Cliente Taller"} • Contacto: {vehicle?.owner_phone || "S/T"}
                          </span>
                        </div>

                        <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                          <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                            📅 <strong>Fecha Ingreso:</strong>{" "}
                            {wo.entry_time ? new Date(wo.entry_time).toLocaleString() : "Hoy"}
                          </span>

                          {isPaid ? (
                            <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                              💳 <strong>Estado Pago:</strong> PAGADO ✓
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                              ⏳ <strong>Estado Pago:</strong> PENDIENTE
                            </span>
                          )}

                          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-reygas-surface text-gray-300 border border-white/10">
                            Mecánico: <strong className="text-amber-400">{tech?.full_name || "Asignado"}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Concept Breakdown */}
                      <div className="p-3 bg-reygas-surface/80 rounded-xl border border-white/5 space-y-2">
                        <span className="text-[11px] font-bold uppercase text-amber-400 block">
                          Resumen de Servicios & Repuestos en la Consulta:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between items-center text-gray-300 bg-black/20 p-2 rounded-lg">
                            <span>🛠️ Mano de Obra Taller:</span>
                            <span className="font-mono font-bold text-white">S/ {laborFee.toFixed(2)}</span>
                          </div>

                          {wo.requires_certification && (
                            <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                              <span>📜 Certificado ({wo.certification_type}):</span>
                              <span className="font-mono font-bold text-cyan-300">
                                S/ {(wo.certification_price || 120).toFixed(2)}
                              </span>
                            </div>
                          )}

                          {wo.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-center text-gray-300 bg-black/20 p-2 rounded-lg"
                            >
                              <span>📦 {item.description} (x{item.quantity})</span>
                              <span className="font-mono font-bold text-amber-300">
                                S/ {item.subtotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Total Amount Badge */}
                    <div className="flex flex-col items-end justify-center gap-2 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Registrado</span>
                      <span className="text-3xl font-black text-white font-mono">
                        S/ {grandTotal.toFixed(2)}
                      </span>
                      <span className="text-[11px] px-3 py-1 rounded-full bg-reygas-surface text-gray-300 font-bold border border-white/10">
                        Orden #{wo.id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULL PLATE HISTORY TIMELINE MODAL (ALL DATES & SERVICE DETAILS) */}
      {/* ========================================================================= */}
      {selectedPlateHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/40 max-w-4xl w-full space-y-6 shadow-2xl bg-reygas-dark max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <History className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white font-mono tracking-wider">
                      {selectedPlateHistory}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                      {plateHistoryOrders.length} {plateHistoryOrders.length === 1 ? "Atención Registrada" : "Atenciones Registradas"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Propietario: <strong className="text-white">{activePlateVehicle?.owner_name || "Cliente Taller"}</strong> • Modelo: {activePlateVehicle?.brand} {activePlateVehicle?.model} ({activePlateVehicle?.year || 2023})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlateHistory(null)}
                className="p-2 rounded-xl bg-reygas-surface hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-amber-300 font-semibold bg-amber-950/40 p-3 rounded-xl border border-amber-500/30">
              💡 Haga clic en cualquier fecha de la lista para desplegar u ocultar la información completa del servicio realizado en ese día.
            </p>

            {/* List of Dates (Historical Timeline) */}
            <div className="space-y-4">
              {plateHistoryOrders.map((wo, idx) => {
                const isSelectedDate = selectedOrderDetails === wo.id;
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);

                const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
                const laborFee = 150;
                const certFee = wo.requires_certification ? wo.certification_price || 120 : 0;
                const grandTotal = invoice?.grand_total || partsTotal + laborFee + certFee;

                return (
                  <div
                    key={wo.id}
                    className={`rounded-2xl border transition-all glass-panel overflow-hidden ${
                      isSelectedDate
                        ? "border-amber-500 bg-amber-950/20 shadow-xl"
                        : "border-white/10 bg-reygas-dark/90 hover:border-amber-500/40"
                    }`}
                  >
                    {/* Date Item Header Bar (Clickable) */}
                    <div
                      onClick={() => setSelectedOrderDetails(isSelectedDate ? null : wo.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30">
                          #{plateHistoryOrders.length - idx}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-white block">
                            📅 Fecha: {wo.entry_time ? new Date(wo.entry_time).toLocaleString() : "Sin fecha"}
                          </span>
                          <span className="text-xs text-gray-400 block truncate max-w-md">
                            Falla / Motivo: {wo.problem_description || "Atención General Taller"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isPaid ? (
                          <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold">
                            PAGADO (S/ {grandTotal.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30 font-bold">
                            PENDIENTE (S/ {grandTotal.toFixed(2)})
                          </span>
                        )}

                        <span className="text-xs text-amber-400 font-bold">
                          {isSelectedDate ? "▲ Ocultar Detalle" : "▼ Ver Detalle Completo"}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Service Information Sheet (Shown when date item is clicked) */}
                    {isSelectedDate && (
                      <div className="p-5 border-t border-white/10 bg-black/40 space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Workshop & Technician Details */}
                          <div className="p-3 bg-reygas-surface rounded-xl border border-white/5 space-y-2">
                            <span className="text-[11px] font-bold text-amber-400 uppercase block">
                              ⚙️ Información de Taller & Mecánico
                            </span>
                            <div className="space-y-1 text-gray-300">
                              <p>
                                <strong>Mecánico Asignado:</strong>{" "}
                                <span className="text-white font-bold">{tech?.full_name || "Sin Asignar"}</span>
                              </p>
                              <p>
                                <strong>Especialidad:</strong> {tech?.specialty || "Mecánica General"}
                              </p>
                              <p>
                                <strong>Estado de Trabajo:</strong>{" "}
                                <span className="text-amber-300 uppercase font-bold">{wo.status}</span>
                              </p>
                            </div>
                          </div>

                          {/* Diagnostic Notes */}
                          <div className="p-3 bg-reygas-surface rounded-xl border border-white/5 space-y-2">
                            <span className="text-[11px] font-bold text-cyan-400 uppercase block">
                              📝 Diagnóstico & Observaciones Técnicas
                            </span>
                            <p className="text-gray-200 leading-relaxed italic">
                              {wo.diagnostic_notes || "Diagnóstico ejecutado con escáner computarizado y banco de inyectores. Sistema en correcto funcionamiento."}
                            </p>
                          </div>
                        </div>

                        {/* Breakdown of Labor, Certifications & Spare Parts */}
                        <div className="p-4 bg-reygas-surface/90 rounded-xl border border-white/10 space-y-3">
                          <span className="text-[11px] font-bold uppercase text-amber-400 block">
                            📦 Desglose Completo de Servicios & Materiales Usados en esta Fecha:
                          </span>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5">
                              <span>🛠️ Servicio de Mano de Obra Taller:</span>
                              <span className="font-mono font-bold text-white">S/ {laborFee.toFixed(2)}</span>
                            </div>

                            {wo.requires_certification && (
                              <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-500/30">
                                <span>📜 Certificado Oficial ({wo.certification_type}):</span>
                                <span className="font-mono font-bold text-cyan-300">
                                  S/ {(wo.certification_price || 120).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {wo.items.length === 0 ? (
                              <p className="text-[11px] text-gray-400 italic">No se requirieron repuestos de almacén para este mantenimiento.</p>
                            ) : (
                              wo.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between items-center text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5"
                                >
                                  <span>📦 {item.description} (x{item.quantity})</span>
                                  <span className="font-mono font-bold text-amber-300">
                                    S/ {item.subtotal.toFixed(2)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-white/10 text-sm font-bold">
                            <span className="text-white">Monto Total Facturado el {wo.entry_time ? new Date(wo.entry_time).toLocaleDateString() : ""}:</span>
                            <span className="font-mono text-xl text-amber-400">S/ {grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedPlateHistory(null)}
                className="px-6 py-2.5 bg-reygas-red hover:bg-red-600 text-white font-black rounded-xl text-xs shadow-lg shadow-reygas-red/30 transition-transform hover:scale-105"
              >
                Cerrar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
