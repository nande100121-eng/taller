"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ReyGasLogo } from "@/components/brand/logo";
import { useAppStore, generateDefaultUsername } from "@/lib/store/app-store";
import {
  KeyRound,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { technicians, changeTechnicianPassword } = useAppStore();

  const queryUser = searchParams.get("u") || searchParams.get("user") || searchParams.get("email") || "";

  const [username, setUsername] = useState(queryUser);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ full_name: string; username: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (queryUser && !username) {
      setUsername(queryUser);
    }
  }, [queryUser, username]);

  // Find technician if prefilled to display their friendly name
  const matchedTech = technicians.find(
    (t) =>
      (t.username && t.username.toLowerCase() === username.trim().toLowerCase()) ||
      (t.email && t.email.toLowerCase() === username.trim().toLowerCase()) ||
      (generateDefaultUsername(t.full_name).toLowerCase() === username.trim().toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim()) {
      setErrorMsg("Por favor ingrese su usuario o correo electrónico.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden. Por favor verifíquelas.");
      return;
    }

    setIsSubmitting(true);
    const result = changeTechnicianPassword(username.trim(), newPassword.trim());

    if (result.success && result.technician) {
      setSuccessData({
        full_name: result.technician.full_name,
        username: result.technician.username || generateDefaultUsername(result.technician.full_name),
      });
      setErrorMsg("");
    } else {
      setErrorMsg(result.message || "No se pudo actualizar la contraseña. Verifique su usuario.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-1">
          <ReyGasLogo size="lg" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Seguridad de Acceso ERP</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Establecer Nueva Contraseña</h1>
        <p className="text-xs text-gray-400 leading-relaxed">
          Cree una contraseña segura para acceder a las estaciones autorizadas del taller.
        </p>
      </div>

      {/* Success State Screen */}
      {successData ? (
        <div className="space-y-6 animate-fadeIn text-center">
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white">¡Contraseña Actualizada!</h2>
            <p className="text-xs text-gray-300">
              Hola <strong className="text-white">{successData.full_name}</strong>, tu contraseña de acceso para el usuario{" "}
              <strong className="text-indigo-300 font-mono">@{successData.username}</strong> ha sido guardada correctamente en la nube.
            </p>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Ir al Inicio de Sesión ERP</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Password Reset Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2 font-bold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* User Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Usuario de Acceso o Correo *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Ej: malvarado o correo@reygas.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
              />
            </div>
            {matchedTech && (
              <span className="text-[11px] text-indigo-300 font-medium block mt-1">
                👤 Colaborador detectado: <strong>{matchedTech.full_name}</strong> ({matchedTech.specialty})
              </span>
            )}
          </div>

          {/* New Password Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPass ? "text" : "password"}
                required
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPass ? "text" : "password"}
                required
                placeholder="Repita la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Match validation badge */}
          {newPassword && confirmPassword && (
            <div
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                newPassword === confirmPassword
                  ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                  : "bg-amber-950/40 border border-amber-500/30 text-amber-300"
              }`}
            >
              {newPassword === confirmPassword ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Las contraseñas coinciden correctamente.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Las contraseñas aún no coinciden.</span>
                </>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 mt-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Guardar Nueva Contraseña</span>
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs text-gray-400 hover:text-white underline transition-colors"
            >
              Volver al Inicio de Sesión
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CambiarClavePage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="p-8 glass-panel rounded-3xl border border-white/10 text-white text-center text-xs">
            Cargando portal de seguridad...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
