"use client";

import React, { useState, useEffect } from "react";
import { useAppStore, WorkOrder, WorkshopService, generateUUID } from "@/lib/store/app-store";
import { parseCSVRows, parseISODate, parseWorkshopRow } from "@/lib/csv-parser";
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
  FileSpreadsheet,
  Wrench,
  ShieldCheck,
  Sliders,
  CheckSquare,
  Square,
  Edit3,
  Check,
  X
} from "lucide-react";

const ALL_ERP_STATIONS = [
  { id: "/dashboard/porteria", label: "1. Portería" },
  { id: "/dashboard/recepcion", label: "2. Recepción" },
  { id: "/dashboard/taller", label: "3. Taller" },
  { id: "/dashboard/almacen", label: "4. Almacén" },
  { id: "/dashboard/caja", label: "5. Caja" },
  { id: "/dashboard/certificaciones", label: "6. Certificaciones" },
  { id: "/dashboard/asistencia", label: "7. Asistencia" },
  { id: "/dashboard/consultas", label: "8. Consultas" },
  { id: "/dashboard/reportes", label: "9. Reportes" },
  { id: "/dashboard/admin/tables", label: "10. Tablas Maestras" },
  { id: "/dashboard/configuracion", label: "11. Configuración" },
];

export default function AdminTablesPage() {
  const {
    technicians,
    addTechnician,
    updateTechnician,
    toggleTechnicianActive,
    workshopServices,
    addWorkshopService,
    updateWorkshopService,
    deleteWorkshopService,
    workOrders,
    invoices,
    vehicles,
    deleteWorkOrder,
    deleteMultipleWorkOrders,
    clearAllWorkOrders,
    isSyncing,
    hasSyncedOnce,
    syncFromSupabase,
  } = useAppStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"taller" | "personal" | "servicios">("taller");

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  // Pagination state (250 items per page for instant mobile & tablet rendering)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const ITEMS_PER_PAGE = 250;

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [deferredSearchTerm]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

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
    can_receive_payment: false,
  });

  const handleAddTech = (e: React.FormEvent) => {
    e.preventDefault();
    addTechnician({
      full_name: techForm.full_name,
      specialty: techForm.specialty,
      phone: techForm.phone,
      is_active: true,
      can_receive_payment: techForm.can_receive_payment,
    });
    setTechForm({
      full_name: "",
      specialty: "Master GNV 5ta Generación",
      phone: "",
      can_receive_payment: false,
    });
    showAlert("success", "Personal registrado con éxito en la lista maestra.");
  };

  // Importer for 20 Workshop Columns from CSV / Excel (Batch Processing for Performance)
  const handleImportFullWorkshopExcelCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = (evt.target?.result as string) || "";
      const rows = parseCSVRows(rawText);

      const batchVehicles: any[] = [];
      const batchWorkOrders: any[] = [];
      const batchInvoices: any[] = [];

      const timestamp = Date.now();

      rows.forEach((cols, idx) => {
        if (idx === 0 || cols.length === 0) return;

        const record = parseWorkshopRow(cols);
        if (!record || !record.plate) return;

        const is_explicit_paid = record.paymentCondition.toUpperCase().includes("PAGADO");
        const is_credit_order = !is_explicit_paid && (
          record.creditAmount > 0 ||
          record.paymentCondition.toUpperCase().includes("CREDIT") ||
          record.paymentCondition.toUpperCase().includes("PENDIENTE")
        );

        const base_amount = record.price > 0 ? record.price : record.creditAmount;
        const discountNum = typeof record.discounts === "number" ? record.discounts : (parseFloat(String(record.discounts).replace(/[^0-9.]/g, "")) || 0);
        const parts_total = base_amount + discountNum;
        const grand_total = base_amount;
        const payment_status = is_explicit_paid
          ? "pagado"
          : (is_credit_order ? "pendiente" : (record.price > 0 ? "pagado" : (record.receiptNumber && record.receiptNumber !== "0" ? "pagado" : "pendiente")));
        const order_status = is_explicit_paid
          ? "pagado_autorizado"
          : (is_credit_order ? "por_cobrar" : (record.price > 0 ? "pagado_autorizado" : (record.receiptNumber && record.receiptNumber !== "0" ? "pagado_autorizado" : "en_espera")));

        const orderId = generateUUID();
        const invoiceId = generateUUID();
        const labor_fee = 0;

        batchVehicles.push({
          plate: record.plate,
          brand: record.brand,
          model: "",
          year: 0,
          color: "",
          fuel_type: record.fuelType as any,
          vehicle_type: record.vehicleType,
          owner_name: record.clientName,
          owner_phone: record.clientPhone,
          current_mileage: record.mileage,
          last_visit_date: record.dateISO,
        });

        batchWorkOrders.push({
          id: orderId,
          vehicle_plate: record.plate,
          status: order_status,
          problem_description: record.maintenanceService,
          diagnostic_notes: `Registro Histórico Tabla Maestra. Quinquenal: ${record.quinquennialDate} • Chip Anual: ${record.chipExpiryDate} • Técnico: ${record.technicianName}${record.discounts ? ` • [DESCUENTO]: ${record.discounts}` : ""}${record.creditAmount > 0 ? ` • [CREDITO]: ${record.creditAmount}` : ""}`,
          observations: "",
          assigned_technician_id: record.technicianName,
          entry_time: record.dateISO,
          vehicle_type: record.vehicleType,
          items: record.sparePartsServices || record.maintenanceService
            ? [
                {
                  id: `item-${timestamp}-${idx}`,
                  description: record.sparePartsServices || record.maintenanceService,
                  quantity: 1,
                  unit_price: parts_total,
                  subtotal: parts_total,
                },
              ]
            : [],
          quinquennial_date: record.quinquennialDate,
          chip_expiry_date: record.chipExpiryDate,
          general_maintenance_service: record.maintenanceService,
          spare_parts_services: record.sparePartsServices,
        });

        batchInvoices.push({
          id: invoiceId,
          work_order_id: orderId,
          vehicle_plate: record.plate,
          client_name: record.clientName,
          labor_fee,
          parts_total,
          certification_fee: 0,
          grand_total,
          payment_status,
          payment_method: record.paymentMethod,
          issued_at: record.dateISO,
          paid_at: is_credit_order ? undefined : record.dateISO,
          receipt_number: record.receiptNumber,
          receipt_type: record.receiptType,
          discounts: record.discounts,
          credit_amount: record.creditAmount,
          raw_price_str: record.rawPrice,
          raw_credit_str: record.rawCredit,
          payment_condition: record.paymentCondition,
          payment_destination: record.paymentDestination,
        });
      });

      if (batchWorkOrders.length > 0) {
        useAppStore.getState().importBulkWorkshopData({
          vehicles: batchVehicles,
          workOrders: batchWorkOrders,
          invoices: batchInvoices,
        }).then((res) => {
          if (res?.success) {
            showAlert("success", `¡Se importaron ${batchWorkOrders.length} registros exitosamente y guardados en Supabase!`);
          } else {
            showAlert("warning", `Guardados localmente. Notificación de Supabase: ${res?.errorMsg || "Respuesta diferida"}`);
          }
        });
      } else {
        showAlert("warning", "Verifique que el archivo CSV contenga las columnas correctas.");
      }
    };
    reader.readAsText(file);
  };

  // O(1) Lookup maps for fast linear filtering (prevents O(N^2) lockup on 9,000+ records)
  const invoicesByWorkOrderId = React.useMemo(() => {
    const map = new Map<string, (typeof invoices)[0]>();
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (inv && inv.work_order_id) {
        map.set(inv.work_order_id, inv);
      }
    }
    return map;
  }, [invoices]);

  const vehiclesByPlate = React.useMemo(() => {
    const map = new Map<string, (typeof vehicles)[0]>();
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v && v.plate) {
        map.set(v.plate, v);
      }
    }
    return map;
  }, [vehicles]);

  // Filter master records with instant memoized lookup
  const filteredOrders = React.useMemo(() => {
    if (!deferredSearchTerm.trim()) return workOrders;
    const term = deferredSearchTerm.trim().toUpperCase();

    return workOrders.filter((wo) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      const veh = vehiclesByPlate.get(wo.vehicle_plate);

      return (
        (wo.vehicle_plate && wo.vehicle_plate.toUpperCase().includes(term)) ||
        (veh?.owner_name && veh.owner_name.toUpperCase().includes(term)) ||
        (inv?.client_name && inv.client_name.toUpperCase().includes(term)) ||
        (inv?.receipt_number && inv.receipt_number.toUpperCase().includes(term))
      );
    });
  }, [workOrders, invoicesByWorkOrderId, vehiclesByPlate, deferredSearchTerm]);

  // Calculate Pagination slice
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, startIndex, endIndex]);

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
        <div className="flex flex-wrap items-center gap-2 bg-reygas-dark p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("taller")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "taller"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Registros del Taller (20 Encabezados + Obs)</span>
          </button>

          <button
            onClick={() => setActiveTab("personal")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "personal"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Roster & Permisos de Personal ({technicians.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("servicios")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "servicios"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Catálogo de Servicios de Taller ({workshopServices?.length || 0})</span>
          </button>
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold animate-fadeIn ${
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
      {/* TAB 1: WORKSHOP MASTER REGISTRATION TABLE (20 HEADERS + OBSERVACIONES) */}
      {/* ========================================================================= */}
      {activeTab === "taller" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          {/* Controls & Import Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
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

              <button
                onClick={() => syncFromSupabase()}
                disabled={isSyncing}
                className="px-3.5 py-2 bg-reygas-surface hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1.5 shadow"
                title="Refrescar datos manualmente desde la base de datos Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Sincronizando..." : "Refrescar Tabla"}</span>
              </button>

              {selectedIds.length > 0 && (
                <button
                  onClick={triggerDeleteBulk}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-red-600/30 animate-pulse"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Seleccionados ({selectedIds.length})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/30 whitespace-nowrap">
                <Upload className="w-4 h-4" />
                <span>Cargar Excel Taller (21 Encabezados)</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFullWorkshopExcelCSV}
                  className="hidden"
                />
              </label>

              {workOrders.length > 0 && (
                <button
                  onClick={triggerClearAll}
                  className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                  title="Eliminar absolutamente todos los registros de la tabla maestra"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Vaciar Todo</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Table Grid */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs text-gray-300 whitespace-nowrap">
              <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedOrders.length > 0 &&
                        paginatedOrders.every((o) => selectedIds.includes(o.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-12 font-black">#</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">FECHA QUINTENAL</th>
                  <th className="p-3">FECHA CHIP ANUAL</th>
                  <th className="p-3">TIPO</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Marca</th>
                  <th className="p-3">KILOMETRAJE</th>
                  <th className="p-3 font-black text-white">PLACA</th>
                  <th className="p-3">N° de boleta/Factura</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3 max-w-[200px]">MANT. GENERAL / SERVICIO</th>
                  <th className="p-3 max-w-[200px]">REPUESTOS Y SERVICIOS</th>
                  <th className="p-3">Precio</th>
                  <th className="p-3">DESCUENTOS</th>
                  <th className="p-3">Credito</th>
                  <th className="p-3">Condicion</th>
                  <th className="p-3">METODO DE PAGO</th>
                  <th className="p-3">DESTINO DE PAGO</th>
                  <th className="p-3">COMPROBANTE</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="text-center py-16 text-gray-500">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-gray-400">No hay registros cargados en la Tabla Maestra.</p>
                      <p className="text-[11px] text-gray-500">
                        Utilice el botón <strong>"Cargar Excel Taller (21 Encabezados)"</strong> para importar su historial.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((wo, index) => {
                    const veh = vehiclesByPlate.get(wo.vehicle_plate) || vehicles.find((v) => v.plate === wo.vehicle_plate);
                    const inv = invoicesByWorkOrderId.get(wo.id) || invoices.find((i) => i.work_order_id === wo.id);
                    const isSelected = selectedIds.includes(wo.id);

                    const priceVal = inv?.raw_price_str !== undefined && inv.raw_price_str !== ""
                      ? (inv.raw_price_str.startsWith("$") || inv.raw_price_str.startsWith("S/")
                          ? inv.raw_price_str
                          : `S/ ${parseFloat(inv.raw_price_str.replace(/[^0-9.]/g, "")).toFixed(2)}`)
                      : (inv?.grand_total !== undefined && inv.grand_total > 0
                          ? `S/ ${inv.grand_total.toFixed(2)}`
                          : (wo.items.length > 0 && wo.items[0].subtotal > 0 ? `S/ ${wo.items[0].subtotal.toFixed(2)}` : ""));

                    const discountVal = inv?.discounts !== undefined && inv.discounts !== ""
                      ? String(inv.discounts)
                      : "";

                    const creditVal = inv?.raw_credit_str !== undefined && inv.raw_credit_str !== ""
                      ? (inv.raw_credit_str.startsWith("$") || inv.raw_credit_str.startsWith("S/")
                          ? inv.raw_credit_str
                          : `S/ ${parseFloat(inv.raw_credit_str.replace(/[^0-9.]/g, "")).toFixed(2)}`)
                      : (inv?.credit_amount && inv.credit_amount > 0 ? `S/ ${inv.credit_amount.toFixed(2)}` : "");

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
                        <td className="p-3 font-mono font-bold text-gray-400">#{startIndex + index + 1}</td>
                        <td className="p-3 font-mono text-purple-300">
                          {wo.entry_time ? (wo.entry_time.includes("T") ? new Date(wo.entry_time).toLocaleDateString("es-PE") : wo.entry_time) : ""}
                        </td>
                        <td className="p-3 font-mono text-purple-400 font-bold">{wo.quinquennial_date || ""}</td>
                        <td className="p-3 font-mono text-cyan-400 font-bold">{wo.chip_expiry_date || ""}</td>
                        <td className="p-3 text-cyan-300 font-semibold">{wo.vehicle_type || veh?.vehicle_type || ""}</td>
                        <td className="p-3 text-amber-300 font-bold">{veh?.fuel_type || ""}</td>
                        <td className="p-3 text-gray-200">{veh?.brand || ""}</td>
                        <td className="p-3 font-mono">{veh?.current_mileage && veh.current_mileage > 0 ? `${veh.current_mileage}` : ""}</td>
                        <td className="p-3 font-mono font-black text-white bg-reygas-surface/60 px-2 py-1 rounded border border-white/10">{wo.vehicle_plate}</td>
                        <td className="p-3 font-mono text-white">{inv?.receipt_number || ""}</td>
                        <td className="p-3 text-white font-semibold truncate max-w-[150px]">{veh?.owner_name || inv?.client_name || ""}</td>
                        <td className="p-3 font-mono text-gray-300">{veh?.owner_phone || ""}</td>
                        <td className="p-3 text-amber-300 font-bold">{wo.assigned_technician_id || ""}</td>
                        <td className="p-3 truncate max-w-[200px] text-gray-200">{wo.general_maintenance_service || wo.problem_description || ""}</td>
                        <td className="p-3 truncate max-w-[200px] text-gray-400">{wo.spare_parts_services || (wo.items.length > 0 ? wo.items.map((i) => i.description).join(", ") : "")}</td>
                        <td className="p-3 font-mono font-bold text-white">{priceVal}</td>
                        <td className="p-3 font-mono text-gray-400">{discountVal}</td>
                        <td className="p-3 font-mono text-amber-400 font-bold">{creditVal}</td>
                        <td className="p-3 font-bold text-gray-200">{inv?.payment_condition || ""}</td>
                        <td className="p-3 text-emerald-300 font-bold">{inv?.payment_method || ""}</td>
                        <td className="p-3 text-purple-300">{inv?.payment_destination || ""}</td>
                        <td className="p-3 font-bold text-cyan-300">{inv?.receipt_type || ""}</td>
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

          {/* Pagination Navigation */}
          {filteredOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs">
              <div className="text-gray-400">
                Mostrando registros <span className="text-white font-bold">{startIndex + 1}</span> a{" "}
                <span className="text-white font-bold">{Math.min(endIndex, filteredOrders.length)}</span> de{" "}
                <span className="text-white font-bold">{filteredOrders.length.toLocaleString()}</span> totales
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  <span>&larr;</span>
                  <span>Anterior ({ITEMS_PER_PAGE})</span>
                </button>

                {/* Direct Jump to Page Input / Quick Selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-amber-500/40 text-gray-300 font-semibold shadow">
                  <span className="text-amber-400 font-bold">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(pageInput);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1 bg-reygas-dark border border-white/20 rounded-lg text-white font-mono font-black text-center focus:border-amber-400 focus:outline-none"
                  />
                  <span>de <strong className="text-white font-black">{totalPages}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseInt(pageInput);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg transition-transform hover:scale-105 shadow text-xs"
                  >
                    Ir
                  </button>
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  <span>Siguientes ({ITEMS_PER_PAGE})</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONAL & PERMISOS POR PESTAÑA */}
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
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre Completo *</label>
                <input type="text" required placeholder="Ej: Mario Alvarado" value={techForm.full_name} onChange={(e) => setTechForm({ ...techForm, full_name: e.target.value })} className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Especialidad Principal *</label>
                <input type="text" required placeholder="Ej: Diagnóstico ECU & Inyección Gas" value={techForm.specialty} onChange={(e) => setTechForm({ ...techForm, specialty: e.target.value })} className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Teléfono de Contacto</label>
                <input type="tel" placeholder="+51 987654321" value={techForm.phone} onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })} className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white" />
              </div>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.can_receive_payment}
                  onChange={(e) => setTechForm({ ...techForm, can_receive_payment: e.target.checked })}
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500"
                />
                <span>💳 Habilitado como Destino de Cobro (Caja / Reportes)</span>
              </label>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Agregar a la Lista Maestra</span>
              </button>
            </form>
          </div>

          {/* Technicians Master Grid with Permissions Matrix */}
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  <span>Roster de Personal & Control de Pestañas Activas</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Marque o desmarque con check las estaciones operativas y la autorización para recibir pagos de cada personal.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {technicians.map((t) => {
                const allowed = t.allowed_tabs || ALL_ERP_STATIONS.map((s) => s.id);
                const allActive = allowed.length === ALL_ERP_STATIONS.length;

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-reygas-dark/80 border border-white/10 space-y-3 hover:border-indigo-500/40 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                          {t.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{t.full_name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-normal">
                              {t.specialty}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">
                            Tel: {t.phone || "Sin teléfono"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-950/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!t.can_receive_payment}
                            onChange={(e) => {
                              updateTechnician(t.id, { can_receive_payment: e.target.checked });
                              showAlert("success", `${t.full_name} ${e.target.checked ? "habilitado" : "deshabilitado"} como destino de pago.`);
                            }}
                            className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>💳 Cobro</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const newTabs = allActive ? [] : ALL_ERP_STATIONS.map((s) => s.id);
                            updateTechnician(t.id, { allowed_tabs: newTabs });
                            showAlert("success", `Permisos de ${t.full_name} actualizados.`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/10"
                        >
                          {allActive ? "Desmarcar Todos" : "Marcar Todos"}
                        </button>
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
                      </div>
                    </div>

                    {/* Checkboxes Grid for Stations */}
                    <div>
                      <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">
                        Estaciones y Pestañas Permitidas ({allowed.length}/{ALL_ERP_STATIONS.length}):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {ALL_ERP_STATIONS.map((station) => {
                          const isChecked = allowed.includes(station.id);
                          return (
                            <label
                              key={station.id}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                                isChecked
                                  ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-200"
                                  : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  let nextTabs: string[];
                                  if (isChecked) {
                                    nextTabs = allowed.filter((s) => s !== station.id);
                                  } else {
                                    nextTabs = [...allowed, station.id];
                                  }
                                  updateTechnician(t.id, { allowed_tabs: nextTabs });
                                }}
                                className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="truncate">{station.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WORKSHOP SERVICES CATALOG (CONFIGURABLE SERVICES & PRICES) */}
      {/* ========================================================================= */}
      {activeTab === "servicios" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Service Create / Edit Form */}
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Wrench className="w-5 h-5 text-indigo-400" />
              <span>{techForm.full_name ? "Editar Servicio" : "Nuevo Servicio de Taller"}</span>
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("serviceName") as HTMLInputElement).value;
                const category = (form.elements.namedItem("serviceCategory") as HTMLInputElement).value;
                const price = parseFloat((form.elements.namedItem("servicePrice") as HTMLInputElement).value) || 0;
                const desc = (form.elements.namedItem("serviceDesc") as HTMLTextAreaElement).value;

                addWorkshopService({
                  name,
                  category: category || "Mantenimiento",
                  price,
                  description: desc,
                  is_active: true,
                });
                showAlert("success", `Servicio "${name}" registrado con precio S/ ${price.toFixed(2)}.`);
                form.reset();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre del Servicio de Taller *</label>
                <input name="serviceName" type="text" required placeholder="Ej: Calibración Computarizada 5ta Gen" className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Categoría</label>
                <input name="serviceCategory" type="text" defaultValue="Mantenimiento" placeholder="Ej: Diagnóstico, Inyección, Calibración..." className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Precio Estándar en Taller (S/) *</label>
                <input name="servicePrice" type="number" step="0.1" min="0" required defaultValue="80" placeholder="0.00" className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono focus:border-indigo-400" />
                <p className="text-[11px] text-gray-400 mt-1">Permite S/ 0 para servicios de cortesía o revisión inicial gratuita.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Descripción / Alcance del Servicio</label>
                <textarea name="serviceDesc" rows={3} placeholder="Ej: Incluye escaneo de sensores, ajuste de tiempos de inyección y prueba de ruta." className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400" />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Guardar Servicio en Catálogo</span>
              </button>
            </form>
          </div>

          {/* Services Catalog Master Grid */}
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-400" />
                  <span>Catálogo de Servicios Disponibles para Taller</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Los precios configurados aquí aparecerán listados al solicitar servicios desde el tablero Kanban de Taller.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Servicio de Taller</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 font-mono text-amber-300">Precio (S/) (Editable)</th>
                    <th className="p-3 max-w-[200px]">Descripción</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {(workshopServices || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        No hay servicios registrados en el catálogo. Utilice el formulario lateral para agregar servicios.
                      </td>
                    </tr>
                  ) : (
                    (workshopServices || []).map((srv) => (
                      <tr key={srv.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white">
                          <input type="text" value={srv.name} onChange={(e) => updateWorkshopService(srv.id, { name: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-white font-bold rounded" />
                        </td>
                        <td className="p-3 text-gray-300">
                          <input type="text" value={srv.category || "General"} onChange={(e) => updateWorkshopService(srv.id, { category: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-gray-300 rounded" />
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400 font-bold">S/</span>
                            <input type="number" step="0.1" min="0" value={srv.price} onChange={(e) => updateWorkshopService(srv.id, { price: parseFloat(e.target.value) || 0 })} className="w-24 bg-reygas-surface/80 border border-white/10 hover:border-indigo-400 focus:border-indigo-400 px-2 py-1 text-amber-300 font-mono font-bold rounded" />
                          </div>
                        </td>
                        <td className="p-3 text-gray-400 truncate max-w-[200px]">
                          <input type="text" value={srv.description || ""} placeholder="Descripción breve..." onChange={(e) => updateWorkshopService(srv.id, { description: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-gray-400 rounded" />
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => { deleteWorkshopService(srv.id); showAlert("warning", `Servicio "${srv.name}" eliminado del catálogo.`); }} className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors" title="Eliminar este servicio del catálogo">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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
