"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  fetchSupabaseSiteContent,
  saveSupabaseSiteContent,
  saveFullSiteContentToSupabase,
  saveSupabaseTechnician,
  saveSupabaseInventoryItem,
  saveSupabaseWorkOrder,
  saveSupabaseVehicle,
  saveSupabaseAppointment,
  deleteSupabaseAppointment,
  saveSupabaseInvoice,
  fetchSupabaseErpData,
  deleteSupabaseInventoryItem,
  deleteMultipleSupabaseInventoryItems,
  clearSupabaseInventory,
  deleteSupabaseWorkOrder,
  deleteSupabaseMultipleWorkOrders,
  clearSupabaseWorkOrders,
  saveSupabaseBulkWorkshopData,
} from "@/lib/supabase/services";

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SiteTheme {
  primary_color: string;
  primary_hover: string;
  background_color: string;
  card_color: string;
  surface_color: string;
  text_color: string;
  font_style: string;
  zoom_scale?: number;
}

export interface FooterColumn {
  id: string;
  title: string;
  items: string[];
}

export interface SiteContent {
  theme: SiteTheme;
  navbar: {
    brand_name: string;
    logo_image: string;
    link_public: string;
    link_erp: string;
  };
  hero: {
    title: string;
    subtitle: string;
    badge_text: string;
    banner_image: string;
    btn_primary_text: string;
    btn_secondary_text: string;
  };
  metrics: {
    card1_value: string;
    card1_label: string;
    card2_label: string;
    card3_label: string;
    card4_value: string;
    card4_label: string;
  };
  calculator: {
    badge_text: string;
    title: string;
    subtitle: string;
    km_slider_title: string;
    km_label_min: string;
    km_label_mid: string;
    km_label_max: string;
    gnv_badge_text: string;
    gnv_monthly_label: string;
    gnv_annual_label: string;
    gnv_btn_text: string;
    glp_badge_text: string;
    glp_monthly_label: string;
    glp_annual_label: string;
    glp_btn_text: string;
    gasoline_price_gal: number;
    gnv_price_m3: number;
    glp_price_gal: number;
    efficiency_km_gal: number;
  };
  services_header: {
    title: string;
    subtitle: string;
  };
  about: {
    badge_text: string;
    title: string;
    description: string;
    experience_years: number;
    conversions_count: number;
    image_url: string;
    gallery_images?: string[];
  };
  location_map?: {
    badge_text: string;
    title: string;
    subtitle: string;
    address_display: string;
    city_district: string;
    schedule_display: string;
    phone_display: string;
    map_embed_url: string;
    map_zoom_level?: number;
    btn_directions_text: string;
    google_maps_link: string;
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    schedule: string;
    whatsapp: string;
  };
  booking_modal: {
    title: string;
    subtitle: string;
    client_name_label: string;
    phone_label: string;
    plate_label: string;
    service_label: string;
    date_label: string;
    btn_submit_text: string;
  };
  footer: {
    brand_description: string;
    certification_label: string;
    title_services: string;
    title_contact: string;
    title_modules: string;
    show_services_col?: boolean;
    show_contact_col?: boolean;
    show_modules_col?: boolean;
    featured_services: string[];
    modules: string[];
    custom_columns?: FooterColumn[];
    copyright_text: string;
    tagline: string;
  };
  services: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    icon: string;
  }>;
  gallery: Array<{
    id: string;
    title: string;
    image_url: string;
    category: string;
  }>;
}

export interface Technician {
  id: string;
  full_name: string;
  specialty: string;
  phone: string;
  is_active: boolean;
}

export interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  fuel_type: "GNV" | "GLP" | "Gasolina" | "Bifuel";
  owner_name: string;
  owner_phone: string;
  current_mileage: number;
  last_visit_date: string;
  photos?: string[];
}

export type WorkOrderStatus =
  | "ingresado"
  | "en_diagnostico"
  | "esperando_repuestos"
  | "en_servicio"
  | "por_cobrar"
  | "pagado_autorizado"
  | "finalizado";

export interface WorkOrderItem {
  id: string;
  inventory_item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  dispatched?: boolean;
  requested_at?: string;
  dispatched_at?: string;
}

export interface WorkOrder {
  id: string;
  vehicle_plate: string;
  status: WorkOrderStatus;
  assigned_technician_id?: string;
  problem_description: string;
  diagnostic_notes?: string;
  entry_time: string;
  completion_time?: string;
  items: WorkOrderItem[];
  requires_certification?: boolean;
  certification_type?: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática";
  certification_price?: number;
  certification_issued?: boolean;
  certification_id?: string;
  allow_modifications?: boolean;
  quinquennial_date?: string; // FECHA QUINTENAL
  chip_expiry_date?: string; // FECHA CHIP ANUAL
  general_maintenance_service?: string; // MANT. GENERAL / SERVICIO
  spare_parts_services?: string; // REPUESTOS Y SERVICIOS
}

export interface InventoryItem {
  id: string;
  sku_barcode: string;
  name: string;
  brand?: string;
  serial_number?: string;
  category: string;
  unit_price: number;
  initial_stock?: number;
  entries?: number;
  exits?: number;
  stock_quantity: number; // Stock Vigente
  counted_stock?: number;
  min_stock_alert: number;
}

export interface ToolLoan {
  id: string;
  tool_name: string;
  serial_number: string;
  technician_name: string;
  borrowed_at: string;
  returned_at?: string;
  status: "prestado" | "devuelto" | "mantenimiento";
  notes?: string;
}

export interface Invoice {
  id: string;
  work_order_id: string;
  vehicle_plate: string;
  client_name: string;
  labor_fee: number;
  parts_total: number;
  certification_fee: number;
  grand_total: number;
  payment_status: "pendiente" | "pagado";
  payment_method: string;
  issued_at: string;
  paid_at?: string;
  receipt_number?: string; // N° de boleta/Factura
  receipt_type?: string; // COMPROBANTE (Boleta/Factura/Nota)
  discounts?: number; // DESCUENTOS
  credit_amount?: number; // Credito
  payment_condition?: string; // Condicion (Contado/Crédito)
  payment_destination?: string; // DESTINO DE PAGO (BCP, BBVA, Yape, Caja)
}

export interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  plate: string;
  service_type: string;
  scheduled_date: string;
  status: "pendiente" | "confirmado" | "completado" | "cancelado";
  notes?: string;
}

export interface Certification {
  id: string;
  work_order_id?: string;
  vehicle_plate: string;
  client_name: string;
  chip_code: string;
  cylinder_serial: string;
  certification_type: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática";
  issue_date: string;
  expiry_date: string;
  status: "Vigente" | "Vencido" | "Por Vencer" | "Solicitado";
  price?: number;
  is_ready?: boolean;
}

export interface AttendanceLog {
  id: string;
  employee_name: string;
  check_time: string;
  log_type: "Entrada" | "Salida";
  source_file?: string;
}

export interface AISettings {
  apiKey: string;
  provider: "openai" | "gemini" | "custom";
  model: string;
  customEndpoint?: string;
}

interface AppState {
  // Authentication State
  isAuthenticated: boolean;
  userRole: "admin" | "personal" | null;
  currentUser: { name: string; email: string } | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;

  // Visual Editing Toggle
  isVisualEditing: boolean;
  toggleVisualEditing: () => void;

  // AI Configuration Settings
  aiSettings: AISettings;
  updateAISettings: (settings: Partial<AISettings>) => void;

  // Supabase Fetch Initializer & Full Manual Save
  syncFromSupabase: () => Promise<void>;
  saveAllToSupabase: () => Promise<boolean>;

  siteContent: SiteContent;
  updateSiteContent: (key: keyof SiteContent, data: any) => void;
  updateTheme: (themeData: Partial<SiteTheme>) => void;

  technicians: Technician[];
  addTechnician: (tech: Omit<Technician, "id">) => void;
  updateTechnician: (id: string, tech: Partial<Technician>) => void;
  toggleTechnicianActive: (id: string) => void;

  vehicles: Vehicle[];
  registerVehicle: (v: Vehicle) => void;

  workOrders: WorkOrder[];
  createWorkOrder: (order: Omit<WorkOrder, "id" | "entry_time" | "items"> & { items?: WorkOrderItem[] }) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  assignTechnicianToOrder: (orderId: string, techId: string) => void;
  addWorkOrderItem: (orderId: string, item: Omit<WorkOrderItem, "id" | "subtotal">) => void;
  removeWorkOrderItem: (orderId: string, itemId: string) => void;
  markWorkOrderItemDispatched: (orderId: string, itemId: string) => void;
  toggleWorkOrderItemDispatched: (orderId: string, itemId: string) => void;
  updateDiagnosticNotes: (orderId: string, notes: string) => void;
  toggleAllowModificationsInWorkshop: (orderId: string) => void;
  deleteWorkOrder: (id: string) => void;
  deleteMultipleWorkOrders: (ids: string[]) => void;
  clearAllWorkOrders: () => void;
  requestCertificationForWorkOrder: (
    orderId: string,
    certType: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática",
    price: number
  ) => void;

  inventoryItems: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, "id">) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  deleteMultipleInventoryItems: (ids: string[]) => void;
  clearAllInventory: () => void;
  importBulkInventoryItems: (items: Omit<InventoryItem, "id">[]) => void;
  deductStock: (id: string, qty: number) => void;

  toolLoans: ToolLoan[];
  addToolLoan: (loan: Omit<ToolLoan, "id" | "borrowed_at" | "status">) => void;
  returnTool: (loanId: string) => void;

  invoices: Invoice[];
  createInvoice: (invoice: Omit<Invoice, "id">) => void;
  createInvoiceForOrder: (orderId: string, laborFee: number, certFee: number, method: string) => void;
  payInvoice: (invoiceId: string) => void;
  togglePayInvoice: (invoiceId: string) => void;
  importBulkWorkshopData: (data: { vehicles: Vehicle[]; workOrders: WorkOrder[]; invoices: Invoice[] }) => void;

  appointments: Appointment[];
  addAppointment: (app: Omit<Appointment, "id" | "status">) => void;
  updateAppointmentStatus: (id: string, status: Appointment["status"]) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  certifications: Certification[];
  addCertification: (cert: Omit<Certification, "id">) => void;

  attendanceLogs: AttendanceLog[];
  addAttendanceLogs: (logs: Omit<AttendanceLog, "id">[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      userRole: null,
      currentUser: null,

      login: (email, pass) => {
        if (email.toLowerCase().includes("admin") || email === "admin@reygas.com") {
          set({
            isAuthenticated: true,
            userRole: "admin",
            currentUser: { name: "Administrador ReyGas", email },
            isVisualEditing: true,
          });
          return true;
        } else if (email || pass) {
          set({
            isAuthenticated: true,
            userRole: "personal",
            currentUser: { name: "Operador de Taller", email },
            isVisualEditing: false,
          });
          return true;
        }
        return false;
      },

      logout: () =>
        set({
          isAuthenticated: false,
          userRole: null,
          currentUser: null,
          isVisualEditing: false,
        }),

      isVisualEditing: false,
      toggleVisualEditing: () => set((state) => ({ isVisualEditing: !state.isVisualEditing })),

      aiSettings: {
        apiKey: "",
        provider: "openai",
        model: "gpt-4o-mini",
        customEndpoint: "",
      },
      updateAISettings: (settings) =>
        set((state) => ({ aiSettings: { ...state.aiSettings, ...settings } })),

      syncFromSupabase: async () => {
        try {
          const cmsData = await fetchSupabaseSiteContent();
          const erpData = await fetchSupabaseErpData();

          set((state) => ({
            siteContent: cmsData && Object.keys(cmsData).length > 0 ? { ...state.siteContent, ...cmsData } : state.siteContent,
            technicians: erpData?.technicians !== null && erpData?.technicians !== undefined ? erpData.technicians : state.technicians,
            inventoryItems: erpData?.inventoryItems !== null && erpData?.inventoryItems !== undefined ? erpData.inventoryItems : state.inventoryItems,
            workOrders: erpData?.workOrders !== null && erpData?.workOrders !== undefined ? erpData.workOrders : state.workOrders,
            appointments: erpData?.appointments !== null && erpData?.appointments !== undefined ? erpData.appointments : state.appointments,
            invoices: erpData?.invoices !== null && erpData?.invoices !== undefined ? erpData.invoices : state.invoices,
            vehicles: erpData?.vehicles !== null && erpData?.vehicles !== undefined ? erpData.vehicles : state.vehicles,
          }));
        } catch (err) {
          console.warn("Supabase sync warning:", err);
        }
      },

      saveAllToSupabase: async () => {
        const currentContent = get().siteContent;
        const success = await saveFullSiteContentToSupabase(currentContent);
        return success;
      },

      siteContent: {
        theme: {
          primary_color: "#D32F2F",
          primary_hover: "#B71C1C",
          background_color: "#141619",
          card_color: "#1E2022",
          surface_color: "#2A2D30",
          text_color: "#FFFFFF",
          font_style: "sans-serif",
          zoom_scale: 100,
        },
        navbar: {
          brand_name: "REYGAS AUTOGAS EQUIPMENT",
          logo_image: "/logo.jpg",
          link_public: "Sitio Web Público",
          link_erp: "Acceso ERP / Personal",
        },
        hero: {
          title: "Especialistas en Conversión y Mantenimiento GNV / GLP",
          subtitle: "Equipos de 5ta Generación con garantía certificada y tecnología de diagnóstico computarizado para la máxima eficiencia de su vehículo.",
          badge_text: "Equipos de 5ta Generación Certificados",
          banner_image: "/logo.jpg",
          btn_primary_text: "Reservar Cita de Conversión",
          btn_secondary_text: "Calcular Mi Ahorro Mensual",
        },
        metrics: {
          card1_value: "Hasta 65%",
          card1_label: "Ahorro en GNV vs Gasolina",
          card2_label: "Experiencia Técnica",
          card3_label: "Vehículos Convertidos",
          card4_value: "100%",
          card4_label: "Garantía Certificada MTC",
        },
        calculator: {
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
        },
        services_header: {
          title: "Nuestros Servicios Especializados",
          subtitle: "Soluciones integrales de inyección de gas, mantenimiento preventivo y certificaciones oficiales.",
        },
        about: {
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
        },
        location_map: {
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
        },
        contact: {
          phone: "+51 987 654 321",
          email: "contacto@reygas.com",
          address: "Av. San Martín N° 279 - Santa María, Huacho",
          schedule: "Lun - Sáb: 8:00 AM - 6:30 PM",
          whatsapp: "51987654321",
        },
        booking_modal: {
          title: "Reservar Cita Online",
          subtitle: "Complete el formulario y nuestro equipo alistará su recepción.",
          client_name_label: "Nombre Completo del Propietario *",
          phone_label: "Teléfono WhatsApp *",
          plate_label: "Placa Vehículo *",
          service_label: "Tipo de Servicio Solicitado",
          date_label: "Fecha y Hora Preferida",
          btn_submit_text: "Confirmar Reserva de Cita",
        },
        footer: {
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
        },
        services: [
          {
            id: "serv-1",
            title: "Conversión a GNV 5ta Generación",
            description: "Instalación de kit italiano Tomasetto/STAG con tanque cilíndrico liviano de alta presión.",
            price: 2800,
            icon: "Flame",
          },
          {
            id: "serv-2",
            title: "Conversión a GLP 5ta Generación",
            description: "Sistema de inyección secuencial de gas con tanque toroidal en espacio de repuesto.",
            price: 2600,
            icon: "Zap",
          },
          {
            id: "serv-3",
            title: "Mantenimiento Preventivo 15,000 km",
            description: "Limpieza de inyectores de gas, cambio de filtros de líquido y vapor, calibración por software.",
            price: 150,
            icon: "Wrench",
          },
          {
            id: "serv-4",
            title: "Certificación Anual & Prueba Hidrostática",
            description: "Inspección técnica de hermeticidad y re-certificación oficial ante el MTC/Produce.",
            price: 90,
            icon: "ShieldCheck",
          },
        ],
        gallery: [
          {
            id: "gal-1",
            title: "Instalación de Tanque Toroidal GLP",
            image_url: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80",
            category: "GLP",
          },
          {
            id: "gal-2",
            title: "Diagnóstico por Computadora GNV",
            image_url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",
            category: "Diagnóstico",
          },
          {
            id: "gal-3",
            title: "Prueba de Inyectores de Gas",
            image_url: "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=800&q=80",
            category: "Mantenimiento",
          },
        ],
      },

      updateSiteContent: (key, data) => {
        set((state) => {
          const currentSection = state.siteContent[key];
          let updatedSection;

          if (Array.isArray(data)) {
            updatedSection = data;
          } else if (typeof data === "object" && data !== null) {
            updatedSection = { ...(typeof currentSection === "object" ? currentSection : {}), ...data };
          } else {
            updatedSection = data;
          }

          // Trigger Supabase Realtime Sync
          saveSupabaseSiteContent(key, updatedSection);

          return {
            siteContent: {
              ...state.siteContent,
              [key]: updatedSection,
            },
          };
        });
      },

      updateTheme: (themeData) => {
        set((state) => {
          const updatedTheme = {
            ...state.siteContent.theme,
            ...themeData,
          };

          // Trigger Supabase Realtime Sync for Theme
          saveSupabaseSiteContent("theme", updatedTheme, "theme");

          return {
            siteContent: {
              ...state.siteContent,
              theme: updatedTheme,
            },
          };
        });
      },

      technicians: [
        {
          id: "tech-1",
          full_name: "Carlos Mendoza",
          specialty: "Master GNV 5ta Generación",
          phone: "+51 912345678",
          is_active: true,
        },
        {
          id: "tech-2",
          full_name: "Roberto Gómez",
          specialty: "Electricista Automotriz & ECU",
          phone: "+51 923456789",
          is_active: true,
        },
        {
          id: "tech-3",
          full_name: "Juan Diego Morales",
          specialty: "Pruebas Hidrostáticas & Reductores",
          phone: "+51 934567890",
          is_active: true,
        },
      ],

      addTechnician: (tech) => {
        const newTech = { ...tech, id: `tech-${Date.now()}` };
        saveSupabaseTechnician(newTech);
        set((state) => ({
          technicians: [...state.technicians, newTech],
        }));
      },

      updateTechnician: (id, updates) => {
        set((state) => {
          const updatedTechs = state.technicians.map((t) => {
            if (t.id === id) {
              const updated = { ...t, ...updates };
              saveSupabaseTechnician(updated);
              return updated;
            }
            return t;
          });
          return { technicians: updatedTechs };
        });
      },

      toggleTechnicianActive: (id) => {
        set((state) => {
          const updatedTechs = state.technicians.map((t) => {
            if (t.id === id) {
              const updated = { ...t, is_active: !t.is_active };
              saveSupabaseTechnician(updated);
              return updated;
            }
            return t;
          });
          return { technicians: updatedTechs };
        });
      },

      vehicles: [
        {
          plate: "ABC-123",
          brand: "Toyota",
          model: "Yaris",
          year: 2021,
          color: "Plata Metallic",
          fuel_type: "GNV",
          owner_name: "Luis Fernando Alva",
          owner_phone: "+51 998877665",
          current_mileage: 45200,
          last_visit_date: new Date().toISOString(),
        },
        {
          plate: "XYZ-987",
          brand: "Hyundai",
          model: "Elantra",
          year: 2020,
          color: "Negro Azabache",
          fuel_type: "GLP",
          owner_name: "Mariana Torres",
          owner_phone: "+51 987654321",
          current_mileage: 62000,
          last_visit_date: new Date().toISOString(),
        },
      ],

      registerVehicle: (v) =>
        set((state) => {
          const exists = state.vehicles.some((existing) => existing.plate === v.plate);
          return {
            vehicles: exists
              ? state.vehicles.map((existing) => (existing.plate === v.plate ? v : existing))
              : [...state.vehicles, v],
          };
        }),

      workOrders: [
        {
          id: "ot-1001",
          vehicle_plate: "ABC-123",
          status: "en_servicio",
          assigned_technician_id: "tech-1",
          problem_description: "Falta de potencia en subida a GNV y tirones a 3000 RPM",
          diagnostic_notes: "Inyectores de gas obstruidos y presión de regulador baja a 1.1 bar.",
          entry_time: new Date(Date.now() - 3600000 * 3).toISOString(),
          items: [
            {
              id: "item-1",
              inventory_item_id: "inv-3",
              description: "Filtro de Gas Línea 14mm GNV/GLP",
              quantity: 1,
              unit_price: 35,
              subtotal: 35,
              dispatched: true,
            },
            {
              id: "item-2",
              description: "Limpieza y calibración de Rampa de Inyectores Valtek",
              quantity: 1,
              unit_price: 80,
              subtotal: 80,
              dispatched: true,
            },
          ],
        },
        {
          id: "ot-1002",
          vehicle_plate: "XYZ-987",
          status: "por_cobrar",
          assigned_technician_id: "tech-2",
          problem_description: "Certificación Anual GLP y mantenimiento de 15,000 km",
          diagnostic_notes: "Prueba de hermeticidad aprobada sin fugas. Emisiones dentro del rango.",
          entry_time: new Date(Date.now() - 3600000 * 5).toISOString(),
          items: [
            {
              id: "item-3",
              description: "Servicio de Mantenimiento Preventivo 15k GLP",
              quantity: 1,
              unit_price: 150,
              subtotal: 150,
              dispatched: true,
            },
            {
              id: "item-4",
              description: "Derecho de Certificación Anual GLP",
              quantity: 1,
              unit_price: 90,
              subtotal: 90,
              dispatched: true,
            },
          ],
        },
      ],

      createWorkOrder: (order) => {
        const newOrder: WorkOrder = {
          ...order,
          id: generateUUID(),
          entry_time: new Date().toISOString(),
          items: order.items || [],
        };
        saveSupabaseWorkOrder(newOrder);
        set((state) => ({
          workOrders: [...state.workOrders, newOrder],
        }));
      },

      updateWorkOrderStatus: (id, status) => {
        set((state) => {
          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === id) {
              const updated = { ...o, status };
              saveSupabaseWorkOrder(updated);
              return updated;
            }
            return o;
          });
          return { workOrders: updatedOrders };
        });
      },

      assignTechnicianToOrder: (orderId, techId) => {
        set((state) => {
          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === orderId) {
              const updated = { ...o, assigned_technician_id: techId };
              saveSupabaseWorkOrder(updated);
              return updated;
            }
            return o;
          });
          return { workOrders: updatedOrders };
        });
      },

      addWorkOrderItem: (orderId, item) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) => {
            if (o.id !== orderId) return o;
            const subtotal = item.quantity * item.unit_price;
            const newItem: WorkOrderItem = {
              ...item,
              id: `item-${Date.now()}`,
              subtotal,
              dispatched: false,
              requested_at: new Date().toISOString(),
            };
            const updatedOrder = {
              ...o,
              items: [...o.items, newItem],
            };
            saveSupabaseWorkOrder(updatedOrder);
            return updatedOrder;
          }),
        })),

      removeWorkOrderItem: (orderId, itemId) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) => {
            if (o.id !== orderId) return o;
            const updatedOrder = {
              ...o,
              items: o.items.filter((i) => i.id !== itemId),
            };
            saveSupabaseWorkOrder(updatedOrder);
            return updatedOrder;
          }),
        })),

      markWorkOrderItemDispatched: (orderId, itemId) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) => {
            if (o.id !== orderId) return o;
            const targetItem = o.items.find((i) => i.id === itemId);
            if (targetItem && targetItem.inventory_item_id && !targetItem.dispatched) {
              get().deductStock(targetItem.inventory_item_id, targetItem.quantity);
            }
            const updatedItems = o.items.map((i) =>
              i.id === itemId
                ? { ...i, dispatched: true, dispatched_at: new Date().toISOString() }
                : i
            );
            const updatedOrder = { ...o, items: updatedItems };
            saveSupabaseWorkOrder(updatedOrder);
            return updatedOrder;
          }),
        })),

      toggleWorkOrderItemDispatched: (orderId, itemId) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) => {
            if (o.id !== orderId) return o;
            const updatedItems = o.items.map((i) => {
              if (i.id === itemId) {
                const nextDispatched = !i.dispatched;
                if (nextDispatched && i.inventory_item_id) {
                  get().deductStock(i.inventory_item_id, i.quantity);
                }
                return {
                  ...i,
                  dispatched: nextDispatched,
                  dispatched_at: nextDispatched ? new Date().toISOString() : undefined,
                };
              }
              return i;
            });
            const updatedOrder = { ...o, items: updatedItems };
            saveSupabaseWorkOrder(updatedOrder);
            return updatedOrder;
          }),
        })),

      updateDiagnosticNotes: (orderId, notes) => {
        set((state) => {
          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === orderId) {
              const updated = {
                ...o,
                diagnostic_notes: notes,
                status: "en_diagnostico" as WorkOrderStatus,
              };
              saveSupabaseWorkOrder(updated);
              return updated;
            }
            return o;
          });
          return { workOrders: updatedOrders };
        });
      },
      toggleAllowModificationsInWorkshop: (orderId) => {
        set((state) => {
          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === orderId) {
              const updated = {
                ...o,
                allow_modifications: !o.allow_modifications,
              };
              saveSupabaseWorkOrder(updated);
              return updated;
            }
            return o;
          });
          return { workOrders: updatedOrders };
        });
      },

      deleteWorkOrder: (id) => {
        deleteSupabaseWorkOrder(id);
        set((state) => ({
          workOrders: state.workOrders.filter((o) => o.id !== id),
        }));
      },

      deleteMultipleWorkOrders: (ids) => {
        deleteSupabaseMultipleWorkOrders(ids);
        set((state) => ({
          workOrders: state.workOrders.filter((o) => !ids.includes(o.id)),
        }));
      },

      clearAllWorkOrders: () => {
        clearSupabaseWorkOrders();
        set({ workOrders: [] });
      },

      requestCertificationForWorkOrder: (orderId, certType, price) => {
        set((state) => {
          const targetOrder = state.workOrders.find((o) => o.id === orderId);
          if (!targetOrder) return state;

          const certId = `cert-${Date.now()}`;
          const newCert: Certification = {
            id: certId,
            work_order_id: orderId,
            vehicle_plate: targetOrder.vehicle_plate,
            client_name: "Cliente Taller",
            chip_code: `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
            cylinder_serial: `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
            certification_type: certType,
            issue_date: new Date().toISOString().slice(0, 10),
            expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            status: "Solicitado",
            price: price,
            is_ready: false,
          };

          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === orderId) {
              const updated = {
                ...o,
                requires_certification: true,
                certification_type: certType,
                certification_price: price,
                certification_issued: false,
                certification_id: certId,
              };
              saveSupabaseWorkOrder(updated);
              return updated;
            }
            return o;
          });

          return {
            workOrders: updatedOrders,
            certifications: [newCert, ...state.certifications],
          };
        });
      },

      inventoryItems: [
        {
          id: "inv-1",
          sku_barcode: "KIT-GNV-5G",
          name: "Kit Completo Conversión GNV 5ta Gen Tomasetto",
          brand: "Tomasetto Achille",
          serial_number: "TOM-5G-881",
          category: "Kits de Conversión",
          unit_price: 2800,
          initial_stock: 10,
          entries: 5,
          exits: 3,
          stock_quantity: 12,
          counted_stock: 12,
          min_stock_alert: 3,
        },
        {
          id: "inv-2",
          sku_barcode: "KIT-GLP-5G",
          name: "Kit Completo Conversión GLP 5ta Gen BRC",
          brand: "BRC Gas Equipment",
          serial_number: "BRC-GLP-992",
          category: "Kits de Conversión",
          unit_price: 2600,
          initial_stock: 5,
          entries: 5,
          exits: 2,
          stock_quantity: 8,
          counted_stock: 8,
          min_stock_alert: 2,
        },
        {
          id: "inv-3",
          sku_barcode: "FIL-GAS-14",
          name: "Filtro de Gas Línea 14mm GNV/GLP",
          brand: "Stag Autogas",
          serial_number: "STG-FL-14",
          category: "Filtros & Mantenimiento",
          unit_price: 35,
          initial_stock: 30,
          entries: 20,
          exits: 5,
          stock_quantity: 45,
          counted_stock: 45,
          min_stock_alert: 10,
        },
        {
          id: "inv-4",
          sku_barcode: "INY-VAL-4C",
          name: "Rampa de Inyectores Valtek 4 Cilindros",
          brand: "Valtek",
          serial_number: "VLT-30-4C",
          category: "Inyección de Gas",
          unit_price: 240,
          initial_stock: 10,
          entries: 8,
          exits: 3,
          stock_quantity: 15,
          counted_stock: 15,
          min_stock_alert: 4,
        },
        {
          id: "inv-5",
          sku_barcode: "RED-TOM-AT09",
          name: "Reductor de Presión Tomasetto AT09",
          brand: "Tomasetto Achille",
          serial_number: "RED-AT09-441",
          category: "Reductores",
          unit_price: 420,
          initial_stock: 8,
          entries: 4,
          exits: 3,
          stock_quantity: 9,
          counted_stock: 9,
          min_stock_alert: 2,
        },
      ],

      addInventoryItem: (item) => {
        const newItem = { ...item, id: `inv-${Date.now()}` };
        saveSupabaseInventoryItem(newItem);
        set((state) => ({
          inventoryItems: [...state.inventoryItems, newItem],
        }));
      },

      updateInventoryItem: (id, updates) => {
        set((state) => {
          const updatedItems = state.inventoryItems.map((i) => {
            if (i.id === id) {
              const updated = { ...i, ...updates };
              saveSupabaseInventoryItem(updated);
              return updated;
            }
            return i;
          });
          return { inventoryItems: updatedItems };
        });
      },

      deleteInventoryItem: (id) => {
        deleteSupabaseInventoryItem(id);
        set((state) => ({
          inventoryItems: state.inventoryItems.filter((i) => i.id !== id),
        }));
      },

      deleteMultipleInventoryItems: (ids) => {
        deleteMultipleSupabaseInventoryItems(ids);
        set((state) => ({
          inventoryItems: state.inventoryItems.filter((i) => !ids.includes(i.id)),
        }));
      },

      clearAllInventory: () => {
        clearSupabaseInventory();
        set({ inventoryItems: [] });
      },

      importBulkInventoryItems: (items) => {
        const newItems = items.map((item, idx) => ({
          ...item,
          id: `inv-${Date.now()}-${idx}`,
        }));
        newItems.forEach((i) => saveSupabaseInventoryItem(i));
        set((state) => ({
          inventoryItems: [...state.inventoryItems, ...newItems],
        }));
      },

      deductStock: (id, qty) => {
        set((state) => {
          const updatedItems = state.inventoryItems.map((i) => {
            if (i.id === id) {
              const updated = { ...i, stock_quantity: Math.max(0, i.stock_quantity - qty) };
              saveSupabaseInventoryItem(updated);
              return updated;
            }
            return i;
          });
          return { inventoryItems: updatedItems };
        });
      },

      toolLoans: [
        {
          id: "tool-1",
          tool_name: "Escáner Automotriz Multimarca Launch X431",
          serial_number: "SN-987123",
          technician_name: "Carlos Mendoza",
          borrowed_at: new Date(Date.now() - 7200000).toISOString(),
          status: "prestado",
          notes: "Diagnóstico de ECU en Hyundai XYZ-987",
        },
        {
          id: "tool-2",
          tool_name: "Manómetro Digital de Alta Presión GNV",
          serial_number: "MN-44512",
          technician_name: "Roberto Gómez",
          borrowed_at: new Date(Date.now() - 14400000).toISOString(),
          status: "prestado",
          notes: "Verificación de reductor Tomasetto",
        },
      ],

      addToolLoan: (loan) =>
        set((state) => ({
          toolLoans: [
            ...state.toolLoans,
            {
              ...loan,
              id: `loan-${Date.now()}`,
              borrowed_at: new Date().toISOString(),
              status: "prestado",
            },
          ],
        })),

      returnTool: (loanId) =>
        set((state) => ({
          toolLoans: state.toolLoans.map((tl) =>
            tl.id === loanId
              ? { ...tl, status: "devuelto", returned_at: new Date().toISOString() }
              : tl
          ),
        })),

      invoices: [
        {
          id: "inv-2001",
          work_order_id: "ot-1002",
          vehicle_plate: "XYZ-987",
          client_name: "Mariana Torres",
          labor_fee: 150,
          parts_total: 0,
          certification_fee: 90,
          grand_total: 240,
          payment_status: "pendiente",
          payment_method: "Efectivo",
          issued_at: new Date().toISOString(),
        },
      ],

      createInvoice: (invoiceData) =>
        set((state) => {
          const newInvoice: Invoice = {
            ...invoiceData,
            id: generateUUID(),
          };
          saveSupabaseInvoice(newInvoice);
          return { invoices: [...state.invoices, newInvoice] };
        }),

      createInvoiceForOrder: (orderId, laborFee, certFee, method) =>
        set((state) => {
          const order = state.workOrders.find((o) => o.id === orderId);
          if (!order) return state;
          const vehicle = state.vehicles.find((v) => v.plate === order.vehicle_plate);
          const partsTotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
          const grandTotal = laborFee + partsTotal + certFee;

          const newInvoice: Invoice = {
            id: generateUUID(),
            work_order_id: orderId,
            vehicle_plate: order.vehicle_plate,
            client_name: vehicle?.owner_name || "Cliente Taller",
            labor_fee: laborFee,
            parts_total: partsTotal,
            certification_fee: certFee,
            grand_total: grandTotal,
            payment_status: "pendiente",
            payment_method: method,
            issued_at: new Date().toISOString(),
          };

          saveSupabaseInvoice(newInvoice);

          const updatedOrders = state.workOrders.map((o) =>
            o.id === orderId ? { ...o, status: "por_cobrar" as WorkOrderStatus } : o
          );

          return {
            invoices: [...state.invoices, newInvoice],
            workOrders: updatedOrders,
          };
        }),

      importBulkWorkshopData: ({ vehicles: newVehicles, workOrders: newOrders, invoices: newInvoices }) => {
        saveSupabaseBulkWorkshopData(newVehicles, newOrders, newInvoices);
        set((state) => {
          // Merge vehicles by plate without duplicates
          const existingPlates = new Set(state.vehicles.map((v) => v.plate));
          const filteredVehicles = newVehicles.filter((v) => !existingPlates.has(v.plate));

          return {
            vehicles: [...state.vehicles, ...filteredVehicles],
            workOrders: [...newOrders, ...state.workOrders],
            invoices: [...newInvoices, ...state.invoices],
          };
        });
      },

      payInvoice: (invoiceId) =>
        set((state) => {
          const targetInvoice = state.invoices.find((i) => i.id === invoiceId);
          if (!targetInvoice) return state;

          const updatedInvoice = {
            ...targetInvoice,
            payment_status: "pagado" as const,
            paid_at: new Date().toISOString(),
          };
          saveSupabaseInvoice(updatedInvoice);

          const updatedInvoices = state.invoices.map((i) =>
            i.id === invoiceId ? updatedInvoice : i
          );

          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === targetInvoice.work_order_id) {
              const updatedOrder = { ...o, status: "pagado_autorizado" as WorkOrderStatus };
              saveSupabaseWorkOrder(updatedOrder);
              return updatedOrder;
            }
            return o;
          });

          return {
            invoices: updatedInvoices,
            workOrders: updatedOrders,
          };
        }),

      togglePayInvoice: (invoiceId) =>
        set((state) => {
          const targetInvoice = state.invoices.find((i) => i.id === invoiceId);
          if (!targetInvoice) return state;

          const isCurrentlyPaid = targetInvoice.payment_status === "pagado";
          const nextStatus = isCurrentlyPaid ? ("pendiente" as const) : ("pagado" as const);
          const updatedInvoice = {
            ...targetInvoice,
            payment_status: nextStatus,
            paid_at: nextStatus === "pagado" ? new Date().toISOString() : undefined,
          };
          saveSupabaseInvoice(updatedInvoice);

          const updatedInvoices = state.invoices.map((i) =>
            i.id === invoiceId ? updatedInvoice : i
          );

          const updatedOrders = state.workOrders.map((o) => {
            if (o.id === targetInvoice.work_order_id) {
              const nextOrderStatus = isCurrentlyPaid ? ("por_cobrar" as WorkOrderStatus) : ("pagado_autorizado" as WorkOrderStatus);
              const updatedOrder = { ...o, status: nextOrderStatus };
              saveSupabaseWorkOrder(updatedOrder);
              return updatedOrder;
            }
            return o;
          });

          return {
            invoices: updatedInvoices,
            workOrders: updatedOrders,
          };
        }),

      appointments: [
        {
          id: "app-1",
          client_name: "Jorge Ramírez",
          client_phone: "+51 977112233",
          plate: "B7V-456",
          service_type: "Conversión a GNV 5ta Gen",
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          status: "confirmado",
          notes: "Cliente solicita tanque cilíndrico de 55L",
        },
        {
          id: "app-2",
          client_name: "Elena Paredes",
          client_phone: "+51 966445566",
          plate: "F9K-112",
          service_type: "Mantenimiento 15,000 km",
          scheduled_date: new Date(Date.now() + 172800000).toISOString(),
          status: "pendiente",
        },
      ],

      addAppointment: (app) => {
        const newApp: Appointment = {
          ...app,
          id: `app-${Date.now()}`,
          status: "pendiente",
        };
        saveSupabaseAppointment(newApp);
        set((state) => ({
          appointments: [...state.appointments, newApp],
        }));
      },

      updateAppointmentStatus: (id, status) => {
        set((state) => {
          const updatedApps = state.appointments.map((a) => {
            if (a.id === id) {
              const updated = { ...a, status };
              saveSupabaseAppointment(updated);
              return updated;
            }
            return a;
          });
          return { appointments: updatedApps };
        });
      },

      updateAppointment: (id, updates) => {
        set((state) => {
          const updatedApps = state.appointments.map((a) => {
            if (a.id === id) {
              const updated = { ...a, ...updates };
              saveSupabaseAppointment(updated);
              return updated;
            }
            return a;
          });
          return { appointments: updatedApps };
        });
      },

      deleteAppointment: (id) => {
        deleteSupabaseAppointment(id);
        set((state) => ({
          appointments: state.appointments.filter((a) => a.id !== id),
        }));
      },

      certifications: [
        {
          id: "cert-1",
          vehicle_plate: "ABC-123",
          client_name: "Luis Fernando Alva",
          chip_code: "GNV-PE-987123",
          cylinder_serial: "CYL-2021-00441",
          certification_type: "Anual GNV",
          issue_date: "2025-08-10",
          expiry_date: "2026-08-10",
          status: "Por Vencer",
        },
        {
          id: "cert-2",
          vehicle_plate: "XYZ-987",
          client_name: "Mariana Torres",
          chip_code: "GLP-PE-554129",
          cylinder_serial: "TOR-2022-77112",
          certification_type: "Anual GLP",
          issue_date: "2026-02-15",
          expiry_date: "2027-02-15",
          status: "Vigente",
        },
      ],

      addCertification: (cert) =>
        set((state) => ({
          certifications: [
            ...state.certifications,
            { ...cert, id: `cert-${Date.now()}` },
          ],
        })),

      attendanceLogs: [
        {
          id: "att-1",
          employee_name: "Carlos Mendoza",
          check_time: "2026-08-08 07:54:12",
          log_type: "Entrada",
          source_file: "BIOMETRICO_AGOSTO_2026.TXT",
        },
        {
          id: "att-2",
          employee_name: "Roberto Gómez",
          check_time: "2026-08-08 08:01:05",
          log_type: "Entrada",
          source_file: "BIOMETRICO_AGOSTO_2026.TXT",
        },
      ],

      addAttendanceLogs: (logs) =>
        set((state) => ({
          attendanceLogs: [
            ...state.attendanceLogs,
            ...logs.map((l) => ({ ...l, id: `att-${Date.now()}-${Math.random()}` })),
          ],
        })),
    }),
    {
      name: "reygas-app-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
