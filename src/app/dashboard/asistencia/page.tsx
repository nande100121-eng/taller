"use client";

import React from "react";
import { useAppStore } from "@/lib/store/app-store";
import { Clock, UploadCloud, UserCheck, Inbox } from "lucide-react";

export default function AsistenciaPage() {
  const { attendanceLogs } = useAppStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Procesador de Asistencia Biométrica</h1>
            <p className="text-xs text-gray-400">
              Importación de registros de huella/reloj checador en formato TXT / DAT / CSV.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* File Importer */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <UploadCloud className="w-5 h-5 text-cyan-400" />
            <span>Cargar Archivo de Marcaciones</span>
          </h2>

          <div className="border-2 border-dashed border-cyan-500/40 p-8 rounded-2xl text-center space-y-3 bg-cyan-950/10">
            <UploadCloud className="w-12 h-12 text-cyan-400 mx-auto" />
            <div>
              <span className="font-bold text-white text-sm block">Sube el archivo TXT/DAT con las marcaciones</span>
              <span className="text-xs text-gray-400">Archivos soportados: ZKSoftware, Anviz, Dahua</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 text-center">
            Los registros se cargan directo a la nube (Supabase) y se sincronizan en tiempo real en todos los dispositivos.
          </p>
        </div>

        {/* Logs Table */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <span>Registros de Asistencia Procesados</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-reygas-dark text-xs uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="p-3">Personal / Empleado</th>
                  <th className="p-3">Fecha y Hora de Marca</th>
                  <th className="p-3">Tipo de Registro</th>
                  <th className="p-3">Origen Archivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-10 text-center">
                      <Inbox className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-400">Sin registros de asistencia</p>
                      <p className="text-xs text-gray-500 mt-1">
                        No hay marcaciones cargadas. La tabla solo muestra datos reales de la nube.
                      </p>
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-cyan-400" />
                        {log.employee_name}
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-300">{log.check_time}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {log.log_type}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-500 font-mono">
                        {log.source_file || "BIOMETRICO.TXT"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
