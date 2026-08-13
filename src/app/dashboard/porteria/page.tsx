"use client";

import React, { useState } from "react";
import { useAppStore, Appointment } from "@/lib/store/app-store";
import { parseCSVRows } from "@/lib/csv-parser";
import { compressImageFile } from "@/lib/image-compressor";
import {
  ShieldAlert,
  Car,
  Camera,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  Fuel,
  User,
  Phone,
  Plus,
  Calendar,
  RefreshCw,
  Upload,
  Sparkles,
  AlertCircle,
  Check,
  X,
  Edit3
} from "lucide-react";

export default function PorteriaPage() {
  const {
    vehicles,
    workOrders,
    registerVehicle,
    createWorkOrder,
    updateWorkOrderStatus,
    appointments,
    updateAppointmentStatus,
    updateAppointment,
    aiSettings,
  } = useAppStore();

  const hasApiKey = Boolean(aiSettings?.apiKey && aiSettings.apiKey.trim().length > 0);

  const [searchPlate, setSearchPlate] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSource, setOcrSource] = useState<"camera" | "upload" | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Status notification message
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "info" | "warning"; text: string } | null>(null);

  // Form for vehicle entry
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

  // Modals for appointment management
  const [rescheduleModal, setRescheduleModal] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const showAlert = (type: "success" | "info" | "warning", text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // Search existing vehicle by plate input dynamically
  const handlePlateChange = (newPlate: string) => {
    const uppercasePlate = newPlate.toUpperCase();
    const cleanPlate = uppercasePlate.replace(/[^A-Z0-9]/g, "");

    if (cleanPlate.length >= 5) {
      const existingVehicle = vehicles.find(
        (v) => v.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate
      );

      if (existingVehicle) {
        setEntryForm((prev) => ({
          ...prev,
          plate: uppercasePlate,
          brand: existingVehicle.brand || "",
          model: existingVehicle.model || "",
          year: existingVehicle.year || 2023,
          color: existingVehicle.color || "",
          fuel_type: existingVehicle.fuel_type || "GNV",
          owner_name: existingVehicle.owner_name || "",
          owner_phone: existingVehicle.owner_phone || "",
          current_mileage: existingVehicle.current_mileage || 0,
        }));
        showAlert("info", `Vehículo ${uppercasePlate} encontrado en el registro. Datos cargados.`);
        return;
      }
    }

    // IF NOT FOUND or user modifies plate to an unregistered one:
    // Reset all other fields to blank so it does NOT retain previous vehicle's data
    setEntryForm((prev) => ({
      ...prev,
      plate: uppercasePlate,
      brand: "",
      model: "",
      year: 2023,
      color: "",
      fuel_type: "GNV",
      owner_name: "",
      owner_phone: "",
      current_mileage: 0,
    }));
  };

  // Perform AI Camera / Image OCR Scan
  const handleScanOCR = async (imageBase64?: string) => {
    if (!imageBase64) {
      showAlert("warning", "Por favor seleccione o capture una fotografía del vehículo.");
      return;
    }

    setOcrLoading(true);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          apiKey: aiSettings?.apiKey,
          provider: aiSettings?.provider,
          model: aiSettings?.model,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        // Clear fields so old data is not retained
        setEntryForm((prev) => ({
          ...prev,
          brand: "",
          model: "",
          color: "",
          owner_name: "",
          owner_phone: "",
          current_mileage: 0,
        }));
        showAlert("warning", result.error || "No se pudo procesar la imagen con IA. Ingrese la placa manualmente.");
        return;
      }

      const data = result.data || {};
      const scannedPlate = (data.plate || "").toUpperCase().trim();
      const cleanScannedPlate = scannedPlate.replace(/[^A-Z0-9]/g, "");

      // 1. Check if the detected plate exists in database
      if (cleanScannedPlate.length >= 4) {
        const existingVehicle = vehicles.find(
          (v) => v.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanScannedPlate
        );

        if (existingVehicle) {
          // If registered: Pull ALL existing data from database
          setEntryForm((prev) => ({
            ...prev,
            plate: existingVehicle.plate || scannedPlate,
            brand: existingVehicle.brand || "",
            model: existingVehicle.model || "",
            year: existingVehicle.year || 2023,
            color: existingVehicle.color || "",
            fuel_type: existingVehicle.fuel_type || "GNV",
            owner_name: existingVehicle.owner_name || "",
            owner_phone: existingVehicle.owner_phone || "",
            current_mileage: existingVehicle.current_mileage || 0,
            problem_description: prev.problem_description || "Ingreso para mantenimiento general",
          }));
          showAlert(
            "success",
            `¡Vehículo ${existingVehicle.plate} encontrado en el sistema! Se cargaron automáticamente sus datos (${existingVehicle.brand} ${existingVehicle.model}). Ingrese el motivo de ingreso.`
          );
        } else {
          // If NOT registered in DB: Set detected plate, and fill ONLY parameters detected with confidence
          setEntryForm((prev) => ({
            ...prev,
            plate: scannedPlate,
            brand: data.brand || "",
            model: data.model || "",
            year: 2023,
            color: data.color || "",
            fuel_type: (data.fuel_type as any) || "GNV",
            owner_name: "", // Leave blank for manual entry
            owner_phone: "", // Leave blank for manual entry
            current_mileage: 0,
            problem_description: prev.problem_description || "Ingreso para mantenimiento general",
          }));
          showAlert(
            "info",
            `¡Placa ${scannedPlate} detectada por IA! (Vehículo nuevo). Complete los datos faltantes para registrar el ingreso.`
          );
        }
      } else {
        // Plate not clearly detected
        setEntryForm((prev) => ({
          ...prev,
          plate: "",
          brand: data.brand || "",
          model: data.model || "",
          year: 2023,
          color: data.color || "",
          fuel_type: (data.fuel_type as any) || "GNV",
          owner_name: "",
          owner_phone: "",
          current_mileage: 0,
        }));
        showAlert(
          "warning",
          "No se detectó una placa legible en la imagen. Por favor escriba la placa y complete los datos manualmente."
        );
      }
    } catch (error: any) {
      showAlert("warning", "Error al conectar con el servicio OCR. Ingrese la placa manualmente.");
    } finally {
      setOcrLoading(false);
      setCameraOpen(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setOcrLoading(true);
      showAlert("info", "Optimizando fotografía y analizando con IA...");
      const compressedDataUrl = await compressImageFile(file, 1280, 1280, 0.82);
      await handleScanOCR(compressedDataUrl);
    } catch (err: any) {
      showAlert("warning", "No se pudo procesar la imagen seleccionada.");
      setOcrLoading(false);
    } finally {
      // Reset input value so the same file or a new photo can be captured again on tablet
      e.target.value = "";
    }
  };

  // Bulk Vehicle Entry Importer from CSV / Excel
  const handleImportVehiclesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = (evt.target?.result as string) || "";
      const rows = parseCSVRows(rawText);
      let importedCount = 0;

      rows.forEach((cols, idx) => {
        if (idx === 0 || cols.length === 0) return;

        // If standard 20-col workshop format, plate is in col[6], otherwise col[0]
        const plateRaw = cols.length >= 7 && cols[6] ? cols[6] : cols[0];
        if (!plateRaw) return;

        const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (!plate || plate.length < 3) return;

        const isFullFormat = cols.length >= 7 && cols[6];
        const brand = isFullFormat ? cols[4] || "Toyota" : cols[1] || "Toyota";
        const model = isFullFormat ? "Importado" : cols[2] || "Yaris";
        const year = isFullFormat ? 2023 : parseInt(cols[3]) || 2023;
        const color = isFullFormat ? "Plata" : cols[4] || "Plata";
        const fuel_type = (isFullFormat ? cols[3] : cols[5]) as any || "GNV";
        const owner_name = isFullFormat ? cols[8] || "Cliente Importado" : cols[6] || "Cliente Importado";
        const owner_phone = isFullFormat ? cols[9] || "+51 900000000" : cols[7] || "+51 900000000";
        const mileageRaw = isFullFormat ? cols[5] : cols[8];
        const current_mileage = parseInt(mileageRaw?.replace(/[^0-9]/g, "") || "") || 0;
        const problem_description = isFullFormat ? cols[11] || "Ingreso importado" : cols[9] || "Ingreso masivo por importación CSV";

        registerVehicle({
          plate,
          brand,
          model,
          year,
          color,
          fuel_type,
          owner_name,
          owner_phone,
          current_mileage,
          last_visit_date: new Date().toISOString(),
        });

        createWorkOrder({
          vehicle_plate: plate,
          status: "ingresado",
          problem_description,
        });

        importedCount++;
      });

      if (importedCount > 0) {
        showAlert("success", `¡Se importaron con éxito ${importedCount} vehículos de ingreso desde el archivo CSV!`);
      } else {
        showAlert("warning", "No se pudieron interpretar filas. Verifique el formato CSV.");
      }
    };
    reader.readAsText(file);
  };

  const handleRegisterEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const plate = entryForm.plate.toUpperCase();

    // 1. Register or update vehicle in global store
    registerVehicle({
      plate,
      brand: entryForm.brand,
      model: entryForm.model,
      year: Number(entryForm.year),
      color: entryForm.color,
      fuel_type: entryForm.fuel_type,
      owner_name: entryForm.owner_name,
      owner_phone: entryForm.owner_phone,
      current_mileage: Number(entryForm.current_mileage),
      last_visit_date: new Date().toISOString(),
    });

    // 2. Create work order for workshop
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: entryForm.problem_description,
    });

    showAlert("success", `¡Ingreso del vehículo ${plate} registrado con éxito y enviado a Taller!`);

    // Reset form
    setEntryForm({
      plate: "",
      brand: "",
      model: "",
      year: 2022,
      color: "",
      fuel_type: "GNV",
      owner_name: "",
      owner_phone: "",
      current_mileage: 50000,
      problem_description: "Ingreso para mantenimiento general y revisión",
    });
  };

  // Appointment actions
  const handleConfirmAttendance = (app: Appointment) => {
    const plate = app.plate.toUpperCase();

    // 1. Ensure vehicle is registered in global store & Supabase
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
        current_mileage: 50000,
        last_visit_date: new Date().toISOString(),
      });
    }

    // 2. Create work order for workshop and active gate traffic
    createWorkOrder({
      vehicle_plate: plate,
      status: "ingresado",
      problem_description: `${app.service_type} - Cita confirmada en Portería. ${app.notes || ""}`,
    });

    // 3. Update appointment status so it leaves pending reservations
    updateAppointmentStatus(app.id, "confirmado");

    showAlert(
      "success",
      `¡Asistencia Confirmada! El vehículo ${plate} salió de la lista de reservas pendientes y pasó al Semáforo de Salida e Inspección de Garita (Orden ingresada a Taller).`
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
    showAlert("info", `Cita de ${rescheduleModal.plate} reprogramada para ${new Date(rescheduleDate).toLocaleString()}.`);
    setRescheduleModal(null);
  };

  const handleCancelAppointment = (id: string, plate: string) => {
    if (confirm(`¿Desea cancelar/anular la cita del vehículo ${plate}?`)) {
      updateAppointmentStatus(id, "cancelado");
      showAlert("warning", `Cita de ${plate} ha sido anulada.`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Portería & Garita</h1>
            <p className="text-xs text-gray-400">
              Escaneo OCR Inteligente de Placas por IA, Control de Citas Programadas y Semáforo de Salida.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <label className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all shrink-0 touch-target">
            <Upload className="w-4 h-4 text-white shrink-0" />
            <span className="whitespace-nowrap">Cargar CSV Ingresos</span>
            <input type="file" accept=".csv, .txt, .xlsx, .xls" onChange={handleImportVehiclesCSV} className="hidden" />
          </label>

          {hasApiKey ? (
            <label className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs sm:text-sm font-bold rounded-xl border border-white/10 flex items-center gap-2 cursor-pointer transition-colors shrink-0 touch-target">
              <Upload className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="whitespace-nowrap">Subir Foto Placa</span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <button
              disabled
              title="Requiere configurar una API Key en Configuración de IA"
              className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-reygas-surface text-gray-500 text-xs sm:text-sm font-bold rounded-xl border border-white/10 flex items-center gap-2 cursor-not-allowed opacity-50 shrink-0 touch-target"
            >
              <Upload className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="whitespace-nowrap">Subir Foto Placa (Sin API Key)</span>
            </button>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => {
              if (hasApiKey) {
                cameraInputRef.current?.click();
              }
            }}
            disabled={!hasApiKey || ocrLoading}
            title={!hasApiKey ? "Requiere configurar una API Key en Configuración de IA" : "Capturar con cámara o escanear placa por IA"}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl border flex items-center gap-2 transition-all shrink-0 touch-target ${
              !hasApiKey
                ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50"
                : "bg-reygas-red hover:bg-red-700 text-white border-red-500/30 shadow-lg shadow-reygas-red/20"
            }`}
          >
            <Camera className={`w-4 h-4 shrink-0 ${ocrLoading ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap">{ocrLoading ? "Escaneando con IA..." : !hasApiKey ? "Cámara / IA (Sin API Key)" : "Tomar Foto / Escanear IA"}</span>
          </button>
        </div>
      </div>

      {alertMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
            alertMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : alertMessage.type === "warning"
              ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
              : "bg-blue-950/40 border-blue-500/40 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{alertMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Grid: Form + Appointments & Semaphore */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Entry Registration Form */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-reygas-red" />
              <span>Registrar Ingreso de Vehículo</span>
            </h2>
            <span className="text-[10px] text-gray-400 font-mono">Búsqueda Automática</span>
          </div>

          <form onSubmit={handleRegisterEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Placa Vehículo *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={entryForm.plate}
                    onChange={(e) => handlePlateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono font-bold uppercase focus:border-reygas-red pr-8"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Tipo Combustible
                </label>
                <select
                  value={entryForm.fuel_type}
                  onChange={(e) => setEntryForm({ ...entryForm, fuel_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-reygas-red"
                >
                  <option value="GNV">GNV</option>
                  <option value="GLP">GLP</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Bifuel">Bifuel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Marca</label>
                <input
                  type="text"
                  required
                  placeholder="Toyota"
                  value={entryForm.brand}
                  onChange={(e) => setEntryForm({ ...entryForm, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Modelo</label>
                <input
                  type="text"
                  required
                  placeholder="Yaris"
                  value={entryForm.model}
                  onChange={(e) => setEntryForm({ ...entryForm, model: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Color</label>
                <input
                  type="text"
                  placeholder="Plata"
                  value={entryForm.color}
                  onChange={(e) => setEntryForm({ ...entryForm, color: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Propietario / Conductor
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre Apellido"
                  value={entryForm.owner_name}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Teléfono Contacto
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+51 987654321"
                  value={entryForm.owner_phone}
                  onChange={(e) => setEntryForm({ ...entryForm, owner_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Motivo de Ingreso / Falla Reportada
              </label>
              <textarea
                rows={3}
                required
                value={entryForm.problem_description}
                onChange={(e) => setEntryForm({ ...entryForm, problem_description: e.target.value })}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-reygas-red hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-reygas-red/30"
            >
              <Plus className="w-5 h-5" />
              <span>Registrar Ingreso y Abrir OT</span>
            </button>
          </form>
        </div>

        {/* Scheduled Appointments & Exit Semaphore */}
        <div className="lg:col-span-7 space-y-6">
          {/* Citas & Reservas Programadas */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Citas & Reservas Programadas</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                {appointments.filter((a) => a.status !== "cancelado" && a.status !== "completado").length} pendientes
              </span>
            </h2>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {appointments.filter((a) => a.status !== "cancelado").length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay citas programadas actualmente.</p>
              ) : (
                [...appointments]
                  .filter((a) => a.status !== "cancelado")
                  .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                  .map((app) => (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-xl bg-reygas-card/80 border border-white/10 hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white bg-reygas-surface px-2 py-0.5 rounded border border-white/10">
                            {app.plate}
                          </span>
                          <span className="text-xs font-bold text-gray-200">{app.client_name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              app.status === "confirmado"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          <span className="text-gray-300 font-medium">{app.service_type}</span> •{" "}
                          <span className="text-amber-400">{new Date(app.scheduled_date).toLocaleString()}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleConfirmAttendance(app)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirmar Asistencia</span>
                        </button>

                        <button
                          onClick={() => handleOpenReschedule(app)}
                          className="p-1.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                          title="Reprogramar Cita"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleCancelAppointment(app.id, app.plate)}
                          className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
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

          {/* Exit Semaphore & Active Vehicles List */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Semáforo de Salida e Inspección de Garita</span>
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por placa..."
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                  className="pl-9 pr-3 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white uppercase"
                />
              </div>
            </div>

            {/* List of Active Vehicles */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {workOrders
                .filter((wo) => (searchPlate ? wo.vehicle_plate.includes(searchPlate) : true))
                .map((wo) => {
                  const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
                  const isPaidAndAuthorized = wo.status === "pagado_autorizado" || wo.status === "finalizado";

                  return (
                    <div
                      key={wo.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPaidAndAuthorized
                          ? "bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                          : "bg-reygas-card/80 border-white/10"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-2.5 py-0.5 rounded border border-white/10">
                              {wo.vehicle_plate}
                            </span>
                            <span className="text-xs font-bold text-gray-300">
                              {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehículo"}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-reygas-red/20 text-reygas-red font-bold">
                              {vehicle?.fuel_type || "GNV"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1">
                            <span className="text-gray-300 font-semibold">Reporte:</span> {wo.problem_description}
                          </p>
                        </div>

                        {/* Semaphore Status Badge & Action */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {isPaidAndAuthorized ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black animate-pulse">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>🟢 VERDE (AUTORIZADO)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black">
                              <XCircle className="w-4 h-4" />
                              <span>🔴 ROJO (SALDO/TRABAJO PENDIENTE)</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">
                              Estado: {wo.status.replace("_", " ")}
                            </span>
                            {isPaidAndAuthorized && (
                              <button
                                onClick={() => updateWorkOrderStatus(wo.id, "finalizado")}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                              >
                                Registrar Salida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Reprogramar Cita - {rescheduleModal.plate}</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Nueva Fecha y Hora Programada
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setRescheduleModal(null)}
                className="px-4 py-2 bg-reygas-surface text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReschedule}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold rounded-xl"
              >
                Guardar Reprogramación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
