"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  CreditCard,
  DollarSign,
  Receipt,
  CheckCircle2,
  Lock,
  Printer,
  ShieldCheck,
  Coins,
  Package,
  Wrench,
  Clock
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
  } = useAppStore();

  const [activeTabFilter, setActiveTabFilter] = useState<"todos" | "pendientes" | "pagados">("todos");

  // Orders that reached "por_cobrar" or "pagado_autorizado" step in Taller
  const billingWorkOrders = workOrders.filter(
    (wo) => wo.status === "por_cobrar" || wo.status === "pagado_autorizado"
  );

  // Daily cash closure calculation
  const totalPaidToday = invoices
    .filter((inv) => inv.payment_status === "pagado")
    .reduce((sum, inv) => sum + inv.grand_total, 0);

  const pendingCount = workOrders.filter((wo) => wo.status === "por_cobrar").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Caja & Cobros Automáticos</h1>
            <p className="text-xs text-gray-400">
              Visualización de comprobantes por cobrar generados automáticamente desde la pestaña Taller.
            </p>
          </div>
        </div>

        {/* Cash Closure Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-3">
            <Coins className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Recaudado Hoy</span>
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

      {/* Main Billing Cards Section */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Comprobantes y Cuentas por Cobrar de Taller</h2>
          </div>

          <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => setActiveTabFilter("todos")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTabFilter === "todos"
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Todos ({billingWorkOrders.length})
            </button>
            <button
              onClick={() => setActiveTabFilter("pendientes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTabFilter === "pendientes"
                  ? "bg-amber-500 text-black font-extrabold shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Por Cobrar ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTabFilter("pagados")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTabFilter === "pagados"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Pagados ({billingWorkOrders.length - pendingCount})
            </button>
          </div>
        </div>

        {billingWorkOrders.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Receipt className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-sm font-bold text-gray-400">
              No hay vehículos en la fase "Por Cobrar" en este momento.
            </p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Cuando los técnicos en la pestaña <strong>4. Taller</strong> muevan un vehículo al paso 5 (Por Cobrar), aparecerá automáticamente aquí para su cobro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {billingWorkOrders
              .filter((wo) => {
                if (activeTabFilter === "pendientes") return wo.status === "por_cobrar";
                if (activeTabFilter === "pagados") return wo.status === "pagado_autorizado";
                return true;
              })
              .map((wo) => {
                const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
                const invoice = invoices.find((inv) => inv.work_order_id === wo.id);
                const isPaid = wo.status === "pagado_autorizado" || invoice?.payment_status === "pagado";
                const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
                const laborFee = 150; // Tarifa estándar taller
                const grandTotal = invoice?.grand_total || partsTotal + laborFee;

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
                                🚗 <strong>Fecha/Hora Ingreso:</strong>{" "}
                                {wo.entry_time
                                  ? new Date(wo.entry_time).toLocaleString()
                                  : "Hoy"}
                              </span>

                              {isPaid && (
                                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                  💳 <strong>Fecha/Hora Pago:</strong>{" "}
                                  {invoice?.paid_at
                                    ? new Date(invoice.paid_at).toLocaleString()
                                    : invoice?.issued_at
                                    ? new Date(invoice.issued_at).toLocaleString()
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
                            <div className="flex justify-between items-center text-gray-300 bg-white/5 p-2 rounded-lg">
                              <span>🛠️ Mano de Obra Taller:</span>
                              <span className="font-mono font-bold text-white">S/ {laborFee.toFixed(2)}</span>
                            </div>

                            {wo.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-gray-300 bg-white/5 p-2 rounded-lg"
                              >
                                <span>📦 {item.description} (x{item.quantity})</span>
                                <span className="font-mono font-bold text-amber-300">
                                  {item.subtotal > 0 ? `S/ ${item.subtotal.toFixed(2)}` : "En Almacén"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Total Amount & Action Button */}
                      <div className="flex flex-col items-end justify-center gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Monto Total a Cobrar</span>
                          <span className="text-3xl font-black text-white font-mono">
                            S/ {grandTotal.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          {isPaid ? (
                            <button
                              onClick={() => {
                                if (invoice) togglePayInvoice(invoice.id);
                                else payInvoice(wo.id);
                              }}
                              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-black flex items-center gap-2 transition-all"
                              title="Haga clic para revertir estado a pendiente por cobrar"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>PAGADO (Cambiar a Confirmar)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (invoice) {
                                  togglePayInvoice(invoice.id);
                                } else {
                                  createInvoiceForOrder(wo.id, laborFee, 0, "Efectivo / Yape");
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
    </div>
  );
}
