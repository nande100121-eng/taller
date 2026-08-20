"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAppStore, InventoryItem } from "@/lib/store/app-store";
import { parseCSVRows } from "@/lib/csv-parser";
import {
  Package,
  Barcode,
  Wrench,
  UserCheck,
  AlertTriangle,
  Plus,
  CheckCircle2,
  RotateCcw,
  Search,
  Check,
  Upload,
  Edit3,
  Trash2,
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertCircle,
  ShieldAlert,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCheck,
  PackagePlus,
  ArrowDownToLine,
  History,
  Sparkles,
  Printer,
  ArrowUpDown,
  FileText,
  RefreshCw
} from "lucide-react";
import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";
import { normalizeScannerCode } from "@/lib/utils/scanner-utils";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { formatPlate, titleCase, capitalizeFirst } from "@/lib/utils/text-format";

const BarcodePrintModal = dynamic(
  () => import("@/components/BarcodePrintModal").then((m) => m.BarcodePrintModal),
  { ssr: false }
);
const DailyWarehouseReportModal = dynamic(
  () => import("@/components/DailyWarehouseReportModal").then((m) => m.DailyWarehouseReportModal),
  { ssr: false }
);

export default function AlmacenPage() {
  const {
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    deleteMultipleInventoryItems,
    clearAllInventory,
    importBulkInventoryItems,
    deductStock,
    recentIngresos,
    addRecentIngreso,
    removeRecentIngreso,
    clearRecentIngresos,
    toolLoans,
    addToolLoan,
    returnTool,
    technicians,
    workOrders,
    vehicles,
    markWorkOrderItemDispatched,
    toggleWorkOrderItemDispatched,
    markAllWorkOrderItemsDispatched,
    markAllMigratedWorkOrderItemsDispatched,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"pedidos" | "inventario" | "herramientas" | "ingreso">("pedidos");

  // Estados para "Ingreso de Material"
  const [ingresoSku, setIngresoSku] = useState("");
  const [ingresoFoundItem, setIngresoFoundItem] = useState<typeof inventoryItems[0] | null>(null);
  const [ingresoQuantity, setIngresoQuantity] = useState<number>(1);
  const [ingresoNotes, setIngresoNotes] = useState("");
  const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
  const [newMaterialForm, setNewMaterialForm] = useState({
    sku_barcode: "",
    name: "",
    brand: "",
    serial_number: "",
    unit_price: 0,
    initial_quantity: 1,
    min_stock_alert: 2,
    raw_counted: "",
  });

  // Checkbox Row Selection State
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Inventory Filter & Low Stock Filter State
  const [stockFilter, setStockFilter] = useState<"todos" | "bajo" | "critico" | "errores" | "no_validado">("todos");
  const [inventorySearch, setInventorySearch] = useState("");
  const deferredInventorySearch = React.useDeferredValue(inventorySearch);
  const [selectedLetter, setSelectedLetter] = useState<string>("TODAS");
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_ITEMS_PER_PAGE = 50;

  React.useEffect(() => {
    setInventoryPage(1);
  }, [deferredInventorySearch, stockFilter, selectedLetter]);

  // Styled Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    actionType: "delete_single" | "delete_selected" | "purge_all" | "revert_ingreso";
    targetId?: string;
    targetName?: string;
  } | null>(null);

  // Manual Exit Modal states
  const [manualExitModalOpen, setManualExitModalOpen] = useState(false);
  const [exitForm, setExitForm] = useState({
    itemId: "",
    quantity: 1,
    assignedToType: "vehicle" as "vehicle" | "responsible",
    vehiclePlate: "",
    responsibleName: "",
    reason: "Caso Urgente / Auxilio Mecánico",
  });

  // Styled Web Notification Modal State (Replaces browser alert)
  const [webAlert, setWebAlert] = useState<{
    open: boolean;
    type: "info" | "warning" | "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  // Migrated Cutoff Modal State & Attend All Modal State
  const [migratedModalOpen, setMigratedModalOpen] = useState(false);
  const [migratedCutoffDate, setMigratedCutoffDate] = useState("2026-08-08");
  const [attendAllModalOpen, setAttendAllModalOpen] = useState(false);

  // Barcode Print Modal State
  const [barcodePrintModalOpen, setBarcodePrintModalOpen] = useState(false);

  // Daily Executive Warehouse Report Modal State
  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);

  // CSV/Excel Import Loading State (visible save feedback)
  const [isImportingInventory, setIsImportingInventory] = useState(false);

  const showWebNotification = (
    type: "info" | "warning" | "success" | "error",
    title: string,
    message: string
  ) => {
    setWebAlert({ open: true, type, title, message });
  };

  const handleConfirmManualExit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventoryItems.find((i) => i.id === exitForm.itemId);
    if (!item) {
      showWebNotification("warning", "Selección Requerida", "Por favor seleccione un producto del inventario de almacén.");
      return;
    }
    if (exitForm.quantity <= 0) {
      showWebNotification("warning", "Cantidad Inválida", "Por favor ingrese una cantidad válida mayor a 0.");
      return;
    }

    const assignedTarget =
      exitForm.assignedToType === "vehicle"
        ? `Vehículo (Placa: ${exitForm.vehiclePlate || "General"})`
        : `Responsable: ${exitForm.responsibleName || "Taller"}`;

    updateInventoryItem(item.id, {
      stock_quantity: Math.max(0, item.stock_quantity - Number(exitForm.quantity)),
      exits: (item.exits || 0) + Number(exitForm.quantity),
    });

    showWebNotification(
      "success",
      "¡Salida Registrada con Éxito!",
      `${exitForm.quantity} unidades de "${item.name}" asignadas a ${assignedTarget}.`
    );
    setManualExitModalOpen(false);
    setExitForm({
      itemId: "",
      quantity: 1,
      assignedToType: "vehicle",
      vehiclePlate: "",
      responsibleName: "",
      reason: "Caso Urgente / Auxilio Mecánico",
    });
  };

  // Edit & New Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    sku_barcode: "",
    name: "",
    brand: "",
    serial_number: "",
    category: "Repuestos GNV/GLP",
    unit_price: 100,
    initial_stock: 10,
    entries: 0,
    exits: 0,
    stock_quantity: 10,
    counted_stock: 10,
    min_stock_alert: 2,
  });

  // Row selection handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === inventoryItems.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(inventoryItems.map((i) => i.id));
    }
  };

  // Deletion trigger handlers opening styled web modal
  const promptDeleteSingle = (id: string, name: string) => {
    setConfirmModal({
      open: true,
      title: "Confirmar Eliminación de Fila",
      message: `¿Estás seguro de eliminar el producto "${name}" del inventario de almacén?`,
      actionType: "delete_single",
      targetId: id,
      targetName: name,
    });
  };

  const promptDeleteSelected = () => {
    if (selectedRowIds.length === 0) return;
    setConfirmModal({
      open: true,
      title: "Confirmar Eliminación de Filas Seleccionadas",
      message: `¿Estás seguro de eliminar de forma permanente las ${selectedRowIds.length} filas seleccionadas del inventario?`,
      actionType: "delete_selected",
    });
  };

  const promptPurgeAll = () => {
    setConfirmModal({
      open: true,
      title: "⚠️ LIMPIAR BASE DE DATOS COMPLETA DE ALMACÉN",
      message: "¡PRECAUCIÓN! Esta acción vaciará y borrará TODOS los productos y filas cargadas en el inventario. ¿Deseas continuar?",
      actionType: "purge_all",
    });
  };

  const handleRevertRecentIngreso = (ing: {
    id: string;
    itemId?: string;
    sku: string;
    name: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    isNew?: boolean;
  }) => {
    const item = inventoryItems.find(
      (i) => (ing.itemId && i.id === ing.itemId) || i.sku_barcode === ing.sku
    );

    if (item) {
      const revertedStock = Math.max(0, item.stock_quantity - ing.quantity);
      const revertedEntries = Math.max(0, (item.entries || 0) - ing.quantity);
      updateInventoryItem(item.id, {
        stock_quantity: revertedStock,
        entries: revertedEntries,
      });

      if (ingresoFoundItem && ingresoFoundItem.id === item.id) {
        setIngresoFoundItem({
          ...ingresoFoundItem,
          stock_quantity: revertedStock,
          entries: revertedEntries,
        });
      }
    }

    removeRecentIngreso(ing.id);

    showWebNotification(
      "success",
      "Registro de Ingreso Anulado y Revertido",
      `Se anuló el ingreso de +${ing.quantity} unidades de "${ing.name}". El stock actual se recalculó a ${item ? Math.max(0, item.stock_quantity - ing.quantity) : ing.previousStock} unidades.`
    );
  };

  const handleExecuteConfirmedAction = () => {
    if (!confirmModal) return;

    if (confirmModal.actionType === "delete_single" && confirmModal.targetId) {
      deleteInventoryItem(confirmModal.targetId);
      setSelectedRowIds((prev) => prev.filter((id) => id !== confirmModal.targetId));
    } else if (confirmModal.actionType === "delete_selected") {
      deleteMultipleInventoryItems(selectedRowIds);
      setSelectedRowIds([]);
    } else if (confirmModal.actionType === "purge_all") {
      clearAllInventory();
      setSelectedRowIds([]);
    } else if (confirmModal.actionType === "revert_ingreso" && confirmModal.targetId) {
      const ing = recentIngresos.find((i) => i.id === confirmModal.targetId);
      if (ing) {
        handleRevertRecentIngreso(ing);
      }
    }

    setConfirmModal(null);
  };

  const handleSkuInputChange = (newSku: string) => {
    const uppercaseSku = normalizeScannerCode(newSku);
    setItemForm((prev) => ({ ...prev, sku_barcode: uppercaseSku }));

    if (uppercaseSku.length >= 3 && !editingItem) {
      const existing = inventoryItems.find(
        (i) =>
          i.sku_barcode.trim().toUpperCase() === uppercaseSku ||
          normalizeScannerCode(i.sku_barcode) === uppercaseSku
      );
      if (existing) {
        setItemForm({
          sku_barcode: existing.sku_barcode,
          name: existing.name,
          brand: existing.brand || "",
          serial_number: existing.serial_number || "",
          category: existing.category || "Repuestos",
          unit_price: existing.unit_price,
          initial_stock: existing.initial_stock ?? existing.stock_quantity,
          entries: 1,
          exits: existing.exits || 0,
          stock_quantity: existing.stock_quantity + 1,
          counted_stock: existing.counted_stock ?? (existing.stock_quantity + 1),
          min_stock_alert: existing.min_stock_alert || 2,
        });
      }
    }
  };

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setItemForm({
      sku_barcode: `SKU-${Date.now().toString().slice(-4)}`,
      name: "",
      brand: "",
      serial_number: "",
      category: "Repuestos GNV/GLP",
      unit_price: 100,
      initial_stock: 0,
      entries: 0,
      exits: 0,
      stock_quantity: 0,
      counted_stock: 0,
      min_stock_alert: 2,
    });
    setEditModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    const initial =
      typeof item.initial_stock === "number"
        ? item.initial_stock
        : Math.max(0, item.stock_quantity - (item.entries || 0) + (item.exits || 0));
    const entries = typeof item.entries === "number" ? item.entries : 0;
    const exits = typeof item.exits === "number" ? item.exits : 0;
    const stock = typeof item.stock_quantity === "number" ? item.stock_quantity : Math.max(0, initial + entries - exits);

    setItemForm({
      sku_barcode: item.sku_barcode,
      name: item.name,
      brand: item.brand || "",
      serial_number: item.serial_number || "",
      category: item.category || "Repuestos",
      unit_price: item.unit_price || 0,
      initial_stock: initial,
      entries: entries,
      exits: exits,
      stock_quantity: stock,
      counted_stock: typeof item.counted_stock === "number" ? item.counted_stock : stock,
      min_stock_alert: item.min_stock_alert || 2,
    });
    setEditModalOpen(true);
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateInventoryItem(editingItem.id, {
        sku_barcode: itemForm.sku_barcode,
        name: itemForm.name,
        brand: itemForm.brand,
        serial_number: itemForm.serial_number,
        category: itemForm.category,
        unit_price: Number(itemForm.unit_price),
        initial_stock: Number(itemForm.initial_stock),
        entries: Number(itemForm.entries),
        exits: Number(itemForm.exits),
        stock_quantity: Number(itemForm.stock_quantity),
        counted_stock: Number(itemForm.counted_stock),
        min_stock_alert: Number(itemForm.min_stock_alert),
      });
    } else {
      addInventoryItem({
        sku_barcode: itemForm.sku_barcode,
        name: itemForm.name,
        brand: itemForm.brand,
        serial_number: itemForm.serial_number,
        category: itemForm.category,
        unit_price: Number(itemForm.unit_price),
        initial_stock: Number(itemForm.initial_stock),
        entries: Number(itemForm.entries),
        exits: Number(itemForm.exits),
        stock_quantity: Number(itemForm.stock_quantity),
        counted_stock: Number(itemForm.counted_stock),
        min_stock_alert: Number(itemForm.min_stock_alert),
      });
    }
    setEditModalOpen(false);
  };

  // Sanitized CSV/Excel file parser preventing binary character corruption & column overflow
  const handleFileUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImportingInventory) return;
    setIsImportingInventory(true);

    // Check if file is a binary .xlsx file without proper text encoding
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      showWebNotification(
        "warning",
        "Formato de Excel Binario Detectado",
        "Ha seleccionado un archivo de Excel binario (.xlsx). Para evitar caracteres extraños o símbolos raros, guarde o exporte su hoja de Excel en formato CSV (.csv) y vuélvalo a cargar."
      );
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = (evt.target?.result as string) || "";
      const rows = parseCSVRows(rawText);
      const parsedItems: Omit<InventoryItem, "id">[] = [];

      const parseNumber = (val?: string, fallback = 0) => {
        if (!val) return fallback;
        const clean = val.trim().replace(/[^0-9.-]/g, "");
        const num = parseFloat(clean);
        return isNaN(num) ? fallback : num;
      };

      rows.forEach((cols, idx) => {
        if (idx === 0 || cols.length === 0) return;

        if (cols.length >= 2) {
          const cleanSku = (cols[0] || "").trim() || `SKU-IMP-${idx}`;
          const cleanName = (cols[1] || "").trim() || `Producto ${idx}`;
          const rawCounted = (cols[9] || "").trim();

          const initialStock = parseNumber(cols[5], 0);
          const currentStock = cols[8] !== undefined && cols[8].trim() !== "" ? parseNumber(cols[8], initialStock) : initialStock;

          parsedItems.push({
            sku_barcode: cleanSku,
            name: cleanName,
            brand: (cols[2] || "").trim(),
            serial_number: (cols[3] || "").trim(),
            unit_price: parseNumber(cols[4], 0),
            initial_stock: initialStock,
            entries: parseNumber(cols[6], 0),
            exits: parseNumber(cols[7], 0),
            stock_quantity: currentStock,
            counted_status: rawCounted || "NO CONTADO",
            counted_stock: !isNaN(Number(rawCounted)) && rawCounted !== "" ? parseFloat(rawCounted) : undefined,
            category: "Repuestos",
            min_stock_alert: 2,
          });
        }
      });

      if (parsedItems.length > 0) {
        importBulkInventoryItems(parsedItems).then((res) => {
          if (res?.success) {
            showWebNotification(
              "success",
              "¡Catálogo CSV Sincronizado!",
              `Se importaron y guardaron en Supabase ${res.count} productos del archivo "${file.name}".`
            );
          } else {
            showWebNotification(
              "warning",
              "Guardado Local con Advertencia",
              `Se cargaron ${parsedItems.length} productos localmente, pero hubo un problema al sincronizar con Supabase: ${res?.errorMsg || "Respuesta diferida"}`
            );
          }
        }).finally(() => {
          setIsImportingInventory(false);
          e.target.value = "";
        });
      } else {
        setIsImportingInventory(false);
        showWebNotification(
          "error",
          "Error de Interpretación",
          "No se pudieron interpretar productos. Verifique que el archivo esté en formato CSV separado por punto y coma (;) o comas (,)."
        );
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Form for new tool loan
  const [loanForm, setLoanForm] = useState({
    tool_name: "Escáner Automotriz Multimarca Launch X431",
    serial_number: "SN-987123",
    technician_name: technicians[0]?.full_name || "Carlos Mendoza",
    notes: "Uso en bahía de diagnóstico",
  });

  // Pedidos por Vehículo Date & Status State
  const [pedidosDate, setPedidosDate] = useState<string>(getPeruDateString());
  const [showAllPedidosDates, setShowAllPedidosDates] = useState<boolean>(false);
  const [pedidosDispatchFilter, setPedidosDispatchFilter] = useState<"todos" | "pendientes" | "atendidos">("todos");
  const PEDIDOS_PER_PAGE = 10;
  const [pedidosPage, setPedidosPage] = useState<number>(1);
  const [pedidosPageInput, setPedidosPageInput] = useState<string>("1");

  const changePedidosDateByDays = (deltaDays: number) => {
    const [y, m, d] = (pedidosDate || getPeruDateString()).split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + deltaDays);
    setPedidosDate(getPeruDateString(dateObj));
    setShowAllPedidosDates(false);
    setPedidosPage(1);
    setPedidosPageInput("1");
  };

  // Helper to extract YYYY-MM-DD from order entry_time
  const extractDateKey = (dateStr?: string) => {
    if (!dateStr || !dateStr.trim() || dateStr === "-") return "";
    if (dateStr.includes("T")) return dateStr.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
    const parts = dateStr.split(/[/.-]/);
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
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      return `${year}-${pad(month)}-${pad(day)}`;
    }
    return dateStr.slice(0, 10);
  };

  // ¿Es un REPUESTO físico despachable desde Almacén? Excluye SERVICIOS y
  // CERTIFICACIONES (ej. "CERTIFICACIÓN (Anual GNV)"), que NO son ítems de almacén:
  // el ítem de certificación puede quedar sin item_type (bug: Almacén pedía despachar
  // la certificación como si fuera un repuesto).
  const isPhysicalPart = (i: any) => {
    if (!i) return false;
    if (String(i.item_type || "").toLowerCase() === "servicio") return false;
    const desc = String(i.description || "").toUpperCase();
    return !/CERTIFIC|ANUAL|QUINQUENAL|CHIP|CILINDRO|CONVERSI|HIDROST/.test(desc);
  };

  // Group work orders with physical warehouse items by vehicle plate (Services are excluded from warehouse dispatch)
  const allVehiclePartGroups = workOrders
    .filter((wo) => wo.items && wo.items.some((i) => isPhysicalPart(i)))
    .map((wo) => {
      const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
      const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
      const dateKey = extractDateKey(wo.entry_time);
      const physicalParts = (wo.items || []).filter((i) => isPhysicalPart(i));

      return {
        orderId: wo.id,
        plate: wo.vehicle_plate,
        entry_time: wo.entry_time,
        dateKey,
        brand: vehicle?.brand || "",
        model: vehicle?.model || "",
        year: vehicle?.year || 0,
        color: vehicle?.color || "",
        fuel_type: vehicle?.fuel_type || "",
        ownerName: vehicle?.owner_name || "",
        techName: tech?.full_name || wo.assigned_technician_id || "Técnico No Asignado",
        items: physicalParts,
      };
    });

  // Calculate statistics for badges
  const dateSpecificGroups = allVehiclePartGroups.filter(
    (g) => showAllPedidosDates || g.dateKey === pedidosDate
  );
  const totalPedidosCount = dateSpecificGroups.length;
  const pendingPedidosCount = dateSpecificGroups.filter((g) => g.items.some((i) => !i.dispatched)).length;
  const attendedPedidosCount = dateSpecificGroups.filter((g) => g.items.every((i) => i.dispatched)).length;
  const pendingRequisitionsCount = allVehiclePartGroups
    .flatMap((wo) => wo.items)
    .filter((i) => !i.dispatched).length;

  // Filter groups by date and dispatch status
  const vehiclePartGroups = allVehiclePartGroups.filter((group) => {
    // Date filter
    const matchesDate = showAllPedidosDates || group.dateKey === pedidosDate;

    // Dispatch status filter
    const pendingCount = group.items.filter((i) => !i.dispatched).length;
    const isAllDispatched = pendingCount === 0;

    const matchesStatus =
      pedidosDispatchFilter === "todos"
        ? true
        : pedidosDispatchFilter === "pendientes"
          ? pendingCount > 0
          : isAllDispatched;

    return matchesDate && matchesStatus;
  });

  // Ordenar: PRIMERO las cards del vehículo con repuestos PENDIENTES de confirmar
  // (por entregar en Almacén), y después las que ya fueron atendidas/entregadas.
  vehiclePartGroups.sort((a: any, b: any) => {
    const aPending = a.items.some((i: any) => !i.dispatched) ? 0 : 1;
    const bPending = b.items.some((i: any) => !i.dispatched) ? 0 : 1;
    return aPending - bPending;
  });

  // Pagination for Pedidos por Vehículo
  const totalPedidosPages = Math.ceil(vehiclePartGroups.length / PEDIDOS_PER_PAGE) || 1;
  const startPedidosIndex = (pedidosPage - 1) * PEDIDOS_PER_PAGE;
  const endPedidosIndex = Math.min(startPedidosIndex + PEDIDOS_PER_PAGE, vehiclePartGroups.length);
  const paginatedVehiclePartGroups = vehiclePartGroups.slice(startPedidosIndex, endPedidosIndex);

  // Filtered orders for migrated cutoff modal
  const matchingMigratedOrders = workOrders.filter((o) => {
    const orderDate = (o.entry_time || "").slice(0, 10);
    return orderDate && orderDate <= migratedCutoffDate;
  });
  const matchingMigratedPendingItemsCount = matchingMigratedOrders
    .flatMap((o) => o.items)
    .filter((i) => isPhysicalPart(i) && !i.dispatched).length;

  const handleSearchIngresoSku = (codeToSearch?: string) => {
    const raw = (codeToSearch ?? ingresoSku).trim();
    if (!raw) {
      setIngresoFoundItem(null);
      return;
    }
    const cleanTerm = normalizeScannerCode(raw);
    const cleanLower = cleanTerm.toLowerCase();
    const rawLower = raw.toLowerCase();
    const words = rawLower.split(/\s+/).filter(Boolean);

    // 1. Check for exact SKU barcode match (both direct and scanner-normalized)
    const exactSku = inventoryItems.find(
      (i) =>
        i.sku_barcode.toLowerCase() === rawLower ||
        i.sku_barcode.toLowerCase() === cleanLower ||
        normalizeScannerCode(i.sku_barcode).toLowerCase() === cleanLower
    );

    if (exactSku) {
      setIngresoFoundItem(exactSku);
      setShowNewMaterialForm(false);
      return;
    }

    // 2. Check for exact product name match
    const exactName = inventoryItems.find(
      (i) => i.name.toLowerCase() === rawLower || i.name.toLowerCase() === cleanLower
    );

    if (exactName) {
      setIngresoFoundItem(exactName);
      setShowNewMaterialForm(false);
      return;
    }

    // 3. Check for multi-word name/brand matches
    const matchingItems = inventoryItems.filter((i) => {
      const target = `${i.sku_barcode} ${i.name} ${i.brand || ""} ${i.serial_number || ""}`.toLowerCase();
      return words.length > 0 && words.every((w) => target.includes(w));
    });

    if (matchingItems.length === 1) {
      setIngresoFoundItem(matchingItems[0]);
      setShowNewMaterialForm(false);
    } else if (matchingItems.length > 1) {
      // If multiple items match, keep search active so user can pick from suggestions list
      setIngresoFoundItem(null);
    } else {
      setIngresoFoundItem(null);
      setNewMaterialForm((prev) => ({
        ...prev,
        sku_barcode: cleanTerm || raw.toUpperCase(),
        name: raw,
      }));
    }
  };

  const handleConfirmStockIngreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingresoFoundItem) return;
    if (ingresoQuantity <= 0) {
      showWebNotification("warning", "Cantidad Inválida", "La cantidad a ingresar debe ser mayor a 0.");
      return;
    }

    const prevStock = ingresoFoundItem.stock_quantity;
    const newStock = prevStock + ingresoQuantity;
    const newEntries = (ingresoFoundItem.entries || 0) + ingresoQuantity;

    updateInventoryItem(ingresoFoundItem.id, {
      stock_quantity: newStock,
      entries: newEntries,
    });

    addRecentIngreso({
      itemId: ingresoFoundItem.id,
      sku: ingresoFoundItem.sku_barcode,
      name: ingresoFoundItem.name,
      quantity: ingresoQuantity,
      previousStock: prevStock,
      newStock: newStock,
      isNew: false,
    });

    showWebNotification(
      "success",
      "Ingreso Registrado con Éxito",
      `Se ingresaron +${ingresoQuantity} unidades de "${ingresoFoundItem.name}". Nuevo stock: ${newStock} unidades.`
    );

    // Refresh found item stock
    setIngresoFoundItem({
      ...ingresoFoundItem,
      stock_quantity: newStock,
      entries: newEntries,
    });
    setIngresoQuantity(1);
    setIngresoNotes("");
  };

  const handleCreateNewMaterialIngreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialForm.name.trim()) {
      showWebNotification("warning", "Campo Requerido", "El nombre del producto es obligatorio.");
      return;
    }
    const sku = newMaterialForm.sku_barcode.trim() || `SKU-${Date.now().toString().slice(-6)}`;
    const qty = Number(newMaterialForm.initial_quantity) || 1;

    const newItemData = {
      sku_barcode: sku,
      name: newMaterialForm.name.trim(),
      brand: newMaterialForm.brand.trim() || "Genérico",
      serial_number: newMaterialForm.serial_number.trim() || "-",
      category: "Repuestos y Materiales",
      unit_price: Number(newMaterialForm.unit_price) || 0,
      stock_quantity: qty,
      entries: qty,
      exits: 0,
      counted_stock: qty,
      min_stock_alert: Number(newMaterialForm.min_stock_alert) || 2,
    };

    addInventoryItem(newItemData);

    addRecentIngreso({
      itemId: `inv-${sku}`,
      sku: sku,
      name: newItemData.name,
      quantity: qty,
      previousStock: 0,
      newStock: qty,
      isNew: true,
    });

    showWebNotification(
      "success",
      "Nuevo Material Registrado",
      `Se registró "${newItemData.name}" con código SKU ${sku} e ingreso inicial de ${qty} unidades.`
    );

    setShowNewMaterialForm(false);
    setIngresoSku(sku);
    setNewMaterialForm({
      sku_barcode: "",
      name: "",
      brand: "",
      serial_number: "",
      unit_price: 0,
      initial_quantity: 1,
      min_stock_alert: 2,
      raw_counted: "",
    });
    setIngresoFoundItem(null);
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    addToolLoan({
      tool_name: loanForm.tool_name,
      serial_number: loanForm.serial_number,
      technician_name: loanForm.technician_name,
      notes: loanForm.notes,
    });
    setLoanForm({
      tool_name: "Escáner Automotriz Multimarca Launch X431",
      serial_number: "SN-987123",
      technician_name: technicians[0]?.full_name || "Carlos Mendoza",
      notes: "Uso en bahía de diagnóstico",
    });
  };

  // Inventory Filtering & Pagination Calculations
  const errorStockItems = inventoryItems.filter(
    (item) => typeof item.stock_quantity === "number" && item.stock_quantity < 0
  );
  const unvalidatedItems = inventoryItems.filter(
    (item) =>
      !item.counted_status ||
      item.counted_status.trim().toUpperCase() === "NO CONTADO" ||
      item.counted_status.trim().toUpperCase().includes("NO") ||
      item.counted_status.trim().toUpperCase().includes("PENDIENTE")
  );
  const lowStockItems = inventoryItems.filter(
    (item) => item.stock_quantity >= 0 && item.stock_quantity <= item.min_stock_alert
  );
  const criticalStockItems = inventoryItems.filter(
    (item) => item.stock_quantity === 0
  );

  const ALPHABET_LETTERS = React.useMemo(() => {
    return ["TODAS", "0-9", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  }, []);

  const letterStats = React.useMemo(() => {
    const map = new Map<string, { count: number; units: number }>();
    ALPHABET_LETTERS.forEach((l) => map.set(l, { count: 0, units: 0 }));

    inventoryItems.forEach((item) => {
      const rawName = (item.name || "").trim().toUpperCase();
      const firstChar = rawName.charAt(0);
      const isDigit = /^[0-9]/.test(firstChar);
      const isAlpha = /^[A-Z]/.test(firstChar);
      const targetLetter = isAlpha ? firstChar : isDigit ? "0-9" : "0-9";

      const current = map.get(targetLetter) || { count: 0, units: 0 };
      map.set(targetLetter, {
        count: current.count + 1,
        units: current.units + (Number(item.stock_quantity) || 0),
      });

      const allStats = map.get("TODAS") || { count: 0, units: 0 };
      map.set("TODAS", {
        count: allStats.count + 1,
        units: allStats.units + (Number(item.stock_quantity) || 0),
      });
    });

    return map;
  }, [inventoryItems, ALPHABET_LETTERS]);

  const displayInventoryItems = inventoryItems
    .filter((item) => {
      const searchRaw = deferredInventorySearch.trim().toLowerCase();
      const searchClean = normalizeScannerCode(deferredInventorySearch).toLowerCase();

      const matchesSearch =
        !searchRaw ||
        item.name.toLowerCase().includes(searchRaw) ||
        item.sku_barcode.toLowerCase().includes(searchRaw) ||
        normalizeScannerCode(item.sku_barcode).toLowerCase().includes(searchClean) ||
        (item.brand || "").toLowerCase().includes(searchRaw) ||
        (item.serial_number || "").toLowerCase().includes(searchRaw);

      const matchesStock =
        stockFilter === "todos"
          ? true
          : stockFilter === "errores"
            ? item.stock_quantity < 0
            : stockFilter === "no_validado"
              ? !item.counted_status ||
              item.counted_status.trim().toUpperCase() === "NO CONTADO" ||
              item.counted_status.trim().toUpperCase().includes("NO") ||
              item.counted_status.trim().toUpperCase().includes("PENDIENTE")
              : stockFilter === "bajo"
                ? item.stock_quantity >= 0 && item.stock_quantity <= item.min_stock_alert
                : stockFilter === "critico"
                  ? item.stock_quantity === 0
                  : true;

      const matchesLetter =
        selectedLetter === "TODAS"
          ? true
          : selectedLetter === "0-9"
            ? /^[0-9]/.test((item.name || "").trim())
            : (item.name || "").trim().toUpperCase().startsWith(selectedLetter);

      return matchesSearch && matchesStock && matchesLetter;
    })
    .sort((a, b) =>
      (a.sku_barcode || "").localeCompare(b.sku_barcode || "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

  const displayTotalUnits = React.useMemo(() => {
    return displayInventoryItems.reduce((acc, item) => acc + (Number(item.stock_quantity) || 0), 0);
  }, [displayInventoryItems]);

  const totalInventoryItems = displayInventoryItems.length;
  const totalInventoryPages = Math.ceil(totalInventoryItems / INVENTORY_ITEMS_PER_PAGE) || 1;
  const startInvIndex = (inventoryPage - 1) * INVENTORY_ITEMS_PER_PAGE;
  const paginatedInventoryItems = displayInventoryItems.slice(
    startInvIndex,
    startInvIndex + INVENTORY_ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Almacén & Despacho a Taller</h1>
            <p className="text-xs text-gray-400">
              Notificaciones de repuestos requeridos agrupadas por vehículo, selección múltiple y eliminación limpia de inventario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDailyReportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/25 active:scale-95 border border-amber-300/60"
            title="Abrir e Imprimir Informe Diario Formal para Gerencia"
          >
            <FileText className="w-4 h-4 text-black" />
            <span>Informe Diario a Gerencia</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 bg-reygas-dark p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "pedidos"
                ? "bg-amber-500 text-black font-extrabold shadow-lg"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>Pedidos por Vehículo</span>
              {pendingRequisitionsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-reygas-red text-white text-[10px] font-black animate-bounce">
                  {pendingRequisitionsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("inventario")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "inventario"
                ? "bg-emerald-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
                }`}
            >
              Inventario & Stock ({inventoryItems.length})
            </button>
            <button
              onClick={() => setActiveTab("herramientas")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "herramientas"
                ? "bg-emerald-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
                }`}
            >
              Préstamo Herramientas ({toolLoans.length})
            </button>
            <button
              onClick={() => setActiveTab("ingreso")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "ingreso"
                ? "bg-amber-500 text-black font-extrabold shadow-lg"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>Ingreso de Material</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: PEDIDOS POR VEHICULO CON FILTRO POR FECHA Y ESTADO */}
      {activeTab === "pedidos" && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  <span>Solicitudes de Repuestos Agrupadas por Vehículo</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Despacho de repuestos por fecha, control de pedidos pendientes y atendidos para el taller.
                </p>
              </div>

              {/* NAVEGADOR DE FECHA UNIVERSAL (estándar ReyGas): Día Anterior | fecha | Día Siguiente | Hoy */}
              <div className="flex flex-wrap items-center gap-3">
                <DateNavigator
                  value={pedidosDate}
                  onChange={(newDate) => {
                    setPedidosDate(newDate);
                    setShowAllPedidosDates(false);
                    setPedidosPage(1);
                    setPedidosPageInput("1");
                  }}
                />

                <button
                  onClick={() => setShowAllPedidosDates(!showAllPedidosDates)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${showAllPedidosDates
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md font-black"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10"
                    }`}
                >
                  {showAllPedidosDates ? "✓ Mostrando Todas las Fechas" : "Ver Todas las Fechas"}
                </button>
              </div>
            </div>

            {/* STATUS FILTER BUTTONS: PENDIENTES / ATENDIDOS / TODOS & BULK ACTIONS */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-reygas-dark/60 p-4 rounded-xl border border-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setPedidosDispatchFilter("todos");
                    setPedidosPage(1);
                    setPedidosPageInput("1");
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${pedidosDispatchFilter === "todos"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                    : "bg-reygas-surface text-gray-300 border-white/10 hover:text-white"
                    }`}
                >
                  Todos ({totalPedidosCount})
                </button>

                <button
                  onClick={() => {
                    setPedidosDispatchFilter("pendientes");
                    setPedidosPage(1);
                    setPedidosPageInput("1");
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 ${pedidosDispatchFilter === "pendientes"
                    ? "bg-amber-500 text-black border-amber-400 shadow-md font-black ring-2 ring-amber-300"
                    : "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-950/70"
                    }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pendientes ({pendingPedidosCount})</span>
                </button>

                <button
                  onClick={() => {
                    setPedidosDispatchFilter("atendidos");
                    setPedidosPage(1);
                    setPedidosPageInput("1");
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 ${pedidosDispatchFilter === "atendidos"
                    ? "bg-cyan-600 text-white border-cyan-500 shadow-md font-black ring-2 ring-cyan-300"
                    : "bg-cyan-950/40 text-cyan-300 border-cyan-500/40 hover:bg-cyan-950/70"
                    }`}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Atendidos ({attendedPedidosCount})</span>
                </button>
              </div>

              {/* Action Buttons: Marcar Atendidos */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setMigratedModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                  title="Configurar fecha y marcar pedidos migrados como atendidos"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Configurar y Marcar Migrado (≤ {migratedCutoffDate})</span>
                </button>

                {pendingPedidosCount > 0 && (
                  <button
                    onClick={() => setAttendAllModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Marcar Todo como Atendido</span>
                  </button>
                )}

                <div className="text-xs text-gray-400 flex items-center gap-2 pl-2 border-l border-white/10">
                  <span className="text-amber-400 font-bold">
                    {showAllPedidosDates ? "Todas las Fechas" : `Fecha: ${pedidosDate}`}
                  </span>
                  <span>•</span>
                  <span>{vehiclePartGroups.length} vehículos</span>
                </div>
              </div>
            </div>

            {vehiclePartGroups.length === 0 ? (
              <div className="text-center py-12 text-gray-400 space-y-2 border border-dashed border-white/10 rounded-2xl">
                <Package className="w-10 h-10 text-gray-600 mx-auto" />
                <p className="font-bold text-sm text-white">
                  No hay pedidos de repuestos para el filtro seleccionado.
                </p>
                <p className="text-xs text-gray-500">
                  {showAllPedidosDates
                    ? `No existen vehículos con estado "${pedidosDispatchFilter}".`
                    : `No hay solicitudes registradas para la fecha ${pedidosDate}. Pruebe seleccionando "Ver Todas las Fechas" o cambiando de día.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {paginatedVehiclePartGroups.map((group) => {
                  const pendingCountInCard = group.items.filter((i) => !i.dispatched).length;

                  return (
                    <div
                      key={group.orderId}
                      className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono font-black text-xl text-white tracking-wider bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                            {group.plate}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {group.brand ? `${group.brand} ` : ""}{group.model ? `${group.model} ` : ""}{group.year > 0 ? `(${group.year})` : ""} {group.color ? `- ${group.color}` : ""}
                            </span>
                            <span className="text-xs text-reygas-red font-semibold">
                              {group.fuel_type ? `Combustible: ${group.fuel_type} • ` : ""}{group.ownerName ? `Cliente: ${group.ownerName}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          {group.dateKey && (
                            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-reygas-dark text-cyan-300 border border-cyan-500/30">
                              📅 {group.dateKey}
                            </span>
                          )}
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-reygas-surface text-gray-200 border border-white/10">
                            Técnico Asignado: <strong className="text-amber-400">{group.techName}</strong>
                          </span>
                          {pendingCountInCard > 0 ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {pendingCountInCard} pendientes
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold flex items-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5" />
                              ✓ Todos entregados
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase text-gray-400 block">
                          Lista de Repuestos Asignados para este Vehículo:
                        </span>

                        <div className="grid grid-cols-1 gap-2.5">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${item.dispatched
                                ? "bg-emerald-950/20 border-emerald-500/30"
                                : "bg-amber-950/20 border-amber-500/40"
                                }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span className="font-bold text-white text-sm">{item.description}</span>
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold">
                                    x{item.quantity}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 pt-0.5">
                                  {/* Marca y Serie del producto desde el catálogo de Almacén */}
                                  {(() => {
                                    const invItem = inventoryItems.find((i: any) => i.id === item.inventory_item_id);
                                    return (
                                      <>
                                        {invItem?.brand && (
                                          <span>🏷️ <strong>Marca:</strong> <span className="text-gray-200 font-bold">{invItem.brand}</span></span>
                                        )}
                                        {invItem?.serial_number && (
                                          <span>🔢 <strong>Serie:</strong> <span className="text-gray-200 font-bold font-mono">{invItem.serial_number}</span></span>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <span>
                                    📅 <strong>Solicitado:</strong>{" "}
                                    {item.requested_at
                                      ? new Date(item.requested_at).toLocaleString()
                                      : "Reciente"}
                                  </span>
                                  {item.dispatched && item.dispatched_at && (
                                    <span className="text-emerald-400">
                                      ✓ <strong>Entregado:</strong>{" "}
                                      {new Date(item.dispatched_at).toLocaleString()}
                                    </span>
                                  )}
                                </div>

                                {/* OBSERVACIÓN / DETALLE DEL PRODUCTO indicada por el técnico */}
                                {item.observation && (
                                  <div className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1.5">
                                    <span className="shrink-0">📝</span>
                                    <span>
                                      <strong className="text-amber-300">Observación del Técnico:</strong>{" "}
                                      {item.observation}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">
                                {item.dispatched ? (
                                  <button
                                    onClick={() => toggleWorkOrderItemDispatched(group.orderId, item.id)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition-all"
                                    title="Haga clic para revertir estado a pendiente"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ENTREGADO Y LISTO (Cambiar)</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleWorkOrderItemDispatched(group.orderId, item.id)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Confirmar Repuesto Listo para Recojo</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PEDIDOS PAGINATION CONTROLS (SIMILAR A REGISTRO TALLER) */}
            {totalPedidosPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-gray-300">
                <div>
                  Mostrando pedidos <span className="text-white font-bold">{startPedidosIndex + 1}</span> a{" "}
                  <span className="text-white font-bold">{endPedidosIndex}</span> de{" "}
                  <span className="text-white font-bold">{vehiclePartGroups.length}</span> totales
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const nextP = Math.max(1, pedidosPage - 1);
                      setPedidosPage(nextP);
                      setPedidosPageInput(String(nextP));
                    }}
                    disabled={pedidosPage <= 1}
                    className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>&larr;</span>
                    <span>Anterior ({PEDIDOS_PER_PAGE})</span>
                  </button>

                  {/* Direct Jump to Page Input */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-amber-500/40 text-gray-300 font-semibold shadow">
                    <span className="text-amber-400 font-bold">Página</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPedidosPages}
                      value={pedidosPageInput}
                      onChange={(e) => setPedidosPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(pedidosPageInput);
                          if (!isNaN(val) && val >= 1 && val <= totalPedidosPages) {
                            setPedidosPage(val);
                          }
                        }
                      }}
                      className="w-16 px-2 py-1 bg-reygas-dark border border-white/20 rounded-lg text-white font-mono font-black text-center focus:border-amber-400 focus:outline-none"
                    />
                    <span>de <strong className="text-white font-black">{totalPedidosPages}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(pedidosPageInput);
                        if (!isNaN(val) && val >= 1 && val <= totalPedidosPages) {
                          setPedidosPage(val);
                        }
                      }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg transition-transform hover:scale-105 shadow text-xs"
                    >
                      Ir
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const nextP = Math.min(totalPedidosPages, pedidosPage + 1);
                      setPedidosPage(nextP);
                      setPedidosPageInput(String(nextP));
                    }}
                    disabled={pedidosPage >= totalPedidosPages}
                    className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>Siguiente ({PEDIDOS_PER_PAGE})</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTARIO & STOCK CON SELECCION MULTIPLE, FILTRO DE BAJO STOCK Y LIMPIEZA */}
      {activeTab === "inventario" && (
        <div className="space-y-6">
          {/* ALERT BANNER FOR NEGATIVE, LOW OR CRITICAL STOCK MATERIALS */}
          {(errorStockItems.length > 0 || lowStockItems.length > 0) && (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <span>⚠️ Alerta de Almacén & Stock</span>
                    {errorStockItems.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                        {errorStockItems.length} con Stock Negativo
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
                      {lowStockItems.length} con Stock Bajo
                    </span>
                  </h3>
                  <p className="text-xs text-amber-200/90 font-medium">
                    Existen {errorStockItems.length} ítems con error de stock negativo y {lowStockItems.length} materiales con stock bajo o agotado.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {errorStockItems.length > 0 && (
                  <button
                    onClick={() => setStockFilter(stockFilter === "errores" ? "todos" : "errores")}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${stockFilter === "errores"
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/30 ring-2 ring-red-400"
                      : "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40"
                      }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{stockFilter === "errores" ? "Viendo Errores Negativos ✓" : "Ver Errores Negativos"}</span>
                  </button>
                )}
                <button
                  onClick={() => setStockFilter(stockFilter === "bajo" ? "todos" : "bajo")}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${stockFilter === "bajo"
                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/30"
                    : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                    }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{stockFilter === "bajo" ? "Viendo Stock Bajo ✓" : "Ver Stock Bajo"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>Catálogo de Inventario de Almacén</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Filtro de errores negativos, ítems no validados, stock bajo y vaciado de base de datos.
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Batch Delete Selection Button */}
                {selectedRowIds.length > 0 && (
                  <button
                    onClick={promptDeleteSelected}
                    className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 animate-pulse shrink-0 touch-target"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Eliminar Filas Seleccionadas ({selectedRowIds.length})</span>
                  </button>
                )}

                {/* Clear Database / Purge All Inventory Button */}
                <button
                  onClick={promptPurgeAll}
                  className="px-3.5 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs sm:text-sm font-extrabold rounded-xl shadow-lg flex items-center gap-2 transition-all shrink-0 touch-target"
                  title="Vaciar y limpiar todo el inventario de la base de datos"
                >
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="whitespace-nowrap">Limpiar Base de Datos Completa</span>
                </button>

                {/* Imprimir Códigos de Barra Button */}
                <button
                  type="button"
                  onClick={() => setBarcodePrintModalOpen(true)}
                  className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all shrink-0 touch-target"
                  title="Imprimir planchas de códigos de barra (8 por hoja A4, ordenadas por letra)"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Imprimir Códigos de Barra</span>
                </button>

                <label
                  className={`px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all shrink-0 touch-target ${isImportingInventory ? "opacity-70 pointer-events-none" : ""
                    }`}
                >
                  {isImportingInventory ? (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">{isImportingInventory ? "Subiendo datos a la nube..." : "Cargar CSV / Excel"}</span>
                  <input
                    type="file"
                    accept=".csv, .txt, .xlsx, .xls"
                    onChange={handleFileUploadExcel}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setManualExitModalOpen(true)}
                  className="px-3.5 py-2.5 bg-reygas-red/90 hover:bg-reygas-red text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-2 transition-all shrink-0 touch-target"
                >
                  <RotateCcw className="w-4 h-4 rotate-180 shrink-0" />
                  <span className="whitespace-nowrap">Salida Urgente</span>
                </button>

                <button
                  onClick={handleOpenNewModal}
                  className="px-3.5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-white text-xs sm:text-sm font-bold rounded-xl border border-white/10 flex items-center gap-2 transition-colors shrink-0 touch-target"
                >
                  <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">Agregar Fila</span>
                </button>
              </div>
            </div>

            {/* SEARCH & LOW/CRITICAL STOCK FILTER TOOLBAR */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-reygas-dark/60 p-4 rounded-xl border border-white/5">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por SKU, nombre o marca..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-xs text-white focus:border-emerald-500"
                />
              </div>

              {/* Quick Stock Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStockFilter("todos")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${stockFilter === "todos"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                    : "bg-reygas-surface text-gray-300 border-white/10 hover:text-white"
                    }`}
                >
                  Todos ({inventoryItems.length})
                </button>

                <button
                  onClick={() => setStockFilter("errores")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 ${stockFilter === "errores"
                    ? "bg-red-600 text-white border-red-500 shadow-md font-black ring-2 ring-red-400"
                    : "bg-red-950/40 text-red-300 border-red-500/40 hover:bg-red-950/70"
                    }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>⚠️ Errores / Negativos ({errorStockItems.length})</span>
                </button>

                <button
                  onClick={() => setStockFilter("no_validado")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 ${stockFilter === "no_validado"
                    ? "bg-amber-500 text-black border-amber-400 shadow-md font-black ring-2 ring-amber-300"
                    : "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-950/70"
                    }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>📋 No Validado ({unvalidatedItems.length})</span>
                </button>

                <button
                  onClick={() => setStockFilter("bajo")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 ${stockFilter === "bajo"
                    ? "bg-amber-500 text-black border-amber-400 shadow-md font-black"
                    : "bg-amber-950/20 text-amber-300/80 border-amber-500/30 hover:bg-amber-950/50"
                    }`}
                >
                  <span>Stock Bajo ({lowStockItems.length})</span>
                </button>

              </div>
            </div>

            {/* ALPHABET STARTING LETTER FILTER BAR & UNIT COUNT METRICS */}
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔤</span>
                  <span>Filtrar por Letra Inicial del Producto:</span>
                </span>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-300 font-medium">
                    Productos: <strong className="text-white font-mono font-black">{totalInventoryItems}</strong>
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300 font-medium">
                    Total Unidades Físicas: <strong className="text-emerald-400 font-mono font-black">{displayTotalUnits.toLocaleString()} unid.</strong>
                  </span>
                  {selectedLetter !== "TODAS" && (
                    <button
                      type="button"
                      onClick={() => setSelectedLetter("TODAS")}
                      className="ml-2 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[10px] font-bold transition-colors"
                    >
                      Limpiar Letra &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Alphabet Pills Horizontal Scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 touch-scroll">
                {ALPHABET_LETTERS.map((letter) => {
                  const stats = letterStats.get(letter) || { count: 0, units: 0 };
                  const isSelected = selectedLetter === letter;
                  const hasItems = stats.count > 0;

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!hasItems && letter !== "TODAS"}
                      onClick={() => setSelectedLetter(letter)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${isSelected
                        ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30 scale-105 ring-2 ring-amber-400"
                        : hasItems
                          ? "bg-reygas-surface/80 hover:bg-white/15 text-white border border-white/10"
                          : "bg-transparent text-gray-600 border border-white/5 opacity-40 cursor-not-allowed"
                        }`}
                      title={`${letter}: ${stats.count} productos (${stats.units} unidades)`}
                    >
                      <span>{letter}</span>
                      {hasItems && letter !== "TODAS" && (
                        <span
                          className={`px-1.5 py-0.2 rounded-md font-mono text-[9px] font-black ${isSelected
                            ? "bg-black/30 text-black"
                            : "bg-black/50 text-amber-400 border border-amber-500/20"
                            }`}
                        >
                          {stats.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inventory Table with Sticky Header & Overflow Protection */}
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto border border-white/10 rounded-xl relative">
              <table className="w-full text-left text-xs text-gray-300 table-auto border-collapse">
                <thead className="sticky top-0 z-20 bg-reygas-dark text-[11px] uppercase text-gray-400 border-b border-white/10 shadow-md">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-gray-400 hover:text-white"
                        title="Seleccionar todo"
                      >
                        {selectedRowIds.length > 0 && selectedRowIds.length === inventoryItems.length ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 font-extrabold w-16 text-center text-amber-400">ÍTEM (#)</th>
                    <th className="p-3 font-extrabold max-w-[140px]">CÓDIGO SKU</th>
                    <th className="p-3 font-extrabold max-w-[200px]">PRODUCTO</th>
                    <th className="p-3 font-extrabold max-w-[120px]">MARCA</th>
                    <th className="p-3 font-extrabold max-w-[120px]">SERIE</th>
                    <th className="p-3 font-extrabold">PRECIO VENTA</th>
                    <th className="p-3 font-extrabold">STOCK INICIAL</th>
                    <th className="p-3 font-extrabold">ENTRADAS</th>
                    <th className="p-3 font-extrabold">SALIDAS</th>
                    <th className="p-3 font-extrabold">STOCK VIGENTE</th>
                    <th className="p-3 font-extrabold">CONTADOS</th>
                    <th className="p-3 font-extrabold text-right">OPCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayInventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-gray-400 space-y-2">
                        <Package className="w-10 h-10 text-gray-600 mx-auto" />
                        <p className="font-bold text-sm">
                          {stockFilter === "errores"
                            ? "No se encontraron materiales con stock negativo."
                            : stockFilter === "no_validado"
                              ? "No hay materiales pendientes de validación / no contados."
                              : stockFilter === "bajo"
                                ? "No hay materiales con stock bajo o crítico."
                                : stockFilter === "critico"
                                  ? "No hay materiales agotados en 0."
                                  : "No se encontraron productos con el filtro aplicado."}
                        </p>
                        <p className="text-xs text-gray-500">
                          Pruebe cambiando el filtro a "Todos" o limpiando el texto de búsqueda.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInventoryItems.map((item, idx) => {
                      const isLow = item.stock_quantity >= 0 && item.stock_quantity <= item.min_stock_alert;
                      const isNegative = typeof item.stock_quantity === "number" && item.stock_quantity < 0;
                      const isSelected = selectedRowIds.includes(item.id);
                      const globalIdx = startInvIndex + idx + 1;

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${isNegative
                            ? "bg-red-950/20 hover:bg-red-950/40"
                            : isSelected
                              ? "bg-emerald-950/30"
                              : "hover:bg-white/5"
                            }`}
                        >
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleSelectRow(item.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-mono font-bold text-center text-amber-400 bg-amber-500/10 rounded">
                            #{globalIdx}
                          </td>
                          <td
                            className="p-3 font-mono font-bold text-reygas-silver max-w-[140px] truncate"
                            title={item.sku_barcode}
                          >
                            {item.sku_barcode}
                          </td>
                          <td
                            className="p-3 font-bold text-white max-w-[200px] truncate"
                            title={item.name}
                          >
                            {item.name}
                          </td>
                          <td
                            className="p-3 text-gray-300 max-w-[120px] truncate"
                            title={item.brand || ""}
                          >
                            {item.brand || ""}
                          </td>
                          <td
                            className="p-3 font-mono text-gray-400 max-w-[120px] truncate"
                            title={item.serial_number || ""}
                          >
                            {item.serial_number || ""}
                          </td>
                          <td className="p-3 font-bold text-white font-mono">
                            S/ {(item.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-gray-300">
                            {item.initial_stock !== undefined ? item.initial_stock : item.stock_quantity}
                          </td>
                          <td className="p-3 font-mono text-emerald-400 font-bold">
                            +{item.entries || 0}
                          </td>
                          <td className="p-3 font-mono text-red-400 font-bold">
                            -{item.exits || 0}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold ${isNegative
                                ? "bg-red-600/30 text-red-400 border border-red-500 font-black shadow-sm"
                                : isLow
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                }`}
                            >
                              {isNegative ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              ) : isLow ? (
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                              ) : null}
                              {item.stock_quantity} unids
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            {item.counted_status ? (
                              item.counted_status.trim().toUpperCase() === "NO CONTADO" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[11px]">
                                  NO CONTADO
                                </span>
                              ) : item.counted_status.trim().toUpperCase() === "CONTADO" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[11px]">
                                  CONTADO
                                </span>
                              ) : (
                                <span className="text-gray-200">{item.counted_status}</span>
                              )
                            ) : item.counted_stock !== undefined ? (
                              <span className="text-gray-300">{item.counted_stock}</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                                title="Editar Fila"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => promptDeleteSingle(item.id, item.name)}
                                className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                                title="Eliminar Fila"
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

            {/* Inventory Pagination Controls */}
            {totalInventoryPages > 1 && (
              <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-gray-400">
                <span>
                  Mostrando {startInvIndex + 1} - {Math.min(startInvIndex + INVENTORY_ITEMS_PER_PAGE, totalInventoryItems)} de {totalInventoryItems} ítems
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={inventoryPage <= 1}
                    onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-reygas-surface hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg border border-white/10 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="font-bold text-white">
                    Página {inventoryPage} de {totalInventoryPages}
                  </span>
                  <button
                    disabled={inventoryPage >= totalInventoryPages}
                    onClick={() => setInventoryPage((p) => Math.min(totalInventoryPages, p + 1))}
                    className="px-3 py-1.5 bg-reygas-surface hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg border border-white/10 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRESTAMO HERRAMIENTAS */}
      {activeTab === "herramientas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Wrench className="w-5 h-5 text-emerald-400" />
              <span>Asignar Herramienta a Técnico</span>
            </h2>

            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre del Equipo / Herramienta *
                </label>
                <input
                  type="text"
                  required
                  value={loanForm.tool_name}
                  onChange={(e) => setLoanForm({ ...loanForm, tool_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Número de Serie / Código Interno
                </label>
                <input
                  type="text"
                  value={loanForm.serial_number}
                  onChange={(e) => setLoanForm({ ...loanForm, serial_number: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Técnico Solicitante *
                </label>
                <select
                  value={loanForm.technician_name}
                  onChange={(e) => setLoanForm({ ...loanForm, technician_name: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white focus:border-emerald-500"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.full_name}>
                      {t.full_name} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Notas / Uso</label>
                <input
                  type="text"
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Préstamo de Equipo</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <span>Registro de Equipos en Uso por Técnicos</span>
            </h2>

            <div className="space-y-3">
              {toolLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-4 rounded-xl glass-card border border-white/10 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{loan.tool_name}</span>
                      <span className="text-xs text-gray-400 font-mono">({loan.serial_number})</span>
                    </div>
                    <p className="text-xs text-amber-400 font-semibold">
                      Asignado a: {loan.technician_name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Fecha: {new Date(loan.borrowed_at).toLocaleString("es-PE")}
                    </p>
                  </div>

                  <div>
                    {loan.status === "prestado" ? (
                      <button
                        onClick={() => returnTool(loan.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Marcar Devuelto</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-gray-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
                        Devuelto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INGRESO DE MATERIAL */}
      {activeTab === "ingreso" && (
        <div className="space-y-8">
          {/* Header & Mode Switcher */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <PackagePlus className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>Ingreso de Material a Almacén</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Abastecimiento
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ingrese el código SKU del repuesto para sumar stock existente o registre un producto nuevo que no existe en el catálogo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewMaterialForm(false);
                  setIngresoFoundItem(null);
                  setIngresoSku("");
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${!showNewMaterialForm
                  ? "bg-amber-500 text-black border-amber-400 font-black shadow-lg shadow-amber-500/20"
                  : "bg-reygas-surface text-gray-300 border-white/10 hover:text-white"
                  }`}
              >
                <Search className="w-4 h-4" />
                <span>Buscar SKU Existente</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNewMaterialForm(true);
                  setIngresoFoundItem(null);
                  setNewMaterialForm({
                    sku_barcode: ingresoSku || `SKU-${Date.now().toString().slice(-6)}`,
                    name: "",
                    brand: "",
                    serial_number: "",
                    unit_price: 0,
                    initial_quantity: 1,
                    min_stock_alert: 2,
                    raw_counted: "",
                  });
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${showNewMaterialForm
                  ? "bg-emerald-600 text-white border-emerald-500 font-black shadow-lg shadow-emerald-600/30"
                  : "bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-950/70"
                  }`}
              >
                <Plus className="w-4 h-4" />
                <span>+ Registrar Material Nuevo</span>
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Búsqueda o Formulario de Ingreso */}
            <div className="lg:col-span-7 space-y-6">
              {!showNewMaterialForm ? (
                /* MODO BUSCAR SKU EXISTENTE */
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
                  <div>
                    <label className="block text-xs font-black text-amber-400 uppercase tracking-wider mb-2">
                      Escanear Código de Barras / SKU o Buscar por Nombre de Producto
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Barcode className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Escanear código (ej. RYG-ABR-0001) o escribir nombre (ej. Abrazadera, Reductor, Válvula)..."
                          value={ingresoSku}
                          onChange={(e) => {
                            const clean = normalizeScannerCode(e.target.value);
                            setIngresoSku(clean);
                            handleSearchIngresoSku(clean);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const clean = normalizeScannerCode(ingresoSku);
                              handleSearchIngresoSku(clean);
                            }
                          }}
                          className="w-full pl-11 pr-4 py-3.5 bg-reygas-surface border border-white/15 rounded-2xl text-white font-mono text-sm uppercase focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-bold"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearchIngresoSku()}
                        className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl text-xs transition-transform hover:scale-105 shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                      >
                        <Search className="w-4 h-4 stroke-[3]" />
                        <span>Buscar</span>
                      </button>
                    </div>
                  </div>

                  {/* Sugerencias Rápidas al Escribir */}
                  {ingresoSku && !ingresoFoundItem && (() => {
                    const rawSearch = ingresoSku.trim().toLowerCase();
                    const cleanSearch = normalizeScannerCode(ingresoSku).toLowerCase();
                    const searchWords = rawSearch.split(/\s+/).filter(Boolean);

                    const matchingSuggestions = inventoryItems.filter((i) => {
                      const fullText = `${i.sku_barcode} ${i.name} ${i.brand || ""} ${i.serial_number || ""}`.toLowerCase();
                      const matchesAllWords = searchWords.length > 0 && searchWords.every((w) => fullText.includes(w));
                      return (
                        i.sku_barcode.toLowerCase().includes(rawSearch) ||
                        normalizeScannerCode(i.sku_barcode).toLowerCase().includes(cleanSearch) ||
                        i.name.toLowerCase().includes(rawSearch) ||
                        matchesAllWords
                      );
                    });

                    return (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-gray-400 uppercase">
                            Resultados coincidentes en inventario ({matchingSuggestions.length}):
                          </p>
                          {matchingSuggestions.length > 0 && (
                            <span className="text-[10px] text-amber-400 font-semibold">
                              Haga clic en un producto para seleccionarlo
                            </span>
                          )}
                        </div>

                        {matchingSuggestions.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                            {matchingSuggestions.slice(0, 8).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setIngresoSku(item.sku_barcode);
                                  setIngresoFoundItem(item);
                                }}
                                className="w-full p-3 rounded-xl bg-reygas-surface/60 hover:bg-white/10 border border-white/5 hover:border-amber-500/30 flex items-center justify-between text-left transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="px-2 py-1 rounded-lg bg-black/60 font-mono text-xs font-bold text-amber-400 border border-amber-500/30 group-hover:border-amber-400">
                                    {item.sku_barcode}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                                      {item.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {item.brand || "Sin marca"} • {item.serial_number || "S/N"}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs font-mono font-black text-emerald-400 shrink-0">
                                  Stock: {item.stock_quantity}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                            <div className="text-xs text-amber-300">
                              No se encontró ningún material con el código o nombre <strong>"{ingresoSku}"</strong>.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewMaterialForm(true);
                                setNewMaterialForm({
                                  sku_barcode: /^[A-Z0-9]+-[A-Z0-9]+/.test(ingresoSku) ? ingresoSku : `SKU-${Date.now().toString().slice(-6)}`,
                                  name: !/^[A-Z0-9]+-[A-Z0-9]+/.test(ingresoSku) ? ingresoSku : "",
                                  brand: "",
                                  serial_number: "",
                                  unit_price: 0,
                                  initial_quantity: 1,
                                  min_stock_alert: 2,
                                  raw_counted: "",
                                });
                              }}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow transition-transform hover:scale-105"
                            >
                              + Crear este Material
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Detalle y Formulario de Ingreso para Item Encontrado */}
                  {ingresoFoundItem && (
                    <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-6 animate-fadeIn">
                      <div className="flex items-start justify-between gap-4 border-b border-emerald-500/20 pb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                              ✓ Material Encontrado
                            </span>
                            <span className="text-xs font-mono text-gray-400">
                              SKU: <strong className="text-white">{ingresoFoundItem.sku_barcode}</strong>
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white">{ingresoFoundItem.name}</h3>
                          <p className="text-xs text-gray-300">
                            Marca: <span className="font-semibold text-white">{ingresoFoundItem.brand || "Genérico"}</span> • Serie / Nro Parte: <span className="font-semibold text-white">{ingresoFoundItem.serial_number || "-"}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Precio Unitario</span>
                          <span className="text-base font-black text-amber-400 font-mono">
                            S/ {(ingresoFoundItem.unit_price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Métricas Actuales */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Stock Actual</span>
                          <span className="text-lg font-mono font-black text-emerald-400">
                            {ingresoFoundItem.stock_quantity}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Entradas Previas</span>
                          <span className="text-lg font-mono font-bold text-white">
                            {ingresoFoundItem.entries || 0}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/50 border border-emerald-500/30">
                          <span className="text-[10px] text-emerald-400 block uppercase font-bold">Nuevo Stock</span>
                          <span className="text-lg font-mono font-black text-emerald-300">
                            {ingresoFoundItem.stock_quantity + (Number(ingresoQuantity) || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Formulario de Cantidad */}
                      <form onSubmit={handleConfirmStockIngreso} className="space-y-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                            Cantidad de Unidades que Ingresan *
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={1}
                              required
                              value={ingresoQuantity}
                              onChange={(e) => setIngresoQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-32 px-4 py-3 bg-reygas-surface border border-emerald-500/40 rounded-xl text-white font-mono text-lg font-black text-center focus:border-emerald-400 focus:outline-none"
                            />
                            {/* Botones rápidos de cantidad */}
                            <div className="flex items-center gap-1.5">
                              {[1, 5, 10, 20, 50].map((qty) => (
                                <button
                                  key={qty}
                                  type="button"
                                  onClick={() => setIngresoQuantity(qty)}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${ingresoQuantity === qty
                                    ? "bg-emerald-500 text-black border-emerald-400 font-black"
                                    : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
                                    }`}
                                >
                                  +{qty}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                            Nota / Nro Guía / Proveedor (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Factura F001-2894 / Proveedor Gastech..."
                            value={ingresoNotes}
                            onChange={(e) => setIngresoNotes(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-500/20">
                          <button
                            type="button"
                            onClick={() => {
                              setIngresoFoundItem(null);
                              setIngresoSku("");
                            }}
                            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
                          >
                            Limpiar
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                          >
                            <ArrowDownToLine className="w-4 h-4 stroke-[3]" />
                            <span>Registrar Ingreso de Stock (+{ingresoQuantity} unid.)</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO REGISTRAR NUEVO MATERIAL QUE NO EXISTE */
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/30 space-y-6 animate-fadeIn">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white">Registrar Nuevo Material en Catálogo</h3>
                        <p className="text-xs text-gray-400">
                          Complete los datos del repuesto para ingresarlo al catálogo y sumar su stock inicial.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewMaterialForm(false)}
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateNewMaterialIngreso} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Código SKU / Barras *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. REG-TA-5G"
                          value={newMaterialForm.sku_barcode}
                          onChange={(e) =>
                            setNewMaterialForm({ ...newMaterialForm, sku_barcode: e.target.value.toUpperCase() })
                          }
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono uppercase text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Nombre del Material / Repuesto *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Reductor de Presión Tomasetto 5G"
                          value={newMaterialForm.name}
                          onChange={(e) => setNewMaterialForm({ ...newMaterialForm, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Marca
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Tomasetto / BRC / Lovato"
                          value={newMaterialForm.brand}
                          onChange={(e) => setNewMaterialForm({ ...newMaterialForm, brand: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Serie / Nro de Parte
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. SN-77182"
                          value={newMaterialForm.serial_number}
                          onChange={(e) => setNewMaterialForm({ ...newMaterialForm, serial_number: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Precio de Venta (S/)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={newMaterialForm.unit_price}
                          onChange={(e) =>
                            setNewMaterialForm({ ...newMaterialForm, unit_price: Number(e.target.value) })
                          }
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono text-sm focus:border-amber-400 focus:outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                          Cantidad Inicial que Ingresa *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={newMaterialForm.initial_quantity}
                          onChange={(e) =>
                            setNewMaterialForm({
                              ...newMaterialForm,
                              initial_quantity: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-emerald-500/40 rounded-xl text-white font-mono text-sm focus:border-emerald-400 focus:outline-none font-black"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                          Alerta Stock Mínimo
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={newMaterialForm.min_stock_alert}
                          onChange={(e) =>
                            setNewMaterialForm({
                              ...newMaterialForm,
                              min_stock_alert: Number(e.target.value),
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setShowNewMaterialForm(false)}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Guardar Nuevo Material e Ingresar Stock</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Right Column: Historial de Ingresos de la Sesión */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-extrabold text-white">Ingresos Registrados en la Sesión</h3>
                  </div>
                  {recentIngresos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearRecentIngresos()}
                      className="text-[11px] text-gray-400 hover:text-white transition-colors"
                    >
                      Limpiar lista
                    </button>
                  )}
                </div>

                {recentIngresos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 space-y-2">
                    <ArrowDownToLine className="w-8 h-8 mx-auto text-gray-600" />
                    <p className="text-xs">Aún no ha registrado ingresos en esta sesión.</p>
                    <p className="text-[11px] text-gray-600">
                      Busque un SKU a la izquierda o cree un nuevo material para abastecer almacén.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {recentIngresos.map((ing) => (
                      <div
                        key={ing.id}
                        className="p-3.5 rounded-2xl bg-reygas-surface/70 border border-white/10 space-y-2 hover:border-amber-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-black/60 font-mono text-[10px] font-bold text-amber-400 border border-amber-500/30">
                                {ing.sku}
                              </span>
                              {ing.isNew && (
                                <span className="px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-black">
                                  NUEVO
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-white mt-1">{ing.name}</h4>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black border border-emerald-500/30">
                              +{ing.quantity} unid.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  open: true,
                                  title: "Anular Ingreso de Material",
                                  message: `¿Desea anular este registro de ingreso (+${ing.quantity} unid.) de "${ing.name}" y revertir su stock a ${ing.previousStock}?`,
                                  actionType: "revert_ingreso",
                                  targetId: ing.id,
                                  targetName: ing.name,
                                });
                              }}
                              title="Anular y borrar este ingreso si se equivocó"
                              className="p-1.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/15 border border-white/5 hover:border-red-500/30 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                          <span>
                            Stock: <strong className="text-gray-300">{ing.previousStock}</strong> &rarr;{" "}
                            <strong className="text-emerald-400 font-bold">{ing.newStock}</strong>
                          </span>
                          <span className="font-mono text-gray-500">{ing.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STYLED CONFIRMATION MODAL (MATCHING APP DESIGN SYSTEM) */}
      {/* ========================================================================= */}
      {confirmModal?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-red-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{confirmModal.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Ventana de Confirmación Web de Almacén</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 bg-reygas-surface hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteConfirmedAction}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs shadow-lg shadow-red-600/30 transition-transform hover:scale-105 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLED WEB NOTIFICATION MODAL (REPLACES BROWSER ALERT) */}
      {webAlert?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div
                className={`p-3 rounded-2xl border ${webAlert.type === "warning"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : webAlert.type === "error"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : webAlert.type === "success"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  }`}
              >
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{webAlert.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Aviso Web de Almacén</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {webAlert.message}
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setWebAlert(null)}
                className="px-6 py-2.5 bg-reygas-red hover:bg-red-600 text-white font-black rounded-xl text-xs shadow-lg shadow-reygas-red/30 transition-transform hover:scale-105"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / New Item Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl shadow-black/90 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    {editingItem ? `Editar Fila - ${editingItem.name}` : "Agregar Nuevo Producto al Inventario"}
                  </h3>
                  <p className="text-xs text-gray-400">Complete los datos del repuesto o material para el catálogo.</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    CÓDIGO SKU * <span className="text-[10px] text-amber-400 font-normal">(Autocompleta)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. KIT-GNV-5G"
                    value={itemForm.sku_barcode}
                    onChange={(e) => handleSkuInputChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white font-mono uppercase text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">PRODUCTO *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">MARCA</label>
                  <input
                    type="text"
                    placeholder="Ej. Tomasetto / BRC"
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">SERIE / NRO PARTE</label>
                  <input
                    type="text"
                    placeholder="Ej. SN-88192"
                    value={itemForm.serial_number}
                    onChange={(e) => setItemForm({ ...itemForm, serial_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">PRECIO DE VENTA (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={itemForm.unit_price}
                    onChange={(e) => setItemForm({ ...itemForm, unit_price: Number(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">STOCK MÍNIMO ALERTA</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.min_stock_alert}
                    onChange={(e) => setItemForm({ ...itemForm, min_stock_alert: Number(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">STOCK CONTADO (FÍSICO)</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.counted_stock}
                    onChange={(e) => setItemForm({ ...itemForm, counted_stock: Number(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* SECCIÓN DINÁMICA DE MOVIMIENTOS Y STOCK VIGENTE */}
              <div className="p-4 rounded-2xl bg-black/40 border border-amber-500/30 space-y-3 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Balance de Movimientos y Stock Vigente
                  </span>
                  <span className="text-[11px] font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    Fórmula: <strong className="text-gray-200">Inicial</strong> + <strong className="text-emerald-400">Entradas</strong> - <strong className="text-red-400">Salidas</strong> = <strong className="text-amber-400">Vigente</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                      STOCK INICIAL
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itemForm.initial_stock}
                      onChange={(e) => {
                        const newInitial = Number(e.target.value) || 0;
                        const newStock = Math.max(0, newInitial + (Number(itemForm.entries) || 0) - (Number(itemForm.exits) || 0));
                        setItemForm((prev) => ({
                          ...prev,
                          initial_stock: newInitial,
                          stock_quantity: newStock,
                        }));
                      }}
                      className="w-full px-3 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      ENTRADAS (+)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itemForm.entries}
                      onChange={(e) => {
                        const newEntries = Number(e.target.value) || 0;
                        const newStock = Math.max(0, (Number(itemForm.initial_stock) || 0) + newEntries - (Number(itemForm.exits) || 0));
                        setItemForm((prev) => ({
                          ...prev,
                          entries: newEntries,
                          stock_quantity: newStock,
                        }));
                      }}
                      className="w-full px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-bold text-sm font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-red-400 uppercase tracking-wider mb-1">
                      SALIDAS (-)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itemForm.exits}
                      onChange={(e) => {
                        const newExits = Number(e.target.value) || 0;
                        const newStock = Math.max(0, (Number(itemForm.initial_stock) || 0) + (Number(itemForm.entries) || 0) - newExits);
                        setItemForm((prev) => ({
                          ...prev,
                          exits: newExits,
                          stock_quantity: newStock,
                        }));
                      }}
                      className="w-full px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 font-bold text-sm font-mono focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                      STOCK VIGENTE (=)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itemForm.stock_quantity}
                      onChange={(e) => {
                        const newStock = Number(e.target.value) || 0;
                        setItemForm((prev) => ({
                          ...prev,
                          stock_quantity: newStock,
                        }));
                      }}
                      className="w-full px-3 py-2.5 bg-amber-500/15 border-2 border-amber-400/60 rounded-xl text-amber-300 font-black text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none shadow-sm shadow-amber-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>
                    Cálculo actual: <span className="font-mono text-gray-300">{Number(itemForm.initial_stock) || 0}</span> + <span className="font-mono text-emerald-400">{Number(itemForm.entries) || 0}</span> - <span className="font-mono text-red-400">{Number(itemForm.exits) || 0}</span> = <strong className="font-mono text-amber-300 font-extrabold text-xs">{Number(itemForm.stock_quantity) || 0} unid.</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = Math.max(0, (Number(itemForm.initial_stock) || 0) + (Number(itemForm.entries) || 0) - (Number(itemForm.exits) || 0));
                      setItemForm((prev) => ({ ...prev, stock_quantity: auto }));
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Recalcular según fórmula
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Guardar Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Exit Modal */}
      {manualExitModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
                  <RotateCcw className="w-6 h-6 rotate-180" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Salida Manual Urgente</h3>
                  <p className="text-xs text-gray-400">Registre un egreso extraordinario de repuesto.</p>
                </div>
              </div>
              <button
                onClick={() => setManualExitModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmManualExit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">PRODUCTO A DESPACHAR *</label>
                <select
                  required
                  value={exitForm.itemId}
                  onChange={(e) => setExitForm({ ...exitForm, itemId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                >
                  <option value="">-- Seleccionar Repuesto del Inventario --</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku_barcode} - {item.name} (Stock: {item.stock_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">CANTIDAD A SALIR *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={exitForm.quantity}
                  onChange={(e) => setExitForm({ ...exitForm, quantity: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">TIPO DE ASIGNACIÓN *</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="assignedToType"
                      value="vehicle"
                      checked={exitForm.assignedToType === "vehicle"}
                      onChange={() => setExitForm({ ...exitForm, assignedToType: "vehicle" })}
                    />
                    <span>Asignar a Vehículo (Placa)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="assignedToType"
                      value="responsible"
                      checked={exitForm.assignedToType === "responsible"}
                      onChange={() => setExitForm({ ...exitForm, assignedToType: "responsible" })}
                    />
                    <span>Asignar a Responsable</span>
                  </label>
                </div>
              </div>

              {exitForm.assignedToType === "vehicle" ? (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">PLACA DEL VEHÍCULO *</label>
                  <select
                    value={exitForm.vehiclePlate}
                    onChange={(e) => setExitForm({ ...exitForm, vehiclePlate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm font-mono focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                  >
                    <option value="">-- Seleccionar Vehículo Registrado --</option>
                    {vehicles.map((v) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} - {v.brand} {v.model} ({v.owner_name})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      SELECCIONAR PERSONAL REGISTRADO
                    </label>
                    <select
                      value={exitForm.responsibleName}
                      onChange={(e) => setExitForm({ ...exitForm, responsibleName: titleCase(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                    >
                      <option value="">-- Seleccionar Personal Registrado --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.full_name}>
                          {t.full_name} ({t.specialty})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      O ESCRIBIR NOMBRE DEL RESPONSABLE *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Técnico Carlos Mendoza / Ing. Miguel Torres"
                      value={exitForm.responsibleName}
                      onChange={(e) => setExitForm({ ...exitForm, responsibleName: titleCase(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">MOTIVO / NOTAS</label>
                <input
                  type="text"
                  value={exitForm.reason}
                  onChange={(e) => setExitForm({ ...exitForm, reason: capitalizeFirst(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setManualExitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-reygas-red hover:bg-red-600 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Confirmar Salida Urgente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PARA MARCAR MIGRADO COMO ATENDIDO CON FECHA CONFIGURABLE */}
      {/* ========================================================================= */}
      {migratedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl shadow-black/90 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Marcar Migrado como Atendido</h3>
                  <p className="text-xs text-gray-400">
                    Establezca la fecha límite para dar por despachados los pedidos de la migración.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMigratedModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Date Selector */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Fecha Límite de Migración (Hasta inclusive)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center bg-reygas-surface rounded-xl border border-white/15 px-3.5 py-2.5">
                    <Calendar className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                    <input
                      type="date"
                      value={migratedCutoffDate}
                      onChange={(e) => setMigratedCutoffDate(e.target.value)}
                      className="bg-transparent text-white font-mono text-sm font-bold focus:outline-none w-full cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMigratedCutoffDate("2026-08-08")}
                    className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
                  >
                    08/08/2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setMigratedCutoffDate(getPeruDateString())}
                    className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
                  >
                    Hoy
                  </button>
                </div>
              </div>

              {/* Informative Stats Card */}
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-300">
                  <span>Órdenes con fecha ≤ {migratedCutoffDate}:</span>
                  <span className="font-bold text-white font-mono text-sm">{matchingMigratedOrders.length} órdenes</span>
                </div>
                <div className="flex justify-between items-center text-gray-300">
                  <span>Repuestos pendientes que se atenderán:</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">{matchingMigratedPendingItemsCount} repuestos</span>
                </div>
                <p className="text-[11px] text-gray-400 pt-1 border-t border-white/10">
                  Todos los repuestos solicitados en o antes del <strong>{migratedCutoffDate}</strong> pasarán al estado <strong className="text-emerald-400">Atendido / Despachado</strong> y se sincronizarán en Supabase.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMigratedModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  markAllMigratedWorkOrderItemsDispatched(migratedCutoffDate);
                  setMigratedModalOpen(false);
                  setWebAlert({
                    open: true,
                    type: "success",
                    title: "Migración Atendida",
                    message: `Se marcaron como atendidos todos los repuestos migrados hasta el ${migratedCutoffDate}.`,
                  });
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmar y Marcar Atendidos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PARA MARCAR TODO COMO ATENDIDO (VISTA ACTIVA) */}
      {/* ========================================================================= */}
      {attendAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-black/90 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Marcar Vista como Atendida</h3>
                  <p className="text-xs text-gray-400">Atender en bloque los pedidos pendientes.</p>
                </div>
              </div>
              <button
                onClick={() => setAttendAllModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-300">
              ¿Está seguro de marcar como <strong className="text-emerald-400">Atendidos y Listos</strong> todos los repuestos pendientes ({pendingPedidosCount} vehículos)?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAttendAllModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  markAllWorkOrderItemsDispatched();
                  setAttendAllModalOpen(false);
                  setWebAlert({
                    open: true,
                    type: "success",
                    title: "Pedidos Atendidos",
                    message: "Se marcaron todos los repuestos como despachados y listos.",
                  });
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Sí, Marcar Atendidos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARCODE PRINT MODAL (8 PER A4 SHEET, STRICT LETTER PARTITIONING) */}
      {/* ========================================================================= */}
      <BarcodePrintModal
        isOpen={barcodePrintModalOpen}
        onClose={() => setBarcodePrintModalOpen(false)}
        inventoryItems={inventoryItems}
        selectedRowIds={selectedRowIds}
      />

      {/* ========================================================================= */}
      {/* DAILY EXECUTIVE WAREHOUSE REPORT MODAL (A4 PRINT & DYNAMIC VISUALS) */}
      {/* ========================================================================= */}
      <DailyWarehouseReportModal
        isOpen={dailyReportModalOpen}
        onClose={() => setDailyReportModalOpen(false)}
      />
    </div>
  );
}
