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
  ExternalLink
} from "lucide-react";

export default function ConfiguracionPage() {
  const { aiSettings, updateAISettings } = useAppStore();

  const [formData, setFormData] = useState({
    apiKey: aiSettings?.apiKey || "",
    provider: aiSettings?.provider || "openai",
    model: aiSettings?.model || "gpt-4o-mini",
    customEndpoint: aiSettings?.customEndpoint || "",
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
      // Test call to our OCR API route with a dummy 1px image
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Configuración del Sistema & API de IA</h1>
            <p className="text-xs text-gray-400">
              Administración de llaves API para Inteligencia Artificial Vision OCR y procesamiento de imágenes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Persistencia Local & Cloud
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

      {/* Main Settings Form */}
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
            <p className="text-[11px] text-gray-400 mt-1.5">
              Esta clave se utiliza para procesar las capturas de cámara e imágenes de placas en la Garita de Portería. Se guarda de forma local en su navegador.
            </p>
          </div>

          {formData.provider === "custom" && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Endpoint Custom URL (Opcional)
              </label>
              <input
                type="text"
                placeholder="https://api.tudominio.com/ocr"
                value={formData.customEndpoint}
                onChange={(e) => setFormData({ ...formData, customEndpoint: e.target.value })}
                className="w-full px-4 py-3 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-reygas-red"
              />
            </div>
          )}

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

      {/* Guidance Box */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>¿Cómo obtener una API Key para el Escáner de Portería?</span>
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Si deseas que el botón <strong>"Escaneo OCR Cámara"</strong> de Portería se conecte directamente con la Inteligencia Artificial de OpenAI o Gemini, puedes obtener una clave en sus plataformas oficiales. De lo contrario, el sistema utilizará el motor de reconocimiento local y heurístico de ReyGas para simular la extracción instantánea de datos.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-xs font-bold text-reygas-red">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:underline"
          >
            <span>Obtener Key en OpenAI</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:underline text-amber-400"
          >
            <span>Obtener Key en Google AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
