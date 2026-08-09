"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ReyGasLogo } from "@/components/brand/logo";
import { useAppStore } from "@/lib/store/app-store";
import { Lock, Mail, KeyRound, ShieldCheck, ArrowRight, UserCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAppStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email, password);
    if (success) {
      if (email.includes("admin")) {
        router.push("/dashboard/admin/cms");
      } else {
        router.push("/dashboard/porteria");
      }
    } else {
      setErrorMsg("Credenciales no válidas. Por favor verifique.");
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    login(roleEmail, "123456");
    if (roleEmail.includes("admin")) {
      router.push("/dashboard/admin/cms");
    } else {
      router.push("/dashboard/porteria");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <ReyGasLogo size="lg" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Acceso a Estaciones ERP</h1>
          <p className="text-xs text-gray-400">
            Portal privado para personal del taller y administrador.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Correo Electrónico / Usuario
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="usuario@reygas.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-reygas-red"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Contraseña</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-reygas-red"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-reygas-red/30 flex items-center justify-center gap-2"
          >
            <span>Iniciar Sesión en ERP</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="pt-6 border-t border-white/10 space-y-3">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block text-center">
            Acceso Rápido de Prueba (1-Clic)
          </span>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleQuickLogin("admin@reygas.com")}
              className="w-full py-2 px-3 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-reygas-red" />
                <span>Ingresar como Administrador</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">admin@reygas.com</span>
            </button>

            <button
              onClick={() => handleQuickLogin("personal@reygas.com")}
              className="w-full py-2 px-3 bg-reygas-surface hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Ingresar como Personal Taller</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">personal@reygas.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
