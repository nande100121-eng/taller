"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAppStore, Appointment, WorkOrder } from "@/lib/store/app-store";
import { parseCSVRows, parseWorkshopRow } from "@/lib/csv-parser";
import { compressImageFile } from "@/lib/image-compressor";
import { supabase } from "@/lib/supabase/client";
import { formatPlate, titleCase, capitalizeFirst } from "@/lib/utils/text-format";
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
  Trash2,
  ShoppingBag,
  Package,
  Info,
  History,
  FileText,
  Wrench,
  ShieldCheck,
  DollarSign,
  Loader2,
  Receipt,
} from "lucide-react";
import { formatPeruDateTime, getPeruDateString, formatPeruDate, buildPeruISOString } from "@/lib/utils/date-utils";

export default function PorteriaPage() {
  const {
    vehicles,
    workOrders,
    invoices,
    technicians,
    registerVehicle,
    createWorkOrder,
    updateWorkOrderStatus,
    appointments,
    updateAppointmentStatus,
    updateAppointment,
    deleteAppointment,
    aiSettings,
    notify,
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

  const getCurrentPeruTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Form for vehicle entry or direct parts sale
  const [isVentaDirecta, setIsVentaDirecta] = useState(false);
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
    problem_description: "",
  });

  // Keep entryDate in sync when selectedDate changes and update time
  useEffect(() => {
    setEntryDate(selectedDate);
    setEntryTime(getCurrentPeruTime());
  }, [selectedDate]);

  // Modals for appointment management
  const [rescheduleModal, setRescheduleModal] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Vehicle Info / Last Entry Modal State
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalPlate, setInfoModalPlate] = useState<string>("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoData, setInfoData] = useState<{
    vehicle: any | null;
    lastOrder: WorkOrder | null;
    lastInvoice: any | null;
    allOrders: WorkOrder[];
    technicianName: string;
  } | null>(null);

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

  /**
   * Open Vehicle Info Modal showing full vehicle sheet & last workshop entry
   */
  const handleOpenVehicleInfoModal = async (targetPlate?: string) => {
    const rawPlate = targetPlate || entryForm.plate;
    const clean = (rawPlate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean || clean.length < 3) {
      notify("warning", "Por favor ingrese o escanee una placa válida primero para consultar su información.");
      return;
    }

    setInfoModalPlate(rawPlate.toUpperCase());
    setInfoModalOpen(true);
    setInfoLoading(true);
    setInfoData(null);

    try {
      // 1. Get vehicle data from local store
      let veh = vehicles.find((v) => v.plate && v.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean) || null;

      // 2. Get local work orders
      let matchingOrders = workOrders.filter((wo) => wo.vehicle_plate && wo.vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean);

      // 3. Query Supabase in real-time to guarantee fetching full history & latest entries
      try {
        const [remoteVehRes, remoteOrdersRes] = await Promise.all([
          supabase.from("vehicles").select("*").ilike("plate", `%${clean}%`).limit(1),
          supabase.from("work_orders").select("*").ilike("vehicle_plate", `%${clean}%`).order("entry_time", { ascending: false }).limit(10),
        ]);

        if (remoteVehRes.data && remoteVehRes.data.length > 0) {
          veh = { ...remoteVehRes.data[0], ...veh };
        }

        if (remoteOrdersRes.data && remoteOrdersRes.data.length > 0) {
          const map = new Map<string, WorkOrder>();
          matchingOrders.forEach((o) => map.set(o.id, o));
          remoteOrdersRes.data.forEach((ro: any) => {
            map.set(ro.id, {
              ...ro,
              items: ro.items || [],
            });
          });
          matchingOrders = Array.from(map.values());
        }
      } catch (err) {
        console.warn("Remote history query error:", err);
      }

      // Sort matching orders descending by entry_time
      matchingOrders.sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());

      const lastOrder = matchingOrders[0] || null;
      let lastInvoice = null;
      if (lastOrder) {
        lastInvoice = invoices.find((i) => i.work_order_id === lastOrder.id) || null;
      }
      if (!lastInvoice && matchingOrders.length > 0) {
        lastInvoice = invoices.find((i) => i.vehicle_plate && i.vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean) || null;
      }

      // Find technician name
      let technicianName = "Sin técnico asignado";
      if (lastOrder?.assigned_technician_id) {
        const t = technicians.find((tech) => tech.id === lastOrder.assigned_technician_id);
        if (t) technicianName = t.full_name;
      }

      setInfoData({
        vehicle: veh,
        lastOrder,
        lastInvoice,
        allOrders: matchingOrders,
        technicianName,
      });
    } catch (e: any) {
      notify("warning", `Error al consultar información: ${e?.message || "Intente nuevamente"}`);
    } finally {
      setInfoLoading(false);
    }
  };

  /**
   * Abre la Consulta Vehicular oficial de SUNARP en una pestaña nueva con la
   * placa ingresada, para ver la información registral de dicho vehículo.
   */
  const handleOpenSunarpConsult = (targetPlate?: string) => {
    const rawPlate = targetPlate || entryForm.plate;
    const clean = (rawPlate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean || clean.length < 3) {
      notify("warning", "Por favor ingrese o escanee una placa válida primero para consultarla en SUNARP.");
      return;
    }
    const url = `https://consultavehicular.sunarp.gob.pe/consulta-vehicular/inicio?placa=${encodeURIComponent(clean)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    notify("info", `Abriendo Consulta Vehicular SUNARP para la placa ${clean}...`);
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

    // 4. Tabla Registro del Taller (histórico CSV): completa nombre y teléfono
    try {
      const { lookupPlateClientData } = await import("@/lib/utils/plate-autofill");
      const csvData = await lookupPlateClientData(clean, vehicles);
      if (csvData.found) {
        return {
          plate: plateToSearch.toUpperCase(),
          brand: "",
          model: "Importado",
          year: 2023,
          color: "Plata",
          fuel_type: "GNV",
          owner_name: csvData.client_name || "Cliente Registrado",
          owner_phone: csvData.client_phone || "+51 900000000",
          current_mileage: 0,
        };
      }
    } catch (e) {
      // Histórico no disponible: continuar sin autocompletar.
    }

    return null;
  };

  /**
   * Handle Plate Input Changes & Auto-complete with Auto-Hyphen after 3 chars
   */
  const handlePlateChange = async (plateInput: string) => {
    let formatted = formatPlate(plateInput || "");

    setEntryForm((prev) => ({ ...prev, plate: formatted }));

    if (formatted.length >= 6) {
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
        notify("info", `Vehículo ${found.plate} reconocido automáticamente en la base de datos.`);
      }
    }
  };

  /**
   * Process Image OCR from file upload or camera (prevents double hyphens)
   */
  const processImageFile = async (file: File) => {
    if (!hasApiKey) {
      notify("warning", "Se requiere configurar una API Key en Configuración de IA para utilizar el reconocimiento OCR.");
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
        // Strip all hyphens and non-alphanumeric to guarantee zero double hyphens
        const rawDetected = (data.plate || "").toUpperCase();
        const cleanChars = rawDetected.replace(/[^A-Z0-9]/g, "").slice(0, 6);
        const detectedPlate = cleanChars.length > 3
          ? `${cleanChars.slice(0, 3)}-${cleanChars.slice(3)}`
          : cleanChars;

        notify("success", `Placa detectada: ${detectedPlate} (Confianza: ${Math.round((data.confidence || 0.9) * 100)}%)`);

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
          problem_description: "",
        });
      } else {
        notify("warning", "No se detectó una placa clara en la imagen. Ingrese los datos manualmente.");
      }
    } catch (error: any) {
      notify("warning", `Error al procesar la imagen: ${error?.message || "Intente nuevamente."}`);
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
        notify("warning", "El archivo CSV no contiene registros válidos.");
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

      notify("success", `¡Se importaron y registraron ${count} ingresos de vehículos en Portería!`);
    } catch (err: any) {
      notify("warning", `Error al importar CSV: ${err.message || "Formato no válido"}`);
    }
    e.target.value = "";
  };

  /**
   * Submit Vehicle Entry Form & Open Work Order
   */
  const handleRegisterEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const plate = isVentaDirecta ? "VENTA" : formatPlate(entryForm.plate);
    if (!isVentaDirecta && !plate) {
      notify("warning", "Ingrese una placa válida.");
      return;
    }

    if (isVentaDirecta && !entryForm.problem_description.trim()) {
      notify("warning", "Ingrese el motivo o detalle de los repuestos a vender.");
      return;
    }

    // Build ISO timestamp from chosen date and time in Peru timezone
    const finalTime = entryTime || getCurrentPeruTime();
    const chosenDateTimeISO = buildPeruISOString(entryDate || selectedDate, finalTime);

    // 1. Register or update vehicle (for direct parts sales, registers under standard VENTA plate)
    registerVehicle({
      plate,
      brand: isVentaDirecta ? "VENTA DE REPUESTOS" : (entryForm.brand || "Automóvil"),
      model: isVentaDirecta ? "MOSTRADOR" : (entryForm.model || "Genérico"),
      year: isVentaDirecta ? 2025 : (Number(entryForm.year) || 2023),
      color: isVentaDirecta ? "Sin Vehículo" : (entryForm.color || "Plata"),
      fuel_type: isVentaDirecta ? "GNV" : entryForm.fuel_type,
      owner_name: titleCase(entryForm.owner_name) || (isVentaDirecta ? "Cliente Mostrador / Venta" : "Cliente Taller"),
      owner_phone: entryForm.owner_phone.trim() || (isVentaDirecta ? "-" : "+51 987654321"),
      current_mileage: isVentaDirecta ? 0 : (Number(entryForm.current_mileage) || 0),
      last_visit_date: chosenDateTimeISO,
    });

    // 2. Create work order for workshop with specific entry_time
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: entryForm.problem_description.trim() || (isVentaDirecta ? "Venta directa de repuestos al mostrador" : "Ingreso para mantenimiento general y revisión"),
      entry_time: chosenDateTimeISO,
    });

    if (isVentaDirecta) {
      notify("success", `¡Venta de repuesto registrada bajo código VENTA a las ${finalTime} y enviada a Taller/Caja con OT abierta!`);
    } else {
      notify("success", `¡Ingreso del vehículo ${plate} registrado a las ${finalTime} para el ${formatPeruDate(entryDate || selectedDate)} y enviado a Taller!`);
    }

    // Reset form
    setEntryTime(getCurrentPeruTime());
    setEntryForm({
      plate: isVentaDirecta ? "VENTA" : "",
      brand: "",
      model: "",
      year: 2023,
      color: "",
      fuel_type: "GNV",
      owner_name: "",
      owner_phone: "",
      current_mileage: 0,
      problem_description: "",
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

    notify(
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
    notify("info", `Cita de ${rescheduleModal.plate} reprogramada para ${formattedDate}.`);
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
        notify("warning", `Cita de ${app.plate} ha sido anulada.`);
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
        notify("success", `Salida del vehículo ${wo.vehicle_plate} registrada correctamente.`);
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
              className={`px-3 py-2 rounded-xl text-xs font-black transition-transform active:scale-95 ${isToday
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
              else notify("warning", "Configure una API Key en Configuración de IA para habilitar escaneo con cámara.");
            }}
            disabled={ocrLoading}
            className={`px-3.5 py-2.5 text-xs font-extrabold rounded-xl border flex items-center gap-2 transition-all shrink-0 active:scale-95 ${!hasApiKey
              ? "bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white"
              : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-red-500/30 shadow-lg shadow-red-600/25"
              }`}
          >
            <Camera className={`w-4 h-4 shrink-0 ${ocrLoading ? "animate-spin" : ""}`} />
            <span>{ocrLoading ? "Escaneando con IA..." : "Tomar Foto / Escanear IA"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form + Appointments & Semaphore */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Entry Registration Form (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-white/10 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${isVentaDirecta ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {isVentaDirecta ? <ShoppingBag className="w-5 h-5" /> : <Car className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {isVentaDirecta ? "Registrar Venta de Repuesto" : "Registrar Ingreso de Vehículo"}
                </h2>
                <p className="text-[11px] text-gray-400">
                  {isVentaDirecta ? "Apertura de OT para venta directa al mostrador / recomendado." : "Apertura inmediata de orden de trabajo en Taller."}
                </p>
              </div>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-mono font-bold border ${isVentaDirecta ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-white/5 text-gray-300 border-white/10"
              }`}>
              {isVentaDirecta ? "Venta Mostrador" : "Búsqueda Auto"}
            </span>
          </div>

          {/* Toggle Tipo de Registro: Vehículo vs Venta Directa */}
          <div className="grid grid-cols-2 p-1 bg-black/60 rounded-2xl border border-white/15 text-xs font-black">
            <button
              type="button"
              onClick={() => {
                setIsVentaDirecta(false);
                setEntryForm((prev) => ({ ...prev, plate: "" }));
              }}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${!isVentaDirecta
                ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg shadow-red-600/30"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <Car className="w-4 h-4 shrink-0" />
              <span>🚗 Ingreso Vehículo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsVentaDirecta(true);
                setEntryForm((prev) => ({ ...prev, plate: "VENTA" }));
              }}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${isVentaDirecta
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>📦 Venta de Repuesto</span>
            </button>
          </div>

          {/* Info Banner if Venta Directa */}
          {isVentaDirecta && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
              <ShoppingBag className="w-4 h-4 shrink-0 text-emerald-400" />
              <div>
                <span className="font-black block">Modo Venta de Repuestos (Sin Vehículo)</span>
                <span className="text-[11px] text-emerald-200/80">Código automático <strong className="text-white font-mono bg-black/50 px-1.5 py-0.5 rounded">VENTA</strong>. Solo ingrese el motivo/repuesto y cliente.</span>
              </div>
            </div>
          )}

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

            {/* If NOT Venta Directa: Full Vehicle Fields */}
            {!isVentaDirecta ? (
              <>
                {/* Plate & Fuel Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-300 uppercase">
                        Placa Vehículo *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenVehicleInfoModal(entryForm.plate)}
                          className="text-[11px] font-black text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-950/60 hover:bg-cyan-600/80 border border-cyan-500/40 hover:border-cyan-400 px-2 py-0.5 rounded-lg transition-all active:scale-95 shadow-sm shadow-cyan-950/40"
                          title="Ver ficha completa y último ingreso al taller de esta placa"
                        >
                          <Info className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Info</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSunarpConsult(entryForm.plate)}
                          className="text-[11px] font-black text-emerald-300 hover:text-white flex items-center gap-1 bg-emerald-950/60 hover:bg-emerald-600/80 border border-emerald-500/40 hover:border-emerald-400 px-2 py-0.5 rounded-lg transition-all active:scale-95 shadow-sm shadow-emerald-950/40"
                          title="Consultar esta placa en SUNARP (Consulta Vehicular oficial)"
                        >
                          <Search className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sunarp</span>
                        </button>
                      </div>
                    </div>
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
                      onChange={(e) => setEntryForm({ ...entryForm, brand: capitalizeFirst(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Modelo</label>
                    <input
                      type="text"
                      placeholder="Yaris"
                      value={entryForm.model}
                      onChange={(e) => setEntryForm({ ...entryForm, model: capitalizeFirst(e.target.value) })}
                      className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Color</label>
                    <input
                      type="text"
                      placeholder="Plata"
                      value={entryForm.color}
                      onChange={(e) => setEntryForm({ ...entryForm, color: capitalizeFirst(e.target.value) })}
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
                      onChange={(e) => setEntryForm({ ...entryForm, owner_name: titleCase(e.target.value) })}
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
              </>
            ) : (
              /* If Venta Directa: Simplified Client Details */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-black/40 rounded-2xl border border-white/10">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    Cliente / Recomendado por (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del comprador..."
                    value={entryForm.owner_name}
                    onChange={(e) => setEntryForm({ ...entryForm, owner_name: titleCase(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    Teléfono WhatsApp (Opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+51 987654321"
                    value={entryForm.owner_phone}
                    onChange={(e) => setEntryForm({ ...entryForm, owner_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 focus:outline-none font-medium"
                  />
                </div>
              </div>
            )}

            {/* Reason for entry / Repuestos a vender */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                {isVentaDirecta ? "Detalle de Repuestos a Vender / Motivo *" : "Motivo de Ingreso / Falla Reportada *"}
              </label>
              <textarea
                rows={isVentaDirecta ? 3 : 2}
                required
                placeholder={
                  isVentaDirecta
                    ? "Ej: 2 CONECTORES SENSOR MAP JAC-REFINE, 1 FILTRO DE GAS, 4 BUJIAS, etc."
                    : "Especifique el motivo de ingreso del vehículo (ej: Mantenimiento 5ta gen, calibración, revisión de fuga, cambio de filtros, etc.)..."
                }
                value={entryForm.problem_description}
                onChange={(e) => setEntryForm({ ...entryForm, problem_description: capitalizeFirst(e.target.value) })}
                className={`w-full px-3.5 py-2.5 bg-reygas-surface border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition-colors leading-relaxed font-medium ${isVentaDirecta ? "border-emerald-500/40 focus:border-emerald-400" : "border-white/15 focus:border-red-400"
                  }`}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3.5 font-black rounded-2xl text-sm transition-transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-xl ${isVentaDirecta
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-emerald-600/30"
                : "bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-600/30"
                }`}
            >
              {isVentaDirecta ? (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  <span>Registrar Venta y Abrir OT</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Registrar Ingreso y Abrir OT</span>
                </>
              )}
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
                  className={`px-3 py-1 rounded-lg transition-all ${dateFilterMode === "dia"
                    ? "bg-amber-500 text-black font-black"
                    : "text-gray-400 hover:text-white"
                    }`}
                >
                  Del Día ({filteredAppointments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode("todos")}
                  className={`px-3 py-1 rounded-lg transition-all ${dateFilterMode === "todos"
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
                      className={`p-4 rounded-2xl border transition-all ${isPaidAndAuthorized
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

      {/* ========================================================================= */}
      {/* VEHICLE INFO & LAST WORKSHOP ENTRY MODAL */}
      {/* ========================================================================= */}
      {infoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-cyan-500/30 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl shadow-cyan-950/60 flex flex-col max-h-[90vh] overflow-hidden space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">Historial & Ficha de Vehículo</h3>
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-black/60 border border-cyan-500/40 text-cyan-300">
                      {infoModalPlate}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Información del auto y detalle del último servicio en taller.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="overflow-y-auto pr-1 space-y-5 flex-1 custom-scrollbar">
              {infoLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-cyan-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-bold text-gray-300">Consultando base de datos e historial de la placa {infoModalPlate}...</span>
                </div>
              ) : (
                <>
                  {/* 1. Ficha del Vehículo & Cliente */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-amber-400" />
                      <span>Datos del Vehículo & Propietario</span>
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-reygas-surface border border-white/5">
                        <span className="text-[10px] text-gray-400 block font-semibold">Marca / Modelo</span>
                        <span className="font-bold text-white">
                          {infoData?.vehicle?.brand || entryForm.brand || "—"} {infoData?.vehicle?.model || entryForm.model || ""}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-reygas-surface border border-white/5">
                        <span className="text-[10px] text-gray-400 block font-semibold">Color / Año</span>
                        <span className="font-bold text-white">
                          {infoData?.vehicle?.color || entryForm.color || "—"} ({infoData?.vehicle?.year || entryForm.year || "—"})
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-reygas-surface border border-white/5">
                        <span className="text-[10px] text-gray-400 block font-semibold">Combustible</span>
                        <span className="font-black text-amber-400">
                          ⛽ {infoData?.vehicle?.fuel_type || entryForm.fuel_type || "GNV"}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-reygas-surface border border-white/5">
                        <span className="text-[10px] text-gray-400 block font-semibold">Último Kilometraje</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {infoData?.vehicle?.current_mileage || (infoData?.lastOrder as any)?.current_mileage || entryForm.current_mileage || 0} km
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-reygas-surface/60 border border-white/5">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-[10px] text-gray-400 block">Propietario / Conductor</span>
                          <span className="font-bold text-white truncate">
                            {infoData?.vehicle?.owner_name || infoData?.lastInvoice?.client_name || entryForm.owner_name || "Cliente Garita"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl bg-reygas-surface/60 border border-white/5">
                        <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 block">Teléfono de Contacto</span>
                          <span className="font-bold text-white">
                            {infoData?.vehicle?.owner_phone || entryForm.owner_phone || "Sin teléfono"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Detalle del Último Ingreso al Taller */}
                  {infoData?.lastOrder ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/30 to-black/60 border border-purple-500/30 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-purple-400" />
                          <span>Último Ingreso al Taller</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                          OT #{infoData.lastOrder.id.slice(0, 8)} • {infoData.lastOrder.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Date & Technician */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-gray-400 block font-semibold">Fecha y Hora de Ingreso</span>
                            <span className="font-bold text-white">
                              {formatPeruDateTime(infoData.lastOrder.entry_time)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-gray-400 block font-semibold">Técnico Asignado</span>
                            <span className="font-bold text-white">
                              {infoData.technicianName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Problem / Reason */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
                        <span className="text-[10px] text-amber-300 font-bold uppercase block">
                          Motivo de Ingreso / Falla Reportada:
                        </span>
                        <p className="text-gray-200 leading-relaxed font-medium">
                          {infoData.lastOrder.problem_description || "Sin descripción de falla."}
                        </p>
                      </div>

                      {/* Diagnostics & Observations */}
                      {(infoData.lastOrder.diagnostic_notes || infoData.lastOrder.observations) && (
                        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-xs space-y-2">
                          {infoData.lastOrder.diagnostic_notes && (
                            <div>
                              <span className="text-[10px] text-purple-300 font-bold uppercase block">
                                🔍 Diagnóstico Técnico OBD2 / ECU:
                              </span>
                              <p className="text-gray-200 font-medium">{infoData.lastOrder.diagnostic_notes}</p>
                            </div>
                          )}
                          {infoData.lastOrder.observations && (
                            <div className="pt-1 border-t border-purple-500/20">
                              <span className="text-[10px] text-amber-300 font-bold uppercase block">
                                💡 Recomendaciones / Observaciones:
                              </span>
                              <p className="text-gray-200 font-medium">{infoData.lastOrder.observations}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Technical Expirations: Quinquennial & Chip */}
                      {(infoData.lastOrder.quinquennial_date || infoData.lastOrder.chip_expiry_date) && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {infoData.lastOrder.quinquennial_date && (
                            <div className="p-2 rounded-xl bg-black/40 border border-purple-500/20">
                              <span className="text-[10px] text-gray-400 block">Vencimiento Quinquenal</span>
                              <span className="font-mono font-bold text-purple-300">
                                {formatPeruDate(infoData.lastOrder.quinquennial_date)}
                              </span>
                            </div>
                          )}
                          {infoData.lastOrder.chip_expiry_date && (
                            <div className="p-2 rounded-xl bg-black/40 border border-cyan-500/20">
                              <span className="text-[10px] text-gray-400 block">Vencimiento Chip Anual</span>
                              <span className="font-mono font-bold text-cyan-300">
                                {formatPeruDate(infoData.lastOrder.chip_expiry_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parts & Services items from last order */}
                      {infoData.lastOrder.items && infoData.lastOrder.items.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase block">
                            Repuestos & Servicios Utilizados:
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {infoData.lastOrder.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/40 border border-white/5">
                                <span className="text-gray-300 font-medium">
                                  {item.quantity}x {item.description}
                                </span>
                                <span className="font-mono font-bold text-amber-300">
                                  S/ {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Financial info: Invoice total & Status */}
                      {infoData.lastInvoice && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-emerald-400" />
                            <div>
                              <span className="text-[10px] text-gray-400 block">Comprobante / Pago</span>
                              <span className="font-bold text-white">
                                {infoData.lastInvoice.receipt_type || "Boleta"} #{infoData.lastInvoice.receipt_number || "—"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block">Monto Cobrado</span>
                            <span className="font-mono font-black text-sm text-emerald-400">
                              S/ {Number(infoData.lastInvoice.total_amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-black/30 border border-white/10 text-center space-y-2">
                      <Clock className="w-8 h-8 text-gray-500 mx-auto" />
                      <p className="text-xs font-bold text-gray-300">
                        No se registran órdenes de trabajo previas para la placa <strong className="text-white">{infoModalPlate}</strong>.
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Este será el primer ingreso registrado en el sistema.
                      </p>
                    </div>
                  )}

                  {/* 3. Timeline de Ingresos Anteriores (si hay más de 1) */}
                  {infoData?.allOrders && infoData.allOrders.length > 1 && (
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                      <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Historial de Visitas Anteriores ({infoData.allOrders.length})</span>
                      </span>

                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {infoData.allOrders.slice(1).map((order) => (
                          <div key={order.id} className="p-2.5 rounded-xl bg-reygas-surface border border-white/5 flex items-center justify-between text-xs gap-3">
                            <div>
                              <span className="font-bold text-white block">
                                {formatPeruDate(order.entry_time)}
                              </span>
                              <span className="text-[11px] text-gray-400 line-clamp-1">
                                {order.problem_description || "Servicio de taller"}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 shrink-0 uppercase">
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-cyan-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Cerrar Información
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
