"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAppStore, Appointment, WorkOrder } from "@/lib/store/app-store";
import { parseCSVRows, parseWorkshopRow } from "@/lib/csv-parser";
import { compressImageFile } from "@/lib/image-compressor";
import { supabase } from "@/lib/supabase/client";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import {
  ShieldAlert,
  Car,
  Camera,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Fuel,
  User,
  Phone,
  Plus,
  Calendar,
  Upload,
  Sparkles,
  AlertCircle,
  Check,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Filter,
  Gauge,
  HelpCircle,
  Trash2
} from "lucide-react";
import { formatPeruDateTime, getPeruDateString, formatPeruDate, buildPeruISOString } from "@/lib/utils/date-utils";

export default function PorteriaPage() {
  const {
    vehicles,
    workOrders,
    invoices,
    registerVehicle,
    createWorkOrder,
    updateWorkOrderStatus,
    appointments,
    updateAppointmentStatus,
    updateAppointment,
    deleteAppointment,
    aiSettings,
  } = useAppStore();

  const hasApiKey = Boolean(aiSettings?.apiKey && aiSettings.apiKey.trim().length > 0);

  // Universal Date Filter (Peru Timezone)
  const [selectedDate, setSelectedDate] = useState<string>(getPeruDateString());
  const [dateFilterMode, setDateFilterMode] = useState<"dia" | "todos">("dia");

  // Search & Camera/OCR
  const [searchPlate, setSearchPlate] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);

  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Status notification message
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "info" | "warning"; text: string } | null>(null);

  const getCurrentPeruTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Form for vehicle entry
  const [entryDate, setEntryDate] = useState<string>(selectedDate);
  const [entryTime, setEntryTime] = useState<string>(getCurrentPeruTime());
  const [entryForm, setEntryForm] = useState({
    plate: "",
    brand: "",
    model: "",
    year: 2023,
    color: "",
    fuel_type: "GNV" as "GNV" | "GLP" | "Gasolina" | "Bifuel",
    owner_name: "",
    owner_phone: "",
    current_mileage: 0,
    problem_description: "Ingreso para mantenimiento general y revisión",
  });

  // Keep entryDate in sync when selectedDate changes and update time
  useEffect(() => {
    setEntryDate(selectedDate);
    setEntryTime(getCurrentPeruTime());
  }, [selectedDate]);

  // Modals for appointment management
  const [rescheduleModal, setRescheduleModal] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

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

  const showAlert = (type: "success" | "info" | "warning", text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // Date Navigator Helpers
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(getPeruDateString(d));
  };

  const isToday = selectedDate === getPeruDateString();

  /**
   * Helper function: Multi-source search in Database
   */
  const lookupVehicleInDatabase = async (plateToSearch: string) => {
    const clean = plateToSearch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean || clean.length < 3) return null;

    // 1. Search in local vehicles array
    const matchedVeh = vehicles.find(
      (v) => v.plate && v.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean
    );
    if (matchedVeh && (matchedVeh.brand || matchedVeh.owner_name)) {
      return {
        plate: matchedVeh.plate,
        brand: matchedVeh.brand || "",
        model: matchedVeh.model || "",
        year: matchedVeh.year || 2023,
        color: matchedVeh.color || "",
        fuel_type: matchedVeh.fuel_type || "GNV",
        owner_name: matchedVeh.owner_name || "",
        owner_phone: matchedVeh.owner_phone || "",
        current_mileage: matchedVeh.current_mileage || 0,
      };
    }

    // 2. Search in local workOrders, invoices, appointments
    const matchedOrder = workOrders.find(
      (wo) => wo.vehicle_plate && wo.vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean
    );
    const matchedInv = invoices.find(
      (inv) => inv.vehicle_plate && inv.vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean
    );
    const matchedApp = appointments.find(
      (app) => app.plate && app.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean
    );

    if (matchedOrder || matchedInv || matchedApp) {
      return {
        plate: plateToSearch.toUpperCase(),
        brand: matchedVeh?.brand || "Toyota",
        model: matchedVeh?.model || "Importado",
        year: matchedVeh?.year || 2023,
        color: matchedVeh?.color || "Plata",
        fuel_type: (matchedVeh?.fuel_type as any) || "GNV",
        owner_name: matchedVeh?.owner_name || matchedInv?.client_name || matchedApp?.client_name || "Cliente Registrado",
        owner_phone: matchedVeh?.owner_phone || matchedApp?.client_phone || "+51 900000000",
        current_mileage: matchedVeh?.current_mileage || 0,
      };
    }

    // 3. Fallback: Search directly in Supabase database in real-time
    try {
      const { data: remoteVehicles } = await supabase
        .from("vehicles")
        .select("*")
        .ilike("plate", `%${clean}%`)
        .limit(1);

      if (remoteVehicles && remoteVehicles.length > 0) {
        const rv = remoteVehicles[0];
        return {
          plate: rv.plate,
          brand: rv.brand || "",
          model: rv.model || "",
          year: rv.year || 2023,
          color: rv.color || "",
          fuel_type: rv.fuel_type || "GNV",
          owner_name: rv.owner_name || "",
          owner_phone: rv.owner_phone || "",
          current_mileage: rv.current_mileage || 0,
        };
      }
    } catch (e) {
      console.warn("Supabase vehicle search error:", e);
    }

    return null;
  };

  /**
   * Handle Plate Input Changes & Auto-complete
   */
  const handlePlateChange = async (plateInput: string) => {
    const formatted = plateInput.toUpperCase();
    setEntryForm((prev) => ({ ...prev, plate: formatted }));

    if (formatted.length >= 5) {
      const found = await lookupVehicleInDatabase(formatted);
      if (found) {
        setEntryForm((prev) => ({
          ...prev,
          plate: found.plate,
          brand: found.brand || prev.brand,
          model: found.model || prev.model,
          year: found.year || prev.year,
          color: found.color || prev.color,
          fuel_type: (found.fuel_type as any) || prev.fuel_type,
          owner_name: found.owner_name || prev.owner_name,
          owner_phone: found.owner_phone || prev.owner_phone,
          current_mileage: found.current_mileage || prev.current_mileage,
        }));
        showAlert("info", `Vehículo ${found.plate} reconocido automáticamente en la base de datos.`);
      }
    }
  };

  /**
   * Process Image OCR from file upload or camera
   */
  const processImageFile = async (file: File) => {
    if (!hasApiKey) {
      showAlert("warning", "Se requiere configurar una API Key en Configuración de IA para utilizar el reconocimiento OCR.");
      return;
    }

    try {
      setOcrLoading(true);
      const compressedBase64 = await compressImageFile(file, 1024, 0.7);

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: compressedBase64,
          apiKey: aiSettings?.apiKey || "",
          provider: aiSettings?.provider || "openai",
          model: aiSettings?.model || "gpt-4o",
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servicio OCR");
      }

      const data = await response.json();

      if (data.plate) {
        const detectedPlate = data.plate.toUpperCase();
        showAlert("success", `Placa detectada: ${detectedPlate} (Confianza: ${Math.round((data.confidence || 0.9) * 100)}%)`);

        // Check if vehicle exists
        const existingData = await lookupVehicleInDatabase(detectedPlate);

        setEntryForm({
          plate: detectedPlate,
          brand: existingData?.brand || data.brand || "",
          model: existingData?.model || data.model || "",
          year: existingData?.year || data.year || 2023,
          color: existingData?.color || data.color || "",
          fuel_type: (existingData?.fuel_type as any) || (data.fuel_type as any) || "GNV",
          owner_name: existingData?.owner_name || data.owner_name || "",
          owner_phone: existingData?.owner_phone || data.owner_phone || "",
          current_mileage: existingData?.current_mileage || 0,
          problem_description: "Ingreso verificado por reconocimiento de Garita OCR",
        });
      } else {
        showAlert("warning", "No se detectó una placa clara en la imagen. Ingrese los datos manualmente.");
      }
    } catch (error: any) {
      showAlert("warning", `Error al procesar la imagen: ${error?.message || "Intente nuevamente."}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = "";
  };

  /**
   * Import Vehicles CSV handler
   */
  const handleImportVehiclesCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rawRows = parseCSVRows(text);
      if (rawRows.length <= 1) {
        showAlert("warning", "El archivo CSV no contiene registros válidos.");
        return;
      }

      let count = 0;
      for (let r = 1; r < rawRows.length; r++) {
        const cols = rawRows[r];
        if (!cols || cols.length === 0) continue;

        const parsed = parseWorkshopRow(cols);
        const plate = (parsed ? parsed.plate : cols[7] || cols[0] || "").toUpperCase().trim();
        if (!plate || plate.length < 3) continue;

        const entryDateTime = parsed?.dateISO || new Date().toISOString();

        registerVehicle({
          plate,
          brand: parsed?.brand || "Toyota",
          model: "Genérico",
          year: 2023,
          color: "Plata",
          fuel_type: (parsed?.fuelType || "GNV") as any,
          owner_name: parsed?.clientName || "Cliente Taller",
          owner_phone: parsed?.clientPhone || "+51 987654321",
          current_mileage: parsed?.mileage || 0,
          last_visit_date: entryDateTime,
        });

        createWorkOrder({
          vehicle_plate: plate,
          status: "ingresado",
          problem_description: parsed?.maintenanceService || "Ingreso por migración CSV",
          entry_time: entryDateTime,
        });

        count++;
      }

      showAlert("success", `¡Se importaron y registraron ${count} ingresos de vehículos en Portería!`);
    } catch (err: any) {
      showAlert("warning", `Error al importar CSV: ${err.message || "Formato no válido"}`);
    }
    e.target.value = "";
  };

  /**
   * Submit Vehicle Entry Form & Open Work Order
   */
  const handleRegisterEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const plate = entryForm.plate.toUpperCase().trim();
    if (!plate) {
      showAlert("warning", "Ingrese una placa válida.");
      return;
    }

    // Build ISO timestamp from chosen date and time in Peru timezone
    const finalTime = entryTime || getCurrentPeruTime();
    const chosenDateTimeISO = buildPeruISOString(entryDate || selectedDate, finalTime);

    // 1. Register or update vehicle
    registerVehicle({
      plate,
      brand: entryForm.brand || "Automóvil",
      model: entryForm.model || "Genérico",
      year: Number(entryForm.year) || 2023,
      color: entryForm.color || "Plata",
      fuel_type: entryForm.fuel_type,
      owner_name: entryForm.owner_name || "Cliente Taller",
      owner_phone: entryForm.owner_phone || "+51 987654321",
      current_mileage: Number(entryForm.current_mileage) || 0,
      last_visit_date: chosenDateTimeISO,
    });

    // 2. Create work order for workshop with specific entry_time
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: entryForm.problem_description || "Ingreso para mantenimiento general y revisión",
      entry_time: chosenDateTimeISO,
    });

    showAlert("success", `¡Ingreso del vehículo ${plate} registrado a las ${finalTime} para el ${formatPeruDate(entryDate || selectedDate)} y enviado a Taller!`);

    // Reset form
    setEntryTime(getCurrentPeruTime());
    setEntryForm({
      plate: "",
      brand: "",
      model: "",
      year: 2023,
      color: "",
      fuel_type: "GNV",
      owner_name: "",
      owner_phone: "",
      current_mileage: 0,
      problem_description: "Ingreso para mantenimiento general y revisión",
    });
  };

  /**
   * Appointment Attendance Confirmation
   */
  const handleConfirmAttendance = (app: Appointment) => {
    const plate = app.plate.toUpperCase();
    const nowISO = `${selectedDate}T08:30:00.000Z`;

    // 1. Ensure vehicle is registered
    const existingVehicle = vehicles.find((v) => v.plate === plate);
    if (!existingVehicle) {
      registerVehicle({
        plate,
        brand: "Automóvil",
        model: "Genérico",
        year: new Date().getFullYear(),
        color: "Plateado",
        fuel_type: "GNV",
        owner_name: app.client_name,
        owner_phone: app.client_phone,
        current_mileage: 0,
        last_visit_date: nowISO,
      });
    }

    // 2. Create work order
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: `${app.service_type} - Cita confirmada en Portería. ${app.notes || ""}`,
      entry_time: nowISO,
    });

    // 3. Update appointment status
    updateAppointmentStatus(app.id, "confirmado");

    showAlert(
      "success",
      `¡Asistencia Confirmada! El vehículo ${plate} ingresó a Taller para la fecha ${formatPeruDate(selectedDate)}.`
    );
  };

  const handleOpenReschedule = (app: Appointment) => {
    setRescheduleModal(app);
    setRescheduleDate(app.scheduled_date.slice(0, 16));
  };

  const handleSaveReschedule = () => {
    if (!rescheduleModal) return;
    updateAppointment(rescheduleModal.id, {
      scheduled_date: new Date(rescheduleDate).toISOString(),
    });
    const formattedDate = formatPeruDateTime(rescheduleDate, false);
    showAlert("info", `Cita de ${rescheduleModal.plate} reprogramada para ${formattedDate}.`);
    setRescheduleModal(null);
  };

  // Trigger styled confirmation modal for cancelling appointment
  const handleCancelAppointmentPrompt = (app: Appointment) => {
    setConfirmModal({
      isOpen: true,
      title: "Anular Cita Programada",
      message: `¿Está seguro de anular la cita del vehículo ${app.plate} (${app.client_name})? Esta acción actualizará el estado de la reserva en el sistema.`,
      confirmLabel: "Sí, Anular Cita",
      cancelLabel: "Volver",
      danger: true,
      onConfirm: () => {
        updateAppointmentStatus(app.id, "cancelado");
        showAlert("warning", `Cita de ${app.plate} ha sido anulada.`);
      },
    });
  };

  // Trigger styled confirmation modal for registering vehicle exit
  const handleRegisterExitPrompt = (wo: WorkOrder) => {
    setConfirmModal({
      isOpen: true,
      title: "Registrar Salida de Garita",
      message: `El vehículo ${wo.vehicle_plate} se encuentra autorizado (Semáforo Verde). ¿Desea confirmar la salida del taller y finalizar la orden?`,
      confirmLabel: "Confirmar Salida",
      cancelLabel: "Cancelar",
      danger: false,
      onConfirm: () => {
        updateWorkOrderStatus(wo.id, "finalizado");
        showAlert("success", `Salida del vehículo ${wo.vehicle_plate} registrada correctamente.`);
      },
    });
  };

  // Filtered Appointments (Active/Pending)
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      if (app.status === "cancelado" || app.status === "completado" || app.status === "confirmado") {
        return false;
      }
      if (dateFilterMode === "dia") {
        const appDate = (app.scheduled_date || "").slice(0, 10);
        return appDate === selectedDate;
      }
      return true;
    });
  }, [appointments, dateFilterMode, selectedDate]);

  // Filtered Work Orders for Gate Traffic
  const filteredWorkOrders = useMemo(() => {
    return workOrders
      .filter((wo) => {
        const matchPlate = searchPlate ? wo.vehicle_plate.includes(searchPlate) : true;
        if (!matchPlate) return false;

        if (dateFilterMode === "dia") {
          const woDate = (wo.entry_time || (wo as any).created_at || "").slice(0, 10);
          return woDate === selectedDate;
        }
        return true;
      })
      .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());
  }, [workOrders, searchPlate, dateFilterMode, selectedDate]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30 shadow-lg shadow-red-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Estación de Portería & Garita
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                {formatPeruDate(selectedDate)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Escaneo OCR Inteligente de Placas por IA, Control de Citas Programadas y Semáforo de Salida en tiempo real.
            </p>
          </div>
        </div>

        {/* Date Navigator & OCR Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Universal Date Navigator */}
          <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-2xl border border-white/15 shadow-inner">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
              title="Día Anterior (-1 Día)"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Día Anterior</span>
            </button>

            <MiniDatePicker
              value={selectedDate}
              onChange={(newDate) => setSelectedDate(newDate)}
            />

            <button
              type="button"
              onClick={() => changeDate(1)}
              className="px-3 py-2 bg-reygas-surface hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1 transition-all shrink-0 active:scale-95 shadow-md"
              title="Día Siguiente (+1 Día)"
            >
              <span className="hidden sm:inline">Día Siguiente</span>
              <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(getPeruDateString())}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-transform active:scale-95 ${
                isToday
                  ? "bg-white/10 text-gray-400 border border-white/10"
                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 hover:scale-105"
              }`}
            >
              Hoy
            </button>
          </div>

          {/* Import CSV */}
          <label className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all shrink-0 active:scale-95">
            <Upload className="w-4 h-4 text-white shrink-0" />
            <span>Cargar CSV Ingresos</span>
            <input type="file" accept=".csv, .txt, .xlsx, .xls" onChange={handleImportVehiclesCSV} className="hidden" />
          </label>

          {/* Photo Upload for OCR */}
          {hasApiKey ? (
            <label className="px-3.5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-extrabold rounded-xl border border-white/10 flex items-center gap-2 cursor-pointer transition-colors shrink-0 active:scale-95">
              <Upload className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Subir Foto Placa</span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : null}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              if (hasApiKey) cameraInputRef.current?.click();
              else showAlert("warning", "Configure una API Key en Configuración de IA para habilitar escaneo con cámara.");
            }}
            disabled={ocrLoading}
            className={`px-3.5 py-2.5 text-xs font-extrabold rounded-xl border flex items-center gap-2 transition-all shrink-0 active:scale-95 ${
              !hasApiKey
                ? "bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white"
                : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-red-500/30 shadow-lg shadow-red-600/25"
            }`}
          >
            <Camera className={`w-4 h-4 shrink-0 ${ocrLoading ? "animate-spin" : ""}`} />
            <span>{ocrLoading ? "Escaneando con IA..." : "Tomar Foto / Escanear IA"}</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm shadow-xl animate-fadeIn ${
            alertMessage.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
              : alertMessage.type === "warning"
              ? "bg-amber-950/50 border-amber-500/40 text-amber-300"
              : "bg-blue-950/50 border-blue-500/40 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{alertMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Form + Appointments & Semaphore */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Entry Registration Form (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Registrar Ingreso de Vehículo</h2>
                <p className="text-[11px] text-gray-400">Apertura inmediata de orden de trabajo en Taller.</p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-mono font-bold">
              Búsqueda Automática
            </span>
          </div>

          <form onSubmit={handleRegisterEntry} className="space-y-4">
            
            {/* Entry Date & Time selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-black/40 border border-white/10">
              <div>
                <label className="block text-[11px] font-extrabold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Fecha de Ingreso *</span>
                </label>
                <MiniDatePicker
                  value={entryDate}
                  onChange={setEntryDate}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Hora de Ingreso *</span>
                </label>
                <input
                  type="time"
                  required
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white font-mono font-bold focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Plate & Fuel Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Placa Vehículo *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={entryForm.plate}
                    onChange={(e) => handlePlateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-sm text-white font-mono font-black uppercase focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none pr-8 transition-all"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Tipo Combustible
                </label>
                <select
                  value={entryForm.fuel_type}
                  onChange={(e) => setEntryForm({ ...entryForm, fuel_type: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-sm text-white font-bold focus:border-red-400 focus:outline-none"
                >
                  <option value="GNV">GNV</option>
                  <option value="GLP">GLP</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Bifuel">Bifuel</option>
                </select>
              </div>
            </div>

            {/* Brand, Model, Color */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Marca</label>
                <input
                  type="text"
                  placeholder="Toyota"
                  value={entryForm.brand}
                  onChange={(e) => setEntryForm({ ...entryForm, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Modelo</label>
                <input
                  type="text"
                  placeholder="Yaris"
                  value={entryForm.model}
                  onChange={(e) => setEntryForm({ ...entryForm, model: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Color</label>
                <input
                  type="text"
                  placeholder="Plata"
                  value={entryForm.color}
                  onChange={(e) => setEntryForm({ ...entryForm, color: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Owner, Phone, Mileage */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Propietario / Conductor
                </label>
                <input
                  type="text"
                  placeholder="Nombre Cliente"
                  value={entryForm.owner_name}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  placeholder="+51 987654321"
                  value={entryForm.owner_phone}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Kilometraje (km)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={entryForm.current_mileage || ""}
                  onChange={(e) => setEntryForm({ ...entryForm, current_mileage: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white font-mono focus:border-amber-400 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Reason for entry */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                Motivo de Ingreso / Falla Reportada *
              </label>
              <textarea
                rows={3}
                required
                value={entryForm.problem_description}
                onChange={(e) => setEntryForm({ ...entryForm, problem_description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-red-400 focus:outline-none transition-colors leading-relaxed font-medium"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black rounded-2xl text-sm transition-transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-xl shadow-red-600/30"
            >
              <Plus className="w-5 h-5" />
              <span>Registrar Ingreso y Abrir OT</span>
            </button>
          </form>
        </div>

        {/* Scheduled Appointments & Exit Semaphore (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Citas & Reservas Programadas */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Citas & Reservas Programadas</h2>
                  <p className="text-[11px] text-gray-400">Confirmación de llegada de clientes agendados.</p>
                </div>
              </div>

              {/* Filter mode toggle */}
              <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDateFilterMode("dia")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dateFilterMode === "dia"
                      ? "bg-amber-500 text-black font-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Del Día ({filteredAppointments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode("todos")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dateFilterMode === "todos"
                      ? "bg-amber-500 text-black font-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Todas las Pendientes
                </button>
              </div>
            </div>

            {/* Appointments List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredAppointments.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs italic bg-black/20 rounded-2xl border border-dashed border-white/10">
                  No hay citas agendadas pendientes para {dateFilterMode === "dia" ? formatPeruDate(selectedDate) : "la fecha actual"}.
                </div>
              ) : (
                filteredAppointments.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-base text-cyan-300 bg-cyan-950/40 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                          {app.plate}
                        </span>
                        <span className="text-xs font-bold text-white">{app.client_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          CONFIRMADO
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 font-medium">
                        {app.service_type} • <span className="text-amber-300 font-mono">{formatPeruDateTime(app.scheduled_date, false)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmAttendance(app)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar Asistencia</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReschedule(app)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                        title="Reprogramar Cita"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelAppointmentPrompt(app)}
                        className="p-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-xl border border-red-500/20 transition-colors"
                        title="Anular Cita"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Exit Semaphore & Active Gate Traffic */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Semáforo de Salida e Inspección de Garita</h2>
                  <p className="text-[11px] text-gray-400">Control de pagos y autorización de salida del taller.</p>
                </div>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por placa..."
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white uppercase font-mono font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* List of Active Vehicles */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredWorkOrders.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs italic bg-black/20 rounded-2xl border border-dashed border-white/10">
                  No hay vehículos registrados para {formatPeruDate(selectedDate)}.
                </div>
              ) : (
                filteredWorkOrders.map((wo) => {
                  const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                  const isPaidAndAuthorized = wo.status === "pagado_autorizado" || wo.status === "finalizado";

                  return (
                    <div
                      key={wo.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPaidAndAuthorized
                          ? "bg-emerald-950/25 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                          : "bg-black/40 border-white/10"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono font-black text-lg text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/15">
                              {wo.vehicle_plate}
                            </span>
                            <span className="text-xs font-bold text-gray-200">
                              {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehículo"}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                              {vehicle?.fuel_type || "GNV"}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              Hora: {wo.entry_time ? wo.entry_time.slice(11, 16) : "--:--"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 line-clamp-1 font-medium">
                            <span className="text-gray-400 font-semibold">Reporte:</span> {wo.problem_description}
                          </p>
                        </div>

                        {/* Semaphore Status Badge & Action */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {isPaidAndAuthorized ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black animate-pulse">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>🟢 VERDE (AUTORIZADO)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black">
                              <XCircle className="w-4 h-4" />
                              <span>🔴 ROJO (PENDIENTE)</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Estado: {wo.status.replace("_", " ")}
                            </span>
                            {isPaidAndAuthorized && wo.status !== "finalizado" && (
                              <button
                                type="button"
                                onClick={() => handleRegisterExitPrompt(wo)}
                                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-md shadow-emerald-600/30"
                              >
                                Registrar Salida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* DARK GLASSMORPHIC REPROGRAMAR CITA MODAL */}
      {/* ========================================================================= */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-black/90 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Reprogramar Cita</h3>
                  <p className="text-xs text-gray-400">Placa: {rescheduleModal.plate} - {rescheduleModal.client_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Nueva Fecha y Hora Programada *
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-all font-mono font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRescheduleModal(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Guardar Reprogramación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DARK GLASSMORPHIC CONFIRMATION MODAL (REPLACES NATIVE BROWSER CONFIRM) */}
      {/* ========================================================================= */}
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
                  <p className="text-xs text-gray-400">Confirmación de Operación en Garita</p>
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
                className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  confirmModal.danger
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
