"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAppStore, Certification, WorkOrder } from "@/lib/store/app-store";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  Printer,
  Search,
  AlertCircle,
  User,
  Phone,
  X,
  Calendar as CalendarIcon,
  Edit2,
  Check,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import { saveSupabaseCertification, saveSupabaseWorkOrder } from "@/lib/supabase/services";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Helper to parse dates in format DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, or DD-MM-YYYY
function parseFlexibleDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr === "-" || dateStr === "0" || dateStr.toLowerCase() === "s/n" || dateStr.toLowerCase() === "null") return null;
  const str = dateStr.trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += (year > 70 ? 1900 : 2000);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  } else if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
      } else {
        // DD-MM-YYYY or DD-MM-YY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += (year > 70 ? 1900 : 2000);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }
  return null;
}

export default function CertificacionesPage() {
  const {
    certifications,
    addCertification,
    updateCertificationPrice,
    vehicles,
    workOrders,
    syncFromSupabase,
  } = useAppStore();

  // Always refresh latest data from Supabase on mount
  useEffect(() => {
    syncFromSupabase();
  }, [syncFromSupabase]);

  // Active Filter Tabs
  const [activeTab, setActiveTab] = useState<"hoy" | "pendientes" | "vencidos" | "esta_semana" | "este_mes" | "emitidos" | "todos">("hoy");
  const [queryDate, setQueryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Month & Year Selector for Expiry Lookahead
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Inline Price Editing State { certId: editingPriceString }
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  // Modal State for Official Emission Flow
  const [activeEmitModal, setActiveEmitModal] = useState<{
    isOpen: boolean;
    certification: Certification | null;
    workOrder?: any;
    vehicle?: any;
    chipCode: string;
    cylinderSerial: string;
    certificateNumber: string;
    expiryDate: string;
    notes?: string;
  } | null>(null);

  // Modal State for Creating a Manual Certificate from Scratch
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    vehicle_plate: "",
    client_name: "",
    chip_code: `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
    cylinder_serial: `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
    certification_type: "Certificado Anual GNV" as any,
    price: 80,
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    quinquennial_date: "-",
  });

  // Alert State
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const showAlert = (type: "success" | "warning", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4500);
  };

  // Vehicles Map
  const vehiclesMap = useMemo(() => {
    const map = new Map<string, any>();
    vehicles.forEach((v) => {
      if (v?.plate) map.set(v.plate.toUpperCase().trim(), v);
    });
    return map;
  }, [vehicles]);

  // Combine Certifications from store + All Historical WorkOrders with Chip/Quinquennial data
  const allCards = useMemo(() => {
    const list: Array<{
      id: string;
      certId?: string;
      workOrderId?: string;
      plate: string;
      clientName: string;
      clientPhone?: string;
      certificationType: string;
      price: number;
      status: "Solicitado" | "Vigente" | "Por Vencer" | "Vencido";
      isReady: boolean;
      issueDate: string;
      expiryDate: string; // Fecha de Chip / Anual
      quinquennialDate: string; // Fecha de Quinquenal
      rawCert?: Certification;
      rawOrder?: WorkOrder;
    }> = [];

    const processedPlateSet = new Set<string>();

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const in30Days = new Date(todayStart.getTime() + 30 * 86400000);

    // 1. Explicit certifications in store
    certifications.forEach((c) => {
      const cleanPlate = (c.vehicle_plate || "").toUpperCase().trim();
      const wo = workOrders.find((w) => w.id === c.work_order_id || (w.vehicle_plate && w.vehicle_plate.toUpperCase().trim() === cleanPlate));
      const veh = vehiclesMap.get(cleanPlate);

      // Extract Fecha Anual and Fecha Quinquenal
      let fechaAnual = c.expiry_date || wo?.chip_expiry_date || "-";
      let fechaQuinquenal = c.quinquennial_date || wo?.quinquennial_date || "-";

      if (fechaAnual === "-" && wo?.diagnostic_notes) {
        const match = wo.diagnostic_notes.match(/Chip Anual:\s*([^\s•]+)/i);
        if (match) fechaAnual = match[1];
      }
      if (fechaQuinquenal === "-" && wo?.diagnostic_notes) {
        const match = wo.diagnostic_notes.match(/Quinquenal:\s*([^\s•]+)/i);
        if (match) fechaQuinquenal = match[1];
      }

      const dAnual = parseFlexibleDate(fechaAnual);
      const dQuinquenal = parseFlexibleDate(fechaQuinquenal);

      let cardStatus: "Solicitado" | "Vigente" | "Por Vencer" | "Vencido" = "Vigente";
      if (c.status === "Solicitado" || c.is_ready === false) {
        cardStatus = "Solicitado";
      } else if ((dAnual && dAnual < todayStart) || (dQuinquenal && dQuinquenal < todayStart)) {
        cardStatus = "Vencido";
      } else if ((dAnual && dAnual <= in30Days) || (dQuinquenal && dQuinquenal <= in30Days)) {
        cardStatus = "Por Vencer";
      }

      list.push({
        id: c.id,
        certId: c.id,
        workOrderId: c.work_order_id,
        plate: cleanPlate,
        clientName: c.client_name || veh?.owner_name || "Cliente Taller",
        clientPhone: veh?.owner_phone,
        certificationType: c.certification_type || "Certificado Anual GNV",
        price: typeof c.price === "number" && !isNaN(c.price) ? c.price : 80,
        status: cardStatus,
        isReady: c.is_ready ?? (c.status !== "Solicitado"),
        issueDate: (c.issue_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
        expiryDate: fechaAnual,
        quinquennialDate: fechaQuinquenal,
        rawCert: c,
        rawOrder: wo,
      });

      processedPlateSet.add(cleanPlate);
    });

    // 2. All WorkOrders from CSV / Supabase with Quinquenal or Chip Expiry dates or Certification flag
    workOrders.forEach((wo) => {
      const cleanPlate = (wo.vehicle_plate || "").toUpperCase().trim();
      if (!cleanPlate || processedPlateSet.has(cleanPlate)) return;

      let fechaAnual = wo.chip_expiry_date || "-";
      let fechaQuinquenal = wo.quinquennial_date || "-";

      if (fechaAnual === "-" && wo.diagnostic_notes) {
        const match = wo.diagnostic_notes.match(/Chip Anual:\s*([^\s•]+)/i);
        if (match) fechaAnual = match[1];
      }
      if (fechaQuinquenal === "-" && wo.diagnostic_notes) {
        const match = wo.diagnostic_notes.match(/Quinquenal:\s*([^\s•]+)/i);
        if (match) fechaQuinquenal = match[1];
      }

      // Include if it has chip expiry, quinquennial date, or explicit certification request
      if (fechaAnual !== "-" || fechaQuinquenal !== "-" || wo.requires_certification) {
        const veh = vehiclesMap.get(cleanPlate);
        const dAnual = parseFlexibleDate(fechaAnual);
        const dQuinquenal = parseFlexibleDate(fechaQuinquenal);

        let cardStatus: "Solicitado" | "Vigente" | "Por Vencer" | "Vencido" = "Vigente";
        if (wo.requires_certification && !wo.certification_issued) {
          cardStatus = "Solicitado";
        } else if ((dAnual && dAnual < todayStart) || (dQuinquenal && dQuinquenal < todayStart)) {
          cardStatus = "Vencido";
        } else if ((dAnual && dAnual <= in30Days) || (dQuinquenal && dQuinquenal <= in30Days)) {
          cardStatus = "Por Vencer";
        }

        list.push({
          id: `wo-cert-${wo.id}`,
          workOrderId: wo.id,
          plate: cleanPlate,
          clientName: veh?.owner_name || "Cliente Taller",
          clientPhone: veh?.owner_phone,
          certificationType: wo.certification_type || "Certificado Anual GNV",
          price: wo.certification_price || 80,
          status: cardStatus,
          isReady: !wo.requires_certification || !!wo.certification_issued,
          issueDate: (wo.entry_time || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
          expiryDate: fechaAnual,
          quinquennialDate: fechaQuinquenal,
          rawOrder: wo,
        });

        processedPlateSet.add(cleanPlate);
      }
    });

    return list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [certifications, workOrders, vehiclesMap]);

  // Expiry Date Calculations for Filters (This Week & This Month & Expired)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // Sunday
  currentWeekEnd.setHours(23, 59, 59, 999);

  // Counts
  const counts = useMemo(() => {
    const hoyStr = queryDate || now.toISOString().slice(0, 10);
    let hoy = 0;
    let pendientes = 0;
    let vencidos = 0;
    let estaSemana = 0;
    let esteMes = 0;
    let emitidos = 0;

    allCards.forEach((c) => {
      if (c.issueDate === hoyStr) hoy++;
      if (c.status === "Solicitado" || !c.isReady) pendientes++;
      if (c.status === "Vigente" || c.status === "Por Vencer") emitidos++;

      // Check expiry of Fecha de Chip / Anual or Fecha de Quinquenal
      const dAnual = parseFlexibleDate(c.expiryDate);
      const dQuinquenal = parseFlexibleDate(c.quinquennialDate);

      // Check Expired (< today)
      const isExpired = (dAnual && dAnual < todayStart) || (dQuinquenal && dQuinquenal < todayStart);
      if (isExpired || c.status === "Vencido") {
        vencidos++;
      }

      const checkInWeek = (d: Date | null) => d && d >= currentWeekStart && d <= currentWeekEnd;
      const checkInMonth = (d: Date | null) => d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;

      if (checkInWeek(dAnual) || checkInWeek(dQuinquenal)) {
        estaSemana++;
      }
      if (checkInMonth(dAnual) || checkInMonth(dQuinquenal)) {
        esteMes++;
      }
    });

    return {
      hoy,
      pendientes,
      vencidos,
      estaSemana,
      esteMes,
      emitidos,
      todos: allCards.length,
    };
  }, [allCards, queryDate, selectedMonth, selectedYear, currentWeekStart, currentWeekEnd, todayStart, now]);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return allCards.filter((c) => {
      const dAnual = parseFlexibleDate(c.expiryDate);
      const dQuinquenal = parseFlexibleDate(c.quinquennialDate);

      // 1. Tab Filter
      if (activeTab === "hoy") {
        if (c.issueDate !== queryDate) return false;
      } else if (activeTab === "pendientes") {
        if (c.status !== "Solicitado" && c.isReady) return false;
      } else if (activeTab === "vencidos") {
        const isExpired = (dAnual && dAnual < todayStart) || (dQuinquenal && dQuinquenal < todayStart) || c.status === "Vencido";
        if (!isExpired) return false;
      } else if (activeTab === "esta_semana") {
        const inWeek = (d: Date | null) => d && d >= currentWeekStart && d <= currentWeekEnd;
        if (!inWeek(dAnual) && !inWeek(dQuinquenal)) return false;
      } else if (activeTab === "este_mes") {
        const inMonth = (d: Date | null) => d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        if (!inMonth(dAnual) && !inMonth(dQuinquenal)) return false;
      } else if (activeTab === "emitidos") {
        if (c.status === "Solicitado" || !c.isReady) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase().trim();
        const plate = c.plate.toUpperCase();
        const client = c.clientName.toUpperCase();
        const type = c.certificationType.toUpperCase();
        if (!plate.includes(q) && !client.includes(q) && !type.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allCards, activeTab, queryDate, selectedMonth, selectedYear, currentWeekStart, currentWeekEnd, todayStart, searchQuery]);

  // Handle Save Edited Price in Real Time
  const handleSavePrice = (card: typeof allCards[0]) => {
    const val = editingPrices[card.id];
    if (val === undefined) return;
    const newPrice = parseFloat(val);
    if (isNaN(newPrice) || newPrice < 0) {
      showAlert("warning", "Ingrese un precio numérico válido.");
      return;
    }

    if (card.certId) {
      updateCertificationPrice(card.certId, newPrice);
    } else if (card.rawOrder) {
      // If certification not yet created, update on workOrder
      const updatedWo = { ...card.rawOrder, certification_price: newPrice };
      saveSupabaseWorkOrder(updatedWo);
      useAppStore.setState((state) => ({
        workOrders: state.workOrders.map((wo) => (wo.id === card.rawOrder?.id ? updatedWo : wo)),
      }));
    }

    setEditingPrices((prev) => {
      const next = { ...prev };
      delete next[card.id];
      return next;
    });

    showAlert("success", `¡Precio actualizado a S/ ${newPrice.toFixed(2)} para placa ${card.plate}!`);
  };

  // Open Official Emission Modal
  const handleOpenEmitModal = (card: typeof allCards[0]) => {
    const veh = vehiclesMap.get(card.plate);
    const cert = card.rawCert || {
      id: `cert-${Date.now()}`,
      work_order_id: card.workOrderId,
      vehicle_plate: card.plate,
      client_name: card.clientName,
      chip_code: `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
      cylinder_serial: `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
      certification_type: card.certificationType,
      issue_date: new Date().toISOString().slice(0, 10),
      expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      status: "Solicitado",
      price: card.price,
      is_ready: false,
    };

    setActiveEmitModal({
      isOpen: true,
      certification: cert,
      workOrder: card.rawOrder,
      vehicle: veh,
      chipCode: cert.chip_code || `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
      cylinderSerial: cert.cylinder_serial || `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
      certificateNumber: `CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: cert.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      notes: "Inspección técnica satisfactoria. Cumple normativa MTC / Produce.",
    });
  };

  // Confirm Emission and Broadcast in Real Time
  const handleConfirmEmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmitModal?.certification) return;

    const cert = activeEmitModal.certification;
    const updatedCert: Certification = {
      ...cert,
      chip_code: activeEmitModal.chipCode,
      cylinder_serial: activeEmitModal.cylinderSerial,
      expiry_date: activeEmitModal.expiryDate,
      status: "Vigente",
      is_ready: true,
    };

    saveSupabaseCertification(updatedCert);

    useAppStore.setState((state) => {
      const exists = state.certifications.some((item) => item.id === cert.id);
      const updatedCerts = exists
        ? state.certifications.map((item) => (item.id === cert.id ? updatedCert : item))
        : [updatedCert, ...state.certifications];

      const updatedWorkOrders = state.workOrders.map((wo) => {
        if (wo.id === cert.work_order_id || wo.vehicle_plate === cert.vehicle_plate) {
          const uWo = { ...wo, certification_issued: true, certification_id: cert.id };
          saveSupabaseWorkOrder(uWo);
          return uWo;
        }
        return wo;
      });

      return {
        certifications: updatedCerts,
        workOrders: updatedWorkOrders,
      };
    });

    showAlert(
      "success",
      `¡Certificado emitido para ${cert.vehicle_plate}! Sincronizado en tiempo real con Taller y Caja.`
    );
    setActiveEmitModal(null);
  };

  // Create manual cert
  const handleCreateManualCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.vehicle_plate.trim()) {
      showAlert("warning", "Ingrese una placa válida.");
      return;
    }

    addCertification({
      vehicle_plate: manualForm.vehicle_plate.toUpperCase().trim(),
      client_name: manualForm.client_name.trim() || "Cliente Particular",
      chip_code: manualForm.chip_code,
      cylinder_serial: manualForm.cylinder_serial,
      certification_type: manualForm.certification_type,
      issue_date: manualForm.issue_date,
      expiry_date: manualForm.expiry_date,
      quinquennial_date: manualForm.quinquennial_date,
      price: manualForm.price,
      status: "Vigente",
      is_ready: true,
    });

    showAlert("success", `¡Certificado para ${manualForm.vehicle_plate.toUpperCase()} registrado correctamente!`);
    setIsManualModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all animate-fadeIn ${
            alertMsg.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
              : "bg-amber-950/90 text-amber-300 border border-amber-500/50"
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Certificaciones Vehiculares</h1>
            <p className="text-xs text-gray-400">
              Control en tiempo real de inspecciones, emisión oficial y vencimientos anuales / quinquenales del taller.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsManualModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>+ Emitir Nuevo Certificado Manual</span>
        </button>
      </div>

      {/* Filter Toolbar with Interactive Tabs, Week/Month Filters, and Mini Calendar */}
      <div className="bg-reygas-dark p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Status & Expiry Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-reygas-surface p-1 rounded-xl border border-white/10 text-xs font-bold w-full lg:w-auto">
            {/* 1. Del Día / Hoy */}
            <button
              onClick={() => setActiveTab("hoy")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "hoy"
                  ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-600/30 font-black scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Del Día / Hoy ({counts.hoy})</span>
            </button>

            {/* 2. Pendientes */}
            <button
              onClick={() => setActiveTab("pendientes")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "pendientes"
                  ? "bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes ({counts.pendientes})</span>
            </button>

            {/* 3. Vencidos (NUEVO FILTRO) */}
            <button
              onClick={() => setActiveTab("vencidos")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "vencidos"
                  ? "bg-red-600 text-white font-black shadow-lg shadow-red-600/30 scale-[1.02]"
                  : "text-red-400 hover:text-white hover:bg-red-950/40"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>⚠️ Vencidos ({counts.vencidos})</span>
            </button>

            {/* 4. Vencen Esta Semana */}
            <button
              onClick={() => setActiveTab("esta_semana")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "esta_semana"
                  ? "bg-purple-600 text-white font-black shadow-lg shadow-purple-600/30 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Vencen Esta Semana ({counts.estaSemana})</span>
            </button>

            {/* 5. Vencen Este Mes */}
            <button
              onClick={() => setActiveTab("este_mes")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "este_mes"
                  ? "bg-pink-600 text-white font-black shadow-lg shadow-pink-600/30 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Vencen en el Mes ({counts.esteMes})</span>
            </button>

            {/* 6. Emitidos */}
            <button
              onClick={() => setActiveTab("emitidos")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "emitidos"
                  ? "bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Emitidos ({counts.emitidos})</span>
            </button>

            {/* 7. Todos / Histórico */}
            <button
              onClick={() => setActiveTab("todos")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "todos"
                  ? "bg-blue-600 text-white font-black shadow-lg shadow-blue-600/30 scale-[1.02]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>Todos / Histórico ({counts.todos})</span>
            </button>
          </div>

          {/* Month & Year Selectors (when inspecting monthly expiry) + Mini Calendar & Search */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            {activeTab === "este_mes" && (
              <div className="flex items-center gap-1.5 bg-reygas-surface p-1 rounded-xl border border-white/10 text-xs">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-reygas-dark text-white font-bold px-2 py-1 rounded-lg border border-white/10 focus:border-cyan-400 text-xs"
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
                  className="bg-reygas-dark text-white font-mono font-bold px-2 py-1 rounded-lg border border-white/10 focus:border-cyan-400 text-xs"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === "hoy" && (
              <MiniDatePicker
                value={queryDate}
                onChange={(newDate) => {
                  setQueryDate(newDate);
                  setActiveTab("hoy");
                }}
              />
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar placa, cliente, tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-3 py-1.5 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-cyan-400 font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid Representation */}
      <div className="space-y-4">
        {filteredCards.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-400 space-y-3 rounded-2xl border border-white/10">
            <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">No hay registros de certificaciones que coincidan con los filtros seleccionados.</p>
            {activeTab === "hoy" && (
              <button
                onClick={() => setActiveTab("todos")}
                className="px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-bold rounded-xl border border-cyan-500/30 transition-colors"
              >
                Ver todo el histórico de certificaciones ({counts.todos})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCards.map((card) => {
              const isPending = card.status === "Solicitado" || !card.isReady;
              const isExpired = card.status === "Vencido";
              const isEditingPrice = editingPrices[card.id] !== undefined;

              return (
                <div
                  key={card.id}
                  className={`glass-panel p-5 rounded-2xl border transition-all space-y-4 shadow-xl ${
                    isExpired
                      ? "border-red-500/50 bg-red-950/20 hover:border-red-400"
                      : isPending
                      ? "border-cyan-500/50 bg-cyan-950/20 hover:border-cyan-400"
                      : "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                  }`}
                >
                  {/* Card Header: Plate, Status, Type & Editable Price */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xl text-white bg-reygas-surface px-3 py-0.5 rounded-xl border border-white/10 tracking-wider shadow">
                          {card.plate}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                            isExpired
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : isPending
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                              : card.status === "Por Vencer"
                              ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {isExpired
                            ? "⚠️ Vencido"
                            : isPending
                            ? "⏳ Solicitado por Taller"
                            : card.status === "Por Vencer"
                            ? "⚡ Por Vencer"
                            : "✅ Vigente"}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-cyan-300 flex items-center gap-1.5 pt-0.5">
                        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{card.certificationType}</span>
                      </h3>
                    </div>

                    {/* Editable Price Widget */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                        Monto a Cobrar
                      </span>

                      {isEditingPrice ? (
                        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-amber-400">
                          <span className="text-xs font-bold text-amber-300 pl-1">S/</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            autoFocus
                            value={editingPrices[card.id]}
                            onChange={(e) =>
                              setEditingPrices({ ...editingPrices, [card.id]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice(card);
                              if (e.key === "Escape") {
                                setEditingPrices((prev) => {
                                  const next = { ...prev };
                                  delete next[card.id];
                                  return next;
                                });
                              }
                            }}
                            className="w-16 px-1 py-0.5 bg-reygas-dark text-white font-mono font-bold text-xs rounded border-none focus:outline-none"
                          />
                          <button
                            onClick={() => handleSavePrice(card)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                            title="Guardar monto"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="font-mono font-black text-base text-amber-300 bg-reygas-dark px-2.5 py-1 rounded-xl border border-amber-500/30">
                            S/ {card.price.toFixed(2)}
                          </span>
                          <button
                            onClick={() =>
                              setEditingPrices({ ...editingPrices, [card.id]: card.price.toString() })
                            }
                            className="p-1.5 rounded-lg bg-reygas-surface hover:bg-white/10 text-gray-400 hover:text-amber-400 border border-white/10 transition-colors"
                            title="Editar monto (acuerdos / ofertas)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="bg-reygas-dark/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>Cliente / Propietario:</span>
                    </span>
                    <p className="font-bold text-white text-sm truncate">{card.clientName}</p>
                    {card.clientPhone && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 font-mono pt-0.5">
                        <Phone className="w-3 h-3 text-gray-500" />
                        <span>{card.clientPhone}</span>
                      </p>
                    )}
                  </div>

                  {/* Vencimientos: Fecha de Anual / Chip & Fecha de Quinquenal from Registro Taller */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fecha de Anual / Chip */}
                    <div className="p-3 bg-reygas-dark/90 rounded-xl border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3 text-cyan-400" />
                          <span>Fecha Chip / Anual:</span>
                        </span>
                      </div>
                      <p className="font-mono font-black text-sm text-cyan-300">
                        {card.expiryDate || "-"}
                      </p>
                    </div>

                    {/* Fecha de Quinquenal */}
                    <div className="p-3 bg-reygas-dark/90 rounded-xl border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-400" />
                          <span>Fecha de Quinquenal:</span>
                        </span>
                      </div>
                      <p className="font-mono font-black text-sm text-purple-300">
                        {card.quinquennialDate || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <span className="text-[11px] text-gray-400 font-semibold">
                      {isPending
                        ? "⚠️ Requiere emisión oficial"
                        : isExpired
                        ? "⚠️ Inspección reglamentaria vencida"
                        : "📜 Certificado emitido y vigente"}
                    </span>

                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <button
                          onClick={() => handleOpenEmitModal(card)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-transform hover:scale-105"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Emitir & Notificar Listo a Caja</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 bg-reygas-surface hover:bg-white/10 text-gray-200 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Imprimir Ficha</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: EMIT OFFICIAL CERTIFICATE */}
      {activeEmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-reygas-dark border border-cyan-500/50 max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Emitir Certificado Oficial de Inspección</h3>
                  <p className="text-xs text-gray-400">
                    Vehículo: <strong className="text-white font-mono">{activeEmitModal.certification?.vehicle_plate}</strong> • {activeEmitModal.certification?.certification_type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveEmitModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEmission} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Código Chip de Carga *</label>
                  <input
                    type="text"
                    required
                    value={activeEmitModal.chipCode}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, chipCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Serie Cilindro Gas *</label>
                  <input
                    type="text"
                    required
                    value={activeEmitModal.cylinderSerial}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, cylinderSerial: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">N° de Certificado Oficial</label>
                  <input
                    type="text"
                    value={activeEmitModal.certificateNumber}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, certificateNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Vencimiento Anual</label>
                  <input
                    type="date"
                    value={activeEmitModal.expiryDate}
                    onChange={(e) => setActiveEmitModal({ ...activeEmitModal, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">Observaciones Técnicas del Certificador</label>
                <textarea
                  rows={2}
                  value={activeEmitModal.notes}
                  onChange={(e) => setActiveEmitModal({ ...activeEmitModal, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white focus:border-cyan-400"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Al emitir, la orden de trabajo en Taller se marcará como lista y se habilitará el comprobante en Caja.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveEmitModal(null)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmar & Emitir Certificado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL CERTIFICATE CREATION */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-reygas-dark border border-teal-500/50 max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Emitir Nueva Certificación Particular</h3>
                  <p className="text-xs text-gray-400">Ingreso manual de inspección vehicular reglamentaria</p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCert} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Placa Vehicular *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ABC-123"
                    value={manualForm.vehicle_plate}
                    onChange={(e) => setManualForm({ ...manualForm, vehicle_plate: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold uppercase focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Tipo de Certificación *</label>
                  <select
                    value={manualForm.certification_type}
                    onChange={(e) => setManualForm({ ...manualForm, certification_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-bold focus:border-teal-400"
                  >
                    <option value="Certificado Anual GNV">Certificado Anual GNV (S/ 80.00)</option>
                    <option value="Certificado Anual GLP">Certificado Anual GLP (S/ 80.00)</option>
                    <option value="Prueba Hidrostática de Cilindro GNV">Prueba Hidrostática (5 Años) (S/ 180.00)</option>
                    <option value="Desbloqueo de Chip GNV">Desbloqueo de Chip (S/ 25.00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Propietario / Cliente</label>
                  <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={manualForm.client_name}
                    onChange={(e) => setManualForm({ ...manualForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Precio Cobrado (S/) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono font-bold focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Anual (Vencimiento)</label>
                  <input
                    type="date"
                    value={manualForm.expiry_date}
                    onChange={(e) => setManualForm({ ...manualForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Fecha de Quinquenal</label>
                  <input
                    type="text"
                    placeholder="Ej. 12/08/2026"
                    value={manualForm.quinquennial_date}
                    onChange={(e) => setManualForm({ ...manualForm, quinquennial_date: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-white font-mono focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-black rounded-xl shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Certificado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
