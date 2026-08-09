"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { Table, UserCheck, Package, Plus, CheckCircle2, Edit3, Trash2 } from "lucide-react";

export default function AdminTablesPage() {
  const {
    technicians,
    addTechnician,
    updateTechnician,
    toggleTechnicianActive,
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"tecnicos" | "inventario">("tecnicos");

  // New Technician form
  const [techForm, setTechForm] = useState({
    full_name: "",
    specialty: "Master GNV 5ta Generación",
    phone: "",
  });

  // New Inventory Item form
  const [itemForm, setItemForm] = useState({
    sku_barcode: "",
    name: "",
    category: "Repuestos GNV/GLP",
    stock_quantity: 10,
    unit_price: 150,
    min_stock_alert: 5,
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

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addInventoryItem({
      sku_barcode: itemForm.sku_barcode.toUpperCase(),
      name: itemForm.name,
      category: itemForm.category,
      stock_quantity: Number(itemForm.stock_quantity),
      unit_price: Number(itemForm.unit_price),
      min_stock_alert: Number(itemForm.min_stock_alert),
    });
    setItemForm({
      sku_barcode: "",
      name: "",
      category: "Repuestos GNV/GLP",
      stock_quantity: 10,
      unit_price: 150,
      min_stock_alert: 5,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Table className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Edición de Tablas Maestras ERP</h1>
            <p className="text-xs text-gray-400">
              Administración en celda del Roster de Técnicos y Lista de Precios e Inventario.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("tecnicos")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "tecnicos"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Maestro de Técnicos ({technicians.length})
          </button>
          <button
            onClick={() => setActiveTab("inventario")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "inventario"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Catálogo & Precios ({inventoryItems.length})
          </button>
        </div>
      </div>

      {activeTab === "tecnicos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* New Technician Form */}
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>Registrar Nuevo Técnico en el Sistema</span>
            </h2>

            <form onSubmit={handleAddTech} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
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
                <label className="block text-xs font-medium text-gray-300 mb-1">
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
                <label className="block text-xs font-medium text-gray-300 mb-1">Teléfono</label>
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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>Lista Maestra de Técnicos Disponibles</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-reygas-dark text-xs uppercase text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Nombre del Técnico</th>
                    <th className="p-3">Especialidad</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Acciones</th>
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
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1 text-white font-bold"
                        />
                      </td>
                      <td className="p-3 text-xs text-gray-300">
                        <input
                          type="text"
                          value={t.specialty}
                          onChange={(e) => updateTechnician(t.id, { specialty: e.target.value })}
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1 text-gray-300"
                        />
                      </td>
                      <td className="p-3 text-xs font-mono">{t.phone}</td>
                      <td className="p-3">
                        <button
                          onClick={() => toggleTechnicianActive(t.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            t.is_active
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {t.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="p-3 text-xs text-indigo-400 font-bold">
                        Editable en celda
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "inventario" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* New Item Form */}
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Package className="w-5 h-5 text-indigo-400" />
              <span>Registrar Nuevo Repuesto / Servicio</span>
            </h2>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  SKU / Código *
                </label>
                <input
                  type="text"
                  required
                  placeholder="KIT-GAS-01"
                  value={itemForm.sku_barcode}
                  onChange={(e) => setItemForm({ ...itemForm, sku_barcode: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre del Repuesto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Inyector Secuencial GNV"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Precio Unitario (S/)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemForm.unit_price}
                    onChange={(e) => setItemForm({ ...itemForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    required
                    value={itemForm.stock_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, stock_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar al Catálogo</span>
              </button>
            </form>
          </div>

          {/* Master Inventory Grid with Cell Edit */}
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              <span>Grilla de Inventario Editable en Celda</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-reygas-dark text-xs uppercase text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Precio S/</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventoryItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono text-xs font-bold text-reygas-silver">
                        {item.sku_barcode}
                      </td>
                      <td className="p-3 font-bold text-white">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateInventoryItem(item.id, { name: e.target.value })}
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1 text-white font-bold w-full"
                        />
                      </td>
                      <td className="p-3 font-bold text-emerald-400">
                        <input
                          type="number"
                          value={item.stock_quantity}
                          onChange={(e) =>
                            updateInventoryItem(item.id, { stock_quantity: Number(e.target.value) })
                          }
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1 text-emerald-400 font-bold w-20"
                        />
                      </td>
                      <td className="p-3 font-bold text-white">
                        <input
                          type="number"
                          step="0.1"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateInventoryItem(item.id, { unit_price: Number(e.target.value) })
                          }
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1 text-white font-bold w-24"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
