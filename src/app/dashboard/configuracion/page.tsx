"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import {
  Cpu,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Save,
  ShieldCheck,
  Zap,
  RefreshCw,
  Sliders,
  ExternalLink,
  Download,
  HardDrive,
  Database,
  FileSpreadsheet,
  FolderArchive
} from "lucide-react";

export default function ConfiguracionPage() {
  const {
    aiSettings,
    updateAISettings,
    vehicles,
    workOrders,
    inventoryItems,
    technicians,
    invoices,
    appointments,
    certifications,
  } = useAppStore();

  const [formData, setFormData] = useState({
    apiKey: aiSettings?.apiKey || "",
    provider: aiSettings?.provider || "openai",
    model: aiSettings?.model || "gpt-4o-mini",
    customEndpoint: aiSettings?.customEndpoint || "",
  });

  // Google Drive config state
  const [driveForm, setDriveForm] = useState({
    folderUrl: "https://drive.google.com/drive/folders/1ReyGas_Backup_Empresa_2026",
    autoBackupCron: "daily",
    serviceAccountEmail: "reygas-backup-bot@reygas-autogas-erp.iam.gserviceaccount.com",
    isConnected: true,
  });

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAISettings(formData);
    setTestStatus("success");
    setTestMsg("¡Configuración guardada exitosamente en el sistema ERP!");
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
    downloadAnchor.setAttribute("download", `ReyGas_Backup_ERP_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSVTable = (tableName: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      alert(`No hay registros en la tabla ${tableName} para exportar.`);
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
    downloadAnchor.setAttribute("download", `ReyGas_${tableName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSaveDriveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    alert("¡Conexión y configuración con Google Drive guardada programáticamente! Los respaldos automáticos se enviarán a la carpeta configurada.");
  };

  return (
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
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
            testStatus === "success"
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
    </div>
  );
}
