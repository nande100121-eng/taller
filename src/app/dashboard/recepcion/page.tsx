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
  FileSpreadsheet,
  Search,
  Upload,
  Printer,
  CalendarDays,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { getPeruDateTimeLocal, formatPeruDateTime, getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { formatPlate, titleCase, capitalizeFirst } from "@/lib/utils/text-format";
import { lookupPlateClientData } from "@/lib/utils/plate-autofill";
import ReactDOM from "react-dom";

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
    workshopServices,
    correlativeConfig,
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
    responsible: "",
  });

  // Personal autorizado como "Responsable de la Atención" (permiso activado en Tabla Maestra)
  const attentionResponsibles = technicians.filter((t) => t.is_active !== false && !!t.is_attention_responsible);

  // Cupos máximos de vehículos por bloque horario (configurable en Configuración; por defecto 3)
  const maxVehiclesPerSlot = Math.max(1, Number(correlativeConfig?.maxVehiclesPerSlot) || 3);

  // Hora manual para "Disponibilidad de Horarios" (input libre además de los bloques fijos)
  const [manualSlotTime, setManualSlotTime] = useState("");

  // Autocompleta Nombre y Teléfono del cliente desde la Tabla Registro del Taller
  // (vehículos del ERP + histórico CSV) cuando se escribe una placa completa.
  const autofillPlateClient = async (
    plate: string,
    apply: (name: string, phone: string) => void
  ) => {
    // Dispara con placas parciales: la búsqueda es por coincidencia EXACTA, así que
    // solo llena cuando la placa ya está completa y existe en el registro del taller.
    const clean = (plate || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (clean.length < 4) return;
    const data = await lookupPlateClientData(plate, vehicles);
    if (data.found) {
      apply(data.client_name, data.client_phone);
    }
  };

  // Abrir modal de nueva cita con el formulario limpio y el primer servicio del catálogo por defecto
  const catalogServices = (workshopServices || []).filter((s) => s.is_active !== false);
  const handleOpenNewAppointmentModal = () => {
    const firstService = catalogServices[0]?.name || "Conversión a GNV 5ta Gen";
    setNewForm({
      client_name: "",
      client_phone: "",
      plate: "",
      service_type: firstService,
      scheduled_date: getPeruDateTimeLocal(new Date(Date.now() + 86400000)),
      notes: "",
      responsible: "",
    });
    setNewModalOpen(true);
  };

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
    // Validación de fecha (calendario unificado MiniDatePicker)
    const nDate = newForm.scheduled_date?.slice(0, 10);
    const nTime = newForm.scheduled_date?.slice(11, 16);
    if (!nDate) {
      notify("warning", "Seleccione la fecha de la cita en el calendario.");
      return;
    }
    // Validación de disponibilidad: no permitir duplicar en un horario lleno
    if (nDate && nTime) {
      const occ = getOccupancyForDate(nDate, nTime);
      if (occ.isFull) {
        notify("warning", "El horario " + nTime + " del " + formatPeruDate(nDate) + " ya está lleno (" + maxVehiclesPerSlot + " vehículos). Elija otro horario disponible.");
        return;
      }
    }
    addAppointment({
      client_name: newForm.client_name,
      client_phone: newForm.client_phone,
      plate: newForm.plate.toUpperCase(),
      service_type: newForm.service_type,
      scheduled_date: newForm.scheduled_date,
      notes: newForm.notes,
      responsible: newForm.responsible,
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

    // Validación de fecha (calendario unificado MiniDatePicker)
    const eDate = editForm.scheduled_date?.slice(0, 10);
    const eTime = editForm.scheduled_date?.slice(11, 16);
    if (!eDate) {
      notify("warning", "Seleccione la fecha de la cita en el calendario.");
      return;
    }
    // Validación de disponibilidad (excluye la cita en edición para no contarse a sí misma)
    if (eDate && eTime) {
      const occ = getOccupancyForDate(eDate, eTime, editingApp.id);
      if (occ.isFull) {
        notify("warning", "El horario " + eTime + " del " + formatPeruDate(eDate) + " ya está lleno (" + maxVehiclesPerSlot + " vehículos). Elija otro horario disponible.");
        return;
      }
    }

    updateAppointment(editingApp.id, {
      client_name: editForm.client_name,
      client_phone: editForm.client_phone,
      plate: editForm.plate.toUpperCase(),
      service_type: editForm.service_type,
      scheduled_date: editForm.scheduled_date,
      status: editForm.status,
      notes: editForm.notes,
      responsible: editForm.responsible,
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

  // ===== Tabla de Programación de Citas (semanal): búsqueda por placa, filtros rápidos, CSV e informe diario =====
  const [plateSearch, setPlateSearch] = useState("");
  const deferredPlateSearch = React.useDeferredValue(plateSearch);
  const [quickFilter, setQuickFilter] = useState<"todas" | "hoy" | "semana" | "pendientes" | "confirmadas" | "completadas" | "canceladas">("todas");
  // Filtro por FECHA: al elegir una fecha se muestran solo las cards de citas de ese día.
  const [citasDateFilter, setCitasDateFilter] = useState<string>("");
  // Cards de citas colapsadas POR DEFECTO (se guardan los ids EXPANDIDOS; vacío = todas colapsadas)
  const [expandedAppCards, setExpandedAppCards] = useState<Set<string>>(new Set());
  const toggleAppCard = (id: string) => {
    setExpandedAppCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Modal de importación CSV (tabla de programación de la semana)
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<Array<{ plate: string; scheduled_date: string; service_type: string; responsible: string; notes: string }>>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  // Modal de Informe Diario de Citas
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [reportDate, setReportDate] = useState(getPeruDateTimeLocal().slice(0, 10));

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

  // --- Hora manual en Disponibilidad de Horarios (input libre además de los bloques fijos) ---
  const applyManualSlotToNew = () => {
    const t = manualSlotTime;
    if (!t || !newForm.scheduled_date) { notify("warning", "Ingrese una hora manual (HH:MM)."); return; }
    const occ = getOccupancyForDate(newForm.scheduled_date.slice(0, 10), t);
    if (occ.isFull) { notify("warning", `El horario ${t} ya está lleno (${maxVehiclesPerSlot} vehículos).`); return; }
    setNewForm({ ...newForm, scheduled_date: `${newForm.scheduled_date.slice(0, 10)}T${t}` });
    showSuccess(`Hora ${t} seleccionada.`);
  };
  const applyManualSlotToEdit = () => {
    const t = manualSlotTime;
    if (!t || !editForm?.scheduled_date) { notify("warning", "Ingrese una hora manual (HH:MM)."); return; }
    const occ = getOccupancyForDate(editForm.scheduled_date.slice(0, 10), t, editingApp?.id);
    if (occ.isFull) { notify("warning", `El horario ${t} ya está lleno (${maxVehiclesPerSlot} vehículos).`); return; }
    setEditForm({ ...editForm, scheduled_date: `${editForm.scheduled_date.slice(0, 10)}T${t}` });
    showSuccess(`Hora ${t} seleccionada.`);
  };
  const applyManualSlotToAvailability = () => {
    const t = manualSlotTime;
    if (!t) { notify("warning", "Ingrese una hora manual (HH:MM)."); return; }
    if (targetAppointmentForSlot) {
      handleSelectSlot(t);
    } else {
      const occ = getOccupancyForDate(availabilityDate, t);
      notify("success", occ.isFull
        ? `Hora ${t}: llena (${occ.totalOccupied}/${maxVehiclesPerSlot} vehículos)`
        : occ.totalOccupied > 0
          ? `Hora ${t}: ${occ.totalOccupied}/${maxVehiclesPerSlot} cupos ocupados`
          : `Hora ${t}: disponible`
      );
    }
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

  // ===== Tabla de Programación (CSV): parseo, importación y filtros =====
  const parseCsvDate = (d: string): string => {
    const s = (d || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split("/");
      return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return "";
  };

  const parseCsvTime = (t: string): string => {
    const s = (t || "").trim().toLowerCase();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
    if (!m) return "";
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3] || "";
    if (ampm.includes("p") && h < 12) h += 12;
    if (ampm.includes("a") && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  const parseProgramacionCsv = (text: string) => {
    const rows: Array<{ plate: string; scheduled_date: string; service_type: string; responsible: string; notes: string }> = [];
    const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return rows;
    const hasSemicolon = lines[0].includes(";");
    for (const line of lines) {
      const parts = hasSemicolon ? line.split(";") : line.split(",");
      if (parts.length < 3) continue;
      const [placa, fecha, hora, servicio, responsable, observaciones] = parts.map((p) => (p || "").trim());
      if (!placa || placa.toLowerCase().includes("placa")) continue; // saltar encabezado
      const isoDate = parseCsvDate(fecha);
      const isoTime = parseCsvTime(hora);
      if (!isoDate) continue;
      const scheduled_date = isoTime ? `${isoDate}T${isoTime}` : `${isoDate}T08:00`;
      rows.push({
        plate: placa.toUpperCase().replace(/\s+/g, ""),
        scheduled_date,
        service_type: servicio || "Servicio Técnico",
        responsible: responsable && responsable !== "—" && responsable !== "-" ? responsable : "",
        notes: observaciones && observaciones !== "—" && observaciones !== "-" ? observaciones : "",
      });
    }
    return rows;
  };

  const handlePreviewCsv = (text: string) => {
    setCsvText(text);
    setCsvPreview(parseProgramacionCsv(text));
  };

  const handleImportCsv = () => {
    const existing = new Set(appointments.map((a) => `${a.plate.toUpperCase().trim()}_${a.scheduled_date}`));
    let added = 0;
    let skipped = 0;
    for (const row of csvPreview) {
      const key = `${row.plate}_${row.scheduled_date}`;
      if (existing.has(key)) { skipped++; continue; }
      addAppointment({
        client_name: "CLIENTES VARIOS",
        client_phone: "",
        plate: row.plate,
        service_type: row.service_type,
        scheduled_date: row.scheduled_date,
        notes: row.notes,
        responsible: row.responsible,
      });
      existing.add(key);
      added++;
    }
    setCsvModalOpen(false);
    setCsvText("");
    setCsvPreview([]);
    showSuccess(added > 0
      ? `¡Programación importada! ${added} cita(s) agregada(s)${skipped > 0 ? ` (${skipped} duplicada(s) omitida(s))` : ""}.`
      : "No se importaron citas nuevas (ya estaban registradas o el archivo no tiene filas válidas).");
  };

  const handleLoadWeekCsv = async () => {
    setCsvImporting(true);
    try {
      const res = await fetch("/tabla-de-programacion.csv");
      const text = await res.text();
      setCsvText(text);
      setCsvPreview(parseProgramacionCsv(text));
    } catch (err) {
      notify("warning", "No se pudo cargar el archivo de programación. Péguelo manualmente.");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => handlePreviewCsv(String(reader.result || ""));
    reader.readAsText(file);
  };

  // Filtro rápido de citas por placa + chips de consulta rápida
  const filteredAppointments = React.useMemo(() => {
    const clean = deferredPlateSearch.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let list = appointments;
    if (clean) {
      list = list.filter((a) => a.plate.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(clean));
    }
    const today = getPeruDateString();
    const weekStart = (() => { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
    const weekEnd = (() => { const d = new Date(weekStart + "T12:00:00"); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
    // Filtro por FECHA seleccionada: muestra SOLO las cards de citas de ese día
    if (citasDateFilter) {
      list = list.filter((a) => (a.scheduled_date || "").slice(0, 10) === citasDateFilter);
    }
    switch (quickFilter) {
      case "hoy":
        list = list.filter((a) => (a.scheduled_date || "").slice(0, 10) === today);
        break;
      case "semana":
        list = list.filter((a) => { const d = (a.scheduled_date || "").slice(0, 10); return d >= weekStart && d <= weekEnd; });
        break;
      case "pendientes":
        list = list.filter((a) => a.status === "pendiente");
        break;
      case "confirmadas":
        list = list.filter((a) => a.status === "confirmado");
        break;
      case "completadas":
        list = list.filter((a) => a.status === "completado");
        break;
      case "canceladas":
        list = list.filter((a) => a.status === "cancelado");
        break;
      default:
        break;
    }
    // Ordenar por fecha/hora ascendente
    return [...list].sort((a, b) => String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || "")));
  }, [appointments, deferredPlateSearch, quickFilter, citasDateFilter]);

  // ===== Informe Diario de Citas / Programación =====
  const dailyAppointments = React.useMemo(() => {
    return appointments
      .filter((a) => (a.scheduled_date || "").slice(0, 10) === reportDate)
      .sort((a, b) => String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || "")));
  }, [appointments, reportDate]);

  const dailyCounts = React.useMemo(() => ({
    total: dailyAppointments.length,
    confirmadas: dailyAppointments.filter((a) => a.status === "confirmado").length,
    pendientes: dailyAppointments.filter((a) => a.status === "pendiente").length,
    completadas: dailyAppointments.filter((a) => a.status === "completado").length,
    canceladas: dailyAppointments.filter((a) => a.status === "cancelado").length,
  }), [dailyAppointments]);

  const changeReportDate = (delta: number) => {
    const d = new Date(reportDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handlePrintDailyReport = () => {
    setTimeout(() => window.print(), 150);
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

  // Ocupación genérica por fecha/hora (reutilizada en Nueva Cita, Editar Cita y Disponibilidad General).
  // excludeAppId permite que, al editar, la cita en edición no se cuente a sí misma como ocupada.
  const getOccupancyForDate = (dateStr: string, slotTime: string, excludeAppId?: string) => {
    const slotPrefix = `${dateStr}T${slotTime}`;
    const matchedAppointments = appointments.filter(
      (a) => a.status !== "cancelado" && a.scheduled_date && a.scheduled_date.startsWith(slotPrefix.slice(0, 13)) && a.id !== excludeAppId
    );
    const matchedSchedule = (scheduleRecords || []).filter(
      (s) => (s.scheduled_date && s.scheduled_date.startsWith(slotPrefix.slice(0, 13)))
    );
    const totalOccupied = matchedAppointments.length + matchedSchedule.length;
    return {
      totalOccupied,
      appointments: matchedAppointments,
      schedule: matchedSchedule,
      isFull: totalOccupied >= maxVehiclesPerSlot, // capacidad configurable (Configuración → Vehículos por Horario)
    };
  };

  const getSlotOccupancy = (slotTime: string) => getOccupancyForDate(availabilityDate, slotTime);

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

          <button
            onClick={handleOpenNewAppointmentModal}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-transform hover:scale-105"
            title="Registrar una nueva cita manualmente (modal)"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Nueva Cita</span>
          </button>

          <button
            onClick={() => setCsvModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
            title="Importar la Tabla de Programación de la semana (CSV: Placa;Fecha;Hora;Servicio;Responsable;Observaciones)"
          >
            <Upload className="w-4 h-4" />
            <span>📥 Importar Programación</span>
          </button>

          <button
            onClick={() => setDailyReportOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-transform hover:scale-105"
            title="Informe Diario de Citas / Programación (imprimible)"
          >
            <CalendarDays className="w-4 h-4" />
            <span>📊 Informe Diario</span>
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
          {/* Filtros rápidos de consulta (todo en base al N° de placa) */}
          <div className="glass-panel p-4 rounded-2xl border border-blue-500/20 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="🔍 Buscar cita por N° de Placa... (Ej: B5Q-306)"
                  value={plateSearch}
                  onChange={(e) => setPlateSearch(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none font-mono font-bold uppercase"
                />
                {plateSearch && (
                  <button
                    type="button"
                    onClick={() => setPlateSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-2 py-1 text-[10px] font-bold"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                <span>Mostrando <strong className="text-white">{filteredAppointments.length}</strong> de <strong className="text-white">{appointments.length}</strong> citas</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { key: "todas", label: "🗂️ Todas" },
                { key: "hoy", label: "📅 Hoy" },
                { key: "semana", label: "🗓️ Esta Semana" },
                { key: "pendientes", label: "⏳ Pendientes" },
                { key: "confirmadas", label: "✅ Confirmadas" },
                { key: "completadas", label: "✔️ Completadas" },
                { key: "canceladas", label: "🚫 Canceladas" },
              ] as const).map((chip) => {
                const count = chip.key === "todas" ? appointments.length
                  : chip.key === "hoy" ? appointments.filter((a) => (a.scheduled_date || "").slice(0, 10) === getPeruDateString()).length
                  : chip.key === "semana" ? (() => {
                      const today = getPeruDateString();
                      const ws = (() => { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
                      const we = (() => { const d = new Date(ws + "T12:00:00"); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
                      return appointments.filter((a) => { const d = (a.scheduled_date || "").slice(0, 10); return d >= ws && d <= we; }).length;
                    })()
                  : appointments.filter((a) => a.status === (chip.key === "pendientes" ? "pendiente" : chip.key === "confirmadas" ? "confirmado" : chip.key === "completadas" ? "completado" : "cancelado")).length;
                const isActive = quickFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setQuickFilter(chip.key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${isActive
                      ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30"
                      : "bg-reygas-surface text-gray-300 border-white/10 hover:border-blue-500/40 hover:text-white"
                      }`}
                  >
                    {chip.label}
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? "bg-white/20" : "bg-black/40"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtro por FECHA: muestra las cards de citas del día seleccionado */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
              <DateNavigator
                value={citasDateFilter || getPeruDateString()}
                onChange={(d) => setCitasDateFilter(d)}
                label="Filtrar por fecha:"
              />
              {citasDateFilter && (
                <button
                  type="button"
                  onClick={() => setCitasDateFilter("")}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 text-white border border-blue-400 shadow-md shadow-blue-600/30 flex items-center gap-1"
                >
                  📅 {citasDateFilter.slice(8)}/{citasDateFilter.slice(5, 7)}/{citasDateFilter.slice(0, 4)} ✕ Quitar filtro
                </button>
              )}
              <span className="text-[10px] text-gray-500">
                {citasDateFilter
                  ? `Mostrando solo las cards de citas del día ${citasDateFilter.slice(8)}/${citasDateFilter.slice(5, 7)}/${citasDateFilter.slice(0, 4)} (${filteredAppointments.length}).`
                  : "Elige una fecha para ver solo las cards de ese día."}
              </span>
            </div>
          </div>

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
                <p className="text-[11px]">Use <strong className="text-emerald-400">📥 Importar Programación</strong> para cargar la tabla de citas de la semana o <strong className="text-blue-400">➕ Nueva Cita</strong> para registrar una manualmente.</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-10 text-center text-gray-500 space-y-2">
                <Search className="w-10 h-10 mx-auto text-gray-600" />
                <p className="text-sm">No hay citas que coincidan con el filtro de placa / estado / fecha.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAppointments.map((app) => {
                  const currentScheduled = cardDates[app.id] || app.scheduled_date || getPeruDateTimeLocal();
                  const isAppExpanded = expandedAppCards.has(app.id);

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
                          <button
                            type="button"
                            onClick={() => toggleAppCard(app.id)}
                            className={`p-1.5 rounded-lg border transition-all shrink-0 ${isAppExpanded
                              ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                              : "bg-white/5 text-gray-400 hover:text-white border-white/10 hover:border-white/30"
                              }`}
                            title={isAppExpanded ? "Contraer tarjeta" : "Expandir tarjeta"}
                          >
                            {isAppExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {isAppExpanded ? (
                          <>
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
                          {app.responsible && (
                            <span className="inline-block mt-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              👤 Responsable: {app.responsible}
                            </span>
                          )}
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
                          </>
                        ) : (
                          <div className="text-[11px] text-gray-400 space-y-1 pt-1">
                            <div>👤 {app.client_name}{app.client_phone ? " • " + app.client_phone : ""}</div>
                            <div className="text-reygas-red font-bold">{app.service_type}</div>
                            {app.scheduled_date && <div>📅 {formatPeruDateTime(app.scheduled_date)}</div>}
                          </div>
                        )}
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
                  onChange={(e) => setEditForm({ ...editForm, client_name: titleCase(e.target.value) })}
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
                    onChange={(e) => {
                      const plate = formatPlate(e.target.value);
                      setEditForm((prev) => (prev ? { ...prev, plate } : prev));
                      void autofillPlateClient(plate, (name, phone) => {
                        setEditForm((prev) =>
                          prev && prev.plate === plate
                            ? { ...prev, client_name: name || prev.client_name, client_phone: phone || prev.client_phone }
                            : prev
                        );
                      });
                    }}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center justify-between">
                    <span>Tipo de Servicio</span>
                    <span className="text-[9px] text-gray-500 font-semibold">Catálogo de Servicios</span>
                  </label>
                  <select
                    required
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    {editForm.service_type && !catalogServices.some((s) => s.name === editForm.service_type) && (
                      <option value={editForm.service_type}>{editForm.service_type} (manual)</option>
                    )}
                    {catalogServices.length > 0 ? (
                      catalogServices.map((srv) => (
                        <option key={srv.id} value={srv.name}>
                          {srv.name}{srv.price > 0 ? ` — S/ ${srv.price.toFixed(2)}` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Conversión a GNV 5ta Gen">Conversión a GNV 5ta Gen</option>
                        <option value="Conversión a GLP 5ta Gen">Conversión a GLP 5ta Gen</option>
                        <option value="Mantenimiento Preventivo 15,000 km">Mantenimiento Preventivo 15,000 km</option>
                        <option value="Certificación Anual & Prueba Hidrostática">Certificación Anual & Prueba Hidrostática</option>
                        <option value="Diagnóstico de Inyección / Escáner ECU">Diagnóstico de Inyección / Escáner ECU</option>
                      </>
                    )}
                  </select>
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
                  Responsable de la Atención {attentionResponsibles.length > 0 ? "" : "(opcional)"}
                </label>
                {attentionResponsibles.length > 0 ? (
                  <select
                    value={editForm.responsible || ""}
                    onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    <option value="">— Sin asignar —</option>
                    {attentionResponsibles.map((t) => (
                      <option key={t.id} value={t.full_name}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: Kelly, Cristhel"
                    value={editForm.responsible || ""}
                    onChange={(e) => setEditForm({ ...editForm, responsible: capitalizeFirst(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha de la Cita *
                </label>
                <MiniDatePicker
                  value={editForm.scheduled_date ? editForm.scheduled_date.slice(0, 10) : ""}
                  onChange={(d) => {
                    const curTime = editForm.scheduled_date?.includes("T") ? editForm.scheduled_date.slice(11, 16) : "08:00";
                    setEditForm({ ...editForm, scheduled_date: d ? d + "T" + curTime : "" });
                  }}
                />
              </div>

              {editForm.scheduled_date?.slice(0, 10) && (
                <div className="p-3 rounded-xl bg-reygas-dark/70 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Disponibilidad de Horarios — {formatPeruDate(editForm.scheduled_date.slice(0, 10))}</span>
                    </label>
                    <span className="text-[10px] text-gray-400 shrink-0">Capacidad {maxVehiclesPerSlot} veh./hora</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {WORKSHOP_HOURLY_SLOTS.map((slot) => {
                      const occ = getOccupancyForDate(editForm.scheduled_date.slice(0, 10), slot, editingApp.id);
                      const selected = editForm.scheduled_date.slice(11, 16) === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={occ.isFull}
                          onClick={() => setEditForm({ ...editForm, scheduled_date: `${editForm.scheduled_date.slice(0, 10)}T${slot}` })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${selected
                            ? "bg-blue-600 text-white border-blue-400 shadow-md"
                            : occ.isFull
                              ? "bg-red-950/50 text-red-400 border-red-500/30 opacity-60 cursor-not-allowed line-through"
                              : occ.totalOccupied > 0
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                            }`}
                          title={occ.isFull ? `Horario ocupado (${maxVehiclesPerSlot} vehículos)` : occ.totalOccupied > 0 ? `${occ.totalOccupied} cupo(s) ocupado(s) — queda(n) ${maxVehiclesPerSlot - occ.totalOccupied} libre(s)` : "Horario disponible"}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                    <label className="text-[10px] font-bold text-blue-300 shrink-0">⏰ Otra hora manual:</label>
                    <input
                      type="time"
                      value={manualSlotTime}
                      onChange={(e) => setManualSlotTime(e.target.value)}
                      className="px-2 py-1 bg-reygas-dark border border-blue-500/40 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={applyManualSlotToEdit}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all shadow"
                    >
                      ✓ Usar esta hora
                    </button>
                    {manualSlotTime && editForm.scheduled_date?.slice(0, 10) && (() => {
                      const mocc = getOccupancyForDate(editForm.scheduled_date.slice(0, 10), manualSlotTime, editingApp?.id);
                      return (
                        <span className={`text-[11px] font-bold ${mocc.isFull ? "text-red-400" : mocc.totalOccupied > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                          {mocc.isFull ? `🔴 Lleno (${mocc.totalOccupied}/${maxVehiclesPerSlot})` : mocc.totalOccupied > 0 ? `🟡 ${mocc.totalOccupied}/${maxVehiclesPerSlot} ocupados` : "🟢 Disponible"}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    🟢 Libre · 🟡 1 cupo ocupado · 🔴 Ocupado — Hora seleccionada: <strong className="text-blue-300 font-mono">{editForm.scheduled_date.slice(11, 16) || "-"}</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Observaciones / Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: capitalizeFirst(e.target.value) })}
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
                  onChange={(e) => setTransferForm({ ...transferForm, problem_description: capitalizeFirst(e.target.value) })}
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
                  onChange={(e) => setNewForm({ ...newForm, client_name: titleCase(e.target.value) })}
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
                    onChange={(e) => {
                      const plate = formatPlate(e.target.value);
                      setNewForm((prev) => ({ ...prev, plate }));
                      // Busca en la Tabla Registro del Taller y completa nombre + teléfono
                      void autofillPlateClient(plate, (name, phone) => {
                        setNewForm((prev) => {
                          if (prev.plate !== plate) return prev; // la placa cambió durante la búsqueda
                          return {
                            ...prev,
                            client_name: name || prev.client_name,
                            client_phone: phone || prev.client_phone,
                          };
                        });
                      });
                    }}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white uppercase focus:outline-none focus:border-reygas-red font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center justify-between">
                  <span>Tipo de Servicio</span>
                  <span className="text-[9px] text-gray-500 font-semibold">Catálogo de Servicios ({catalogServices.length})</span>
                </label>
                <select
                  value={newForm.service_type}
                  onChange={(e) => setNewForm({ ...newForm, service_type: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                >
                  {catalogServices.length > 0 ? (
                    catalogServices.map((srv) => (
                      <option key={srv.id} value={srv.name}>
                        {srv.name}{srv.price > 0 ? ` — S/ ${srv.price.toFixed(2)}` : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Conversión a GNV 5ta Gen">Conversión a GNV 5ta Gen</option>
                      <option value="Conversión a GLP 5ta Gen">Conversión a GLP 5ta Gen</option>
                      <option value="Mantenimiento Preventivo 15,000 km">Mantenimiento Preventivo 15,000 km</option>
                      <option value="Certificación Anual & Prueba Hidrostática">Certificación Anual & Prueba Hidrostática</option>
                      <option value="Diagnóstico de Inyección / Escáner ECU">Diagnóstico de Inyección / Escáner ECU</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Responsable de la Atención {attentionResponsibles.length > 0 ? "" : "(opcional)"}
                </label>
                {attentionResponsibles.length > 0 ? (
                  <select
                    value={newForm.responsible}
                    onChange={(e) => setNewForm({ ...newForm, responsible: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    <option value="">— Sin asignar —</option>
                    {attentionResponsibles.map((t) => (
                      <option key={t.id} value={t.full_name}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: Kelly, Cristhel"
                    value={newForm.responsible}
                    onChange={(e) => setNewForm({ ...newForm, responsible: capitalizeFirst(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                )}
                {attentionResponsibles.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Solo personal con permiso "Responsable de Atención" en Tabla Maestra.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fecha de la Cita *
                </label>
                <MiniDatePicker
                  value={newForm.scheduled_date.slice(0, 10)}
                  onChange={(d) => {
                    const curTime = newForm.scheduled_date.includes("T") ? newForm.scheduled_date.slice(11, 16) : "08:00";
                    setNewForm({ ...newForm, scheduled_date: d ? d + "T" + curTime : "" });
                  }}
                />
              </div>

              {newForm.scheduled_date.slice(0, 10) && (
                <div className="p-3 rounded-xl bg-reygas-dark/70 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Disponibilidad de Horarios — {formatPeruDate(newForm.scheduled_date.slice(0, 10))}</span>
                    </label>
                    <span className="text-[10px] text-gray-400 shrink-0">Capacidad {maxVehiclesPerSlot} veh./hora</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {WORKSHOP_HOURLY_SLOTS.map((slot) => {
                      const occ = getOccupancyForDate(newForm.scheduled_date.slice(0, 10), slot);
                      const selected = newForm.scheduled_date.slice(11, 16) === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={occ.isFull}
                          onClick={() => setNewForm({ ...newForm, scheduled_date: `${newForm.scheduled_date.slice(0, 10)}T${slot}` })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${selected
                            ? "bg-blue-600 text-white border-blue-400 shadow-md"
                            : occ.isFull
                              ? "bg-red-950/50 text-red-400 border-red-500/30 opacity-60 cursor-not-allowed line-through"
                              : occ.totalOccupied > 0
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                            }`}
                          title={occ.isFull ? `Horario ocupado (${maxVehiclesPerSlot} vehículos)` : occ.totalOccupied > 0 ? `${occ.totalOccupied} cupo(s) ocupado(s) — queda(n) ${maxVehiclesPerSlot - occ.totalOccupied} libre(s)` : "Horario disponible"}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                    <label className="text-[10px] font-bold text-blue-300 shrink-0">⏰ Otra hora manual:</label>
                    <input
                      type="time"
                      value={manualSlotTime}
                      onChange={(e) => setManualSlotTime(e.target.value)}
                      className="px-2 py-1 bg-reygas-dark border border-blue-500/40 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={applyManualSlotToNew}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all shadow"
                    >
                      ✓ Usar esta hora
                    </button>
                    {manualSlotTime && (() => {
                      const mocc = getOccupancyForDate(newForm.scheduled_date.slice(0, 10), manualSlotTime);
                      return (
                        <span className={`text-[11px] font-bold ${mocc.isFull ? "text-red-400" : mocc.totalOccupied > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                          {mocc.isFull ? `🔴 Lleno (${mocc.totalOccupied}/${maxVehiclesPerSlot})` : mocc.totalOccupied > 0 ? `🟡 ${mocc.totalOccupied}/${maxVehiclesPerSlot} ocupados` : "🟢 Disponible"}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    🟢 Libre · 🟡 Parcial · 🔴 Ocupado ({maxVehiclesPerSlot} veh./hora) — Hora seleccionada: <strong className="text-blue-300 font-mono">{newForm.scheduled_date.slice(11, 16) || "-"}</strong>
                  </p>
                </div>
              )}

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

      {/* MODAL: IMPORTAR TABLA DE PROGRAMACIÓN (CSV SEMANAL) */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-emerald-500/40 space-y-4 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setCsvModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>Importar Tabla de Programación (CSV)</span>
              </h3>
              <p className="text-xs text-gray-400">
                Formato: <code className="text-emerald-300 font-mono text-[10px]">Placa;Fecha;Hora;Servicio;Responsable;Observaciones</code>. Las filas se agregan como citas y se consultan/filtran por N° de placa.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadWeekCsv}
                disabled={csvImporting}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
              >
                {csvImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                <span>Cargar Programación de la Semana</span>
              </button>
              <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Seleccionar archivo .csv</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Pegar contenido del CSV (opcional):</label>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => handlePreviewCsv(e.target.value)}
                placeholder={"Placa;Fecha;Hora;Servicio;Responsable;Observaciones\nB5Q-306;18/08/2026;8:30 a.m.;Mantenimiento general + filtro de gas;Kelly;—"}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-400 resize-y"
              />
            </div>

            {csvPreview.length > 0 && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2">
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{csvPreview.length} cita(s) listas para importar</span>
                </p>
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10 text-left">
                        <th className="py-1 pr-2">Placa</th>
                        <th className="py-1 pr-2">Fecha / Hora</th>
                        <th className="py-1 pr-2">Servicio</th>
                        <th className="py-1">Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-white/5 text-white">
                          <td className="py-1 pr-2 font-mono font-bold text-emerald-300">{row.plate}</td>
                          <td className="py-1 pr-2">{formatPeruDateTime(row.scheduled_date)}</td>
                          <td className="py-1 pr-2">{row.service_type}</td>
                          <td className="py-1">{row.responsible || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 20 && <p className="text-[10px] text-gray-500 mt-1">...y {csvPreview.length - 20} más</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setCsvModalOpen(false)} className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs">Cancelar</button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={csvPreview.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-105"
              >
                <Check className="w-4 h-4" />
                <span>Importar {csvPreview.length > 0 ? `${csvPreview.length} cita(s)` : ""}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INFORME DIARIO DE CITAS / PROGRAMACIÓN (imprimible) */}
      {dailyReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-2xl border border-amber-500/40 space-y-5 relative shadow-2xl max-h-[92vh] overflow-y-auto">
            <button onClick={() => setDailyReportOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-400" />
                <span>Informe Diario de Citas / Programación</span>
              </h3>
              <p className="text-xs text-gray-400">Programación de citas del día, consultable por fecha e imprimible.</p>
            </div>

            {/* Selector de fecha */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-reygas-dark rounded-xl border border-white/10">
              <button type="button" onClick={() => changeReportDate(-1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"><ChevronLeft className="w-4 h-4" /></button>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-sm text-white focus:border-amber-400 font-mono"
              />
              <button type="button" onClick={() => changeReportDate(1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"><ChevronRight className="w-4 h-4" /></button>
              <button type="button" onClick={() => setReportDate(getPeruDateString())} className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">Hoy</button>
            </div>

            {/* Cards resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 rounded-xl bg-reygas-surface border border-white/10 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Total</p>
                <p className="text-xl font-black text-white">{dailyCounts.total}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                <p className="text-[10px] text-amber-300 font-bold uppercase">Pendientes</p>
                <p className="text-xl font-black text-amber-300">{dailyCounts.pendientes}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="text-[10px] text-emerald-300 font-bold uppercase">Confirmadas</p>
                <p className="text-xl font-black text-emerald-300">{dailyCounts.confirmadas}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                <p className="text-[10px] text-blue-300 font-bold uppercase">Completadas</p>
                <p className="text-xl font-black text-blue-300">{dailyCounts.completadas}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                <p className="text-[10px] text-red-300 font-bold uppercase">Canceladas</p>
                <p className="text-xl font-black text-red-300">{dailyCounts.canceladas}</p>
              </div>
            </div>

            {/* Narrativa ejecutiva */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-300 leading-relaxed">
              <strong className="text-amber-300">📋 Resumen del día {formatPeruDate(reportDate)}:</strong> 
              {dailyCounts.total === 0 ? "No se registraron citas programadas para esta fecha." : `Se registraron ${dailyCounts.total} cita(s) programada(s) en total: ${dailyCounts.pendientes} pendiente(s), ${dailyCounts.confirmadas} confirmada(s), ${dailyCounts.completadas} completada(s) y ${dailyCounts.canceladas} cancelada(s).`}
            </div>

            {/* Tabla del día */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-reygas-surface text-gray-300 text-left">
                    <th className="px-3 py-2 font-bold">Hora</th>
                    <th className="px-3 py-2 font-bold">Placa</th>
                    <th className="px-3 py-2 font-bold">Servicio</th>
                    <th className="px-3 py-2 font-bold">Responsable</th>
                    <th className="px-3 py-2 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyAppointments.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Sin citas para esta fecha.</td></tr>
                  ) : dailyAppointments.map((app) => (
                    <tr key={app.id} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono text-amber-300 font-bold">{formatPeruDateTime(app.scheduled_date).split(" ").slice(1).join(" ")}</td>
                      <td className="px-3 py-2 font-mono font-bold text-white">{app.plate}</td>
                      <td className="px-3 py-2 text-gray-300">{app.service_type}</td>
                      <td className="px-3 py-2 text-gray-300">{app.responsible || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${app.status === "confirmado" ? "bg-emerald-500/20 text-emerald-400" : app.status === "completado" ? "bg-blue-500/20 text-blue-400" : app.status === "cancelado" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                          {app.status === "pendiente" ? "Pendiente" : app.status === "confirmado" ? "Confirmada" : app.status === "completado" ? "Completada" : "Cancelada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button type="button" onClick={() => setDailyReportOpen(false)} className="px-4 py-2.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-xl border border-white/10">Cerrar</button>
              <button type="button" onClick={handlePrintDailyReport} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-transform hover:scale-105">
                <Printer className="w-4 h-4" />
                <span>Imprimir Informe Diario</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido imprimible del Informe Diario (portal a <body> — reygas-print-container) */}
      {dailyReportOpen && typeof document !== "undefined" && ReactDOM.createPortal(
        <div id="appointments-daily-print" className="reygas-print-container" style={{ display: "none", visibility: "hidden", position: "fixed", left: "-9999px", top: 0 }}>
          <div className="reygas-print-page" style={{ background: "#ffffff", color: "#000" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>REYGAS S.A.C.</div>
              <div style={{ fontSize: 11 }}>AV. SAN MARTIN NRO. 279 LIMA - HUAURA - SANTA MARIA — RUC: 20600982860</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>INFORME DIARIO DE CITAS / PROGRAMACIÓN</div>
              <div style={{ fontSize: 12 }}>Fecha: {formatPeruDate(reportDate)}</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left", padding: 4 }}>Hora</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Placa</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Servicio</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Responsable</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {dailyAppointments.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 8, textAlign: "center" }}>Sin citas para esta fecha.</td></tr>
                ) : dailyAppointments.map((app) => (
                  <tr key={app.id} style={{ borderBottom: "1px solid #ccc" }}>
                    <td style={{ padding: 4 }}>{formatPeruDateTime(app.scheduled_date).split(" ").slice(1).join(" ")}</td>
                    <td style={{ padding: 4, fontWeight: 700 }}>{app.plate}</td>
                    <td style={{ padding: 4 }}>{app.service_type}</td>
                    <td style={{ padding: 4 }}>{app.responsible || "-"}</td>
                    <td style={{ padding: 4 }}>{app.status === "pendiente" ? "Pendiente" : app.status === "confirmado" ? "Confirmada" : app.status === "completado" ? "Completada" : "Cancelada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 11 }}>
              <b>Total: {dailyCounts.total} cita(s)</b> — Pendientes: {dailyCounts.pendientes} | Confirmadas: {dailyCounts.confirmadas} | Completadas: {dailyCounts.completadas} | Canceladas: {dailyCounts.canceladas}
            </div>
            <div style={{ marginTop: 14, fontSize: 10, borderTop: "1px solid #000", paddingTop: 6 }}>
              Generado el {formatPeruDateTime(new Date())} — ReyGas Autogás Equipment
            </div>
          </div>
        </div>,
        document.body
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

            {/* Navegador de Fecha Universal (estándar ReyGas) */}
            <div className="flex items-center gap-3 p-3 bg-reygas-dark rounded-xl border border-white/10 flex-wrap">
              <DateNavigator
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
                        {isFull ? `🔴 Ocupado (${occupancy.totalOccupied}/${maxVehiclesPerSlot})` : occupancy.totalOccupied > 0 ? `🟡 ${occupancy.totalOccupied}/${maxVehiclesPerSlot} Ocupados` : "🟢 Disponible"}
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

            {/* Hora manual: consultar o asignar un horario libre escrito a mano */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-reygas-dark rounded-xl border border-white/10">
              <label className="text-xs font-bold text-blue-300 shrink-0">⏰ Otra hora manual:</label>
              <input
                type="time"
                value={manualSlotTime}
                onChange={(e) => setManualSlotTime(e.target.value)}
                className="px-2 py-1.5 bg-reygas-surface border border-blue-500/40 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={applyManualSlotToAvailability}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all shadow"
              >
                {targetAppointmentForSlot ? "✓ Asignar esta hora" : "Ver esta hora"}
              </button>
              {manualSlotTime && (() => {
                const mocc = getOccupancyForDate(availabilityDate, manualSlotTime);
                return (
                  <span className={`text-[11px] font-bold ${mocc.isFull ? "text-red-400" : mocc.totalOccupied > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                    {mocc.isFull ? `🔴 Lleno (${mocc.totalOccupied}/${maxVehiclesPerSlot})` : mocc.totalOccupied > 0 ? `🟡 ${mocc.totalOccupied}/${maxVehiclesPerSlot} ocupados` : "🟢 Disponible"}
                  </span>
                );
              })()}
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
