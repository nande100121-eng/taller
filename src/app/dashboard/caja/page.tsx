"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  CreditCard,
  DollarSign,
  Receipt,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  ShieldCheck,
  Coins,
  Package,
  Wrench,
  Clock,
  Search,
  Calendar,
  Filter,
  History,
  FileText,
  User,
  Phone
} from "lucide-react";

export default function CajaPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    technicians,
    createInvoiceForOrder,
    payInvoice,
    togglePayInvoice,
    toggleAllowModificationsInWorkshop,
  } = useAppStore();

  const [activeMainTab, setActiveMainTab] = useState<"caja" | "consultas">("caja");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"todos" | "pendientes" | "pagados">("todos");
  
  // Search Filters
  const [searchPlate, setSearchPlate] = useState("");
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10)); // Default today

  // Orders that reached "por_cobrar" or "pagado_autorizado" or have an invoice registered
  const allBillingWorkOrders = workOrders.filter(
    (wo) =>
      wo.status === "por_cobrar" ||
      wo.status === "pagado_autorizado" ||
      wo.status === "finalizado" ||
      invoices.some((inv) => inv.work_order_id === wo.id)
  );

  // Daily cash closure calculation for today
  const totalPaidToday = invoices
    .filter(
      (inv) =>
        inv.payment_status === "pagado" &&
        ((inv.paid_at && inv.paid_at.startsWith(queryDate)) ||
          (inv.issued_at && inv.issued_at.startsWith(queryDate)))
    )
    .reduce((sum, inv) => sum + inv.grand_total, 0);

  const pendingCount = workOrders.filter((wo) => wo.status === "por_cobrar").length;
  const paidCount = allBillingWorkOrders.filter((wo) => {
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    return wo.status === "pagado_autorizado" || inv?.payment_status === "pagado";
  }).length;

  // Filtered orders for Caja Tab
  const filteredCajaOrders = allBillingWorkOrders.filter((wo) => {
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    const isPaid = wo.status === "pagado_autorizado" || inv?.payment_status === "pagado";

    const matchPlate = searchPlate ? wo.vehicle_plate.includes(searchPlate) : true;
    const matchStatus =
      activeStatusFilter === "todos"
        ? true
        : activeStatusFilter === "pendientes"
        ? !isPaid
        : isPaid;

    return matchPlate && matchStatus;
  });

  // Filtered orders for Consultas (Historical Query by Selected Date) Tab
  const filteredConsultasOrders = allBillingWorkOrders.filter((wo) => {
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    const matchPlate = searchPlate ? wo.vehicle_plate.includes(searchPlate) : true;

    // Compare date with entry_time or invoice issued_at / paid_at
    const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
    const invoiceDateStr = inv?.issued_at ? inv.issued_at.slice(0, 10) : "";
    const paidDateStr = inv?.paid_at ? inv.paid_at.slice(0, 10) : "";

    const matchDate =
      !queryDate ||
      orderDateStr === queryDate ||
      invoiceDateStr === queryDate ||
      paidDateStr === queryDate;

    return matchPlate && matchDate;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Caja, Facturación & Histórico de Consultas</h1>
            <p className="text-xs text-gray-400">
              Gestión centralizada de cobros, histórico diario por fecha y buscador por placa.
            </p>
          </div>
        </div>

        {/* Cash Closure Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-3">
            <Coins className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Recaudado ({queryDate === new Date().toISOString().slice(0, 10) ? "Hoy" : queryDate})
              </span>
              <span className="text-xl font-black text-white">S/ {totalPaidToday.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Por Cobrar en Taller</span>
              <span className="text-xl font-black text-amber-400">{pendingCount} Vehículos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-reygas-dark p-2 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveMainTab("caja")}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
              activeMainTab === "caja"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>📌 Caja & Cobros Activos ({allBillingWorkOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab("consultas")}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
              activeMainTab === "consultas"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <History className="w-4 h-4" />
            <span>📊 Consultas & Histórico por Día</span>
          </button>
        </div>

        {/* Global Search Filters (Plate & Date) */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              className="w-full sm:w-44 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400"
            />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={queryDate}
              onChange={(e) => setQueryDate(e.target.value)}
              className="w-full sm:w-40 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CAJA & COBROS ACTIVOS */}
      {/* ========================================================================= */}
      {activeMainTab === "caja" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Comprobantes y Cuentas por Cobrar de Taller</h2>
            </div>

            <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveStatusFilter("todos")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "todos"
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Todos ({allBillingWorkOrders.length})
              </button>
              <button
                onClick={() => setActiveStatusFilter("pendientes")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pendientes"
                    ? "bg-amber-500 text-black font-extrabold shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Por Cobrar ({pendingCount})
              </button>
              <button
                onClick={() => setActiveStatusFilter("pagados")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStatusFilter === "pagados"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Pagados ({paidCount})
              </button>
            </div>
          </div>

          {filteredCajaOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Receipt className="w-12 h-12 text-gray-500 mx-auto" />
              <p className="text-sm font-bold text-gray-400">
                No hay vehículos registradas en Caja con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCajaOrders.map((wo) => {
                const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
                const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
                const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
                const grandTotal = invoice?.grand_total !== undefined ? invoice.grand_total : partsTotal + certFee;
                const allowModInWorkshop = wo.allow_modifications;

                return (
                  <div
                    key={wo.id}
                    className={`p-5 rounded-2xl border transition-all glass-panel hover:border-purple-500/40 ${
                      isPaid
                        ? "bg-emerald-950/20 border-emerald-500/40"
                        : "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Vehicle & Client Info */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                            {wo.vehicle_plate}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {vehicle?.brand} {vehicle?.model} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                            </span>
                            <span className="text-xs text-reygas-red font-semibold">
                              Cliente: {vehicle?.owner_name || "Cliente Taller"} • Teléfono: {vehicle?.owner_phone || "S/T"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-auto">
                            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                              🚗 <strong>Registro:</strong>{" "}
                              {wo.entry_time ? new Date(wo.entry_time).toLocaleString() : "Hoy"}
                            </span>

                            {isPaid && (
                              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                💳 <strong>Pago Confirmado:</strong>{" "}
                                {invoice?.paid_at
                                  ? new Date(invoice.paid_at).toLocaleString()
                                  : new Date().toLocaleString()}
                              </span>
                            )}

                            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-reygas-surface text-gray-300 border border-white/10">
                              Técnico: <strong className="text-amber-400">{tech?.full_name || "Asignado"}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Parts and Concept Detail */}
                        <div className="p-3 bg-reygas-dark/60 rounded-xl border border-white/5 space-y-2">
                          <span className="text-[11px] font-bold uppercase text-gray-400 block">
                            Detalle de Servicio y Repuestos en Orden #{wo.id}:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {wo.requires_certification && (
                              <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                                <span>📜 Certificado ({wo.certification_type}):</span>
                                <span className="font-mono font-bold text-cyan-300">
                                  S/ {(wo.certification_price || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {wo.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-gray-300 bg-white/5 p-2 rounded-lg"
                              >
                                <span>{item.item_type === "servicio" ? "🛠️" : "📦"} {item.description} (x{item.quantity})</span>
                                <span className="font-mono font-bold text-amber-300">
                                  {item.subtotal >= 0 ? `S/ ${item.subtotal.toFixed(2)}` : "En Almacén"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Total Amount & Action Buttons (Payment & Modification Unlock) */}
                      <div className="flex flex-col items-end justify-center gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Monto Total</span>
                          <span className="text-3xl font-black text-white font-mono">
                            S/ {grandTotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {isPaid ? (
                            <>
                              <button
                                onClick={() => {
                                  if (invoice) togglePayInvoice(invoice.id);
                                  else payInvoice(wo.id);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-black flex items-center gap-2 transition-all"
                                title="Haga clic para revertir estado a pendiente por cobrar"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>PAGADO (Desmarcar Pago)</span>
                              </button>

                              {/* REQUERIMIENTO #3: BOTON EN CAJA PARA PERMITIR MODIFICAR EN TALLER */}
                              <button
                                onClick={() => toggleAllowModificationsInWorkshop(wo.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                  allowModInWorkshop
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                    : "bg-gray-800 text-gray-400 border-white/10 hover:text-white"
                                }`}
                              >
                                {allowModInWorkshop ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>🔓 Modificación Habilitada en Taller</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                                    <span>🔒 Habilitar Modificación en Taller</span>
                                  </>
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                if (invoice) {
                                  togglePayInvoice(invoice.id);
                                } else {
                                  createInvoiceForOrder(wo.id, 0, certFee, "Efectivo / Yape");
                                  setTimeout(() => {
                                    const created = invoices.find((i) => i.work_order_id === wo.id);
                                    if (created) payInvoice(created.id);
                                  }, 100);
                                }
                              }}
                              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                            >
                              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                              <span>Confirmar Cobro & Habilitar Salida</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CONSULTAS & HISTORICO POR DIA (CARDS DE HISTORIAL) */}
      {/* ========================================================================= */}
      {activeMainTab === "consultas" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Histórico de Consultas por Día & Placa</h2>
                <p className="text-xs text-gray-400">
                  Mostrando registros de vehículos y comprobantes registrados el día{" "}
                  <strong className="text-amber-400 font-mono">{queryDate}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-reygas-dark px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-gray-300 font-bold">Día de Consulta:</span>
              <input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="bg-transparent text-white font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          {filteredConsultasOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto" />
              <p className="text-sm font-bold text-gray-400">
                No hay registros ni vehículos ingresados en la fecha <span className="text-amber-400">{queryDate}</span>.
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Seleccione otra fecha en el selector superior o limpie la búsqueda por placa para explorar el histórico.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredConsultasOrders.map((wo) => {
                const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
                const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
                const certFee = wo.requires_certification ? wo.certification_price || 0 : 0;
                const grandTotal = invoice?.grand_total !== undefined ? invoice.grand_total : partsTotal + certFee;

                return (
                  <div
                    key={wo.id}
                    className="p-5 rounded-2xl border border-white/10 glass-panel bg-reygas-dark/90 space-y-4 hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Vehicle & Client Info */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                            {wo.vehicle_plate}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {vehicle?.brand} {vehicle?.model} ({vehicle?.year || 2023}) - {vehicle?.color || "Color"}
                            </span>
                            <span className="text-xs text-reygas-red font-semibold">
                              Propietario: {vehicle?.owner_name || "Cliente Taller"} • Contacto: {vehicle?.owner_phone || "S/T"}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1 ml-auto">
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
                                ⏳ <strong>Estado Pago:</strong> POR COBRAR
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
                            {wo.requires_certification && (
                              <div className="flex justify-between items-center text-cyan-200 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                                <span>📜 Certificado ({wo.certification_type}):</span>
                                <span className="font-mono font-bold text-cyan-300">
                                  S/ {(wo.certification_price || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {wo.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-gray-300 bg-black/20 p-2 rounded-lg"
                              >
                                <span>{item.item_type === "servicio" ? "🛠️" : "📦"} {item.description} (x{item.quantity})</span>
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
      )}
    </div>
  );
}
