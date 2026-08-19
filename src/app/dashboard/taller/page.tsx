"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAppStore, WorkOrderStatus } from "@/lib/store/app-store";
import {
  Wrench,
  UserCheck,
  PackagePlus,
  FileCheck2,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  X,
  Cpu,
  Search,
  Check,
  ChevronRight,
  User,
  Phone,
  AlertCircle,
  Package,
  Trash2,
  Edit3,
  ShieldCheck,
  Lock,
  Unlock,
  Calendar,
  Filter,
  Fuel,
  ChevronDown,
  ChevronUp,
  Minus,
  ShoppingCart,
  ListPlus,
  Tag,
  Coins,
  Percent,
} from "lucide-react";
import MiniDatePicker from "@/components/ui/mini-date-picker";
import DateNavigator from "@/components/ui/date-navigator";
import { getPeruDateString, formatPeruDateTime } from "@/lib/utils/date-utils";
import { TrendingUp, FileSpreadsheet } from "lucide-react";
import { capitalizeFirst } from "@/lib/utils/text-format";

const DailyWorkshopReportModal = dynamic(
  () => import("@/components/DailyWorkshopReportModal").then((m) => m.DailyWorkshopReportModal),
  { ssr: false }
);

export default function WorkshopOperationsPage() {
  const {
    workOrders,
    updateWorkOrderStatus,
    updateWorkOrder,
    assignTechnicianToOrder,
    technicians,
    vehicles,
    updateVehicle,
    inventoryItems,
    workshopServices,
    invoices,
    addWorkOrderItem,
    addMultipleWorkOrderItems,
    updateWorkOrderItem,
    removeWorkOrderItem,
    updateDiagnosticNotes,
    updateDiagnosticAndObservations,
    requestCertificationForWorkOrder,
    removeCertificationFromWorkOrder,
    setWorkOrderDiscount,
    deleteWorkOrder,
  } = useAppStore();

  // Formatea una duración en ms como "Xh Ym" / "Xd Xh Ym" / "Y min"
  const formatDuration = (ms: number): string => {
    if (!ms || ms < 0 || isNaN(ms)) return "-";
    const totalMin = Math.floor(ms / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return d + "d " + h + "h " + m + "m";
    if (h > 0) return h + "h " + m + "m";
    return m + " min";
  };

  const [timeFilter, setTimeFilter] = useState<"hoy" | "todos">("hoy");
  const [queryDate, setQueryDate] = useState<string>(getPeruDateString());
  const [searchPlate, setSearchPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ingresado");
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleteModalOrder, setDeleteModalOrder] = useState<{ id: string; plate: string; entryTime?: string } | null>(null);
  // Cards de placas colapsadas POR DEFECTO: se guardan los ids EXPANDIDOS (vacío = todas colapsadas)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Discount modal state
  const [discountModalOrder, setDiscountModalOrder] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState<number>(0);

  // Modals for actions
  const [activeOrderModal, setActiveOrderModal] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"diagnostic" | "parts" | "service" | "technician" | "certificate" | "inspection_dates">("diagnostic");

  // Form states inside modals
  const [diagnosticText, setDiagnosticText] = useState("");
  const [observationsText, setObservationsText] = useState("");
  const [quinquennialDate, setQuinquennialDate] = useState("");
  const [chipExpiryDate, setChipExpiryDate] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [selectedFuelType, setSelectedFuelType] = useState<string>("GNV");
  const [certType, setCertType] = useState<string>("Certificado Anual GNV");
  const [certPrice, setCertPrice] = useState<number>(80);

  // Requisition form state (Spare parts from inventory, services from catalog, or custom item)
  const [requisitionType, setRequisitionType] = useState<"repuesto" | "servicio" | "manual">("repuesto");
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryItems[0]?.id || "");
  const [selectedServiceId, setSelectedServiceId] = useState(workshopServices[0]?.id || "");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [partQty, setPartQty] = useState(1);
  const [partsSearchQuery, setPartsSearchQuery] = useState("");

  // Multi-item parts requisition cart in modal
  const [pendingPartsCart, setPendingPartsCart] = useState<Array<{
    id: string;
    inventory_item_id?: string;
    item_type: "repuesto";
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>>([]);

  // Multi-item SERVICES cart in modal (igual que repuestos: permite añadir VARIOS servicios)
  const [pendingServicesCart, setPendingServicesCart] = useState<Array<{
    id: string;
    item_type: "servicio";
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>>([]);

  // Edit individual item modal state
  const [editingItem, setEditingItem] = useState<{ orderId: string; item: any } | null>(null);
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemQty, setEditItemQty] = useState(1);
  const [editItemPrice, setEditItemPrice] = useState(0);

  const filteredInventoryItems = React.useMemo(() => {
    if (!partsSearchQuery.trim()) return inventoryItems;
    const q = partsSearchQuery.toLowerCase().trim();
    return inventoryItems.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
        (item.sku_barcode && item.sku_barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [inventoryItems, partsSearchQuery]);

  // Filtered Services for Certification and Workshop Services
  const certificationServices = React.useMemo(() => {
    const list = workshopServices.filter((s) => {
      const cat = (s.category || "").toLowerCase().trim();
      const name = s.name.toLowerCase();
      return (
        cat === "certificación" ||
        cat === "certificacion" ||
        name.includes("certificado") ||
        name.includes("certificacion") ||
        name.includes("anual gnv") ||
        name.includes("anual glp") ||
        name.includes("hidrostática") ||
        name.includes("hidrostatica") ||
        name.includes("chip")
      );
    });
    if (list.length > 0) return list;
    return [
      { id: "ws-cert-1", name: "Certificado Anual GNV", category: "Certificación", price: 80 },
      { id: "ws-cert-2", name: "Certificado Anual GLP", category: "Certificación", price: 80 },
      { id: "ws-cert-3", name: "Prueba Hidrostática de Cilindro GNV", category: "Certificación", price: 180 },
      { id: "ws-cert-4", name: "Desbloqueo de Chip GNV", category: "Certificación", price: 25 },
    ];
  }, [workshopServices]);

  const workshopOnlyServices = React.useMemo(() => {
    const list = workshopServices.filter((s) => {
      const cat = (s.category || "").toLowerCase().trim();
      const name = s.name.toLowerCase();
      const isCert = (
        cat === "certificación" ||
        cat === "certificacion" ||
        name.includes("certificado") ||
        name.includes("certificacion") ||
        name.includes("anual gnv") ||
        name.includes("anual glp") ||
        name.includes("hidrostática") ||
        name.includes("hidrostatica")
      );
      return !isCert;
    });
    if (list.length > 0) return list;
    return workshopServices;
  }, [workshopServices]);

  // Workshop personnel assignable to work orders: Technicians, Technical Support, Supervisors, and Certifiers
  const assignableTechnicians = React.useMemo(() => {
    return technicians.filter((t) => {
      if (t.is_active === false) return false;
      const spec = (t.specialty || "").toLowerCase().trim();
      const name = (t.full_name || "").toLowerCase().trim();

      const isWorkshopRole = (
        spec.includes("técnico") ||
        spec.includes("tecnico") ||
        spec.includes("mantenimiento") ||
        spec.includes("mecánico") ||
        spec.includes("mecanico") ||
        spec.includes("conversiones") ||
        spec.includes("conversor") ||
        spec.includes("instalador") ||
        spec.includes("soporte") ||
        spec.includes("electrónica") ||
        spec.includes("electronica") ||
        spec.includes("calibrador") ||
        spec.includes("supervisor") ||
        spec.includes("supervisora") ||
        spec.includes("certificador") ||
        spec.includes("certificadora") ||
        spec.includes("certificación") ||
        spec.includes("certificacion") ||
        spec.includes("jefe") ||
        spec.includes("5ta") ||
        spec.includes("gnv") ||
        spec.includes("glp")
      );

      const isKnownStaff = (
        name.includes("kelly") ||
        name.includes("jennifer") ||
        name.includes("jaime") ||
        name.includes("jesús") ||
        name.includes("jesus") ||
        name.includes("franco") ||
        name.includes("gianfranco") ||
        name.includes("junior") ||
        name.includes("brayan") ||
        name.includes("ruben") ||
        name.includes("anderson") ||
        name.includes("rodrigo") ||
        name.includes("jorge")
      );

      return isWorkshopRole || isKnownStaff;
    });
  }, [technicians]);

  // Pipeline Status Steps configuration
  const statusSteps: { status: WorkOrderStatus; label: string; color: string }[] = [
    { status: "ingresado", label: "1. Ingresado", color: "bg-blue-500" },
    { status: "en_diagnostico", label: "2. Diagnóstico", color: "bg-purple-500" },
    { status: "esperando_repuestos", label: "3. Repuestos", color: "bg-amber-500" },
    { status: "en_servicio", label: "4. En Servicio", color: "bg-teal-500" },
    { status: "por_cobrar", label: "5. Por Cobrar", color: "bg-emerald-500" },
  ];

  const handleOpenDiagnostic = (orderId: string, currentNotes?: string, currentObservations?: string, currentQuinquennial?: string, currentChip?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("diagnostic");
    setDiagnosticText(currentNotes || "");
    setObservationsText(currentObservations || "");
    setQuinquennialDate(currentQuinquennial || "");
    setChipExpiryDate(currentChip || "");
    const order = workOrders.find((o) => o.id === orderId);
    const vehicle = order ? vehicles.find((v) => v.plate === order.vehicle_plate) : null;
    setSelectedFuelType(vehicle?.fuel_type || "GNV");
  };

  const handleOpenInspectionDates = (orderId: string, currentQuinquennial?: string, currentChip?: string) => {
    setActiveOrderModal(orderId);
    setModalMode("inspection_dates");
    setQuinquennialDate(currentQuinquennial || "");
    setChipExpiryDate(currentChip || "");
  };

  const handleOpenParts = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("parts");
    setRequisitionType("repuesto");
    setPartsSearchQuery("");
    setSelectedInventoryId(inventoryItems[0]?.id || "");
    setCustomItemPrice(inventoryItems[0]?.unit_price || 0);
    setCustomItemName("");
    setPartQty(1);
    setPendingPartsCart([]);
  };

  const handleAddToCart = () => {
    if (requisitionType === "repuesto") {
      const item = inventoryItems.find((i) => i.id === selectedInventoryId);
      if (!item) return;
      const qty = Number(partQty) || 1;
      const price = Number(customItemPrice) || item.unit_price || 0;
      const existingIdx = pendingPartsCart.findIndex((p) => p.inventory_item_id === item.id);
      if (existingIdx >= 0) {
        setPendingPartsCart((prev) =>
          prev.map((p, idx) =>
            idx === existingIdx
              ? { ...p, quantity: p.quantity + qty, subtotal: Number(((p.quantity + qty) * price).toFixed(2)) }
              : p
          )
        );
      } else {
        setPendingPartsCart((prev) => [
          ...prev,
          {
            id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            inventory_item_id: item.id,
            item_type: "repuesto",
            description: item.name,
            quantity: qty,
            unit_price: price,
            subtotal: Number((qty * price).toFixed(2)),
          },
        ]);
      }
    } else {
      if (!customItemName.trim()) return;
      const qty = Number(partQty) || 1;
      const price = Number(customItemPrice) || 0;
      setPendingPartsCart((prev) => [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          item_type: "repuesto",
          description: customItemName.trim(),
          quantity: qty,
          unit_price: price,
          subtotal: Number((qty * price).toFixed(2)),
        },
      ]);
      setCustomItemName("");
    }
    setPartQty(1);
  };

  const handleRemoveFromCart = (cartId: string) => {
    setPendingPartsCart((prev) => prev.filter((p) => p.id !== cartId));
  };

  const handleUpdateCartQty = (cartId: string, delta: number) => {
    setPendingPartsCart((prev) =>
      prev
        .map((p) => {
          if (p.id === cartId) {
            const nextQty = p.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...p,
              quantity: nextQty,
              subtotal: Number((nextQty * p.unit_price).toFixed(2)),
            };
          }
          return p;
        })
        .filter(Boolean) as typeof prev
    );
  };

  // ===== Carrito de SERVICIOS (múltiples servicios en el modal "Agregar Servicio de Taller") =====
  const handleAddServiceToCart = () => {
    if (requisitionType === "servicio") {
      const srv = workshopServices.find((s) => s.id === selectedServiceId);
      if (!srv) return;
      const qty = Number(partQty) || 1;
      const price = Number(customItemPrice !== undefined && customItemPrice !== null ? customItemPrice : srv.price) || 0;
      const existingIdx = pendingServicesCart.findIndex((p) => p.description === srv.name && p.unit_price === price);
      if (existingIdx >= 0) {
        setPendingServicesCart((prev) =>
          prev.map((p, idx) =>
            idx === existingIdx
              ? { ...p, quantity: p.quantity + qty, subtotal: Number(((p.quantity + qty) * price).toFixed(2)) }
              : p
          )
        );
      } else {
        setPendingServicesCart((prev) => [
          ...prev,
          {
            id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item_type: "servicio",
            description: srv.name,
            quantity: qty,
            unit_price: price,
            subtotal: Number((qty * price).toFixed(2)),
          },
        ]);
      }
    } else {
      if (!customItemName.trim()) return;
      const qty = Number(partQty) || 1;
      const price = Number(customItemPrice) || 0;
      setPendingServicesCart((prev) => [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          item_type: "servicio",
          description: customItemName.trim(),
          quantity: qty,
          unit_price: price,
          subtotal: Number((qty * price).toFixed(2)),
        },
      ]);
      setCustomItemName("");
    }
    setPartQty(1);
  };

  const handleRemoveServiceFromCart = (cartId: string) => {
    setPendingServicesCart((prev) => prev.filter((p) => p.id !== cartId));
  };

  const handleUpdateServiceCartQty = (cartId: string, delta: number) => {
    setPendingServicesCart((prev) =>
      prev
        .map((p) => {
          if (p.id === cartId) {
            const nextQty = p.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...p, quantity: nextQty, subtotal: Number((nextQty * p.unit_price).toFixed(2)) };
          }
          return p;
        })
        .filter(Boolean) as typeof prev
    );
  };

  const handleOpenServices = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("service");
    setRequisitionType("servicio");
    setPendingServicesCart([]); // carrito limpio al abrir (no mezclar órdenes)
    const initialSrv = workshopOnlyServices[0] || workshopServices[0];
    setSelectedServiceId(initialSrv?.id || "");
    setCustomItemPrice(initialSrv?.price || 0);
    setCustomItemName("");
    setPartQty(1);
  };

  const handleOpenCertModal = (orderId: string) => {
    setActiveOrderModal(orderId);
    setModalMode("certificate");
    const order = workOrders.find((o) => o.id === orderId);
    if (order?.requires_certification && order.certification_type) {
      setCertType(order.certification_type);
      setCertPrice(order.certification_price || 80);
    } else {
      const initialCert = certificationServices[0] || { name: "Certificado Anual GNV", price: 80 };
      setCertType(initialCert.name);
      setCertPrice(initialCert.price);
    }
  };

  // Styled Web Notification Modal State (Replaces browser alert)
  const [webAlert, setWebAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);

  const handleSaveCertification = () => {
    if (activeOrderModal) {
      requestCertificationForWorkOrder(activeOrderModal, certType as any, Number(certPrice));
      setWebAlert({
        open: true,
        title: "¡Certificación Registrada!",
        message: `La certificación "${certType}" (S/ ${Number(certPrice).toFixed(2)}) fue asignada a la OT y actualizada en el flujo de cobro en Caja.`
      });
      setActiveOrderModal(null);
    }
  };

  const handleRemoveCertification = (orderId: string) => {
    removeCertificationFromWorkOrder(orderId);
    setWebAlert({
      open: true,
      title: "Certificación Removida",
      message: "Se ha eliminado el servicio de certificación de esta orden de trabajo y del flujo de cobro en Caja."
    });
  };

  const handleOpenEditItem = (orderId: string, item: any) => {
    setEditingItem({ orderId, item });
    setEditItemDescription(item.description || "");
    setEditItemQty(item.quantity || 1);
    setEditItemPrice(item.unit_price || 0);
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;
    updateWorkOrderItem(editingItem.orderId, editingItem.item.id, {
      description: editItemDescription.trim() || editingItem.item.description,
      quantity: Number(editItemQty) || 1,
      unit_price: Number(editItemPrice) || 0,
    });
    setEditingItem(null);
    setWebAlert({
      open: true,
      title: "Ítem Actualizado",
      message: "Los datos del repuesto o servicio fueron actualizados correctamente.",
    });
  };

  const handleOpenDiscountModal = (orderId: string, currentDiscount?: number) => {
    setDiscountModalOrder(orderId);
    setDiscountInput(currentDiscount || 0);
  };

  const handleSaveDiscount = () => {
    if (discountModalOrder) {
      const amount = Math.max(0, Number(discountInput) || 0);
      setWorkOrderDiscount(discountModalOrder, amount);
      setWebAlert({
        open: true,
        title: amount > 0 ? "¡Descuento Aplicado!" : "Descuento Removido",
        message: amount > 0
          ? `Se ha asignado un descuento de S/ ${amount.toFixed(2)} a la orden. El monto a cobrar se actualizará en Taller y Caja.`
          : "Se ha establecido el descuento en S/ 0.00.",
      });
      setDiscountModalOrder(null);
    }
  };

  const handleSaveDiagnostic = () => {
    if (activeOrderModal) {
      updateDiagnosticAndObservations(activeOrderModal, diagnosticText, observationsText);
      if (quinquennialDate || chipExpiryDate) {
        updateWorkOrder(activeOrderModal, {
          quinquennial_date: quinquennialDate,
          chip_expiry_date: chipExpiryDate,
        });
      }
      const order = workOrders.find((o) => o.id === activeOrderModal);
      if (order && order.vehicle_plate && selectedFuelType) {
        updateVehicle(order.vehicle_plate, { fuel_type: selectedFuelType as any });
      }
      setActiveOrderModal(null);
    }
  };

  const handleSaveInspectionDates = () => {
    if (activeOrderModal) {
      updateWorkOrder(activeOrderModal, {
        quinquennial_date: quinquennialDate,
        chip_expiry_date: chipExpiryDate,
      });
      setWebAlert({
        open: true,
        title: "¡Fechas de Inspección Guardadas!",
        message: `Fecha Quinquenal (${quinquennialDate || "Pendiente"}) y Chip Anual (${chipExpiryDate || "Pendiente"}) registradas con éxito. Se guardarán en la Tabla Registro Taller al confirmar el cobro en Caja.`
      });
      setActiveOrderModal(null);
    }
  };

  const handleAddRequisition = () => {
    if (!activeOrderModal) return;

    const targetOrderId = activeOrderModal;

    if (modalMode === "parts") {
      if (pendingPartsCart.length > 0) {
        addMultipleWorkOrderItems(
          targetOrderId,
          pendingPartsCart.map((p) => ({
            inventory_item_id: p.inventory_item_id,
            item_type: "repuesto",
            description: p.description,
            quantity: p.quantity,
            unit_price: p.unit_price,
          }))
        );
        updateWorkOrderStatus(targetOrderId, "esperando_repuestos");
        setStatusFilter("esperando_repuestos");
        setPendingPartsCart([]);
        setWebAlert({
          open: true,
          title: "¡Repuestos Solicitados!",
          message: "Los repuestos fueron registrados y enviados a Almacén. La vista se ha trasladado automáticamente a '3. Esperando Repuestos'.",
        });
      } else {
        // Fallback for single direct item if user did not press "Añadir a la lista"
        if (requisitionType === "repuesto") {
          const item = inventoryItems.find((i) => i.id === selectedInventoryId);
          if (item) {
            addWorkOrderItem(targetOrderId, {
              inventory_item_id: item.id,
              item_type: "repuesto",
              description: item.name,
              quantity: Number(partQty) || 1,
              unit_price: Number(customItemPrice) || item.unit_price || 0,
            });
            updateWorkOrderStatus(targetOrderId, "esperando_repuestos");
            setStatusFilter("esperando_repuestos");
            setWebAlert({
              open: true,
              title: "¡Repuesto Solicitado!",
              message: `El repuesto "${item.name}" fue enviado a Almacén. La vista se ha trasladado a '3. Esperando Repuestos'.`,
            });
          }
        } else {
          if (!customItemName.trim()) return;
          addWorkOrderItem(targetOrderId, {
            item_type: "repuesto",
            description: customItemName.trim(),
            quantity: Number(partQty) || 1,
            unit_price: Number(customItemPrice) || 0,
          });
          updateWorkOrderStatus(targetOrderId, "esperando_repuestos");
          setStatusFilter("esperando_repuestos");
          setWebAlert({
            open: true,
            title: "¡Repuesto Manual Solicitado!",
            message: `El repuesto "${customItemName.trim()}" fue agregado a la OT. La vista se ha trasladado a '3. Esperando Repuestos'.`,
          });
        }
      }
    } else if (modalMode === "service") {
      // Si hay servicios en el carrito, se agregan TODOS a la orden (multi-servicio)
      if (pendingServicesCart.length > 0) {
        addMultipleWorkOrderItems(
          targetOrderId,
          pendingServicesCart.map((p) => ({
            item_type: "servicio" as const,
            description: p.description,
            quantity: p.quantity,
            unit_price: p.unit_price,
          }))
        );
        updateWorkOrderStatus(targetOrderId, "en_servicio");
        setStatusFilter("en_servicio");
        setPendingServicesCart([]);
        setWebAlert({
          open: true,
          title: "¡Servicios Asignados!",
          message: `${pendingServicesCart.length} servicio(s) asignados a la orden. La vista se ha trasladado a '4. En Servicio'.`,
        });
      } else if (requisitionType === "servicio") {
        const srv = workshopServices.find((s) => s.id === selectedServiceId);
        if (srv) {
          addWorkOrderItem(targetOrderId, {
            item_type: "servicio",
            description: srv.name,
            quantity: Number(partQty) || 1,
            unit_price: Number(customItemPrice !== undefined && customItemPrice !== null ? customItemPrice : srv.price),
          });
          updateWorkOrderStatus(targetOrderId, "en_servicio");
          setStatusFilter("en_servicio");
          setWebAlert({
            open: true,
            title: "¡Servicio Asignado!",
            message: `El servicio "${srv.name}" fue asignado a la orden. La vista se ha trasladado a '4. En Servicio'.`,
          });
        }
      } else {
        if (!customItemName.trim()) return;
        addWorkOrderItem(targetOrderId, {
          item_type: "servicio",
          description: customItemName.trim(),
          quantity: Number(partQty) || 1,
          unit_price: Number(customItemPrice) || 0,
        });
        updateWorkOrderStatus(targetOrderId, "en_servicio");
        setStatusFilter("en_servicio");
        setWebAlert({
          open: true,
          title: "¡Servicio Personalizado Asignado!",
          message: `El servicio "${customItemName.trim()}" fue asignado a la orden. La vista se ha trasladado a '4. En Servicio'.`,
        });
      }
    }
    setActiveOrderModal(null);
  };

  // Orders filtered by date
  const dateScopedOrders = React.useMemo(() => {
    return workOrders.filter((wo) => {
      // Las filas "GASTO" (egresos de caja) solo viven en la Tabla Maestra, no en el Taller.
      if ((wo.vehicle_plate || "").toUpperCase() === "GASTO") return false;
      if (timeFilter === "todos") return true;
      const orderDateStr = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      return orderDateStr === queryDate;
    });
  }, [workOrders, timeFilter, queryDate]);

  // Overall & Context counts
  const counts = React.useMemo(() => {
    const todayTarget = queryDate || getPeruDateString();
    const todayOrders = workOrders.filter((wo) => {
      const d = wo.entry_time ? wo.entry_time.slice(0, 10) : "";
      return d === todayTarget;
    });

    const activeList = timeFilter === "hoy" ? todayOrders : workOrders;

    return {
      today: todayOrders.length,
      all: workOrders.length,
      currentTotal: activeList.length,
      ingresado: activeList.filter((wo) => wo.status === "ingresado").length,
      en_diagnostico: activeList.filter((wo) => wo.status === "en_diagnostico").length,
      esperando_repuestos: activeList.filter((wo) => wo.status === "esperando_repuestos").length,
      en_servicio: activeList.filter((wo) => wo.status === "en_servicio").length,
      por_cobrar: activeList.filter((wo) => wo.status === "por_cobrar").length,
    };
  }, [workOrders, timeFilter, queryDate]);

  const filteredOrders = React.useMemo(() => {
    return dateScopedOrders
      .filter((wo) => {
        const matchPlate = searchPlate ? wo.vehicle_plate.toUpperCase().includes(searchPlate.toUpperCase().trim()) : true;
        const matchStatus = statusFilter === "todos" ? true : wo.status === statusFilter;
        return matchPlate && matchStatus;
      })
      .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());
  }, [dateScopedOrders, searchPlate, statusFilter]);

  const displayedOrders = filteredOrders.slice(0, visibleLimit);

  const toggleCollapse = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const collapseAll = () => {
    setExpandedOrders(new Set());
  };
  const expandAll = () => {
    setExpandedOrders(new Set(filteredOrders.map((o) => o.id)));
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estación de Taller & Bahías de Trabajo</h1>
            <p className="text-xs text-gray-400">
              Vista interactiva por Cards Horizontales ordenadas por hora de llegada, con Pipeline interactivo de estado.
            </p>
          </div>
        </div>

        {/* Header Action: Open Executive Report Modal */}
        <button
          type="button"
          onClick={() => setReportModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 active:scale-95 transition-all shrink-0"
        >
          <TrendingUp className="w-4 h-4 text-amber-200" />
          <span>Informe Diario a Gerencia</span>
        </button>
      </div>

      {/* Date & Search Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-reygas-dark p-3.5 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Selector Tabs: Del Día / Hoy vs Todos */}
          <div className="flex items-center gap-1 bg-reygas-surface p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => { setTimeFilter("hoy"); setVisibleLimit(30); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${timeFilter === "hoy"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 font-black scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Del Día / Hoy ({counts.today})</span>
            </button>

            <button
              onClick={() => { setTimeFilter("todos"); setVisibleLimit(30); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${timeFilter === "todos"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-black scale-[1.02]"
                : "text-gray-400 hover:text-white"
                }`}
            >
              <span>Todos / Histórico ({counts.all})</span>
            </button>
          </div>

          {/* Navegador de Fecha Universal (estándar ReyGas): Día Anterior | fecha | Día Siguiente | Hoy */}
          <DateNavigator
            value={queryDate}
            onChange={(newDate) => {
              setQueryDate(newDate);
              setTimeFilter("hoy");
              setVisibleLimit(30);
            }}
          />
        </div>

        {/* Search & Dropdown Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchPlate}
              onChange={(e) => { setSearchPlate(e.target.value.toUpperCase()); setVisibleLimit(30); }}
              className="w-full sm:w-48 pl-9 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white uppercase focus:border-amber-400 font-bold"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setVisibleLimit(30); }}
            className="px-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs text-white focus:border-amber-400 font-bold"
          >
            <option value="ingresado">1. Ingresados ({counts.ingresado})</option>
            <option value="en_diagnostico">2. En Diagnóstico ({counts.en_diagnostico})</option>
            <option value="esperando_repuestos">3. Esperando Repuestos ({counts.esperando_repuestos})</option>
            <option value="en_servicio">4. En Servicio / Bahía ({counts.en_servicio})</option>
            <option value="por_cobrar">5. Por Cobrar ({counts.por_cobrar})</option>
            <option value="todos">Todos los Estados ({counts.currentTotal})</option>
          </select>
        </div>
      </div>

      {/* Interactive Status Filter Pills (Clickable buttons matching image) */}
      <div className="flex flex-wrap items-center gap-2 bg-reygas-dark/70 p-2.5 rounded-2xl border border-white/5 text-xs font-bold">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-extrabold flex items-center gap-1.5 px-2">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>Filtrar Estado:</span>
        </span>

        {/* 1. Ingresados (Principal / Default) */}
        <button
          onClick={() => { setStatusFilter("ingresado"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "ingresado"
            ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30 font-black scale-105"
            : "bg-blue-950/30 text-blue-300 border-blue-500/20 hover:bg-blue-900/40"
            }`}
        >
          1. Ingresados ({counts.ingresado})
        </button>

        {/* 2. En Diagnóstico */}
        <button
          onClick={() => { setStatusFilter("en_diagnostico"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "en_diagnostico"
            ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30 font-black scale-105"
            : "bg-purple-950/30 text-purple-300 border-purple-500/20 hover:bg-purple-900/40"
            }`}
        >
          2. En Diagnóstico ({counts.en_diagnostico})
        </button>

        {/* 3. Esperando Repuestos */}
        <button
          onClick={() => { setStatusFilter("esperando_repuestos"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "esperando_repuestos"
            ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30 font-black scale-105"
            : "bg-amber-950/30 text-amber-300 border-amber-500/20 hover:bg-amber-900/40"
            }`}
        >
          3. Esperando Repuestos ({counts.esperando_repuestos})
        </button>

        {/* 4. En Servicio / Bahía */}
        <button
          onClick={() => { setStatusFilter("en_servicio"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "en_servicio"
            ? "bg-teal-600 text-white border-teal-400 shadow-lg shadow-teal-600/30 font-black scale-105"
            : "bg-teal-950/30 text-teal-300 border-teal-500/20 hover:bg-teal-900/40"
            }`}
        >
          4. En Servicio / Bahía ({counts.en_servicio})
        </button>

        {/* 5. Por Cobrar */}
        <button
          onClick={() => { setStatusFilter("por_cobrar"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "por_cobrar"
            ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 font-black scale-105"
            : "bg-emerald-950/30 text-emerald-300 border-emerald-500/20 hover:bg-emerald-900/40"
            }`}
        >
          5. Por Cobrar ({counts.por_cobrar})
        </button>

        {/* 6. Todos los Estados (Al final) */}
        <button
          onClick={() => { setStatusFilter("todos"); setVisibleLimit(30); }}
          className={`px-3 py-1.5 rounded-xl transition-all border ${statusFilter === "todos"
            ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-105"
            : "bg-reygas-surface/60 text-gray-400 border-white/10 hover:text-white hover:border-white/20"
            }`}
        >
          Todos los Estados ({counts.currentTotal})
        </button>
      </div>

      {/* Collapse / Expand All Controls */}
      <div className="flex items-center justify-between gap-3 bg-reygas-dark/70 p-2.5 rounded-2xl border border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-extrabold flex items-center gap-1.5 px-2">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>Vista de Tarjetas:</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
            Expandir todas
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            Colapsar todas
          </button>
        </div>
      </div>

      {/* Horizontal Cards List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-400 space-y-3 rounded-2xl border border-white/10">
            <Wrench className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">No hay órdenes de trabajo que coincidan con los filtros seleccionados.</p>
            {timeFilter === "hoy" && (
              <button
                onClick={() => setTimeFilter("todos")}
                className="px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs font-bold rounded-xl border border-blue-500/30 transition-colors"
              >
                Ver todos los vehículos en el histórico ({counts.all})
              </button>
            )}
          </div>
        ) : (
          displayedOrders.map((wo) => {
            const vehicle = vehicles.find((v) => v.plate === wo.vehicle_plate);
            const tech = technicians.find((t) => t.id === wo.assigned_technician_id);
            const invoice = invoices.find((i) => i.work_order_id === wo.id);
            const isExplicitPending = wo.status === "por_cobrar" || wo.status === "pendiente_pago" || invoice?.payment_status === "pendiente";
            const isPaid = !isExplicitPending && (wo.status === "pagado_autorizado" || wo.status === "finalizado" || invoice?.payment_status === "pagado");
            const isLocked = isPaid && !wo.allow_modifications;

            // Current step index in pipeline
            const currentStepIdx = statusSteps.findIndex((s) => s.status === wo.status);
            const currentStep = statusSteps[currentStepIdx];
            const isCollapsed = !expandedOrders.has(wo.id);
            const cardTotal = Math.max(
              0,
              wo.items.reduce((acc, i) => acc + i.subtotal, 0) +
              (wo.requires_certification ? wo.certification_price || 0 : 0) -
              (wo.discount_amount || 0)
            );

            // Pago parcial sobre esta orden: muestra abonado y saldo por pagar
            const payHistory = Array.isArray(invoice?.payment_history) ? invoice.payment_history : [];
            const paidSoFar = payHistory.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
            const creditAmt = Number(invoice?.credit_amount) || 0;
            const hasPartialPayment = paidSoFar > 0 && creditAmt > 0;

            // Tiempo del servicio: desde el ingreso a Taller hasta que terminó (por cobrar / pagado)
            const entryMs = wo.entry_time ? new Date(wo.entry_time).getTime() : 0;
            const finishMs = wo.completion_time ? new Date(wo.completion_time).getTime() : 0;
            const serviceFinished = finishMs > 0;
            const endForElapsed = serviceFinished ? finishMs : (entryMs ? Date.now() : 0);
            const elapsedMs = entryMs && endForElapsed ? Math.max(0, endForElapsed - entryMs) : 0;
            const serviceDuration = entryMs ? formatDuration(elapsedMs) : "-";

            return (
              <div
                key={wo.id}
                className={`glass-panel p-6 rounded-2xl border transition-all space-y-6 ${isLocked
                  ? "border-emerald-500/40 bg-emerald-950/10"
                  : wo.allow_modifications && isPaid
                    ? "border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-500/10"
                    : "border-white/10 hover:border-amber-500/30"
                  }`}
              >
                {/* Card Collapsible Header */}
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer select-none transition-all ${isCollapsed
                    ? "border-white/15 bg-reygas-dark/60"
                    : "border-amber-500/30 bg-reygas-dark/40 hover:border-amber-400/50"
                    }`}
                  onClick={() => toggleCollapse(wo.id)}
                  title={isCollapsed ? "Expandir tarjeta" : "Colapsar tarjeta"}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-black text-xl text-white tracking-widest bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow shrink-0">
                      {wo.vehicle_plate}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase text-black ${currentStep?.color || "bg-white/20"}`}>
                          {currentStep?.label || wo.status}
                        </span>
                        <span className="text-xs text-gray-400 font-semibold truncate">
                          {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year})` : "Vehículo"}
                        </span>
                      </div>
                      {isCollapsed && (
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">
                          OT #{wo.id} • {wo.items.length} ítem(s) • {vehicle?.owner_name || "Cliente Garita"}
                          {hasPartialPayment && (
                            <>
                              • <span className="text-amber-400 font-bold">Pago parcial · Saldo S/ {creditAmt.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline text-[11px] font-bold uppercase text-gray-400">
                      {isCollapsed ? "Ver detalle" : "Ocultar detalle"}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-amber-500/30">
                      S/ {cardTotal.toFixed(2)}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-amber-400" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    {/* Locked Banner if Paid */}
                    {isLocked && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            🔒 ORDEN PAGADA EN CAJA - MODIFICACIONES BLOQUEADAS EN TALLER
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-200 font-normal">
                          (Para modificar, desmarcar pago o pulsar "Permitir Modificación" en la pestaña Caja & Facturación)
                        </span>
                      </div>
                    )}

                    {/* Unlocked Notice if Paid with Modification Enabled */}
                    {!isLocked && isPaid && wo.allow_modifications && (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            🔓 MODIFICACIÓN HABILITADA DESDE CAJA (ORDEN EDITABLE)
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-200 font-normal">
                          Puede modificar repuestos, servicios y diagnóstico libremente.
                        </span>
                      </div>
                    )}

                    {/* Pago Parcial: abonado + saldo por pagar (cuando la orden tiene abonos) */}
                    {hasPartialPayment && (
                      <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl text-xs text-rose-200 font-semibold flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-black uppercase text-[10px] border border-rose-500/40">
                          🧾 Pago Parcial
                        </span>
                        <span>
                          Abonado: <strong className="text-emerald-300 font-mono">S/ {paidSoFar.toFixed(2)}</strong>
                        </span>
                        <span className="text-rose-400">•</span>
                        <span>
                          Saldo por pagar: <strong className="text-amber-300 font-mono">S/ {creditAmt.toFixed(2)}</strong>
                        </span>
                        <span className="text-[10px] text-rose-300/70">
                          (Completar en Caja → Abonar Saldo o Confirmar Pago)
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column: Vehicle Info */}
                      <div className="lg:col-span-3 space-y-2 border-b lg:border-b-0 lg:border-r border-white/10 pb-4 lg:pb-0 lg:pr-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-2xl text-white tracking-widest bg-reygas-surface px-3 py-1 rounded-lg border border-white/10 shadow">
                              {wo.vehicle_plate}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeleteModalOrder({ id: wo.id, plate: wo.vehicle_plate, entryTime: wo.entry_time })}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-gray-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all cursor-pointer shadow"
                              title="Borrar registro de ingreso (placa/fecha equivocada) — se elimina la OT y su factura"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase">
                            OT #{wo.id}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year})` : "Vehículo"}
                          </h3>
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="text-xs text-gray-400 font-semibold">
                              {vehicle?.color || "Color no especificado"}
                            </span>
                            <span className="text-gray-600">•</span>
                            {/* Selector interactivo de tipo de combustible */}
                            <div className="relative inline-flex items-center">
                              <select
                                value={vehicle?.fuel_type || "GNV"}
                                disabled={isLocked}
                                onChange={(e) => {
                                  updateVehicle(wo.vehicle_plate, { fuel_type: e.target.value as any });
                                }}
                                className={`font-extrabold text-xs pl-2.5 pr-6 py-1 rounded-lg border focus:outline-none transition-all shadow-sm appearance-none ${isLocked
                                  ? "bg-black/30 border-gray-700 text-gray-400 opacity-60 cursor-not-allowed"
                                  : "bg-black/60 hover:bg-black/90 border-amber-500/40 hover:border-amber-400 text-amber-300 cursor-pointer active:scale-95 shadow-amber-500/10"
                                  }`}
                                title="Cambiar tipo de combustible / sistema"
                              >
                                <option value="GNV" className="bg-gray-900 text-white font-bold">⛽ GNV</option>
                                <option value="GLP" className="bg-gray-900 text-white font-bold">⛽ GLP</option>
                                <option value="Gasolina" className="bg-gray-900 text-white font-bold">⛽ Gasolina</option>
                                <option value="Bifuel" className="bg-gray-900 text-white font-bold">⛽ Bifuel</option>
                              </select>
                              <ChevronDown className="w-3 h-3 text-amber-400 absolute right-1.5 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 space-y-1 text-xs text-gray-300">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Llegada: {formatPeruDateTime(wo.entry_time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-200 font-medium">{vehicle?.owner_name || "Cliente Garita"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Phone className="w-3.5 h-3.5 text-gray-500" />
                            <span>{vehicle?.owner_phone || "Sin teléfono"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Center Column: Interactive Progress Stepper, Description, DIAGNOSTICO & MECANICO ASIGNADO */}
                      <div className="lg:col-span-5 space-y-4 px-0 lg:px-2">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Estado Actual y Flujo de Servicio:
                          </span>
                          {/* Stepper Pipeline */}
                          <div className="grid grid-cols-5 gap-1.5 pt-1">
                            {statusSteps.map((step, idx) => {
                              const isCurrent = wo.status === step.status;
                              const isPassed = idx <= currentStepIdx;

                              return (
                                <button
                                  key={step.status}
                                  disabled={isLocked}
                                  onClick={() => updateWorkOrderStatus(wo.id, step.status)}
                                  className={`py-2 px-1.5 rounded-lg text-[10px] font-extrabold transition-all text-center flex flex-col items-center justify-center gap-1 border ${isCurrent
                                    ? `${step.color} text-black border-white shadow-lg`
                                    : isPassed
                                      ? "bg-reygas-surface text-gray-200 border-white/20 hover:border-amber-400"
                                      : "bg-reygas-dark/60 text-gray-500 border-white/5 hover:border-white/20"
                                    } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  <span>{step.label}</span>
                                  {isCurrent && <Check className="w-3 h-3 text-black stroke-[3]" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Tiempo del servicio: ingreso a Taller -> terminado (por cobrar / pagado) */}
                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-xs text-cyan-200 space-y-1.5">
                          <span className="font-bold text-cyan-300 block text-[11px] uppercase">
                            ⏱️ Tiempo del Servicio:
                          </span>
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                            <span>Ingreso: <strong className="font-mono">{wo.entry_time ? formatPeruDateTime(wo.entry_time) : "-"}</strong></span>
                            <span>Terminado: <strong className="font-mono">{serviceFinished ? formatPeruDateTime(wo.completion_time || "") : (isExplicitPending || isPaid ? "-" : "⏳ En proceso")}</strong></span>
                          </div>
                          <div className="flex items-center justify-between border-t border-cyan-500/20 pt-1">
                            <span>Duración del técnico:</span>
                            <strong className="text-cyan-300 font-black text-sm">{serviceFinished ? serviceDuration : (entryMs ? "En proceso (" + serviceDuration + ")" : "-")}</strong>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-reygas-dark/80 border border-white/5 text-xs text-gray-300">
                          <span className="font-bold text-amber-400 block text-[11px] uppercase">
                            Reporte / Motivo de Ingreso:
                          </span>
                          <p className="mt-0.5 line-clamp-2">{wo.problem_description}</p>
                        </div>

                        {/* Diagnostic Notes & Observations */}
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                            <span className="font-bold text-purple-400 block text-[11px] uppercase flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                                <span>Diagnóstico Técnico ECU:</span>
                              </span>
                              {!isLocked && (
                                <button
                                  onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations)}
                                  className="text-[10px] text-purple-300 hover:text-white underline font-normal"
                                >
                                  {wo.diagnostic_notes ? "Editar Diagnóstico" : "+ Añadir Diagnóstico"}
                                </button>
                              )}
                            </span>
                            <p className="mt-0.5 text-xs italic">
                              {wo.diagnostic_notes || "Pendiente de diagnóstico computarizado."}
                            </p>
                          </div>

                          {/* Observación / Motivo de demora (siempre visible para registrar demoras) */}
                          <div className={`p-3 rounded-xl border text-xs space-y-1 ${wo.observations
                            ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                            : "bg-black/30 border-dashed border-white/15 text-gray-400"
                            }`}>
                            <span className="font-bold block text-[11px] uppercase flex items-center justify-between">
                              <span>📝 Observación / Motivo de demora:</span>
                              {!isLocked && (
                                <button
                                  onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations)}
                                  className="text-[10px] underline font-normal"
                                >
                                  {wo.observations ? "Editar" : "+ Añadir"}
                                </button>
                              )}
                            </span>
                            {wo.observations ? (
                              <p className="mt-0.5 text-xs">{wo.observations}</p>
                            ) : (
                              <p className="mt-0.5 text-[11px] italic">
                                Sin observaciones. (Indique aquí el motivo de demora del servicio, si lo hubiera)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* REQUERIMIENTO #2: EL MECANICO ASIGNADO DEBAJO DEL DIAGNOSTICO */}
                        <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase text-amber-400">
                            👨‍🔧 Mecánico Asignado Responsable:
                          </label>
                          <div className="relative">
                            <select
                              disabled={isLocked}
                              value={wo.assigned_technician_id || ""}
                              onChange={(e) => assignTechnicianToOrder(wo.id, e.target.value)}
                              className={`w-full pl-8 pr-3 py-2 bg-reygas-surface border border-white/10 rounded-xl text-xs font-semibold text-white focus:border-amber-400 ${isLocked ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                            >
                              <option value="">-- Sin Técnico Asignado --</option>
                              {assignableTechnicians.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.full_name} ({t.specialty || "Técnico Especialista"})
                                </option>
                              ))}
                            </select>
                            <UserCheck className="w-4 h-4 text-amber-400 absolute left-2.5 top-2.5" />
                          </div>
                        </div>

                        {/* FECHAS DE INSPECCIÓN: QUINQUENAL & CHIP ANUAL */}
                        <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-purple-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              <span>Fechas de Inspección (Quinquenal / Chip)</span>
                            </span>
                            {!isLocked && (
                              <button
                                onClick={() => handleOpenInspectionDates(wo.id, wo.quinquennial_date, wo.chip_expiry_date)}
                                className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1 transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Registrar / Editar</span>
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-black/40 border border-purple-500/20">
                              <span className="text-[10px] text-gray-400 block font-semibold">Fecha Quinquenal:</span>
                              <span className="font-mono font-bold text-purple-300">
                                {wo.quinquennial_date || <span className="text-gray-500 italic text-[11px]">No registrada</span>}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/20">
                              <span className="text-[10px] text-gray-400 block font-semibold">Fecha Chip Anual:</span>
                              <span className="font-mono font-bold text-cyan-300">
                                {wo.chip_expiry_date || <span className="text-gray-500 italic text-[11px]">No registrada</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: REPUESTOS Y SERVICIOS SOLICITADOS, DESCUENTOS & CERTIFICACION */}
                      <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-4">
                        {/* Action buttons toolbar: 6 distinct, separate actions */}
                        {!isLocked && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => handleOpenDiagnostic(wo.id, wo.diagnostic_notes, wo.observations, wo.quinquennial_date, wo.chip_expiry_date)}
                              className="py-2 px-2 bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-purple-500/30 transition-colors shadow"
                            >
                              <Cpu className="w-3.5 h-3.5" />
                              <span>Diagnóstico</span>
                            </button>

                            <button
                              onClick={() => handleOpenInspectionDates(wo.id, wo.quinquennial_date, wo.chip_expiry_date)}
                              className="py-2 px-2 bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-purple-400/40 transition-colors shadow"
                            >
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              <span>Fechas Chip/5ta</span>
                            </button>

                            <button
                              onClick={() => handleOpenParts(wo.id)}
                              className="py-2 px-2 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-amber-500/30 transition-colors shadow"
                            >
                              <Package className="w-3.5 h-3.5 text-amber-400" />
                              <span>Pedir Repuesto</span>
                            </button>

                            <button
                              onClick={() => handleOpenServices(wo.id)}
                              className="py-2 px-2 bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-indigo-500/30 transition-colors shadow"
                            >
                              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Agregar Servicio</span>
                            </button>

                            <button
                              onClick={() => handleOpenDiscountModal(wo.id, wo.discount_amount)}
                              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors shadow ${(wo.discount_amount && wo.discount_amount > 0)
                                ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                                : "bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 border-emerald-500/30"
                                }`}
                            >
                              <Tag className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{(wo.discount_amount && wo.discount_amount > 0) ? `Desc. -S/ ${wo.discount_amount.toFixed(2)}` : "+ Descuento"}</span>
                            </button>

                            <button
                              onClick={() => handleOpenCertModal(wo.id)}
                              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors shadow ${wo.requires_certification
                                ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/50"
                                : "bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 border-cyan-500/30"
                                }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{wo.requires_certification ? "Certificado" : "+ Certificación"}</span>
                            </button>
                          </div>
                        )}

                        {/* REQUERIMIENTO: SECCION DE REPUESTOS Y SERVICIOS SOLICITADOS */}
                        <div className="space-y-2 p-3 bg-reygas-dark/60 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-amber-400">
                              Repuestos & Servicios Solicitados ({wo.items.length}):
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              Subtotal: S/ {wo.items.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)}
                            </span>
                          </div>

                          {wo.items.length === 0 ? (
                            <p className="text-[11px] text-gray-500 italic">No hay repuestos o servicios solicitados aún.</p>
                          ) : (
                            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                              {wo.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2 rounded-lg bg-reygas-dark/90 border border-white/5 flex items-center justify-between text-xs gap-2"
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {item.item_type === "servicio" ? (
                                      <Wrench className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    ) : (
                                      <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    )}
                                    <span className="text-white font-semibold truncate">{item.description}</span>
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                      x{item.quantity}
                                    </span>
                                    {item.dispatched ? (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase">
                                        ✓ Entregado
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">
                                        ⏳ Pendiente
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-gray-300 text-xs">S/ {item.subtotal.toFixed(2)}</span>
                                    {!isLocked && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditItem(wo.id, item)}
                                          className="text-gray-400 hover:text-amber-400 p-1 hover:bg-white/10 rounded transition-colors"
                                          title="Editar cantidad o precio de este ítem"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeWorkOrderItem(wo.id, item.id)}
                                          className="text-gray-400 hover:text-red-400 p-1 hover:bg-white/10 rounded transition-colors"
                                          title="Eliminar este ítem de la orden"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SERVICIO DE CERTIFICADO DEBAJO DE REPUESTOS SOLICITADOS */}
                        {wo.requires_certification ? (
                          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                                <span>Servicio de Certificación</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-cyan-200 font-bold bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
                                  S/ {(wo.certification_price || 0).toFixed(2)}
                                </span>
                                {!isLocked && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCertModal(wo.id)}
                                      className="text-gray-400 hover:text-cyan-300 p-1 hover:bg-cyan-900/40 rounded transition-colors"
                                      title="Editar tipo o precio de certificación"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCertification(wo.id)}
                                      className="text-gray-400 hover:text-red-400 p-1 hover:bg-red-900/40 rounded transition-colors"
                                      title="Eliminar / Quitar certificación"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-cyan-200">
                              Tipo: <strong>{wo.certification_type}</strong> • Estado:{" "}
                              {wo.certification_issued ? "✅ Emitido en Certificaciones" : "⏳ Notificado y Pendiente"}
                            </p>
                          </div>
                        ) : (
                          !isLocked && (
                            <button
                              onClick={() => handleOpenCertModal(wo.id)}
                              className="w-full py-2 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                              <span>+ Solicitar Certificación desde Catálogo de Servicios</span>
                            </button>
                          )
                        )}

                        {/* RESUMEN FINANCIERO Y TOTAL CON DESCUENTO */}
                        {(() => {
                          const itemsTotal = wo.items.reduce((acc, i) => acc + i.subtotal, 0);
                          const certFee = wo.requires_certification ? (wo.certification_price || 0) : 0;
                          const discountVal = wo.discount_amount || 0;
                          const grandTotal = Math.max(0, itemsTotal + certFee - discountVal);

                          return (
                            <div className="p-3 rounded-xl bg-reygas-dark/90 border border-white/10 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-gray-400">
                                <span>Subtotal Repuestos & Servicios:</span>
                                <span className="font-mono font-bold text-gray-200">S/ {itemsTotal.toFixed(2)}</span>
                              </div>

                              {wo.requires_certification && (
                                <div className="flex items-center justify-between text-cyan-300">
                                  <span>+ Certificación ({wo.certification_type || "Anual"}):</span>
                                  <span className="font-mono font-bold">S/ {certFee.toFixed(2)}</span>
                                </div>
                              )}

                              {discountVal > 0 ? (
                                <div className="flex items-center justify-between text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/30">
                                  <span className="flex items-center gap-1.5 font-bold">
                                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Descuento Aplicado:</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-emerald-300">- S/ {discountVal.toFixed(2)}</span>
                                    {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDiscountModal(wo.id, discountVal)}
                                        className="p-1 hover:bg-emerald-900/60 rounded text-emerald-300 transition-colors"
                                        title="Editar Monto de Descuento"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                !isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDiscountModal(wo.id, 0)}
                                    className="w-full py-1.5 text-center text-xs font-bold text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/40 rounded-lg border border-emerald-500/20 flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    <Tag className="w-3.5 h-3.5" />
                                    <span>+ Poner Descuento como Monto (S/)</span>
                                  </button>
                                )
                              )}

                              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm font-black text-white">
                                <span className="uppercase text-xs tracking-wider text-amber-400">Total a Liquidar:</span>
                                <span className="font-mono text-base text-amber-300">
                                  S/ {grandTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}

        {displayedOrders.length < filteredOrders.length && (
          <div className="text-center pt-4">
            <button
              onClick={() => setVisibleLimit((prev) => prev + 30)}
              className="px-6 py-2.5 bg-reygas-surface border border-white/10 hover:border-amber-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Cargar más vehículos ({displayedOrders.length} de {filteredOrders.length})
            </button>
          </div>
        )}
      </div>

      {/* Modals for Diagnostic, Parts Requisition, Workshop Services and Certification */}
      {activeOrderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalMode === "diagnostic" && (
                  <>
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <span>Diagnóstico Técnico & Observaciones</span>
                  </>
                )}
                {modalMode === "inspection_dates" && (
                  <>
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span>Fechas de Inspección (Quinquenal & Chip Anual)</span>
                  </>
                )}
                {modalMode === "parts" && (
                  <>
                    <PackagePlus className="w-5 h-5 text-amber-400" />
                    <span>Pedir Repuesto de Almacén</span>
                  </>
                )}
                {modalMode === "service" && (
                  <>
                    <Wrench className="w-5 h-5 text-indigo-400" />
                    <span>Agregar Servicio de Taller</span>
                  </>
                )}
                {modalMode === "certificate" && (
                  <>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <span>Solicitar Certificación de Vehículo</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveOrderModal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Modal Certificación (Jala del catálogo los de categoría Certificación) */}
            {modalMode === "certificate" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1.5 flex items-center justify-between">
                    <span>TIPO DE CERTIFICACIÓN (Catálogo de Servicios) *</span>
                    <span className="text-[10px] text-gray-400">({certificationServices.length} disponibles)</span>
                  </label>
                  <select
                    value={certType}
                    onChange={(e) => {
                      const selected = certificationServices.find((s) => s.name === e.target.value);
                      setCertType(e.target.value);
                      if (selected) setCertPrice(selected.price);
                    }}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400 font-bold"
                  >
                    {certificationServices.map((cs) => (
                      <option key={cs.id} value={cs.name}>
                        {cs.name} — S/ {cs.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    PRECIO DE CERTIFICACIÓN (S/) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={certPrice}
                    onChange={(e) => setCertPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-cyan-400 font-bold"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Este servicio se colocará debajo de la sección de repuestos solicitados y se cargará automáticamente a Caja.
                  </p>
                </div>

                <button
                  onClick={handleSaveCertification}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guardar Servicio de Certificado</span>
                </button>
              </div>
            )}

            {/* 2. Modal Diagnóstico */}
            {modalMode === "diagnostic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
                    1. Notas y Códigos de Error Escáner OBD2 / ECU Gas
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Código P0300 Misfire detectado en cilindro 2. Inyector de gas con pulsos irregulares."
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(capitalizeFirst(e.target.value))}
                    className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">
                    2. Observaciones Generales / Recomendaciones al Cliente
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Se recomienda cambio preventivo de bujías y filtro de fase gaseosa en próximo mantenimiento."
                    value={observationsText}
                    onChange={(e) => setObservationsText(capitalizeFirst(e.target.value))}
                    className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400"
                  />
                </div>

                {/* Selector de Tipo de Combustible / Sistema */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-300 uppercase flex items-center gap-1.5">
                      <Fuel className="w-4 h-4 text-amber-400" />
                      <span>Tipo de Combustible / Sistema *</span>
                    </label>
                    <span className="text-[10px] text-gray-400">Actualiza la ficha del vehículo</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["GNV", "GLP", "Gasolina", "Bifuel"] as const).map((fuel) => (
                      <button
                        key={fuel}
                        type="button"
                        onClick={() => setSelectedFuelType(fuel)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 active:scale-95 ${selectedFuelType === fuel
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]"
                          : "bg-reygas-dark text-gray-300 border-white/10 hover:border-white/20 hover:text-white"
                          }`}
                      >
                        <span>⛽ {fuel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fechas Quinquenal y Chip opcionales durante Diagnóstico */}
                <div className="p-3 rounded-xl bg-black/40 border border-purple-500/30 space-y-2">
                  <span className="text-[11px] font-bold text-purple-300 uppercase block">
                    3. Fechas de Inspección (Vencimiento Quinquenal / Chip)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold mb-1">F. Quinquenal (5ta)</label>
                      <input
                        type="date"
                        value={quinquennialDate}
                        onChange={(e) => setQuinquennialDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white font-mono focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold mb-1">F. Chip Anual</label>
                      <input
                        type="date"
                        value={chipExpiryDate}
                        onChange={(e) => setChipExpiryDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-reygas-dark border border-white/10 rounded-lg text-xs text-white font-mono focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveDiagnostic}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Guardar Diagnóstico y Observaciones
                </button>
              </div>
            )}

            {/* Modal Fechas Quinquenal & Chip Anual Dedicado */}
            {modalMode === "inspection_dates" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200">
                  Ingrese o actualice las fechas de inspección técnica. Estos datos se registrarán en la <strong>Tabla de Registro de Taller</strong> cuando se confirme el pago en Caja.
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-300 uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Fecha Quinquenal (Prueba Hidrostática de Cilindro)</span>
                  </label>
                  <input
                    type="date"
                    value={quinquennialDate}
                    onChange={(e) => setQuinquennialDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-purple-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Corresponde a la revisión cada 5 años del cilindro de gas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cyan-300 uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Fecha Chip Anual (Certificación Anual)</span>
                  </label>
                  <input
                    type="date"
                    value={chipExpiryDate}
                    onChange={(e) => setChipExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-cyan-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Corresponde a la certificación anual de chip para habilitación en grifos.
                  </p>
                </div>

                <button
                  onClick={handleSaveInspectionDates}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Fechas de Inspección</span>
                </button>
              </div>
            )}

            {/* 3. Modal Repuesto (Solo Repuestos de Almacén o Repuesto Libre) */}
            {modalMode === "parts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase">
                    📦 Solicitar Repuesto
                  </span>
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setRequisitionType("repuesto")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${requisitionType === "repuesto" ? "bg-amber-500 text-black shadow" : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Inventario Almacén
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequisitionType("manual")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${requisitionType === "manual" ? "bg-teal-600 text-white shadow" : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Repuesto Libre
                    </button>
                  </div>
                </div>

                {requisitionType === "repuesto" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5 flex items-center justify-between">
                        <span>Buscar y Seleccionar Repuesto</span>
                        <span className="text-[11px] text-amber-400 font-mono font-normal">
                          {filteredInventoryItems.length} de {inventoryItems.length} disponibles
                        </span>
                      </label>

                      {/* Search Bar */}
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, marca o serie/código..."
                          value={partsSearchQuery}
                          onChange={(e) => setPartsSearchQuery(capitalizeFirst(e.target.value))}
                          className="w-full pl-9 pr-8 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none font-bold transition-all"
                        />
                        {partsSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setPartsSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                            title="Limpiar búsqueda"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filtered Inventory Items List */}
                      <div className="max-h-52 overflow-y-auto space-y-1 p-1 rounded-xl bg-black/40 border border-white/10 custom-scrollbar">
                        {filteredInventoryItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400 space-y-1">
                            <p>No se encontraron repuestos con &quot;{partsSearchQuery}&quot;.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setRequisitionType("manual");
                                setCustomItemName(partsSearchQuery);
                              }}
                              className="text-xs text-teal-400 hover:text-teal-300 underline font-bold"
                            >
                              ¿Ingresar como Repuesto Libre / Manual?
                            </button>
                          </div>
                        ) : (
                          filteredInventoryItems.map((item) => {
                            const isSelected = item.id === selectedInventoryId;
                            const hasStock = item.stock_quantity > 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInventoryId(item.id);
                                  setCustomItemPrice(item.unit_price || 0);
                                }}
                                className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between border ${isSelected
                                  ? "bg-amber-500/20 border-amber-400 text-white font-bold ring-1 ring-amber-400 shadow-md scale-[1.01]"
                                  : "bg-reygas-surface/40 border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/15"
                                  }`}
                              >
                                <div className="flex-1 min-w-0 pr-3">
                                  {/* Nombre del Producto */}
                                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />}
                                    <span>{item.name}</span>
                                  </div>

                                  {/* Marca y Serie */}
                                  <div className="text-[11px] text-gray-400 truncate flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                                    <span className="text-cyan-300 font-semibold flex items-center gap-1">
                                      <span className="text-gray-500">Marca:</span>
                                      <span>{item.brand || "Genérico"}</span>
                                    </span>
                                    <span className="text-amber-300/90 font-mono flex items-center gap-1">
                                      <span className="text-gray-500 font-sans">Serie/SKU:</span>
                                      <span className="bg-white/5 px-1 py-0.2 rounded border border-white/10">
                                        {item.serial_number || item.sku_barcode || "S/N"}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${hasStock
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-red-500/20 text-red-300 border-red-500/30"
                                    }`}>
                                    Stock: {item.stock_quantity}
                                  </span>
                                  <span className="text-xs font-black text-amber-400 font-mono">
                                    S/ {item.unit_price}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Selected Item Summary Pill */}
                    {selectedInventoryId && (() => {
                      const sel = inventoryItems.find((i) => i.id === selectedInventoryId);
                      if (!sel) return null;
                      return (
                        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-xs shadow-inner">
                          <div className="truncate pr-3 space-y-0.5">
                            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
                              Repuesto Seleccionado:
                            </span>
                            <span className="font-bold text-white block truncate">
                              {sel.name}
                            </span>
                            <div className="text-[11px] text-gray-300 flex items-center gap-3">
                              <span>Marca: <strong className="text-cyan-300">{sel.brand || "Genérico"}</strong></span>
                              <span>Serie: <strong className="text-amber-300 font-mono">{sel.serial_number || sel.sku_barcode || "S/N"}</strong></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-gray-400 block">Precio Catálogo</span>
                            <span className="font-mono font-black text-base text-amber-400">
                              S/ {sel.unit_price || 0}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Precio Unitario a Cobrar (S/)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Descripción del Repuesto Requerido *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Filtro de gas 5ta generación rail"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(capitalizeFirst(e.target.value))}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-amber-400 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Precio Unitario (S/)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Cantidad Requerida</label>
                    <input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-amber-400 font-bold"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="w-full py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ListPlus className="w-4 h-4 text-amber-400" />
                      <span>+ Añadir a la Lista</span>
                    </button>
                  </div>
                </div>

                {/* LISTA DE REPUESTOS EN COLA (MULTI-SELECCIÓN) */}
                {pendingPartsCart.length > 0 && (
                  <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/30 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                        <span>Lista de Repuestos a Solicitar ({pendingPartsCart.length})</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        Total: S/ {pendingPartsCart.reduce((acc, p) => acc + p.subtotal, 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                      {pendingPartsCart.map((cartItem) => (
                        <div
                          key={cartItem.id}
                          className="p-2 rounded-xl bg-reygas-dark/90 border border-white/10 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <span className="font-bold text-white block truncate">{cartItem.description}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              P.U: S/ {cartItem.unit_price.toFixed(2)} • Subtotal: <strong className="text-amber-300">S/ {cartItem.subtotal.toFixed(2)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(cartItem.id, -1)}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 transition-colors"
                              title="Disminuir cantidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs min-w-[24px] text-center">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(cartItem.id, 1)}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 transition-colors"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(cartItem.id)}
                              className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 ml-1 transition-colors"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAddRequisition}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Package className="w-4 h-4" />
                  <span>
                    {pendingPartsCart.length > 0
                      ? `📦 Solicitar ${pendingPartsCart.length} Repuestos (Total S/ ${pendingPartsCart
                        .reduce((acc, p) => acc + p.subtotal, 0)
                        .toFixed(2)})`
                      : "+ Agregar Repuesto Directo a la Orden"}
                  </span>
                </button>
              </div>
            )}

            {/* 4. Modal Servicio (Solo Servicios del Catálogo de Taller o Servicio Libre) */}
            {modalMode === "service" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase">
                    🛠️ Agregar Servicio de Taller
                  </span>
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setRequisitionType("servicio")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${requisitionType === "servicio" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Catálogo Servicios
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequisitionType("manual")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${requisitionType === "manual" ? "bg-teal-600 text-white shadow" : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Servicio Libre
                    </button>
                  </div>
                </div>

                {requisitionType === "servicio" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Seleccionar Servicio del Catálogo ({workshopOnlyServices.length} disponibles)
                      </label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => {
                          const srv = workshopServices.find((s) => s.id === e.target.value);
                          setSelectedServiceId(e.target.value);
                          if (srv) setCustomItemPrice(srv.price);
                        }}
                        className="w-full px-3 py-2.5 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-indigo-400 font-bold"
                      >
                        {workshopOnlyServices.map((srv) => (
                          <option key={srv.id} value={srv.id}>
                            {srv.name} ({srv.category || "Servicio"}) — S/ {srv.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Precio Asignado al Servicio (S/) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Puede ingresar S/ 0 si el servicio no tiene costo adicional (revisión/garantía).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Nombre / Descripción del Servicio *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Calibración fina de mapa de gas en ruta"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(capitalizeFirst(e.target.value))}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white focus:border-indigo-400 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Precio del Servicio (S/) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-reygas-dark border border-white/10 rounded-xl text-sm text-white font-mono focus:border-indigo-400 font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddServiceToCart}
                      className="w-full py-2.5 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ListPlus className="w-4 h-4 text-indigo-400" />
                      <span>+ Añadir a la Lista</span>
                    </button>
                  </div>
                </div>

                {/* LISTA DE SERVICIOS EN COLA (MULTI-SELECCIÓN) */}
                {pendingServicesCart.length > 0 && (
                  <div className="p-3 rounded-2xl bg-black/50 border border-indigo-500/30 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-black text-indigo-300 uppercase flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Lista de Servicios a Asignar ({pendingServicesCart.length})</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        Total: S/ {pendingServicesCart.reduce((acc, p) => acc + p.subtotal, 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                      {pendingServicesCart.map((cartItem) => (
                        <div
                          key={cartItem.id}
                          className="p-2 rounded-xl bg-reygas-dark/90 border border-white/10 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <span className="font-bold text-white block truncate">{cartItem.description}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              P.U: S/ {cartItem.unit_price.toFixed(2)} • Subtotal: <strong className="text-indigo-300">S/ {cartItem.subtotal.toFixed(2)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateServiceCartQty(cartItem.id, -1)}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 transition-colors"
                              title="Disminuir cantidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs min-w-[24px] text-center">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateServiceCartQty(cartItem.id, 1)}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 transition-colors"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveServiceFromCart(cartItem.id)}
                              className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 ml-1 transition-colors"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAddRequisition}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Wrench className="w-4 h-4" />
                  <span>
                    {pendingServicesCart.length > 0
                      ? `🛠️ Asignar ${pendingServicesCart.length} Servicios (Total S/ ${pendingServicesCart
                        .reduce((acc, p) => acc + p.subtotal, 0)
                        .toFixed(2)})`
                      : "+ Agregar Servicio a la Orden"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STYLED WEB NOTIFICATION MODAL (REPLACES BROWSER ALERT) */}
      {webAlert?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-cyan-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{webAlert.title}</h3>
                <span className="text-[11px] text-gray-400 font-semibold">Notificación de Taller</span>
              </div>
            </div>

            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {webAlert.message}
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setWebAlert(null)}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs shadow-lg shadow-cyan-600/30 transition-transform hover:scale-105"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ERRONEOUS ENTRY WORK ORDER CONFIRMATION MODAL */}
      {deleteModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-red-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">¿Eliminar Tarjeta de Ingreso?</h3>
                <span className="text-xs text-red-400 font-bold font-mono">
                  Vehículo Placa: {deleteModalOrder.plate}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              <p>
                Esta acción eliminará por completo la orden de trabajo <strong className="text-white font-mono">#{deleteModalOrder.id}</strong> del taller y de la base de datos.
              </p>
              <div className="text-amber-300 bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Corrección de Error en Portería</span>
                </div>
                <p className="text-[11px] text-gray-300">
                  Si se registró una fecha errónea, placa equivocada o ingreso duplicado, al borrarla quedará libre para registrarse nuevamente de forma correcta.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeleteModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteWorkOrder(deleteModalOrder.id);
                  const deletedPlate = deleteModalOrder.plate;
                  setDeleteModalOrder(null);
                  setWebAlert({
                    open: true,
                    title: "Tarjeta Eliminada",
                    message: `El registro de ingreso del vehículo ${deletedPlate} ha sido eliminado correctamente del taller y liberado para nuevo registro.`,
                  });
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 transition-transform hover:scale-105"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar y Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR REPUESTO O SERVICIO DE LA ORDEN */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-white/10 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>Editar {editingItem.item.item_type === "servicio" ? "Servicio" : "Repuesto"}</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Descripción / Nombre del Ítem *
                </label>
                <input
                  type="text"
                  value={editItemDescription}
                  onChange={(e) => setEditItemDescription(capitalizeFirst(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editItemQty}
                    onChange={(e) => setEditItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Precio Unitario (S/) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-reygas-dark border border-white/15 rounded-xl text-sm text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-bold uppercase">Nuevo Subtotal:</span>
                <span className="text-base font-black font-mono text-amber-400">
                  S/ {(Number(editItemQty || 0) * Number(editItemPrice || 0)).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditItem}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESCUENTO EN MONTO (S/) */}
      {discountModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/40 max-w-md w-full space-y-6 shadow-2xl bg-reygas-dark">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Tag className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Asignar Descuento a la Orden</h3>
                  <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                    Placa: {workOrders.find((o) => o.id === discountModalOrder)?.vehicle_plate || ""}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDiscountModalOrder(null)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">
                  Monto de Descuento en Soles (S/) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold font-mono text-sm">
                    S/
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={discountInput === 0 ? "" : discountInput}
                    placeholder="0.00"
                    onChange={(e) => setDiscountInput(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2.5 bg-reygas-surface border border-emerald-500/30 rounded-xl text-sm font-bold text-white font-mono focus:border-emerald-400 focus:outline-none"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Ingrese el monto exacto que se descontará del total general en Taller y Caja.
                </p>
              </div>

              {/* Botones de Acceso Rápido */}
              <div>
                <span className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">
                  Montos Rápidos de Descuento:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 20, 30, 50, 80, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscountInput(val)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold border transition-all ${discountInput === val
                        ? "bg-emerald-500 text-black border-white shadow-md font-black scale-105"
                        : "bg-emerald-950/40 text-emerald-300 border-emerald-500/20 hover:bg-emerald-900/60"
                        }`}
                    >
                      S/ {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDiscountInput(0)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${discountInput === 0
                      ? "bg-gray-600 text-white border-white font-black"
                      : "bg-gray-800 text-gray-300 border-white/10 hover:bg-gray-700"
                      }`}
                  >
                    S/ 0 (Sin Desc.)
                  </button>
                </div>
              </div>

              {/* Previsualización Dinámica */}
              {(() => {
                const ord = workOrders.find((o) => o.id === discountModalOrder);
                if (!ord) return null;
                const itemsSubtotal = ord.items.reduce((acc, i) => acc + i.subtotal, 0);
                const certSubtotal = ord.requires_certification ? (ord.certification_price || 0) : 0;
                const grossTotal = itemsSubtotal + certSubtotal;
                const finalNet = Math.max(0, grossTotal - (discountInput || 0));

                return (
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Subtotal Bruto:</span>
                      <span className="font-mono font-bold text-gray-200">S/ {grossTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Descuento a Aplicar:</span>
                      <span className="font-mono font-bold">- S/ {(discountInput || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1.5 text-sm font-extrabold text-white">
                      <span>Total Final a Liquidar:</span>
                      <span className="font-mono text-amber-300">S/ {finalNet.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDiscountModalOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDiscount}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-transform hover:scale-105 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Descuento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE DAILY WORKSHOP REPORT MODAL */}
      <DailyWorkshopReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        initialTab="taller"
      />
    </div>
  );
}
