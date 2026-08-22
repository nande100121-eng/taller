"use client";

import React, { useState, useEffect } from "react";
import { useAppStore, WorkOrder, WorkshopService, InstallationComponent, ScheduleRecord, Technician, generateDefaultUsername, generateUUID } from "@/lib/store/app-store";
import { parseCSVRows, parseISODate, parseWorkshopRow } from "@/lib/csv-parser";
import { formatPeruDate, getPeruDateString, buildPeruISOString } from "@/lib/utils/date-utils";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { formatPlate, titleCase } from "@/lib/utils/text-format";
import { cleanMethodDisplay, defaultMethodFrom } from "@/lib/utils/payment-method";
import { isCertificationService } from "@/lib/utils/service-catalog";

// Convierte "S/ 410", "410", "S/ 50.00" o 410 a número. Devuelve 0 si no es válido.
function parseAmt(raw: any): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}
import {
  Table,
  UserCheck,
  Plus,
  Phone,
  CheckCircle2,
  Trash2,
  Upload,
  Search,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Layers,
  FileSpreadsheet,
  Wrench,
  ShieldCheck,
  Sliders,
  CheckSquare,
  Square,
  Edit3,
  Check,
  X,
  Calendar,
  ChevronUp,
  ChevronDown,
  Download,
  FileUp,
  Mail,
  Key,
  Eye,
  EyeOff,
  Copy,
  Send,
  Lock,
  AtSign
} from "lucide-react";
import { fetchMasterTablePage, saveSupabaseSiteContent, saveSupabaseWorkOrder, saveSupabaseInvoice, deleteSupabasePaymentRecord, MasterAbonoRow } from "@/lib/supabase/services";

const ALL_ERP_STATIONS = [
  { id: "/dashboard/porteria", label: "1. Portería" },
  { id: "/dashboard/recepcion", label: "2. Recepción" },
  { id: "/dashboard/taller", label: "3. Taller" },
  { id: "/dashboard/almacen", label: "4. Almacén" },
  { id: "/dashboard/caja", label: "5. Caja" },
  { id: "/dashboard/certificaciones", label: "6. Certificaciones" },
  { id: "/dashboard/asistencia", label: "7. Asistencia" },
  { id: "/dashboard/consultas", label: "8. Consultas" },
  { id: "/dashboard/reportes", label: "9. Reportes" },
  { id: "/dashboard/admin/tables", label: "10. Tablas Maestras" },
  { id: "/dashboard/configuracion", label: "11. Configuración" },
];

export default function AdminTablesPage() {
  const {
    technicians,
    addTechnician,
    updateTechnician,
    toggleTechnicianActive,
    deleteTechnician,
    workshopServices,
    addWorkshopService,
    updateWorkshopService,
    deleteWorkshopService,
    inventoryItems,
    workOrders,
    invoices,
    vehicles,
    updateWorkOrder,
    updateVehicle,
    updateInvoice,
    deleteWorkOrder,
    deleteMultipleWorkOrders,
    clearAllWorkOrders,
    scheduleRecords,
    addScheduleRecord,
    updateScheduleRecord,
    deleteScheduleRecord,
    deleteMultipleScheduleRecords,
    clearAllScheduleRecords,
    importBulkScheduleRecords,
    isSyncing,
    hasSyncedOnce,
    syncFromSupabase,
    notify,
  } = useAppStore();

  // Lookup de técnicos por id y por nombre: muestra el NOMBRE (no el código tech-xxx)
  // en la columna Técnico de la Tabla Maestra.
  const techLookup = React.useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    (technicians || []).forEach((t) => {
      if (t.id) byId.set(t.id, t.full_name);
      if (t.full_name) byName.set(t.full_name.trim().toLowerCase(), t.full_name);
    });
    return { byId, byName };
  }, [technicians]);

  const resolveTechnicianName = (idOrName: string): string => {
    if (!idOrName) return "";
    return techLookup.byId.get(idOrName) || techLookup.byName.get(idOrName.trim().toLowerCase()) || idOrName;
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<"taller" | "personal" | "servicios" | "programacion">("taller");

  // ===== SERVICIOS: formulario (crear/editar) + kit de INSTALACIÓN =====
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceFormSeed, setServiceFormSeed] = useState<WorkshopService | null>(null);
  const [formIsInstallation, setFormIsInstallation] = useState(false);
  const [formPrice, setFormPrice] = useState<number>(80);
  const [formComponents, setFormComponents] = useState<InstallationComponent[]>([]);
  const [kitPartSel, setKitPartSel] = useState<string>("");
  const [kitPartQty, setKitPartQty] = useState(1);
  const [kitCertSel, setKitCertSel] = useState<string>("");
  const [kitCertQty, setKitCertQty] = useState(1);
  // Orden A-Z del selector de repuestos del kit. (El buscador por texto se quitó:
  // el select nativo ya salta a la opción según lo que se escribe con el teclado.)
  const [kitPartSortAZ, setKitPartSortAZ] = useState(false);

  // Repuestos del catálogo opcionalmente ordenados alfabéticamente.
  const kitPartsFiltered = React.useMemo(() => {
    let list = (inventoryItems || []).slice();
    if (kitPartSortAZ) {
      list = list.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" }));
    }
    return list;
  }, [inventoryItems, kitPartSortAZ]);

  // Catálogo de certificados (servicios del catálogo con categoría Certificación).
  const certificationCatalogs = React.useMemo(() => {
    const list = (workshopServices || []).filter((s) => isCertificationService(s));
    if (list.length > 0) return list;
    return [
      { id: "ws-cert-1", name: "Certificado Anual GNV", category: "Certificación", price: 80, is_active: true },
      { id: "ws-cert-2", name: "Certificado Anual GLP", category: "Certificación", price: 80, is_active: true },
      { id: "ws-cert-3", name: "Prueba Hidrostática de Cilindro GNV", category: "Certificación", price: 180, is_active: true },
      { id: "ws-cert-4", name: "Desbloqueo de Chip GNV", category: "Certificación", price: 25, is_active: true },
    ];
  }, [workshopServices]);

  // Añade un repuesto del catálogo de Almacén al kit de la instalación.
  const handleAddKitPart = () => {
    const item = inventoryItems.find((i) => i.id === kitPartSel);
    if (!item) return;
    setFormComponents((prev) => [
      ...prev,
      { id: item.id, description: item.name, unit_price: Number(item.unit_price) || 0, quantity: Math.max(1, kitPartQty), source: "repuesto" },
    ]);
  };

  // Añade un certificado del catálogo al kit de la instalación.
  const handleAddKitCert = () => {
    const cs = certificationCatalogs.find((c) => c.id === kitCertSel);
    if (!cs) return;
    setFormComponents((prev) => [
      ...prev,
      { id: cs.id, description: cs.name, unit_price: Number(cs.price) || 0, quantity: Math.max(1, kitCertQty), source: "certificado" },
    ]);
  };

  const handleUpdateKitComp = (idx: number, patch: Partial<InstallationComponent>) => {
    setFormComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const handleRemoveKitComp = (idx: number) => {
    setFormComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  // Mueve un componente del kit hacia arriba/abajo (reordenar el paquete).
  const handleMoveKitComp = (idx: number, dir: -1 | 1) => {
    setFormComponents((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  // Carga un servicio existente al formulario para editarlo (incluye su kit).
  const handleEditService = (srv: WorkshopService) => {
    setEditingServiceId(srv.id);
    setServiceFormSeed(srv);
    setFormPrice(Number(srv.price) || 0);
    setFormIsInstallation(!!srv.is_installation);
    setFormComponents(Array.isArray(srv.installation_components) ? srv.installation_components.map((c) => ({ ...c })) : []);
  };
  const handleCancelEditService = () => {
    setEditingServiceId(null);
    setServiceFormSeed(null);
    setFormPrice(80);
    setFormIsInstallation(false);
    setFormComponents([]);
  };

  // Search and Date Filters for Master Workshop Table
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [timeFilter, setTimeFilter] = useState<"todos" | "hoy" | "fecha" | "rango">("todos");
  const [queryDate, setQueryDate] = useState<string>(getPeruDateString());
  const [startDate, setStartDate] = useState<string>(getPeruDateString());
  const [endDate, setEndDate] = useState<string>(getPeruDateString());

  // Pagination state (250 items per page for instant mobile & tablet rendering)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const ITEMS_PER_PAGE = 250;

  // Server-side pagination state for the Master Workshop Table
  // (carga solo la página activa; no depende del sync global de 41k+ filas)
  const [masterRows, setMasterRows] = useState<WorkOrder[]>([]);
  const [masterTotal, setMasterTotal] = useState(0);
  const [masterVehicles, setMasterVehicles] = useState<typeof vehicles>([]);
  const [masterInvoices, setMasterInvoices] = useState<typeof invoices>([]);
  const [masterAbonos, setMasterAbonos] = useState<MasterAbonoRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [deferredSearchTerm, timeFilter, queryDate, startDate, endDate]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  // Load the active page directly from Supabase (server-side pagination)
  useEffect(() => {
    let cancelled = false;
    setMasterLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetchMasterTablePage({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        searchTerm: deferredSearchTerm,
        timeFilter,
        queryDate,
        startDate,
        endDate,
      });
      if (cancelled) return;
      if (res) {
        setMasterRows(res.rows);
        setMasterTotal(res.total);
        setMasterVehicles(res.vehicles);
        setMasterInvoices(res.invoices);
        setMasterAbonos(res.abonos || []);
      }
      setMasterLoading(false);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentPage, deferredSearchTerm, timeFilter, queryDate, startDate, endDate, refreshNonce]);

  // Always fetch fresh Supabase data on mount (background for other tabs)
  useEffect(() => {
    syncFromSupabase();
  }, [syncFromSupabase]);

  // Selected row IDs for bulk deletion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // LIMPIEZA AUTOMÁTICA DE SELECCIÓN: si una fila seleccionada ya no existe en la
  // lista (borrada individualmente, en lote, o desde otra tablet vía realtime), se
  // quita de selectedIds para que el botón "Eliminar Seleccionados (N)" no siga
  // mostrando un conteo de filas que ya no están (bug reportado en Tabla Maestra).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const alive = new Set((workOrders || []).map((o) => o.id));
      const next = prev.filter((id) => alive.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [workOrders]);

  // Editing Workshop Order Modal State (Modificación de Fecha, Hora y Registro Completo)
  const [editingWorkshopOrder, setEditingWorkshopOrder] = useState<{
    orderId: string;
    vehiclePlate: string;
    entryDate: string; // YYYY-MM-DD
    entryTime: string; // HH:mm
    clientName: string;
    clientPhone: string;
    currentMileage: number;
    fuelType: string;
    brand: string;
    technicianName: string;
    maintenanceService: string;
    sparePartsServices: string;
    price: number;
    discounts: string;
    creditAmount: number;
    paymentCondition: string;
    paymentMethod: string;
    paymentDestination: string;
    receiptType: string;
    receiptNumber: string;
    quinquennialDate: string;
    chipExpiryDate: string;
  } | null>(null);

  // Web Confirmation Modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: "single" | "bulk" | "clearAll" | "abono";
    targetId?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    actionType: "single",
  });


  // Technician Form State
  const [techForm, setTechForm] = useState({
    full_name: "",
    email: "",
    specialty: "Master GNV 5ta Generación",
    phone: "",
    custom_password: "",
    can_receive_payment: false,
    is_debt_responsible: false,
    is_attention_responsible: false,
    is_mechanic_responsible: false,
    is_certification_responsible: false,
    payment_nickname: "",
  });

  // Technician Password Visibility Map on Cards
  const [showCardPasswordMap, setShowCardPasswordMap] = useState<Record<string, boolean>>({});

  const toggleCardPassword = (techId: string) => {
    setShowCardPasswordMap((prev) => ({ ...prev, [techId]: !prev[techId] }));
  };

  // Technician Edit Modal State
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techEditModalOpen, setTechEditModalOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [techEditForm, setTechEditForm] = useState({
    full_name: "",
    email: "",
    specialty: "",
    phone: "",
    username: "",
    password: "",
    can_receive_payment: false,
    is_debt_responsible: false,
    is_attention_responsible: false,
    is_mechanic_responsible: false,
    is_certification_responsible: false,
    payment_nickname: "",
    is_active: true,
  });

  // Quick Password Change Modal
  const [quickPassModal, setQuickPassModal] = useState<{
    isOpen: boolean;
    tech: Technician | null;
    newPass: string;
    showPass: boolean;
  }>({
    isOpen: false,
    tech: null,
    newPass: "",
    showPass: true,
  });

  const handleOpenEditTechModal = (tech: Technician) => {
    const defUser = generateDefaultUsername(tech.full_name);
    setEditingTech(tech);
    setTechEditForm({
      full_name: tech.full_name || "",
      email: tech.email || "",
      specialty: tech.specialty || "",
      phone: tech.phone || "",
      username: tech.username || defUser,
      password: tech.password || defUser,
      can_receive_payment: !!tech.can_receive_payment,
      is_debt_responsible: !!tech.is_debt_responsible,
      is_attention_responsible: !!tech.is_attention_responsible,
      is_mechanic_responsible: !!tech.is_mechanic_responsible,
      is_certification_responsible: !!tech.is_certification_responsible,
      payment_nickname: tech.payment_nickname || "",
      is_active: tech.is_active !== false,
    });
    setShowEditPassword(false);
    setTechEditModalOpen(true);
  };

  const handleSaveTechEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;
    if (!techEditForm.full_name.trim()) {
      notify("warning", "El nombre completo es obligatorio.");
      return;
    }
    const defUser = generateDefaultUsername(techEditForm.full_name);
    updateTechnician(editingTech.id, {
      full_name: techEditForm.full_name.trim(),
      email: techEditForm.email.trim(),
      specialty: techEditForm.specialty.trim() || "Técnico Especialista",
      phone: techEditForm.phone.trim(),
      username: techEditForm.username.trim() || defUser,
      password: techEditForm.password.trim() || defUser,
      can_receive_payment: techEditForm.can_receive_payment,
      is_debt_responsible: techEditForm.is_debt_responsible,
      is_attention_responsible: techEditForm.is_attention_responsible,
      is_mechanic_responsible: techEditForm.is_mechanic_responsible,
      is_certification_responsible: techEditForm.is_certification_responsible,
      payment_nickname: techEditForm.payment_nickname.trim(),
      is_active: techEditForm.is_active,
    });
    setTechEditModalOpen(false);
  };

  const handleOpenQuickPasswordModal = (tech: Technician) => {
    const currentPass = tech.password || tech.username || generateDefaultUsername(tech.full_name);
    setQuickPassModal({
      isOpen: true,
      tech,
      newPass: currentPass,
      showPass: true,
    });
  };

  const handleSaveQuickPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPassModal.tech || !quickPassModal.newPass.trim()) return;
    updateTechnician(quickPassModal.tech.id, {
      password: quickPassModal.newPass.trim(),
    });
    setQuickPassModal({ isOpen: false, tech: null, newPass: "", showPass: true });
  };

  const handleSendCredentialsEmail = (tech: Technician) => {
    const user = tech.username || generateDefaultUsername(tech.full_name);
    const pass = tech.password || user;
    const email = tech.email?.trim();
    const originUrl = typeof window !== "undefined" ? window.location.origin : "https://reygas.com";
    const loginUrl = `${originUrl}/login`;
    const resetPassUrl = `${originUrl}/cambiar-clave?u=${encodeURIComponent(user)}`;

    const subject = encodeURIComponent(`Credenciales de Acceso - ReyGas ERP (${tech.full_name})`);
    const body = encodeURIComponent(
      `Hola ${tech.full_name},\n\n` +
      `Se ha configurado tu cuenta de acceso en el Sistema ERP ReyGas:\n\n` +
      `• URL de Acceso: ${loginUrl}\n` +
      `• Usuario: ${user}\n` +
      `• Contraseña Inicial / Temporal: ${pass}\n` +
      `• Especialidad: ${tech.specialty}\n` +
      `• Estaciones Permitidas: ${(tech.allowed_tabs || ALL_ERP_STATIONS.map((s) => s.id)).length} de ${ALL_ERP_STATIONS.length}\n\n` +
      `🔑 ENLACE DIRECTO PARA CAMBIAR TU CONTRASEÑA:\n` +
      `Puedes establecer tu contraseña personalizada haciendo clic en el siguiente enlace:\n` +
      `${resetPassUrl}\n\n` +
      `Por favor inicia sesión desde la tablet de taller o tu equipo autorizado.\n\n` +
      `Atentamente,\nAdministración y Gerencia ReyGas`
    );

    if (email) {
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
      notify("success", `Abriendo cliente de correo para ${email}.`);
    } else {
      navigator.clipboard.writeText(`Usuario: ${user} | Contraseña: ${pass} | Acceso: ${loginUrl} | Cambiar Clave: ${resetPassUrl}`);
      notify("warning", `Personal sin correo. Se copiaron las credenciales y el enlace de cambio de clave al portapapeles.`);
      handleOpenEditTechModal(tech);
    }
  };

  // Schedule Record Add/Edit Form State
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    vehicle_plate: "",
    client_name: "",
    client_phone: "",
    current_mileage: 0,
    service_date: "",
    service_name: "Conversión GNV / Mantenimiento",
    expiry_quinquennial: "",
    expiry_chip_annual: "",
    next_maintenance_date: "",
    scheduled_date: "",
    status: "programado",
    notes: "",
  });

  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);
  const [isImportingWorkshop, setIsImportingWorkshop] = useState(false);

  const handleOpenScheduleModal = (record?: ScheduleRecord) => {
    if (record) {
      setEditingSchedule(record);
      setScheduleForm({
        vehicle_plate: record.vehicle_plate,
        client_name: record.client_name,
        client_phone: record.client_phone,
        current_mileage: record.current_mileage || 0,
        service_date: record.service_date || "",
        service_name: record.service_name || "Conversión GNV / Mantenimiento",
        expiry_quinquennial: record.expiry_quinquennial || "",
        expiry_chip_annual: record.expiry_chip_annual || "",
        next_maintenance_date: record.next_maintenance_date || "",
        scheduled_date: record.scheduled_date || "",
        status: record.status || "programado",
        notes: record.notes || "",
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        vehicle_plate: "",
        client_name: "",
        client_phone: "",
        current_mileage: 0,
        service_date: new Date().toISOString().slice(0, 10),
        service_name: "Conversión GNV / Mantenimiento",
        expiry_quinquennial: "",
        expiry_chip_annual: "",
        next_maintenance_date: "",
        scheduled_date: "",
        status: "programado",
        notes: "",
      });
    }
    setScheduleModalOpen(true);
  };

  const handleSaveScheduleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.vehicle_plate.trim()) {
      notify("warning", "Por favor ingresa la placa del vehículo.");
      return;
    }

    if (editingSchedule) {
      updateScheduleRecord(editingSchedule.id, {
        vehicle_plate: formatPlate(scheduleForm.vehicle_plate),
        client_name: titleCase(scheduleForm.client_name),
        client_phone: scheduleForm.client_phone.trim(),
        current_mileage: Number(scheduleForm.current_mileage) || 0,
        service_date: scheduleForm.service_date,
        service_name: scheduleForm.service_name,
        expiry_quinquennial: scheduleForm.expiry_quinquennial,
        expiry_chip_annual: scheduleForm.expiry_chip_annual,
        next_maintenance_date: scheduleForm.next_maintenance_date,
        scheduled_date: scheduleForm.scheduled_date,
        status: scheduleForm.status,
        notes: scheduleForm.notes,
      });
      notify("success", `Programación para ${scheduleForm.vehicle_plate.toUpperCase()} actualizada.`);
    } else {
      addScheduleRecord({
        vehicle_plate: formatPlate(scheduleForm.vehicle_plate),
        client_name: titleCase(scheduleForm.client_name) || "Cliente",
        client_phone: scheduleForm.client_phone.trim(),
        current_mileage: Number(scheduleForm.current_mileage) || 0,
        service_date: scheduleForm.service_date,
        service_name: scheduleForm.service_name,
        expiry_quinquennial: scheduleForm.expiry_quinquennial,
        expiry_chip_annual: scheduleForm.expiry_chip_annual,
        next_maintenance_date: scheduleForm.next_maintenance_date,
        scheduled_date: scheduleForm.scheduled_date,
        status: scheduleForm.status,
        notes: scheduleForm.notes,
      });
      notify("success", `Nueva programación para ${scheduleForm.vehicle_plate.toUpperCase()} guardada.`);
    }
    setScheduleModalOpen(false);
  };

  const handleScheduleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingSchedule(true);
    try {
      const text = await file.text();
      const rows = parseCSVRows(text);
      if (rows.length < 2) {
        notify("warning", "El archivo no contiene suficientes filas de datos.");
        setIsImportingSchedule(false);
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase().trim());
      // Identify column indices
      const plateIdx = headers.findIndex((h) => h.includes("placa"));
      const nameIdx = headers.findIndex((h) => h.includes("cliente") || h.includes("nombre") || h.includes("propietario"));
      const phoneIdx = headers.findIndex((h) => h.includes("tel") || h.includes("cel") || h.includes("fono") || h.includes("movil"));
      const kmIdx = headers.findIndex((h) => h.includes("km") || h.includes("kilometraje"));
      const dateIdx = headers.findIndex((h) => h.includes("fecha") && !h.includes("quinquenal") && !h.includes("chip") && !h.includes("anual"));
      const serviceIdx = headers.findIndex((h) => h.includes("servicio") || h.includes("mant") || h.includes("trabajo"));
      const quinqIdx = headers.findIndex((h) => h.includes("quinquenal"));
      const chipIdx = headers.findIndex((h) => h.includes("chip") || h.includes("anual") || h.includes("vencimiento"));
      const nextMantIdx = headers.findIndex((h) => h.includes("proximo") || h.includes("prox"));
      const statusIdx = headers.findIndex((h) => h.includes("estado") || h.includes("status"));
      const notesIdx = headers.findIndex((h) => h.includes("obs") || h.includes("nota"));

      const newRecords: ScheduleRecord[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const rawPlate = plateIdx >= 0 ? row[plateIdx] : row[0];
        const cleanPlate = (rawPlate || "").replace(/[^A-Z0-9-]/gi, "").toUpperCase().trim();
        if (!cleanPlate || cleanPlate.length < 3) continue;

        const clientName = nameIdx >= 0 ? (row[nameIdx] || "").trim() : "Cliente";
        const clientPhone = phoneIdx >= 0 ? (row[phoneIdx] || "").trim() : "";
        const rawKm = kmIdx >= 0 ? (row[kmIdx] || "").replace(/[^0-9]/g, "") : "0";
        const mileage = parseInt(rawKm, 10) || 0;
        const serviceDate = dateIdx >= 0 ? (row[dateIdx] || "").trim() : "";
        const serviceName = serviceIdx >= 0 ? (row[serviceIdx] || "").trim() : "Mantenimiento / Servicio";
        const expiryQuinq = quinqIdx >= 0 ? (row[quinqIdx] || "").trim() : "";
        const expiryChip = chipIdx >= 0 ? (row[chipIdx] || "").trim() : "";
        const nextMant = nextMantIdx >= 0 ? (row[nextMantIdx] || "").trim() : "";
        const status = statusIdx >= 0 ? (row[statusIdx] || "programado").trim().toLowerCase() : "programado";
        const notes = notesIdx >= 0 ? (row[notesIdx] || "").trim() : "";

        newRecords.push({
          id: generateUUID(),
          vehicle_plate: cleanPlate,
          client_name: clientName,
          client_phone: clientPhone,
          current_mileage: mileage,
          service_date: serviceDate,
          service_name: serviceName,
          expiry_quinquennial: expiryQuinq,
          expiry_chip_annual: expiryChip,
          next_maintenance_date: nextMant,
          status,
          notes,
        });
      }

      if (newRecords.length > 0) {
        const res = await importBulkScheduleRecords(newRecords);
        if (res?.success) {
          notify("success", `¡Se importaron ${newRecords.length} registros a la Tabla de Programación con éxito y guardados en Supabase!`);
        } else {
          notify("warning", `Se importaron ${newRecords.length} registros localmente, pero hubo un problema al guardar en Supabase: ${res?.errorMsg || "Respuesta diferida"}`);
        }
      } else {
        notify("warning", "No se detectaron placas válidas en el archivo.");
      }
    } catch (err: any) {
      notify("warning", `Error al procesar el archivo: ${err?.message || "Formato no compatible"}`);
    } finally {
      setIsImportingSchedule(false);
      e.target.value = "";
    }
  };

  const handleAddTech = (e: React.FormEvent) => {
    e.preventDefault();
    if (!techForm.full_name.trim()) {
      notify("warning", "Por favor ingresa el nombre del personal.");
      return;
    }
    const defUser = generateDefaultUsername(techForm.full_name);
    addTechnician({
      full_name: techForm.full_name.trim(),
      email: techForm.email.trim(),
      specialty: techForm.specialty.trim() || "Master GNV 5ta Generación",
      phone: techForm.phone.trim(),
      username: defUser,
      password: techForm.custom_password.trim() || defUser,
      is_active: true,
      can_receive_payment: techForm.can_receive_payment,
      is_debt_responsible: techForm.is_debt_responsible,
      is_attention_responsible: techForm.is_attention_responsible,
      is_mechanic_responsible: techForm.is_mechanic_responsible,
      is_certification_responsible: techForm.is_certification_responsible,
      payment_nickname: techForm.payment_nickname.trim(),
    });
    setTechForm({
      full_name: "",
      email: "",
      specialty: "Master GNV 5ta Generación",
      phone: "",
      custom_password: "",
      can_receive_payment: false,
      is_debt_responsible: false,
      is_attention_responsible: false,
      is_mechanic_responsible: false,
      is_certification_responsible: false,
      payment_nickname: "",
    });
  };

  // Importer for 20 Workshop Columns from CSV / Excel (Batch Processing for Performance)
  const handleImportFullWorkshopExcelCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingWorkshop(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = (evt.target?.result as string) || "";
      const rows = parseCSVRows(rawText);

      const batchVehicles: any[] = [];
      const batchWorkOrders: any[] = [];
      const batchInvoices: any[] = [];
      const seenRowKeys = new Set<string>();
      // Anti-duplicado: placa+fecha ya importadas en ESTE lote (evita cards duplicadas en Taller)
      const importedPlateDates = new Set<string>();
      let skippedDuplicates = 0;
      let skippedFuture = 0;
      let skippedBadDate = 0;

      const timestamp = Date.now();

      rows.forEach((cols, idx) => {
        if (idx === 0 || cols.length === 0) return;

        const record = parseWorkshopRow(cols);
        if (!record || !record.plate) return;

        const rowKey = `${record.rawDate}|${record.plate.toUpperCase()}|${record.receiptNumber}|${(record.clientName || "").toUpperCase()}|${(record.sparePartsServices || record.maintenanceService || "").toUpperCase()}|${record.price}|${record.creditAmount}|${(record.paymentMethod || "").toUpperCase()}`;
        if (seenRowKeys.has(rowKey)) return;
        seenRowKeys.add(rowKey);

        // Anti-duplicado de cards en Taller/Caja: si la placa ya tiene una orden con la
        // MISMA fecha en el ERP (portería/taller/caja) o ya se importó en este lote, la
        // fila se omite (ej: histórico CSV repetido de un vehículo que está en atención).
        const importEntryDate = (record.dateISO || "").slice(0, 10);
        const plateDateKey = `${record.plate.toUpperCase()}|${importEntryDate}`;
        const alreadyExistingSameDay = workOrders.some(
          (o) => o.vehicle_plate && o.vehicle_plate.toUpperCase() === record.plate.toUpperCase() &&
            (o.entry_time || "").slice(0, 10) === importEntryDate
        );
        if (alreadyExistingSameDay || importedPlateDates.has(plateDateKey)) {
          skippedDuplicates++;
          return;
        }
        importedPlateDates.add(plateDateKey);

        // Anti-fechas futuras: una atención registrada NO puede tener fecha posterior a hoy.
        // Los CSV con fechas erróneas (p. ej. setiembre 2026) dañan la información de la
        // Tabla Maestra; esas filas se omiten y se informan al final del import.
        if (importEntryDate > getPeruDateString()) {
          skippedFuture++;
          return;
        }

        // Anti-fecha ilegible: celdas con basura (p. ej. "1452s21d wf") se omiten en vez
        // de registrarse con la fecha de hoy (el parser no puede interpretarlas).
        const dateLooksValid = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(record.rawDate || "");
        if (!dateLooksValid) {
          skippedBadDate++;
          return;
        }

        const is_explicit_paid = record.paymentCondition.toUpperCase().includes("PAGADO");
        const is_credit_order = !is_explicit_paid && (
          record.creditAmount > 0 ||
          record.paymentCondition.toUpperCase().includes("CREDIT") ||
          record.paymentCondition.toUpperCase().includes("PENDIENTE")
        );

        const base_amount = record.price > 0 ? record.price : record.creditAmount;
        const discountNum = typeof record.discounts === "number" ? record.discounts : (parseFloat(String(record.discounts).replace(/[^0-9.]/g, "")) || 0);
        const parts_total = base_amount + discountNum;
        const grand_total = base_amount;
        const payment_status = is_explicit_paid
          ? "pagado"
          : (is_credit_order ? "pendiente" : (record.price > 0 ? "pagado" : (record.receiptNumber && record.receiptNumber !== "0" ? "pagado" : "pendiente")));
        const order_status = is_explicit_paid
          ? "pagado_autorizado"
          : (is_credit_order ? "por_cobrar" : (record.price > 0 ? "pagado_autorizado" : (record.receiptNumber && record.receiptNumber !== "0" ? "pagado_autorizado" : "en_espera")));

        const orderId = generateUUID();
        const invoiceId = generateUUID();
        const labor_fee = 0;

        batchVehicles.push({
          plate: record.plate,
          brand: record.brand,
          model: "",
          year: 0,
          color: "",
          fuel_type: record.fuelType as any,
          vehicle_type: record.vehicleType,
          owner_name: record.clientName,
          owner_phone: record.clientPhone,
          current_mileage: record.mileage,
          last_visit_date: record.dateISO,
        });

        batchWorkOrders.push({
          id: orderId,
          vehicle_plate: record.plate,
          status: order_status,
          problem_description: record.maintenanceService,
          diagnostic_notes: `Registro Histórico Tabla Maestra. Quinquenal: ${record.quinquennialDate} • Chip Anual: ${record.chipExpiryDate} • Técnico: ${record.technicianName}${record.discounts ? ` • [DESCUENTO]: ${record.discounts}` : ""}${record.creditAmount > 0 ? ` • [CREDITO]: ${record.creditAmount}` : ""}`,
          observations: "",
          assigned_technician_id: record.technicianName,
          entry_time: record.dateISO,
          vehicle_type: record.vehicleType,
          items: record.sparePartsServices || record.maintenanceService
            ? [
              {
                id: `item-${timestamp}-${idx}`,
                description: record.sparePartsServices || record.maintenanceService,
                quantity: 1,
                unit_price: parts_total,
                subtotal: parts_total,
              },
            ]
            : [],
          quinquennial_date: record.quinquennialDate,
          chip_expiry_date: record.chipExpiryDate,
          general_maintenance_service: record.maintenanceService,
          spare_parts_services: record.sparePartsServices,
        });

        batchInvoices.push({
          id: invoiceId,
          work_order_id: orderId,
          vehicle_plate: record.plate,
          client_name: record.clientName,
          labor_fee,
          parts_total,
          certification_fee: 0,
          grand_total,
          payment_status,
          payment_method: record.paymentMethod,
          issued_at: record.dateISO,
          paid_at: is_credit_order ? undefined : record.dateISO,
          receipt_number: record.receiptNumber,
          receipt_type: record.receiptType,
          discounts: record.discounts,
          credit_amount: record.creditAmount,
          raw_price_str: record.rawPrice,
          raw_credit_str: record.rawCredit,
          payment_condition: record.paymentCondition,
          payment_destination: record.paymentDestination,
          customer_doc: record.customerDoc,
        });
      });

      if (batchWorkOrders.length > 0) {
        useAppStore.getState().importBulkWorkshopData({
          vehicles: batchVehicles,
          workOrders: batchWorkOrders,
          invoices: batchInvoices,
        }).then((res) => {
          const dupNote = skippedDuplicates > 0 ? ` (${skippedDuplicates} filas omitidas por ser duplicadas de órdenes existentes de la misma placa y fecha)` : "";
          const futureNote = skippedFuture > 0 ? ` (${skippedFuture} filas omitidas por tener fecha futura, posterior a hoy: corríjalas en el Excel y vuelva a importar)` : "";
          const badDateNote = skippedBadDate > 0 ? ` (${skippedBadDate} filas omitidas por tener fecha ilegible: corrija esa celda en el Excel)` : "";
          if (res?.success) {
            notify("success", `¡Se importaron ${batchWorkOrders.length} registros exitosamente y guardados en Supabase!${dupNote}${futureNote}${badDateNote}`);
          } else {
            notify("warning", `Se importaron ${batchWorkOrders.length} registros localmente, pero hubo un problema al guardar en Supabase: ${res?.errorMsg || "Respuesta diferida"}${dupNote}${futureNote}${badDateNote}`);
          }
        }).finally(() => {
          setIsImportingWorkshop(false);
          setRefreshNonce((n) => n + 1);
        });
      } else if (skippedDuplicates > 0 || skippedFuture > 0 || skippedBadDate > 0) {
        setIsImportingWorkshop(false);
        notify("warning", `No se importó nada: ${skippedDuplicates} filas duplicadas de la misma placa y fecha, ${skippedFuture} con fecha futura (posterior a hoy) y ${skippedBadDate} con fecha ilegible. Corrija el Excel y vuelva a importar.`);
      } else {
        setIsImportingWorkshop(false);
        notify("warning", "Verifique que el archivo CSV contenga las columnas correctas.");
      }
    };
    reader.readAsText(file);
  };

  // O(1) Lookup maps over the server-paginated page (only the active 250 rows
  // + their related vehicles/invoices are in memory, never the 41k+ dataset)
  const invoicesByWorkOrderId = React.useMemo(() => {
    const map = new Map<string, (typeof invoices)[0]>();
    const src = masterInvoices.length > 0 ? masterInvoices : invoices;
    for (let i = 0; i < src.length; i++) {
      const inv = src[i];
      if (inv && inv.work_order_id) {
        map.set(inv.work_order_id, inv);
      }
    }
    return map;
  }, [masterInvoices, invoices]);

  const vehiclesByPlate = React.useMemo(() => {
    const map = new Map<string, (typeof vehicles)[0]>();
    const src = masterVehicles.length > 0 ? masterVehicles : vehicles;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      if (v && v.plate) {
        map.set(v.plate, v);
      }
    }
    return map;
  }, [masterVehicles, vehicles]);

  // Saldo por placa: SOLO el registro MÁS RECIENTE con saldo pendiente (crédito > 0)
  // muestra su saldo. Los registros anteriores de la misma placa quedan en blanco para
  // no duplicar el saldo de la placa (Monto + Saldo del último = total real por placa).
  const saldoPlateMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const creditOf = (wo: WorkOrder) => {
      const inv = invoicesByWorkOrderId.get(wo.id);
      if (!inv) return 0;
      return inv.raw_credit_str != null && inv.raw_credit_str !== ""
        ? parseAmt(inv.raw_credit_str)
        : (Number(inv.credit_amount) || 0);
    };
    for (const wo of masterRows) {
      const credit = creditOf(wo);
      if (credit <= 0) continue;
      const key = (wo.vehicle_plate || "").toUpperCase();
      const curId = map.get(key);
      const cur = curId ? masterRows.find((o) => o.id === curId) : undefined;
      if (!cur || (wo.entry_time || "") > (cur.entry_time || "")) {
        map.set(key, wo.id);
      }
    }
    return map;
  }, [masterRows, invoicesByWorkOrderId]);

  // Rows shown in the table = the server-paginated active page
  const filteredOrders = React.useMemo(() => {
    return masterRows;
  }, [masterRows]);

  // Calculate Pagination (server-side: total comes from the count query)
  const totalItems = masterTotal;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedOrders = filteredOrders;

  // Checkbox selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredOrders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Editing Handlers for Workshop Orders (Modificar fecha, hora y datos)
  const handleOpenEditWorkshopOrder = (wo: WorkOrder) => {
    const veh = vehiclesByPlate.get(wo.vehicle_plate);
    const inv = invoicesByWorkOrderId.get(wo.id);

    let datePart = getPeruDateString();
    let timePart = "08:30";
    if (wo.entry_time) {
      if (wo.entry_time.includes("T")) {
        datePart = wo.entry_time.slice(0, 10);
        timePart = wo.entry_time.slice(11, 16);
      } else {
        datePart = wo.entry_time;
      }
    }

    setEditingWorkshopOrder({
      orderId: wo.id,
      vehiclePlate: wo.vehicle_plate,
      entryDate: datePart,
      entryTime: timePart,
      clientName: veh?.owner_name || inv?.client_name || "",
      clientPhone: veh?.owner_phone || "",
      currentMileage: veh?.current_mileage || 0,
      fuelType: veh?.fuel_type || "GNV",
      brand: veh?.brand || "Toyota",
      technicianName: resolveTechnicianName(wo.assigned_technician_id || ""),
      maintenanceService: wo.general_maintenance_service || wo.problem_description || "",
      sparePartsServices: wo.spare_parts_services || (wo.items.length > 0 ? wo.items.map((i) => i.description).join(", ") : ""),
      price: inv?.grand_total || (wo.items.length > 0 ? wo.items[0].subtotal : 0),
      discounts: String(inv?.discounts || ""),
      creditAmount: inv?.credit_amount || 0,
      paymentCondition: inv?.payment_condition || "PAGADO",
      paymentMethod: defaultMethodFrom(inv?.payment_method),
      paymentDestination: inv?.payment_destination || "EMPRESA",
      receiptType: inv?.receipt_type || "Ticket",
      receiptNumber: inv?.receipt_number || "",
      quinquennialDate: wo.quinquennial_date || "",
      chipExpiryDate: wo.chip_expiry_date || "",
    });
  };

  const handleSaveEditWorkshopOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshopOrder) return;

    const newDateTimeISO = buildPeruISOString(editingWorkshopOrder.entryDate, editingWorkshopOrder.entryTime || "08:30");

    // 1. Update Work Order (including entry_time / hora de ingreso!)
    // IMPORTANTE: se PRESERVAN los ítems reales de la orden (repuestos/servicios del Taller).
    // Solo se crea un ítem desde el texto si la orden NO tiene ítems (evita reemplazar y
    // corromper los totales reales de la card).
    // BUG FIX: la Tabla Maestra carga filas de TODO el historial (servidor), pero la tienda
    // local solo tiene la ventana reciente. updateWorkOrder/updateInvoice solo actúan si la
    // fila está en esa ventana -> el guardado no hacía nada en filas antiguas. Ahora se
    // guarda DIRECTAMENTE en Supabase con el objeto de la fila maestra (siempre persiste).
    const currentWo = masterRows.find((o) => o.id === editingWorkshopOrder.orderId) || workOrders.find((o) => o.id === editingWorkshopOrder.orderId);
    const existingItems = Array.isArray(currentWo?.items) && currentWo.items.length > 0 ? currentWo.items : [];
    // Si el texto del técnico coincide con el roster, se guarda el ID (tech-xxx); si no, el texto.
    const techText = (editingWorkshopOrder.technicianName || "").trim();
    const matchedTech = technicians.find((t) => t.full_name.toLowerCase() === techText.toLowerCase()) || technicians.find((t) => t.id === techText);
    const assignedTech = matchedTech ? matchedTech.id : techText;
    const updatedWo: any = {
      ...(currentWo || { id: editingWorkshopOrder.orderId, vehicle_plate: formatPlate(editingWorkshopOrder.vehiclePlate) }),
      id: editingWorkshopOrder.orderId,
      status: (currentWo as any)?.status || "ingresado",
      entry_time: newDateTimeISO,
      vehicle_plate: formatPlate(editingWorkshopOrder.vehiclePlate),
      assigned_technician_id: assignedTech,
      problem_description: editingWorkshopOrder.maintenanceService,
      general_maintenance_service: editingWorkshopOrder.maintenanceService,
      spare_parts_services: editingWorkshopOrder.sparePartsServices,
      quinquennial_date: editingWorkshopOrder.quinquennialDate,
      chip_expiry_date: editingWorkshopOrder.chipExpiryDate,
      items: existingItems.length > 0
        ? existingItems
        : (editingWorkshopOrder.sparePartsServices || editingWorkshopOrder.maintenanceService
            ? [
              {
                id: `item-${editingWorkshopOrder.orderId}`,
                description: editingWorkshopOrder.sparePartsServices || editingWorkshopOrder.maintenanceService,
                quantity: 1,
                unit_price: Number(editingWorkshopOrder.price) || 0,
                subtotal: Number(editingWorkshopOrder.price) || 0,
              },
            ]
            : []),
    };
    saveSupabaseWorkOrder(updatedWo);
    updateWorkOrder(editingWorkshopOrder.orderId, {
      entry_time: newDateTimeISO,
      vehicle_plate: formatPlate(editingWorkshopOrder.vehiclePlate),
      assigned_technician_id: assignedTech,
      problem_description: editingWorkshopOrder.maintenanceService,
      general_maintenance_service: editingWorkshopOrder.maintenanceService,
      spare_parts_services: editingWorkshopOrder.sparePartsServices,
      quinquennial_date: editingWorkshopOrder.quinquennialDate,
      chip_expiry_date: editingWorkshopOrder.chipExpiryDate,
      items: updatedWo.items,
    });

    // 2. Update Vehicle
    updateVehicle(editingWorkshopOrder.vehiclePlate, {
      brand: editingWorkshopOrder.brand,
      fuel_type: editingWorkshopOrder.fuelType as any,
      owner_name: editingWorkshopOrder.clientName,
      owner_phone: editingWorkshopOrder.clientPhone,
      current_mileage: Number(editingWorkshopOrder.currentMileage) || 0,
      last_visit_date: newDateTimeISO,
    });

    // 3. Update Invoice if exists (guardado DIRECTO en la nube para que persista siempre)
    const targetInv = invoicesByWorkOrderId.get(editingWorkshopOrder.orderId);
    if (targetInv) {
      const updatedInv = {
        ...targetInv,
        vehicle_plate: formatPlate(editingWorkshopOrder.vehiclePlate),
        client_name: titleCase(editingWorkshopOrder.clientName),
        parts_total: Number(editingWorkshopOrder.price) || 0,
        grand_total: Number(editingWorkshopOrder.price) || 0,
        issued_at: newDateTimeISO,
        payment_condition: editingWorkshopOrder.paymentCondition,
        payment_method: editingWorkshopOrder.paymentMethod,
        payment_destination: editingWorkshopOrder.paymentDestination,
        receipt_type: editingWorkshopOrder.receiptType,
        receipt_number: editingWorkshopOrder.receiptNumber,
        discounts: editingWorkshopOrder.discounts,
        credit_amount: Number(editingWorkshopOrder.creditAmount) || 0,
      };
      saveSupabaseInvoice(updatedInv);
      updateInvoice(targetInv.id, {
        vehicle_plate: formatPlate(editingWorkshopOrder.vehiclePlate),
        client_name: titleCase(editingWorkshopOrder.clientName),
        parts_total: Number(editingWorkshopOrder.price) || 0,
        grand_total: Number(editingWorkshopOrder.price) || 0,
        issued_at: newDateTimeISO,
        payment_condition: editingWorkshopOrder.paymentCondition,
        payment_method: editingWorkshopOrder.paymentMethod,
        payment_destination: editingWorkshopOrder.paymentDestination,
        receipt_type: editingWorkshopOrder.receiptType,
        receipt_number: editingWorkshopOrder.receiptNumber,
        discounts: editingWorkshopOrder.discounts,
        credit_amount: Number(editingWorkshopOrder.creditAmount) || 0,
      });
    }

    notify("success", `¡Registro de ${editingWorkshopOrder.vehiclePlate} modificado exitosamente con hora ${editingWorkshopOrder.entryTime}!`);
    setEditingWorkshopOrder(null);
    setRefreshNonce((n) => n + 1);
  };

  // Confirmation trigger helpers
  const triggerDeleteSingle = (id: string, plate: string) => {
    setModalConfig({
      isOpen: true,
      title: `Confirmar Eliminación de Registro`,
      description: `¿Está seguro de eliminar la fila del registro de atención de la placa ${plate}? Esta acción no se puede deshacer.`,
      actionType: "single",
      targetId: id,
    });
  };

  // Eliminar UN ABONO (pago parcial) desde la Tabla Maestra: quita el registro del
  // reporte diario y recalcula el saldo de la factura original (la OT se mantiene).
  const triggerDeleteAbono = (abono: MasterAbonoRow) => {
    setModalConfig({
      isOpen: true,
      title: "Confirmar Eliminación de ABONO",
      description: "¿Está seguro de eliminar el abono de S/ " + abono.amount.toFixed(2) + " (" + (abono.receipt_number || "s/n") + ") de la placa " + abono.vehicle_plate + " con fecha " + formatPeruDate(abono.date) + "? Se quitará del reporte diario y la factura original recalculará su saldo. Esta acción no se puede deshacer.",
      actionType: "abono",
      targetId: abono.id,
    });
  };

  const triggerDeleteBulk = () => {
    if (selectedIds.length === 0) return;
    setModalConfig({
      isOpen: true,
      title: `Confirmar Eliminación de ${selectedIds.length} Filas`,
      description: `¿Está seguro de eliminar las ${selectedIds.length} filas seleccionadas de la Tabla Maestra? Se borrarán de la base de datos de Supabase.`,
      actionType: "bulk",
    });
  };

  const triggerClearAll = () => {
    setModalConfig({
      isOpen: true,
      title: `⚠️ LIMPIEZA COMPLETA DE BASE DE DATOS`,
      description: `¿Está absolutamente seguro de VACIAR TODOS los registros de atención de la Tabla Maestra? Todos los datos cargados serán eliminados de la nube de Supabase.`,
      actionType: "clearAll",
    });
  };

  // Confirm Modal Execution
  const handleConfirmAction = () => {
    if (modalConfig.actionType === "single" && modalConfig.targetId) {
      deleteWorkOrder(modalConfig.targetId);
      notify("success", "Registro eliminado correctamente de la Tabla Maestra.");
      setSelectedIds((prev) => prev.filter((id) => id !== modalConfig.targetId));
    } else if (modalConfig.actionType === "bulk") {
      deleteMultipleWorkOrders(selectedIds);
      notify("success", `Se eliminaron ${selectedIds.length} filas seleccionadas.`);
      setSelectedIds([]);
    } else if (modalConfig.actionType === "abono" && modalConfig.targetId) {
      deleteSupabasePaymentRecord(modalConfig.targetId).then((res) => {
        if (res?.ok) {
          notify("success", "Abono eliminado de la Tabla Maestra y del reporte diario.");
        } else {
          notify("error", "No se pudo eliminar el abono.");
        }
      });
    } else if (modalConfig.actionType === "clearAll") {
      clearAllWorkOrders();
      notify("warning", "Base de datos de la Tabla Maestra vaciada por completo.");
      setSelectedIds([]);
    }
    setModalConfig({ ...modalConfig, isOpen: false });
    setRefreshNonce((n) => n + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Table className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Tabla Maestra de Registros & Personal</h1>
            <p className="text-xs text-gray-400">
              Visualización, importación masiva de Excel (20 columnas) y gestión de registros de atención e insumos del taller.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 bg-reygas-dark p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("taller")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "taller"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Registros del Taller (20 Encabezados + Obs)</span>
          </button>

          <button
            onClick={() => setActiveTab("personal")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "personal"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Roster & Permisos de Personal ({technicians.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("servicios")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "servicios"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Catálogo de Servicios ({workshopServices?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("programacion")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "programacion"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Tabla de Programación & Vencimientos ({scheduleRecords?.length || 0})</span>
          </button>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* TAB 1: WORKSHOP MASTER REGISTRATION TABLE (20 HEADERS + OBSERVACIONES) */}
      {/* ========================================================================= */}
      {activeTab === "taller" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          {/* Date Filter Bar & Controls Toolbar */}
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4">
            {/* Top Row: Date Navigator & Filter Mode Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase font-bold text-gray-400 flex items-center gap-1.5 mr-1">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Filtrar por Fecha:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setTimeFilter("todos")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${timeFilter === "todos"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    }`}
                >
                  Histórico ({masterTotal.toLocaleString()})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter("hoy");
                    setQueryDate(getPeruDateString());
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${timeFilter === "hoy"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    }`}
                >
                  Hoy
                </button>

                <button
                  type="button"
                  onClick={() => setTimeFilter("fecha")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${timeFilter === "fecha"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    }`}
                >
                  Por Día Específico
                </button>

                <button
                  type="button"
                  onClick={() => setTimeFilter("rango")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${timeFilter === "rango"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    }`}
                >
                  Por Rango
                </button>
              </div>

              {/* Date Inputs based on Filter Mode */}
              <div className="flex items-center gap-2 flex-wrap">
                {timeFilter === "fecha" && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 font-bold">Fecha:</label>
                    <DateNavigator value={queryDate} onChange={setQueryDate} />
                  </div>
                )}

                {timeFilter === "rango" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-gray-400 font-bold">Desde:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-bold text-white focus:border-indigo-400"
                    />
                    <label className="text-xs text-gray-400 font-bold">Hasta:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-bold text-white focus:border-indigo-400"
                    />
                  </div>
                )}

                <div className="px-3 py-1 rounded-xl bg-white/5 text-[11px] font-bold text-gray-300 border border-white/10">
                  Mostrando: <span className="text-indigo-300 font-black">{masterTotal.toLocaleString()}</span> registros
                </div>
              </div>
            </div>

            {/* Bottom Row: Text Search, Refresh, Bulk Actions & Excel Upload */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por placa, cliente o comprobante..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white uppercase focus:border-indigo-400 w-64"
                  />
                </div>

                <button
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  disabled={masterLoading}
                  className="px-3.5 py-2 bg-reygas-surface hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1.5 shadow"
                  title="Recargar la página activa desde Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${masterLoading ? "animate-spin" : ""}`} />
                  <span>{masterLoading ? "Cargando..." : "Refrescar Tabla"}</span>
                </button>

                {selectedIds.length > 0 && (
                  <button
                    onClick={triggerDeleteBulk}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-red-600/30 animate-pulse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Seleccionados ({selectedIds.length})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label
                  className={`cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/30 whitespace-nowrap ${isImportingWorkshop ? "opacity-70 pointer-events-none" : ""
                    }`}
                >
                  {isImportingWorkshop ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isImportingWorkshop ? "Subiendo datos a la nube..." : "Cargar Excel Taller (21 Encabezados)"}</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportFullWorkshopExcelCSV}
                    className="hidden"
                  />
                </label>

                {masterTotal > 0 && (
                  <button
                    onClick={triggerClearAll}
                    className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                    title="Eliminar absolutamente todos los registros de la tabla maestra"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Vaciar Todo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Master Table Grid */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs text-gray-300 whitespace-nowrap">
              <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedOrders.length > 0 &&
                        paginatedOrders.every((o) => selectedIds.includes(o.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-12 font-black">#</th>
                  <th className="p-3">Fecha / Hora</th>
                  <th className="p-3">FECHA QUINTENAL</th>
                  <th className="p-3">FECHA CHIP ANUAL</th>
                  <th className="p-3">TIPO</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Marca</th>
                  <th className="p-3">KILOMETRAJE</th>
                  <th className="p-3 font-black text-white">PLACA</th>
                  <th className="p-3">N° de boleta/Factura</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3 max-w-[200px]">MANT. GENERAL / SERVICIO</th>
                  <th className="p-3 max-w-[200px]">REPUESTOS Y SERVICIOS</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">DESCUENTOS</th>
                  <th className="p-3">Saldo</th>
                  <th className="p-3">Condicion</th>
                  <th className="p-3">METODO DE PAGO</th>
                  <th className="p-3">DESTINO DE PAGO</th>
                  <th className="p-3">COMPROBANTE</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {masterLoading && masterTotal === 0 ? (
                  <tr>
                    <td colSpan={24} className="text-center py-16 text-gray-500">
                      <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-60" />
                      <p className="font-bold text-gray-400">Cargando registros del taller...</p>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="text-center py-16 text-gray-500">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-gray-400">No hay registros cargados en la Tabla Maestra.</p>
                      <p className="text-[11px] text-gray-500">
                        Utilice el botón <strong>"Cargar Excel Taller (21 Encabezados)"</strong> para importar su historial.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    let rowCounter = startIndex;
                    return paginatedOrders.map((wo, index) => {
                    const veh = vehiclesByPlate.get(wo.vehicle_plate);
                    const inv = invoicesByWorkOrderId.get(wo.id);
                    const isSelected = selectedIds.includes(wo.id);

                    // MONTO = lo realmente PAGADO en ese registro (Total - Saldo): sirve para
                    // reportes y suma con el Saldo al total. SALDO = crédito vigente, mostrado
                    // SOLO en el registro más reciente de la placa (evita duplicar saldos).
                    const totalNum = inv
                      ? (inv.raw_price_str != null && inv.raw_price_str !== "" ? parseAmt(inv.raw_price_str) : (Number(inv.grand_total) || 0))
                      : 0;
                    const creditNum = inv
                      ? (inv.raw_credit_str != null && inv.raw_credit_str !== "" ? parseAmt(inv.raw_credit_str) : (Number(inv.credit_amount) || 0))
                      : 0;
                    const isPaidRow = inv
                      ? (inv.payment_status === "pagado" || String(inv.payment_condition || "").toUpperCase() === "PAGADO")
                      : false;
                    const montoNum = inv
                      ? (creditNum > 0 ? Math.max(0, totalNum - creditNum) : (isPaidRow ? totalNum : 0))
                      : 0;
                    // Filas "GASTO" (egresos de caja registrados en la Tabla Maestra):
                    // se muestran con monto NEGATIVO y estilo distintivo.
                    const isGasto = (wo.vehicle_plate || "").toUpperCase() === "GASTO";
                    const montoVal = isGasto
                      ? `− S/ ${((wo.items && wo.items[0] && Number(wo.items[0].subtotal)) || 0).toFixed(2)}`
                      : (montoNum > 0
                          ? `S/ ${montoNum.toFixed(2)}`
                          : (inv ? "" : (wo.items.length > 0 && wo.items[0].subtotal > 0 ? `S/ ${wo.items[0].subtotal.toFixed(2)}` : "")));

                    const discountVal = inv?.discounts !== undefined && inv.discounts !== ""
                      ? String(inv.discounts)
                      : "";

                    const showSaldo = inv ? saldoPlateMap.get((wo.vehicle_plate || "").toUpperCase()) === wo.id : false;
                    const saldoVal = showSaldo && creditNum > 0 ? `S/ ${creditNum.toFixed(2)}` : "";
                    // Método limpio: nunca "Mixto (Mixto (...))" ni rastros de abonos borrados
                    const methodClean = inv ? (cleanMethodDisplay(inv.payment_method, montoNum > 0 ? montoNum : undefined) || inv.payment_method || "") : "";

                    // Cada PAGO del historial con su propio N° de Ticket/Boleta/Factura se muestra
                    // en SU PROPIA fila de la Tabla Maestra (igual que el historial de la card de Caja).
                    const histRecs = Array.isArray(inv?.payment_history) ? (inv.payment_history as any[]) : [];
                    const comprobantes = histRecs.filter(
                      (r) => r && r.receipt_number && String(r.receipt_number).trim() !== "" && String(r.receipt_number) !== "0" && String(r.receipt_number).toLowerCase() !== "s/n"
                    );
                    const expandComprobantes = comprobantes.length > 1;

                    const renderMasterRow = (opts: {
                      key: string;
                      rowNumber: number;
                      showActions: boolean;
                      isFirst: boolean;
                      receiptNumber: string;
                      receiptType: string;
                      method: string;
                      destination: string;
                      monto: string;
                      isGasto?: boolean;
                    }) => {
                      const { key, rowNumber, showActions, isFirst, receiptNumber, receiptType, method, destination, monto, isGasto } = opts;
                      return (
                        <tr key={key} className={`${isGasto ? "bg-rose-950/30" : ""} hover:bg-white/5 transition-colors ${isSelected ? "bg-indigo-950/40" : ""}`}>
                          <td className="p-3 text-center">
                            {showActions ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(wo.id)}
                                className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                              />
                            ) : null}
                          </td>
                          <td className="p-3 font-mono font-bold text-gray-400">#{rowNumber}</td>
                          <td className="p-3 font-mono text-purple-300">
                            <div className="font-bold">{wo.entry_time ? (wo.entry_time.includes("T") ? formatPeruDate(wo.entry_time) : wo.entry_time) : ""}</div>
                            {wo.entry_time && wo.entry_time.includes("T") && (
                              <div className="text-[10px] text-cyan-300 font-semibold">{wo.entry_time.slice(11, 16)} hrs</div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-purple-400 font-bold">{wo.quinquennial_date || ""}</td>
                          <td className="p-3 font-mono text-cyan-400 font-bold">{wo.chip_expiry_date || ""}</td>
                          <td className="p-3 text-cyan-300 font-semibold">{wo.vehicle_type || veh?.vehicle_type || ""}</td>
                          <td className="p-3 text-amber-300 font-bold">{veh?.fuel_type || ""}</td>
                          <td className="p-3 text-gray-200">{veh?.brand || ""}</td>
                          <td className="p-3 font-mono">{veh?.current_mileage && veh.current_mileage > 0 ? `${veh.current_mileage}` : ""}</td>
                          <td className="p-3 font-mono font-black text-white bg-reygas-surface/60 px-2 py-1 rounded border border-white/10">{wo.vehicle_plate}</td>
                          <td className="p-3 font-mono text-white">{receiptNumber}</td>
                          <td className="p-3 text-white font-semibold truncate max-w-[150px]">{veh?.owner_name || inv?.client_name || ""}</td>
                          <td className="p-3 font-mono text-gray-300">{veh?.owner_phone || ""}</td>
                          <td className="p-3 text-amber-300 font-bold">{resolveTechnicianName(wo.assigned_technician_id || "") || ""}</td>
                          <td className="p-3 truncate max-w-[200px] text-gray-200">{wo.general_maintenance_service || ""}</td>
                          <td className="p-3 truncate max-w-[200px] text-gray-400">{wo.spare_parts_services || (wo.items.length > 0 ? wo.items.map((i) => i.description).join(", ") : "")}</td>
                          <td className={`p-3 font-mono font-bold ${isGasto ? "text-rose-300" : "text-white"}`}>{monto}</td>
                          <td className="p-3 font-mono text-gray-400">{isFirst ? discountVal : ""}</td>
                          <td className="p-3 font-mono text-amber-400 font-bold">{isFirst ? saldoVal : ""}</td>
                          <td className="p-3 font-bold text-gray-200">{inv?.payment_condition || ""}</td>
                          <td className="p-3 text-emerald-300 font-bold">{method}</td>
                          <td className="p-3 text-purple-300">{destination}</td>
                          <td className="p-3 font-bold text-cyan-300">{receiptType}</td>
                          <td className="p-3 text-center">
                            {showActions ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditWorkshopOrder(wo)}
                                  className="p-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-lg transition-colors"
                                  title="Modificar fecha, hora y datos del registro"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => triggerDeleteSingle(wo.id, wo.vehicle_plate)}
                                  className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                                  title="Eliminar esta fila"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    };

                    if (expandComprobantes) {
                      return comprobantes.map((rec, si) => {
                        const recAmount = Number(rec.amount) || 0;
                        return renderMasterRow({
                          key: `${wo.id}-pay-${si}`,
                          rowNumber: ++rowCounter,
                          showActions: true,
                          isFirst: si === 0,
                          receiptNumber: String(rec.receipt_number || ""),
                          receiptType: rec.receipt_type || inv?.receipt_type || "",
                          method: cleanMethodDisplay(rec.method, recAmount) || rec.method || "",
                          destination: rec.destination || inv?.payment_destination || "",
                          monto: recAmount > 0 ? `S/ ${recAmount.toFixed(2)}` : "",
                          isGasto,
                        });
                      });
                    }
                    return renderMasterRow({
                      key: wo.id,
                      rowNumber: ++rowCounter,
                      showActions: true,
                      isFirst: true,
                      receiptNumber: String(inv?.receipt_number || ""),
                      receiptType: inv?.receipt_type || "",
                      method: methodClean,
                      destination: inv?.payment_destination || "",
                      monto: montoVal,
                      isGasto,
                    });
                  });
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* ABONOS DEL RANGO: pagos parciales con su propio comprobante/fecha.
              Fuente única con el reporte diario (inv_payhistory_*): al eliminarlos
              desde aquí desaparecen del informe del día y la factura recalcula su saldo. */}
          {masterAbonos.length > 0 && (
            <div className="mt-6 rounded-xl border border-cyan-500/30 overflow-hidden">
              <div className="bg-cyan-950/40 px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between">
                <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Abonos / Pagos Parciales del Rango ({masterAbonos.length})
                </h3>
                <p className="text-[11px] text-gray-400">
                  Se muestran con su fecha propia (pueden diferir de la OT original). Al eliminarlos se quitan del reporte diario.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300 whitespace-nowrap">
                  <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 font-black text-white">PLACA</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">N° comprobante</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Método</th>
                      <th className="p-3">Destino</th>
                      <th className="p-3">Monto</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {masterAbonos.map((ab) => (
                      <tr key={ab.id} className="bg-cyan-950/20 hover:bg-cyan-900/30 transition-colors">
                        <td className="p-3 font-mono text-purple-300">
                          {formatPeruDate(ab.date)}
                          {ab.date.includes("T") && <div className="text-[10px] text-cyan-300 font-semibold">{ab.date.slice(11, 16)} hrs</div>}
                        </td>
                        <td className="p-3 font-mono font-black text-white bg-reygas-surface/60 px-2 py-1 rounded border border-white/10">{ab.vehicle_plate}</td>
                        <td className="p-3 font-semibold text-white">{ab.client_name || ""}</td>
                        <td className="p-3 font-mono text-white">{ab.receipt_number}</td>
                        <td className="p-3 text-cyan-300 font-bold">{ab.receipt_type || "Ticket"}</td>
                        <td className="p-3 text-emerald-300 font-bold">{ab.method}</td>
                        <td className="p-3 text-purple-300">{ab.destination}</td>
                        <td className="p-3 font-mono font-bold text-white">S/ {ab.amount.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => triggerDeleteAbono(ab)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                            title="Eliminar este abono"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Navigation */}
          {filteredOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs">
              <div className="text-gray-400">
                Mostrando registros <span className="text-white font-bold">{startIndex + 1}</span> a{" "}
                <span className="text-white font-bold">{Math.min(endIndex, filteredOrders.length)}</span> de{" "}
                <span className="text-white font-bold">{filteredOrders.length.toLocaleString()}</span> totales
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  <span>&larr;</span>
                  <span>Anterior ({ITEMS_PER_PAGE})</span>
                </button>

                {/* Direct Jump to Page Input / Quick Selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-amber-500/40 text-gray-300 font-semibold shadow">
                  <span className="text-amber-400 font-bold">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(pageInput);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1 bg-reygas-dark border border-white/20 rounded-lg text-white font-mono font-black text-center focus:border-amber-400 focus:outline-none"
                  />
                  <span>de <strong className="text-white font-black">{totalPages}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseInt(pageInput);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg transition-transform hover:scale-105 shadow text-xs"
                  >
                    Ir
                  </button>
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  <span>Siguientes ({ITEMS_PER_PAGE})</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONAL & PERMISOS POR PESTAÑA */}
      {/* ========================================================================= */}
      {activeTab === "personal" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* New Technician Form */}
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Registrar Nuevo Personal</span>
            </h2>
            <form onSubmit={handleAddTech} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mario Alvarado"
                  value={techForm.full_name}
                  onChange={(e) => setTechForm({ ...techForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Correo Electrónico (Para envío de acceso)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={techForm.email}
                    onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Especialidad Principal *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Diagnóstico ECU & Inyección Gas"
                  value={techForm.specialty}
                  onChange={(e) => setTechForm({ ...techForm, specialty: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Teléfono de Contacto</label>
                <input
                  type="tel"
                  placeholder="+51 987654321"
                  value={techForm.phone}
                  onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                />
              </div>

              {/* Dynamic Auto-User & Password Preview Box */}
              {techForm.full_name && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <AtSign className="w-3.5 h-3.5" />
                    <span>Credenciales Autogeneradas:</span>
                  </div>
                  <div className="font-mono text-gray-300 text-[11px] leading-relaxed">
                    Usuario: <strong className="text-white">{generateDefaultUsername(techForm.full_name)}</strong>
                    <br />
                    Contraseña Inicial: <strong className="text-amber-300">{techForm.custom_password || generateDefaultUsername(techForm.full_name)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Contraseña Inicial Personalizada (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Por defecto igual al usuario"
                  value={techForm.custom_password}
                  onChange={(e) => setTechForm({ ...techForm, custom_password: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs font-mono text-white focus:border-indigo-400"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.can_receive_payment}
                  onChange={(e) => setTechForm({ ...techForm, can_receive_payment: e.target.checked })}
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>💳 Habilitado como Destino de Cobro (Caja / Reportes)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold cursor-pointer hover:bg-rose-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.is_debt_responsible}
                  onChange={(e) => setTechForm({ ...techForm, is_debt_responsible: e.target.checked })}
                  className="rounded border-rose-500 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>🏦 Responsable de Saldo Pendiente (aparece en selectores de deuda)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-bold cursor-pointer hover:bg-cyan-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.is_attention_responsible}
                  onChange={(e) => setTechForm({ ...techForm, is_attention_responsible: e.target.checked })}
                  className="rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
                <span>🧑‍🔧 Responsable de Atención (aparece en el selector de Responsable de la Atención de Reservas y Citas)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.is_mechanic_responsible}
                  onChange={(e) => setTechForm({ ...techForm, is_mechanic_responsible: e.target.checked })}
                  className="rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>👨‍🔧 Mecánico Asignado Responsable (aparece en el selector de Mecánico de Taller)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-300 text-xs font-bold cursor-pointer hover:bg-violet-950/60 transition-colors">
                <input
                  type="checkbox"
                  checked={techForm.is_certification_responsible}
                  onChange={(e) => setTechForm({ ...techForm, is_certification_responsible: e.target.checked })}
                  className="rounded border-violet-500 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span>🪪 Resp. Certificaciones (aparece en el selector de Responsable de Solicitud de Certificaciones)</span>
              </label>

              <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/40">
                <label className="block text-[11px] font-bold text-blue-300 mb-1">
                  🏷️ Sobrenombre para Destino de Pago (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: REY, GIAN, FRANCO"
                  value={techForm.payment_nickname}
                  onChange={(e) => setTechForm({ ...techForm, payment_nickname: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs font-mono text-white focus:border-blue-400"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Se usará como opción en el Destino de Pago de Caja (en lugar del nombre completo).
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar a la Lista Maestra</span>
              </button>
            </form>
          </div>

          {/* Technicians Master Grid with Permissions Matrix */}
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  <span>Roster de Personal & Control de Pestañas Activas</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Gestione credenciales de acceso, contraseñas, correos y permisos de navegación sincronizados en tiempo real.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {technicians.map((t) => {
                const allowed = Array.isArray(t.allowed_tabs) ? t.allowed_tabs : ALL_ERP_STATIONS.map((s) => s.id);
                const allActive = allowed.length === ALL_ERP_STATIONS.length;
                const user = t.username || generateDefaultUsername(t.full_name);
                const pass = t.password || user;
                const isPassVisible = !!showCardPasswordMap[t.id];

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-reygas-dark/80 border border-white/10 space-y-3 hover:border-indigo-500/40 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                          {t.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                            <span>{t.full_name}</span>
                            {t.payment_nickname && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-normal">
                                🏷️ {t.payment_nickname}
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-normal">
                              {t.specialty}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mt-0.5 flex-wrap">
                            <span>Tel: {t.phone || "Sin teléfono"}</span>
                            <span>•</span>
                            <span className="text-indigo-300">{t.email || "Sin correo"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Send Email Button */}
                        <button
                          type="button"
                          onClick={() => handleSendCredentialsEmail(t)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all border border-emerald-500/30 flex items-center gap-1.5 active:scale-95 shadow"
                          title={t.email ? `Enviar credenciales a ${t.email}` : "Copiar credenciales y configurar correo"}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Enviar Acceso</span>
                        </button>

                        {/* Quick Password Change Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenQuickPasswordModal(t)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white transition-all border border-amber-500/30 flex items-center gap-1.5 active:scale-95 shadow"
                          title="Cambiar contraseña de acceso"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Clave</span>
                        </button>

                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-950/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!t.can_receive_payment}
                            onChange={(e) => {
                              updateTechnician(t.id, { can_receive_payment: e.target.checked });
                            }}
                            className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>💳 Cobro</span>
                        </label>

                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold cursor-pointer hover:bg-rose-950/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!t.is_debt_responsible}
                            onChange={(e) => {
                              updateTechnician(t.id, { is_debt_responsible: e.target.checked });
                            }}
                            className="rounded border-rose-500 text-rose-600 focus:ring-rose-500"
                          />
                          <span>🏦 Resp. Saldo</span>
                        </label>

                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-bold cursor-pointer hover:bg-cyan-950/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!t.is_attention_responsible}
                            onChange={(e) => {
                              updateTechnician(t.id, { is_attention_responsible: e.target.checked });
                            }}
                            className="rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500"
                            title="Habilitado como Responsable de la Atención (selector de citas)"
                          />
                          <span>🧑‍🔧 Resp. Atención</span>
                        </label>

                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-950/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!t.is_mechanic_responsible}
                            onChange={(e) => {
                              updateTechnician(t.id, { is_mechanic_responsible: e.target.checked });
                            }}
                            className="rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                            title="Habilitado como Mecánico Asignado Responsable (selector de Taller)"
                          />
                          <span>👨‍🔧 Resp. Mecánico</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const newTabs = allActive ? [] : ALL_ERP_STATIONS.map((s) => s.id);
                            updateTechnician(t.id, { allowed_tabs: newTabs });
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/10"
                        >
                          {allActive ? "Desmarcar Todos" : "Marcar Todos"}
                        </button>

                        <button
                          onClick={() => toggleTechnicianActive(t.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${t.is_active
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-gray-800 text-gray-500 border border-gray-700"
                            }`}
                        >
                          {t.is_active ? "Activo" : "Inactivo"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditTechModal(t)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-all border border-indigo-500/30 flex items-center gap-1 active:scale-95"
                          title="Editar nombre, correo, teléfono, clave y especialidad"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Está seguro de eliminar a ${t.full_name} del personal?`)) {
                              deleteTechnician(t.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar personal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Credentials Info Strip */}
                    <div className="flex items-center justify-between gap-2 flex-wrap bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-lg text-xs font-mono">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-gray-400">
                          Usuario: <strong className="text-indigo-300">{user}</strong>
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400 flex items-center gap-1.5">
                          Clave:
                          <strong className="text-amber-300">
                            {isPassVisible ? pass : "••••••••"}
                          </strong>
                          <button
                            type="button"
                            onClick={() => toggleCardPassword(t.id)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title={isPassVisible ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`Usuario: ${user} | Contraseña: ${pass}`);
                          notify("success", `Credenciales de ${t.full_name} copiadas.`);
                        }}
                        className="px-2 py-0.5 text-[11px] rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                        title="Copiar usuario y clave"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                        <span>Copiar</span>
                      </button>
                    </div>

                    {/* Checkboxes Grid for Stations */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block">
                          Estaciones y Pestañas Permitidas ({allowed.length}/{ALL_ERP_STATIONS.length}):
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">
                          {allowed.length === ALL_ERP_STATIONS.length ? (
                            <span className="text-emerald-400 font-semibold">✓ Acceso Total (11/11)</span>
                          ) : allowed.length === 0 ? (
                            <span className="text-red-400 font-bold">⚠️ Sin estaciones permitidas (0/11)</span>
                          ) : (
                            <span className="text-indigo-300 font-semibold">Acceso configurado ({allowed.length}/11)</span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {ALL_ERP_STATIONS.map((station) => {
                          const isChecked = allowed.includes(station.id);
                          return (
                            <label
                              key={station.id}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${isChecked
                                ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-200"
                                : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300"
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  let nextTabs: string[];
                                  if (isChecked) {
                                    nextTabs = allowed.filter((s) => s !== station.id);
                                  } else {
                                    nextTabs = [...allowed, station.id];
                                  }
                                  updateTechnician(t.id, { allowed_tabs: nextTabs });
                                }}
                                className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="truncate">{station.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WORKSHOP SERVICES CATALOG (CONFIGURABLE SERVICES & PRICES) */}
      {/* ========================================================================= */}
      {activeTab === "servicios" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Service Create / Edit Form */}
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Wrench className="w-5 h-5 text-indigo-400" />
              <span>{editingServiceId ? "Editar Servicio" : "Nuevo Servicio de Taller"}</span>
            </h2>

            <form
              key={editingServiceId || "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("serviceName") as HTMLInputElement).value;
                const category = (form.elements.namedItem("serviceCategory") as HTMLInputElement).value;
                const desc = (form.elements.namedItem("serviceDesc") as HTMLTextAreaElement).value;

                const payload: Partial<WorkshopService> = {
                  name,
                  category: category || "Mantenimiento",
                  price: Number(formPrice) || 0,
                  description: desc,
                  is_active: true,
                };
                if (formIsInstallation) {
                  payload.is_installation = true;
                  payload.installation_components = formComponents.map((c) => ({ ...c }));
                } else {
                  payload.is_installation = false;
                  payload.installation_components = undefined;
                }

                if (editingServiceId) {
                  updateWorkshopService(editingServiceId, payload);
                  notify("success", `Servicio "${name}" actualizado con precio S/ ${(Number(formPrice) || 0).toFixed(2)}.`);
                  handleCancelEditService();
                } else {
                  addWorkshopService(payload as WorkshopService);
                  notify("success", `Servicio "${name}" registrado con precio S/ ${(Number(formPrice) || 0).toFixed(2)}.`);
                  form.reset();
                  setFormPrice(80);
                  setFormIsInstallation(false);
                  setFormComponents([]);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre del Servicio de Taller *</label>
                <input name="serviceName" type="text" required defaultValue={serviceFormSeed?.name || ""} placeholder="Ej: Calibración Computarizada 5ta Gen" className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Categoría</label>
                <input name="serviceCategory" type="text" defaultValue={serviceFormSeed?.category || "Mantenimiento"} placeholder="Ej: Diagnóstico, Inyección, Calibración..." className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Precio Estándar en Taller (S/) *</label>
                <input type="number" step="0.1" min="0" required value={formPrice} onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white font-mono focus:border-indigo-400" />
                <p className="text-[11px] text-gray-400 mt-1">Permite S/ 0 para servicios de cortesía o revisión inicial gratuita.</p>
              </div>

              {/* INSTALACIÓN: paquete con repuestos + certificados + mano de obra */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 cursor-pointer select-none">
                <input type="checkbox" checked={formIsInstallation} onChange={(e) => setFormIsInstallation(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-500" />
                <span className="text-xs">
                  <span className="font-black text-indigo-300">⚙ Es una INSTALACIÓN (paquete)</span>
                  <span className="block text-gray-400 mt-0.5">Incluye repuestos y/o certificados del catálogo. Al jalarla en Taller se agregan automáticamente sus componentes + la mano de obra calculada (total − componentes) para que Caja la distribuya en VENTAS POR CONCEPTO.</span>
                </span>
              </label>

              {formIsInstallation && (
                <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3">
                  <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Componentes del kit</div>
                  <div>
                    <div className="flex gap-2 items-center mb-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => setKitPartSortAZ((v) => !v)}
                        className={"px-2 py-1.5 rounded-lg border text-[10px] font-black transition-colors shrink-0 " + (kitPartSortAZ ? "bg-indigo-500/25 text-indigo-300 border-indigo-500/40" : "bg-white/5 text-gray-400 border-white/10 hover:text-white")}
                        title={kitPartSortAZ ? "Orden alfabético activo (A-Z) — pulsar para volver al orden del catálogo" : "Ordenar alfabéticamente (A-Z)"}
                      >
                        A-Z
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select value={kitPartSel} onChange={(e) => setKitPartSel(e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-[11px] text-gray-200 focus:border-indigo-400">
                        <option value="">📦 Elegir repuesto del catálogo...</option>
                        {kitPartsFiltered.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}{it.brand ? " · " + it.brand : ""}{it.serial_number ? " · S/N " + it.serial_number : ""} — S/ {Number(it.unit_price || 0).toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <input type="number" min="1" value={kitPartQty} onChange={(e) => setKitPartQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-14 px-1.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-[11px] text-white text-center" title="Cantidad" />
                      <button type="button" onClick={handleAddKitPart} disabled={!kitPartSel} className="px-2 py-1.5 rounded-lg bg-emerald-600/70 hover:bg-emerald-500 disabled:opacity-30 text-white text-[10px] font-black transition-colors shrink-0">+ Añadir</button>
                    </div>
                  </div>
                  <div>
                    <div className="flex gap-2 items-center">
                      <select value={kitCertSel} onChange={(e) => setKitCertSel(e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-[11px] text-gray-200 focus:border-indigo-400">
                        <option value="">🛡 Elegir certificado del catálogo...</option>
                        {certificationCatalogs.map((cs) => (
                          <option key={cs.id} value={cs.id}>{cs.name} — S/ {Number(cs.price || 0).toFixed(2)}</option>
                        ))}
                      </select>
                      <input type="number" min="1" value={kitCertQty} onChange={(e) => setKitCertQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-14 px-1.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-[11px] text-white text-center" title="Cantidad" />
                      <button type="button" onClick={handleAddKitCert} disabled={!kitCertSel} className="px-2 py-1.5 rounded-lg bg-cyan-600/70 hover:bg-cyan-500 disabled:opacity-30 text-white text-[10px] font-black transition-colors shrink-0">+ Añadir</button>
                    </div>
                  </div>
                  {formComponents.length > 0 && (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                      {formComponents.map((c, i) => (
                        <div key={i} className="space-y-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5">
                          {/* Línea 1: nombre COMPLETO (wrap) + datos de marca/serie + quitar */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 text-[11px] text-gray-100 font-bold leading-snug break-words">
                              {c.source === "repuesto" ? "📦 " : "🛡 "}{c.description}
                              {c.source === "repuesto" && (() => {
                                const it = inventoryItems.find((x) => x.id === c.id);
                                const bits: string[] = [];
                                if (it?.brand) bits.push("Marca: " + it.brand);
                                if (it?.serial_number) bits.push("S/N: " + it.serial_number);
                                if (bits.length === 0) return null;
                                return <span className="block text-[9px] text-gray-400 font-semibold">{bits.join(" · ")}</span>;
                              })()}
                            </span>
                            <div className="flex items-start gap-0.5 shrink-0">
                              <div className="flex flex-col">
                                <button type="button" onClick={() => handleMoveKitComp(i, -1)} disabled={i === 0} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-colors" title="Subir posición">
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => handleMoveKitComp(i, 1)} disabled={i === formComponents.length - 1} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-colors" title="Bajar posición">
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                              <button type="button" onClick={() => handleRemoveKitComp(i)} className="p-0.5 text-red-400 hover:text-red-300 shrink-0" title="Quitar del kit">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {/* Línea 2: cantidad / precio / subtotal */}
                          <div className="flex items-center gap-2">
                            <input type="number" min="1" value={c.quantity} onChange={(e) => handleUpdateKitComp(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-12 px-1 py-0.5 bg-reygas-dark border border-white/10 rounded text-[10px] text-white text-center" title="Cantidad" />
                            <input type="number" min="0" step="0.1" value={c.unit_price} onChange={(e) => handleUpdateKitComp(i, { unit_price: parseFloat(e.target.value) || 0 })} className="w-20 px-1 py-0.5 bg-reygas-dark border border-white/10 rounded text-[10px] text-emerald-300 font-mono text-right" title="Precio unitario" />
                            <span className="text-gray-400 font-mono text-[10px] ml-auto shrink-0">= S/ {(c.quantity * c.unit_price).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const compSum = formComponents.reduce((s, c) => s + (Number(c.unit_price) || 0) * (Number(c.quantity) || 1), 0);
                    const labor = Number((Number(formPrice) - compSum).toFixed(2));
                    const repSum = formComponents.filter((c) => c.source === "repuesto").reduce((s, c) => s + (Number(c.unit_price) || 0) * (Number(c.quantity) || 1), 0);
                    const certSum = formComponents.filter((c) => c.source === "certificado").reduce((s, c) => s + (Number(c.unit_price) || 0) * (Number(c.quantity) || 1), 0);
                    return (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-300">Total componentes ({formComponents.length})</span>
                          <span className="text-white font-mono font-bold">S/ {compSum.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-300">Precio total del servicio</span>
                          <span className="text-white font-mono font-bold">S/ {(Number(formPrice) || 0).toFixed(2)}</span>
                        </div>
                        {/* Distribución por concepto, igual que en VENTAS POR CONCEPTO */}
                        <div className="border-t border-amber-500/20 pt-1.5 space-y-1">
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Distribución en VENTAS POR CONCEPTO</div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-300">📦 Almacén (repuestos)</span>
                            <span className="text-emerald-300 font-mono font-bold">S/ {repSum.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-300">🛡 Certificados</span>
                            <span className="text-purple-300 font-mono font-bold">S/ {certSum.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-300">🔧 Servicios (mano de obra)</span>
                            <span className={"font-mono font-bold " + (labor >= 0 ? "text-teal-300" : "text-red-400")}>S/ {Math.max(0, labor).toFixed(2)}</span>
                          </div>
                        </div>
                        {labor < 0 && (
                          <p className="text-[10px] text-red-400 font-bold">⚠ El precio del servicio es MENOR que la suma de componentes: la mano de obra quedaría en S/ 0.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Descripción / Alcance del Servicio</label>
                <textarea name="serviceDesc" rows={3} defaultValue={serviceFormSeed?.description || ""} placeholder="Ej: Incluye escaneo de sensores, ajuste de tiempos de inyección y prueba de ruta." className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={"flex-1 py-3 text-white font-bold rounded-xl text-sm transition-colors shadow-lg flex items-center justify-center gap-2 " + (editingServiceId ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30")}>
                  <Plus className="w-4 h-4" />
                  <span>{editingServiceId ? "Guardar Cambios" : "Guardar Servicio en Catálogo"}</span>
                </button>
                {editingServiceId && (
                  <button type="button" onClick={handleCancelEditService} className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-sm transition-colors" title="Cancelar edición">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Services Catalog Master Grid */}
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-400" />
                  <span>Catálogo de Servicios Disponibles para Taller</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Los precios configurados aquí aparecerán listados al solicitar servicios desde el tablero Kanban de Taller.
                </p>
              </div>
              <button
                onClick={async () => {
                  await saveSupabaseSiteContent("workshopServices", workshopServices, "services");
                  notify("success", "¡Catálogo de servicios sincronizado en tiempo real con Supabase y todos los dispositivos!");
                }}
                className="px-4 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                title="Sincronizar y forzar actualización en todos los dispositivos"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
                <span>Guardar y Emitir en Tiempo Real</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Servicio de Taller</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 font-mono text-amber-300">Precio (S/) (Editable)</th>
                    <th className="p-3 max-w-[200px]">Descripción</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {(workshopServices || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        No hay servicios registrados en el catálogo. Utilice el formulario lateral para agregar servicios.
                      </td>
                    </tr>
                  ) : (
                    (workshopServices || []).map((srv) => (
                      <tr key={srv.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white">
                          <input type="text" value={srv.name} onChange={(e) => updateWorkshopService(srv.id, { name: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-white font-bold rounded" />
                          {srv.is_installation && (() => {
                            const comps = Array.isArray(srv.installation_components) ? srv.installation_components : [];
                            const repCount = comps.filter((c) => c.source === "repuesto").length;
                            const certCount = comps.filter((c) => c.source === "certificado").length;
                            const compSum = comps.reduce((s, c) => s + (Number(c.unit_price) || 0) * (Number(c.quantity) || 1), 0);
                            const labor = Math.max(0, Number((Number(srv.price) - compSum).toFixed(2)));
                            return (
                              <div className="text-[9px] text-indigo-300 font-bold mt-1">
                                ⚙ Instalación · {repCount} rep · {certCount} cert · MO S/ {labor.toFixed(2)}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-gray-300">
                          <input type="text" value={srv.category || "General"} onChange={(e) => updateWorkshopService(srv.id, { category: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-gray-300 rounded" />
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400 font-bold">S/</span>
                            <input type="number" step="0.1" min="0" value={srv.price} onChange={(e) => updateWorkshopService(srv.id, { price: parseFloat(e.target.value) || 0 })} className="w-24 bg-reygas-surface/80 border border-white/10 hover:border-indigo-400 focus:border-indigo-400 px-2 py-1 text-amber-300 font-mono font-bold rounded" />
                          </div>
                        </td>
                        <td className="p-3 text-gray-400 truncate max-w-[200px]">
                          <input type="text" value={srv.description || ""} placeholder="Descripción breve..." onChange={(e) => updateWorkshopService(srv.id, { description: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 px-1.5 py-1 text-gray-400 rounded" />
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditService(srv)} className="p-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 rounded-lg transition-colors" title="Editar este servicio (incluye kit de instalación)">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { deleteWorkshopService(srv.id); notify("warning", `Servicio "${srv.name}" eliminado del catálogo.`); }} className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors" title="Eliminar este servicio del catálogo">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TABLA DE PROGRAMACIÓN & VENCIMIENTOS */}
      {/* ========================================================================= */}
      {activeTab === "programacion" && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          {/* Controls & Import Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por placa, cliente o servicio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-400 w-64"
                />
              </div>

              {selectedScheduleIds.length > 0 && (
                <button
                  onClick={() => {
                    deleteMultipleScheduleRecords(selectedScheduleIds);
                    notify("success", `Se eliminaron ${selectedScheduleIds.length} programaciones.`);
                    setSelectedScheduleIds([]);
                  }}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar ({selectedScheduleIds.length}) seleccionados</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Import Excel/CSV Button */}
              <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105">
                {isImportingSchedule ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4" />
                )}
                <span>{isImportingSchedule ? "Subiendo a la nube..." : "Importar Excel / CSV"}</span>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleScheduleFileUpload}
                  className="hidden"
                  disabled={isImportingSchedule}
                />
              </label>

              {/* Add Manual Schedule Record */}
              <button
                onClick={() => handleOpenScheduleModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nueva Programación</span>
              </button>

              {/* Clear All Schedule Records */}
              {(scheduleRecords || []).length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("¿Estás seguro de vaciar toda la tabla de programación?")) {
                      clearAllScheduleRecords();
                      notify("warning", "Tabla de programación vaciada.");
                    }
                  }}
                  className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Vaciar tabla completa de programaciones"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Tabla</span>
                </button>
              )}
            </div>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-reygas-dark text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedScheduleIds.length > 0 &&
                        selectedScheduleIds.length === (scheduleRecords || []).length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScheduleIds((scheduleRecords || []).map((r) => r.id));
                        } else {
                          setSelectedScheduleIds([]);
                        }
                      }}
                      className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">#</th>
                  <th className="p-3">Placa</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3 font-mono text-cyan-300">KM</th>
                  <th className="p-3">Fecha Servicio</th>
                  <th className="p-3">Servicio Brindado</th>
                  <th className="p-3 font-mono text-purple-400">Venc. Quinquenal</th>
                  <th className="p-3 font-mono text-amber-400">Venc. Chip/Anual</th>
                  <th className="p-3 font-mono text-emerald-400">Próx. Mant.</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {(scheduleRecords || []).length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-gray-500 space-y-2">
                      <Calendar className="w-10 h-10 mx-auto text-gray-600" />
                      <p>No hay registros en la Tabla de Programación.</p>
                      <p className="text-[11px] text-gray-600">
                        Importa un archivo Excel/CSV o pulsa "+ Nueva Programación" para comenzar.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (scheduleRecords || [])
                    .filter((r) => {
                      if (!searchTerm.trim()) return true;
                      const q = searchTerm.toLowerCase();
                      return (
                        r.vehicle_plate?.toLowerCase().includes(q) ||
                        r.client_name?.toLowerCase().includes(q) ||
                        r.client_phone?.includes(q) ||
                        r.service_name?.toLowerCase().includes(q)
                      );
                    })
                    .map((rec, idx) => {
                      const isSelected = selectedScheduleIds.includes(rec.id);

                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-white/5 transition-colors ${isSelected ? "bg-indigo-950/20" : ""
                            }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedScheduleIds((prev) =>
                                  prev.includes(rec.id)
                                    ? prev.filter((id) => id !== rec.id)
                                    : [...prev, rec.id]
                                );
                              }}
                              className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono text-gray-500">#{idx + 1}</td>
                          <td className="p-3 font-mono font-black text-white bg-reygas-surface/60 px-2 py-1 rounded border border-white/10 inline-block my-1">
                            {rec.vehicle_plate}
                          </td>
                          <td className="p-3 text-white font-semibold truncate max-w-[150px]">
                            {rec.client_name}
                          </td>
                          <td className="p-3 font-mono text-gray-300">{rec.client_phone || "-"}</td>
                          <td className="p-3 font-mono text-cyan-300">
                            {rec.current_mileage && rec.current_mileage > 0
                              ? `${rec.current_mileage.toLocaleString()} KM`
                              : "-"}
                          </td>
                          <td className="p-3 font-mono text-gray-300">{rec.service_date || "-"}</td>
                          <td className="p-3 truncate max-w-[180px] text-gray-200">
                            {rec.service_name || "Mantenimiento General"}
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-400">
                            {rec.expiry_quinquennial || "-"}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">
                            {rec.expiry_chip_annual || "-"}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400">
                            {rec.next_maintenance_date || "-"}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${rec.status === "atendido"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : rec.status === "vencido"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                }`}
                            >
                              {rec.status || "programado"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenScheduleModal(rec)}
                                className="p-1.5 bg-reygas-surface hover:bg-gray-700 text-amber-400 rounded-lg transition-colors"
                                title="Editar programación"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  deleteScheduleRecord(rec.id);
                                  notify("warning", `Programación de ${rec.vehicle_plate} eliminada.`);
                                }}
                                className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                                title="Eliminar fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SCHEDULE RECORD */}
      {/* ========================================================================= */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 rounded-2xl border border-indigo-500/40 max-w-lg w-full space-y-4 shadow-2xl bg-reygas-dark max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>{editingSchedule ? "Editar Programación" : "Nueva Programación de Vehículo"}</span>
              </h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleRecord} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Placa del Vehículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-123"
                    value={scheduleForm.vehicle_plate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, vehicle_plate: formatPlate(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-sm text-white uppercase font-mono font-bold focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Kilometraje (KM)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej. 45000"
                    value={scheduleForm.current_mileage || ""}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, current_mileage: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-sm text-white font-mono focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre del Cliente</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={scheduleForm.client_name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, client_name: titleCase(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+51 987654321"
                    value={scheduleForm.client_phone}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, client_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MiniDatePicker
                    value={scheduleForm.service_date}
                    onChange={(d) => setScheduleForm({ ...scheduleForm, service_date: d })}
                    label="Fecha del Servicio"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Servicio Realizado</label>
                  <input
                    type="text"
                    placeholder="Conversión / Mant. 15k..."
                    value={scheduleForm.service_name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, service_name: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-purple-300 mb-1">Venc. Quinquenal</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={scheduleForm.expiry_quinquennial}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, expiry_quinquennial: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-300 mb-1">Venc. Chip/Anual</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={scheduleForm.expiry_chip_annual}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, expiry_chip_annual: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-300 mb-1">Próx. Mantenimiento</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={scheduleForm.next_maintenance_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, next_maintenance_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Observaciones / Notas</label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales..."
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Programación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT TECHNICIAN MODAL (NOMBRE, CORREO, TELÉFONO, CLAVE & PERMISOS) */}
      {/* ========================================================================= */}
      {techEditModalOpen && editingTech && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/40 max-w-lg w-full space-y-5 shadow-2xl bg-reygas-dark max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Datos y Credenciales</h3>
                  <p className="text-[11px] text-gray-400">Actualizar perfil, usuario, contraseña y acceso de {editingTech.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTechEditModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTechEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mario Alvarado"
                    value={techEditForm.full_name}
                    onChange={(e) => setTechEditForm({ ...techEditForm, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-bold text-white focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={techEditForm.email}
                      onChange={(e) => setTechEditForm({ ...techEditForm, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+51 987654321"
                      value={techEditForm.phone}
                      onChange={(e) => setTechEditForm({ ...techEditForm, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    🏷️ Sobrenombre para Destino de Pago (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: REY, GIAN, FRANCO"
                    value={techEditForm.payment_nickname}
                    onChange={(e) => setTechEditForm({ ...techEditForm, payment_nickname: e.target.value })}
                    className="w-full px-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-mono text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Especialidad Principal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Diagnóstico ECU & Inyección Gas"
                    value={techEditForm.specialty}
                    onChange={(e) => setTechEditForm({ ...techEditForm, specialty: e.target.value })}
                    className="w-full px-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-bold text-white focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Access Credentials Box */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Credenciales de Inicio de Sesión:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const defUser = generateDefaultUsername(techEditForm.full_name);
                      setTechEditForm({ ...techEditForm, username: defUser, password: defUser });
                    }}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Restablecer por Defecto
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Nombre de Usuario (Login)
                    </label>
                    <input
                      type="text"
                      value={techEditForm.username}
                      onChange={(e) => setTechEditForm({ ...techEditForm, username: e.target.value })}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        value={techEditForm.password}
                        onChange={(e) => setTechEditForm({ ...techEditForm, password: e.target.value })}
                        className="w-full pl-3 pr-8 py-2 bg-reygas-dark border border-white/10 rounded-lg text-xs font-mono font-bold text-amber-300 focus:border-indigo-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        title={showEditPassword ? "Ocultar" : "Ver contraseña"}
                      >
                        {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-950/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={techEditForm.can_receive_payment}
                    onChange={(e) => setTechEditForm({ ...techEditForm, can_receive_payment: e.target.checked })}
                    className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>💳 Habilitar Cobro</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-bold cursor-pointer hover:bg-rose-950/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!techEditForm.is_debt_responsible}
                    onChange={(e) => setTechEditForm({ ...techEditForm, is_debt_responsible: e.target.checked })}
                    className="rounded border-rose-500 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>🏦 Responsable de Saldo Pendiente</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs font-bold cursor-pointer hover:bg-cyan-950/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!techEditForm.is_attention_responsible}
                    onChange={(e) => setTechEditForm({ ...techEditForm, is_attention_responsible: e.target.checked })}
                    className="rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>🧑‍🔧 Responsable de Atención (citas)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer hover:bg-amber-950/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!techEditForm.is_mechanic_responsible}
                    onChange={(e) => setTechEditForm({ ...techEditForm, is_mechanic_responsible: e.target.checked })}
                    className="rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>👨‍🔧 Mecánico Asignado Responsable (selector de Taller)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200 text-xs font-bold cursor-pointer hover:bg-indigo-950/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={techEditForm.is_active}
                    onChange={(e) => setTechEditForm({ ...techEditForm, is_active: e.target.checked })}
                    className="rounded border-indigo-500 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>🟢 Personal Activo</span>
                </label>
              </div>

              {/* Send Email Action Button inside Modal */}
              <button
                type="button"
                onClick={() => {
                  const tempTech: Technician = {
                    ...editingTech,
                    full_name: techEditForm.full_name,
                    email: techEditForm.email,
                    username: techEditForm.username,
                    password: techEditForm.password,
                    specialty: techEditForm.specialty,
                  };
                  handleSendCredentialsEmail(tempTech);
                }}
                className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>Enviar Credenciales a su Correo ({techEditForm.email || "Sin correo"})</span>
              </button>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTechEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-xl text-xs border border-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {quickPassModal.isOpen && quickPassModal.tech && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/40 max-w-md w-full space-y-4 shadow-2xl bg-reygas-dark">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cambiar Contraseña</h3>
                  <p className="text-[11px] text-gray-400">{quickPassModal.tech.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickPassModal({ isOpen: false, tech: null, newPass: "", showPass: true })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPassword} className="space-y-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs">
                <span className="text-gray-400">Usuario de inicio de sesión:</span>
                <div className="font-mono font-bold text-indigo-300">
                  {quickPassModal.tech.username || generateDefaultUsername(quickPassModal.tech.full_name)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={quickPassModal.showPass ? "text" : "password"}
                    required
                    value={quickPassModal.newPass}
                    onChange={(e) => setQuickPassModal({ ...quickPassModal, newPass: e.target.value })}
                    className="w-full pl-3 pr-9 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-xs font-mono font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickPassModal({ ...quickPassModal, showPass: !quickPassModal.showPass })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {quickPassModal.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const defUser = generateDefaultUsername(quickPassModal.tech!.full_name);
                    setQuickPassModal({ ...quickPassModal, newPass: defUser });
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  Restablecer a nombre de usuario
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rand = Math.random().toString(36).slice(-6);
                    setQuickPassModal({ ...quickPassModal, newPass: `ReyGas_${rand}` });
                  }}
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  Generar Clave Segura
                </button>
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setQuickPassModal({ isOpen: false, tech: null, newPass: "", showPass: true })}
                  className="flex-1 py-2.5 bg-reygas-surface hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-xl text-xs border border-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Actualizar Clave</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE EDICIÓN COMPLETA DEL REGISTRO DE TALLER (FECHA, HORA, ETC.) */}
      {/* ========================================================================= */}
      {editingWorkshopOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl shadow-black/90 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Modificar Registro del Taller</h3>
                  <p className="text-xs text-gray-400">
                    Placa: <span className="text-amber-300 font-mono font-bold">{editingWorkshopOrder.vehiclePlate}</span> • ID: {editingWorkshopOrder.orderId.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkshopOrder(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditWorkshopOrder} className="space-y-4 text-xs">

              {/* Fecha y Hora de Ingreso */}
              <div className="p-4 rounded-2xl bg-black/40 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-black uppercase text-[11px] tracking-wider">
                  <Calendar className="w-4 h-4" />
                  <span>Fecha y Hora de Ingreso (Apertura de Orden)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Fecha de Atención *</label>
                    <MiniDatePicker
                      value={editingWorkshopOrder.entryDate}
                      onChange={(newD) => setEditingWorkshopOrder({ ...editingWorkshopOrder, entryDate: newD })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Hora de Ingreso (HH:mm) *</label>
                    <input
                      type="time"
                      required
                      value={editingWorkshopOrder.entryTime}
                      onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, entryTime: e.target.value })}
                      className="w-full px-3.5 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Vehículo & Propietario */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Placa *</label>
                  <input
                    type="text"
                    required
                    value={editingWorkshopOrder.vehiclePlate}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, vehiclePlate: formatPlate(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono font-black uppercase focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Marca</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.brand}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Sistema / Combustible</label>
                  <select
                    value={editingWorkshopOrder.fuelType}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, fuelType: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-bold focus:border-amber-400 focus:outline-none"
                  >
                    <option value="GNV">GNV</option>
                    <option value="GLP">GLP</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Bifuel">Bifuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Kilometraje (km)</label>
                  <input
                    type="number"
                    value={editingWorkshopOrder.currentMileage || ""}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, currentMileage: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cliente y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-gray-300 font-bold uppercase mb-1">Cliente / Propietario</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.clientName}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, clientName: titleCase(e.target.value) })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Celular / Teléfono</label>
                  <input
                    type="tel"
                    value={editingWorkshopOrder.clientPhone}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, clientPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Técnico y Servicios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Técnico Asignado</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.technicianName}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, technicianName: e.target.value })}
                    placeholder="Ej. EDGAR, CARLOS..."
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-gray-300 font-bold uppercase mb-1">Mantenimiento General / Servicio</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.maintenanceService}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, maintenanceService: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-bold uppercase mb-1">Repuestos y Servicios Adicionales</label>
                <input
                  type="text"
                  value={editingWorkshopOrder.sparePartsServices}
                  onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, sparePartsServices: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Precios, Descuento y Crédito */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-black/40 border border-white/10">
                <div>
                  <label className="block text-emerald-400 font-extrabold uppercase mb-1">Precio Total (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingWorkshopOrder.price || ""}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, price: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-emerald-500/40 rounded-xl text-white font-mono font-black focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Descuentos</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.discounts}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, discounts: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-amber-400 font-bold uppercase mb-1">Crédito (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingWorkshopOrder.creditAmount || ""}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, creditAmount: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-amber-500/40 rounded-xl text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Condición</label>
                  <select
                    value={editingWorkshopOrder.paymentCondition}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, paymentCondition: e.target.value })}
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-bold focus:border-amber-400 focus:outline-none"
                  >
                    <option value="PAGADO">PAGADO</option>
                    <option value="CREDITO">CREDITO</option>
                    <option value="PENDIENTE">PENDIENTE</option>
                  </select>
                </div>
              </div>

              {/* Método, Destino y Comprobante */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Método de Pago</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.paymentMethod}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, paymentMethod: e.target.value })}
                    placeholder="Efectivo / Yape..."
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">Destino de Pago</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.paymentDestination}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, paymentDestination: e.target.value })}
                    placeholder="EMPRESA / Nombre"
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold uppercase mb-1">N° Boleta / Factura</label>
                  <input
                    type="text"
                    value={editingWorkshopOrder.receiptNumber}
                    onChange={(e) => setEditingWorkshopOrder({ ...editingWorkshopOrder, receiptNumber: e.target.value })}
                    placeholder="B001-000123"
                    className="w-full px-3 py-2 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingWorkshopOrder(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold border border-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Modificaciones</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WEB NATIVE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 rounded-2xl border border-red-500/40 max-w-md w-full space-y-4 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-white">{modalConfig.title}</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{modalConfig.description}</p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="px-4 py-2 bg-reygas-surface hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-red-600/30"
              >
                Sí, Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
