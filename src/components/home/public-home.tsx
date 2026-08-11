"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAppStore } from "@/lib/store/app-store";
import { ReyGasLogo } from "@/components/brand/logo";
import { EditableText } from "@/components/cms/editable-element";
import {
  Flame,
  Zap,
  Calculator,
  Calendar,
  Wrench,
  ShieldCheck,
  Edit3,
  CheckCircle,
  PhoneCall,
  DollarSign,
  ArrowRight,
  TrendingDown,
  X,
  Plus,
  Trash2,
  Palette,
  Phone,
  Mail,
  MapPin,
  Clock,
  Save,
  CheckCircle2,
  Lock,
  Cpu,
  Gauge,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Navigation
} from "lucide-react";

interface PublicHomeProps {
  forceEditing?: boolean;
}

export function PublicHome({ forceEditing = false }: PublicHomeProps) {
  const [mounted, setMounted] = useState(false);

  const {
    siteContent,
    updateSiteContent,
    updateTheme,
    syncFromSupabase,
    isAuthenticated,
    userRole,
    isVisualEditing,
    addAppointment,
  } = useAppStore();

  useEffect(() => {
    setMounted(true);
    syncFromSupabase();

    // Re-sync on window focus & every 10 seconds for real-time cross-device updates
    const handleFocus = () => syncFromSupabase();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 10000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  const { theme, navbar, hero, metrics, calculator, services_header, about, location_map, contact, booking_modal, footer, services, gallery } = siteContent;

  // Editing is STRICTLY enabled only inside the Admin CMS Station (/dashboard/admin/cms) where forceEditing is true
  const isEditing = forceEditing === true;

  // Fallbacks for nested objects
  const safeMetrics = metrics || {
    card1_value: "Hasta 65%",
    card1_label: "Ahorro en GNV vs Gasolina",
    card2_label: "Experiencia Técnica",
    card3_label: "Vehículos Convertidos",
    card4_value: "100%",
    card4_label: "Garantía Certificada MTC",
  };

  const safeCalc = calculator || {
    badge_text: "Calculadora de Economía Automotriz",
    title: "¿Cuánto Dinero Dejas de Gastar al Mes?",
    subtitle: "Simule su ahorro estimado utilizando las tarifas oficiales actualizadas de combustible.",
    km_slider_title: "Kilómetros recorridos al mes:",
    km_label_min: "500 KM (Particular)",
    km_label_mid: "4,000 KM (Taxi/App)",
    km_label_max: "8,000 KM (Ruta)",
    gnv_badge_text: "Opción GNV (Máximo Ahorro)",
    gnv_monthly_label: "Ahorro Estimado Mensual",
    gnv_annual_label: "Ahorro Anual:",
    gnv_btn_text: "Reservar GNV",
    glp_badge_text: "Opción GLP (Mayor Autonomía)",
    glp_monthly_label: "Ahorro Estimado Mensual",
    glp_annual_label: "Ahorro Anual:",
    glp_btn_text: "Reservar GLP",
    gasoline_price_gal: 19.5,
    gnv_price_m3: 1.45,
    glp_price_gal: 7.5,
    efficiency_km_gal: 40,
  };

  const safeServicesHeader = services_header || {
    title: "Nuestros Servicios Especializados",
    subtitle: "Soluciones integrales de inyección de gas, mantenimiento preventivo y certificaciones oficiales.",
  };

  const safeAbout = about || {
    badge_text: "Garantía & Confianza Automotriz",
    title: "Más de 15 años liderando el mercado automotriz en conversiones a gas",
    description: "En REYGAS AUTOGAS EQUIPMENT contamos con técnicos certificados, escáneres multimarca y bancos de prueba de inyectores para garantizar máxima potencia y ahorro de hasta 65% en combustible.",
    experience_years: 15,
    conversions_count: 8500,
    image_url: "https://lh3.googleusercontent.com/gps-cs-s/AB5981M3d5t7ZtWfG1vRk5yE7G2yB0p1V3q6r9t2M4l3N0k5s6v8-a=w1000",
    gallery_images: [
      "https://lh3.googleusercontent.com/gps-cs-s/AB5981M3d5t7ZtWfG1vRk5yE7G2yB0p1V3q6r9t2M4l3N0k5s6v8-a=w1000",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=1000&q=80",
    ],
  };

  const carouselImages = safeAbout.gallery_images && safeAbout.gallery_images.length > 0
    ? safeAbout.gallery_images
    : [safeAbout.image_url];

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const safeLocationMap = location_map || {
    badge_text: "Ubicación & Cobertura",
    title: "Encuentra Nuestro Taller Autorizado",
    subtitle: "Visítanos en nuestra sede principal con amplio estacionamiento y atención inmediata.",
    address_display: "Av. San Martín N° 279 - Santa María",
    city_district: "Huacho - Lima, Perú",
    schedule_display: "Lunes a Sábado: 8:00 AM - 6:30 PM",
    phone_display: "+51 987 654 321 / WhatsApp Directo",
    map_embed_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3921.282875142145!2d-77.6049!3d-11.1072!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTHCsDA2JzI1LjkiUyA3N8KwMzYnMTcuNiJX!5e0!3m2!1ses!2spe!4v1620000000000!5m2!1ses!2spe",
    btn_directions_text: "Abrir Ubicación en Google Maps",
    google_maps_link: "https://maps.google.com",
  };

  const safeBookingModal = booking_modal || {
    title: "Reservar Cita Online",
    subtitle: "Complete el formulario y nuestro equipo alistará su recepción.",
    client_name_label: "Nombre Completo del Propietario *",
    phone_label: "Teléfono WhatsApp *",
    plate_label: "Placa Vehículo *",
    service_label: "Tipo de Servicio Solicitado",
    date_label: "Fecha y Hora Preferida",
    btn_submit_text: "Confirmar Reserva de Cita",
  };

  const safeFooter = footer || {
    brand_description: "Taller de precisión especializado en conversión y mantenimiento de equipos automotrices a GNV y GLP de 5ta Generación.",
    certification_label: "Certificación Oficial MTC / Produce",
    title_services: "SERVICIOS DESTACADOS",
    title_contact: "CONTACTO TALLER",
    title_modules: "MÓDULOS DEL TALLER",
    show_services_col: true,
    show_contact_col: true,
    show_modules_col: true,
    featured_services: [
      "Conversiones GNV 5ta Generación",
      "Conversiones GLP 5ta Generación",
      "Mantenimiento de Inyectores & Reductores",
      "Certificación Anual & Prueba Hidrostática",
    ],
    modules: [
      "Portería & Semáforo",
      "Recepción & Citas",
      "Taller Kanban",
      "Almacén & Insumos",
      "Caja & Facturación",
      "Certificaciones",
    ],
    custom_columns: [],
    copyright_text: "Todos los derechos reservados.",
    tagline: "Sistema Dinámico ERP & CMS Automotriz",
  };

  // Calculator user inputs
  const [monthlyKm, setMonthlyKm] = useState<number>(2000);

  // Online booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState("");
  const [bookingForm, setBookingForm] = useState({
    client_name: "",
    client_phone: "",
    plate: "",
    service_type: "Conversión a GNV 5ta Gen",
    scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    notes: "",
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  // Icon selector state for services
  const [editingIconId, setEditingIconId] = useState<string | null>(null);

  // Savings calculation
  const gallonsNeeded = monthlyKm / (safeCalc.efficiency_km_gal || 40);
  const costGasoline = gallonsNeeded * safeCalc.gasoline_price_gal;
  const costGNV = (gallonsNeeded * 3.785) * safeCalc.gnv_price_m3;
  const costGLP = gallonsNeeded * safeCalc.glp_price_gal;

  const monthlySavingsGNV = Math.max(0, costGasoline - costGNV);
  const annualSavingsGNV = monthlySavingsGNV * 12;

  const monthlySavingsGLP = Math.max(0, costGasoline - costGLP);
  const annualSavingsGLP = monthlySavingsGLP * 12;

  const showSaveSuccess = () => {
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  // Carousel Next/Prev
  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
  };

  // Carousel Add Image Modal state
  const [isAddCarouselModalOpen, setIsAddCarouselModalOpen] = useState(false);
  const [newCarouselUrlInput, setNewCarouselUrlInput] = useState("");

  const handleAddCarouselImage = () => {
    setNewCarouselUrlInput("");
    setIsAddCarouselModalOpen(true);
  };

  const handleConfirmAddCarouselImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarouselUrlInput.trim()) return;

    const updated = [...carouselImages, newCarouselUrlInput.trim()];
    updateSiteContent("about", { gallery_images: updated, image_url: updated[0] });
    setCurrentSlideIndex(updated.length - 1);
    setIsAddCarouselModalOpen(false);
    setNewCarouselUrlInput("");
    showSaveSuccess();
  };

  const handleDeleteCarouselImage = (index: number) => {
    if (carouselImages.length <= 1) {
      alert("Debes mantener al menos 1 imagen en el carrusel del taller.");
      return;
    }
    if (confirm("¿Estás seguro de eliminar esta imagen del carrusel?")) {
      const updated = carouselImages.filter((_, i) => i !== index);
      updateSiteContent("about", { gallery_images: updated, image_url: updated[0] });
      setCurrentSlideIndex(0);
      showSaveSuccess();
    }
  };

  const handleAddServiceCard = () => {
    const newService = {
      id: `serv-${Date.now()}`,
      title: "Nuevo Servicio Automotriz",
      description: "Descripción detallada de la nueva prestación o servicio del taller.",
      price: 150,
      icon: "Wrench",
    };
    const updated = [...services, newService];
    updateSiteContent("services", updated);
    showSaveSuccess();
  };

  const handleDeleteServiceCard = (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta tarjeta de servicio?")) {
      const updated = services.filter((s) => s.id !== id);
      updateSiteContent("services", updated);
      showSaveSuccess();
    }
  };

  const handleAddFeaturedServiceFooter = () => {
    const updated = [...(safeFooter.featured_services || []), "Nuevo Servicio Destacado"];
    updateSiteContent("footer", { featured_services: updated });
    showSaveSuccess();
  };

  const handleDeleteFeaturedServiceFooter = (index: number) => {
    const updated = (safeFooter.featured_services || []).filter((_, i) => i !== index);
    updateSiteContent("footer", { featured_services: updated });
    showSaveSuccess();
  };

  const handleAddModuleFooter = () => {
    const updated = [...(safeFooter.modules || []), "Nuevo Módulo Taller"];
    updateSiteContent("footer", { modules: updated });
    showSaveSuccess();
  };

  const handleDeleteModuleFooter = (index: number) => {
    const updated = (safeFooter.modules || []).filter((_, i) => i !== index);
    updateSiteContent("footer", { modules: updated });
    showSaveSuccess();
  };

  // Custom Column Management
  const handleAddCustomColumnFooter = () => {
    const newCol = {
      id: `col-${Date.now()}`,
      title: "NUEVA SECCIÓN TALLER",
      items: ["Primer Ítem de Sección", "Segundo Ítem de Sección"],
    };
    const updatedCols = [...(safeFooter.custom_columns || []), newCol];
    updateSiteContent("footer", { custom_columns: updatedCols });
    showSaveSuccess();
  };

  const handleDeleteCustomColumnFooter = (colId: string) => {
    if (confirm("¿Estás seguro de eliminar esta sección de columna completa?")) {
      const updatedCols = (safeFooter.custom_columns || []).filter((c) => c.id !== colId);
      updateSiteContent("footer", { custom_columns: updatedCols });
      showSaveSuccess();
    }
  };

  const handleAddCustomItemToCol = (colId: string) => {
    const updatedCols = (safeFooter.custom_columns || []).map((col) => {
      if (col.id === colId) {
        return { ...col, items: [...col.items, "Nuevo Ítem Personalizado"] };
      }
      return col;
    });
    updateSiteContent("footer", { custom_columns: updatedCols });
    showSaveSuccess();
  };

  const handleDeleteCustomItemFromCol = (colId: string, itemIdx: number) => {
    const updatedCols = (safeFooter.custom_columns || []).map((col) => {
      if (col.id === colId) {
        return { ...col, items: col.items.filter((_, i) => i !== itemIdx) };
      }
      return col;
    });
    updateSiteContent("footer", { custom_columns: updatedCols });
    showSaveSuccess();
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAppointment({
      client_name: bookingForm.client_name,
      client_phone: bookingForm.client_phone,
      plate: bookingForm.plate.toUpperCase(),
      service_type: bookingForm.service_type,
      scheduled_date: bookingForm.scheduled_date,
      notes: bookingForm.notes,
    });
    setBookingSuccess(true);
    setTimeout(() => {
      setBookingSuccess(false);
      setBookingOpen(false);
    }, 2000);
  };

  const renderServiceIcon = (iconName: string) => {
    switch (iconName) {
      case "Flame":
        return <Flame className="w-6 h-6 text-reygas-red" />;
      case "Zap":
        return <Zap className="w-6 h-6 text-amber-400" />;
      case "Wrench":
        return <Wrench className="w-6 h-6 text-blue-400" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-6 h-6 text-emerald-400" />;
      case "Cpu":
        return <Cpu className="w-6 h-6 text-purple-400" />;
      case "Gauge":
        return <Gauge className="w-6 h-6 text-cyan-400" />;
      default:
        return <Flame className="w-6 h-6 text-reygas-red" />;
    }
  };

  return (
    <div className="relative space-y-16 pb-20">
      {/* Dynamic Theme Styles */}
      {mounted && (
        <style jsx global>{`
          :root {
            --reygas-red: ${theme.primary_color};
            --reygas-dark: ${theme.background_color};
            --reygas-card: ${theme.card_color};
          }
        `}</style>
      )}

      {/* Floating Save Notification Badge */}
      {savedBadge && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>¡Elemento editado y guardado en Supabase!</span>
        </div>
      )}

      {/* ADMIN FLOATING MODAL EDIT BUTTON TRIGGER */}
      {isEditing && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setBookingOpen(true)}
            className="px-5 py-3 bg-reygas-red hover:bg-reygas-redDark text-white font-extrabold text-xs rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Calendar className="w-4 h-4" />
            <span>✏️ Editar Textos de la Ventana Flotante de Reserva</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. HERO SECTION - EXACT PUBLIC RENDER WITH 100% INLINE EDITING */}
      {/* ========================================================================= */}
      <section className="relative min-h-[80vh] flex items-center justify-center pt-8 pb-12 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-reygas-dark via-reygas-dark/95 to-reygas-dark z-0" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-reygas-red/20 blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Main Logo Emblem (100% Editable Logo Image & Text) */}
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-reygas-dark/80 rounded-full border-2 border-reygas-red/50 shadow-2xl shadow-reygas-red/30 backdrop-blur-md">
              <ReyGasLogo size="xl" showText={false} isEditingEnabled={isEditing} />
            </div>
          </div>

          {/* Badge */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-reygas-surface border border-reygas-red/40 text-reygas-red text-xs font-extrabold uppercase tracking-widest">
              <Flame className="w-4 h-4" />
              <EditableText
                value={hero.badge_text || "EQUIPOS DE 5TA GENERACIÓN CERTIFICADOS"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("hero", { badge_text: val });
                  showSaveSuccess();
                }}
              />
            </div>
          </div>

          {/* Hero Title */}
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
            <EditableText
              value={hero.title || "Especialistas en Conversión y Mantenimiento GNV / GLP"}
              isEditingEnabled={isEditing}
              multiline
              onSave={(val) => {
                updateSiteContent("hero", { title: val });
                showSaveSuccess();
              }}
            />
          </h1>

          {/* Hero Subtitle */}
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto font-normal leading-relaxed">
            <EditableText
              value={hero.subtitle}
              isEditingEnabled={isEditing}
              multiline
              onSave={(val) => {
                updateSiteContent("hero", { subtitle: val });
                showSaveSuccess();
              }}
            />
          </p>

          {/* Hero Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                if (!isEditing) {
                  setBookingService("Conversión a GNV 5ta Gen");
                  setBookingOpen(true);
                }
              }}
              className="w-full sm:w-auto px-8 py-4 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl shadow-xl shadow-reygas-red/40 flex items-center justify-center gap-3 transition-transform hover:scale-105"
            >
              <Calendar className="w-5 h-5 shrink-0" />
              <EditableText
                value={hero.btn_primary_text || "Reservar Cita de Conversión"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("hero", { btn_primary_text: val });
                  showSaveSuccess();
                }}
              />
            </button>
            <a
              href="#calculadora"
              className="w-full sm:w-auto px-8 py-4 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl border border-white/10 flex items-center justify-center gap-3 transition-colors"
            >
              <Calculator className="w-5 h-5 text-reygas-red shrink-0" />
              <EditableText
                value={hero.btn_secondary_text || "Calcular Mi Ahorro Mensual"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("hero", { btn_secondary_text: val });
                  showSaveSuccess();
                }}
              />
            </a>
          </div>

          {/* 100% EDITABLE METRIC CARDS (CARD 1, CARD 2, CARD 3, CARD 4) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-10">
            {/* Card 1 */}
            <div className="glass-card p-4 rounded-xl text-center border border-white/10 hover:border-reygas-red/50 transition-all">
              <span className="text-3xl font-black text-reygas-red block">
                <EditableText
                  value={safeMetrics.card1_value || "Hasta 65%"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card1_value: val });
                    showSaveSuccess();
                  }}
                />
              </span>
              <p className="text-xs text-gray-400 font-medium mt-1">
                <EditableText
                  value={safeMetrics.card1_label || "Ahorro en GNV vs Gasolina"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card1_label: val });
                    showSaveSuccess();
                  }}
                />
              </p>
            </div>

            {/* Card 2 */}
            <div className="glass-card p-4 rounded-xl text-center border border-white/10 hover:border-amber-500/50 transition-all">
              <span className="text-3xl font-black text-amber-400 flex items-center justify-center gap-1">
                <span>+</span>
                <EditableText
                  value={safeAbout.experience_years}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("about", { experience_years: Number(val) });
                    showSaveSuccess();
                  }}
                />
              </span>
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Años</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                <EditableText
                  value={safeMetrics.card2_label || "Experiencia Técnica"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card2_label: val });
                    showSaveSuccess();
                  }}
                />
              </p>
            </div>

            {/* Card 3 */}
            <div className="glass-card p-4 rounded-xl text-center border border-white/10 hover:border-white/40 transition-all">
              <span className="text-3xl font-black text-white flex items-center justify-center gap-1">
                <EditableText
                  value={safeAbout.conversions_count || 8500}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("about", { conversions_count: Number(val) });
                    showSaveSuccess();
                  }}
                />
                <span>+</span>
              </span>
              <p className="text-xs text-gray-400 font-medium mt-1">
                <EditableText
                  value={safeMetrics.card3_label || "Vehículos Convertidos"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card3_label: val });
                    showSaveSuccess();
                  }}
                />
              </p>
            </div>

            {/* Card 4 */}
            <div className="glass-card p-4 rounded-xl text-center border border-white/10 hover:border-emerald-500/50 transition-all">
              <span className="text-3xl font-black text-emerald-400 block">
                <EditableText
                  value={safeMetrics.card4_value || "100%"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card4_value: val });
                    showSaveSuccess();
                  }}
                />
              </span>
              <p className="text-xs text-gray-400 font-medium mt-1">
                <EditableText
                  value={safeMetrics.card4_label || "Garantía Certificada MTC"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("metrics", { card4_label: val });
                    showSaveSuccess();
                  }}
                />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CALCULATOR SECTION WITH 100% EDITABLE CARDS & KM LABELS */}
      {/* ========================================================================= */}
      <section id="calculadora" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
            {/* EDITABLE CALCULATOR BADGE */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-reygas-red/20 text-reygas-red text-xs font-bold uppercase border border-reygas-red/40">
              <Calculator className="w-4 h-4" />
              <EditableText
                value={safeCalc.badge_text || "Calculadora de Economía Automotriz"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("calculator", { badge_text: val });
                  showSaveSuccess();
                }}
              />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              <EditableText
                value={safeCalc.title || "¿Cuánto Dinero Dejas de Gastar al Mes?"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("calculator", { title: val });
                  showSaveSuccess();
                }}
              />
            </h2>
            <p className="text-gray-400 text-sm">
              <EditableText
                value={safeCalc.subtitle}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("calculator", { subtitle: val });
                  showSaveSuccess();
                }}
              />
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Input Slider */}
            <div className="lg:col-span-5 space-y-6 bg-reygas-dark/80 p-6 rounded-2xl border border-white/5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-gray-300">
                    <EditableText
                      value={safeCalc.km_slider_title || "Kilómetros recorridos al mes:"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { km_slider_title: val });
                        showSaveSuccess();
                      }}
                    />
                  </label>
                  <span className="text-xl font-black text-reygas-red">
                    {monthlyKm.toLocaleString()} KM
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="8000"
                  step="250"
                  value={monthlyKm}
                  onChange={(e) => setMonthlyKm(Number(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-reygas-red"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>
                    <EditableText
                      value={safeCalc.km_label_min || "500 KM (Particular)"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { km_label_min: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <span>
                    <EditableText
                      value={safeCalc.km_label_mid || "4,000 KM (Taxi/App)"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { km_label_mid: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <span>
                    <EditableText
                      value={safeCalc.km_label_max || "8,000 KM (Ruta)"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { km_label_max: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                </div>
              </div>

              {/* Rate Badges with Inline Editing */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-white/10">
                <div className="p-2 rounded bg-reygas-surface">
                  <span className="text-gray-400 block">Gasolina/Gal</span>
                  <span className="font-bold text-white">
                    S/{" "}
                    <EditableText
                      value={safeCalc.gasoline_price_gal}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { gasoline_price_gal: Number(val) });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                </div>
                <div className="p-2 rounded bg-reygas-surface">
                  <span className="text-gray-400 block">GNV/m3</span>
                  <span className="font-bold text-emerald-400">
                    S/{" "}
                    <EditableText
                      value={safeCalc.gnv_price_m3}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { gnv_price_m3: Number(val) });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                </div>
                <div className="p-2 rounded bg-reygas-surface">
                  <span className="text-gray-400 block">GLP/Gal</span>
                  <span className="font-bold text-amber-400">
                    S/{" "}
                    <EditableText
                      value={safeCalc.glp_price_gal}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { glp_price_gal: Number(val) });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                </div>
              </div>
            </div>

            {/* Results Display (100% EDITABLE TEXTS ON CALCULATOR CARDS) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* GNV Card */}
              <div className="glass-card p-6 rounded-2xl border-2 border-emerald-500/40 relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    <EditableText
                      value={safeCalc.gnv_badge_text || "Opción GNV (Máximo Ahorro)"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { gnv_badge_text: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <Flame className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                <div>
                  <span className="text-xs text-gray-400 block">
                    <EditableText
                      value={safeCalc.gnv_monthly_label || "Ahorro Estimado Mensual"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { gnv_monthly_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <div className="text-3xl font-black text-emerald-400">
                    S/ {monthlySavingsGNV.toFixed(0)}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs text-gray-300">
                  <span>
                    <EditableText
                      value={safeCalc.gnv_annual_label || "Ahorro Anual:"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { gnv_annual_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <span className="font-extrabold text-white">S/ {annualSavingsGNV.toFixed(0)}</span>
                </div>

                <button
                  onClick={() => {
                    if (!isEditing) {
                      setBookingService("Conversión a GNV 5ta Gen");
                      setBookingOpen(true);
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <EditableText
                    value={safeCalc.gnv_btn_text || "Reservar GNV"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("calculator", { gnv_btn_text: val });
                      showSaveSuccess();
                    }}
                  />
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {/* GLP Card */}
              <div className="glass-card p-6 rounded-2xl border-2 border-amber-500/40 relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    <EditableText
                      value={safeCalc.glp_badge_text || "Opción GLP (Mayor Autonomía)"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { glp_badge_text: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                </div>

                <div>
                  <span className="text-xs text-gray-400 block">
                    <EditableText
                      value={safeCalc.glp_monthly_label || "Ahorro Estimado Mensual"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { glp_monthly_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <div className="text-3xl font-black text-amber-400">
                    S/ {monthlySavingsGLP.toFixed(0)}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs text-gray-300">
                  <span>
                    <EditableText
                      value={safeCalc.glp_annual_label || "Ahorro Anual:"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("calculator", { glp_annual_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </span>
                  <span className="font-extrabold text-white">S/ {annualSavingsGLP.toFixed(0)}</span>
                </div>

                <button
                  onClick={() => {
                    if (!isEditing) {
                      setBookingService("Conversión a GLP 5ta Gen");
                      setBookingOpen(true);
                    }
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <EditableText
                    value={safeCalc.glp_btn_text || "Reservar GLP"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("calculator", { glp_btn_text: val });
                      showSaveSuccess();
                    }}
                  />
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SERVICES CATALOG SECTION WITH DYNAMIC ADD/DELETE CARDS */}
      {/* ========================================================================= */}
      <section id="servicios" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          {/* EDITABLE SERVICES MAIN HEADER & SUBTITLE */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            <EditableText
              value={safeServicesHeader.title || "Nuestros Servicios Especializados"}
              isEditingEnabled={isEditing}
              onSave={(val) => {
                updateSiteContent("services_header", { title: val });
                showSaveSuccess();
              }}
            />
          </h2>
          <p className="text-gray-400 text-sm">
            <EditableText
              value={safeServicesHeader.subtitle || "Soluciones integrales de inyección de gas, mantenimiento preventivo y certificaciones oficiales."}
              isEditingEnabled={isEditing}
              multiline
              onSave={(val) => {
                updateSiteContent("services_header", { subtitle: val });
                showSaveSuccess();
              }}
            />
          </p>

          {/* DYNAMIC ADD SERVICE CARD BUTTON (VISIBLE IN ADMIN EDIT MODE) */}
          {isEditing && (
            <div className="pt-4">
              <button
                onClick={handleAddServiceCard}
                className="px-6 py-2.5 bg-reygas-red hover:bg-reygas-redDark text-white font-bold text-xs rounded-xl shadow-xl flex items-center gap-2 mx-auto transition-transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Nueva Tarjeta de Servicio</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((serv, index) => (
            <div
              key={serv.id}
              className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-reygas-red/50 transition-all flex flex-col justify-between group relative"
            >
              {/* DELETE CARD BUTTON IN EDIT MODE */}
              {isEditing && (
                <button
                  onClick={() => handleDeleteServiceCard(serv.id)}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xl transition-all z-20"
                  title="Eliminar esta Tarjeta de Servicio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="space-y-4">
                {/* EDITABLE SERVICE ICON SELECTOR */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-reygas-red/10 border border-reygas-red/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {renderServiceIcon(serv.icon)}
                  </div>

                  {isEditing && (
                    <div className="relative">
                      <button
                        onClick={() => setEditingIconId(editingIconId === serv.id ? null : serv.id)}
                        className="p-1.5 bg-reygas-surface hover:bg-reygas-red text-white text-xs rounded-lg border border-white/10 flex items-center gap-1"
                        title="Cambiar Ícono del Servicio"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Ícono</span>
                      </button>

                      {editingIconId === serv.id && (
                        <div className="absolute right-0 top-8 z-50 p-2 glass-panel border border-reygas-red rounded-xl shadow-2xl bg-reygas-dark flex gap-2">
                          {["Flame", "Zap", "Wrench", "ShieldCheck", "Cpu", "Gauge"].map((ic) => (
                            <button
                              key={ic}
                              onClick={() => {
                                const updated = [...services];
                                updated[index].icon = ic;
                                updateSiteContent("services", updated);
                                setEditingIconId(null);
                                showSaveSuccess();
                              }}
                              className="p-2 bg-reygas-surface hover:bg-reygas-red rounded text-white"
                            >
                              {renderServiceIcon(ic)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-white">
                  <EditableText
                    value={serv.title}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      const updated = [...services];
                      updated[index].title = val;
                      updateSiteContent("services", updated);
                      showSaveSuccess();
                    }}
                  />
                </h3>

                <p className="text-xs text-gray-400 leading-relaxed">
                  <EditableText
                    value={serv.description}
                    isEditingEnabled={isEditing}
                    multiline
                    onSave={(val) => {
                      const updated = [...services];
                      updated[index].description = val;
                      updateSiteContent("services", updated);
                      showSaveSuccess();
                    }}
                  />
                </p>
              </div>

              <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Desde</span>
                  <span className="text-xl font-black text-reygas-red">
                    S/{" "}
                    <EditableText
                      value={serv.price}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        const updated = [...services];
                        updated[index].price = Number(val);
                        updateSiteContent("services", updated);
                        showSaveSuccess();
                      }}
                    />
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!isEditing) {
                      setBookingService(serv.title);
                      setBookingOpen(true);
                    }
                  }}
                  className="px-4 py-2 bg-reygas-surface hover:bg-reygas-red text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Agendar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. ABOUT US SECTION WITH EDITABLE BADGE & INTERACTIVE WORKSHOP CAROUSEL */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-6">
            {/* EDITABLE ABOUT BADGE */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-reygas-surface border border-reygas-red/40 text-reygas-red text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-reygas-red" />
              <EditableText
                value={safeAbout.badge_text || "Garantía & Confianza Automotriz"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("about", { badge_text: val });
                  showSaveSuccess();
                }}
              />
            </div>
            <h2 className="text-3xl font-extrabold text-white">
              <EditableText
                value={safeAbout.title}
                isEditingEnabled={isEditing}
                multiline
                onSave={(val) => {
                  updateSiteContent("about", { title: val });
                  showSaveSuccess();
                }}
              />
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              <EditableText
                value={safeAbout.description}
                isEditingEnabled={isEditing}
                multiline
                onSave={(val) => {
                  updateSiteContent("about", { description: val });
                  showSaveSuccess();
                }}
              />
            </p>
            <div className="flex items-center gap-6 pt-2">
              <div>
                <span className="text-3xl font-black text-reygas-red">
                  <EditableText
                    value={safeAbout.experience_years}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("about", { experience_years: Number(val) });
                      showSaveSuccess();
                    }}
                  />{" "}
                  Años
                </span>
                <span className="block text-xs text-gray-400">Trayectoria Ininterrumpida</span>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <span className="text-3xl font-black text-white">
                  <EditableText
                    value={safeAbout.conversions_count || 8500}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("about", { conversions_count: Number(val) });
                      showSaveSuccess();
                    }}
                  />
                  +
                </span>
                <span className="block text-xs text-gray-400">Clientes Satisfechos</span>
              </div>
            </div>
          </div>

          {/* WORKSHOP IMAGE CAROUSEL CONTAINER - AUTO-FITTED 100% WITH SLIDE ARROWS */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-white/10 bg-reygas-dark/90 flex flex-col items-center justify-center p-2 min-h-[320px] sm:min-h-[400px] group shadow-2xl">
            {/* Active Image */}
            <div className="relative w-full h-[320px] sm:h-[380px] flex items-center justify-center">
              <img
                src={carouselImages[currentSlideIndex] || safeAbout.image_url}
                alt={`Taller ReyGas Autogas Equipment Foto ${currentSlideIndex + 1}`}
                className="w-full h-full max-h-[420px] object-contain rounded-xl transition-all duration-500 ease-in-out"
              />
            </div>

            {/* Navigation Arrows */}
            {carouselImages.length > 1 && (
              <>
                <button
                  onClick={handlePrevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-reygas-red text-white rounded-full transition-all shadow-xl opacity-80 hover:opacity-100"
                  title="Imagen Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-reygas-red text-white rounded-full transition-all shadow-xl opacity-80 hover:opacity-100"
                  title="Siguiente Imagen"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Carousel Dots */}
            {carouselImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                {carouselImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      currentSlideIndex === idx ? "w-6 bg-reygas-red" : "w-2 bg-white/40 hover:bg-white"
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="absolute bottom-3 left-4 flex items-center gap-2 pointer-events-none z-10">
              <ReyGasLogo size="sm" isEditingEnabled={isEditing} />
            </div>

            {/* Admin Controls for Carousel */}
            {isEditing && (
              <div className="absolute top-3 right-3 z-30 bg-black/90 p-3 rounded-xl border border-white/20 text-xs space-y-2 max-w-xs shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-400">
                    Foto {currentSlideIndex + 1} de {carouselImages.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleAddCarouselImage}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] flex items-center gap-0.5"
                      title="Añadir nueva imagen al carrusel"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Añadir</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCarouselImage(currentSlideIndex)}
                      className="p-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px]"
                      title="Eliminar esta foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block mb-1">URL de esta foto:</span>
                  <input
                    type="text"
                    value={carouselImages[currentSlideIndex] || ""}
                    onChange={(e) => {
                      const updated = [...carouselImages];
                      updated[currentSlideIndex] = e.target.value;
                      updateSiteContent("about", { gallery_images: updated, image_url: updated[0] });
                      showSaveSuccess();
                    }}
                    className="px-2 py-1 bg-reygas-dark border border-white/20 rounded text-xs text-white w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE LOCATION & MAP SECTION (DIRECTLY BELOW ABOUT US) */}
      {/* ========================================================================= */}
      <section id="ubicacion" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/10 space-y-8 shadow-2xl">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-reygas-red/20 text-reygas-red text-xs font-bold uppercase border border-reygas-red/40">
              <MapPin className="w-4 h-4" />
              <EditableText
                value={safeLocationMap.badge_text || "Ubicación & Cobertura"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("location_map", { badge_text: val });
                  showSaveSuccess();
                }}
              />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              <EditableText
                value={safeLocationMap.title || "Encuentra Nuestro Taller Autorizado"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("location_map", { title: val });
                  showSaveSuccess();
                }}
              />
            </h2>
            <p className="text-gray-400 text-sm">
              <EditableText
                value={safeLocationMap.subtitle || "Visítanos en nuestra sede principal con amplio estacionamiento y atención inmediata."}
                isEditingEnabled={isEditing}
                multiline
                onSave={(val) => {
                  updateSiteContent("location_map", { subtitle: val });
                  showSaveSuccess();
                }}
              />
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Info Cards */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-start gap-4 hover:border-reygas-red/50 transition-all">
                <div className="p-3 bg-reygas-red/10 rounded-xl border border-reygas-red/30 text-reygas-red shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Dirección Principal</span>
                  <h4 className="font-bold text-white text-base mt-0.5">
                    <EditableText
                      value={safeLocationMap.address_display || "Av. San Martín N° 279 - Santa María"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("location_map", { address_display: val });
                        showSaveSuccess();
                      }}
                    />
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <EditableText
                      value={safeLocationMap.city_district || "Huacho - Lima, Perú"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("location_map", { city_district: val });
                        showSaveSuccess();
                      }}
                    />
                  </p>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-start gap-4 hover:border-blue-500/50 transition-all">
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Horario de Atención</span>
                  <h4 className="font-bold text-white text-base mt-0.5">
                    <EditableText
                      value={safeLocationMap.schedule_display || "Lunes a Sábado: 8:00 AM - 6:30 PM"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("location_map", { schedule_display: val });
                        showSaveSuccess();
                      }}
                    />
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Recepción de vehículos e inspección técnica</p>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-start gap-4 hover:border-emerald-500/50 transition-all">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-400 shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Teléfono & WhatsApp</span>
                  <h4 className="font-bold text-white text-base mt-0.5">
                    <EditableText
                      value={safeLocationMap.phone_display || "+51 987 654 321 / WhatsApp Directo"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("location_map", { phone_display: val });
                        showSaveSuccess();
                      }}
                    />
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Atención rápida de consultas e itinerarios</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={safeLocationMap.google_maps_link || "https://maps.google.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-reygas-surface hover:bg-reygas-red text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-white/10 transition-transform hover:scale-102 shadow-lg"
                >
                  <Navigation className="w-4 h-4 text-reygas-red" />
                  <EditableText
                    value={safeLocationMap.btn_directions_text || "Abrir Ubicación en Google Maps"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("location_map", { btn_directions_text: val });
                      showSaveSuccess();
                    }}
                  />
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            </div>

            {/* Google Map Embedded iframe Container */}
            <div className="lg:col-span-7 relative h-[380px] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-reygas-dark">
              <iframe
                src={safeLocationMap.map_embed_url}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full grayscale-[20%] contrast-[110%] rounded-xl"
              />

              {isEditing && (
                <div className="absolute bottom-3 left-3 right-3 bg-black/90 p-3 rounded-xl border border-white/20 text-xs space-y-1.5 shadow-2xl">
                  <span className="text-[10px] text-amber-400 font-bold block">URL / Enlace Embed de Google Maps:</span>
                  <input
                    type="text"
                    value={safeLocationMap.map_embed_url}
                    onChange={(e) => {
                      updateSiteContent("location_map", { map_embed_url: e.target.value });
                      showSaveSuccess();
                    }}
                    className="px-2 py-1 bg-reygas-dark border border-white/20 rounded text-xs text-white w-full"
                    placeholder="https://www.google.com/maps/embed?pb=..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. FOOTER SECTION (FULL COLUMN CREATION, DELETION & INLINE EDITING) */}
      {/* ========================================================================= */}
      <footer className="bg-reygas-dark border-t border-white/10 text-gray-300 pt-16 pb-8 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Admin Toolbar to Add New Column Sections */}
          {isEditing && (
            <div className="mb-8 p-4 bg-reygas-surface/80 rounded-2xl border border-reygas-red/40 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Edit3 className="w-4 h-4 text-reygas-red" />
                <span>Gestión de Secciones y Columnas del Pie de Página (Footer):</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAddCustomColumnFooter}
                  className="px-4 py-2 bg-reygas-red hover:bg-reygas-redDark text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Añadir Nueva Sección / Columna</span>
                </button>

                {/* Restores for hidden columns */}
                {safeFooter.show_services_col === false && (
                  <button
                    onClick={() => updateSiteContent("footer", { show_services_col: true })}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mostrar {safeFooter.title_services || "Servicios"}</span>
                  </button>
                )}
                {safeFooter.show_contact_col === false && (
                  <button
                    onClick={() => updateSiteContent("footer", { show_contact_col: true })}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mostrar {safeFooter.title_contact || "Contacto"}</span>
                  </button>
                )}
                {safeFooter.show_modules_col === false && (
                  <button
                    onClick={() => updateSiteContent("footer", { show_modules_col: true })}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mostrar {safeFooter.title_modules || "Módulos"}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-10 w-full" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {/* Column 1: Brand Info */}
            <div className="space-y-4">
              <ReyGasLogo size="lg" isEditingEnabled={isEditing} />
              <p className="text-sm text-gray-400 leading-relaxed">
                <EditableText
                  value={safeFooter.brand_description}
                  isEditingEnabled={isEditing}
                  multiline
                  onSave={(val) => {
                    updateSiteContent("footer", { brand_description: val });
                    showSaveSuccess();
                  }}
                />
              </p>
              <div className="flex items-center gap-3 text-xs text-reygas-red font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-reygas-red" />
                <span>
                  <EditableText
                    value={safeFooter.certification_label || "Certificación Oficial MTC / Produce"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("footer", { certification_label: val });
                      showSaveSuccess();
                    }}
                  />
                </span>
              </div>
            </div>

            {/* Column 2: Featured Services (With Section Delete) */}
            {safeFooter.show_services_col !== false && (
              <div className="relative group">
                <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3 flex items-center justify-between">
                  <EditableText
                    value={safeFooter.title_services || "SERVICIOS DESTACADOS"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("footer", { title_services: val });
                      showSaveSuccess();
                    }}
                  />
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleAddFeaturedServiceFooter}
                        className="p-1 bg-reygas-red hover:bg-reygas-redDark text-white rounded text-xs"
                        title="Añadir Ítem de Servicio"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("¿Ocultar/Eliminar esta sección de Servicios Destacados?")) {
                            updateSiteContent("footer", { show_services_col: false });
                            showSaveSuccess();
                          }
                        }}
                        className="p-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                        title="Eliminar / Ocultar esta Sección Completa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  {(safeFooter.featured_services || [
                    "Conversiones GNV 5ta Generación",
                    "Conversiones GLP 5ta Generación",
                    "Mantenimiento de Inyectores & Reductores",
                    "Certificación Anual & Prueba Hidrostática",
                  ]).map((servItem, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 group/item">
                      <div className="flex items-center gap-2 flex-grow">
                        <Flame className="w-3.5 h-3.5 text-reygas-red shrink-0" />
                        <EditableText
                          value={servItem}
                          isEditingEnabled={isEditing}
                          onSave={(val) => {
                            const updated = [...(safeFooter.featured_services || [])];
                            updated[idx] = val;
                            updateSiteContent("footer", { featured_services: updated });
                            showSaveSuccess();
                          }}
                        />
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => handleDeleteFeaturedServiceFooter(idx)}
                          className="p-0.5 text-gray-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                          title="Eliminar este ítem"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Column 3: Contact Info (With Section Delete) */}
            {safeFooter.show_contact_col !== false && (
              <div className="relative group">
                <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3 flex items-center justify-between">
                  <EditableText
                    value={safeFooter.title_contact || "CONTACTO TALLER"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("footer", { title_contact: val });
                      showSaveSuccess();
                    }}
                  />
                  {isEditing && (
                    <button
                      onClick={() => {
                        if (confirm("¿Ocultar/Eliminar esta sección de Contacto?")) {
                          updateSiteContent("footer", { show_contact_col: false });
                          showSaveSuccess();
                        }
                      }}
                      className="p-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                      title="Eliminar / Ocultar esta Sección Completa"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-reygas-red shrink-0" />
                    <EditableText
                      value={contact.phone}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("contact", { phone: val });
                        showSaveSuccess();
                      }}
                    />
                  </li>
                  <li className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-reygas-red shrink-0" />
                    <EditableText
                      value={contact.email}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("contact", { email: val });
                        showSaveSuccess();
                      }}
                    />
                  </li>
                  <li className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-reygas-red shrink-0" />
                    <EditableText
                      value={contact.address}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("contact", { address: val });
                        showSaveSuccess();
                      }}
                    />
                  </li>
                  <li className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-reygas-red shrink-0" />
                    <EditableText
                      value={contact.schedule}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("contact", { schedule: val });
                        showSaveSuccess();
                      }}
                    />
                  </li>
                </ul>
              </div>
            )}

            {/* Column 4: Workshop Modules (With Section Delete) */}
            {safeFooter.show_modules_col !== false && (
              <div className="relative group">
                <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3 flex items-center justify-between">
                  <EditableText
                    value={safeFooter.title_modules || "MÓDULOS DEL TALLER"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("footer", { title_modules: val });
                      showSaveSuccess();
                    }}
                  />
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleAddModuleFooter}
                        className="p-1 bg-reygas-red hover:bg-reygas-redDark text-white rounded text-xs"
                        title="Añadir Módulo"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("¿Ocultar/Eliminar esta sección de Módulos del Taller?")) {
                            updateSiteContent("footer", { show_modules_col: false });
                            showSaveSuccess();
                          }
                        }}
                        className="p-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                        title="Eliminar / Ocultar esta Sección Completa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(safeFooter.modules || [
                    "Portería & Semáforo",
                    "Recepción & Citas",
                    "Taller Kanban",
                    "Almacén & Insumos",
                    "Caja & Facturación",
                    "Certificaciones",
                  ]).map((modItem, idx) => (
                    <div key={idx} className="p-2 rounded bg-reygas-card text-gray-300 flex items-center justify-between group/mod">
                      <EditableText
                        value={modItem}
                        isEditingEnabled={isEditing}
                        onSave={(val) => {
                          const updated = [...(safeFooter.modules || [])];
                          updated[idx] = val;
                          updateSiteContent("footer", { modules: updated });
                          showSaveSuccess();
                        }}
                      />
                      {isEditing && (
                        <button
                          onClick={() => handleDeleteModuleFooter(idx)}
                          className="p-0.5 text-gray-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity ml-1"
                          title="Eliminar este módulo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DYNAMIC CUSTOM COLUMNS (CREATED BY ADMIN) */}
            {(safeFooter.custom_columns || []).map((col) => (
              <div key={col.id} className="relative group border border-reygas-red/30 p-3 rounded-xl bg-reygas-card/50">
                <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3 flex items-center justify-between">
                  <EditableText
                    value={col.title}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      const updated = (safeFooter.custom_columns || []).map((c) =>
                        c.id === col.id ? { ...c, title: val } : c
                      );
                      updateSiteContent("footer", { custom_columns: updated });
                      showSaveSuccess();
                    }}
                  />
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAddCustomItemToCol(col.id)}
                        className="p-1 bg-reygas-red hover:bg-reygas-redDark text-white rounded text-xs"
                        title="Añadir Ítem a esta Columna"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomColumnFooter(col.id)}
                        className="p-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                        title="Eliminar esta Sección Personalizada"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  {col.items.map((itemStr, iIdx) => (
                    <li key={iIdx} className="flex items-center justify-between gap-2 group/citem">
                      <div className="flex items-center gap-2 flex-grow">
                        <span className="w-1.5 h-1.5 rounded-full bg-reygas-red shrink-0" />
                        <EditableText
                          value={itemStr}
                          isEditingEnabled={isEditing}
                          onSave={(val) => {
                            const updated = (safeFooter.custom_columns || []).map((c) => {
                              if (c.id === col.id) {
                                const newItems = [...c.items];
                                newItems[iIdx] = val;
                                return { ...c, items: newItems };
                              }
                              return c;
                            });
                            updateSiteContent("footer", { custom_columns: updated });
                            showSaveSuccess();
                          }}
                        />
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => handleDeleteCustomItemFromCol(col.id, iIdx)}
                          className="p-0.5 text-gray-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                          title="Eliminar este ítem"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
            <p>
              © {new Date().getFullYear()}{" "}
              <EditableText
                value={safeFooter.copyright_text || "REYGAS AUTOGAS EQUIPMENT. Todos los derechos reservados."}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("footer", { copyright_text: val });
                  showSaveSuccess();
                }}
              />
            </p>
            <p className="mt-2 md:mt-0">
              <EditableText
                value={safeFooter.tagline || "Sistema Dinámico ERP & CMS Automotriz"}
                isEditingEnabled={isEditing}
                onSave={(val) => {
                  updateSiteContent("footer", { tagline: val });
                  showSaveSuccess();
                }}
              />
            </p>
          </div>
        </div>
      </footer>

      {/* ONLINE BOOKING FLOATING MODAL WITH 100% INLINE EDITABLE LABELS & TEXTS */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/20 space-y-4 relative">
            <button
              onClick={() => setBookingOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-reygas-red shrink-0" />
                <EditableText
                  value={safeBookingModal.title || "Reservar Cita Online"}
                  isEditingEnabled={isEditing}
                  onSave={(val) => {
                    updateSiteContent("booking_modal", { title: val });
                    showSaveSuccess();
                  }}
                />
              </h3>
              <p className="text-xs text-gray-400">
                <EditableText
                  value={safeBookingModal.subtitle || "Complete el formulario y nuestro equipo alistará su recepción."}
                  isEditingEnabled={isEditing}
                  multiline
                  onSave={(val) => {
                    updateSiteContent("booking_modal", { subtitle: val });
                    showSaveSuccess();
                  }}
                />
              </p>
            </div>

            {bookingSuccess ? (
              <div className="p-6 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">¡Cita Registrada con Éxito!</h4>
                <p className="text-xs text-gray-300">
                  Su reserva para {bookingForm.plate} ha sido agendada en el ERP de Recepción y guardada en Supabase.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    <EditableText
                      value={safeBookingModal.client_name_label || "Nombre Completo del Propietario *"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("booking_modal", { client_name_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={bookingForm.client_name}
                    onChange={(e) => setBookingForm({ ...bookingForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      <EditableText
                        value={safeBookingModal.phone_label || "Teléfono WhatsApp *"}
                        isEditingEnabled={isEditing}
                        onSave={(val) => {
                          updateSiteContent("booking_modal", { phone_label: val });
                          showSaveSuccess();
                        }}
                      />
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+51 987654321"
                      value={bookingForm.client_phone}
                      onChange={(e) => setBookingForm({ ...bookingForm, client_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      <EditableText
                        value={safeBookingModal.plate_label || "Placa Vehículo *"}
                        isEditingEnabled={isEditing}
                        onSave={(val) => {
                          updateSiteContent("booking_modal", { plate_label: val });
                          showSaveSuccess();
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ABC-123"
                      value={bookingForm.plate}
                      onChange={(e) => setBookingForm({ ...bookingForm, plate: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    <EditableText
                      value={safeBookingModal.service_label || "Tipo de Servicio Solicitado"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("booking_modal", { service_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </label>
                  <select
                    value={bookingForm.service_type}
                    onChange={(e) => setBookingForm({ ...bookingForm, service_type: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    <EditableText
                      value={safeBookingModal.date_label || "Fecha y Hora Preferida"}
                      isEditingEnabled={isEditing}
                      onSave={(val) => {
                        updateSiteContent("booking_modal", { date_label: val });
                        showSaveSuccess();
                      }}
                    />
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={bookingForm.scheduled_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-reygas-red"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-reygas-red/30 flex items-center justify-center"
                >
                  <EditableText
                    value={safeBookingModal.btn_submit_text || "Confirmar Reserva de Cita"}
                    isEditingEnabled={isEditing}
                    onSave={(val) => {
                      updateSiteContent("booking_modal", { btn_submit_text: val });
                      showSaveSuccess();
                    }}
                  />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD CAROUSEL IMAGE WEB-NATIVE DYNAMIC MODAL (SAME WEB DESIGN) */}
      {/* ========================================================================= */}
      {isAddCarouselModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-reygas-red/40 space-y-4 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsAddCarouselModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-reygas-red shrink-0" />
                <span>Añadir Nueva Foto al Carrusel</span>
              </h3>
              <p className="text-xs text-gray-400">
                Pega el enlace URL de la imagen para incorporar la foto a la galería interactiva del taller.
              </p>
            </div>

            <form onSubmit={handleConfirmAddCarouselImage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Enlace URL de la Imagen *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://ejemplo.com/foto-taller.jpg"
                  value={newCarouselUrlInput}
                  onChange={(e) => setNewCarouselUrlInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-reygas-red"
                />
              </div>

              {/* Live Preview Box */}
              <div>
                <span className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                  Vista Previa en Tiempo Real:
                </span>
                <div className="w-full h-36 bg-reygas-dark/90 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden p-2">
                  {newCarouselUrlInput.trim() ? (
                    <img
                      src={newCarouselUrlInput.trim()}
                      alt="Vista Previa de Foto Taller"
                      className="max-h-full max-w-full object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="text-center text-xs text-gray-500 space-y-1">
                      <Plus className="w-6 h-6 mx-auto text-gray-600" />
                      <p>Ingresa una URL para ver la previsualización</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Sample Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                  Sugerencias Rápidas de Prueba:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setNewCarouselUrlInput("https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1000&q=80")}
                    className="p-1.5 bg-reygas-surface hover:bg-reygas-red/30 rounded-lg text-gray-300 text-left truncate border border-white/5"
                  >
                    📷 Motor 5ta Gen
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCarouselUrlInput("https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1000&q=80")}
                    className="p-1.5 bg-reygas-surface hover:bg-reygas-red/30 rounded-lg text-gray-300 text-left truncate border border-white/5"
                  >
                    💻 Diagnóstico ECU
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCarouselUrlInput("https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=1000&q=80")}
                    className="p-1.5 bg-reygas-surface hover:bg-reygas-red/30 rounded-lg text-gray-300 text-left truncate border border-white/5"
                  >
                    🔧 Banco Inyectores
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCarouselUrlInput("https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&q=80")}
                    className="p-1.5 bg-reygas-surface hover:bg-reygas-red/30 rounded-lg text-gray-300 text-left truncate border border-white/5"
                  >
                    🚗 Vehículo en Rampa
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCarouselModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-reygas-red hover:bg-reygas-redDark text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-reygas-red/30 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar en Carrusel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
