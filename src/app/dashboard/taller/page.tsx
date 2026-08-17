"use client";

import React, { useState } from "react";
import { useAppStore, WorkOrderStatus } from "@/lib/store/app-store";
import {
  Wrench,
  UserCheck,
  PackagePlus,
  FileCheck2,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  X,
  Cpu,
  Search,
  Check,
  ChevronRight,
  User,
  Phone,
  AlertCircle,
  Package,
  Trash2,
  Edit3,
  ShieldCheck,
  Lock,
  Unlock,
  Calendar,
  Filter,
} from "lucide-react";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import { getPeruDateString, formatPeruDateTime } from "@/lib/utils/date-utils";
import { DailyWorkshopReportModal } from "@/components/DailyWorkshopReportModal";
import { TrendingUp, FileSpreadsheet } from "lucide-react";

export default function WorkshopOperationsPage() {
  const {
    workOrders,
    updateWorkOrderStatus,
    updateWorkOrder,
    assignTechnicianToOrder,
    technicians,
    vehicles,
    inventoryItems,
    workshopServices,
    invoices,
    addWorkOrderItem,
    removeWorkOrderItem,
    updateDiagnosticNotes,
    updateDiagnosticAndObservations,
    requestCertificationForWorkOrder,
  } = useAppStore();

  const [timeFilter, setTimeFilter] = useState<"hoy" | "todos">("hoy");
  const [queryDate, setQueryDate] = useState<string>(getPeruDateString());
  const [searchPlate, setSearchPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Modals for actions
  const [activeOrderModal, setActiveOrderModal] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"diagnostic" | "parts" | "service" | "technician" | "certificate" | "inspection_dates">("diagnostic");

  // Form states inside modals
  const [diagnosticText, setDiagnosticText] = useState("");
  const [observationsText, setObservationsText] = useState("");
  const [quinquennialDate, setQuinquennialDate] = useState("");
  const [chipExpiryDate, setChipExpiryDate] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [certType, setCertType] = useState<string>("Certificado Anual GNV");
  const [certPrice, setCertPrice] = useState<number>(80);

  // Requisition form state (Spare parts from inventory, services from catalog, or custom item)
  const [requisitionType, setRequisitionType] = useState<"repuesto" | "servicio" | "manual">("repuesto");
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryItems[0]?.id || "");
  const [selectedServiceId, setSelectedServiceId] = useState(workshopServices[0]?.id || "");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [partQty, setPartQty] = useState(1);

  // Filtered Services for Certification and Workshop Services
  const certificationServices = React.useMemo(() => {
    const list = workshopServices.filter((s) => {
      const cat = (s.category || "").toLowerCase().trim();
      const name = s.name.toLowerCase();
      return (
        cat === "certificación" ||
        cat === "certificacion" ||
        name.includes("certificado") ||
        name.includes("certificacion") ||
        name.includes("anual gnv") ||
        name.includes("anual glp") ||
        name.includes("hidrostática") ||
        name.includes("hidrostatica") ||
        name.includes("chip")
      );
    });
    if (list.length > 0) return list;
    return [
      { id: "ws-cert-1", name: "Certificado Anual GNV", category: "Certificación", price: 80 },
      { id: "ws-cert-2", name: "Certificado Anual GLP", category: "Certificación", price: 80 },
      { id: "ws-cert-3", name: "Prueba Hidrostática de Cilindro GNV", category: "Certificación", price: 180 },
      { id: "ws-cert-4", name: "Desbloqueo de Chip GNV", category: "Certificación", price: 25 },
    ];
  }, [workshopServices]);

  const workshopOnlyServices = React.useMemo(() => {
    const list = workshopServices.filter((s) => {
      const cat = (s.category || "").toLowerCase().trim();
      const name = s.name.toLowerCase();
      const isCert = (
        cat === "certificación" ||
        cat === "certificacion" ||
        name.includes("certificado") ||
        name.includes("certificacion") ||
        name.includes("anual gnv") ||
        name.includes("anual glp") ||
        name.includes("hidrostática") ||
        name.includes("hidrostatica")
      );
      return !isCert;
    });
    if (list.length > 0) return list;
    return workshopServices;
  }, [workshopServices]);

  const statusSteps: Array<{ status: WorkOrderStatus; label: string; color: string }> = [
    { status: "ingresado", label: "1. Ingresado", color: "bg-blue-500" },
    { status: "en_diagnostico", label: "2. Diagnóstico", color: "bg-purple-500" },
    { status: "esperando_repuestos", label: "3. Repuestos", color: "bg-amber-500" },
    { status: "en_servicio", label: "4. En Servicio", color: "bg-teal-500" },
    { status: "por_cobrar", label: "5. Por Cobrar", color: "bg-emerald-500" },
  ];

  const handleOpenDiagnostic = (orderId: string, currentNotes?: string, currentObservations?: string, currentQuinquennial?: string, currentChip?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("diagnostic");
    setDiagnosticText(currentNotes || "");
    setObservationsText(currentObservations || "");
    setQuinquennialDate(currentQuinquennial || "");
    setChipExpiryDate(currentChip || "");
  };

  const handleOpenInspectionDates = (orderId: string, currentQuinquennial?: string, currentChip?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("inspection_dates");
    setQuinquennialDate(currentQuinquennial || "");
    setChipExpiryDate(currentChip || "");
  };

  const handleOpenParts = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("parts");
    setRequisitionType("repuesto");
    setSelectedInventoryId(inventoryItems[0]?.id || "");
    setCustomItemPrice(inventoryItems[0]?.unit_price || 0);
    setCustomItemName("");
    setPartQty(1);
  };

  const handleOpenServices = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("service");
    setRequisitionType("servicio");
    const initialSrv = workshopOnlyServices[0] || workshopServices[0];
    setSelectedServiceId(initialSrv?.id || "");
    setCustomItemPrice(initialSrv?.price || 0);
    setCustomItemName("");
    setPartQty(1);
  };

  const handleOpenCertModal = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("certificate");
    const initialCert = certificationServices[0] || { name: "Certificado Anual GNV", price: 80 };
    setCertType(initialCert.name);
    setCertPrice(initialCert.price);
  };

  // Styled Web Notification Modal State (Replaces browser alert)
  const [webAlert, setWebAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);

  const handleSaveCertification = () => {
    if (activeOrderModal) {
      requestCertificationForWorkOrder(activeOrderModal, certType as any, Number(certPrice));
      setWebAlert({
        open: true,
        title: "¡Certificación Solicitada!",
        message: `La certificación "${certType}" (S/ ${certPrice}) fue registrada e ingresada al flujo de cobro en Caja. Se notificó al Encargado de Certificaciones.`
      });
      setActiveOrderModal(null);
    }
  };

  const handleSaveDiagnostic = () => {
    if (activeOrderModal) {
      updateDiagnosticAndObservations(activeOrderModal, diagnosticText, observationsText);
      if (quinquennialDate || chipExpiryDate) {
        updateWorkOrder(activeOrderModal, {
          quinquennial_date: quinquennialDate,
          chip_expiry_date: chipExpiryDate,
        });
      }
      setActiveOrderModal(null);
    }
  };

  const handleSaveInspectionDates = () => {
    if (activeOrderModal) {
      updateWorkOrder(activeOrderModal, {
        quinquennial_date: quinquennialDate,
        chip_expiry_date: chipExpiryDate,
      });
      setWebAlert({
        open: true,
        title: "¡Fechas de Inspección Guardadas!",
        message: `Fecha Quinquenal (${quinquennialDate || "Pendiente"}) y Chip Anual (${chipExpiryDate || "Pendiente"}) registradas con éxito. Se guardarán en la Tabla Registro Taller al confirmar el cobro en Caja.`
      });
      setActiveOrderModal(null);
    }
  };

  const handleAddRequisition = () => {
    if (!activeOrderModal) return;

    if (modalMode === "parts") {
      if (requisitionType === "repuesto") {
        const item = inventoryItems.find((i) => i.id === selectedInventoryId);
        if (item) {
          addWorkOrderItem(activeOrderModal, {
            inventory_item_id: item.id,
            item_type: "repuesto",
            description: item.name,
            quantity: Number(partQty),
            unit_price: Number(customItemPrice) || item.unit_price || 0,
          });
          updateWorkOrderStatus(activeOrderModal, "esperando_repuestos");
        }
      } else {
        if (!customItemName.trim()) return;
        addWorkOrderItem(activeOrderModal, {
          item_type: "repuesto",
          description: customItemName.trim(),
          quantity: Number(partQty),
          unit_price: Number(customItemPrice) || 0,
        });
        updateWorkOrderStatus(activeOrderModal, "esperando_repuestos");
      }
    } else if (modalMode === "service") {
      if (requisitionType === "servicio") {
        const srv = workshopServices.find((s) => s.id === selectedServiceId);
        if (srv) {
          addWorkOrderItem(activeOrderModal, {
            item_type: "servicio",
            description: srv.name,
            quantity: Number(partQty),
            unit_price: Number(customItemPrice !== undefined && customItemPrice !== null ? customItemPrice : srv.price),
          });
          updateWorkOrderStatus(activeOrderModal, "en_servicio");
        }
      } else {
        if (!customItemName.trim()) return;
        addWorkOrderItem(activeOrderModal, {
          item_type: "servicio",
          description: customItemName.trim(),
          quantity: Number(partQty),
          unit_price: Number(customItemPrice) || 0,
        });
        updateWorkOrderStatus(activeOrderModal, "en_servicio");
      }
    }
    setActiveOrderModal(null);
  };

  // Orders filtered by date
  const dateScopedOrders = React.useMemo(() => {
    return workOrders.filter((wo) => {
      if (timeFilter === "todos") return true;
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      return orderDateStr === queryDate;
    });
  }, [workOrders, timeFilter, queryDate]);

  // Overall & Context counts
  const counts = React.useMemo(() => {
    const todayTarget = queryDate || getPeruDateString();
    const todayOrders = workOrders.filter((wo) => {
      const d = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      return d === todayTarget;
    });

    const activeList = timeFilter === "hoy" ? todayOrders : workOrders;

    return {
      today: todayOrders.length,
      all: workOrders.length,
      currentTotal: activeList.length,
      ingresado: activeList.filter((wo) => wo.status === "ingresado").length,
      en_diagnostico: activeList.filter((wo) => wo.status === "en_diagnostico").length,
      esperando_repuestos: activeList.filter((wo) => wo.status === "esperando_repuestos").length,
      en_servicio: activeList.filter((wo) => wo.status === "en_servicio").length,
      por_cobrar: activeList.filter((wo) => wo.status === "por_cobrar").length,
    };
  }, [workOrders, timeFilter, queryDate]);

  const filteredOrders = React.useMemo(() => {
    return dateScopedOrders
      .filter((wo) => {
        const matchPlate = searchPlate ? wo.vehicle_plate.toUpperCase().includes(searchPlate.toUpperCase().trim()) : true;
        const matchStatus = statusFilter === "todos" ? true : wo.status === statusFilter;
        return matchPlate && matchStatus;
      })
      .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());
  }, [dateScopedOrders, searchPlate, statusFilter]);

  const displayedOrders = filteredOrders.slice(0, visibleLimit);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Taller & Bahías de Trabajo</h1>
            <p className="text-xs text-gray-400">
              Vista interactiva por Cards Horizontales ordenadas por hora de llegada, con Pipeline interactivo de estado.
            </p>
          </div>
        </div>

        {/* Header Action: Open Executive Report Modal */}
        <button
          type="button"
          onClick={() => setReportModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 active:scale-95 transition-all shrink-0"
        >
          <TrendingUp className="w-4 h-4 text-amber-200" />
          <span>Informe Diario a Gerencia</span>
        </button>
      </div>

      {/* Date & Search Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-reygas-dark p-3.5 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Selector Tabs: Del Día / Hoy vs Todos */}
          <div className="flex items-center gap-1 bg-reygas-surface p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => { setTimeFilter("hoy"); setVisibleLimit(30); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                timeFilter === "hoy"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Del Día / Hoy ({counts.today})</span>
            </button>

            <button
              onClick={() => { setTimeFilter("todos"); setVisibleLimit(30); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                timeFilter === "todos"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-black scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>Todos / Histórico ({counts.all})</span>
            </button>
          </div>

          {/* Date picker */}
          <MiniDatePicker
            value={queryDate}
            onChange={(newDate) => {
              setQueryDate(newDate);
              setTimeFilter("hoy");
              setVisibleLimit(30);
            }}
          />
        </div>

        {/* Search & Dropdown Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchPlate}
              onChange={(e) => { setSearchPlate(e.target.value.toUpperCase()); setVisibleLimit(30); }}
              className="w-full sm:w-48 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400 font-bold"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setVisibleLimit(30); }}
            className="px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400 font-bold"
          >
            <option value="todos">Todos los Estados ({counts.currentTotal})</option>
            <option value="ingresado">1. Ingresados ({counts.ingresado})</option>
            <option value="en_diagnostico">2. En Diagnóstico ({counts.en_diagnostico})</option>
            <option value="esperando_repuestos">3. Esperando Repuestos ({counts.esperando_repuestos})</option>
            <option value="en_servicio">4. En Servicio / Bahía ({counts.en_servicio})</option>
            <option value="por_cobrar">5. Por Cobrar ({counts.por_cobrar})</option>
          </select>
        </div>
      </div>

      {/* Interactive Status Filter Pills (Clickable buttons matching image) */}
      <div className="flex flex-wrap items-center gap-2 bg-reygas-dark/70 p-2.5 rounded-2xl border border-white/5 text-xs font-bold">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-extrabold flex items-center gap-1.5 px-2">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>Filtrar Estado:</span>
        </span>

        {/* 1. Todos */}
        <button
          onClick={() => { setStatusFilter("todos"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "todos"
              ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-105"
              : "bg-reygas-surface/60 text-gray-400 border-white/10 hover:text-white hover:border-white/20"
          }`}
        >
          Todos los Estados ({counts.currentTotal})
        </button>

        {/* 2. Ingresados */}
        <button
          onClick={() => { setStatusFilter("ingresado"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "ingresado"
              ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30 font-black scale-105"
              : "bg-blue-950/30 text-blue-300 border-blue-500/20 hover:bg-blue-900/40"
          }`}
        >
          1. Ingresados ({counts.ingresado})
        </button>

        {/* 3. En Diagnóstico */}
        <button
          onClick={() => { setStatusFilter("en_diagnostico"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "en_diagnostico"
              ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30 font-black scale-105"
              : "bg-purple-950/30 text-purple-300 border-purple-500/20 hover:bg-purple-900/40"
          }`}
        >
          2. En Diagnóstico ({counts.en_diagnostico})
        </button>

        {/* 4. Esperando Repuestos */}
        <button
          onClick={() => { setStatusFilter("esperando_repuestos"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "esperando_repuestos"
              ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30 font-black scale-105"
              : "bg-amber-950/30 text-amber-300 border-amber-500/20 hover:bg-amber-900/40"
          }`}
        >
          3. Esperando Repuestos ({counts.esperando_repuestos})
        </button>

        {/* 5. En Servicio / Bahía */}
        <button
          onClick={() => { setStatusFilter("en_servicio"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "en_servicio"
              ? "bg-teal-600 text-white border-teal-400 shadow-lg shadow-teal-600/30 font-black scale-105"
              : "bg-teal-950/30 text-teal-300 border-teal-500/20 hover:bg-teal-900/40"
          }`}
        >
          4. En Servicio / Bahía ({counts.en_servicio})
        </button>

        {/* 6. Por Cobrar */}
        <button
          onClick={() => { setStatusFilter("por_cobrar"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${
            statusFilter === "por_cobrar"
              ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 font-black scale-105"
              : "bg-emerald-950/30 text-emerald-300 border-emerald-500/20 hover:bg-emerald-900/40"
          }`}
        >
          5. Por Cobrar ({counts.por_cobrar})
        </button>
      </div>

      {/* Horizontal Cards List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-400 space-y-3 rounded-2xl border border-white/10">
            <Wrench className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">No hay órdenes de trabajo que coincidan con los filtros seleccionados.</p>
            {timeFilter === "hoy" && (
              <button
                onClick={() => setTimeFilter("todos")}
                className="px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs font-bold rounded-xl border border-blue-500/30 transition-colors"
              >
                Ver todos los vehículos en el histórico ({counts.all})
              </button>
            )}
          </div>
        ) : (
          displayedOrders.map((wo) => {
            const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
            const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
            const invoice = invoices.find((i) => i.work_order_id === wo.id);
            const isExplicitPending = wo.status === "por_cobrar" || wo.status === "pendiente_pago" || invoice?.payment_status === "pendiente";
            const isPaid = !isExplicitPending && (wo.status === "pagado_autorizado" || wo.status === "finalizado" || invoice?.payment_status === "pagado");
            const isLocked = isPaid && !wo.allow_modifications;

            // Current step index in pipeline
            const currentStepIdx = statusSteps.findIndex((s) => s.status === wo.status);

            return (
              <div
                key={wo.id}
                className={`glass-panel p-6 rounded-2xl border transition-all space-y-6 ${
                  isLocked
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : wo.allow_modifications && isPaid
                    ? "border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-500/10"
                    : "border-white/10 hover:border-amber-500/30"
                }`}
              >
                {/* Locked Banner if Paid */}
                {isLocked && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        🔒 ORDEN PAGADA EN CAJA - MODIFICACIONES BLOQUEADAS EN TALLER
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-200 font-normal">
                      (Para modificar, desmarcar pago o pulsar "Permitir Modificación" en la pestaña Caja & Facturación)
                    </span>
                  </div>
                )}

                {/* Unlocked Notice if Paid with Modification Enabled */}
                {!isLocked && isPaid && wo.allow_modifications && (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        🔓 MODIFICACIÓN HABILITADA DESDE CAJA (ORDEN EDITABLE)
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-200 font-normal">
                      Puede modificar repuestos, servicios y diagnóstico libremente.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Vehicle Info */}
                  <div className="lg:col-span-3 space-y-2 border-b lg:border-b-0 lg:border-r border-white/10 pb-4 lg:pb-0 lg:pr-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-2xl text-white tracking-widest bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                        {wo.vehicle_plate}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase">
                        OT #{wo.id}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year})` : "Vehículo"}
                      </h3>
                      <p className="text-xs text-gray-400 font-semibold">
                        {vehicle?.color || "Color no especificado"} •{" "}
                        <span className="text-reygas-red">{vehicle?.fuel_type || "GNV"}</span>
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 space-y-1 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Llegada: {formatPeruDateTime(wo.entry_time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-200 font-medium">{vehicle?.owner_name || "Cliente Garita"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        <span>{vehicle?.owner_phone || "Sin teléfono"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Column: Interactive Progress Stepper, Description, DIAGNOSTICO & MECANICO ASIGNADO */}
                  <div className="lg:col-span-5 space-y-4 px-0 lg:px-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Estado Actual y Flujo de Servicio:
                      </span>
                      {/* Stepper Pipeline */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {statusSteps.map((step, idx) => {
                          const isCurrent = wo.status === step.status;
                          const isPassed = idx <= currentStepIdx;

                          return (
                            <button
                              key={step.status}
                              disabled={isLocked}
                              onClick={() => updateWorkOrderStatus(wo.id, step.status)}
                              className={`py-2 px-1.5 rounded-lg text-[10px] font-extrabold transition-all text-center flex flex-col items-center justify-center gap-1 border ${
                                isCurrent
                                  ? `${step.color} text-black border-white shadow-lg`
                                  : isPassed
                                  ? "bg-reygas-surface text-gray-200 border-white/20 hover:border-amber-400"
                                  : "bg-reygas-dark/60 text-gray-500 border-white/5 hover:border-white/20"
                              } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <span>{step.label}</span>
                              {isCurrent && <Check className="w-3 h-3 text-black stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-reygas-dark/80 border border-white/5 text-xs text-gray-300">
                      <span className="font-bold text-amber-400 block text-[11px] uppercase">
                        Reporte / Motivo de Ingreso:
                      </span>
                      <p className="mt-0.5 line-clamp-2">{wo.problem_description}</p>
                    </div>

                    {/* Diagnostic Notes & Observations */}
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                        <span className="font-bold text-purple-400 block text-[11px] uppercase flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-purple-400" />
                            <span>Diagnóstico Técnico ECU:</span>
                          </span>
                          {!isLocked && (
                            <button
                              onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations)}
                              className="text-[10px] text-purple-300 hover:text-white underline font-normal"
                            >
                              {wo.diagnostic_notes ? "Editar Diagnóstico" : "+ Añadir Diagnóstico"}
                            </button>
                          )}
                        </span>
                        <p className="mt-0.5 text-xs italic">
                          {wo.diagnostic_notes || "Pendiente de diagnóstico computarizado."}
                        </p>
                      </div>

                      {wo.observations && (
                        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-1">
                          <span className="font-bold text-amber-400 block text-[11px] uppercase flex items-center justify-between">
                            <span>Observaciones Adicionales:</span>
                            {!isLocked && (
                              <button
                                onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations)}
                                className="text-[10px] text-amber-300 hover:text-white underline font-normal"
                              >
                                Editar Observaciones
                              </button>
                            )}
                          </span>
                          <p className="mt-0.5 text-xs">
                            {wo.observations}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* REQUERIMIENTO #2: EL MECANICO ASIGNADO DEBAJO DEL DIAGNOSTICO */}
                    <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-amber-400">
                        👨‍🔧 Mecánico Asignado Responsable:
                      </label>
                      <div className="relative">
                        <select
                          disabled={isLocked}
                          value={wo.assigned_technician_id || ""}
                          onChange={(e) => assignTechnicianToOrder(wo.id, e.target.value)}
                          className={`w-full pl-8 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs font-semibold text-white focus:border-amber-400 ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="">-- Sin Técnico Asignado --</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name} ({t.specialty})
                            </option>
                          ))}
                        </select>
                        <UserCheck className="w-4 h-4 text-amber-400 absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {/* FECHAS DE INSPECCIÓN: QUINQUENAL & CHIP ANUAL */}
                    <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-purple-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          <span>Fechas de Inspección (Quinquenal / Chip)</span>
                        </span>
                        {!isLocked && (
                          <button
                            onClick={() => handleOpenInspectionDates(wo.id, wo.quinquennial_date, wo.chip_expiry_date)}
                            className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Registrar / Editar</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-black/40 border border-purple-500/20">
                          <span className="text-[10px] text-gray-400 block font-semibold">Fecha Quinquenal:</span>
                          <span className="font-mono font-bold text-purple-300">
                            {wo.quinquennial_date || <span className="text-gray-500 italic text-[11px]">No registrada</span>}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/20">
                          <span className="text-[10px] text-gray-400 block font-semibold">Fecha Chip Anual:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            {wo.chip_expiry_date || <span className="text-gray-500 italic text-[11px]">No registrada</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: REPUESTOS Y SERVICIOS SOLICITADOS & CERTIFICACION */}
                  <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-4">
                    {/* Action buttons toolbar: 5 distinct, separate actions */}
                    {!isLocked && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations, wo.quinquennial_date, wo.chip_expiry_date)}
                          className="py-2 px-2 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-purple-500/30 transition-colors shadow"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          <span>Diagnóstico</span>
                        </button>

                        <button
                          onClick={() => handleOpenInspectionDates(wo.id, wo.quinquennial_date, wo.chip_expiry_date)}
                          className="py-2 px-2 bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-purple-400/40 transition-colors shadow"
                        >
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          <span>Fechas Chip/5ta</span>
                        </button>

                        <button
                          onClick={() => handleOpenParts(wo.id)}
                          className="py-2 px-2 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-amber-500/30 transition-colors shadow"
                        >
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pedir Repuesto</span>
                        </button>

                        <button
                          onClick={() => handleOpenServices(wo.id)}
                          className="py-2 px-2 bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-indigo-500/30 transition-colors shadow"
                        >
                          <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Agregar Servicio</span>
                        </button>

                        <button
                          onClick={() => handleOpenCertModal(wo.id)}
                          className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors shadow sm:col-span-2 ${
                            wo.requires_certification
                              ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/50"
                              : "bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 border-cyan-500/30"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{wo.requires_certification ? "Certificado Solicitado" : "Certificación"}</span>
                        </button>
                      </div>
                    )}

                    {/* REQUERIMIENTO: SECCION DE REPUESTOS Y SERVICIOS SOLICITADOS */}
                    <div className="space-y-2 p-3 bg-reygas-dark/60 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          Repuestos & Servicios Solicitados ({wo.items.length}):
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          Total: S/ {wo.items.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)}
                        </span>
                      </div>

                      {wo.items.length === 0 ? (
                        <p className="text-[11px] text-gray-500 italic">No hay repuestos o servicios solicitados aún.</p>
                      ) : (
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                          {wo.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {item.item_type === "servicio" ? (
                                  <Wrench className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                ) : (
                                  <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span className="text-white font-semibold truncate">{item.description}</span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  x{item.quantity}
                                </span>
                                {item.dispatched ? (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase">
                                    ✓ Entregado
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">
                                    ⏳ Pendiente
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-gray-300 text-xs">S/ {item.subtotal.toFixed(2)}</span>
                                {!isLocked && (
                                  <button
                                    onClick={() => removeWorkOrderItem(wo.id, item.id)}
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                    title="Quitar ítem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SERVICIO DE CERTIFICADO DEBAJO DE REPUESTOS SOLICITADOS */}
                    {wo.requires_certification ? (
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-cyan-400" />
                            <span>Servicio de Certificación</span>
                          </span>
                          <span className="font-mono text-cyan-200 font-bold bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
                            S/ {(wo.certification_price || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-cyan-200">
                          Tipo: <strong>{wo.certification_type}</strong> • Estado:{" "}
                          {wo.certification_issued ? "✅ Emitido en Certificaciones" : "⏳ Notificado y Pendiente"}
                        </p>
                      </div>
                    ) : (
                      !isLocked && (
                        <button
                          onClick={() => handleOpenCertModal(wo.id)}
                          className="w-full py-2 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>+ Solicitar Certificación desde Catálogo de Servicios</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {displayedOrders.length < filteredOrders.length && (
          <div className="text-center pt-4">
            <button
              onClick={() => setVisibleLimit((prev) => prev + 30)}
              className="px-6 py-2.5 bg-reygas-surface border border-white/10 hover:border-amber-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Cargar más vehículos ({displayedOrders.length} de {filteredOrders.length})
            </button>
          </div>
        )}
      </div>

      {/* Modals for Diagnostic, Parts Requisition, Workshop Services and Certification */}
      {activeOrderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalMode === "diagnostic" && (
                  <>
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <span>Diagnóstico Técnico & Observaciones</span>
                  </>
                )}
                {modalMode === "inspection_dates" && (
                  <>
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span>Fechas de Inspección (Quinquenal & Chip Anual)</span>
                  </>
                )}
                {modalMode === "parts" && (
                  <>
                    <PackagePlus className="w-5 h-5 text-amber-400" />
                    <span>Pedir Repuesto de Almacén</span>
                  </>
                )}
                {modalMode === "service" && (
                  <>
                    <Wrench className="w-5 h-5 text-indigo-400" />
                    <span>Agregar Servicio de Taller</span>
                  </>
                )}
                {modalMode === "certificate" && (
                  <>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <span>Solicitar Certificación de Vehículo</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveOrderModal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Modal Certificación (Jala del catálogo los de categoría Certificación) */}
            {modalMode === "certificate" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1.5 flex items-center justify-between">
                    <span>TIPO DE CERTIFICACIÓN (Catálogo de Servicios) *</span>
                    <span className="text-[10px] text-gray-400">({certificationServices.length} disponibles)</span>
                  </label>
                  <select
                    value={certType}
                    onChange={(e) => {
                      const selected = certificationServices.find((s) => s.name === e.target.value);
                      setCertType(e.target.value);
                      if (selected) setCertPrice(selected.price);
                    }}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400 font-bold"
                  >
                    {certificationServices.map((cs) => (
                      <option key={cs.id} value={cs.name}>
                        {cs.name} — S/ {cs.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    PRECIO DE CERTIFICACIÓN (S/) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={certPrice}
                    onChange={(e) => setCertPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-cyan-400 font-bold"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Este servicio se colocará debajo de la sección de repuestos solicitados y se cargará automáticamente a Caja.
                  </p>
                </div>

                <button
                  onClick={handleSaveCertification}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guardar Servicio de Certificado</span>
                </button>
              </div>
            )}

            {/* 2. Modal Diagnóstico */}
            {modalMode === "diagnostic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
                    1. Notas y Códigos de Error Escáner OBD2 / ECU Gas
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Código P0300 Misfire detectado en cilindro 2. Inyector de gas con pulsos irregulares."
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(e.target.value)}
                    className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">
                    2. Observaciones Generales / Recomendaciones al Cliente
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Se recomienda cambio preventivo de bujías y filtro de fase gaseosa en próximo mantenimiento."
                    value={observationsText}
                    onChange={(e) => setObservationsText(e.target.value)}
                    className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400"
                  />
                </div>

                {/* Fechas Quinquenal y Chip opcionales durante Diagnóstico */}
                <div className="p-3 rounded-xl bg-black/40 border border-purple-500/30 space-y-2">
                  <span className="text-[11px] font-bold text-purple-300 uppercase block">
                    3. Fechas de Inspección (Vencimiento Quinquenal / Chip)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold mb-1">F. Quinquenal (5ta)</label>
                      <input
                        type="date"
                        value={quinquennialDate}
                        onChange={(e) => setQuinquennialDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white font-mono focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold mb-1">F. Chip Anual</label>
                      <input
                        type="date"
                        value={chipExpiryDate}
                        onChange={(e) => setChipExpiryDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white font-mono focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveDiagnostic}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Guardar Diagnóstico y Observaciones
                </button>
              </div>
            )}

            {/* Modal Fechas Quinquenal & Chip Anual Dedicado */}
            {modalMode === "inspection_dates" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200">
                  Ingrese o actualice las fechas de inspección técnica. Estos datos se registrarán en la <strong>Tabla de Registro de Taller</strong> cuando se confirme el pago en Caja.
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-300 uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Fecha Quinquenal (Prueba Hidrostática de Cilindro)</span>
                  </label>
                  <input
                    type="date"
                    value={quinquennialDate}
                    onChange={(e) => setQuinquennialDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-purple-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Corresponde a la revisión cada 5 años del cilindro de gas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cyan-300 uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Fecha Chip Anual (Certificación Anual)</span>
                  </label>
                  <input
                    type="date"
                    value={chipExpiryDate}
                    onChange={(e) => setChipExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-cyan-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Corresponde a la certificación anual de chip para habilitación en grifos.
                  </p>
                </div>

                <button
                  onClick={handleSaveInspectionDates}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Fechas de Inspección</span>
                </button>
              </div>
            )}

            {/* 3. Modal Repuesto (Solo Repuestos de Almacén o Repuesto Libre) */}
            {modalMode === "parts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase">
                    📦 Solicitar Repuesto
                  </span>
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setRequisitionType("repuesto")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        requisitionType === "repuesto" ? "bg-amber-500 text-black shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Inventario Almacén
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequisitionType("manual")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        requisitionType === "manual" ? "bg-teal-600 text-white shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Repuesto Libre
                    </button>
                  </div>
                </div>

                {requisitionType === "repuesto" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Seleccionar Repuesto en Inventario
                      </label>
                      <select
                        value={selectedInventoryId}
                        onChange={(e) => {
                          setSelectedInventoryId(e.target.value);
                          const it = inventoryItems.find((i) => i.id === e.target.value);
                          if (it) setCustomItemPrice(it.unit_price || 0);
                        }}
                        className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400 font-bold"
                      >
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} (Stock: {item.stock_quantity}) — S/ {item.unit_price}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Precio Unitario (S/)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Descripción del Repuesto Requerido *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Filtro de gas 5ta generación rail"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Precio Unitario (S/)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Cantidad Requerida</label>
                  <input
                    type="number"
                    min={1}
                    value={partQty}
                    onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                  />
                </div>

                <button
                  onClick={handleAddRequisition}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Package className="w-4 h-4" />
                  <span>+ Agregar Repuesto a la Orden</span>
                </button>
              </div>
            )}

            {/* 4. Modal Servicio (Solo Servicios del Catálogo de Taller o Servicio Libre) */}
            {modalMode === "service" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase">
                    🛠️ Agregar Servicio de Taller
                  </span>
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setRequisitionType("servicio")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        requisitionType === "servicio" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Catálogo Servicios
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequisitionType("manual")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        requisitionType === "manual" ? "bg-teal-600 text-white shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Servicio Libre
                    </button>
                  </div>
                </div>

                {requisitionType === "servicio" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Seleccionar Servicio del Catálogo ({workshopOnlyServices.length} disponibles)
                      </label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => {
                          const srv = workshopServices.find((s) => s.id === e.target.value);
                          setSelectedServiceId(e.target.value);
                          if (srv) setCustomItemPrice(srv.price);
                        }}
                        className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-indigo-400 font-bold"
                      >
                        {workshopOnlyServices.map((srv) => (
                          <option key={srv.id} value={srv.id}>
                            {srv.name} ({srv.category || "Servicio"}) — S/ {srv.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Precio Asignado al Servicio (S/) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Puede ingresar S/ 0 si el servicio no tiene costo adicional (revisión/garantía).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Nombre / Descripción del Servicio *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Calibración fina de mapa de gas en ruta"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-indigo-400 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Precio del Servicio (S/) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={partQty}
                    onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                  />
                </div>

                <button
                  onClick={handleAddRequisition}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Wrench className="w-4 h-4" />
                  <span>+ Agregar Servicio a la Orden</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STYLED WEB NOTIFICATION MODAL (REPLACES BROWSER ALERT) */}
      {webAlert?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-cyan-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{webAlert.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Notificación de Taller</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {webAlert.message}
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setWebAlert(null)}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs shadow-lg shadow-cyan-600/30 transition-transform hover:scale-105"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE DAILY WORKSHOP REPORT MODAL */}
      <DailyWorkshopReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        initialTab="caja"
      />
    </div>
  );
}
