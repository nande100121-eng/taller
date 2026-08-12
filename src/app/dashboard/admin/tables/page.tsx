"use client";

import React, { useState } from "react";
import { useAppStore, WorkOrder } from "@/lib/store/app-store";
import {
  Table,
  UserCheck,
  Plus,
  Phone,
  CheckCircle2,
  Trash2,
  Upload,
  Search,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Layers,
  FileSpreadsheet
} from "lucide-react";

export default function AdminTablesPage() {
  const {
    technicians,
    addTechnician,
    updateTechnician,
    toggleTechnicianActive,
    workOrders,
    invoices,
    vehicles,
    deleteWorkOrder,
    deleteMultipleWorkOrders,
    clearAllWorkOrders,
  } = useAppStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"taller" | "personal">("taller");

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  // Selected row IDs for bulk deletion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Web Confirmation Modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: "single" | "bulk" | "clearAll";
    targetId?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    actionType: "single",
  });

  // Alert notification
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "warning"; text: string } | null>(null);

  const showAlert = (type: "success" | "warning", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // Technician Form State
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
    showAlert("success", "Técnico registrado con éxito en la lista maestra.");
  };

  // Importer for 20 Workshop Columns from CSV / Excel (Batch Processing for Performance)
  const handleImportFullWorkshopExcelCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      let rawText = (evt.target?.result as string) || "";
      rawText = rawText.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u0400-\u04FF]/g, "");

      const lines = rawText.split(/\r\n|\n/);

      const batchVehicles: any[] = [];
      const batchWorkOrders: any[] = [];
      const batchInvoices: any[] = [];

      const timestamp = Date.now();

      lines.forEach((line, idx) => {
        if (idx === 0 || !line.trim()) return;
        const cols = line.split(/,|\t|;/).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));

        const plateRaw = cols[6] || cols[0];
        if (!plateRaw) return;

        const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (!plate || plate.length < 3) return;

        const dateStr = cols[0] || new Date().toISOString().slice(0, 10);
        const quinquennial_date = cols[1] || "";
        const chip_expiry_date = cols[2] || "";
        const fuel_type = (cols[3] as any) || "GNV";
        const brand = cols[4] || "Automóvil";
        const mileage = parseInt(cols[5]) || 50000;
        const receipt_number = cols[7] || "";
        const client_name = cols[8] || "Cliente Taller";
        const client_phone = cols[9] || "+51 900000000";
        const tech_name = cols[10] || "Mecánico Asignado";
        const maintenance_service = cols[11] || "Mantenimiento General";
        const spare_parts_services = cols[12] || "";
        const price = parseFloat(cols[13]?.replace(/[^0-9.]/g, "")) || 150;
        const discounts = parseFloat(cols[14]?.replace(/[^0-9.]/g, "")) || 0;
        const credit_amount = parseFloat(cols[15]?.replace(/[^0-9.]/g, "")) || 0;
        const payment_condition = cols[16] || "Contado";
        const payment_method = cols[17] || "Efectivo";
        const payment_destination = cols[18] || "Caja Efectivo";
        const receipt_type = cols[19] || "Boleta";

        const orderId = `ot-imp-${timestamp}-${idx}`;
        const invoiceId = `inv-imp-${timestamp}-${idx}`;

        batchVehicles.push({
          plate,
          brand,
          model: "Importado",
          year: 2023,
          color: "Plata",
          fuel_type,
          owner_name: client_name,
          owner_phone: client_phone,
          current_mileage: mileage,
          last_visit_date: dateStr,
        });

        batchWorkOrders.push({
          id: orderId,
          vehicle_plate: plate,
          status: "pagado_autorizado",
          problem_description: maintenance_service,
          diagnostic_notes: `Registro Histórico Tabla Maestra. Quinquenal: ${quinquennial_date || "N/A"} • Chip Anual: ${chip_expiry_date || "N/A"} • Técnico: ${tech_name}`,
          entry_time: dateStr,
          items: spare_parts_services
            ? [
                {
                  id: `item-${timestamp}-${idx}`,
                  description: spare_parts_services,
                  quantity: 1,
                  unit_price: Math.max(0, price - 150),
                  subtotal: Math.max(0, price - 150),
                },
              ]
            : [],
          quinquennial_date,
          chip_expiry_date,
          general_maintenance_service: maintenance_service,
          spare_parts_services,
        });

        batchInvoices.push({
          id: invoiceId,
          work_order_id: orderId,
          vehicle_plate: plate,
          client_name,
          labor_fee: 150,
          parts_total: Math.max(0, price - 150),
          certification_fee: 0,
          grand_total: Math.max(0, price - discounts),
          payment_status: "pagado",
          payment_method,
          issued_at: dateStr,
          paid_at: dateStr,
          receipt_number,
          receipt_type,
          discounts,
          credit_amount,
          payment_condition,
          payment_destination,
        });
      });

      if (batchWorkOrders.length > 0) {
        useAppStore.getState().importBulkWorkshopData({
          vehicles: batchVehicles,
          workOrders: batchWorkOrders,
          invoices: batchInvoices,
        });
        showAlert("success", `¡Se importaron ${batchWorkOrders.length} registros exitosamente en menos de 1 segundo!`);
      } else {
        showAlert("warning", "Verifique que el archivo CSV contenga las columnas correctas.");
      }
    };
    reader.readAsText(file);
  };

  // Filter master records
  const filteredOrders = workOrders.filter((wo) => {
    if (!searchTerm) return true;
    const inv = invoices.find((i) => i.work_order_id === wo.id);
    const veh = vehicles.find((v) => v.plate === wo.vehicle_plate);
    const term = searchTerm.toUpperCase();

    return (
      wo.vehicle_plate.includes(term) ||
      (veh?.owner_name && veh.owner_name.toUpperCase().includes(term)) ||
      (inv?.receipt_number && inv.receipt_number.toUpperCase().includes(term))
    );
  });

  // Checkbox selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredOrders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Confirmation trigger helpers
  const triggerDeleteSingle = (id: string, plate: string) => {
    setModalConfig({
      isOpen: true,
      title: `Confirmar Eliminación de Registro`,
      description: `¿Está seguro de eliminar la fila del registro de atención de la placa ${plate}? Esta acción no se puede deshacer.`,
      actionType: "single",
      targetId: id,
    });
  };

  const triggerDeleteBulk = () => {
    if (selectedIds.length === 0) return;
    setModalConfig({
      isOpen: true,
      title: `Confirmar Eliminación de ${selectedIds.length} Filas`,
      description: `¿Está seguro de eliminar las ${selectedIds.length} filas seleccionadas de la Tabla Maestra? Se borrarán de la base de datos de Supabase.`,
      actionType: "bulk",
    });
  };

  const triggerClearAll = () => {
    setModalConfig({
      isOpen: true,
      title: `⚠️ LIMPIEZA COMPLETA DE BASE DE DATOS`,
      description: `¿Está absolutamente seguro de VACIAR TODOS los registros de atención de la Tabla Maestra? Todos los datos cargados serán eliminados de la nube de Supabase.`,
      actionType: "clearAll",
    });
  };

  // Confirm Modal Execution
  const handleConfirmAction = () => {
    if (modalConfig.actionType === "single" && modalConfig.targetId) {
      deleteWorkOrder(modalConfig.targetId);
      showAlert("success", "Registro eliminado correctamente de la Tabla Maestra.");
    } else if (modalConfig.actionType === "bulk") {
      deleteMultipleWorkOrders(selectedIds);
      showAlert("success", `Se eliminaron ${selectedIds.length} filas seleccionadas.`);
      setSelectedIds([]);
    } else if (modalConfig.actionType === "clearAll") {
      clearAllWorkOrders();
      showAlert("warning", "Base de datos de la Tabla Maestra vaciada por completo.");
      setSelectedIds([]);
    }
    setModalConfig({ ...modalConfig, isOpen: false });
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
            <h1 className="text-2xl font-black text-white">Estación de Tabla Maestra de Registros & Personal</h1>
            <p className="text-xs text-gray-400">
              Visualización, importación masiva de Excel (20 columnas) y gestión de registros de atención e insumos del taller.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 bg-reygas-dark p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("taller")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "taller"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Registros del Taller (20 Encabezados)</span>
          </button>

          <button
            onClick={() => setActiveTab("personal")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "personal"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Roster de Personal ({technicians.length})</span>
          </button>
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
            alertMsg.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/40 border-amber-500/40 text-amber-300"
          }`}
        >
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)}>✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: WORKSHOP MASTER REGISTRATION TABLE (20 HEADERS) */}
      {/* ========================================================================= */}
      {activeTab === "taller" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          {/* Controls & Import Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por placa, cliente o comprobante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white uppercase focus:border-indigo-400 w-64"
                />
              </div>

              <span className="text-xs text-gray-400 font-mono font-bold">
                {filteredOrders.length} Registros
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all border border-emerald-400/30">
                <Upload className="w-4 h-4 text-white" />
                <span>Cargar Excel Taller (20 Encabezados)</span>
                <input
                  type="file"
                  accept=".csv, .txt, .xlsx, .xls"
                  onChange={handleImportFullWorkshopExcelCSV}
                  className="hidden"
                />
              </label>

              {selectedIds.length > 0 && (
                <button
                  onClick={triggerDeleteBulk}
                  className="px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg animate-pulse"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Seleccionados ({selectedIds.length})</span>
                </button>
              )}

              <button
                onClick={triggerClearAll}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
                title="Limpieza Total de la Tabla Maestra"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpiar Base de Datos Completa</span>
              </button>
            </div>
          </div>

          {/* Master 20 Column Table Container */}
          <div className="overflow-x-auto max-h-[600px] border border-white/10 rounded-xl">
            <table className="w-full text-left text-xs text-gray-300 min-w-[1900px] relative">
              <thead className="bg-reygas-dark text-[11px] uppercase text-amber-400 sticky top-0 z-20 border-b border-white/10 shadow-md">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredOrders.length > 0 && selectedIds.length === filteredOrders.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-12 font-black">#</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">FECHA QUINTENAL</th>
                  <th className="p-3">FECHA CHIP ANUAL</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Marca</th>
                  <th className="p-3">KILOMETRAJE</th>
                  <th className="p-3 font-black text-white">PLACA</th>
                  <th className="p-3">N° Boleta/Factura</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3 max-w-[200px]">MANT. GENERAL / SERVICIO</th>
                  <th className="p-3 max-w-[200px]">REPUESTOS Y SERVICIOS</th>
                  <th className="p-3">Precio</th>
                  <th className="p-3">DESCUENTOS</th>
                  <th className="p-3">Credito</th>
                  <th className="p-3">Condicion</th>
                  <th className="p-3">METODO PAGO</th>
                  <th className="p-3">DESTINO PAGO</th>
                  <th className="p-3">COMPROBANTE</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={23} className="text-center py-16 text-gray-500">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-gray-400">No hay registros cargados en la Tabla Maestra.</p>
                      <p className="text-[11px] text-gray-500">
                        Utilice el botón <strong>"Cargar Excel Taller (20 Encabezados)"</strong> para importar su historial.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((wo, index) => {
                    const veh = vehicles.find((v) => v.plate === wo.vehicle_plate);
                    const inv = invoices.find((i) => i.work_order_id === wo.id);
                    const isSelected = selectedIds.includes(wo.id);

                    const partsTotal = wo.items.reduce((sum, item) => sum + item.subtotal, 0);
                    const grandTotal = inv?.grand_total || partsTotal + 150;

                    return (
                      <tr
                        key={wo.id}
                        className={`hover:bg-white/5 transition-colors ${
                          isSelected ? "bg-indigo-950/40" : ""
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(wo.id)}
                            className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-400">#{index + 1}</td>
                        <td className="p-3 font-mono text-purple-300">
                          {wo.entry_time ? new Date(wo.entry_time).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3 font-mono text-purple-400 font-bold">
                          {wo.quinquennial_date || "Vigente"}
                        </td>
                        <td className="p-3 font-mono text-cyan-400 font-bold">
                          {wo.chip_expiry_date || "Vigente"}
                        </td>
                        <td className="p-3 text-amber-300 font-bold">{veh?.fuel_type || "GNV"}</td>
                        <td className="p-3 text-gray-200">{veh?.brand || "Automóvil"}</td>
                        <td className="p-3 font-mono">{veh?.current_mileage || 50000} KM</td>
                        <td className="p-3 font-mono font-black text-white bg-reygas-surface/60 px-2 py-1 rounded border border-white/10">
                          {wo.vehicle_plate}
                        </td>
                        <td className="p-3 font-mono text-white">
                          {inv?.receipt_number || "S/N"}
                        </td>
                        <td className="p-3 text-white font-semibold truncate max-w-[150px]">
                          {veh?.owner_name || inv?.client_name || "Cliente Taller"}
                        </td>
                        <td className="p-3 font-mono text-gray-300">{veh?.owner_phone || "S/T"}</td>
                        <td className="p-3 text-amber-300 font-bold">
                          {wo.assigned_technician_id || "Mecánico Taller"}
                        </td>
                        <td className="p-3 truncate max-w-[200px] text-gray-200">
                          {wo.general_maintenance_service || wo.problem_description}
                        </td>
                        <td className="p-3 truncate max-w-[200px] text-gray-400">
                          {wo.spare_parts_services || (wo.items.length > 0 ? wo.items.map((i) => i.description).join(", ") : "Ninguno")}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">
                          S/ {grandTotal.toFixed(2)}
                        </td>
                        <td className="p-3 font-mono text-gray-400">
                          S/ {(inv?.discounts || 0).toFixed(2)}
                        </td>
                        <td className="p-3 font-mono text-amber-400 font-bold">
                          S/ {(inv?.credit_amount || 0).toFixed(2)}
                        </td>
                        <td className="p-3 font-bold text-gray-200">
                          {inv?.payment_condition || "Contado"}
                        </td>
                        <td className="p-3 text-emerald-300 font-bold">
                          {inv?.payment_method || "Efectivo"}
                        </td>
                        <td className="p-3 text-purple-300">
                          {inv?.payment_destination || "Caja Efectivo"}
                        </td>
                        <td className="p-3 font-bold text-cyan-300">
                          {inv?.receipt_type || "Boleta"}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => triggerDeleteSingle(wo.id, wo.vehicle_plate)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                            title="Eliminar esta fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONAL / TECHNICIANS ROSTER TABLE */}
      {/* ========================================================================= */}
      {activeTab === "personal" && (
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
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Teléfono de Contacto
                </label>
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
      )}

      {/* ========================================================================= */}
      {/* WEB NATIVE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 rounded-2xl border border-red-500/40 max-w-md w-full space-y-4 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-white">{modalConfig.title}</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{modalConfig.description}</p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="px-4 py-2 bg-reygas-surface hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-red-600/30"
              >
                Sí, Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
