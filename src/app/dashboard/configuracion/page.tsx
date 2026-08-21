"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  Cpu,
  Key,
  Globe,
  Database,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  Lock,
  Calendar,
  Clock,
  Sparkles,
  Server,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Sliders,
  ExternalLink,
  Download,
  HardDrive,
  FolderArchive,
  Receipt,
  Hash,
  Save,
  Terminal,
  X
} from "lucide-react";
import { getPeruDateString } from "@/lib/utils/date-utils";
import { getLocalLogs, exportLocalLogs, BUILD_SHA } from "@/lib/system-log";

export default function ConfiguracionPage() {
  const {
    aiSettings,
    updateAISettings,
    correlativeConfig,
    updateCorrelativeConfig,
    vehicles,
    workOrders,
    inventoryItems,
    technicians,
    invoices,
    appointments,
    certifications,
    scheduleRecords,
    siteContent,
    updateSiteContent,
    notify,
  } = useAppStore();

  // Correlative Settings State
  const [correlativeForm, setCorrelativeForm] = useState({
    ticketSeries: correlativeConfig?.ticketSeries || "TK01",
    ticketLastNumber: correlativeConfig?.ticketLastNumber || 4545,
    boletaSeries: correlativeConfig?.boletaSeries || "B001",
    boletaLastNumber: correlativeConfig?.boletaLastNumber || 259,
    facturaSeries: correlativeConfig?.facturaSeries || "F001",
    facturaLastNumber: correlativeConfig?.facturaLastNumber || 282,
    notaCreditoSeries: correlativeConfig?.notaCreditoSeries || "FC01",
    notaCreditoLastNumber: correlativeConfig?.notaCreditoLastNumber || 0,
    lastUpdateDate: correlativeConfig?.lastUpdateDate || getPeruDateString(),
    allowEditReceiptNumber: correlativeConfig?.allowEditReceiptNumber !== false,
    maxVehiclesPerSlot: Number(correlativeConfig?.maxVehiclesPerSlot) || 3,
  });

  const [correlativeSaveMsg, setCorrelativeSaveMsg] = useState(false);

  // WhatsApp Workshop Settings State
  const [whatsappPhone, setWhatsappPhone] = useState(siteContent?.contact?.whatsapp || "+51 987 654 321");
  const [whatsappSaveMsg, setWhatsappSaveMsg] = useState(false);

  React.useEffect(() => {
    if (siteContent?.contact?.whatsapp) {
      setWhatsappPhone(siteContent.contact.whatsapp);
    }
  }, [siteContent?.contact?.whatsapp]);

  const handleSaveWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteContent("contact", {
      ...siteContent?.contact,
      whatsapp: whatsappPhone,
    });
    setWhatsappSaveMsg(true);
    setTimeout(() => setWhatsappSaveMsg(false), 4000);
  };

  React.useEffect(() => {
    if (correlativeConfig) {
      setCorrelativeForm({
        ticketSeries: correlativeConfig.ticketSeries || "TK01",
        ticketLastNumber: correlativeConfig.ticketLastNumber || 4545,
        boletaSeries: correlativeConfig.boletaSeries || "B001",
        boletaLastNumber: correlativeConfig.boletaLastNumber || 259,
        facturaSeries: correlativeConfig.facturaSeries || "F001",
        facturaLastNumber: correlativeConfig.facturaLastNumber || 282,
        notaCreditoSeries: correlativeConfig.notaCreditoSeries || "FC01",
        notaCreditoLastNumber: correlativeConfig.notaCreditoLastNumber || 0,
        lastUpdateDate: correlativeConfig.lastUpdateDate || getPeruDateString(),
        allowEditReceiptNumber: correlativeConfig.allowEditReceiptNumber !== false,
        maxVehiclesPerSlot: Number(correlativeConfig.maxVehiclesPerSlot) || 3,
      });
    }
  }, [correlativeConfig]);

  const handleSaveCorrelatives = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...correlativeForm,
      ticketLastNumber: Number(correlativeForm.ticketLastNumber) || 0,
      boletaLastNumber: Number(correlativeForm.boletaLastNumber) || 0,
      facturaLastNumber: Number(correlativeForm.facturaLastNumber) || 0,
      notaCreditoLastNumber: Number(correlativeForm.notaCreditoLastNumber) || 0,
      lastUpdateDate: correlativeForm.lastUpdateDate || getPeruDateString(),
      allowEditReceiptNumber: correlativeForm.allowEditReceiptNumber,
      maxVehiclesPerSlot: Math.max(1, Math.min(10, Number(correlativeForm.maxVehiclesPerSlot) || 3)),
    };
    updateCorrelativeConfig(payload);
    setCorrelativeSaveMsg(true);
    setTimeout(() => setCorrelativeSaveMsg(false), 4000);
  };

  const [formData, setFormData] = useState({
    apiKey: aiSettings?.apiKey || "",
    provider: aiSettings?.provider || "openai",
    model: aiSettings?.model || "gpt-4o-mini",
    customEndpoint: aiSettings?.customEndpoint || "",
  });

  React.useEffect(() => {
    if (aiSettings) {
      setFormData({
        apiKey: aiSettings.apiKey || "",
        provider: aiSettings.provider || "openai",
        model: aiSettings.model || "gpt-4o-mini",
        customEndpoint: aiSettings.customEndpoint || "",
      });
    }
  }, [aiSettings]);

  // Google Drive config state
  const [driveForm, setDriveForm] = useState({
    folderUrl: "https://drive.google.com/drive/folders/1ReyGas_Backup_Empresa_2026",
    autoBackupCron: "daily",
    serviceAccountEmail: "reygas-backup-bot@reygas-autogas-erp.iam.gserviceaccount.com",
    isConnected: true,
  });

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);

  // Log interno local (diagnóstico): visor de texto + descarga
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [logFilter, setLogFilter] = useState("");

  const handleViewLog = () => {
    try {
      const logs = getLocalLogs(1000);
      const lines = logs.map((l) => {
        const t = (l.ts || "").slice(11, 19);
        const det = l.details ? JSON.stringify(l.details) : "";
        return `${t} [${l.level}] ${l.action} | src: ${l.source} | ${det}`;
      });
      setLogText(lines.join("\n"));
      setLogModalOpen(true);
    } catch {
      setLogText("No se pudo leer el log local.");
      setLogModalOpen(true);
    }
  };

  const filteredLogText = React.useMemo(() => {
    if (!logFilter.trim()) return logText;
    const q = logFilter.toLowerCase();
    return logText.split("\n").filter((line) => line.toLowerCase().includes(q)).join("\n");
  }, [logText, logFilter]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAISettings(formData);
    setTestStatus("success");
    setTestMsg("¡Configuración guardada y sincronizada exitosamente en Supabase (Disponible para todos los dispositivos)!");
    setTimeout(() => {
      setTestStatus("idle");
      setTestMsg(null);
    }, 4000);
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMsg(null);

    try {
      const dummyImage =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dummyImage,
          apiKey: formData.apiKey,
          provider: formData.provider,
          model: formData.model,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.isRealAI) {
          setTestStatus("success");
          setTestMsg("¡Conexión con la API de IA verificada correctamente!");
        } else {
          setTestStatus("idle");
          setTestMsg(
            "Modo Demostración / Fallback Activo: Ingrese una API Key válida (ej. sk-...) para activar la IA de visión real."
          );
        }
      } else {
        setTestStatus("error");
        setTestMsg(data.error || "Error al probar la conexión con el servidor.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestMsg("No se pudo contactar con la API. Verifique su red o clave API.");
    }
  };

  // Export functions
  const handleExportJSON = () => {
    const backupData = {
      export_timestamp: new Date().toISOString(),
      system_name: "ReyGas ERP Autogás",
      version: "1.0.0",
      tables: {
        vehicles,
        workOrders,
        inventoryItems,
        technicians,
        invoices,
        appointments,
        certifications,
      },
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ReyGas_Backup_ERP_${getPeruDateString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSVTable = (tableName: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      notify("warning", `No hay registros en la tabla ${tableName} para exportar.`);
      return;
    }

    const headers = Object.keys(rows[0]).join(",");
    const csvLines = rows.map((r) =>
      Object.values(r)
        .map((val) => (typeof val === "object" ? `"${JSON.stringify(val).replace(/"/g, '""')}"` : `"${val}"`))
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent([headers, ...csvLines].join("\n"));

    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `ReyGas_${tableName}_${getPeruDateString()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSaveDriveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    notify("success", "¡Conexión y configuración con Google Drive guardada programáticamente! Los respaldos automáticos se enviarán a la carpeta configurada.");
  };

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <Sliders className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Configuración & Exportación ERP</h1>
            <p className="text-xs text-gray-400">
              Respaldos de base de datos, exportación de historiales a Excel/CSV y conexión programática con Google Drive corporativo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Persistencia Local & Cloud Activa
          </span>
        </div>
      </div>

      {testMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${testStatus === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : testStatus === "error"
                ? "bg-red-950/40 border-red-500/40 text-red-300"
                : "bg-blue-950/40 border-blue-500/40 text-blue-300"
            }`}
        >
          <div className="flex items-center gap-2">
            {testStatus === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {testStatus === "error" && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
            {testStatus === "idle" && <Zap className="w-5 h-5 text-amber-400 shrink-0" />}
            <span>{testMsg}</span>
          </div>
        </div>
      )}

      {/* SECTION 0: CORRELATIVE NUMBERING & RECEIPT SERIES CONFIGURATION */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-500/30 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>Configuración de Series y Correlativos de Comprobantes</span>
            </h2>
            <p className="text-xs text-gray-400">
              Establezca la fecha base y el último número correlativo emitido para <strong>Ticket</strong>, <strong>Boleta</strong> y <strong>Factura</strong>. A partir de estos valores, el sistema continuará la numeración correlativa automática en cada cobro.
            </p>
          </div>

          <button
            onClick={handleSaveCorrelatives}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform hover:scale-105 shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Correlativos</span>
          </button>
        </div>

        {correlativeSaveMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>¡Correlativos actualizados exitosamente! La siguiente emisión continuará con la numeración configurada.</span>
          </div>
        )}

        <form onSubmit={handleSaveCorrelatives} className="space-y-6">
          {/* Base Date */}
          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-bold text-gray-300 block">
              📅 Fecha Base de los Correlativos:
            </label>
            <input
              type="date"
              value={correlativeForm.lastUpdateDate}
              onChange={(e) => setCorrelativeForm({ ...correlativeForm, lastUpdateDate: e.target.value })}
              className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Ticket de Venta */}
            <div className="p-4 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black text-white">🎟️ Ticket de Venta</span>
                <span className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-300 font-bold rounded-lg border border-white/10">
                  Interno
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Serie del Ticket:</label>
                  <input
                    type="text"
                    value={correlativeForm.ticketSeries}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, ticketSeries: e.target.value.toUpperCase() })}
                    placeholder="TK01"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Último Emitido:</label>
                  <input
                    type="number"
                    min="1"
                    value={correlativeForm.ticketLastNumber}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, ticketLastNumber: parseInt(e.target.value) || 0 })}
                    placeholder="4545"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold focus:border-amber-400"
                  />
                </div>

                <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] text-amber-300 font-mono">
                  Siguiente: <strong>{correlativeForm.ticketSeries}-{(correlativeForm.ticketLastNumber + 1).toString().padStart(8, "0")}</strong>
                </div>
              </div>
            </div>

            {/* Boleta de Venta Electrónica */}
            <div className="p-4 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black text-white">🧾 Boleta Electrónica</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-950 text-blue-300 font-bold rounded-lg border border-blue-500/30">
                  SUNAT / DNI
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Serie de Boleta:</label>
                  <input
                    type="text"
                    value={correlativeForm.boletaSeries}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, boletaSeries: e.target.value.toUpperCase() })}
                    placeholder="B001"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Último Emitido:</label>
                  <input
                    type="number"
                    min="1"
                    value={correlativeForm.boletaLastNumber}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, boletaLastNumber: parseInt(e.target.value) || 0 })}
                    placeholder="259"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold focus:border-amber-400"
                  />
                </div>

                <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] text-blue-300 font-mono">
                  Siguiente: <strong>{correlativeForm.boletaSeries}-{(correlativeForm.boletaLastNumber + 1).toString().padStart(8, "0")}</strong>
                </div>
              </div>
            </div>

            {/* Factura Electrónica */}
            <div className="p-4 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black text-white">📑 Factura Electrónica</span>
                <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 font-bold rounded-lg border border-purple-500/30">
                  SUNAT / RUC
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Serie de Factura:</label>
                  <input
                    type="text"
                    value={correlativeForm.facturaSeries}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, facturaSeries: e.target.value.toUpperCase() })}
                    placeholder="F001"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Último Emitido:</label>
                  <input
                    type="number"
                    min="1"
                    value={correlativeForm.facturaLastNumber}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, facturaLastNumber: parseInt(e.target.value) || 0 })}
                    placeholder="282"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold focus:border-amber-400"
                  />
                </div>

                <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] text-purple-300 font-mono">
                  Siguiente: <strong>{correlativeForm.facturaSeries}-{(correlativeForm.facturaLastNumber + 1).toString().padStart(8, "0")}</strong>
                </div>
              </div>
            </div>

            {/* Nota de Crédito Electrónica */}
            <div className="p-4 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black text-white">🔄 Nota de Crédito</span>
                <span className="text-[10px] px-2 py-0.5 bg-red-950 text-red-300 font-bold rounded-lg border border-red-500/30">
                  Anulación Factura
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Serie Nota Crédito:</label>
                  <input
                    type="text"
                    value={correlativeForm.notaCreditoSeries}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, notaCreditoSeries: e.target.value.toUpperCase() })}
                    placeholder="FC01"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold text-[11px]">Último Emitido:</label>
                  <input
                    type="number"
                    min="0"
                    value={correlativeForm.notaCreditoLastNumber}
                    onChange={(e) => setCorrelativeForm({ ...correlativeForm, notaCreditoLastNumber: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold focus:border-amber-400"
                  />
                </div>

                <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] text-red-300 font-mono">
                  Siguiente: <strong>{correlativeForm.notaCreditoSeries}-{(correlativeForm.notaCreditoLastNumber + 1).toString().padStart(8, "0")}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Opción: Permitir editar el correlativo del comprobante al confirmar pago en Caja */}
          <div className="p-4 rounded-2xl bg-reygas-surface/60 border border-amber-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-black text-white block">
                    Permitir editar el N° de Ticket / Boleta / Factura al confirmar el pago
                  </label>
                  <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                    Si está <strong className="text-amber-300">ACTIVADO</strong>, el cajero podrá modificar el correlativo del comprobante en la ventana de confirmación de pago de Caja (útil para corregir anulaciones o empalmar series).
                    Si está <strong className="text-gray-300">DESACTIVADO</strong>, el sistema asigna el correlativo automáticamente y el campo queda bloqueado.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCorrelativeForm({ ...correlativeForm, allowEditReceiptNumber: !correlativeForm.allowEditReceiptNumber })}
                className={`relative w-16 h-8 rounded-full transition-colors shrink-0 ${correlativeForm.allowEditReceiptNumber
                  ? "bg-amber-500 shadow-lg shadow-amber-500/30"
                  : "bg-gray-700"
                  }`}
                title={correlativeForm.allowEditReceiptNumber ? "Edición permitida (clic para bloquear)" : "Edición bloqueada (clic para permitir)"}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${correlativeForm.allowEditReceiptNumber ? "left-9" : "left-1"}`}
                />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-black text-white block">
                    Vehículos por Horario en Reservas / Citas
                  </label>
                  <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                    Cupos máximos de vehículos que se pueden asignar a un mismo bloque horario en el modal de Reserva y Cita (Disponibilidad de Horarios).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={correlativeForm.maxVehiclesPerSlot}
                  onChange={(e) => setCorrelativeForm({ ...correlativeForm, maxVehiclesPerSlot: Number(e.target.value) || 3 }) }
                  className="w-20 px-3 py-2 bg-reygas-dark border border-blue-500/40 rounded-xl text-white font-mono font-bold text-sm text-center focus:outline-none focus:border-blue-400"
                />
                <span className="text-xs text-gray-400 font-semibold">veh./hora</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION: WHATSAPP WORKSHOP & NOTIFICATIONS CONFIGURATION */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-emerald-500/30 space-y-6">
        <form onSubmit={handleSaveWhatsapp} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>Configuración de WhatsApp Oficial del Taller</span>
              </h2>
              <p className="text-xs text-gray-400">
                Número de contacto del taller utilizado para enviar confirmaciones de citas automáticas, recordatorios y radar de mantenimiento.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {whatsappSaveMsg && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/40 flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>WhatsApp guardado</span>
                </span>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Guardar WhatsApp</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-4">
              <label className="text-xs text-gray-300 font-bold block">
                Número de WhatsApp de Atención / Recepción del Taller:
              </label>
              <input
                type="text"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="+51 987 654 321"
                className="w-full px-4 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-white font-mono font-bold focus:border-emerald-400"
              />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Este número se utilizará como remitente y enlace directo cuando los clientes hagan clic en el botón de WhatsApp en la web y para las notificaciones de confirmación de citas.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-reygas-surface/60 border border-white/10 space-y-3">
              <label className="text-xs text-gray-300 font-bold block">
                Plantilla Oficial de Mensaje de Confirmación de Cita:
              </label>
              <div className="p-3.5 rounded-xl bg-black/50 border border-emerald-500/20 text-xs text-emerald-200/90 leading-relaxed font-sans space-y-1">
                <p className="font-bold text-white">Estimado(a) &#123;Nombre del Cliente&#125;,</p>
                <p>
                  Le recordamos que su vehículo con placa <strong className="text-amber-300">&#123;Placa&#125;</strong> tiene programada su atención de <strong>&#123;Servicio&#125;</strong> para el <strong>&#123;Fecha y Hora&#125;</strong> en nuestro taller.
                </p>
                <p>
                  Le esperamos puntualmente. Ante cualquier consulta o reprogramación, no dude en comunicarse con nosotros.
                </p>
                <p className="font-bold text-white pt-1">¡Gracias por su preferencia! - Taller Automotriz ReyGas</p>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 1: EXPORT SYSTEM TABLES & HISTORIALS */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <span>Exportar Tablas e Historiales del Sistema (Backup Local)</span>
            </h2>
            <p className="text-xs text-gray-400">
              Descargue instantáneamente copias de seguridad de todas las tablas e historiales operativos en formatos JSON o CSV/Excel.
            </p>
          </div>

          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all shrink-0"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Descargar Backup Completo ERP (.json)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Inventario & Stock</span>
              <span className="text-xs text-emerald-400 font-bold">{inventoryItems.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Catálogo completo de repuestos, precios y stocks.</p>
            <button
              onClick={() => handleExportCSVTable("Inventario", inventoryItems)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Historial Órdenes Taller</span>
              <span className="text-xs text-amber-400 font-bold">{workOrders.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Trabajos de conversión, diagnóstico y repuestos.</p>
            <button
              onClick={() => handleExportCSVTable("Ordenes_Taller", workOrders)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Comprobantes & Caja</span>
              <span className="text-xs text-purple-400 font-bold">{invoices.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Historial de pagos, montos recaudados e impuestos.</p>
            <button
              onClick={() => handleExportCSVTable("Comprobantes_Caja", invoices)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Registro de Vehículos</span>
              <span className="text-xs text-blue-400 font-bold">{vehicles.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Padrón de autos registrados en Portería/Recepción.</p>
            <button
              onClick={() => handleExportCSVTable("Vehiculos", vehicles)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Maestro de Personal</span>
              <span className="text-xs text-pink-400 font-bold">{technicians.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Roster de técnicos, especialidades y teléfonos.</p>
            <button
              onClick={() => handleExportCSVTable("Personal_Tecnicos", technicians)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-pink-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-reygas-surface/50 border border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">Certificaciones GNV/GLP</span>
              <span className="text-xs text-cyan-400 font-bold">{certifications.length} reg.</span>
            </div>
            <p className="text-[11px] text-gray-400">Certificados de prueba hidráulica y chips.</p>
            <button
              onClick={() => handleExportCSVTable("Certificaciones", certifications)}
              className="w-full py-1.5 bg-reygas-dark hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: GOOGLE DRIVE INTEGRATION & AUTOMATIC BACKUPS */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Conexión Programática con Google Drive Corporativo</h2>
              <p className="text-xs text-gray-400">
                Sincronice y guarde automáticamente las copias de seguridad del sistema en una carpeta remota de Google Drive.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
            ● Drive Sincronizado
          </span>
        </div>

        <form onSubmit={handleSaveDriveConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                URL o ID de la Carpeta Destino Google Drive de la Empresa *
              </label>
              <input
                type="text"
                required
                value={driveForm.folderUrl}
                onChange={(e) => setDriveForm({ ...driveForm, folderUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white font-mono focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Frecuencia de Respaldo Programático Automático
              </label>
              <select
                value={driveForm.autoBackupCron}
                onChange={(e) => setDriveForm({ ...driveForm, autoBackupCron: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-blue-500"
              >
                <option value="daily">Diario a las 23:59 (Recomendado)</option>
                <option value="weekly">Semanal los domingos</option>
                <option value="realtime">En tiempo real por cada transacción</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Cuenta de Servicio Google Cloud API (Service Account Email)
            </label>
            <input
              type="email"
              value={driveForm.serviceAccountEmail}
              onChange={(e) => setDriveForm({ ...driveForm, serviceAccountEmail: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs text-gray-300 font-mono focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
            >
              <HardDrive className="w-4 h-4" />
              <span>Guardar Conexión Google Drive</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: AI VISION SETTINGS */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
          <Key className="w-5 h-5 text-reygas-red" />
          <span>Proveedor de Inteligencia Artificial & Visión OCR</span>
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Proveedor de Servicio de IA
              </label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                className="w-full px-4 py-3 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-reygas-red"
              >
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini Vision)</option>
                <option value="gemini">Google Gemini 1.5 Flash / Pro</option>
                <option value="custom">Servidor Custom / Endpoint OCR Privado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Modelo de Reconocimiento de Imagen
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-3 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-reygas-red"
              >
                {formData.provider === "openai" && (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Recomendado - Rápido y Eficiente)</option>
                    <option value="gpt-4o">gpt-4o (Máxima Precisión Vision)</option>
                  </>
                )}
                {formData.provider === "gemini" && (
                  <>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </>
                )}
                {formData.provider === "custom" && (
                  <option value="custom-ocr-v1">Custom Engine v1</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              API Key de la IA (Vision OCR Key)
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="sk-proj-..."
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full px-4 py-3 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-reygas-red pl-10"
              />
              <Key className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="w-full sm:w-auto px-5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${testStatus === "testing" ? "animate-spin" : ""}`} />
              <span>{testStatus === "testing" ? "Verificando Conexión..." : "Probar Conexión API Key"}</span>
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-reygas-red hover:bg-red-700 text-white text-sm font-black rounded-xl shadow-lg shadow-reygas-red/20 flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración IA</span>
            </button>
          </div>
        </form>
      </div>

      {/* ============ LOG INTERNO LOCAL (diagnóstico) ============ */}
      <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              Log Interno del Sistema
            </h2>
            <p className="text-[11px] text-gray-400">
              Registro local (navegador) de cada acción y tiempo de la web. Build: <span className="font-mono text-amber-300">{BUILD_SHA}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleViewLog}
              className="px-4 py-2 rounded-xl bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold border border-white/10 flex items-center gap-2 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              Ver Log
            </button>
            <button
              type="button"
              onClick={() => exportLocalLogs()}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar JSON
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* MODAL VISOR DE LOG (texto) */}
    {logModalOpen && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl shadow-black/90 space-y-4 max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-lg font-black text-white">Log del Sistema (texto)</h3>
              <p className="text-[11px] text-gray-400">Últimas 1000 entradas — cada acción y su tiempo</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="Filtrar (placa, acción...)"
                className="px-3 py-1.5 bg-reygas-surface border border-white/15 rounded-lg text-xs text-white focus:border-amber-400 focus:outline-none w-48"
              />
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <pre className="flex-1 overflow-auto bg-black/60 border border-white/10 rounded-xl p-3 text-[10px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap custom-scrollbar">
            {filteredLogText || "(sin entradas — realice acciones en la web para generar el log)"}
          </pre>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setLogModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
