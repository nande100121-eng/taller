"use client";

import { create } from "zustand";
import {
  fetchSupabaseSiteContent,
  hasRecentLocalMutation,
  saveSupabaseSiteContent,
  saveFullSiteContentToSupabase,
  saveSupabaseTechnician,
  deleteSupabaseTechnician,
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
  saveSupabaseCertification,
  saveSupabaseScheduleRecord,
  deleteSupabaseScheduleRecord,
  deleteSupabaseMultipleScheduleRecords,
  clearSupabaseScheduleRecords,
  saveSupabaseBulkScheduleRecords,
  saveSupabaseBulkInventory,
  broadcastRealtimeChange,
  fetchSupabaseServices,
  fetchSupabaseCertifications,
  fetchSupabaseScheduleRecords,
  fetchSupabaseInventory,
  fetchSupabaseTechnicians,
} from "@/lib/supabase/services";
import { getPeruDateString } from "@/lib/utils/date-utils";

export const ALL_ERP_STATIONS_DEFAULT = [
  "/dashboard/porteria",
  "/dashboard/recepcion",
  "/dashboard/taller",
  "/dashboard/almacen",
  "/dashboard/caja",
  "/dashboard/certificaciones",
  "/dashboard/asistencia",
  "/dashboard/consultas",
  "/dashboard/reportes",
  "/dashboard/admin/tables",
  "/dashboard/configuracion",
];

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

export function parseISODate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim() || dateStr.trim() === "-") {
    return new Date().toISOString();
  }
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    let part1 = parseInt(parts[0], 10);
    let part2 = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    let day = part1;
    let month = part2;
    if (part1 > 12 && part2 <= 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1;
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const d = new Date(`${year}-${pad(month)}-${pad(day)}T12:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return new Date().toISOString();
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

export interface WorkshopService {
  id: string;
  name: string;
  category?: string;
  price: number;
  description?: string;
  is_active?: boolean;
}

export function generateDefaultUsername(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const initial = parts[0].charAt(0);
  const lastName = parts[parts.length - 1];
  return `${initial}${lastName}`;
}

export interface Technician {
  id: string;
  full_name: string;
  specialty: string;
  phone: string;
  email?: string;
  username?: string;
  password?: string;
  is_active: boolean;
  allowed_tabs?: string[]; // Allowed dashboard stations / routes for this user
  can_receive_payment?: boolean; // Habilitado como destino de pago (personal / empresa)
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
  vehicle_type?: string; // TIPO (e.g. Automóvil, Moto, etc.)
}

export type WorkOrderStatus =
  | "ingresado"
  | "en_diagnostico"
  | "esperando_repuestos"
  | "en_servicio"
  | "por_cobrar"
  | "pendiente_pago"
  | "pagado_autorizado"
  | "finalizado";

export interface WorkOrderItem {
  id: string;
  inventory_item_id?: string;
  item_type?: "repuesto" | "servicio";
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
  observations?: string; // OBSERVACIONES ADICIONALES
  entry_time: string;
  completion_time?: string;
  items: WorkOrderItem[];
  requires_certification?: boolean;
  certification_type?: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática";
  certification_price?: number;
  certification_issued?: boolean;
  certification_id?: string;
  allow_modifications?: boolean;
  vehicle_type?: string; // TIPO
  quinquennial_date?: string; // FECHA QUINTENAL
  chip_expiry_date?: string; // FECHA CHIP ANUAL
  general_maintenance_service?: string; // MANT. GENERAL / SERVICIO
  spare_parts_services?: string; // REPUESTOS Y SERVICIOS
  discount_amount?: number; // DESCUENTO MONTO (S/)
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
  counted_status?: string; // CONTADOS (e.g. "NO CONTADO", "CONTADO", or exact string from CSV)
  min_stock_alert: number;
  image_url?: string; // URL o Base64 de la imagen propia del producto
}

export interface InventoryIngresoRecord {
  id: string;
  itemId?: string;
  sku: string;
  name: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  timestamp: string;
  notes?: string;
  isNew?: boolean;
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

export interface CorrelativeConfig {
  ticketSeries: string;
  ticketLastNumber: number;
  boletaSeries: string;
  boletaLastNumber: number;
  facturaSeries: string;
  facturaLastNumber: number;
  notaCreditoSeries?: string;
  notaCreditoLastNumber?: number;
  lastUpdateDate: string;
}

export interface PaymentSplit {
  id?: string;
  method: string;
  destination: string;
  amount: number;
  reference?: string;
}

export interface Invoice {
  id: string;
  work_order_id: string;
  vehicle_plate: string;
  client_name: string;
  customer_doc?: string; // DNI (8 dígitos) o RUC (11 dígitos)
  customer_address?: string; // Dirección fiscal o domicilio
  labor_fee: number;
  parts_total: number;
  certification_fee: number;
  grand_total: number;
  payment_status: "pendiente" | "pagado";
  payment_method: string;
  issued_at: string;
  paid_at?: string;
  receipt_number?: string; // N° de boleta/Factura/Ticket (ej: TK01-00004545, B001-00000259, F001-00000282)
  receipt_type?: string; // COMPROBANTE ("Ticket" | "Boleta" | "Factura")
  discounts?: string | number; // DESCUENTOS
  credit_amount?: number; // Credito
  raw_price_str?: string; // Precio original de CSV (ej: $80.00, 80, 0, etc.)
  raw_credit_str?: string; // Crédito original de CSV (ej: $40.00, 40, etc.)
  payment_condition?: string; // Condicion (Contado/Crédito)
  payment_destination?: string; // DESTINO DE PAGO (Empresa, Personal)
  observations?: string; // OBSERVACIONES DEL COMPROBANTE
  payment_breakdown?: PaymentSplit[]; // Desglose de pagos parciales / métodos mixtos
  credit_note_number?: string; // N° de Nota de Crédito emitida si se anula Factura
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
  certification_type: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática" | string;
  issue_date: string;
  expiry_date: string; // Fecha de Anual
  quinquennial_date?: string; // Fecha de Quinquenal
  status: "Vigente" | "Vencido" | "Por Vencer" | "Solicitado" | string;
  price?: number;
  is_ready?: boolean;
}

export interface ScheduleRecord {
  id: string;
  vehicle_plate: string;
  client_name: string;
  client_phone: string;
  current_mileage?: number;
  service_date?: string; // Fecha del servicio brindado
  service_name?: string; // Mantenimiento / Servicio
  expiry_quinquennial?: string; // Vencimiento Quinquenal
  expiry_chip_annual?: string; // Vencimiento Chip / Anual
  next_maintenance_date?: string; // Próximo Mantenimiento
  scheduled_date?: string; // Fecha y Hora programada
  status?: "programado" | "pendiente" | "atendido" | "vencido" | string;
  notes?: string;
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
  // Global Toast / Notification Feedback (visible save/error state)
  notification: { id: number; type: "success" | "error" | "info"; message: string } | null;
  notify: (type: "success" | "error" | "info", message: string) => void;
  clearNotification: () => void;

  // Authentication State
  isAuthenticated: boolean;
  userRole: "admin" | "personal" | null;
  currentUser: { name: string; email: string; technician_id?: string; allowed_tabs?: string[] } | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;

  // Visual Editing Toggle
  isVisualEditing: boolean;
  toggleVisualEditing: () => void;

  // AI Configuration Settings
  aiSettings: AISettings;
  updateAISettings: (settings: Partial<AISettings>) => Promise<void>;

  // Workshop Services Catalog (Configurable in Tabla Maestra)
  workshopServices: WorkshopService[];
  addWorkshopService: (service: Omit<WorkshopService, "id">) => Promise<void>;
  updateWorkshopService: (id: string, updates: Partial<WorkshopService>) => Promise<void>;
  deleteWorkshopService: (id: string) => Promise<void>;

  // Supabase Fetch Initializer & Granular Fast Sync (Ultra-Low Latency <50ms)
  isSyncing: boolean;
  hasSyncedOnce: boolean;
  syncFromSupabase: () => Promise<void>;
  syncServicesOnly: () => Promise<void>;
  syncCertificationsOnly: () => Promise<void>;
  syncInventoryOnly: () => Promise<void>;
  syncTechniciansOnly: () => Promise<void>;
  syncScheduleOnly: () => Promise<void>;
  saveAllToSupabase: () => Promise<boolean>;

  siteContent: SiteContent;
  updateSiteContent: (key: keyof SiteContent, data: any) => void;
  updateTheme: (themeData: Partial<SiteTheme>) => void;

  technicians: Technician[];
  addTechnician: (tech: Omit<Technician, "id">) => Promise<{ success: boolean; error?: string }>;
  updateTechnician: (id: string, tech: Partial<Technician>) => Promise<{ success: boolean; error?: string }>;
  changeTechnicianPassword: (identifier: string, newPass: string) => { success: boolean; message: string; technician?: Technician };
  toggleTechnicianActive: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteTechnician: (id: string) => void;

  vehicles: Vehicle[];
  registerVehicle: (v: Vehicle) => void;
  updateVehicle: (plate: string, updates: Partial<Vehicle>) => void;

  workOrders: WorkOrder[];
  createWorkOrder: (order: Omit<WorkOrder, "id" | "entry_time" | "items"> & { id?: string; entry_time?: string; items?: WorkOrderItem[] }) => void;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  assignTechnicianToOrder: (orderId: string, techId: string) => void;
  addWorkOrderItem: (orderId: string, item: Omit<WorkOrderItem, "id" | "subtotal">) => void;
  addMultipleWorkOrderItems: (orderId: string, items: Omit<WorkOrderItem, "id" | "subtotal">[]) => void;
  updateWorkOrderItem: (orderId: string, itemId: string, updates: Partial<WorkOrderItem>) => void;
  removeWorkOrderItem: (orderId: string, itemId: string) => void;
  markWorkOrderItemDispatched: (orderId: string, itemId: string) => void;
  toggleWorkOrderItemDispatched: (orderId: string, itemId: string) => void;
  markAllWorkOrderItemsDispatched: (orderId?: string) => void;
  markAllMigratedWorkOrderItemsDispatched: (cutoffDate?: string) => void;
  updateDiagnosticNotes: (orderId: string, notes: string) => void;
  updateDiagnosticAndObservations: (orderId: string, notes: string, observations?: string) => void;
  toggleAllowModificationsInWorkshop: (orderId: string) => void;
  deleteWorkOrder: (id: string) => void;
  deleteMultipleWorkOrders: (ids: string[]) => void;
  clearAllWorkOrders: () => void;
  requestCertificationForWorkOrder: (
    orderId: string,
    certType: "Anual GNV" | "Anual GLP" | "Prueba Hidrostática",
    price: number
  ) => void;
  removeCertificationFromWorkOrder: (orderId: string) => void;
  setWorkOrderDiscount: (orderId: string, amount: number) => void;

  inventoryItems: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, "id">) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  deleteMultipleInventoryItems: (ids: string[]) => void;
  clearAllInventory: () => void;
  importBulkInventoryItems: (items: Omit<InventoryItem, "id">[]) => Promise<{ success: boolean; count: number; errorMsg?: string }>;
  deductStock: (id: string, qty: number) => void;

  recentIngresos: InventoryIngresoRecord[];
  addRecentIngreso: (record: Omit<InventoryIngresoRecord, "id" | "timestamp"> & { id?: string; timestamp?: string }) => void;
  removeRecentIngreso: (id: string) => void;
  clearRecentIngresos: () => void;

  toolLoans: ToolLoan[];
  addToolLoan: (loan: Omit<ToolLoan, "id" | "borrowed_at" | "status">) => void;
  returnTool: (loanId: string) => void;

  correlativeConfig: CorrelativeConfig;
  updateCorrelativeConfig: (config: Partial<CorrelativeConfig>) => void;
  getAndIncrementReceiptNumber: (type: "Ticket" | "Boleta" | "Factura", targetDate?: string) => string;

  invoices: Invoice[];
  createInvoice: (invoice: Omit<Invoice, "id">) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  createInvoiceForOrder: (orderId: string, laborFee: number, certFee: number, method: string) => void;
  payInvoice: (invoiceId: string) => void;
  togglePayInvoice: (invoiceId: string) => void;
  toggleOrderPayment: (orderId: string, invoiceId?: string) => void;
  confirmInvoicePayment: (params: {
    invoiceId?: string;
    workOrderId?: string;
    paymentMethod: string;
    paymentDestination: string;
    receiptNumber?: string;
    receiptType?: string;
    customerDoc?: string;
    customerName?: string;
    customerAddress?: string;
    paymentBreakdown?: PaymentSplit[];
  }) => void;
  registerDirectWorkshopPayment: (data: {
    vehicle_plate: string;
    brand?: string;
    fuel_type?: "GNV" | "GLP" | "Gasolina" | "Bifuel";
    vehicle_type?: string;
    current_mileage?: number;
    owner_name?: string;
    owner_phone?: string;
    customer_doc?: string;
    customer_address?: string;
    entry_time: string;
    technician_name?: string;
    problem_description?: string;
    general_maintenance_service?: string;
    spare_parts_services?: string;
    price: number;
    discounts?: string;
    credit_amount?: number;
    payment_condition?: string;
    payment_method?: string;
    payment_destination?: string;
    receipt_type?: string;
    receipt_number?: string;
    quinquennial_date?: string;
    chip_expiry_date?: string;
    payment_breakdown?: PaymentSplit[];
  }) => { workOrder: WorkOrder; invoice: Invoice };
  importBulkWorkshopData: (data: { vehicles: Vehicle[]; workOrders: WorkOrder[]; invoices: Invoice[] }) => Promise<{ success: boolean; errorMsg?: string }>;
  mergeWorkshopRecords: (data: { vehicles?: Vehicle[]; workOrders?: WorkOrder[]; invoices?: Invoice[] }) => void;
  setBulkWorkshopData: (data: { vehicles: Vehicle[]; workOrders: WorkOrder[]; invoices: Invoice[] }) => void;

  appointments: Appointment[];
  addAppointment: (app: Omit<Appointment, "id" | "status">) => void;
  updateAppointmentStatus: (id: string, status: Appointment["status"]) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  certifications: Certification[];
  addCertification: (cert: Omit<Certification, "id">) => void;
  updateCertificationPrice: (id: string, price: number) => void;
  updateCertification: (id: string, updates: Partial<Certification>) => void;

  scheduleRecords: ScheduleRecord[];
  addScheduleRecord: (record: Omit<ScheduleRecord, "id">) => void;
  updateScheduleRecord: (id: string, updates: Partial<ScheduleRecord>) => void;
  deleteScheduleRecord: (id: string) => void;
  deleteMultipleScheduleRecords: (ids: string[]) => void;
  clearAllScheduleRecords: () => void;
  setBulkScheduleRecords: (records: ScheduleRecord[]) => void;
  importBulkScheduleRecords: (records: ScheduleRecord[]) => Promise<{ success: boolean; errorMsg?: string }>;

  attendanceLogs: AttendanceLog[];
  addAttendanceLogs: (logs: Omit<AttendanceLog, "id">[]) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  notification: null,
  notify: (type, message) => {
    set({ notification: { id: Date.now(), type, message } });
  },
  clearNotification: () => set({ notification: null }),

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
      // Find matching technician
      const matchedTech = get().technicians.find(
        (t) => t.full_name.toLowerCase() === email.toLowerCase() || t.id === pass
      );
      set({
        isAuthenticated: true,
        userRole: "personal",
        currentUser: {
          name: matchedTech ? matchedTech.full_name : "Operador de Taller",
          email,
          technician_id: matchedTech?.id,
          allowed_tabs: matchedTech?.allowed_tabs,
        },
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
  updateAISettings: async (settings) => {
    const prev = get().aiSettings;
    const next = { ...prev, ...settings };
    set({ aiSettings: next });
    const res = await saveSupabaseSiteContent("aiSettings", next);
    if (!res.success) {
      console.error("updateAISettings rollback:", res.error);
      set({ aiSettings: prev });
    }
  },

  correlativeConfig: {
    ticketSeries: "TK01",
    ticketLastNumber: 4545,
    boletaSeries: "B001",
    boletaLastNumber: 259,
    facturaSeries: "F001",
    facturaLastNumber: 282,
    lastUpdateDate: getPeruDateString(),
  },
  updateCorrelativeConfig: async (config) => {
    const prev = get().correlativeConfig;
    const next = { ...prev, ...config };
    set({ correlativeConfig: next });
    const res = await saveSupabaseSiteContent("correlativeConfig", next);
    if (!res.success) {
      console.error("updateCorrelativeConfig rollback:", res.error);
      set({ correlativeConfig: prev });
    }
  },
  getAndIncrementReceiptNumber: (type: "Ticket" | "Boleta" | "Factura", targetDate?: string) => {
    const state = get();
    const current = state.correlativeConfig || {
      ticketSeries: "TK01",
      ticketLastNumber: 4545,
      boletaSeries: "B001",
      boletaLastNumber: 259,
      facturaSeries: "F001",
      facturaLastNumber: 282,
      lastUpdateDate: getPeruDateString(),
    };

    const effectiveDate = targetDate || getPeruDateString();
    const allInvoices = state.invoices || [];

    // Scan existing invoices in the database/store to find the maximum existing number for this receipt type
    let maxExistingInDb = 0;
    allInvoices.forEach((inv) => {
      const numStr = (inv.receipt_number || "").trim();
      if (!numStr) return;

      const upper = numStr.toUpperCase();
      const isFactura = inv.receipt_type === "Factura" || upper.startsWith("F0") || upper.startsWith("F1") || upper.startsWith("FA");
      const isBoleta = inv.receipt_type === "Boleta" || upper.startsWith("B0") || upper.startsWith("B1") || upper.startsWith("BO");
      const isTicket = inv.receipt_type === "Ticket" || upper.startsWith("TK") || upper.startsWith("T0") || (!isFactura && !isBoleta);

      let matches = false;
      if (type === "Factura" && isFactura) matches = true;
      else if (type === "Boleta" && isBoleta) matches = true;
      else if (type === "Ticket" && isTicket) matches = true;

      if (matches) {
        // Extract trailing numbers or numerical part
        const clean = parseInt(numStr.replace(/\D/g, ""), 10);
        if (!isNaN(clean) && clean > maxExistingInDb && clean < 99999999) {
          maxExistingInDb = clean;
        }
      }
    });

    let nextNum = 1;
    let series = "TK01";
    let nextConfig: CorrelativeConfig;

    if (type === "Factura") {
      const configuredBase = Number(current.facturaLastNumber) || 0;
      const highestBase = Math.max(configuredBase, maxExistingInDb);
      nextNum = highestBase + 1;
      series = current.facturaSeries || "F001";
      nextConfig = {
        ...current,
        facturaLastNumber: nextNum,
        lastUpdateDate: effectiveDate,
      };
    } else if (type === "Boleta") {
      const configuredBase = Number(current.boletaLastNumber) || 0;
      const highestBase = Math.max(configuredBase, maxExistingInDb);
      nextNum = highestBase + 1;
      series = current.boletaSeries || "B001";
      nextConfig = {
        ...current,
        boletaLastNumber: nextNum,
        lastUpdateDate: effectiveDate,
      };
    } else {
      // Ticket
      const configuredBase = Number(current.ticketLastNumber) || 0;
      const highestBase = Math.max(configuredBase, maxExistingInDb);
      nextNum = highestBase + 1;
      series = current.ticketSeries || "TK01";
      nextConfig = {
        ...current,
        ticketLastNumber: nextNum,
        lastUpdateDate: effectiveDate,
      };
    }

    set({ correlativeConfig: nextConfig });
    saveSupabaseSiteContent("correlativeConfig", nextConfig).then((res) => {
      if (!res.success) {
        console.error("getAndIncrementReceiptNumber rollback:", res.error);
        set({ correlativeConfig: current });
      }
    });

    const padded = nextNum.toString().padStart(8, "0");
    return `${series}-${padded}`;
  },

  workshopServices: [],

  addWorkshopService: async (service) => {
    const prev = get().workshopServices;
    const newService: WorkshopService = {
      ...service,
      id: `ws-${Date.now()}`,
      is_active: service.is_active ?? true,
    };
    const updated = [...prev, newService];
    set({ workshopServices: updated });
    const [res1, res2] = await Promise.all([
      saveSupabaseSiteContent("workshopServices", updated, "services"),
      saveSupabaseSiteContent("services", updated, "services"),
    ]);
    if (!res1.success || !res2.success) {
      console.error("addWorkshopService rollback:", res1.error || res2.error);
      set({ workshopServices: prev });
    }
  },

  updateWorkshopService: async (id, updates) => {
    const prev = get().workshopServices;
    const updated = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    set({ workshopServices: updated });
    const [res1, res2] = await Promise.all([
      saveSupabaseSiteContent("workshopServices", updated, "services"),
      saveSupabaseSiteContent("services", updated, "services"),
    ]);
    if (!res1.success || !res2.success) {
      console.error("updateWorkshopService rollback:", res1.error || res2.error);
      set({ workshopServices: prev });
    }
  },

  deleteWorkshopService: async (id) => {
    const prev = get().workshopServices;
    const updated = prev.filter((s) => s.id !== id);
    set({ workshopServices: updated });
    const [res1, res2] = await Promise.all([
      saveSupabaseSiteContent("workshopServices", updated, "services"),
      saveSupabaseSiteContent("services", updated, "services"),
    ]);
    if (!res1.success || !res2.success) {
      console.error("deleteWorkshopService rollback:", res1.error || res2.error);
      set({ workshopServices: prev });
    }
  },

  isSyncing: false,
  hasSyncedOnce: false,

  // Ultra-fast targeted sync for Services Catalog (~15ms, 0 freeze)
  syncServicesOnly: async () => {
    try {
      if (hasRecentLocalMutation("workshopServices") || hasRecentLocalMutation("services")) return;
      const services = await fetchSupabaseServices();
      if (Array.isArray(services) && services.length > 0) {
        set((state) => ({ workshopServices: services }));
      }
    } catch { }
  },

  // Ultra-fast targeted sync for Certifications Catalog (~20ms)
  syncCertificationsOnly: async () => {
    try {
      if (hasRecentLocalMutation("certifications")) return;
      const certs = await fetchSupabaseCertifications();
      if (Array.isArray(certs) && certs.length > 0) {
        set((state) => ({ certifications: certs }));
      }
    } catch { }
  },

  // Ultra-fast targeted sync for Inventory (~30ms)
  syncInventoryOnly: async () => {
    try {
      if (hasRecentLocalMutation("inventory")) return;
      const items = await fetchSupabaseInventory();
      if (Array.isArray(items) && items.length > 0) {
        set((state) => ({ inventoryItems: items }));
      }
    } catch { }
  },

  // Ultra-fast targeted sync for Technicians & Permissions (~15ms)
  syncTechniciansOnly: async () => {
    try {
      if (hasRecentLocalMutation("technicians")) return;
      const techs = await fetchSupabaseTechnicians();
      if (Array.isArray(techs) && techs.length > 0) {
        set((state) => ({
          technicians: techs.map((t) => ({
            ...t,
            username: t.username || generateDefaultUsername(t.full_name),
            password: t.password || generateDefaultUsername(t.full_name),
            can_receive_payment: !!t.can_receive_payment,
          })),
        }));
      }
    } catch { }
  },

  // Ultra-fast targeted sync for Schedule & Expirations (~25ms)
  syncScheduleOnly: async () => {
    try {
      if (hasRecentLocalMutation("schedule")) return;
      const records = await fetchSupabaseScheduleRecords();
      if (Array.isArray(records) && records.length > 0) {
        set((state) => ({ scheduleRecords: records }));
      }
    } catch { }
  },

  // Full Supabase Sync (On-Demand / Background Real-time Trigger)
  syncFromSupabase: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });

    try {
      const erpData = await fetchSupabaseErpData();

      if (erpData) {
        const updates: Partial<AppState> = { hasSyncedOnce: true };
        const state = get();

        if (erpData.cmsData) {
          const cmsData = erpData.cmsData;
          const sanitizedCms: Partial<SiteContent> = { ...cmsData };
          delete (sanitizedCms as any).all_inventory_records;
          delete (sanitizedCms as any).all_technicians;
          delete (sanitizedCms as any).all_schedule_records;
          delete (sanitizedCms as any).master_workshop_backup;

          // Merge CMS section-by-section, protecting sections with recent local mutations
          const mergedCms: any = { ...state.siteContent };
          const CMS_SECTIONS = ["theme", "hero", "navbar", "contact", "metrics", "calculator", "about", "services_header", "footer"];
          for (const section of CMS_SECTIONS) {
            if (hasRecentLocalMutation(section)) continue;
            const remote = (sanitizedCms as any)[section];
            if (remote === undefined) continue;
            mergedCms[section] = {
              ...(state.siteContent as any)[section],
              ...remote,
            };
          }
          // Non-nested sections (services, gallery, booking_modal, location_map, etc.)
          Object.keys(sanitizedCms as any).forEach((section) => {
            if (CMS_SECTIONS.includes(section)) return;
            if (hasRecentLocalMutation(section)) return;
            (mergedCms as any)[section] = (sanitizedCms as any)[section];
          });
          updates.siteContent = mergedCms;
          // Sync AI Settings from Supabase if present (protect recent local mutations)
          if ((cmsData as any).aiSettings && !hasRecentLocalMutation("aiSettings")) {
            updates.aiSettings = { ...state.aiSettings, ...(cmsData as any).aiSettings };
          }
          // Sync Correlative Config from Supabase if present (protect recent local mutations)
          const rawCorrel = (cmsData as any).correlativeConfig || (cmsData as any).correlative_config;
          if (rawCorrel && typeof rawCorrel === "object" && !hasRecentLocalMutation("correlativeConfig")) {
            updates.correlativeConfig = {
              ticketSeries: rawCorrel.ticketSeries || state.correlativeConfig?.ticketSeries || "TK01",
              ticketLastNumber: Number(rawCorrel.ticketLastNumber !== undefined ? rawCorrel.ticketLastNumber : (state.correlativeConfig?.ticketLastNumber || 4545)),
              boletaSeries: rawCorrel.boletaSeries || state.correlativeConfig?.boletaSeries || "B001",
              boletaLastNumber: Number(rawCorrel.boletaLastNumber !== undefined ? rawCorrel.boletaLastNumber : (state.correlativeConfig?.boletaLastNumber || 259)),
              facturaSeries: rawCorrel.facturaSeries || state.correlativeConfig?.facturaSeries || "F001",
              facturaLastNumber: Number(rawCorrel.facturaLastNumber !== undefined ? rawCorrel.facturaLastNumber : (state.correlativeConfig?.facturaLastNumber || 282)),
              notaCreditoSeries: rawCorrel.notaCreditoSeries || state.correlativeConfig?.notaCreditoSeries || "FC01",
              notaCreditoLastNumber: Number(rawCorrel.notaCreditoLastNumber !== undefined ? rawCorrel.notaCreditoLastNumber : (state.correlativeConfig?.notaCreditoLastNumber || 0)),
              lastUpdateDate: rawCorrel.lastUpdateDate || state.correlativeConfig?.lastUpdateDate || getPeruDateString(),
            };
          }
          // Sync Workshop Services Catalog from Supabase if present (protect recent local mutations)
          const srvList = (cmsData as any).services || (cmsData as any).workshopServices || erpData?.workshopServices;
          if (Array.isArray(srvList) && srvList.length > 0 && !hasRecentLocalMutation("workshopServices") && !hasRecentLocalMutation("services")) {
            updates.workshopServices = srvList;
          }
        }
        if (Array.isArray(erpData?.technicians) && erpData.technicians.length > 0 && !hasRecentLocalMutation("technicians")) {
          const localTechMap = new Map(state.technicians.map((t) => [t.id, t]));
          const localNameMap = new Map(state.technicians.map((t) => [t.full_name.trim().toLowerCase(), t]));

          updates.technicians = erpData.technicians.map((et) => {
            const existing = localTechMap.get(et.id) || localNameMap.get((et.full_name || "").trim().toLowerCase());
            const allowed = Array.isArray(et.allowed_tabs)
              ? et.allowed_tabs
              : (Array.isArray(existing?.allowed_tabs) ? existing.allowed_tabs : undefined);

            return {
              ...existing,
              ...et,
              allowed_tabs: allowed,
              can_receive_payment: et.can_receive_payment !== undefined ? !!et.can_receive_payment : (existing?.can_receive_payment !== undefined ? !!existing.can_receive_payment : false),
              email: et.email || existing?.email || "",
              username: et.username || existing?.username || generateDefaultUsername(et.full_name),
              password: et.password || existing?.password || generateDefaultUsername(et.full_name),
            };
          });
        }
        if (Array.isArray(erpData?.inventoryItems) && !hasRecentLocalMutation("inventory")) {
          updates.inventoryItems = erpData.inventoryItems;
        }
        if (Array.isArray((erpData as any)?.recentIngresos) && (erpData as any).recentIngresos.length > 0) {
          updates.recentIngresos = (erpData as any).recentIngresos;
        }
        if (Array.isArray(erpData?.workOrders)) {
          updates.workOrders = erpData.workOrders;
        }
        if (Array.isArray(erpData?.invoices)) {
          updates.invoices = erpData.invoices;
        }
        if (Array.isArray(erpData?.appointments)) {
          updates.appointments = erpData.appointments;
        }
        if (Array.isArray(erpData?.vehicles)) {
          updates.vehicles = erpData.vehicles;
        }
        if (Array.isArray(erpData?.certifications) && erpData.certifications.length > 0 && !hasRecentLocalMutation("certifications")) {
          updates.certifications = erpData.certifications;
        }
        if (Array.isArray(erpData?.scheduleRecords) && erpData.scheduleRecords.length > 0 && !hasRecentLocalMutation("schedule")) {
          updates.scheduleRecords = erpData.scheduleRecords;
        }
        if (Array.isArray((erpData as any)?.workshopServices) && (erpData as any).workshopServices.length > 0 && !hasRecentLocalMutation("workshopServices") && !hasRecentLocalMutation("services")) {
          updates.workshopServices = (erpData as any).workshopServices;
        }

        // Aplicar datos en chunks para no congelar el hilo principal de la tablet
        // (skill de optimización de carga). Los datos pesados (workOrders, invoices,
        // vehicles) se aplican en un solo set, pero el procesamiento de formateo ya
        // quedó en fetchSupabaseErpData; aquí solo asignamos referencias.
        set(updates);
      }
    } catch (err) {
      console.warn("Supabase sync warning:", err);
    } finally {
      set({ isSyncing: false });
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

  updateSiteContent: async (key, data) => {
    const prevSection = get().siteContent[key];
    let updatedSection;

    if (Array.isArray(data)) {
      updatedSection = data;
    } else if (typeof data === "object" && data !== null) {
      updatedSection = { ...(typeof prevSection === "object" ? prevSection : {}), ...data };
    } else {
      updatedSection = data;
    }

    // Optimistic set
    set((state) => ({
      siteContent: {
        ...state.siteContent,
        [key]: updatedSection,
      },
    }));

    // Trigger Supabase Realtime Sync with confirmation
    const res = await saveSupabaseSiteContent(key, updatedSection);
    if (!res.success) {
      console.error(`updateSiteContent rollback (${key}):`, res.error);
      set((state) => ({
        siteContent: {
          ...state.siteContent,
          [key]: prevSection,
        },
      }));
    }
  },

  updateTheme: async (themeData) => {
    const prevTheme = get().siteContent.theme;
    const updatedTheme = {
      ...prevTheme,
      ...themeData,
    };

    // Optimistic set
    set((state) => ({
      siteContent: {
        ...state.siteContent,
        theme: updatedTheme,
      },
    }));

    // Trigger Supabase Realtime Sync for Theme with confirmation
    const res = await saveSupabaseSiteContent("theme", updatedTheme, "theme");
    if (!res.success) {
      console.error("updateTheme rollback:", res.error);
      set((state) => ({
        siteContent: {
          ...state.siteContent,
          theme: prevTheme,
        },
      }));
    }
  },

  technicians: [],

  addTechnician: async (tech) => {
    const defUser = generateDefaultUsername(tech.full_name);
    const newTech: Technician = {
      ...tech,
      id: `tech-${Date.now()}`,
      username: tech.username?.trim() || defUser,
      password: tech.password?.trim() || defUser,
      allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : ALL_ERP_STATIONS_DEFAULT,
    };
    const updatedTechs = [...get().technicians, newTech];
    set({ technicians: updatedTechs });
    const res = await saveSupabaseTechnician(newTech, updatedTechs);
    if (res.success) {
      get().notify("success", `Personal "${newTech.full_name}" registrado y guardado en la nube.`);
    } else {
      get().notify("error", `No se pudo guardar a "${newTech.full_name}" en Supabase: ${res.error || "Error desconocido"}`);
    }
    return res;
  },

  updateTechnician: async (id, updates) => {
    const prevTechs = get().technicians;
    const prevTarget = prevTechs.find((t) => t.id === id);
    const updatedTechs = prevTechs.map((t) => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        return updated;
      }
      return t;
    });
    const targetTech = updatedTechs.find((t) => t.id === id);
    if (targetTech) {
      set({ technicians: updatedTechs });
      broadcastRealtimeChange("technicians_updated");
      const res = await saveSupabaseTechnician(targetTech, updatedTechs);
      if (!res.success && prevTarget) {
        set({
          technicians: prevTechs.map((t) => (t.id === id ? prevTarget : t)),
        });
        get().notify("error", `No se pudo guardar el cambio de "${targetTech.full_name}": ${res.error || "Error desconocido"}`);
        return res;
      }
      get().notify("info", `${targetTech.full_name} actualizado y guardado en la nube.`);
      return res;
    }
    return { success: false, error: "Técnico no encontrado" };
  },

  changeTechnicianPassword: (identifier, newPass) => {
    const cleanId = identifier.trim().toLowerCase();
    const techList = get().technicians;

    // Match by username, email, or id
    const target = techList.find(
      (t) =>
        t.id === identifier ||
        (t.username && t.username.toLowerCase() === cleanId) ||
        (t.email && t.email.toLowerCase() === cleanId) ||
        (generateDefaultUsername(t.full_name).toLowerCase() === cleanId)
    );

    if (!target) {
      return {
        success: false,
        message: `No se encontró ningún usuario con el identificador "${identifier}".`,
      };
    }

    const updatedTech: Technician = {
      ...target,
      password: newPass.trim(),
    };

    const updatedTechs = techList.map((t) => (t.id === target.id ? updatedTech : t));
    saveSupabaseTechnician(updatedTech, updatedTechs);
    set({ technicians: updatedTechs });

    return {
      success: true,
      message: `Contraseña de ${target.full_name} actualizada exitosamente.`,
      technician: updatedTech,
    };
  },

  toggleTechnicianActive: async (id) => {
    const prevTechs = get().technicians;
    const prevTarget = prevTechs.find((t) => t.id === id);
    const updatedTechs = prevTechs.map((t) => {
      if (t.id === id) {
        return { ...t, is_active: !t.is_active };
      }
      return t;
    });
    const targetTech = updatedTechs.find((t) => t.id === id);
    if (targetTech) {
      set({ technicians: updatedTechs });
      broadcastRealtimeChange("technicians_updated");
      const res = await saveSupabaseTechnician(targetTech, updatedTechs);
      if (!res.success && prevTarget) {
        set({
          technicians: prevTechs.map((t) => (t.id === id ? prevTarget : t)),
        });
        get().notify("error", `No se pudo cambiar el estado de "${targetTech.full_name}": ${res.error || "Error desconocido"}`);
        return res;
      }
      get().notify("info", `${targetTech.full_name} ahora está ${targetTech.is_active ? "Activo" : "Inactivo"}.`);
      return res;
    }
    return { success: false, error: "Técnico no encontrado" };
  },

  deleteTechnician: (id) => {
    const targetName = get().technicians.find((t) => t.id === id)?.full_name || "Personal";
    const updatedTechs = get().technicians.filter((t) => t.id !== id);
    deleteSupabaseTechnician(id, updatedTechs);
    set({ technicians: updatedTechs });
    get().notify("info", `${targetName} fue eliminado del personal.`);
  },

  vehicles: [],

  registerVehicle: (v) =>
    set((state) => {
      const exists = state.vehicles.some((existing) => existing.plate === v.plate);
      saveSupabaseVehicle(v);
      return {
        vehicles: exists
          ? state.vehicles.map((existing) => (existing.plate === v.plate ? v : existing))
          : [...state.vehicles, v],
      };
    }),

  updateVehicle: (plate, updates) =>
    set((state) => {
      const updatedVehicles = state.vehicles.map((v) => {
        if (v.plate.toUpperCase() === plate.toUpperCase()) {
          const updated = { ...v, ...updates };
          saveSupabaseVehicle(updated);
          return updated;
        }
        return v;
      });
      return { vehicles: updatedVehicles };
    }),

  workOrders: [],

  createWorkOrder: (order) => {
    const newOrder: WorkOrder = {
      ...order,
      id: order.id || generateUUID(),
      entry_time: order.entry_time || new Date().toISOString(),
      items: order.items || [],
    };
    saveSupabaseWorkOrder(newOrder);
    set((state) => ({
      workOrders: [...state.workOrders, newOrder],
    }));
  },

  updateWorkOrder: (id, updates) =>
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === id) {
          const updated = { ...o, ...updates };
          saveSupabaseWorkOrder(updated);
          return updated;
        }
        return o;
      });
      return { workOrders: updatedOrders };
    }),

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
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id !== orderId) return o;
        const subtotal = item.quantity * item.unit_price;
        const isService = item.item_type === "servicio";
        const nowISO = new Date().toISOString();
        const newItem: WorkOrderItem = {
          ...item,
          id: `item-${Date.now()}`,
          subtotal,
          dispatched: isService ? true : false,
          dispatched_at: isService ? nowISO : undefined,
          requested_at: nowISO,
        };
        const updatedOrder = {
          ...o,
          items: [...o.items, newItem],
        };
        saveSupabaseWorkOrder(updatedOrder);
        broadcastRealtimeChange("work_orders_updated");
        return updatedOrder;
      });
      return { workOrders: updatedOrders };
    }),

  addMultipleWorkOrderItems: (orderId, items) =>
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id !== orderId) return o;
        const nowISO = new Date().toISOString();
        const newItems: WorkOrderItem[] = items.map((item, idx) => {
          const subtotal = item.quantity * item.unit_price;
          const isService = item.item_type === "servicio";
          return {
            ...item,
            id: `item-${Date.now()}-${idx}`,
            subtotal,
            dispatched: isService ? true : false,
            dispatched_at: isService ? nowISO : undefined,
            requested_at: nowISO,
          };
        });
        const updatedOrder = {
          ...o,
          items: [...o.items, ...newItems],
        };
        saveSupabaseWorkOrder(updatedOrder);
        broadcastRealtimeChange("work_orders_updated");
        return updatedOrder;
      });
      return { workOrders: updatedOrders };
    }),

  updateWorkOrderItem: (orderId, itemId, updates) =>
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id !== orderId) return o;
        const updatedItems = o.items.map((i) => {
          if (i.id !== itemId) return i;
          const quantity = updates.quantity !== undefined ? updates.quantity : i.quantity;
          const unit_price = updates.unit_price !== undefined ? updates.unit_price : i.unit_price;
          const subtotal = Number((quantity * unit_price).toFixed(2));
          return {
            ...i,
            ...updates,
            quantity,
            unit_price,
            subtotal,
          };
        });
        const updatedOrder = { ...o, items: updatedItems };
        saveSupabaseWorkOrder(updatedOrder);
        broadcastRealtimeChange("work_orders_updated");
        return updatedOrder;
      });
      return { workOrders: updatedOrders };
    }),

  removeWorkOrderItem: (orderId, itemId) =>
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id !== orderId) return o;
        const updatedOrder = {
          ...o,
          items: o.items.filter((i) => i.id !== itemId),
        };
        saveSupabaseWorkOrder(updatedOrder);
        broadcastRealtimeChange("work_orders_updated");
        return updatedOrder;
      });
      return { workOrders: updatedOrders };
    }),

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

  markAllWorkOrderItemsDispatched: (orderId) =>
    set((state) => ({
      workOrders: state.workOrders.map((o) => {
        if (orderId && o.id !== orderId) return o;
        const updatedItems = o.items.map((i) => ({
          ...i,
          dispatched: true,
          dispatched_at: i.dispatched_at || new Date().toISOString(),
        }));
        const updatedOrder = { ...o, items: updatedItems };
        saveSupabaseWorkOrder(updatedOrder);
        return updatedOrder;
      }),
    })),

  markAllMigratedWorkOrderItemsDispatched: (cutoffDate = "2026-08-08") =>
    set((state) => ({
      workOrders: state.workOrders.map((o) => {
        const orderDate = (o.entry_time || "").slice(0, 10);
        if (orderDate && orderDate > cutoffDate) return o;
        const updatedItems = o.items.map((i) => ({
          ...i,
          dispatched: true,
          dispatched_at: i.dispatched_at || o.entry_time || new Date().toISOString(),
        }));
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

  updateDiagnosticAndObservations: (orderId, notes, observations) => {
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === orderId) {
          const updated = {
            ...o,
            diagnostic_notes: notes,
            observations: observations !== undefined ? observations : o.observations,
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
      invoices: state.invoices.filter((i) => i.work_order_id !== id),
    }));
  },

  deleteMultipleWorkOrders: (ids) => {
    deleteSupabaseMultipleWorkOrders(ids);
    set((state) => ({
      workOrders: state.workOrders.filter((o) => !ids.includes(o.id)),
      invoices: state.invoices.filter((i) => !i.work_order_id || !ids.includes(i.work_order_id)),
    }));
  },

  clearAllWorkOrders: async () => {
    await clearSupabaseWorkOrders();
    set({ workOrders: [], invoices: [] });
  },

  requestCertificationForWorkOrder: (orderId, certType, price) => {
    set((state) => {
      const targetOrder = state.workOrders.find((o) => o.id === orderId);
      if (!targetOrder) return state;

      const veh = state.vehicles.find((v) => v.plate === targetOrder.vehicle_plate);
      const inv = state.invoices.find((i) => i.work_order_id === orderId);
      const clientName = veh?.owner_name || inv?.client_name || "Cliente Taller";

      const certId = `cert-${Date.now()}`;
      const newCert: Certification = {
        id: certId,
        work_order_id: orderId,
        vehicle_plate: targetOrder.vehicle_plate,
        client_name: clientName,
        chip_code: `CHIP-${Math.floor(100000 + Math.random() * 900000)}`,
        cylinder_serial: `CIL-${Math.floor(10000 + Math.random() * 90000)}`,
        certification_type: certType,
        issue_date: getPeruDateString(),
        expiry_date: getPeruDateString(new Date(Date.now() + 365 * 86400000)),
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

  removeCertificationFromWorkOrder: (orderId) => {
    set((state) => {
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === orderId) {
          const updated = {
            ...o,
            requires_certification: false,
            certification_type: undefined,
            certification_price: undefined,
            certification_issued: false,
            certification_id: undefined,
          };
          saveSupabaseWorkOrder(updated);
          broadcastRealtimeChange("work_orders_updated");
          return updated;
        }
        return o;
      });
      const updatedCerts = state.certifications.filter((c) => c.work_order_id !== orderId);
      return {
        workOrders: updatedOrders,
        certifications: updatedCerts,
      };
    });
  },

  setWorkOrderDiscount: (orderId, amount) => {
    set((state) => {
      const discountVal = Math.max(0, Number(amount) || 0);
      let targetPlate = "";
      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === orderId) {
          targetPlate = o.vehicle_plate || "";
          const updated = { ...o, discount_amount: discountVal };
          saveSupabaseWorkOrder(updated);
          return updated;
        }
        return o;
      });

      // Also update or sync linked invoice so Caja receives the discount immediately
      const updatedInvoices = state.invoices.map((inv) => {
        if (inv.work_order_id === orderId || (targetPlate && inv.vehicle_plate === targetPlate)) {
          const matchedOrder = updatedOrders.find((o) => o.id === orderId) || state.workOrders.find((o) => o.id === orderId);
          const partsTotal = matchedOrder ? (matchedOrder.items || []).reduce((sum, it) => sum + (it.subtotal || 0), 0) : (inv.parts_total || 0);
          const certFee = matchedOrder?.requires_certification ? (matchedOrder.certification_price || 0) : (inv.certification_fee || 0);
          const gross = partsTotal + certFee;
          const newGrandTotal = Math.max(0, gross - discountVal);
          const updatedInv: Invoice = {
            ...inv,
            discounts: discountVal,
            grand_total: newGrandTotal,
          };
          saveSupabaseInvoice(updatedInv);
          return updatedInv;
        }
        return inv;
      });

      broadcastRealtimeChange("work_orders_updated");
      broadcastRealtimeChange("invoices_updated");
      return {
        workOrders: updatedOrders,
        invoices: updatedInvoices,
      };
    });
  },

  inventoryItems: [],

  addInventoryItem: (item) => {
    const newItem: InventoryItem = {
      ...item,
      id: (item as any).id || generateUUID(),
    };
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
      saveSupabaseSiteContent("all_inventory_records", updatedItems, "inventory");
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

  importBulkInventoryItems: async (items) => {
    const seenSkus = new Map<string, number>();
    const newItems: InventoryItem[] = items.map((item, idx) => {
      let cleanSku = (item.sku_barcode || `SKU-${idx + 1}`).trim().toUpperCase();
      if (seenSkus.has(cleanSku)) {
        const count = (seenSkus.get(cleanSku) || 1) + 1;
        seenSkus.set(cleanSku, count);
        cleanSku = `${cleanSku}-${count}`;
      } else {
        seenSkus.set(cleanSku, 1);
      }

      return {
        ...item,
        id: (item as any).id || `inv-${cleanSku.replace(/[^A-Z0-9_-]/gi, "_")}`,
        sku_barcode: cleanSku,
      };
    });

    const res = await saveSupabaseBulkInventory(newItems);
    set({
      inventoryItems: newItems,
    });
    if (res.success) {
      get().notify("success", `Catálogo actualizado: ${res.count} productos guardados en la nube.`);
    } else {
      get().notify("error", `Error al guardar inventario en Supabase: ${res.errorMsg || "Error desconocido"}`);
    }
    return res;
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

  recentIngresos: [],

  addRecentIngreso: (record) => {
    const newEntry: InventoryIngresoRecord = {
      ...record,
      id: record.id || `ing-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp:
        record.timestamp ||
        new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    set((state) => {
      const updated = [newEntry, ...state.recentIngresos];
      saveSupabaseSiteContent("inventory_recent_ingresos", updated, "inventory");
      broadcastRealtimeChange("inventory_recent_ingresos_updated");
      return { recentIngresos: updated };
    });
  },

  removeRecentIngreso: (id) => {
    set((state) => {
      const updated = state.recentIngresos.filter((r) => r.id !== id);
      saveSupabaseSiteContent("inventory_recent_ingresos", updated, "inventory");
      broadcastRealtimeChange("inventory_recent_ingresos_updated");
      return { recentIngresos: updated };
    });
  },

  clearRecentIngresos: () => {
    saveSupabaseSiteContent("inventory_recent_ingresos", [], "inventory");
    broadcastRealtimeChange("inventory_recent_ingresos_updated");
    set({ recentIngresos: [] });
  },

  toolLoans: [],

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

  invoices: [],

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
      const discount = order.discount_amount || 0;
      const grandTotal = Math.max(0, laborFee + partsTotal + certFee - discount);

      const newInvoice: Invoice = {
        id: generateUUID(),
        work_order_id: orderId,
        vehicle_plate: order.vehicle_plate,
        client_name: vehicle?.owner_name || "Cliente Taller",
        labor_fee: laborFee,
        parts_total: partsTotal,
        certification_fee: certFee,
        discounts: discount > 0 ? discount : "0",
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

  importBulkWorkshopData: async ({ vehicles: newVehicles, workOrders: newOrders, invoices: newInvoices }) => {
    const res = await saveSupabaseBulkWorkshopData(newVehicles, newOrders, newInvoices);
    set((state) => {
      // Merge vehicles by plate with latest non-empty attributes
      const vehicleMap = new Map(state.vehicles.map((v) => [v.plate, v]));
      newVehicles.forEach((nv) => {
        const existing = vehicleMap.get(nv.plate);
        if (existing) {
          vehicleMap.set(nv.plate, {
            ...existing,
            brand: nv.brand || existing.brand,
            owner_name: nv.owner_name || existing.owner_name,
            owner_phone: nv.owner_phone || existing.owner_phone,
            vehicle_type: nv.vehicle_type || existing.vehicle_type,
            fuel_type: nv.fuel_type || existing.fuel_type,
            current_mileage: nv.current_mileage > 0 ? nv.current_mileage : existing.current_mileage,
            last_visit_date: nv.last_visit_date || existing.last_visit_date,
          });
        } else {
          vehicleMap.set(nv.plate, nv);
        }
      });

      return {
        vehicles: Array.from(vehicleMap.values()),
        workOrders: newOrders,
        invoices: newInvoices,
      };
    });
    return res;
  },

  mergeWorkshopRecords: ({ workOrders: newOrders = [], invoices: newInvoices = [], vehicles: newVehicles = [] }) => {
    set((state) => {
      if (newOrders.length === 0 && newInvoices.length === 0 && newVehicles.length === 0) return state;

      const existingOrderIds = new Set(state.workOrders.map((o) => o.id));
      const toAddOrders = newOrders.filter((o) => !existingOrderIds.has(o.id));

      const existingInvoiceIds = new Set(state.invoices.map((i) => i.id));
      const toAddInvoices = newInvoices.filter((i) => !existingInvoiceIds.has(i.id));

      const existingPlates = new Set(state.vehicles.map((v) => v.plate?.toUpperCase()));
      const toAddVehicles = newVehicles.filter((v) => !existingPlates.has(v.plate?.toUpperCase()));

      return {
        workOrders: toAddOrders.length > 0 ? [...toAddOrders, ...state.workOrders] : state.workOrders,
        invoices: toAddInvoices.length > 0 ? [...toAddInvoices, ...state.invoices] : state.invoices,
        vehicles: toAddVehicles.length > 0 ? [...toAddVehicles, ...state.vehicles] : state.vehicles,
      };
    });
  },

  setBulkWorkshopData: ({ vehicles, workOrders, invoices }) => {
    set({
      vehicles,
      workOrders,
      invoices,
    });
  },

  updateInvoice: (id, updates) =>
    set((state) => {
      const updatedInvoices = state.invoices.map((inv) => {
        if (inv.id === id) {
          const updated = { ...inv, ...updates };
          saveSupabaseInvoice(updated);
          return updated;
        }
        return inv;
      });
      return { invoices: updatedInvoices };
    }),

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

  togglePayInvoice: (invoiceId) => {
    const inv = get().invoices.find((i) => i.id === invoiceId);
    get().toggleOrderPayment(inv?.work_order_id || "", invoiceId);
  },

  toggleOrderPayment: (orderId, invoiceId) =>
    set((state) => {
      let targetInvoice = invoiceId ? state.invoices.find((i) => i.id === invoiceId) : undefined;
      if (!targetInvoice && orderId) {
        targetInvoice = state.invoices.find((i) => i.work_order_id === orderId);
      }

      const targetOrder = state.workOrders.find((o) => o.id === orderId);
      const vehicle = targetOrder ? state.vehicles.find((v) => v.plate === targetOrder.vehicle_plate) : undefined;

      // Determine current paid state
      const isCurrentlyPaid =
        targetInvoice?.payment_status === "pagado" ||
        (targetInvoice?.payment_condition || "").toUpperCase().includes("PAGADO") ||
        targetOrder?.status === "pagado_autorizado" ||
        targetOrder?.status === "finalizado";

      const nextPaymentStatus = isCurrentlyPaid ? ("pendiente" as const) : ("pagado" as const);
      const nextCondition = isCurrentlyPaid ? "PENDIENTE" : "PAGADO";
      const nextPaidAt = isCurrentlyPaid ? undefined : new Date().toISOString();
      const nextOrderStatus = isCurrentlyPaid ? ("por_cobrar" as WorkOrderStatus) : ("pagado_autorizado" as WorkOrderStatus);

      let updatedInvoices = [...state.invoices];

      if (targetInvoice) {
        const updatedInv: Invoice = {
          ...targetInvoice,
          payment_status: nextPaymentStatus,
          payment_condition: nextCondition,
          paid_at: nextPaidAt,
        };
        saveSupabaseInvoice(updatedInv);
        updatedInvoices = updatedInvoices.map((i) => (i.id === targetInvoice!.id ? updatedInv : i));
      } else if (targetOrder) {
        const partsTotal = (targetOrder.items || []).reduce((s, it) => s + (it.subtotal || 0), 0);
        const certFee = targetOrder.requires_certification ? targetOrder.certification_price || 0 : 0;
        const newInv: Invoice = {
          id: generateUUID(),
          work_order_id: targetOrder.id,
          vehicle_plate: targetOrder.vehicle_plate,
          client_name: vehicle?.owner_name || "Cliente Taller",
          labor_fee: 0,
          parts_total: partsTotal,
          certification_fee: certFee,
          grand_total: partsTotal + certFee,
          payment_status: nextPaymentStatus,
          payment_condition: nextCondition,
          payment_method: "Efectivo",
          payment_destination: "EMPRESA",
          issued_at: targetOrder.entry_time || new Date().toISOString(),
          paid_at: nextPaidAt,
        };
        saveSupabaseInvoice(newInv);
        updatedInvoices.push(newInv);
      }

      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === orderId) {
          const updatedOrder = {
            ...o,
            status: nextOrderStatus,
          };
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

  confirmInvoicePayment: ({
    invoiceId,
    workOrderId,
    paymentMethod,
    paymentDestination,
    receiptNumber,
    receiptType,
    customerDoc,
    customerName,
    customerAddress,
    paymentBreakdown,
  }) => {
    set((state) => {
      let targetInvoice = invoiceId ? state.invoices.find((i) => i.id === invoiceId) : undefined;
      if (!targetInvoice && workOrderId) {
        targetInvoice = state.invoices.find((i) => i.work_order_id === workOrderId);
      }

      const effectiveWorkOrderId = workOrderId || targetInvoice?.work_order_id;
      const targetOrder = effectiveWorkOrderId ? state.workOrders.find((o) => o.id === effectiveWorkOrderId) : undefined;
      const vehicle = targetOrder ? state.vehicles.find((v) => v.plate === targetOrder.vehicle_plate) : undefined;
      const nowISO = new Date().toISOString();
      let updatedInvoices = [...state.invoices];
      let updatedCorrelativeConfig = state.correlativeConfig;

      if (targetInvoice) {
        const oldNum = targetInvoice.receipt_number;
        const oldType = targetInvoice.receipt_type;
        const isClearing = receiptNumber === "" || receiptType === "" || receiptType === "Sin Comprobante";
        let generatedNC: string | undefined = undefined;

        // If we are releasing/clearing the previous correlative
        if (isClearing && oldNum) {
          const cleanNum = parseInt(oldNum.replace(/\D/g, ""), 10);
          const isFactura = oldType === "Factura" || oldNum.startsWith("F");
          const isBoleta = oldType === "Boleta" || oldNum.startsWith("B");
          const isTicket = oldType === "Ticket" || oldNum.startsWith("TK") || (!isFactura && !isBoleta);

          if (isFactura) {
            // FACTURA: SUNAT rules forbid rolling back or deleting Facturas.
            // An electronic Nota de Crédito is generated instead, preserving Factura correlative.
            const nextNCNum = (updatedCorrelativeConfig.notaCreditoLastNumber || 0) + 1;
            const ncSeries = updatedCorrelativeConfig.notaCreditoSeries || "FC01";
            generatedNC = `${ncSeries}-${String(nextNCNum).padStart(8, "0")}`;
            updatedCorrelativeConfig = {
              ...updatedCorrelativeConfig,
              notaCreditoLastNumber: nextNCNum,
              lastUpdateDate: getPeruDateString(),
            };
            saveSupabaseSiteContent("correlativeConfig", updatedCorrelativeConfig, "config");
          } else if (!isNaN(cleanNum)) {
            // TICKET & BOLETA: Rollback and free the correlative for future use
            if (isTicket && updatedCorrelativeConfig.ticketLastNumber === cleanNum) {
              updatedCorrelativeConfig = {
                ...updatedCorrelativeConfig,
                ticketLastNumber: Math.max(0, cleanNum - 1),
                lastUpdateDate: getPeruDateString(),
              };
              saveSupabaseSiteContent("correlativeConfig", updatedCorrelativeConfig, "config");
            } else if (isBoleta && updatedCorrelativeConfig.boletaLastNumber === cleanNum) {
              updatedCorrelativeConfig = {
                ...updatedCorrelativeConfig,
                boletaLastNumber: Math.max(0, cleanNum - 1),
                lastUpdateDate: getPeruDateString(),
              };
              saveSupabaseSiteContent("correlativeConfig", updatedCorrelativeConfig, "config");
            }
          }
        }

        const matchedOrder = state.workOrders.find((o) => o.id === targetInvoice.work_order_id);
        const discountVal = matchedOrder?.discount_amount !== undefined ? matchedOrder.discount_amount : (typeof targetInvoice.discounts === "number" ? targetInvoice.discounts : Number(targetInvoice.discounts) || 0);
        const currentPartsTotal = matchedOrder ? (matchedOrder.items || []).reduce((sum, item) => sum + item.subtotal, 0) : (targetInvoice.parts_total || 0);
        const currentCertFee = matchedOrder?.requires_certification ? (matchedOrder.certification_price || 0) : (targetInvoice.certification_fee || 0);
        const computedGrandTotal = Math.max(0, currentPartsTotal + currentCertFee - discountVal);

        const updatedObservations = generatedNC
          ? `Factura ${oldNum} anulada mediante Nota de Crédito ${generatedNC}. ${targetInvoice.observations || ""}`.trim()
          : targetInvoice.observations;

        const updated: Invoice = {
          ...targetInvoice,
          client_name: customerName || targetInvoice.client_name || vehicle?.owner_name || "Cliente Taller",
          customer_doc: customerDoc !== undefined ? customerDoc : targetInvoice.customer_doc,
          customer_address: customerAddress !== undefined ? customerAddress : targetInvoice.customer_address,
          parts_total: currentPartsTotal,
          certification_fee: currentCertFee,
          discounts: discountVal,
          grand_total: computedGrandTotal,
          payment_status: "pagado" as const,
          payment_method: paymentMethod || targetInvoice.payment_method || "Efectivo",
          payment_destination: paymentDestination || targetInvoice.payment_destination || "EMPRESA",
          receipt_number: receiptNumber !== undefined ? receiptNumber : (targetInvoice.receipt_number || ""),
          receipt_type: receiptType !== undefined ? receiptType : (targetInvoice.receipt_type || ""),
          payment_breakdown: paymentBreakdown !== undefined ? paymentBreakdown : targetInvoice.payment_breakdown,
          credit_note_number: generatedNC || targetInvoice.credit_note_number,
          observations: updatedObservations,
          paid_at: nowISO,
        };
        saveSupabaseInvoice(updated);
        updatedInvoices = state.invoices.map((i) => (i.id === targetInvoice!.id ? updated : i));
      } else if (targetOrder) {
        const partsTotal = (targetOrder.items || []).reduce((sum, item) => sum + item.subtotal, 0);
        const certFee = targetOrder.requires_certification ? targetOrder.certification_price || 0 : 0;
        const discountVal = targetOrder.discount_amount || 0;
        const newInvoice: Invoice = {
          id: `inv-${Date.now()}`,
          work_order_id: targetOrder.id,
          vehicle_plate: targetOrder.vehicle_plate,
          client_name: customerName || vehicle?.owner_name || "Cliente Taller",
          customer_doc: customerDoc || "",
          customer_address: customerAddress || "",
          labor_fee: 0,
          parts_total: partsTotal,
          certification_fee: certFee,
          discounts: discountVal,
          grand_total: Math.max(0, partsTotal + certFee - discountVal),
          payment_status: "pagado",
          payment_method: paymentMethod || "Efectivo",
          payment_destination: paymentDestination || "EMPRESA",
          receipt_number: receiptNumber !== undefined ? receiptNumber : "",
          receipt_type: receiptType !== undefined ? receiptType : "",
          payment_breakdown: paymentBreakdown,
          issued_at: targetOrder.entry_time || nowISO,
          paid_at: nowISO,
        };
        saveSupabaseInvoice(newInvoice);
        updatedInvoices = [newInvoice, ...state.invoices];
      }

      const updatedOrders = state.workOrders.map((o) => {
        if (o.id === effectiveWorkOrderId) {
          const updated = { ...o, status: "pagado_autorizado" as WorkOrderStatus };
          saveSupabaseWorkOrder(updated);
          return updated;
        }
        return o;
      });

      return {
        invoices: updatedInvoices,
        workOrders: updatedOrders,
        correlativeConfig: updatedCorrelativeConfig,
      };
    });
  },

  registerDirectWorkshopPayment: (data) => {
    const plate = data.vehicle_plate.toUpperCase().trim();
    const newOrderId = `wo-${Date.now()}`;
    const newInvoiceId = `inv-${Date.now()}`;
    const entryTime = data.entry_time || new Date().toISOString();

    // 1. Vehicle
    const vehicle: Vehicle = {
      plate,
      brand: data.brand || "Automóvil",
      model: "Genérico",
      year: 2023,
      color: "Plata",
      fuel_type: data.fuel_type || "GNV",
      owner_name: data.owner_name || "Cliente Taller",
      owner_phone: data.owner_phone || "",
      current_mileage: data.current_mileage || 0,
      last_visit_date: entryTime,
    };
    saveSupabaseVehicle(vehicle);

    // 2. Work Order
    const items = data.spare_parts_services || data.general_maintenance_service || data.problem_description
      ? [
        {
          id: `item-${newOrderId}`,
          description: data.spare_parts_services || data.general_maintenance_service || data.problem_description || "SERVICIO DE TALLER",
          quantity: 1,
          unit_price: Number(data.price) || 0,
          subtotal: Number(data.price) || 0,
        },
      ]
      : [];

    const newWorkOrder: WorkOrder = {
      id: newOrderId,
      vehicle_plate: plate,
      status: "pagado_autorizado",
      assigned_technician_id: data.technician_name,
      problem_description: data.problem_description || data.general_maintenance_service || "Mantenimiento General",
      general_maintenance_service: data.general_maintenance_service || data.problem_description || "Mantenimiento General",
      spare_parts_services: data.spare_parts_services,
      quinquennial_date: data.quinquennial_date,
      chip_expiry_date: data.chip_expiry_date,
      entry_time: entryTime,
      items,
      requires_certification: false,
    };
    saveSupabaseWorkOrder(newWorkOrder);

    // 3. Invoice
    const newInvoice: Invoice = {
      id: newInvoiceId,
      work_order_id: newOrderId,
      vehicle_plate: plate,
      client_name: data.owner_name || "Cliente Taller",
      customer_doc: data.customer_doc || "",
      customer_address: data.customer_address || "",
      labor_fee: 0,
      parts_total: Number(data.price) || 0,
      certification_fee: 0,
      grand_total: Number(data.price) || 0,
      payment_status: (data.payment_condition === "PENDIENTE" ? "pendiente" : "pagado") as any,
      payment_condition: data.payment_condition || "PAGADO",
      payment_method: data.payment_method || "",
      payment_destination: data.payment_destination || "",
      receipt_number: data.receipt_number || "",
      receipt_type: data.receipt_type || "",
      discounts: data.discounts || "0",
      credit_amount: Number(data.credit_amount) || 0,
      payment_breakdown: data.payment_breakdown,
      issued_at: entryTime,
      paid_at: data.payment_condition === "PENDIENTE" ? undefined : entryTime,
    };
    saveSupabaseInvoice(newInvoice);

    set((state) => {
      const existingVehIdx = state.vehicles.findIndex((v) => v.plate.toUpperCase() === plate);
      const updatedVehicles = existingVehIdx >= 0
        ? state.vehicles.map((v, i) => i === existingVehIdx ? { ...v, ...vehicle } : v)
        : [vehicle, ...state.vehicles];

      return {
        vehicles: updatedVehicles,
        workOrders: [newWorkOrder, ...state.workOrders],
        invoices: [newInvoice, ...state.invoices],
      };
    });

    return { workOrder: newWorkOrder, invoice: newInvoice };
  },

  appointments: [],

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

  certifications: [],

  addCertification: (cert) => {
    const newCert: Certification = {
      ...cert,
      id: `cert-${Date.now()}`,
      price: cert.price || 80,
    };
    saveSupabaseCertification(newCert);
    set((state) => ({
      certifications: [newCert, ...state.certifications],
    }));
  },

  updateCertificationPrice: (id, price) => {
    set((state) => {
      const targetCert = state.certifications.find((c) => c.id === id);
      if (!targetCert) return state;

      const updatedCert = { ...targetCert, price };
      saveSupabaseCertification(updatedCert);

      // Update linked workshop order
      const updatedOrders = state.workOrders.map((wo) => {
        if (
          wo.id === targetCert.work_order_id ||
          (wo.vehicle_plate === targetCert.vehicle_plate && wo.requires_certification)
        ) {
          const u = { ...wo, certification_price: price };
          saveSupabaseWorkOrder(u);
          return u;
        }
        return wo;
      });

      // Update linked invoice
      const updatedInvoices = state.invoices.map((inv) => {
        if (
          inv.work_order_id === targetCert.work_order_id ||
          inv.vehicle_plate === targetCert.vehicle_plate
        ) {
          const u = {
            ...inv,
            certification_fee: price,
            grand_total: (inv.labor_fee || 0) + (inv.parts_total || 0) + price,
          };
          saveSupabaseInvoice(u);
          return u;
        }
        return inv;
      });

      return {
        certifications: state.certifications.map((c) => (c.id === id ? updatedCert : c)),
        workOrders: updatedOrders,
        invoices: updatedInvoices,
      };
    });
  },

  updateCertification: (id, updates) => {
    set((state) => {
      const updatedList = state.certifications.map((c) => {
        if (c.id === id) {
          const u = { ...c, ...updates };
          saveSupabaseCertification(u);
          return u;
        }
        return c;
      });
      return { certifications: updatedList };
    });
  },

  attendanceLogs: [],

  scheduleRecords: [],

  addScheduleRecord: (record) => {
    const newRecord: ScheduleRecord = {
      ...record,
      id: generateUUID(),
    };
    saveSupabaseScheduleRecord(newRecord);
    set((state) => ({
      scheduleRecords: [newRecord, ...state.scheduleRecords],
    }));
  },

  updateScheduleRecord: (id, updates) => {
    set((state) => {
      const updatedList = state.scheduleRecords.map((r) => {
        if (r.id === id) {
          const u = { ...r, ...updates };
          saveSupabaseScheduleRecord(u);
          return u;
        }
        return r;
      });
      return { scheduleRecords: updatedList };
    });
  },

  deleteScheduleRecord: (id) => {
    deleteSupabaseScheduleRecord(id);
    set((state) => ({
      scheduleRecords: state.scheduleRecords.filter((r) => r.id !== id),
    }));
  },

  deleteMultipleScheduleRecords: (ids) => {
    deleteSupabaseMultipleScheduleRecords(ids);
    set((state) => ({
      scheduleRecords: state.scheduleRecords.filter((r) => !ids.includes(r.id)),
    }));
  },

  clearAllScheduleRecords: () => {
    clearSupabaseScheduleRecords();
    set({ scheduleRecords: [] });
  },

  setBulkScheduleRecords: (records) => {
    set({ scheduleRecords: records });
  },

  importBulkScheduleRecords: async (records) => {
    const res = await saveSupabaseBulkScheduleRecords(records);
    set((state) => {
      const existingMap = new Map(state.scheduleRecords.map((r) => [r.id, r]));
      records.forEach((r) => existingMap.set(r.id, r));
      return { scheduleRecords: Array.from(existingMap.values()) };
    });
    return res;
  },

  addAttendanceLogs: (logs) =>
    set((state) => ({
      attendanceLogs: [
        ...state.attendanceLogs,
        ...logs.map((l) => ({ ...l, id: `att-${Date.now()}-${Math.random()}` })),
      ],
    })),
}));
