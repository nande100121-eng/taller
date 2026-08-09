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
  Plus,
  Coins
} from "lucide-react";

export default function CajaPage() {
  const {
    workOrders,
    invoices,
    vehicles,
    createInvoiceForOrder,
    payInvoice,
  } = useAppStore();

  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState(
    workOrders.find((w) => w.status === "por_cobrar")?.id || ""
  );
  const [laborFee, setLaborFee] = useState<number>(100);
  const [certFee, setCertFee] = useState<number>(90);
  const [paymentMethod, setPaymentMethod] = useState("Yape / Plin");

  // Orders waiting for invoice creation
  const pendingBillingOrders = workOrders.filter(
    (wo) => wo.status === "por_cobrar" || wo.status === "en_servicio"
  );

  // Daily cash closure calculation
  const totalPaidToday = invoices
    .filter((inv) => inv.payment_status === "pagado")
    .reduce((sum, inv) => sum + inv.grand_total, 0);

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderForInvoice) {
      createInvoiceForOrder(
        selectedOrderForInvoice,
        Number(laborFee),
        Number(certFee),
        paymentMethod
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Caja & Facturación Consolidada</h1>
            <p className="text-xs text-gray-400">
              Emisión de comprobantes, cobros en efectivo/Yape y habilitación automática del Semáforo de Portería.
            </p>
          </div>
        </div>

        {/* Cash Closure Summary Pill */}
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center gap-4">
          <Coins className="w-6 h-6 text-purple-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Recaudado Hoy</span>
            <span className="text-xl font-black text-white">S/ {totalPaidToday.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Generate Invoice Form */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Receipt className="w-5 h-5 text-purple-400" />
            <span>Consolidar & Liquidar Orden de Trabajo</span>
          </h2>

          <form onSubmit={handleGenerateInvoice} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Seleccionar Orden de Trabajo *
              </label>
              <select
                value={selectedOrderForInvoice}
                onChange={(e) => setSelectedOrderForInvoice(e.target.value)}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-purple-500"
              >
                <option value="">-- Seleccionar OT --</option>
                {pendingBillingOrders.map((wo) => {
                  const v = vehicles.find((veh) => veh.plate === wo.vehicle_plate);
                  return (
                    <option key={wo.id} value={wo.id}>
                      OT #{wo.id} - Placa: {wo.vehicle_plate} ({v?.owner_name || "Cliente"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Mano de Obra (S/)
                </label>
                <input
                  type="number"
                  value={laborFee}
                  onChange={(e) => setLaborFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Certificación (S/)
                </label>
                <input
                  type="number"
                  value={certFee}
                  onChange={(e) => setCertFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-purple-500"
              >
                <option value="Yape / Plin">Yape / Plin</option>
                <option value="Efectivo">Efectivo Soles</option>
                <option value="Tarjeta POS">Tarjeta de Crédito/Débito POS</option>
                <option value="Transferencia BCP">Transferencia Bancaria</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!selectedOrderForInvoice}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              <span>Generar Comprobante de Cobro</span>
            </button>
          </form>
        </div>

        {/* Invoices List & Instant Payment Execution */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Comprobantes Emitidos y Estado de Cobro</span>
          </h2>

          <div className="space-y-3">
            {invoices.map((inv) => {
              const isPaid = inv.payment_status === "pagado";

              return (
                <div
                  key={inv.id}
                  className={`p-5 rounded-xl glass-card border transition-all ${
                    isPaid
                      ? "bg-emerald-950/20 border-emerald-500/40"
                      : "border-purple-500/40 bg-purple-950/10"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-white bg-reygas-surface px-2 py-0.5 rounded">
                          {inv.id}
                        </span>
                        <span className="font-mono font-black text-lg text-white">
                          {inv.vehicle_plate}
                        </span>
                        <span className="text-xs font-semibold text-gray-300">
                          {inv.client_name}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400 flex items-center gap-4 pt-1">
                        <span>Mano Obra: S/ {inv.labor_fee}</span>
                        <span>Repuestos: S/ {inv.parts_total}</span>
                        <span>Certificación: S/ {inv.certification_fee}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-2xl font-black text-white">
                        S/ {inv.grand_total.toFixed(2)}
                      </span>

                      {isPaid ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PAGADO (Semáforo VERDE)</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => payInvoice(inv.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cobrar & Habilitar Salida</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
