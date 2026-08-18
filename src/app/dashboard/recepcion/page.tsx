"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAppStore, Appointment, WorkOrderStatus } from "@/lib/store/app-store";
import {
  Calendar,
  MessageSquare,
  Wrench,
  UserCheck,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Plus,
  Car,
  Edit3,
  Trash2,
  X,
  ArrowRight,
  FileText,
  Check,
  Phone,
  FileSpreadsheet
} from "lucide-react";
import { getPeruDateTimeLocal, formatPeruDateTime } from "@/lib/utils/date-utils";
import MiniDatePicker from "@/components/ui/mini-date-picker";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function RecepcionPage() {
  const {
    appointments,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    vehicles,
    registerVehicle,
    technicians,
    workOrders,
    createWorkOrder,
    assignTechnicianToOrder,
    scheduleRecords,
    addScheduleRecord,
    notify,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"citas" | "radar">("citas");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dark Glassmorphic Confirmation Modal State (replaces native window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  } | null>(null);

  // Cartilla Registration Modal State (Alimenta Tabla de Programación)
  const [cartillaModalOpen, setCartillaModalOpen] = useState(false);
  const [cartillaForm, setCartillaForm] = useState({
    vehicle_plate: "",
    client_name: "",
    client_phone: "",
    current_mileage: 0,
    service_date: getPeruDateTimeLocal().slice(0, 10),
    service_name: "Instalación 5ta GNV FISE",
    next_maintenance_date: "",
    expiry_quinquennial: "",
    expiry_chip_annual: "",
    notes: "",
  });

  const calculate90Days = (baseDateStr?: string) => {
    try {
      const base = baseDateStr ? new Date(baseDateStr + "T12:00:00") : new Date();
      if (isNaN(base.getTime())) return "";
      base.setDate(base.getDate() + 90);
      return base.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const handleOpenCartillaModal = () => {
    const today = getPeruDateTimeLocal().slice(0, 10);
    setCartillaForm({
      vehicle_plate: "",
      client_name: "",
      client_phone: "",
      current_mileage: 0,
      service_date: today,
      service_name: "Instalación 5ta GNV FISE",
      next_maintenance_date: calculate90Days(today),
      expiry_quinquennial: "",
      expiry_chip_annual: "",
      notes: "",
    });
    setCartillaModalOpen(true);
  };

  const handleSaveCartilla = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartillaForm.vehicle_plate.trim()) {
      notify("warning", "Por favor ingrese la placa del vehículo.");
      return;
    }

    const calcDue = cartillaForm.next_maintenance_date || calculate90Days(cartillaForm.service_date);

    addScheduleRecord({
      vehicle_plate: cartillaForm.vehicle_plate.toUpperCase().trim(),
      client_name: cartillaForm.client_name.trim() || "Cliente",
      client_phone: cartillaForm.client_phone.trim(),
      current_mileage: Number(cartillaForm.current_mileage) || 0,
      service_date: cartillaForm.service_date,
      service_name: cartillaForm.service_name,
      next_maintenance_date: calcDue,
      expiry_quinquennial: cartillaForm.expiry_quinquennial,
      expiry_chip_annual: cartillaForm.expiry_chip_annual,
      status: "programado",
      notes: cartillaForm.notes,
    });

    setCartillaModalOpen(false);
    showSuccess(`¡Cartilla de ${cartillaForm.vehicle_plate.toUpperCase()} registrada con éxito a 90 días!`);
  };

  // Radar 90 Días Logic & 4 Filters
  const [radarFilter, setRadarFilter] = useState<"semanal" | "mensual" | "10dias" | "todos">("semanal");

  const todayDate = new Date(getPeruDateTimeLocal().slice(0, 10) + "T12:00:00");
  const [selectedMonth, setSelectedMonth] = useState<number>(todayDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(todayDate.getFullYear());

  const parseToDate = (str?: string): Date | null => {
    if (!str || !str.trim() || str.trim() === "-") return null;
    const s = str.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return new Date(s.slice(0, 10) + "T12:00:00");
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [d, m, y] = s.split("/");
      return new Date(`${y}-${m}-${d}T12:00:00`);
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Construct Radar 90-day Items from scheduleRecords & workOrders
  const radarItems = React.useMemo(() => {
    const list: Array<{
      id: string;
      plate: string;
      client_name: string;
      client_phone: string;
      current_mileage?: number;
      service_name: string;
      service_date: string;
      dueDate: string;
      diffDays: number;
    }> = [];

    const TARGET_SERVICES = [
      "instalación 5ta gnv fise",
      "instalación 5ta gnv al contado",
      "instalación 3ra gnv al contado",
      "instalación 5ta glp",
      "instalación 3ra glp",
      "instalacion 5ta gnv fise",
      "instalacion 5ta gnv al contado",
      "instalacion 3ra gnv al contado",
      "instalacion 5ta glp",
      "instalacion 3ra glp",
    ];

    const seenKeys = new Set<string>();

    // 1. From scheduleRecords
    (scheduleRecords || []).forEach((rec) => {
      const sName = (rec.service_name || "").toLowerCase();
      const isTarget =
        TARGET_SERVICES.some((t) => sName.includes(t)) ||
        sName.includes("instalaci") ||
        sName.includes("gnv") ||
        sName.includes("glp") ||
        !!rec.next_maintenance_date;

      let dueDateObj: Date | null = null;
      if (rec.next_maintenance_date) {
        dueDateObj = parseToDate(rec.next_maintenance_date);
      } else if (rec.service_date) {
        const sDate = parseToDate(rec.service_date);
        if (sDate) {
          dueDateObj = new Date(sDate);
          dueDateObj.setDate(dueDateObj.getDate() + 90);
        }
      }

      if (dueDateObj && !isNaN(dueDateObj.getTime())) {
        const diffMs = dueDateObj.getTime() - todayDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const key = `${rec.vehicle_plate}_${rec.service_name}_${rec.service_date}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: rec.id,
            plate: rec.vehicle_plate,
            client_name: rec.client_name || "Cliente",
            client_phone: rec.client_phone || "",
            current_mileage: rec.current_mileage || 0,
            service_name: rec.service_name || "Instalación GNV/GLP",
            service_date: rec.service_date || "-",
            dueDate: dueDateObj.toISOString().slice(0, 10),
            diffDays,
          });
        }
      }
    });

    // 2. From workOrders matching target services
    (workOrders || []).forEach((wo) => {
      const diag = (wo.diagnostic_notes || "").toLowerCase();
      const itemsStr = (wo.items || []).map((i) => (i.description || "").toLowerCase()).join(" ");
      const isTarget = TARGET_SERVICES.some((t) => diag.includes(t) || itemsStr.includes(t));

      if (isTarget && wo.vehicle_plate) {
        const sDate = parseToDate(wo.entry_time);
        if (sDate) {
          const dueDateObj = new Date(sDate);
          dueDateObj.setDate(dueDateObj.getDate() + 90);
          const diffMs = dueDateObj.getTime() - todayDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const linkedVeh = (vehicles || []).find((v) => v.plate === wo.vehicle_plate);
          const key = `${wo.vehicle_plate}_${wo.diagnostic_notes}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            list.push({
              id: wo.id,
              plate: wo.vehicle_plate,
              client_name: linkedVeh?.owner_name || "Cliente",
              client_phone: linkedVeh?.owner_phone || "",
              current_mileage: linkedVeh?.current_mileage || 0,
              service_name: wo.diagnostic_notes || "Instalación 5ta GNV",
              service_date: sDate.toISOString().slice(0, 10),
              dueDate: dueDateObj.toISOString().slice(0, 10),
              diffDays,
            });
          }
        }
      }
    });

    // Sort by diffDays ascending (closest to expire first)
    return list.sort((a, b) => a.diffDays - b.diffDays);
  }, [scheduleRecords, workOrders, todayDate]);

  // Counts for the 4 filters
  const filterCounts = React.useMemo(() => {
    const semanal = radarItems.filter((i) => i.diffDays >= -7 && i.diffDays <= 7).length;
    const mensual = radarItems.filter((i) => {
      const d = parseToDate(i.dueDate);
      return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).length;
    const diezDias = radarItems.filter((i) => i.diffDays >= 0 && i.diffDays <= 10).length;
    const todos = radarItems.length;
    return { semanal, mensual, diezDias, todos };
  }, [radarItems, selectedMonth, selectedYear]);

  const filteredRadarItems = React.useMemo(() => {
    switch (radarFilter) {
      case "semanal":
        return radarItems.filter((i) => i.diffDays >= -7 && i.diffDays <= 7);
      case "mensual":
        return radarItems.filter((i) => {
          const d = parseToDate(i.dueDate);
          return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
      case "10dias":
        return radarItems.filter((i) => i.diffDays >= 0 && i.diffDays <= 10);
      case "todos":
      default:
        return radarItems;
    }
  }, [radarItems, radarFilter, selectedMonth, selectedYear]);

  const handleSendRadarWhatsApp = (item: (typeof radarItems)[0]) => {
    const cleanPhone = (item.client_phone || "").replace(/[^0-9]/g, "");
    const clientName = item.client_name || "Cliente";
    const plate = item.plate || "S/P";
    const service = item.service_name || "Instalación GNV/GLP";
    const dueDateFormatted = formatPeruDateTime(item.dueDate + "T00:00:00", false).split(" ")[0];

    const message = encodeURIComponent(
      `Estimado(a) *${clientName}*, le saludamos de *ReyGas Autogás Equipment*.\n\nLe recordamos que su vehículo con placa *${plate}* está próximo a cumplir sus *90 días* desde su atención de *${service}* (Fecha programada: *${dueDateFormatted}*).\n\nLe invitamos a pasar por nuestro taller para su revisión y calibración preventiva para mantener su garantía y óptimo rendimiento.\n\n¿Desea agendar su atención para esta semana?`
    );

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
    showSuccess(`Mensaje de radar 90 días generado para ${plate}`);
  };

  // New appointment modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    client_name: "",
    client_phone: "",
    plate: "",
    service_type: "Conversión a GNV 5ta Gen",
    scheduled_date: getPeruDateTimeLocal(new Date(Date.now() + 86400000)),
    notes: "",
  });

  // Edit appointment modal
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<Appointment | null>(null);

  // Workshop transfer modal
  const [transferApp, setTransferApp] = useState<Appointment | null>(null);
  const [transferForm, setTransferForm] = useState<{
    target_status: WorkOrderStatus;
    technician_id: string;
    problem_description: string;
  }>({
    target_status: "ingresado",
    technician_id: "",
    problem_description: "",
  });

  // Filter vehicles with mileage >= 15,000 for maintenance alerts
  const maintenanceRadarVehicles = vehicles.filter((v) => v.current_mileage >= 15000);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleSendWhatsApp = (v: (typeof vehicles)[0]) => {
    const message = encodeURIComponent(
      `Hola *${v.owner_name}*, le saludamos de *REYGAS AUTOGAS EQUIPMENT*. Su vehículo con placa *${v.plate}* ha superado los *${v.current_mileage.toLocaleString()} KM* y le corresponde su mantenimiento preventivo de GNV/GLP para conservar la potencia de motor y evitar obstrucción de inyectores. ¿Desea agendar su cita para esta semana?`
    );
    window.open(`https://wa.me/${v.owner_phone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
  };

  const handleCreateNewAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    addAppointment({
      client_name: newForm.client_name,
      client_phone: newForm.client_phone,
      plate: newForm.plate.toUpperCase(),
      service_type: newForm.service_type,
      scheduled_date: newForm.scheduled_date,
      notes: newForm.notes,
    });
    setNewModalOpen(false);
    showSuccess(`¡Cita para ${newForm.plate.toUpperCase()} registrada con éxito!`);
  };

  const handleOpenEditModal = (app: Appointment) => {
    setEditingApp(app);
    setEditForm({ ...app });
  };

  const handleSaveEditAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp || !editForm) return;

    updateAppointment(editingApp.id, {
      client_name: editForm.client_name,
      client_phone: editForm.client_phone,
      plate: editForm.plate.toUpperCase(),
      service_type: editForm.service_type,
      scheduled_date: editForm.scheduled_date,
      status: editForm.status,
      notes: editForm.notes,
    });

    setEditingApp(null);
    setEditForm(null);
    showSuccess("¡Reserva/Cita modificada con éxito!");
  };

  const handleDeleteAppointment = (id: string, plate: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Eliminar Cita",
      message: `¿Está seguro de eliminar la cita del vehículo ${plate}? Esta acción eliminará el registro de la lista.`,
      confirmLabel: "Sí, Eliminar",
      cancelLabel: "Cancelar",
      danger: true,
      onConfirm: () => {
        deleteAppointment(id);
        showSuccess(`Cita de ${plate} eliminada.`);
      },
    });
  };

  const handleOpenTransferModal = (app: Appointment) => {
    setTransferApp(app);
    setTransferForm({
      target_status: "ingresado",
      technician_id: technicians[0]?.id || "",
      problem_description: `${app.service_type} - Cita web solicitada por ${app.client_name}. ${app.notes || ""}`,
    });
  };

  const handleConfirmWorkshopTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferApp) return;

    // 1. Ensure vehicle is registered
    registerVehicle({
      plate: transferApp.plate.toUpperCase(),
      brand: "Automóvil",
      model: "Genérico",
      year: new Date().getFullYear(),
      color: "Plateado",
      fuel_type: transferApp.service_type.includes("GLP") ? "GLP" : "GNV",
      owner_name: transferApp.client_name,
      owner_phone: transferApp.client_phone,
      current_mileage: 20000,
      last_visit_date: new Date().toISOString(),
    });

    // 2. Create work order in Workshop ERP
    createWorkOrder({
      vehicle_plate: transferApp.plate.toUpperCase(),
      status: transferForm.target_status,
      assigned_technician_id: transferForm.technician_id || undefined,
      problem_description: transferForm.problem_description,
      diagnostic_notes: `Ingresado desde Recepción/Citas el ${formatPeruDateTime(new Date())}`,
    });

    // 3. Mark appointment as completed
    updateAppointmentStatus(transferApp.id, "completado");

    setTransferApp(null);
    showSuccess(`¡Vehículo ${transferApp.plate} ingresado al Taller ERP con estado ${transferForm.target_status.toUpperCase()}!`);
  };

  // Availability Modal State
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState(getPeruDateTimeLocal().slice(0, 10));
  const [targetAppointmentForSlot, setTargetAppointmentForSlot] = useState<Appointment | null>(null);

  // Card inline scheduling date/time state
  const [cardDates, setCardDates] = useState<Record<string, string>>({});

  const handleOpenAvailabilityForApp = (app: Appointment) => {
    setTargetAppointmentForSlot(app);
    const existingDate = app.scheduled_date ? app.scheduled_date.slice(0, 10) : getPeruDateTimeLocal().slice(0, 10);
    setAvailabilityDate(existingDate);
    setAvailabilityModalOpen(true);
  };

  const handleSelectSlot = (timeSlot: string) => {
    if (!targetAppointmentForSlot) return;
    const fullDateTime = `${availabilityDate}T${timeSlot}`;
    setCardDates((prev) => ({ ...prev, [targetAppointmentForSlot.id]: fullDateTime }));
    updateAppointment(targetAppointmentForSlot.id, { scheduled_date: fullDateTime });
    setAvailabilityModalOpen(false);
    showSuccess(`Horario ${timeSlot} asignado para ${targetAppointmentForSlot.plate}`);
  };

  const handleConfirmAndSendWhatsApp = (app: Appointment) => {
    const chosenDate = cardDates[app.id] || app.scheduled_date || getPeruDateTimeLocal();
    updateAppointment(app.id, {
      status: "confirmado",
      scheduled_date: chosenDate,
    });

    const dateFormatted = formatPeruDateTime(chosenDate, false);
    const cleanPhone = (app.client_phone || "").replace(/[^0-9]/g, "");
    const clientName = app.client_name || "Cliente";
    const plate = app.plate || "S/P";
    const service = app.service_type || "Servicio Técnico";

    const message = encodeURIComponent(
      `Estimado(a) *${clientName}*, le recordamos que su vehículo con placa *${plate}* tiene programada su atención de *${service}* para el *${dateFormatted}* en nuestro taller.\n\nLe esperamos puntualmente. Ante cualquier consulta o reprogramación, no dude en comunicarse con nosotros.\n\n¡Gracias por su preferencia!\n*ReyGas Autogás Equipment*`
    );

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
    showSuccess(`¡Cita de ${plate} confirmada y mensaje generado para WhatsApp!`);
  };

  // Compute availability for slots on availabilityDate
  const WORKSHOP_HOURLY_SLOTS = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];

  const getSlotOccupancy = (slotTime: string) => {
    const slotPrefix = `${availabilityDate}T${slotTime}`;
    const matchedAppointments = appointments.filter(
      (a) => a.status !== "cancelado" && a.scheduled_date && a.scheduled_date.startsWith(slotPrefix.slice(0, 13))
    );
    const matchedSchedule = (scheduleRecords || []).filter(
      (s) => (s.scheduled_date && s.scheduled_date.startsWith(slotPrefix.slice(0, 13)))
    );
    const totalOccupied = matchedAppointments.length + matchedSchedule.length;
    return {
      totalOccupied,
      appointments: matchedAppointments,
      schedule: matchedSchedule,
      isFull: totalOccupied >= 2, // 2 capacity per slot
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Recepción & Citas</h1>
            <p className="text-xs text-gray-400">
              Gestión de citas web, asignación de fecha/hora según disponibilidad, confirmación vía WhatsApp y radar de mantenimiento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setTargetAppointmentForSlot(null);
              setAvailabilityModalOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Clock className="w-4 h-4" />
            <span>📅 Ver Disponibilidad General</span>
          </button>

          <div className="flex items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("citas")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "citas"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              Reservas & Citas Web ({appointments.length})
            </button>
            <button
              onClick={() => handleOpenCartillaModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
              title="Registrar nueva cartilla de servicio para alimentar la Tabla de Programación"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Cartilla</span>
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "radar"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              Radar Vencimientos 90D ({radarItems.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "citas" ? (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>Solicitudes de Citas y Reservas Registradas</span>
              </h2>
              <span className="text-xs text-gray-400">
                Asigna fecha/hora según disponibilidad y envía la confirmación oficial a WhatsApp.
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-2">
                <Calendar className="w-12 h-12 mx-auto text-gray-600" />
                <p className="text-sm">No hay citas registradas en el sistema.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appointments.map((app) => {
                  const currentScheduled = cardDates[app.id] || app.scheduled_date || getPeruDateTimeLocal();

                  return (
                    <div
                      key={app.id}
                      className="p-5 rounded-2xl glass-card border border-white/10 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-4 relative group"
                    >
                      <div className="space-y-3">
                        {/* Top Plate & Status */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-lg text-white bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow-inner">
                            {app.plate}
                          </span>
                          <span
                            className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider ${app.status === "confirmado"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : app.status === "completado"
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : app.status === "cancelado"
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                          >
                            {app.status === "pendiente" ? "⏳ Pendiente de Fecha" : app.status}
                          </span>
                        </div>

                        {/* Client Info */}
                        <div>
                          <h3 className="font-bold text-white text-base flex items-center justify-between">
                            <span>{app.client_name}</span>
                          </h3>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-reygas-red" />
                            <span>{app.client_phone}</span>
                          </p>
                          <span className="inline-block mt-2 text-xs font-extrabold text-reygas-red uppercase tracking-wider bg-reygas-red/10 px-2 py-0.5 rounded border border-reygas-red/30">
                            {app.service_type}
                          </span>
                        </div>

                        {/* Assign Date & Time Section */}
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase text-amber-400">
                              Asignar Fecha y Hora:
                            </label>
                            <button
                              type="button"
                              onClick={() => handleOpenAvailabilityForApp(app)}
                              className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline flex items-center gap-1"
                              title="Ver horarios disponibles para agendar"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Ver Disponibilidad</span>
                            </button>
                          </div>

                          <input
                            type="datetime-local"
                            value={currentScheduled.slice(0, 16)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCardDates((prev) => ({ ...prev, [app.id]: val }));
                              updateAppointment(app.id, { scheduled_date: val });
                            }}
                            className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400"
                          />

                          {app.notes && (
                            <p className="text-[11px] text-gray-400 italic bg-reygas-dark/60 p-2 rounded border border-white/5 mt-1">
                              "{app.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Toolbar */}
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        {/* Primary Action: Confirm & Send WhatsApp */}
                        <button
                          onClick={() => handleConfirmAndSendWhatsApp(app)}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform hover:scale-102"
                          title="Confirmar cita y enviar mensaje formal por WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Confirmar Cita (Enviar WhatsApp)</span>
                        </button>

                        {/* Secondary Actions: Edit & Delete */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => handleOpenEditModal(app)}
                            className="flex-1 py-1.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 hover:text-white text-[11px] font-bold rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1"
                            title="Editar datos de la cita"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Editar Datos</span>
                          </button>

                          <button
                            onClick={() => handleDeleteAppointment(app.id, app.plate)}
                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-red-500/30 transition-colors"
                            title="Eliminar cita del sistema"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Radar Vencimientos 90 Días Post-Instalación & Programación */
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span>Radar de Vencimientos 90 Días (Post-Instalación & Mantenimiento)</span>
              </h2>
              <p className="text-xs text-gray-400">
                Vehículos programados a 90 días después de: Instalación 5ta GNV FISE, Instalación 5ta GNV al contado, Instalación 3ra GNV al contado, Instalación 5ta GLP e Instalación 3ra GLP.
              </p>
            </div>

            {/* 4 Radar Filters Bar */}
            <div className="flex items-center gap-2 bg-reygas-dark p-1.5 rounded-xl border border-white/10 flex-wrap">
              <button
                onClick={() => setRadarFilter("semanal")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${radarFilter === "semanal"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                  }`}
              >
                <span>📅 Semanal</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono">
                  {filterCounts.semanal}
                </span>
              </button>

              <button
                onClick={() => setRadarFilter("mensual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${radarFilter === "mensual"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                  }`}
              >
                <span>🗓️ Mensual</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono">
                  {filterCounts.mensual}
                </span>
              </button>

              <button
                onClick={() => setRadarFilter("10dias")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${radarFilter === "10dias"
                    ? "bg-amber-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                  }`}
              >
                <span>⚠️ Faltando 10 días</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono">
                  {filterCounts.diezDias}
                </span>
              </button>

              <button
                onClick={() => setRadarFilter("todos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${radarFilter === "todos"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                  }`}
              >
                <span>🌐 Mostrar todos</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono">
                  {filterCounts.todos}
                </span>
              </button>
            </div>

            {/* Month & Year Selectors (when inspecting monthly expiry, unified web design) */}
            {radarFilter === "mensual" && (
              <div className="flex items-center gap-2 bg-reygas-surface p-1.5 rounded-xl border border-white/10 text-xs">
                <span className="text-gray-400 font-bold text-[11px] pl-1">Filtrar Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-reygas-dark text-white font-bold px-2 py-1 rounded-lg border border-white/10 focus:border-cyan-400 text-xs cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-reygas-dark text-white font-mono font-bold px-2 py-1 rounded-lg border border-white/10 focus:border-cyan-400 text-xs cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filteredRadarItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-gray-600" />
              <p className="text-sm">No hay vehículos con vencimiento para el filtro seleccionado ({radarFilter}).</p>
              <p className="text-xs text-gray-600">
                Puedes registrar cartillas de servicio con el botón "Registrar Cartilla" para alimentar las alertas a 90 días.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRadarItems.map((item) => {
                const isOverdue = item.diffDays < 0;
                const isToday = item.diffDays === 0;
                const isUrgent = item.diffDays > 0 && item.diffDays <= 10;

                return (
                  <div
                    key={item.id + item.plate}
                    className={`p-5 rounded-2xl glass-card border flex flex-col justify-between space-y-4 transition-all hover:border-amber-500/50 ${isOverdue
                        ? "border-red-500/40 bg-red-950/10"
                        : isUrgent
                          ? "border-amber-500/40 bg-amber-950/10"
                          : "border-white/10"
                      }`}
                  >
                    <div className="space-y-3">
                      {/* Plate and Due Badge */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-lg text-white bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow-inner">
                          {item.plate}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider ${isOverdue
                              ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                              : isToday
                                ? "bg-red-500 text-white font-black animate-bounce"
                                : isUrgent
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                        >
                          {isOverdue
                            ? `🔴 Vencido hace ${Math.abs(item.diffDays)} días`
                            : isToday
                              ? `🔴 ¡Vence HOY!`
                              : isUrgent
                                ? `🟡 ¡Urgente! Vence en ${item.diffDays} días`
                                : `🟢 Próximo (${item.diffDays} días)`}
                        </span>
                      </div>

                      {/* Client info */}
                      <div>
                        <h3 className="font-bold text-white text-base truncate">{item.client_name}</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-reygas-red" />
                          <span>{item.client_phone || "Sin teléfono"}</span>
                          {item.current_mileage && item.current_mileage > 0 ? (
                            <span className="ml-2 text-cyan-300 font-bold">
                              • {item.current_mileage.toLocaleString()} KM
                            </span>
                          ) : null}
                        </p>
                        <span className="inline-block mt-2 text-xs font-extrabold text-amber-300 uppercase tracking-wider bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                          {item.service_name}
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="text-xs text-gray-300 pt-2 border-t border-white/10 space-y-1 bg-reygas-dark/40 p-2.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Fecha de Atención:</span>
                          <span className="font-mono text-gray-200 font-bold">{item.service_date}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold">Límite 90 Días:</span>
                          <span className="font-mono text-amber-300 font-black">{item.dueDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Action Button */}
                    <button
                      onClick={() => handleSendRadarWhatsApp(item)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform hover:scale-102"
                      title="Enviar recordatorio formal por WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar Recordatorio 90D WhatsApp</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT APPOINTMENT / REQUEST */}
      {/* ========================================================================= */}
      {editingApp && editForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/20 space-y-4 relative">
            <button
              onClick={() => {
                setEditingApp(null);
                setEditForm(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>Editar Reserva / Cita ({editingApp.plate})</span>
              </h3>
              <p className="text-xs text-gray-400">
                Modifique los datos del cliente, servicio o fecha agendada.
              </p>
            </div>

            <form onSubmit={handleSaveEditAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.client_name}
                  onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Teléfono WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.client_phone}
                    onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.plate}
                    onChange={(e) => setEditForm({ ...editForm, plate: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Tipo de Servicio
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Estado de la Cita
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Appointment["status"] })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha y Hora Agendada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editForm.scheduled_date ? editForm.scheduled_date.slice(0, 16) : ""}
                  onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Observaciones / Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  placeholder="Detalles adicionales del requerimiento..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingApp(null);
                    setEditForm(null);
                  }}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/30"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRANSFER APPOINTMENT TO WORKSHOP ERP (KANBAN) */}
      {/* ========================================================================= */}
      {transferApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-blue-500/40 space-y-4 relative">
            <button
              onClick={() => setTransferApp(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-400" />
                <span>Ingresar Vehículo a Taller ERP ({transferApp.plate})</span>
              </h3>
              <p className="text-xs text-gray-400">
                Seleccione el estado de inicio en el flujo Kanban y asigne un técnico operativo.
              </p>
            </div>

            <form onSubmit={handleConfirmWorkshopTransfer} className="space-y-4">
              <div className="p-3 bg-reygas-dark rounded-xl border border-white/10 space-y-1 text-xs">
                <span className="text-gray-400">Datos de la Cita:</span>
                <p className="text-white font-bold">{transferApp.client_name} ({transferApp.client_phone})</p>
                <p className="text-reygas-red font-semibold">{transferApp.service_type}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Etapa de Inicio en Taller Kanban *
                </label>
                <select
                  value={transferForm.target_status}
                  onChange={(e) => setTransferForm({ ...transferForm, target_status: e.target.value as WorkOrderStatus })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ingresado">1. Ingresado (Espera de Turno en Portería)</option>
                  <option value="en_diagnostico">2. En Diagnóstico (Computadora & Regulador)</option>
                  <option value="esperando_repuestos">3. Esperando Repuestos / Kit de Gas</option>
                  <option value="en_servicio">4. En Servicio (Conversión / Mantenimiento Activo)</option>
                  <option value="por_cobrar">5. Por Cobrar (Liquidación en Caja)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Asignar Técnico Máster Responsable
                </label>
                <select
                  value={transferForm.technician_id}
                  onChange={(e) => setTransferForm({ ...transferForm, technician_id: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Sin Técnico Asignado --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Descripción del Trabajo / Diagnóstico Inicial
                </label>
                <textarea
                  rows={3}
                  required
                  value={transferForm.problem_description}
                  onChange={(e) => setTransferForm({ ...transferForm, problem_description: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferApp(null)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Confirmar Ingreso a Taller</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANUAL APPOINTMENT CREATION */}
      {/* ========================================================================= */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/20 space-y-4 relative">
            <button
              onClick={() => setNewModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-reygas-red" />
                <span>Registrar Nueva Cita Manual</span>
              </h3>
              <p className="text-xs text-gray-400">
                Para reservas telefónicas o presenciales en recepción.
              </p>
            </div>

            <form onSubmit={handleCreateNewAppointment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Ramírez"
                  value={newForm.client_name}
                  onChange={(e) => setNewForm({ ...newForm, client_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+51 987654321"
                    value={newForm.client_phone}
                    onChange={(e) => setNewForm({ ...newForm, client_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={newForm.plate}
                    onChange={(e) => setNewForm({ ...newForm, plate: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Tipo de Servicio
                </label>
                <select
                  value={newForm.service_type}
                  onChange={(e) => setNewForm({ ...newForm, service_type: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                >
                  <option value="Conversión a GNV 5ta Gen">Conversión a GNV 5ta Gen</option>
                  <option value="Conversión a GLP 5ta Gen">Conversión a GLP 5ta Gen</option>
                  <option value="Mantenimiento Preventivo 15,000 km">Mantenimiento Preventivo 15,000 km</option>
                  <option value="Certificación Anual & Prueba Hidrostática">Certificación Anual & Prueba Hidrostática</option>
                  <option value="Diagnóstico de Inyección / Escáner ECU">Diagnóstico de Inyección / Escáner ECU</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha y Hora Agendada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newForm.scheduled_date}
                  onChange={(e) => setNewForm({ ...newForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el vehículo..."
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-xs shadow-lg shadow-reygas-red/30"
                >
                  Guardar Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DISPONIBILIDAD DE HORARIOS Y BAHÍAS */}
      {/* ========================================================================= */}
      {availabilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full p-6 rounded-2xl border border-blue-500/40 space-y-5 relative shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setAvailabilityModalOpen(false);
                setTargetAppointmentForSlot(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>Disponibilidad de Horarios del Taller</span>
              </h3>
              <p className="text-xs text-gray-400">
                {targetAppointmentForSlot
                  ? `Selecciona un horario libre para asignar a la cita del vehículo ${targetAppointmentForSlot.plate}:`
                  : "Consulta en tiempo real de ocupación y cupos por fecha:"}
              </p>
            </div>

            {/* Date Selector Filter with unified MiniDatePicker */}
            <div className="flex items-center gap-3 p-3 bg-reygas-dark rounded-xl border border-white/10 flex-wrap">
              <MiniDatePicker
                value={availabilityDate}
                onChange={(d) => setAvailabilityDate(d)}
                label="Fecha a Consultar:"
              />
              <button
                type="button"
                onClick={() => setAvailabilityDate(getPeruDateTimeLocal().slice(0, 10))}
                className="mt-4 px-3 py-2 bg-blue-950/60 text-blue-300 hover:bg-blue-900 border border-blue-500/30 rounded-xl text-xs font-bold transition-colors"
              >
                Hoy
              </button>
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WORKSHOP_HOURLY_SLOTS.map((slot) => {
                const occupancy = getSlotOccupancy(slot);
                const isFull = occupancy.isFull;

                return (
                  <div
                    key={slot}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${isFull
                        ? "bg-red-950/20 border-red-500/30 text-red-300"
                        : occupancy.totalOccupied > 0
                          ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                          : "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span>{slot} hrs</span>
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${isFull
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : occupancy.totalOccupied > 0
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                      >
                        {isFull ? "🔴 Ocupado (2/2)" : occupancy.totalOccupied > 0 ? "🟡 1 Turno Ocupado" : "🟢 Disponible"}
                      </span>
                    </div>

                    {/* Bookings details in this slot */}
                    {occupancy.totalOccupied > 0 ? (
                      <div className="space-y-1 text-[11px] text-gray-300 bg-black/40 p-2 rounded-lg border border-white/5">
                        {occupancy.appointments.map((a) => (
                          <div key={a.id} className="truncate">
                            <span className="font-mono font-bold text-white">{a.plate}</span> • {a.client_name} ({a.service_type})
                          </div>
                        ))}
                        {occupancy.schedule.map((s) => (
                          <div key={s.id} className="truncate">
                            <span className="font-mono font-bold text-white">{s.vehicle_plate}</span> • {s.client_name} ({s.service_name})
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">
                        Sin vehículos agendados para este bloque.
                      </p>
                    )}

                    {targetAppointmentForSlot && (
                      <button
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all shadow ${isFull
                            ? "bg-gray-800 text-gray-400 hover:text-white"
                            : "bg-blue-600 hover:bg-blue-500 text-white"
                          }`}
                      >
                        {isFull ? "Asignar de todos modos" : "✓ Seleccionar este Horario"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setAvailabilityModalOpen(false);
                  setTargetAppointmentForSlot(null);
                }}
                className="px-5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REGISTRAR CARTILLA DE SERVICIO (ALIMENTA TABLA DE PROGRAMACIÓN) */}
      {/* ========================================================================= */}
      {cartillaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-emerald-500/40 space-y-4 relative shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto bg-reygas-dark">
            <button
              onClick={() => setCartillaModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Registrar Cartilla de Servicio</span>
              </h3>
              <p className="text-xs text-gray-400">
                Al registrar esta cartilla se alimenta la <strong>Tabla de Programación</strong> y se activa el <strong>Radar a 90 días</strong>.
              </p>
            </div>

            <form onSubmit={handleSaveCartilla} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={cartillaForm.vehicle_plate}
                    onChange={(e) =>
                      setCartillaForm({ ...cartillaForm, vehicle_plate: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-sm text-white uppercase font-mono font-bold focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Kilometraje (KM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej. 15000"
                    value={cartillaForm.current_mileage || ""}
                    onChange={(e) =>
                      setCartillaForm({
                        ...cartillaForm,
                        current_mileage: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-sm text-white font-mono focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Carlos Ramírez"
                    value={cartillaForm.client_name}
                    onChange={(e) =>
                      setCartillaForm({ ...cartillaForm, client_name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-sm text-white focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    WhatsApp / Teléfono *
                  </label>
                  <input
                    type="tel"
                    placeholder="+51 987654321"
                    value={cartillaForm.client_phone}
                    onChange={(e) =>
                      setCartillaForm({ ...cartillaForm, client_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-sm text-white font-mono focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Servicio / Instalación Realizada *
                </label>
                <select
                  value={cartillaForm.service_name}
                  onChange={(e) =>
                    setCartillaForm({ ...cartillaForm, service_name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 bg-reygas-surface border border-white/10 rounded-xl text-xs font-bold text-white focus:border-emerald-400"
                >
                  <option value="Instalación 5ta GNV FISE">Instalación 5ta GNV FISE (Alerta 90 Días)</option>
                  <option value="Instalación 5ta GNV al contado">Instalación 5ta GNV al contado (Alerta 90 Días)</option>
                  <option value="Instalación 3ra GNV al contado">Instalación 3ra GNV al contado (Alerta 90 Días)</option>
                  <option value="Instalación 5ta GLP">Instalación 5ta GLP (Alerta 90 Días)</option>
                  <option value="Instalación 3ra GLP">Instalación 3ra GLP (Alerta 90 Días)</option>
                  <option value="Mantenimiento Preventivo 15,000 km">Mantenimiento Preventivo 15,000 km</option>
                  <option value="Calibración & Escaneo ECU">Calibración & Escaneo ECU</option>
                  <option value="Certificación Anual & Prueba Hidrostática">Certificación Anual & Prueba Hidrostática</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MiniDatePicker
                    value={cartillaForm.service_date}
                    onChange={(newDate) => {
                      setCartillaForm({
                        ...cartillaForm,
                        service_date: newDate,
                        next_maintenance_date: calculate90Days(newDate),
                      });
                    }}
                    label="Fecha del Servicio *"
                  />
                </div>

                <div>
                  <MiniDatePicker
                    value={cartillaForm.next_maintenance_date}
                    onChange={(newDate) =>
                      setCartillaForm({ ...cartillaForm, next_maintenance_date: newDate })
                    }
                    label="Próx. Vencimiento (90 Días) *"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                    Vencimiento Quinquenal (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={cartillaForm.expiry_quinquennial}
                    onChange={(e) =>
                      setCartillaForm({ ...cartillaForm, expiry_quinquennial: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                    Vencimiento Chip / Anual (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={cartillaForm.expiry_chip_annual}
                    onChange={(e) =>
                      setCartillaForm({ ...cartillaForm, expiry_chip_annual: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles del equipo instalado, cilindro, reductor..."
                  value={cartillaForm.notes}
                  onChange={(e) =>
                    setCartillaForm({ ...cartillaForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-emerald-400"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCartillaModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-transform hover:scale-102"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cartilla & Alimentar Programación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-black/90 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${confirmModal.danger ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{confirmModal.title}</h3>
                  <p className="text-xs text-gray-400">Confirmación de Acción</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
              >
                {confirmModal.cancelLabel || "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${confirmModal.danger
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                    : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30"
                  }`}
              >
                {confirmModal.confirmLabel || "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
