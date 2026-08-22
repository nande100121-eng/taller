import { supabase } from "./client";
import { fetchDailyExpenses, DailyExpense } from "./expenses";
import { SiteContent, SiteTheme, Technician, InventoryItem, Vehicle, WorkOrder, Appointment, Invoice, Certification, ScheduleRecord, WorkshopService, FuelType, ToolLoan, AttendanceLog, generateDefaultUsername } from "@/lib/store/app-store";
import { cleanMethodDisplay } from "@/lib/utils/payment-method";
import { DEBT_CSV_BY_RECEIPT } from "@/lib/deuda-csv";
import { logSystemEvent, logTiming, logTimingThreshold, logRealtimeStatus } from "@/lib/system-log";
import { toPeruAnchoredISO, toPeruDateKey } from "@/lib/utils/date-utils";
import { parseCorrelative } from "@/lib/utils/receipt-utils";

// Unique browser session ID to prevent self-broadcast reload loops
export const CLIENT_SESSION_ID =
  typeof window !== "undefined"
    ? (window as any).__REYGAS_CLIENT_ID ||
    ((window as any).__REYGAS_CLIENT_ID = "cli_" + Math.random().toString(36).substring(2) + Date.now().toString(36))
    : "server";

let lastLocalMutationTimestamp = 0;
const lastLocalMutationMap = new Map<string, number>();
export function markLocalMutation(key?: string) {
  const now = Date.now();
  lastLocalMutationTimestamp = now;
  if (key) {
    lastLocalMutationMap.set(key, now);
  }
}
export function getLastLocalMutationTime(key?: string) {
  if (key) {
    return lastLocalMutationMap.get(key) ?? 0;
  }
  return lastLocalMutationTimestamp;
}
export function hasRecentLocalMutation(key: string, thresholdMs: number = 5000): boolean {
  const t = lastLocalMutationMap.get(key) ?? 0;
  return Date.now() - t < thresholdMs;
}

// =====================================================================
// SUPABASE REALTIME CMS & ERP DATABASE SERVICE
// Syncs all site content, rates, inventory and ERP tables directly to PostgreSQL
// =====================================================================

export async function fetchSupabaseSiteContent(): Promise<Partial<SiteContent> | null> {
  try {
    // OPTIMIZACIÓN: excluir del fetch general los snapshots pesados (inv_full_*,
    // inv_payhistory_*, inv_breakdown_*, wo_mod_*, wo_deleted_*, wo_removed_*) que
    // no pinta la UI del CMS: llegan por fetchCappedOperationalData o el fetch de
    // fetchSupabaseErpData. Se conservan TODAS las secciones CMS (cualquier categoría)
    // y solo se excluyen las claves con prefijos de snapshot. Select de columnas
    // mínimas (el parseo lee row.value; content es duplicada JSONB de value).
    const { data, error } = await supabase
      .from("site_content")
      .select("section_key, key, value, content")
      .not("section_key", "like", "inv_full_%")
      .not("section_key", "like", "inv_payhistory_%")
      .not("section_key", "like", "inv_breakdown_%")
      .not("section_key", "like", "inv_resources_%")
      .not("section_key", "like", "wo_mod_%")
      .not("section_key", "like", "wo_deleted_%")
      .not("section_key", "like", "wo_removed_%")
      .not("section_key", "like", "tech_perms_%")
      .not("section_key", "like", "sched_%")
      .not("section_key", "like", "cert_%")
      .not("section_key", "like", "appt_%")
      .not("section_key", "like", "tool_loan_%")
      .not("section_key", "eq", "master_workshop_backup");
    if (error || !data || data.length === 0) return null;

    const result: any = {};
    data.forEach((row) => {
      const sectionKey = row.key || row.section_key;
      const rawVal = row.value !== undefined ? row.value : row.content;

      if (sectionKey && rawVal !== undefined) {
        try {
          result[sectionKey] = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
        } catch {
          result[sectionKey] = rawVal;
        }
      }
    });
    return result as Partial<SiteContent>;
  } catch (err) {
    console.warn("Supabase not connected, using resilient state fallback.", err);
    return null;
  }
}

export async function saveSupabaseSiteContent(
  key: string,
  value: any,
  category: string = "general",
  shouldBroadcast: boolean = true
): Promise<{ success: boolean; error?: string }> {
  markLocalMutation(key);
  try {
    const serializedValue = typeof value === "object" ? JSON.stringify(value) : value;

    // site_content.section_key is the unique PK; always upsert on section_key only
    const payload: any = {
      section_key: key,
      key: key,
      value: serializedValue,
      content: typeof value === "object" ? value : { data: value },
      category,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("site_content").upsert(payload, { onConflict: "section_key" });

    if (error) {
      return { success: false, error: error.message };
    }

    // Broadcast instant real-time signal to other devices
    if (shouldBroadcast) {
      broadcastRealtimeChange(`site_content_${key}`);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Supabase site_content save failed:", msg);
    return { success: false, error: msg };
  }
}

export async function saveAllTechnicianPermissions(technicians: Technician[]): Promise<boolean> {
  try {
    // 1. Save master catalog to site_content
    await saveSupabaseSiteContent("all_technicians", technicians, "technicians");

    // 2. Save individual technician permission keys and direct technician table rows
    for (const tech of technicians) {
      const permsPayload = {
        allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
        can_receive_payment: !!tech.can_receive_payment,
        is_debt_responsible: !!tech.is_debt_responsible,
        is_attention_responsible: !!tech.is_attention_responsible,
        is_mechanic_responsible: !!tech.is_mechanic_responsible,
        is_certification_responsible: !!tech.is_certification_responsible,
        payment_nickname: tech.payment_nickname || "",
        email: tech.email || "",
        username: tech.username || "",
        password: tech.password || "",
      };
      await saveSupabaseSiteContent(`tech_perms_${tech.id}`, permsPayload, "technicians");
      const normName = tech.full_name.trim().toLowerCase();
      await saveSupabaseSiteContent(`tech_perms_name_${encodeURIComponent(normName)}`, permsPayload, "technicians");

      // Also upsert directly to technicians table with allowed_tabs
      const { error: techErr } = await supabase.from("technicians").upsert(
        {
          id: tech.id,
          full_name: tech.full_name,
          specialty: tech.specialty,
          phone: tech.phone,
          is_active: tech.is_active,
          allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
          can_receive_payment: !!tech.can_receive_payment,
          is_debt_responsible: !!tech.is_debt_responsible,
        },
        { onConflict: "id" }
      );
      if (techErr) {
        await supabase.from("technicians").upsert({
          full_name: tech.full_name,
          specialty: tech.specialty,
          phone: tech.phone,
          is_active: tech.is_active,
          allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
          can_receive_payment: !!tech.can_receive_payment,
          is_debt_responsible: !!tech.is_debt_responsible,
        });
      }
    }

    broadcastRealtimeChange("technician_saved");
    return true;
  } catch (err) {
    console.error("Error saving technician permissions:", err);
    return false;
  }
}

export async function saveFullSiteContentToSupabase(content: SiteContent): Promise<boolean> {
  try {
    const keys = Object.keys(content) as Array<keyof SiteContent>;
    for (const key of keys) {
      await saveSupabaseSiteContent(key, content[key]);
    }
    return true;
  } catch (err) {
    console.error("Error saving full site content to Supabase:", err);
    return false;
  }
}

// ---------------------------------------------------------------------
// TECHNICIANS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseTechnician(
  tech: Technician,
  allTechs?: Technician[]
): Promise<{ success: boolean; error?: string }> {
  try {
    markLocalMutation("technicians");
    const payload = {
      id: tech.id,
      full_name: tech.full_name,
      specialty: tech.specialty,
      phone: tech.phone,
      is_active: tech.is_active,
      allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
      can_receive_payment: !!tech.can_receive_payment,
      is_debt_responsible: !!tech.is_debt_responsible,
    };
    const { error } = await supabase.from("technicians").upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Supabase technician upsert failed:", error);
      return { success: false, error: error.message || "Error al guardar técnico" };
    }

    const permsPayload = {
      allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
      can_receive_payment: !!tech.can_receive_payment,
      is_debt_responsible: !!tech.is_debt_responsible,
      is_attention_responsible: !!tech.is_attention_responsible,
      is_mechanic_responsible: !!tech.is_mechanic_responsible,
      is_certification_responsible: !!tech.is_certification_responsible,
      email: tech.email || "",
      username: tech.username || "",
      password: tech.password || "",
    };
    const permsRes = await saveSupabaseSiteContent(`tech_perms_${tech.id}`, permsPayload, "technicians", false);
    if (!permsRes.success) {
      return { success: false, error: permsRes.error || "Error al guardar permisos" };
    }
    const normName = tech.full_name.trim().toLowerCase();
    await saveSupabaseSiteContent(`tech_perms_name_${encodeURIComponent(normName)}`, permsPayload, "technicians", false);

    if (allTechs && Array.isArray(allTechs)) {
      await saveSupabaseSiteContent("all_technicians", allTechs, "technicians", false);
    }
    broadcastRealtimeChange("technician_saved");
    emitCloudSavedToast("Técnico guardado en la nube ✓");
    return { success: true };
  } catch (err: any) {
    console.warn("Supabase technician deferred:", err);
    return { success: false, error: err?.message || "Error de red al guardar técnico" };
  }
}

export async function deleteSupabaseTechnician(id: string, allTechs?: Technician[]) {
  try {
    await supabase.from("technicians").delete().eq("id", id);
    await supabase.from("site_content").delete().eq("key", `tech_perms_${id}`);
    if (allTechs && Array.isArray(allTechs)) {
      await saveSupabaseSiteContent("all_technicians", allTechs.filter((t) => t.id !== id), "technicians");
    }
    broadcastRealtimeChange("technician_deleted");
  } catch (err) {
    console.warn("Supabase technician delete deferred:", err);
  }
}

// ---------------------------------------------------------------------
// INVENTORY SUPABASE SYNC
// ---------------------------------------------------------------------
// Mapeo entre la interfaz de la app (InventoryItem) y las columnas REALES de
// inventory_items: stock, min_stock, cost_price, sale_price, location, notes, brand.
// Los campos extra (counted_status, initial_stock, entries, exits, serial_number) se
// serializan en `notes` bajo `__meta__:` y se recuperan en la lectura.
function buildInventoryDbPayload(item: InventoryItem): Record<string, any> {
  // FIX 22/08 (stock 0 en el modal de repuestos): el payload mandaba columnas que NO
  // existen en inventory_items (stock, min_stock, sale_price, cost_price, location,
  // notes) -> TODOS los upserts fallaban con 400 y el stock nunca se persistió en la
  // nube (682 items en 0; los syncs pisaban el stock real del cache local). Columnas
  // REALES verificadas en la base: id, sku_barcode, name, category, stock_quantity,
  // unit_price, min_stock_alert, created_at, brand, serial_number, initial_stock,
  // entries, exits, counted_stock, counted_status.
  const anyItem = item as any;
  const payload: Record<string, any> = {
    id: item.id,
    sku_barcode: item.sku_barcode,
    name: item.name,
    brand: anyItem.brand || null,
    category: item.category || "Repuestos",
    stock_quantity: typeof item.stock_quantity === "number" ? item.stock_quantity : (typeof anyItem.stock === "number" ? anyItem.stock : 0),
    unit_price: typeof item.unit_price === "number" ? item.unit_price : (typeof anyItem.sale_price === "number" ? anyItem.sale_price : 0),
    min_stock_alert: typeof item.min_stock_alert === "number" ? item.min_stock_alert : (typeof anyItem.min_stock === "number" ? anyItem.min_stock : 2),
  };
  if (anyItem.serial_number) payload.serial_number = anyItem.serial_number;
  if (typeof anyItem.initial_stock === "number") payload.initial_stock = anyItem.initial_stock;
  if (typeof anyItem.entries === "number") payload.entries = anyItem.entries;
  if (typeof anyItem.exits === "number") payload.exits = anyItem.exits;
  if (typeof anyItem.counted_stock === "number") payload.counted_stock = anyItem.counted_stock;
  if (anyItem.counted_status) payload.counted_status = anyItem.counted_status;
  return payload;
}

function normalizeDbInventoryItem(dbRow: any): InventoryItem {
  let meta: Record<string, any> = {};
  let notes: string = typeof dbRow.notes === "string" ? dbRow.notes : "";
  const metaIdx = notes.indexOf("__meta__:");
  if (metaIdx >= 0) {
    try {
      meta = JSON.parse(notes.slice(metaIdx + "__meta__:".length)) || {};
      notes = notes.slice(0, metaIdx).trim();
    } catch { }
  }
  const inv: InventoryItem = {
    id: dbRow.id,
    sku_barcode: dbRow.sku_barcode,
    name: dbRow.name,
    brand: dbRow.brand || undefined,
    category: dbRow.category || "Repuestos",
    unit_price: typeof dbRow.sale_price === "number" ? dbRow.sale_price : (typeof dbRow.unit_price === "number" ? dbRow.unit_price : 0),
    stock_quantity: typeof dbRow.stock === "number" ? dbRow.stock : (typeof dbRow.stock_quantity === "number" ? dbRow.stock_quantity : 0),
    min_stock_alert: typeof dbRow.min_stock === "number" ? dbRow.min_stock : (typeof dbRow.min_stock_alert === "number" ? dbRow.min_stock_alert : 2),
  };
  if (typeof dbRow.cost_price === "number") (inv as any).cost_price = dbRow.cost_price;
  if (dbRow.location) (inv as any).location = dbRow.location;
  if (notes) (inv as any).notes = notes;
  if (dbRow.serial_number) inv.serial_number = dbRow.serial_number;
  if (typeof meta.initial_stock === "number") inv.initial_stock = meta.initial_stock;
  if (typeof meta.entries === "number") inv.entries = meta.entries;
  if (typeof meta.exits === "number") inv.exits = meta.exits;
  if (typeof meta.counted_stock === "number") inv.counted_stock = meta.counted_stock;
  if (meta.counted_status) inv.counted_status = meta.counted_status;
  return inv;
}

export async function saveSupabaseInventoryItem(item: InventoryItem) {
  try {
    markLocalMutation("inventory");
    // Backup en site_content (patrón roster): nunca se pierde el registro completo
    await saveSupabaseSiteContent(`inv_full_${item.id}`, item, "inventory");
    const { error } = await supabase
      .from("inventory_items")
      .upsert(buildInventoryDbPayload(item), { onConflict: "id" });
    if (error) console.warn("Supabase inventory save warning:", error.message);
    broadcastRealtimeChange("inventory_item_updated");
    emitCloudSavedToast("Inventario guardado en la nube ✓");
  } catch (err) {
    console.warn("Supabase inventory save deferred:", err);
  }
}

export async function saveSupabaseBulkInventory(items: InventoryItem[]): Promise<{ success: boolean; count: number; errorMsg?: string }> {
  try {
    // 1. Disambiguate duplicate SKUs if any and ensure deterministic IDs
    const seenSkus = new Map<string, number>();
    const sanitizedItems: InventoryItem[] = items.map((item, idx) => {
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
        id: item.id || `inv-${cleanSku.replace(/[^A-Z0-9_-]/gi, "_")}`,
        sku_barcode: cleanSku,
      };
    });

    // 2. Always persist full catalog snapshot to site_content as reliable cloud backup
    await saveSupabaseSiteContent("all_inventory_records", sanitizedItems, "inventory");

    const CHUNK_SIZE = 100;
    const fullPayload = sanitizedItems.map((item) => buildInventoryDbPayload(item));

    for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
      const chunk = fullPayload.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("inventory_items").upsert(chunk, { onConflict: "sku_barcode" });
      if (error) {
        console.warn(`Supabase bulk inventory chunk ${i} notice:`, error.message);
        // Retry individual items in this chunk to prevent losing the rest
        for (const singleItem of chunk) {
          await supabase.from("inventory_items").upsert([singleItem], { onConflict: "sku_barcode" });
        }
      }
    }

    broadcastRealtimeChange("inventory_bulk_updated");
    return { success: true, count: sanitizedItems.length };
  } catch (err: any) {
    console.warn("Supabase bulk inventory error:", err);
    return { success: false, count: 0, errorMsg: err?.message || "Error al guardar en Supabase" };
  }
}

export async function deleteSupabaseInventoryItem(id: string) {
  try {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) console.warn("Supabase inventory delete warning:", error.message);
    broadcastRealtimeChange("inventory_item_deleted");
  } catch (err) {
    console.warn("Supabase inventory delete deferred:", err);
  }
}

export async function deleteMultipleSupabaseInventoryItems(ids: string[]) {
  try {
    const { error } = await supabase.from("inventory_items").delete().in("id", ids);
    if (error) console.warn("Supabase inventory multi-delete warning:", error.message);
    broadcastRealtimeChange("inventory_item_deleted");
  } catch (err) {
    console.warn("Supabase inventory multi-delete deferred:", err);
  }
}

export async function clearSupabaseInventory() {
  try {
    await saveSupabaseSiteContent("all_inventory_records", [], "inventory");
    const { error } = await supabase.from("inventory_items").delete().neq("id", "");
    if (error) console.warn("Supabase inventory clear warning:", error.message);
    broadcastRealtimeChange("inventory_bulk_updated");
  } catch (err) {
    console.warn("Supabase inventory clear deferred:", err);
  }
}

// ---------------------------------------------------------------------
// WORK ORDERS SUPABASE SYNC
// ---------------------------------------------------------------------
// COLA DE GUARDADO POR OT (fix realtime: "despacho se revirtió").
// saveSupabaseWorkOrder hace SELECT -> merge defensivo -> upsert en varios RTTs.
// Si dos guardados de la MISMA OT se solapan (confirmar varios repuestos seguidos,
// dos pestañas, sync de 30s vs guardado local), el SELECT del segundo lee el estado
// VIEJO (dispatched:false) y su upsert pisa el despacho recién confirmado -> la card
// "vuelve a pedir confirmar". Con esta cola los guardados de una OT se ejecutan en
// serie: cada SELECT-merge-upsert ve el commit anterior (merge defensivo ya protege
// dispatched con OR: nunca se revierte true->false por una copia vieja).
const woSaveQueues = new Map<string, Promise<void>>();

function enqueueWorkOrderSave(orderId: string, task: () => Promise<void>): Promise<void> {
  const prev = woSaveQueues.get(orderId) || Promise.resolve();
  const next = prev.then(task, task); // corre aunque el anterior haya fallado
  const guarded = next.catch(() => {}); // la cola nunca queda en estado rechazado
  woSaveQueues.set(orderId, guarded);
  return guarded;
}

// ===== TOMBSTONE DE BORRADO (fix: "la OT se borra pero al refrescar reaparece") =====
// Al borrar una OT se escribe wo_deleted_<id> y saveSupabaseWorkOrder se NIEGA a
// re-upsertarla. Así, un dispositivo/pestaña con la OT en caché (Taller, sync de
// 30s, heartbeat de 5 min, otra tablet) NO puede re-crearla en la nube.
const deletedWoIds = new Set<string>();
export function markWorkOrderDeletedLocal(id: string) { if (id) deletedWoIds.add(id); }
export function clearWorkOrderDeletedMarker(id: string) {
  if (id) deletedWoIds.delete(id);
  try { supabase.from("site_content").delete().eq("key", `wo_deleted_${id}`).then(() => {}); } catch {}
}
async function isWorkOrderDeleted(id: string): Promise<boolean> {
  if (deletedWoIds.has(id)) return true;
  try {
    const res = await supabase.from("site_content").select("key").eq("key", `wo_deleted_${id}`).maybeSingle();
    if (res?.data) { deletedWoIds.add(id); return true; }
  } catch { /* noop */ }
  return false;
}

export async function saveSupabaseWorkOrder(order: WorkOrder) {
  // Serializa por OT: espera a que termine el guardado anterior de la misma OT.
  await enqueueWorkOrderSave(order.id, async () => {
    // TOMBSTONE: si el usuario borró esta OT, NO se re-upserta (una tablet con caché
    // viejo no debe "revivirla" en la nube al guardar cualquier cosa de ella).
    if (await isWorkOrderDeleted(order.id)) {
      logSystemEvent("warn", "workorder.save.skipped_deleted", {
        woId: String(order.id || "").slice(0, 8),
        plate: order.vehicle_plate || "",
      }, "services:saveSupabaseWorkOrder");
      return;
    }
  const saveStart = Date.now();
  try {
    markLocalMutation("workOrders");
    let diagText = (order.diagnostic_notes || "").replace(/\[ALLOW_MOD\]:\s*(true|false)/gi, "").replace(/\[ERP_META\]:[^\n]+/g, "").trim();
    if (order.allow_modifications) {
      diagText = `${diagText}\n[ALLOW_MOD]: true`.trim();
    }
    if (order.observations && !diagText.includes("[OBSERVACIONES]:")) {
      diagText = `${diagText}\n[OBSERVACIONES]: ${order.observations}`.trim();
    }
    // NOTA: las fechas de Infogas (quinquennial_date / chip_expiry_date) se guardan en
    // sus COLUMNAS reales de work_orders. NO se incrusta [ERP_META] aquí: esa marca
    // disparaba la reconstrucción de "facturas fantasma" (pago sin cobrar) en órdenes
    // nuevas con Tipo de Servicio. La reconstrucción solo LEE [ERP_META] de registros
    // históricos importados (Tabla Maestra), que es donde corresponde.

    const payload: any = {
      id: order.id,
      vehicle_plate: order.vehicle_plate || "SN-PLACA",
      status: order.status || "pagado_autorizado",
      assigned_technician_id: order.assigned_technician_id || null,
      problem_description: order.problem_description || "",
      diagnostic_notes: diagText || null,
      observations: order.observations || null,
      entry_time: order.entry_time || new Date().toISOString(),
      completion_time: order.completion_time || null,
      items: typeof order.items === "string" ? order.items : JSON.stringify(order.items || []),
      quinquennial_date: order.quinquennial_date || null,
      chip_expiry_date: order.chip_expiry_date || null,
      vehicle_type: order.vehicle_type || null,
      general_maintenance_service: order.general_maintenance_service || null,
      spare_parts_services: order.spare_parts_services || null,
      requires_certification: !!order.requires_certification,
      certification_type: order.certification_type || null,
      certification_price: order.certification_price || 0,
      allow_modifications: !!order.allow_modifications,
    };

    // NOTA: discount_amount NO es una columna de work_orders (quedó en el snapshot
    // wo_mod_<id>). Incluirla hacía FALLAR el upsert principal (PGRST204) y el fallback
    // que se usaba después NO guardaba quinquennial_date/chip_expiry_date -> las fechas
    // de Infogas no persistían en la nube. Por eso se retiró del payload.

    // MERGE DEFENSIVO DE ITEMS (bug BAG-123: Taller y Almacén guardan la misma OT con
    // versiones distintas y se pisan: cantidad 3->2->4->3, despacho que se desactiva).
    // Regla: NUNCA revertir un despacho confirmado (dispatched:true) y, para cantidad/
    // precio, gana el item con updated_at MÁS RECIENTE (comparado contra la DB actual).
    // PERF (fluidez 20/08): el snapshot wo_mod_ se dispara EN PARALELO con este SELECT
    // porque NO depende del merge (usa la versión local completa) -> se ahorra ~1 RTT
    // en el dispositivo que guarda (broadcast/toast salen antes, la card llega antes).
    const tMergeStart = Date.now();
    const tSnapStart = Date.now();

    // FIX ELIMINAR REPUESTO CROSS-DEVICE (F2Z-050): los removedItemIds viven en el
    // snapshot GLOBAL wo_removed_<id> (site_content), NO solo en la OT local. Si otra
    // tablet (Taller) eliminó un ítem y esta tablet (Almacén) guarda con su copia vieja
    // que aún lo contiene, el merge lo trataría como "ítem nuevo" y lo reintroduciría.
    // Se lee el registro global ANTES del snapshot para excluir esos ítems del snapshot
    // y del merge (el snapshot wo_mod_ NO debe volver a incluir el ítem eliminado).
    let globalRemoved: string[] = [];
    try {
      const removedRes = await supabase
        .from("site_content")
        .select("section_key, value")
        .eq("section_key", `wo_removed_${order.id}`)
        .maybeSingle();
      const removedRaw = removedRes?.data?.value;
      if (removedRaw) {
        let rv: any = removedRaw;
        if (typeof rv === "string") { try { rv = JSON.parse(rv); } catch { rv = null; } }
        if (rv && Array.isArray(rv.ids)) globalRemoved = rv.ids.filter((x: any) => typeof x === "string");
        else if (Array.isArray(rv)) globalRemoved = rv.filter((x: any) => typeof x === "string");
      }
    } catch { /* noop */ }

    // Unión: removidos locales (esta tablet) + removidos globales (otras tablets).
    const removedSet = new Set<string>([...(globalRemoved || []), ...((order as any)?.removedItemIds || [])]);
    // Los ítems marcados eliminados NO entran al snapshot ni al payload aunque la copia
    // local de esta tablet aún los tenga (Almacén con cache viejo).
    const cleanItemsForSave: any[] = (Array.isArray(order.items) ? order.items : []).filter(
      (it: any) => !(it && it.id && removedSet.has(it.id))
    );

    const snapshotPromise = saveSupabaseSiteContent(`wo_mod_${order.id}`, {
      ...order,
      items: cleanItemsForSave,
      diagnostic_notes: diagText,
      updated_at: new Date().toISOString(),
    }, "work_orders", false);
    try {
      const dbRes = await supabase.from("work_orders").select("items").eq("id", order.id).maybeSingle();
      const dbRaw = dbRes?.data?.items;
      if (dbRaw) {
        let dbItems: any[] = [];
        try { dbItems = typeof dbRaw === "string" ? JSON.parse(dbRaw) : dbRaw; } catch { dbItems = []; }
        // localItems ya viene filtrado contra removedSet (calculado arriba, antes del snapshot).
        const localItems: any[] = cleanItemsForSave;
        if (localItems.length > 0 || dbItems.length > 0) {
          const dbMap = new Map<string, any>();
          const keyOf = (it: any) => it && it.id ? it.id : `noid_${String(it.description || '').trim().toLowerCase()}_${Number(it.unit_price) || Number(it.subtotal) || 0}`;
          dbItems.forEach((it: any) => { if (it) dbMap.set(keyOf(it), it); });
          // FIX ELIMINAR REPUESTO (F2Z-050): el merge defensivo conservaba en DB los ítems
          // que no estaban en la versión local -> un repuesto entregado borrado en Taller
          // "volvía" en el siguiente guardado. Los ítems registrados en removedItemIds se
          // EXCLUYEN del preservado (borrado intencional, no cache viejo).
          dbItems.forEach((it: any) => { if (it && removedSet.has(it.id)) dbMap.delete(keyOf(it)); });
          const mergedItems = localItems.map((it: any) => {
            const k = keyOf(it);
            const dbIt = dbMap.get(k);
            if (!dbIt) return it; // item nuevo: se guarda tal cual
            const t = (x: any) => new Date(x?.updated_at || 0).getTime();
            const localNewer = t(it) >= t(dbIt);
            // Cantidad/precio/subtotal: gana el más reciente
            const qty = localNewer ? it.quantity : dbIt.quantity;
            const unitPrice = localNewer ? it.unit_price : dbIt.unit_price;
            const subtotal = Number(((qty ?? 0) * (unitPrice ?? 0)).toFixed(2));
            // Despacho: NUNCA revertir true->false (un item entregado en Almacén no
            // debe desactivarse porque otra pestaña guardó una versión sin despachar).
            const dispatched = !!(dbIt.dispatched === true || it.dispatched === true);
            const dispatchedAt = it.dispatched_at || dbIt.dispatched_at || undefined;
            return {
              ...dbIt,
              ...it,
              quantity: qty,
              unit_price: unitPrice,
              subtotal,
              dispatched,
              dispatched_at: dispatched ? dispatchedAt : undefined,
              updated_at: localNewer ? it.updated_at : dbIt.updated_at,
            };
          });
          // Conservar items que existen en DB pero no en la versión local (evita que una
          // pestaña con cache viejo "borre" repuestos pedidos por otra).
          localItems.forEach((it: any) => dbMap.delete(keyOf(it)));
          const preserved = Array.from(dbMap.values()).filter((dbIt: any) =>
            !mergedItems.some((m: any) => keyOf(m) === keyOf(dbIt))
          );
          const finalItems = [...mergedItems, ...preserved];
          payload.items = JSON.stringify(finalItems);
          (order as any).items = finalItems;
        }
      }
    } catch (e) {
      console.warn("saveSupabaseWorkOrder merge warning:", e);
    }
    const mergeMs = Date.now() - tMergeStart;

    const tUpsertStart = Date.now();
    const { error } = await supabase.from("work_orders").upsert(payload);
    if (error) {
      console.warn("Supabase work order upsert notice, trying core columns fallback:", error.message);
      await supabase.from("work_orders").upsert({
        id: order.id,
        vehicle_plate: order.vehicle_plate || "SN-PLACA",
        status: order.status || "pagado_autorizado",
        assigned_technician_id: order.assigned_technician_id || null,
        problem_description: order.problem_description || "",
        diagnostic_notes: diagText || null,
        observations: order.observations || null,
        entry_time: order.entry_time || new Date().toISOString(),
        completion_time: order.completion_time || null,
        items: typeof order.items === "string" ? order.items : JSON.stringify(order.items || []),
        // El fallback también preserva TODAS las columnas extra (nunca perder fechas/cert.)
        quinquennial_date: order.quinquennial_date || null,
        chip_expiry_date: order.chip_expiry_date || null,
        vehicle_type: order.vehicle_type || null,
        general_maintenance_service: order.general_maintenance_service || null,
        spare_parts_services: order.spare_parts_services || null,
        requires_certification: !!order.requires_certification,
        certification_type: order.certification_type || null,
        certification_price: order.certification_price || 0,
        allow_modifications: !!order.allow_modifications,
      });
    }

    // Snapshot de resiliencia en site_content (wo_mod_): ya disparado EN PARALELO con
    // el SELECT del merge arriba; aquí solo se espera su resolución (no suma al tiempo).
    const upsertMs = Date.now() - tUpsertStart;
    await snapshotPromise;
    const snapshotMs = Date.now() - tSnapStart;

    // Persistir el registro GLOBAL de ítems eliminados (wo_removed_<id>): sin esto, la
    // copia vieja de Otra tablet (Almacén) reintroducía el repuesto eliminado en Taller
    // al guardar la OT. El merge ya lo filtró; aquí se deja la lista unida en la nube
    // para que cualquier dispositivo la respete (borrado intencional, no cache viejo).
    if (removedSet.size > 0) {
      try {
        await supabase.from("site_content").upsert({
          section_key: `wo_removed_${order.id}`,
          key: `wo_removed_${order.id}`,
          value: JSON.stringify({ ids: Array.from(removedSet) }),
          content: { ids: Array.from(removedSet) },
          category: "work_orders",
          updated_at: new Date().toISOString(),
        }, { onConflict: "section_key" });
      } catch (e2) {
        console.warn("saveSupabaseWorkOrder removed registry warning:", e2);
      }
    }

    broadcastRealtimeChange("work_order_updated");
    const logItems = (Array.isArray(order.items) ? order.items : []).map((it: any) => ({
      d: String(it.description || "").slice(0, 18),
      q: it.quantity,
      disp: it.dispatched ? 1 : 0,
    }));
    const partsSum = (Array.isArray(order.items) ? order.items : []).reduce((s: number, it: any) => s + (Number(it.subtotal) || 0), 0);
    const certFeeSave = order.requires_certification ? (Number(order.certification_price) || 0) : 0;
    const discountSave = Number((order as any)?.discount_amount) || 0;
    logSystemEvent("info", "workorder.save.ok", {
      woId: String(order.id || "").slice(0, 8),
      status: order.status || "",
      plate: order.vehicle_plate || "",
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      // TOTAL CON DESCUENTO: items + certificación - descuento (lo que ve la card de Caja)
      total: Math.max(0, partsSum + certFeeSave - discountSave),
      gross: partsSum + certFeeSave,
      discount: discountSave,
      items: logItems.slice(0, 8),
      // Detalle completo para el diagnóstico: certificación, allow_mod, fechas
      requiresCert: !!order.requires_certification,
      certType: order.certification_type || "",
      certPrice: certFeeSave,
      allowMod: !!order.allow_modifications,
      entry: order.entry_time || "",
      completion: order.completion_time || "",
    }, "services:saveSupabaseWorkOrder");
    // TIMING del guardado de OT con DESGLOSE de fases (merge/select, upsert, snapshot)
    // para diagnosticar la fluidez Taller<->Almacén desde Configuración -> Ver Log.
    // Salta a "warn" si el save total tarda >1500ms (red lenta / cuello de botella).
    logTimingThreshold("workorder.save.duration", saveStart, 1500, {
      woId: String(order.id || "").slice(0, 8),
      plate: order.vehicle_plate || "",
      mergeMs,
      upsertMs,
      snapshotMs,
    }, "services:saveSupabaseWorkOrder");
    emitCloudSavedToast("Orden de trabajo guardada en la nube ✓");
  } catch (err) {
    logSystemEvent("error", "workorder.save.exception", {
      woId: String(order.id || "").slice(0, 8),
      err: err instanceof Error ? err.message : String(err),
    }, "services:saveSupabaseWorkOrder");
    console.warn("Supabase work order deferred:", err);
  }
  }); // <- fin del guardado serializado por OT
}

export async function deleteSupabaseWorkOrder(id: string) {
  try {
    // BORRADO EN CASCADA: al eliminar la OT de la Tabla Registro Taller se elimina
    // TODO lo vinculado, para que no queden huérfanos (bug: facturas/snapshots sin OT
    // seguían apareciendo en reportes y la Tabla Maestra al re-ingresar datos).
    // 1) Facturas de la OT (la tabla invoices no tiene FK en cascada)
    const invRes = await supabase.from("invoices").select("id").eq("work_order_id", id);
    const invIds = (invRes?.data || []).map((i: any) => i.id as string);
    await supabase.from("invoices").delete().eq("work_order_id", id);
    // 2) Snapshots de facturas (site_content): por id de factura Y por work_order_id
    const scKeys: string[] = [];
    invIds.forEach((invId) => {
      scKeys.push(`inv_full_${invId}`, `inv_breakdown_${invId}`, `inv_payhistory_${invId}`, `inv_resources_${invId}`);
    });
    scKeys.push(`inv_full_${id}`, `inv_breakdown_${id}`, `inv_payhistory_${id}`, `inv_resources_${id}`);
    for (const k of scKeys) {
      await supabase.from("site_content").delete().eq("key", k);
    }
    // 3) Certificaciones vinculadas a la OT (tabla + snapshot site_content)
    const certRes = await supabase.from("certifications").select("id").eq("work_order_id", id);
    const certIds = (certRes?.data || []).map((c: any) => c.id as string);
    await supabase.from("certifications").delete().eq("work_order_id", id);
    for (const cid of certIds) {
      await supabase.from("site_content").delete().eq("key", `cert_${cid}`);
      await supabase.from("site_content").delete().eq("section_key", `cert_${cid}`);
    }
    // 4) La OT misma
    const { error } = await supabase.from("work_orders").delete().eq("id", id);
    // 5) Snapshots + TOMBSTONE: se eliminan wo_mod_/wo_removed_ y se escribe
    // wo_deleted_<id> para que NINGÚN dispositivo con caché viejo re-cree la OT
    // al guardar (bug: "se borra pero al refrescar vuelve a aparecer").
    await supabase.from("site_content").delete().eq("key", `wo_mod_${id}`);
    await supabase.from("site_content").delete().eq("key", `wo_removed_${id}`);
    try {
      await saveSupabaseSiteContent(`wo_deleted_${id}`, { deleted: true, at: new Date().toISOString() }, "work_orders", false);
    } catch {}
    markWorkOrderDeletedLocal(id);
    // Broadcast INMEDIATO con el id: todas las tablets/pestañas conectadas quitan la
    // card al instante (postgres_changes DELETE es la vía principal; este refuerza).
    broadcastRealtimeChange("work_order_deleted", { deletedIds: [id] });
    if (error) console.warn("Supabase work order delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase work order delete deferred:", err);
  }
}

export async function deleteSupabaseMultipleWorkOrders(ids: string[]) {
  try {
    // Cascada: facturas + snapshots + certificaciones de las OTs borradas
    const invRes = await supabase.from("invoices").select("id").in("work_order_id", ids);
    const invIds = (invRes?.data || []).map((i: any) => i.id as string);
    await supabase.from("invoices").delete().in("work_order_id", ids);
    const scKeys: string[] = [];
    invIds.forEach((invId) => scKeys.push(`inv_full_${invId}`, `inv_breakdown_${invId}`, `inv_payhistory_${invId}`, `inv_resources_${invId}`));
    ids.forEach((id) => scKeys.push(`inv_full_${id}`, `inv_breakdown_${id}`, `inv_payhistory_${id}`, `inv_resources_${id}`));
    for (const k of scKeys) {
      await supabase.from("site_content").delete().eq("key", k);
    }
    const certRes = await supabase.from("certifications").select("id").in("work_order_id", ids);
    const certIds = (certRes?.data || []).map((c: any) => c.id as string);
    await supabase.from("certifications").delete().in("work_order_id", ids);
    for (const cid of certIds) {
      await supabase.from("site_content").delete().eq("key", `cert_${cid}`);
      await supabase.from("site_content").delete().eq("section_key", `cert_${cid}`);
    }
    const { error } = await supabase.from("work_orders").delete().in("id", ids);
    // Snapshots + tombstones de TODAS las OTs borradas (mismo fix anti-resurrección).
    for (const id of ids) {
      await supabase.from("site_content").delete().eq("key", `wo_mod_${id}`);
      await supabase.from("site_content").delete().eq("key", `wo_removed_${id}`);
      try {
        await saveSupabaseSiteContent(`wo_deleted_${id}`, { deleted: true, at: new Date().toISOString() }, "work_orders", false);
      } catch {}
      markWorkOrderDeletedLocal(id);
    }
    broadcastRealtimeChange("work_order_deleted", { deletedIds: ids });
    if (error) console.warn("Supabase multiple work orders delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase multiple work orders delete deferred:", err);
  }
}

export const deleteMultipleSupabaseWorkOrders = deleteSupabaseMultipleWorkOrders;

export async function clearSupabaseWorkOrders() {
  try {
    // Cascada total: borra TODAS las facturas, sus snapshots y certificaciones
    // (equivale a vaciar la Tabla Registro Taller completa).
    const invRes = await supabase.from("invoices").select("id");
    const invIds = (invRes?.data || []).map((i: any) => i.id as string);
    await supabase.from("invoices").delete().neq("id", "");
    for (const invId of invIds) {
      await supabase.from("site_content").delete().eq("key", `inv_full_${invId}`);
      await supabase.from("site_content").delete().eq("key", `inv_breakdown_${invId}`);
      await supabase.from("site_content").delete().eq("key", `inv_payhistory_${invId}`);
      await supabase.from("site_content").delete().eq("key", `inv_resources_${invId}`);
    }
    const certRes = await supabase.from("certifications").select("id");
    const certIds = (certRes?.data || []).map((c: any) => c.id as string);
    await supabase.from("certifications").delete().neq("id", "");
    for (const cid of certIds) {
      await supabase.from("site_content").delete().eq("key", `cert_${cid}`);
      await supabase.from("site_content").delete().eq("section_key", `cert_${cid}`);
    }
    const { error } = await supabase.from("work_orders").delete().neq("id", "");
    if (error) console.warn("Supabase work orders clear warning:", error.message);
  } catch (err) {
    console.warn("Supabase work orders clear deferred:", err);
  }
}

// ---------------------------------------------------------------------
// ELIMINAR UN ABONO (pago parcial) desde la Tabla Maestra
// Fuente única con el reporte diario: los abonos viven en site_content
// (inv_payhistory_<invoiceId> e inv_payhistory_<workOrderId>). Borrar el
// abono aquí lo elimina del reporte/informe del día siguiente de forma
// inmediata, y recalcula el saldo de la factura original (la OT se mantiene).
// ---------------------------------------------------------------------
export async function deleteSupabasePaymentRecord(paymentId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    // 1. Localizar TODOS los snapshots inv_payhistory_* que contienen el pago
    const phRes = await safeQuery<any[]>(
      supabase.from("site_content").select("key, section_key, value").like("key", "inv_payhistory_%")
    );
    const affectedKeys: string[] = [];
    let remainingHistory: any[] | null = null;
    let invoiceId = "";
    (phRes?.data || []).forEach((row: any) => {
      const k = row.key || row.section_key;
      if (!k || !k.startsWith("inv_payhistory_")) return;
      let raw: any = row.value;
      if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
      if (!Array.isArray(raw)) return;
      const found = raw.some((r: any) => r && r.id === paymentId);
      if (found) {
        affectedKeys.push(k);
        const invKey = k.replace("inv_payhistory_", "");
        if (!invoiceId) invoiceId = invKey;
        remainingHistory = raw.filter((r: any) => r && r.id !== paymentId);
      }
    });
    if (affectedKeys.length === 0) {
      return { ok: false, reason: "not_found" };
    }

    // 2. Recuperar la factura real (por id o por work_order_id del sufijo de la clave)
    let invoice: any = null;
    if (invoiceId) {
      const byId = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
      invoice = byId.data || null;
      if (!invoice) {
        const byWo = await supabase.from("invoices").select("*").eq("work_order_id", invoiceId).maybeSingle();
        invoice = byWo.data || null;
      }
    }

    // 3. Recalcular el estado de la factura sin ese abono
    if (invoice) {
      const hist = Array.isArray(remainingHistory) ? remainingHistory : [];
      const totalDue = Number(invoice.grand_total) || 0;
      const prevPaid = hist.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const balance = Math.max(0, totalDue - prevPaid);
      const isFullyPaid = balance <= 0.01;
      const updated: any = {
        ...invoice,
        payment_status: isFullyPaid ? "pagado" : "pendiente",
        payment_condition: isFullyPaid ? "PAGADO" : "PENDIENTE",
        credit_amount: isFullyPaid ? 0 : balance,
        payment_history: hist.length > 0 ? hist : undefined,
        paid_at: hist.length > 0 ? ((hist[hist.length - 1] as any)?.date || invoice.paid_at) : null,
      };
      await saveSupabaseInvoice(updated as Invoice);
    }

    // 4. Reescribir snapshots con el historial restante (o borrar si quedó vacío)
    for (const k of affectedKeys) {
      const arr = Array.isArray(remainingHistory) ? remainingHistory : [];
      if (arr.length > 0) {
        await saveSupabaseSiteContent(k, arr, "invoices", false);
      } else {
        await supabase.from("site_content").delete().eq("key", k);
      }
    }

    broadcastRealtimeChange("payment_deleted");
    emitCloudSavedToast("Abono eliminado de la Tabla Maestra ✓");
    return { ok: true };
  } catch (err) {
    console.warn("deleteSupabasePaymentRecord deferred:", err);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------
// VEHICLES SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseVehicle(v: Vehicle) {
  try {
    markLocalMutation("vehicles");
    const { error } = await supabase.from("vehicles").upsert({
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      fuel_type: v.fuel_type,
      owner_name: v.owner_name,
      owner_phone: v.owner_phone,
      current_mileage: v.current_mileage,
      last_visit_date: v.last_visit_date,
    });
    if (error) console.warn("Supabase vehicle save warning:", error.message);
    broadcastRealtimeChange("vehicle_updated");
    emitCloudSavedToast("Vehículo guardado en la nube ✓");
  } catch (err) {
    console.warn("Supabase vehicle deferred:", err);
  }
}

// Lee UN vehículo por placa desde la nube (para updateVehicle cuando el registro
// quedó FUERA de la ventana operativa: el fetch operativo capa a 400 por
// last_visit_date y una placa antigua no está en el store local).
export async function fetchSupabaseVehicleByPlate(plate: string): Promise<Vehicle | null> {
  try {
    const { data } = await supabase.from("vehicles").select("*").eq("plate", plate).maybeSingle();
    if (data) return data as Vehicle;
    const r2 = await supabase.from("vehicles").select("*").ilike("plate", plate).limit(1);
    return (r2.data && r2.data[0]) ? (r2.data[0] as Vehicle) : null;
  } catch (err) {
    console.warn("fetchSupabaseVehicleByPlate:", err);
    return null;
  }
}

async function safeQuery<T = any>(queryPromise: PromiseLike<{ data: T | null; error: any }> | any): Promise<{ data: T | null; error: any }> {
  try {
    return await queryPromise;
  } catch (err: any) {
    console.warn("Supabase table query failed (table might not exist in database):", err?.message || err);
    return { data: null, error: err };
  }
}

// Generic high-speed batch fetcher for tables with > 1000 records (Zero slow COUNT(*) locks)
// Descarga las páginas restantes en LOTES CONCURRENTES (5 a la vez) para reducir el
// tiempo de arranque ~5x en la tablet, sin saturar la conexión del dispositivo.
async function fetchAllSupabaseTable(tableName: string, concurrency = 5) {
  try {
    const PAGE_SIZE = 1000;

    // 1. Fetch initial batch (0..999) without expensive count: "exact" table scan
    const { data: firstBatch, error: firstErr } = await supabase
      .from(tableName)
      .select("*")
      .range(0, PAGE_SIZE - 1);

    if (firstErr) {
      console.warn(`Supabase fetch notice for ${tableName}:`, firstErr.message);
      return [];
    }

    if (!firstBatch || firstBatch.length === 0) return [];
    if (firstBatch.length < PAGE_SIZE) return firstBatch;

    // 2. Fetch all remaining pages concurrently (sin tope). La nube es la fuente única
    // de la verdad: el registro de taller puede superar los 2000 registros y ninguno
    // debe perderse. Las páginas son deterministas (range) y Promise.all preserva orden.
    let allRecords = [...firstBatch];
    let offset = PAGE_SIZE;
    outer: while (true) {
      const tasks: Array<PromiseLike<any>> = [];
      for (let i = 0; i < concurrency; i++) {
        tasks.push(
          supabase
            .from(tableName)
            .select("*")
            .range(offset + i * PAGE_SIZE, offset + i * PAGE_SIZE + PAGE_SIZE - 1)
        );
      }
      const results = await Promise.all(tasks);
      let lastCount = 0;
      for (const res of results) {
        if (res.error || !res.data || res.data.length === 0) break outer;
        allRecords = allRecords.concat(res.data);
        lastCount = res.data.length;
      }
      if (lastCount < PAGE_SIZE) break;
      offset += concurrency * PAGE_SIZE;
    }

    return allRecords;
  } catch (err) {
    console.warn(`Supabase pagination fetch deferred for table ${tableName}:`, err);
    return [];
  }
}

/**
 * Fast Real-time Query for Consultas (Loads specific date or plate in ~30ms directly from PostgreSQL)
 */
export async function fetchSupabaseConsultasRealtime(queryDate?: string, searchPlate?: string) {
  try {
    let orderQuery = supabase.from("work_orders").select("*");
    let invoiceQuery = supabase.from("invoices").select("*");
    let vehicleQuery = supabase.from("vehicles").select("*");

    const cleanPlate = searchPlate ? searchPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";

    if (cleanPlate) {
      orderQuery = orderQuery.ilike("vehicle_plate", `%${cleanPlate}%`);
      invoiceQuery = invoiceQuery.ilike("vehicle_plate", `%${cleanPlate}%`);
      vehicleQuery = vehicleQuery.ilike("plate", `%${cleanPlate}%`);
    } else if (queryDate) {
      // Día PERUANO completo en UTC: [día 05:00 UTC, día+1 05:00 UTC)
      const nextDay = nextPeruDay(queryDate);
      orderQuery = orderQuery
        .gte("entry_time", `${queryDate}T05:00:00`)
        .lt("entry_time", `${nextDay}T05:00:00`);
      invoiceQuery = invoiceQuery
        .gte("issued_at", `${queryDate}T05:00:00`)
        .lt("issued_at", `${nextDay}T05:00:00`);
    }

    const [ordersRes, invoicesRes, vehiclesRes] = await Promise.all([
      orderQuery.limit(300),
      invoiceQuery.limit(300),
      vehicleQuery.limit(300),
    ]);

    const formattedOrders = (ordersRes.data || []).map((o: any) => {
      const rawDiag = o.diagnostic_notes || "";
      let diagNotes = rawDiag;
      let obs = "";
      let allowMod = false;
      if (diagNotes.includes("[ALLOW_MOD]: true")) {
        allowMod = true;
        diagNotes = diagNotes.replace("[ALLOW_MOD]: true", "").trim();
      }
      if (diagNotes.includes("[OBSERVACIONES]:")) {
        const parts = diagNotes.split("[OBSERVACIONES]:");
        diagNotes = parts[0].trim();
        obs = parts[1].trim();
      }
      return {
        ...o,
        allow_modifications: allowMod || !!o.allow_modifications,
        diagnostic_notes: diagNotes,
        observations: obs || o.observations || undefined,
        items: typeof o.items === "string" ? JSON.parse(o.items || "[]") : o.items || [],
      };
    });

    return {
      workOrders: formattedOrders,
      invoices: invoicesRes.data || [],
      vehicles: vehiclesRes.data || [],
    };
  } catch (err) {
    console.warn("Real-time consultas fetch warning:", err);
    return null;
  }
}

// ---------------------------------------------------------------------
// REPORTE DIARIO DIRIGIDO POR FECHA (Informe de Taller & Caja)
// Consulta SOLO las órdenes de trabajo y facturas del día seleccionado
// en Supabase (en vez de descargar las 41k+ filas del sync global),
// logrando que la pestaña de reporte cargue en <1s en la tablet.
// ---------------------------------------------------------------------
export interface DayPaymentIncome {
  id: string;
  date: string;                    // Fecha del abono (debe coincidir con el día consultado)
  amount: number;                  // Monto abonado ese día
  method: string;                  // Efectivo | Yape | Transferencia | Culqi | Mixto (...)
  destination: string;             // EMPRESA | CAJA | PERSONAL
  receipt_number?: string;         // N° de comprobante del abono
  receipt_type?: string;           // Ticket | Boleta | Factura | Sin Comprobante
  reference?: string;              // Nota / desglose del pago
  payment_breakdown?: any[];       // Desglose de métodos mixtos (si existe en la factura)
  resources?: any[];               // Vínculo recurso -> pago del abono (desde 17/08/2026)
  plate: string;                   // Placa del vehículo de la factura original
  client_name: string;             // Cliente de la factura original
  description: string;             // Descripción / referencia del abono
  invoice_id: string;              // Id de la factura original
  work_order_id: string;           // Id de la orden de trabajo original
  issued_at: string;               // Fecha de emisión de la factura original
}

export interface DayReportData {
  workOrders: WorkOrder[];
  invoices: Invoice[];
  payments: DayPaymentIncome[];    // Abonos parciales recibidos HOY sobre facturas de días anteriores
  expenses: DailyExpense[];        // Gastos del día (egresos de caja)
}

export async function fetchSupabaseDayReport(dateISO: string): Promise<DayReportData | null> {
  try {
    const cleanDate = (dateISO || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;

    // Límite exclusivo al día siguiente: paridad exacta con el filtro en
    // memoria .slice(0,10) === selectedDate (evita perder/repetir registros
    // en los bordes de medianoche).
    const next = new Date(cleanDate + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    const nextDayISO = next.toISOString().slice(0, 10);

    // Día PERUANO en UTC: Perú (UTC-5) empieza el día a las 05:00 UTC. Un ingreso
    // nocturno (ej. 19/08 20:45 Perú = 20/08 01:45 UTC) debe contar en el día 19/08.
    const peruDayStartUTC = `${cleanDate}T05:00:00`;
    const nextDayStartUTC = `${nextDayISO}T05:00:00`;
    const [ordersRes, invoicesRes, payhistRes, dayExpenses] = await Promise.all([
      supabase
        .from("work_orders")
        .select("*")
        .gte("entry_time", peruDayStartUTC)
        .lt("entry_time", nextDayStartUTC),
      supabase
        .from("invoices")
        .select("*")
        .gte("issued_at", peruDayStartUTC)
        .lt("issued_at", nextDayStartUTC),
      // Roster de abonos parciales (payment_history) persistido en site_content.
      // Se consulta por prefijo de clave para hallar los abonos recibidos HOY
      // sobre facturas emitidas en días anteriores (ingresos reales del día).
      safeQuery<any[]>(
        supabase
          .from("site_content")
          .select("key, section_key, value, content")
          .like("key", "inv_payhistory_%")
      ),
      // Gastos del día (egresos de caja) persistidos en site_content
      fetchDailyExpenses(cleanDate),
    ]);

    if (ordersRes.error) console.warn("Day report work_orders warning:", ordersRes.error.message);
    if (invoicesRes.error) console.warn("Day report invoices warning:", invoicesRes.error.message);

    // Reutiliza el mismo formateo del sync global (parseo de items,
    // ERP_META, ALLOW_MOD, etc.) para que el reporte muestre datos idénticos.
    const workOrders = (ordersRes.data || []).map((o: any) => formatWorkOrderTableRow(o));
    const rawInvoices = (invoicesRes.data || []) as any[];

    // Fusionar el DESGLOSE de pagos (inv_breakdown_*) desde site_content: la tabla invoices
    // no tiene esa columna. Sin esto el informe diario no vería cada comprobante de un pago
    // mixto multi-ticket (ej. ticket 4585 / TK01-00004585 de BVZ-412).
    const bdMap = new Map<string, any[]>();
    const phMap = new Map<string, any[]>();
    const rsMap = new Map<string, any[]>();
    if (rawInvoices.length > 0) {
      try {
        const bdKeys = rawInvoices.map((i: any) => `inv_breakdown_${i.id}`);
        const phKeys = rawInvoices.map((i: any) => `inv_payhistory_${i.id}`);
        const rsKeys = rawInvoices.map((i: any) => `inv_resources_${i.id}`);
        const bdRes = await supabase.from("site_content").select("key, value").in("key", [...bdKeys, ...phKeys, ...rsKeys]);
        (bdRes.data || []).forEach((row: any) => {
          const k = row.key || row.section_key;
          if (!k) return;
          let val: any = row.value;
          if (typeof val === "string") {
            try { val = JSON.parse(val); } catch { val = undefined; }
          }
          if (!Array.isArray(val)) return;
          if (k.startsWith("inv_breakdown_")) bdMap.set(k.replace("inv_breakdown_", ""), val);
          else if (k.startsWith("inv_payhistory_")) phMap.set(k.replace("inv_payhistory_", ""), val);
          else if (k.startsWith("inv_resources_")) rsMap.set(k.replace("inv_resources_", ""), val);
        });
      } catch (err) {
        console.warn("Day report breakdown/payhistory/resources merge warning:", err);
      }
    }

    const invoices = rawInvoices.map((inv: any) => {
      let paymentBreakdown: any = bdMap.get(inv.id) || inv.payment_breakdown;
      if (typeof paymentBreakdown === "string") {
        try { paymentBreakdown = JSON.parse(paymentBreakdown); } catch { paymentBreakdown = undefined; }
      }
      const payHistory = phMap.get(inv.id) || (Array.isArray(inv.payment_history) ? inv.payment_history : undefined);
      const resourcePayments = rsMap.get(inv.id) || (Array.isArray((inv as any).resource_payments) ? (inv as any).resource_payments : undefined);
      return {
        ...inv,
        resource_payments: resourcePayments,
        issued_at: toPeruAnchoredISO(inv.issued_at) || inv.issued_at,
        paid_at: toPeruAnchoredISO(inv.paid_at) || inv.paid_at || undefined,
        payment_method: cleanMethodDisplay(inv.payment_method),
        payment_history: Array.isArray(payHistory)
          ? payHistory.map((r: any) => ({ ...r, date: toPeruAnchoredISO(r.date) || r.date, method: cleanMethodDisplay(r.method, Number(r.amount) || 0) }))
          : payHistory,
        payment_breakdown: Array.isArray(paymentBreakdown)
          ? paymentBreakdown.map((s: any) => ({ ...s, method: cleanMethodDisplay(s.method, Number(s.amount) || 0) }))
          : paymentBreakdown,
      } as Invoice;
    });

    // --- Abonos parciales del día (payment_history) sobre facturas de días anteriores ---
    // Cada factura con abonos guarda 2 claves: inv_payhistory_<id> e inv_payhistory_<work_order_id>.
    // Se deduplica por el id único de cada PaymentRecord para no contar dos veces el mismo abono.
    const paymentMap = new Map<string, { rec: any; invKey: string }>();
    (payhistRes?.data || []).forEach((row: any) => {
      const k = row.key || row.section_key;
      if (!k || !k.startsWith("inv_payhistory_")) return;
      const invKey = k.replace("inv_payhistory_", "");
      let raw: any = row.value;
      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch { raw = null; }
      }
      if (Array.isArray(raw)) {
        raw.forEach((rec: any) => {
          if (rec && rec.id && !paymentMap.has(rec.id)) paymentMap.set(rec.id, { rec, invKey });
        });
      }
    });

    const dayRecs = Array.from(paymentMap.values()).filter(({ rec }) => toPeruDateKey(rec.date) === cleanDate);

    // Enriquecer cada abono con datos de su factura original (placa, cliente, descripción).
    const invKeys = dayRecs.map(({ invKey }) => invKey);
    const invoiceLookup = new Map<string, any>();
    if (invKeys.length > 0) {
      try {
        const uniqueKeys = Array.from(new Set(invKeys)).slice(0, 80);
        const listParam = uniqueKeys.map((k) => `"${k}"`).join(",");
        const invRes = await supabase
          .from("invoices")
          .select("*")
          .or(`id.in.(${listParam}),work_order_id.in.(${listParam})`);
        (invRes.data || []).forEach((i: any) => {
          if (i.id) invoiceLookup.set(i.id, i);
          if (i.work_order_id) invoiceLookup.set(i.work_order_id, i);
        });
      } catch (err) {
        console.warn("Day report abonos lookup warning:", err);
      }
    }

    const payments: DayPaymentIncome[] = dayRecs
      .map(({ rec, invKey }): DayPaymentIncome | null => {
        const inv = invoiceLookup.get(invKey) || {};
        // BUG FIX: si la factura ya NO existe en la base (fue eliminada), su snapshot
        // de historial quedó huérfano y NO es un ingreso real del día (caso AUH-440:
        // la OT/factura viejas se eliminaron pero su inv_payhistory_ seguía sumando
        // un "abono de 270" fantasma en el informe del 18/08).
        if (!inv || !inv.id) return null;
        const issuedDay = toPeruDateKey(inv.issued_at);
        // Si la factura fue emitida HOY, su cobro ya está contado en `invoices`
        // del día: se excluye para evitar doble conteo en la liquidación.
        if (issuedDay === cleanDate) return null;
        return {
          id: rec.id,
          date: rec.date || "",
          amount: Number(rec.amount) || 0,
          method: cleanMethodDisplay(rec.method, Number(rec.amount) || 0) || "Efectivo",
          destination: rec.destination || "EMPRESA",
          receipt_number: rec.receipt_number || "",
          receipt_type: rec.receipt_type || "",
          reference: rec.reference || "",
          payment_breakdown: Array.isArray(inv.payment_breakdown) ? inv.payment_breakdown : undefined,
          resources: Array.isArray((rec as any).resources) ? (rec as any).resources : undefined,
          plate: (inv.vehicle_plate || "").toUpperCase(),
          client_name: inv.client_name || "",
          description:
            (inv.observations || inv.notes || (inv.receipt_number ? `Abono a factura ${inv.receipt_number}` : "Abono a factura pendiente")) ||
            "Abono a factura pendiente",
          invoice_id: inv.id || invKey,
          work_order_id: inv.work_order_id || "",
          issued_at: inv.issued_at || "",
        };
      })
      .filter((p): p is DayPaymentIncome => Boolean(p && p.amount > 0));

    return { workOrders, invoices, payments, expenses: dayExpenses || [] };
  } catch (err) {
    console.warn("Day report fetch warning:", err);
    return null;
  }
}

// ---------------------------------------------------------------------
// MASTER TABLE SERVER-SIDE PAGINATION (Registros del Taller)
// Carga solo la página activa (250 filas) + conteo + vehículos/facturas
// relacionadas. Evita descargar las 41k+ work_orders e invoices en cada
// sync global, logrando una carga de tabla instantánea en la tablet.
// ---------------------------------------------------------------------
export interface MasterTablePageParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  timeFilter?: "todos" | "hoy" | "fecha" | "rango";
  queryDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface MasterTablePageResult {
  rows: WorkOrder[];
  total: number;
  vehicles: Vehicle[];
  invoices: Invoice[];
  /** Abonos (pagos parciales con su propio comprobante) del rango consultado: cada uno
   *  con fecha propia, placa, monto y método, para mostrarlos como registros en la
   *  Tabla Maestra (fuente única con el reporte diario: inv_payhistory_*). */
  abonos?: MasterAbonoRow[];
}

/** Fila de ABONO en la Tabla Maestra: un pago parcial recibido en la fecha indicada
 *  contra una factura (que puede ser de un día anterior). Al borrarlo desde la Tabla
 *  Maestra se elimina del reporte diario (misma fuente: inv_payhistory_*). */
export interface MasterAbonoRow {
  /** id del PaymentRecord (rec.id) */
  id: string;
  /** Fecha del abono (ISO, hora Perú) */
  date: string;
  amount: number;
  method: string;
  destination: string;
  receipt_number: string;
  receipt_type: string;
  invoice_id: string;
  work_order_id: string;
  vehicle_plate: string;
  client_name: string;
}

function formatWorkOrderTableRow(o: any): WorkOrder {
  const rawDiag = o.diagnostic_notes || "";
  let diagNotes = rawDiag;
  let obs = "";
  let allowMod = false;
  let quinquennialDate = o.quinquennial_date || "";
  let chipExpiryDate = o.chip_expiry_date || "";
  let vehicleType = o.vehicle_type || "";
  let generalMaintenanceService = o.general_maintenance_service || o.problem_description || "";
  let sparePartsServices = o.spare_parts_services || "";

  // Decode [ERP_META]: JSON if present
  if (diagNotes.includes("[ERP_META]:")) {
    try {
      const metaStr = diagNotes.split("[ERP_META]:")[1].trim();
      const meta = JSON.parse(metaStr);
      if (meta) {
        quinquennialDate = o.quinquennial_date || meta.q_date || meta.quinquennial_date || quinquennialDate;
        chipExpiryDate = o.chip_expiry_date || meta.c_date || meta.chip_expiry_date || chipExpiryDate;
        vehicleType = o.vehicle_type || meta.v_type || meta.vehicle_type || vehicleType;
        generalMaintenanceService = o.general_maintenance_service || meta.m_serv || meta.general_maintenance_service || generalMaintenanceService;
        sparePartsServices = o.spare_parts_services || meta.sp_serv || meta.spare_parts_services || sparePartsServices;
      }
      diagNotes = diagNotes.split("[ERP_META]:")[0].trim();
    } catch (e) {
      // ignore parse error
    }
  }

  // Legacy fallback parsing from textual diagnostic_notes
  if (!quinquennialDate && diagNotes.includes("Quinquenal:")) {
    const match = diagNotes.match(/Quinquenal:\s*([^•\n]+)/);
    if (match) quinquennialDate = match[1].trim();
  }
  if (!chipExpiryDate && diagNotes.includes("Chip Anual:")) {
    const match = diagNotes.match(/Chip Anual:\s*([^•\n]+)/);
    if (match) chipExpiryDate = match[1].trim();
  }

  if (diagNotes.includes("[ALLOW_MOD]: true")) {
    allowMod = true;
    diagNotes = diagNotes.replace("[ALLOW_MOD]: true", "").trim();
  }
  if (diagNotes.includes("[OBSERVACIONES]:")) {
    const parts = diagNotes.split("[OBSERVACIONES]:");
    diagNotes = parts[0].trim();
    obs = parts[1].trim();
  }

  let parsedItems: any[] = [];
  try {
    parsedItems = typeof o.items === "string" ? JSON.parse(o.items || "[]") : o.items || [];
  } catch {
    parsedItems = [];
  }

  const orderDateStr = (o.entry_time || "").slice(0, 10);
  const isMigratedOrBilled =
    (orderDateStr && orderDateStr <= "2026-08-08") ||
    o.status === "finalizado" ||
    o.status === "entregado";

  const items = parsedItems.map((it: any) => {
    if (isMigratedOrBilled && (it.dispatched === undefined || it.dispatched === null || it.dispatched === false)) {
      return {
        ...it,
        dispatched: true,
        dispatched_at: it.dispatched_at || o.entry_time || new Date().toISOString(),
      };
    }
    return it;
  });

  return {
    ...o,
    quinquennial_date: quinquennialDate || o.quinquennial_date || "",
    chip_expiry_date: chipExpiryDate || o.chip_expiry_date || "",
    vehicle_type: vehicleType || o.vehicle_type || "",
    general_maintenance_service: generalMaintenanceService || o.general_maintenance_service || "",
    spare_parts_services: sparePartsServices || o.spare_parts_services || "",
    discount_amount: o.discount_amount !== undefined && o.discount_amount !== null ? Number(o.discount_amount) : 0,
    allow_modifications: allowMod || !!o.allow_modifications,
    diagnostic_notes: diagNotes,
    observations: obs || o.observations || undefined,
    items,
    // FIX PERÚ/UTC: la base devuelve entry_time en UTC (+00:00); se re-ancla a -05:00
    // para que los filtros por fecha (slice(0,10)) vean el día correcto de Perú, incluso
    // para ingresos nocturnos (ej. 19/08 20:45 en Perú = 20/08 01:45 UTC).
    entry_time: toPeruAnchoredISO(o.entry_time) || o.entry_time,
    completion_time: toPeruAnchoredISO(o.completion_time) || o.completion_time || undefined,
  } as WorkOrder;
}

function escapePostgrestTerm(term: string): string {
  // Remueve caracteres que rompen la sintaxis de filtros PostgREST ((), comas, comillas)
  return term.replace(/[(),"']/g, "");
}

// Siguiente día (YYYY-MM-DD) de una fecha dada (para rangos PERUANOS en UTC)
function nextPeruDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchMasterTablePage(params: MasterTablePageParams): Promise<MasterTablePageResult | null> {
  try {
    const { page, pageSize, searchTerm, timeFilter, queryDate, startDate, endDate } = params;
    const cleanTerm = escapePostgrestTerm((searchTerm || "").trim().toUpperCase());

    // 1. Query base (se reconstruye por si la búsqueda exige un OR compuesto)
    let pageQuery: any = supabase.from("work_orders").select("*");
    let countQuery: any = supabase.from("work_orders").select("id", { count: "exact", head: true });

    const applyDateFilters = (q: any) => {
      if (timeFilter === "hoy" && queryDate) {
        // Día PERUANO: Perú (UTC-5) empieza el día a las 05:00 UTC
        q = q.gte("entry_time", `${queryDate}T05:00:00`).lt("entry_time", `${nextPeruDay(queryDate)}T05:00:00`);
      } else if (timeFilter === "fecha" && queryDate) {
        q = q.gte("entry_time", `${queryDate}T05:00:00`).lt("entry_time", `${nextPeruDay(queryDate)}T05:00:00`);
      } else if (timeFilter === "rango" && (startDate || endDate)) {
        if (startDate) q = q.gte("entry_time", `${startDate}T05:00:00`);
        if (endDate) q = q.lt("entry_time", `${nextPeruDay(endDate)}T05:00:00`);
      }
      return q;
    };

    // 2. Búsqueda por placa, cliente o comprobante
    // Búsqueda desde las 3 primeras letras (petición del usuario). Con menos de 3
    // caracteres no se filtra (se muestra la vista por defecto).
    if (cleanTerm && cleanTerm.length >= 3) {
      const orClauses: string[] = [`vehicle_plate.ilike.%${cleanTerm}%`];

      // Cliente o comprobante en invoices → ids de OTs candidatas.
      // NOTA: la tabla work_orders NO tiene columna work_order_id; el id de la OT es su
      // columna "id". Antes se filtraba work_order_id.in.(...) y la consulta FALLABA
      // (tabla vacía) cuando había coincidencia de facturas (caso "bxd").
      const invLike = supabase
        .from("invoices")
        .select("work_order_id")
        .or(`client_name.ilike.%${cleanTerm}%,receipt_number.ilike.%${cleanTerm}%`)
        .limit(1000);
      const invRes = await invLike;
      const ids = ((invRes.data || []) as any[])
        .map((i) => i.work_order_id)
        .filter((id): id is string => !!id && id.length > 0);
      if (ids.length > 0) {
        orClauses.push(`id.in.(${ids.map((id) => `"${id}"`).join(",")})`);
      }

      // Cliente en vehicles → plates candidatos
      const vehLike = supabase
        .from("vehicles")
        .select("plate")
        .ilike("owner_name", `%${cleanTerm}%`)
        .limit(1000);
      const vehRes = await vehLike;
      const plates = ((vehRes.data || []) as any[])
        .map((v) => v.plate)
        .filter((p): p is string => !!p && p.length > 0);
      if (plates.length > 0) {
        orClauses.push(`vehicle_plate.in.(${plates.map((p) => `"${p}"`).join(",")})`);
      }

      const orFilter = orClauses.join(",");
      pageQuery = supabase.from("work_orders").select("*").or(orFilter);
      countQuery = supabase.from("work_orders").select("id", { count: "exact", head: true }).or(orFilter);
    }

    // Re-aplicar filtros de fecha (la búsqueda reconstruyó las queries)
    pageQuery = applyDateFilters(pageQuery);
    countQuery = applyDateFilters(countQuery);

    // 3. Conteo total (rápido, solo ids con head=true)
    const countRes = await countQuery;
    const total = countRes.count ?? 0;

    if (total === 0) {
      return { rows: [], total: 0, vehicles: [], invoices: [] };
    }

    // 4. Página activa (ordenada por fecha de ingreso descendente)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const pageRes = await pageQuery.order("entry_time", { ascending: false }).range(from, to);

    if (pageRes.error) {
      console.warn("Master table page fetch warning:", pageRes.error.message);
      return null;
    }

    const rows = ((pageRes.data || []) as any[]).map((o) => formatWorkOrderTableRow(o));

    // 5. Vehículos y facturas relacionadas a la página (solo las necesarias)
    const orderIds = rows.map((r) => r.id).filter((id) => !!id);
    const plates = rows.map((r) => r.vehicle_plate).filter((p) => !!p);
    let vehicles: Vehicle[] = [];
    let invoices: Invoice[] = [];
    if (plates.length > 0) {
      const vehRes = await supabase.from("vehicles").select("*").in("plate", plates);
      if (vehRes.data) vehicles = vehRes.data as Vehicle[];
    }
    if (orderIds.length > 0) {
      const invRes = await supabase.from("invoices").select("*").in("work_order_id", orderIds);
      if (invRes.data) invoices = invRes.data as Invoice[];
    }

    // Fusionar el DESGLOSE de pagos (inv_breakdown_*) desde site_content: la tabla invoices
    // no tiene esa columna. Así cada comprobante (ticket/boleta/factura) de un pago mixto
    // se puede mostrar en su propia fila en la Tabla Maestra.
    if (invoices.length > 0) {
      try {
        const bdKeys = invoices.map((i) => `inv_breakdown_${i.id}`);
        const phKeys = invoices.map((i) => `inv_payhistory_${i.id}`);
        const rsKeys = invoices.map((i) => `inv_resources_${i.id}`);
        const scRes = await supabase.from("site_content").select("key, value").in("key", [...bdKeys, ...phKeys, ...rsKeys]);
        const bdMap = new Map<string, any[]>();
        const phMap = new Map<string, any[]>();
        const rsMap = new Map<string, any[]>();
        (scRes.data || []).forEach((row: any) => {
          const k = row.key || row.section_key;
          if (!k) return;
          let val: any = row.value;
          if (typeof val === "string") {
            try { val = JSON.parse(val); } catch { val = undefined; }
          }
          if (!Array.isArray(val)) return;
          if (k.startsWith("inv_breakdown_")) bdMap.set(k.replace("inv_breakdown_", ""), val);
          else if (k.startsWith("inv_payhistory_")) phMap.set(k.replace("inv_payhistory_", ""), val);
          else if (k.startsWith("inv_resources_")) rsMap.set(k.replace("inv_resources_", ""), val);
        });
        invoices = invoices.map((i: any) => ({
          ...i,
          payment_breakdown: bdMap.get(i.id) || (Array.isArray(i.payment_breakdown) ? i.payment_breakdown : undefined),
          payment_history: phMap.get(i.id) || undefined,
          resource_payments: rsMap.get(i.id) || (Array.isArray(i.resource_payments) ? i.resource_payments : undefined),
        }));
      } catch (err) {
        console.warn("Master table breakdown merge warning:", err);
      }
    }

    // 6. ABONOS del rango (pagos parciales con fecha propia): se consultan desde los
    // snapshots inv_payhistory_* (la MISMA fuente que usa el reporte diario) para que
    // cada abono aparezca como registro propio en la Tabla Maestra con su fecha,
    // comprobante y monto. Solo se muestran abonos cuya factura EXISTE (fuente única:
    // si la factura/OT se borró, su abono ya no es un ingreso real y no se lista).
    let abonos: MasterAbonoRow[] = [];
    try {
      const phRes = await safeQuery<any[]>(
        supabase.from("site_content").select("key, section_key, value").like("key", "inv_payhistory_%")
      );
      const allRecs: { rec: any; invKey: string }[] = [];
      const seenRec = new Set<string>();
      (phRes?.data || []).forEach((row: any) => {
        const k = row.key || row.section_key;
        if (!k || !k.startsWith("inv_payhistory_")) return;
        const invKey = k.replace("inv_payhistory_", "");
        let raw: any = row.value;
        if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
        if (!Array.isArray(raw)) return;
        raw.forEach((rec: any) => {
          if (rec && rec.id && !seenRec.has(rec.id)) {
            seenRec.add(rec.id);
            allRecs.push({ rec, invKey });
          }
        });
      });

      // Filtrar por fecha del ABONO segun el filtro activo (dia PERUANO)
      const dateInRange = (d: string) => {
        const key = toPeruDateKey(d);
        if ((timeFilter === "hoy" || timeFilter === "fecha") && queryDate) return key === queryDate;
        if (timeFilter === "rango") {
          if (startDate && key < startDate) return false;
          if (endDate && key > endDate) return false;
          return true;
        }
        return true; // "todos"
      };
      const dayRecs = allRecs.filter(({ rec }) => dateInRange(rec.date));

      // Enriquecer con la factura (placa, cliente) por id o work_order_id del sufijo
      const invKeys = Array.from(new Set(dayRecs.map(({ invKey }) => invKey)));
      const invLookup = new Map<string, any>();
      if (invKeys.length > 0) {
        for (let i = 0; i < invKeys.length; i += 60) {
          const chunk = invKeys.slice(i, i + 60);
          const listParam = chunk.map((k) => '"' + k + '"').join(",");
          const invRes = await supabase
            .from("invoices")
            .select("*")
            .or('id.in.(' + listParam + '),work_order_id.in.(' + listParam + ')');
          (invRes.data || []).forEach((inv: any) => {
            if (inv.id) invLookup.set(inv.id, inv);
            if (inv.work_order_id) invLookup.set(inv.work_order_id, inv);
          });
        }
      }

      abonos = dayRecs
        .map(({ rec, invKey }): MasterAbonoRow | null => {
          const inv = invLookup.get(invKey);
          if (!inv || !inv.id) return null; // huerfano: no mostrar
          const amt = Number(rec.amount) || 0;
          if (amt <= 0) return null;
          return {
            id: rec.id,
            date: rec.date || "",
            amount: amt,
            method: cleanMethodDisplay(rec.method, amt) || rec.method || "Efectivo",
            destination: rec.destination || inv.payment_destination || "EMPRESA",
            receipt_number: rec.receipt_number ? String(rec.receipt_number) : "",
            receipt_type: rec.receipt_type || inv.receipt_type || "",
            invoice_id: inv.id,
            work_order_id: inv.work_order_id || "",
            vehicle_plate: (inv.vehicle_plate || "").toUpperCase(),
            client_name: inv.client_name || "",
          };
        })
        .filter((a): a is MasterAbonoRow => Boolean(a))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      // Si hay busqueda activa, filtrar abonos por placa/cliente/comprobante
      if (cleanTerm && cleanTerm.length >= 3) {
        abonos = abonos.filter((ab) => {
          const hay = [ab.vehicle_plate, ab.client_name, ab.receipt_number].join(" ").toUpperCase();
          return hay.includes(cleanTerm);
        });
      }
    } catch (err) {
      console.warn("Master table abonos fetch warning:", err);
    }

    return { rows, total, vehicles, invoices, abonos };
  } catch (err) {
    console.warn("Master table page fetch warning:", err);
    return null;
  }
}

// Singleton subscribed Realtime broadcast channel for ultra-low latency (<50ms) messaging
// CON reconexión automática: si el WebSocket se desconecta (corte WiFi, tablet en
// hibernación), se re-suscribe el MISMO canal (los listeners del sync provider siguen
// vivos en el objeto). Backoff: 3s → 6s → 12s → 20s máximo.
let sharedRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeReconnectAttempts = 0;
let realtimeReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRealtimeReconnect() {
  if (realtimeReconnectTimer) return;
  const backoffMs = Math.min(3000 * Math.pow(2, realtimeReconnectAttempts), 20000);
  realtimeReconnectAttempts++;
  logRealtimeStatus("RECONNECTING", { backoffMs, attempts: realtimeReconnectAttempts });
  realtimeReconnectTimer = setTimeout(() => {
    realtimeReconnectTimer = null;
    if (sharedRealtimeChannel) {
      // Re-suscribir el MISMO canal (no destruir: los .on() del provider siguen)
      sharedRealtimeChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeReconnectAttempts = 0;
          logRealtimeStatus("SUBSCRIBED", { reconnected: true });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          scheduleRealtimeReconnect();
        }
      });
    }
  }, backoffMs);
}

export function getSharedRealtimeChannel() {
  if (!sharedRealtimeChannel) {
    sharedRealtimeChannel = supabase.channel("global-erp-sync", {
      config: { broadcast: { self: false } },
    });
    sharedRealtimeChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        realtimeReconnectAttempts = 0;
        if (realtimeReconnectTimer) {
          clearTimeout(realtimeReconnectTimer);
          realtimeReconnectTimer = null;
        }
        logRealtimeStatus("SUBSCRIBED");
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        // Canal perdido: programar reconexión con backoff
        scheduleRealtimeReconnect();
      }
    });
  }
  return sharedRealtimeChannel;
}

// Memoria de sesión: si la tabla appointments no existe (404 PGRST205), no repetir
// la petición REST en cada sync (elimina el "Failed to load resource: 404" del navegador).
let appointmentsTableMissing = false;

function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || error.error_description || "");
  return code === "PGRST205" || /does not exist|relation .* does not exist|not found/i.test(msg);
}

async function queryAppointmentsWithMissingGuard(): Promise<{ data: any[] | null; error: any }> {
  if (appointmentsTableMissing) {
    return { data: null, error: { code: "PGRST205", message: "appointments table missing (cached)" } };
  }
  const res = await safeQuery<any[]>(supabase.from("appointments").select("*"));
  if (isTableMissingError(res.error)) {
    appointmentsTableMissing = true;
  }
  return res;
}

// Broadcast instant real-time signal to ALL devices/tablets (cross-device):
// 1) Canal Realtime de Supabase (WebSocket) -> llega a TODAS las tablets/dispositivos
//    conectados (latencia <50ms). Este es el mecanismo PRINCIPAL y obligatorio.
// 2) BroadcastChannel nativo del navegador -> EXTRA solo para pestañas del mismo
//    navegador (no se suspende con el tab-throttling). Nunca reemplaza al canal cloud.
export async function broadcastRealtimeChange(eventType: string = "db_update", detail?: Record<string, unknown>) {
  try {
    markLocalMutation();
    const payload = { eventType, senderId: CLIENT_SESSION_ID, timestamp: Date.now(), ...(detail || {}) };
    // 1) PRINCIPAL: Canal Realtime de Supabase (otras tablets / otros dispositivos), <50ms.
    const channel = getSharedRealtimeChannel();
    if ((channel as any).state === "joined") {
      await channel.send({ type: "broadcast", event: "db_update", payload });
    } else {
      // Canal no unido: intentar envío HTTP (funciona sin WebSocket) como fallback.
      // Si falla, la reconexión automática de getSharedRealtimeChannel() se encargará
      // de restaurar el canal; mientras tanto, el BroadcastChannel local (abajo) y
      // el postgres_changes del sync provider cubren la señal.
      try {
        await channel.httpSend("db_update", payload);
      } catch {
        logRealtimeStatus("HTTP_SEND_FAILED", { eventType });
      }
    }
    // 2) EXTRA local: pestañas del MISMO navegador (instantáneo, resistente al tab-throttling).
    try {
      const localBC = (window as any).__REYGAS_TAB_BC ||
        ((window as any).__REYGAS_TAB_BC = new BroadcastChannel("reygas-tab-sync"));
      localBC.postMessage({ ...payload, local: true });
    } catch {
      // BroadcastChannel no disponible: el canal Realtime de Supabase ya cubrió el aviso
    }
  } catch (err) {
    // deferred
  }
}

// Central cloud-saved toast signal (CustomEvent) so EVERY web action can confirm
// the write to the cloud WITHOUT changing the page flow (skill de congruencia Supabase).
// El componente <Toast/> lo escucha y lo muestra como toast de confirmación.
export function emitCloudSavedToast(message?: string, type: "success" | "warning" | "error" = "success") {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("reygas:cloud-saved", {
        detail: { message: message || "Guardado en la nube ✓", type },
      })
    );
  } catch {
    // noop
  }
}

// Filtro anti-duplicado de correlativo: consulta la fuente de verdad (Supabase) y
// devuelve el PRIMER número libre de la serie cuando el número preferido ya existe
// en otra factura. Evita dos facturas con el mismo ticket/boleta/factura cuando el
// store local no tiene todas las facturas cargadas (ventana de 1000).
async function resolveUniqueReceiptNumber(
  preferred: string,
  type: "Ticket" | "Boleta" | "Factura",
  currentInvoiceId?: string
): Promise<{ number: string; collision: boolean }> {
  const prefTrim = (preferred || "").trim();
  if (!prefTrim) return { number: preferred, collision: false };

  const isFactura = type === "Factura" || /^F0|^F1|^FA/i.test(prefTrim);
  const isBoleta = type === "Boleta" || /^B0|^B1|^BO/i.test(prefTrim);
  const isTicket = type === "Ticket" || /^TK|^T0/i.test(prefTrim) || (!isFactura && !isBoleta);
  const prefix = isFactura ? "F" : isBoleta ? "B" : "TK";

  // 1. ¿El número preferido YA existe en OTRA factura?
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("receipt_number", prefTrim)
    .limit(50);
  const collision = (existing || []).some((r) => r.id !== currentInvoiceId);
  if (!collision) return { number: prefTrim, collision: false };

  // 2. Colisión detectada: calcular el máximo real de la serie en la DB
  const { data: all } = await supabase
    .from("invoices")
    .select("receipt_number")
    .ilike("receipt_number", prefix + "%")
    .limit(5000);
  let maxNum = 0;
  (all || []).forEach((r) => {
    // BUG FIX (correlativo): "TK01-00004611".replace(/\D/g,"") incluía el "01" de la
    // serie ("0100004611" -> 100004611, descartado por el tope) y el máximo real
    // quedaba en 0, asignando números absurdos (TK01-00000005). Se extrae el número
    // SOLO de la parte posterior al último guion: "00004611" -> 4611.
    const parts = String(r.receipt_number || "").split("-");
    const clean = parseInt((parts[parts.length - 1] || "").replace(/\D/g, ""), 10);
    // Tope de cordura (< 1.000.000): los tickets reales son de 4-6 dígitos. Los números
    // absurdos (TK01-3470348x) generados por bugs de parseo no deben dominar el máximo.
    if (!isNaN(clean) && clean > maxNum && clean < 999999) maxNum = clean;
  });
  const series = isFactura ? "F001" : isBoleta ? "B001" : "TK01";

  // 3. Avanzar hasta encontrar uno libre (loop acotado de seguridad)
  let next = maxNum + 1;
  for (let i = 0; i < 200; i++) {
    const cand = series + "-" + String(next).padStart(8, "0");
    const { data: dup } = await supabase.from("invoices").select("id").eq("receipt_number", cand).limit(1);
    if (!dup || dup.length === 0) return { number: cand, collision: true };
    next++;
  }
  return { number: series + "-" + String(next).padStart(8, "0"), collision: true };
}

// Busca el ÚLTIMO correlativo real (folio) de cada serie (TK01 ticket, B001 boleta,
// F001 factura, FC01 nota de crédito) en Supabase (fuente de verdad). Regla 21/08
// (usuario): los nuevos comprobantes continúan la secuencia desde los ÚLTIMOS
// correlativos del día anterior y del día actual (Perú). Como los folios de la nube
// son secuenciales, el máximo total de cada serie ES ese último correlativo real;
// tomarlo además evita reusar folios ya emitidos (p.ej. config local en 4600 pero la
// nube ya llegó a 4620). El CSV histórico con folios heredados (6803/4218/2658) NO
// participa aquí: era lo que inflaba el preview del abono. Filas con fecha ilegible
// se descartan (no aportan a la secuencia).
export async function fetchLatestReceiptMaxima(): Promise<{
  ticket: number;
  boleta: number;
  factura: number;
  notaCredito: number;
}> {
  const result = { ticket: 0, boleta: 0, factura: 0, notaCredito: 0 };
  const series: Array<{ prefix: string; key: keyof typeof result }> = [
    { prefix: "TK01-", key: "ticket" },
    { prefix: "B001-", key: "boleta" },
    { prefix: "F001-", key: "factura" },
    { prefix: "FC01-", key: "notaCredito" },
  ];
  await Promise.all(
    series.map(async ({ prefix, key }) => {
      try {
        // NOTA: NO incluir columnas inexistentes (created_at rompía la query y el
        // sync moría en silencio). issued_at = fecha de emisión; paid_at = respaldo.
        const { data } = await supabase
          .from("invoices")
          .select("receipt_number, issued_at, paid_at")
          .like("receipt_number", prefix + "%")
          .limit(5000);
        let max = 0;
        (data || []).forEach((inv: any) => {
          const raw = String(inv.receipt_number || "").trim();
          if (!raw) return;
          const dateKey = toPeruDateKey(inv.issued_at || inv.paid_at);
          if (!dateKey) return; // fecha ilegible: no aporta a la secuencia
          const { folio } = parseCorrelative(raw);
          if (folio > 0 && folio > max && folio < 999999) max = folio;
        });
        result[key] = max;
      } catch (err) {
        console.warn("fetchLatestReceiptMaxima:", prefix, err);
      }
    })
  );
  return result;
}

// Ultra-fast granular fetch for Services Catalog (~15ms)
export async function fetchSupabaseServices(): Promise<WorkshopService[] | null> {
  try {
    const { data: contentData } = await supabase
      .from("site_content")
      .select("*")
      .or("section_key.eq.workshopServices,key.eq.workshopServices,section_key.eq.services,key.eq.services");

    if (contentData && contentData.length > 0) {
      for (const row of contentData) {
        const rawVal = row.value !== undefined ? row.value : row.content;
        try {
          const list = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
          if (Array.isArray(list) && list.length > 0) {
            return list;
          }
        } catch { }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Catálogo configurable de Tipos de Combustible (Configuración -> Tipo Combustible).
export async function fetchSupabaseFuelTypes(): Promise<FuelType[] | null> {
  try {
    const { data: contentData } = await supabase
      .from("site_content")
      .select("*")
      .or("section_key.eq.fuelTypes,key.eq.fuelTypes");
    if (contentData && contentData.length > 0) {
      for (const row of contentData) {
        const rawVal = row.value !== undefined ? row.value : row.content;
        try {
          const list = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
          if (Array.isArray(list) && list.length > 0) {
            return list;
          }
        } catch { }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Ultra-fast granular fetch for Certifications Catalog (~20ms)
export async function fetchSupabaseCertifications(): Promise<Certification[] | null> {
  try {
    const { data, error } = await supabase.from("certifications").select("*");
    if (!error && data && data.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// Ultra-fast granular fetch for Schedule Records (~25ms)
export async function fetchSupabaseScheduleRecords(): Promise<ScheduleRecord[] | null> {
  try {
    const { data, error } = await supabase.from("schedule_records").select("*");
    if (!error && data && data.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// Ultra-fast granular fetch for Appointments (~25ms): tabla appointments como fuente
// principal (el sync completo trae el merge con snapshots appt_* de site_content).
// Se usa para el sync LIGERO de citas al recibir broadcast "appointment_updated"
// (sin esperar el sync completo de 30s).
export async function fetchSupabaseAppointments(): Promise<Appointment[] | null> {
  try {
    const res = await queryAppointmentsWithMissingGuard();
    const baseApps = (res.data && res.data.length > 0) ? [...res.data] : [];
    if (baseApps.length === 0) return null;
    return baseApps;
  } catch {
    return null;
  }
}

// Ultra-fast granular fetch for Inventory (~30ms)
export async function fetchSupabaseInventory(): Promise<InventoryItem[] | null> {
  try {
    const items = await fetchAllSupabaseTable("inventory_items");
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

// Ultra-fast granular fetch for Technicians (~15ms)
export async function fetchSupabaseTechnicians(): Promise<Technician[] | null> {
  try {
    const [techRes, contentRes] = await Promise.all([
      safeQuery<any[]>(
        supabase
          .from("technicians")
          .select("id, full_name, specialty, phone, is_active, allowed_tabs, can_receive_payment, is_debt_responsible, email, username, password, created_at")
      ),
      safeQuery<any[]>(supabase.from("site_content").select("*")),
    ]);

    const permsMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; is_debt_responsible?: boolean; is_attention_responsible?: boolean; is_mechanic_responsible?: boolean; is_certification_responsible?: boolean; payment_nickname?: string; email?: string; username?: string; password?: string }> = {};
    const permsNameMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; is_debt_responsible?: boolean; is_attention_responsible?: boolean; is_mechanic_responsible?: boolean; is_certification_responsible?: boolean; payment_nickname?: string; email?: string; username?: string; password?: string }> = {};
    const fallbackTechs: any[] = [];

    if (contentRes.data) {
      contentRes.data.forEach((row: any) => {
        const k = row.key || row.section_key;
        if (k && k.startsWith("tech_perms_name_")) {
          const techName = decodeURIComponent(k.replace("tech_perms_name_", "")).trim().toLowerCase();
          try {
            const rawVal = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (rawVal && typeof rawVal === "object") {
              permsNameMap[techName] = {
                allowed_tabs: Array.isArray(rawVal.allowed_tabs) ? rawVal.allowed_tabs : undefined,
                can_receive_payment: rawVal.can_receive_payment !== undefined ? !!rawVal.can_receive_payment : undefined,
                is_debt_responsible: rawVal.is_debt_responsible !== undefined ? !!rawVal.is_debt_responsible : undefined,
                is_attention_responsible: rawVal.is_attention_responsible !== undefined ? !!rawVal.is_attention_responsible : undefined,
                is_mechanic_responsible: rawVal.is_mechanic_responsible !== undefined ? !!rawVal.is_mechanic_responsible : undefined,
                is_certification_responsible: rawVal.is_certification_responsible !== undefined ? !!rawVal.is_certification_responsible : undefined,
                payment_nickname: rawVal.payment_nickname || "",
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch { }
        } else if (k && k.startsWith("tech_perms_")) {
          const techId = k.replace("tech_perms_", "");
          try {
            const rawVal = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(rawVal)) {
              permsMap[techId] = { allowed_tabs: rawVal };
            } else if (rawVal && typeof rawVal === "object") {
              permsMap[techId] = {
                allowed_tabs: Array.isArray(rawVal.allowed_tabs) ? rawVal.allowed_tabs : undefined,
                can_receive_payment: rawVal.can_receive_payment !== undefined ? !!rawVal.can_receive_payment : undefined,
                is_debt_responsible: rawVal.is_debt_responsible !== undefined ? !!rawVal.is_debt_responsible : undefined,
                is_attention_responsible: rawVal.is_attention_responsible !== undefined ? !!rawVal.is_attention_responsible : undefined,
                is_mechanic_responsible: rawVal.is_mechanic_responsible !== undefined ? !!rawVal.is_mechanic_responsible : undefined,
                is_certification_responsible: rawVal.is_certification_responsible !== undefined ? !!rawVal.is_certification_responsible : undefined,
                payment_nickname: rawVal.payment_nickname || "",
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch { }
        } else if (k === "all_technicians") {
          try {
            const tList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(tList)) fallbackTechs.push(...tList);
          } catch { }
        }
      });
    }

    if (techRes.data && techRes.data.length > 0) {
      return techRes.data.map((t: any) => {
        const normName = (t.full_name || "").trim().toLowerCase();
        const perm = permsMap[t.id] || permsNameMap[normName];
        const fbTech = fallbackTechs.find((f: any) => f.id === t.id || (f.full_name && f.full_name.trim().toLowerCase() === normName));
        const isDbPaymentTrue = t.can_receive_payment === true || (t.can_receive_payment as any) === "true" || (t.can_receive_payment as any) === 1;
        const isDbPaymentFalse = t.can_receive_payment === false || (t.can_receive_payment as any) === "false" || (t.can_receive_payment as any) === 0;
        const isDbDebtTrue = t.is_debt_responsible === true || (t.is_debt_responsible as any) === "true" || (t.is_debt_responsible as any) === 1;
        const isDbDebtFalse = t.is_debt_responsible === false || (t.is_debt_responsible as any) === "false" || (t.is_debt_responsible as any) === 0;

        return {
          ...t,
          email: perm?.email || fbTech?.email || t.email || "",
          username: perm?.username || fbTech?.username || t.username || generateDefaultUsername(t.full_name),
          password: perm?.password || fbTech?.password || t.password || generateDefaultUsername(t.full_name),
          allowed_tabs: perm?.allowed_tabs || fbTech?.allowed_tabs || t.allowed_tabs,
          can_receive_payment: isDbPaymentTrue
            ? true
            : isDbPaymentFalse
              ? false
              : (perm?.can_receive_payment !== undefined
                ? !!perm.can_receive_payment
                : (fbTech?.can_receive_payment !== undefined ? !!fbTech.can_receive_payment : false)),
          is_debt_responsible: isDbDebtTrue
            ? true
            : isDbDebtFalse
              ? false
              : (perm?.is_debt_responsible !== undefined
                ? !!perm.is_debt_responsible
                : (fbTech?.is_debt_responsible !== undefined ? !!fbTech.is_debt_responsible : false)),
          is_attention_responsible: (perm?.is_attention_responsible !== undefined
            ? !!perm.is_attention_responsible
            : (fbTech?.is_attention_responsible !== undefined ? !!fbTech.is_attention_responsible : false)),
          is_mechanic_responsible: (perm?.is_mechanic_responsible !== undefined
            ? !!perm.is_mechanic_responsible
            : (fbTech?.is_mechanic_responsible !== undefined ? !!fbTech.is_mechanic_responsible : false)),
          is_certification_responsible: (perm?.is_certification_responsible !== undefined
            ? !!perm.is_certification_responsible
            : (fbTech?.is_certification_responsible !== undefined ? !!fbTech.is_certification_responsible : false)),
          payment_nickname: perm?.payment_nickname || fbTech?.payment_nickname || (t as any).payment_nickname || "",
        };
      });
    } else if (fallbackTechs.length > 0) {
      return fallbackTechs;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// CERTIFICATIONS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseCertification(cert: Certification) {
  try {
    markLocalMutation("certifications");
    // 1. Try dedicated table
    await supabase.from("certifications").upsert({
      id: cert.id,
      work_order_id: cert.work_order_id || null,
      vehicle_plate: cert.vehicle_plate,
      client_name: cert.client_name,
      chip_code: cert.chip_code,
      cylinder_serial: cert.cylinder_serial,
      certification_type: cert.certification_type,
      issue_date: cert.issue_date,
      expiry_date: cert.expiry_date,
      status: cert.status,
      price: cert.price || 80,
      is_ready: cert.is_ready ?? true,
    });
    // 2. Also save to site_content fallback
    await saveSupabaseSiteContent(`cert_${cert.id}`, cert, "certifications");
    broadcastRealtimeChange("certification_updated");
    emitCloudSavedToast("Certificación guardada en la nube ✓");
  } catch (err) {
    console.warn("Supabase certification deferred:", err);
  }
}

// ---------------------------------------------------------------------
// SCHEDULE & PROGRAMACION SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseScheduleRecord(record: ScheduleRecord) {
  try {
    markLocalMutation("schedule");
    // 1. Try dedicated table
    await supabase.from("schedule_records").upsert({
      id: record.id,
      vehicle_plate: record.vehicle_plate,
      client_name: record.client_name,
      client_phone: record.client_phone,
      current_mileage: record.current_mileage || 0,
      service_date: record.service_date || null,
      service_name: record.service_name || "Mantenimiento General",
      expiry_quinquennial: record.expiry_quinquennial || null,
      expiry_chip_annual: record.expiry_chip_annual || null,
      next_maintenance_date: record.next_maintenance_date || null,
      scheduled_date: record.scheduled_date || null,
      status: record.status || "programado",
      notes: record.notes || null,
    });
    // 2. Also save to site_content fallback
    await saveSupabaseSiteContent(`sched_${record.id}`, record, "schedule");
    broadcastRealtimeChange("schedule_updated");
    emitCloudSavedToast("Programación guardada en la nube ✓");
  } catch (err) {
    console.warn("Supabase schedule record deferred:", err);
  }
}

export async function deleteSupabaseScheduleRecord(id: string) {
  try {
    await supabase.from("schedule_records").delete().eq("id", id);
    await supabase.from("site_content").delete().eq("key", `sched_${id}`);
    broadcastRealtimeChange("schedule_deleted");
  } catch (err) {
    console.warn("Supabase schedule delete deferred:", err);
  }
}

export async function deleteSupabaseMultipleScheduleRecords(ids: string[]) {
  try {
    await supabase.from("schedule_records").delete().in("id", ids);
    const keys = ids.map((id) => `sched_${id}`);
    await supabase.from("site_content").delete().in("key", keys);
    broadcastRealtimeChange("schedule_deleted");
  } catch (err) {
    console.warn("Supabase schedule bulk delete deferred:", err);
  }
}

export async function clearSupabaseScheduleRecords() {
  try {
    await supabase.from("schedule_records").delete().neq("id", "");
    broadcastRealtimeChange("schedule_cleared");
  } catch (err) {
    console.warn("Supabase schedule clear deferred:", err);
  }
}

export async function saveSupabaseBulkScheduleRecords(
  records: ScheduleRecord[]
): Promise<{ success: boolean; errorMsg?: string }> {
  try {
    const CHUNK_SIZE = 150;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const payload = chunk.map((r) => ({
        id: r.id,
        vehicle_plate: r.vehicle_plate,
        client_name: r.client_name,
        client_phone: r.client_phone,
        current_mileage: r.current_mileage || 0,
        service_date: r.service_date || null,
        service_name: r.service_name || "Mantenimiento General",
        expiry_quinquennial: r.expiry_quinquennial || null,
        expiry_chip_annual: r.expiry_chip_annual || null,
        next_maintenance_date: r.next_maintenance_date || null,
        scheduled_date: r.scheduled_date || null,
        status: r.status || "programado",
        notes: r.notes || null,
      }));
      const { error } = await supabase.from("schedule_records").upsert(payload);
      if (error) {
        console.warn("Supabase schedule chunk save notice:", error.message);
      }
    }
    await saveSupabaseSiteContent("all_schedule_records", records, "schedule");
    broadcastRealtimeChange("schedule_bulk_saved");
    return { success: true };
  } catch (err: any) {
    console.warn("Supabase bulk schedule save error:", err);
    return { success: false, errorMsg: err?.message || "Error al guardar en Supabase" };
  }
}

// ============================================================================
// CARGA OPERATIVA CON TOPE (OPTIMIZACIÓN DE VELOCIDAD — skill de rendimiento):
// El ERP tiene 41k+ órdenes y 118k+ facturas. Descargarlas TODAS al navegador hace
// que CADA pestaña demore en cargar. Esta función carga SOLO la ventana operativa:
//   - Órdenes de trabajo recientes (3,000 más recientes por entry_time, paginadas) +
//     SIEMPRE las órdenes de TODAS las facturas pendientes/con crédito (la deuda real
//     nunca se pierde aunque sea antigua, ej. BBF-936 con crédito del 22/06/2026)
//   - TODAS las facturas pendientes / con crédito (deuda real) + 3,000 pagadas recientes
//   - Vehículos recientes (2,000 por last_visit_date; los lookups por placa se resuelven)
// El histórico completo sigue siendo consultable por fecha/placa con consultas dirigidas
// (fetchSupabaseConsultasRealtime / fetchSupabaseDayReport) sin descargar todo.
// Si el tope falla, se hace fallback a la carga completa (nunca dejar sin datos).
// ============================================================================
// Cache de 15s para los snapshots de historial (inv_payhistory_*/inv_full_*) en el sync
// operativo: evita consultar ~44 lotes de site_content en CADA sync (2s) con varias
// pestañas abiertas (eso saturaba la red y Almacén/Taller tardaban en actualizarse).
let cappedHistoryCache: { at: number; pay: Map<string, any[]>; full: Map<string, any> } | null = null;
const CAPPED_HISTORY_TTL = 15000;

// Invalida el cache de historial del sync operativo: DEBE llamarse cada vez que se
// guarda/edita/elimina una factura o su historial, si no el cache (hasta 15s) revive
// pagos eliminados y montos viejos en las cards (bug BAG-123: pago "volvía a aparecer"
// tras eliminarlo desde el historial de Caja).
export function invalidateCappedHistoryCache() {
  cappedHistoryCache = null;
}

export async function fetchCappedOperationalData(): Promise<{ workOrders: any[]; invoices: any[]; vehicles: any[]; deletedWorkOrderIds?: string[] }> {
  const fetchStart = Date.now();
  try {
    // CARGA LIGERA (mantiene la web rápida): PostgREST limita a 1000 filas por request.
    // OPTIMIZACIÓN DE RENDIMIENTO: la ventana se reduce a 400 (las OTs/facturas más
    // recientes cubren la operación del día; las antiguas ya pagadas no necesitan card
    // activa en Caja). Las facturas pendientes/crédito SIEMPRE se cargan (deuda real,
    // ~50 filas) y el bloque 3b trae las facturas de las OTs visibles.
    const PAGE = 400;

    // 1. Fase paralela: órdenes recientes (400), TODAS las facturas pendientes/crédito
    //    (solo ~50 filas: es la deuda real), facturas pagadas recientes (400) y vehículos (400).
    const [ordersRes, pendingInvRes, paidInvRes, vehiclesRes, csvInvRes, deletedRes] = await Promise.all([
      safeQuery<any[]>(supabase.from("work_orders").select("*").order("entry_time", { ascending: false }).limit(PAGE)),
      safeQuery<any[]>(
        supabase
          .from("invoices")
          .select("*")
          .or("payment_status.neq.pagado,payment_status.is.null,credit_amount.gt.0")
          .limit(PAGE)
      ),
      // Pagadas RECIENTEMENTE (por paid_at): una factura recién saldada (deuda cancelada)
      // permanece visible en la ventana operativa y corrige el caché local obsoleto.
      safeQuery<any[]>(supabase.from("invoices").select("*").eq("payment_status", "pagado").order("paid_at", { ascending: false }).limit(PAGE)),
      safeQuery<any[]>(supabase.from("vehicles").select("*").order("last_visit_date", { ascending: false }).limit(PAGE)),
      // Deuda OFICIAL (DEUDA 17.08.26.csv): estas facturas SIEMPRE se cargan (estén o no
      // pagadas), para que su card muestre el estado real (saldo 0 si se saldaron) y su
      // historial completo, aunque queden fuera de las ventanas de recencia (caso BBF-936).
      safeQuery<any[]>(
        supabase
          .from("invoices")
          .select("*")
          .in("receipt_number", Object.keys(DEBT_CSV_BY_RECEIPT))
      ),
      // TOMBSTONES de OTs borradas: ligerísimo (solo wo_deleted_*); permite al sync
      // operativo DROPear fantasmas locales de OTs borradas en otro dispositivo.
      safeQuery<any[]>(supabase.from("site_content").select("key").like("key", "wo_deleted_%")),
    ]);

    const recentOrders = ordersRes?.data || [];
    const vehicles = vehiclesRes?.data || [];
    // ids de OTs borradas (tombstones) para que el sync dropee fantasmas locales.
    const deletedWoIdSet = new Set<string>();
    (deletedRes?.data || []).forEach((row: any) => {
      const k = row.key || row.section_key || "";
      if (k.startsWith("wo_deleted_")) deletedWoIdSet.add(k.replace("wo_deleted_", ""));
    });

    // 2. Fusionar facturas: pendientes/crédito primero (deuda nunca se pierde), luego pagadas recientes
    const invMap = new Map<string, any>();
    (pendingInvRes?.data || []).forEach((i: any) => {
      const k = i?.work_order_id || i?.id;
      if (k) invMap.set(k, i);
    });
    (paidInvRes?.data || []).forEach((i: any) => {
      const k = i?.work_order_id || i?.id;
      if (k && !invMap.has(k)) invMap.set(k, i);
    });
    (csvInvRes?.data || []).forEach((i: any) => {
      const k = i?.work_order_id || i?.id;
      if (k && !invMap.has(k)) invMap.set(k, i);
    });

    // 3. CRÍTICO pero LIGERO: la ventana de recencia (1000 órdenes) NO incluye órdenes
    //    antiguas (ej. BBF-936 del 22/06/2026). Se cargan EXPLÍCITAMENTE las órdenes de
    //    trabajo de TODAS las facturas pendientes/crédito (~50) Y de las pagadas recientes
    //    (las que acaban de saldar su deuda), para que la deuda y su cancelación SIEMPRE
    //    aparezcan en Caja -> Pendientes / card de la placa (evita el caché local obsoleto).
    const relatedWoIds = Array.from(
      new Set(
        [
          ...(pendingInvRes?.data || []).map((i: any) => i?.work_order_id),
          ...(paidInvRes?.data || []).map((i: any) => i?.work_order_id),
          ...(csvInvRes?.data || []).map((i: any) => i?.work_order_id),
        ].filter((id: any): id is string => !!id)
      )
    );
    const woMap = new Map<string, any>();
    recentOrders.forEach((o: any) => {
      if (o?.id) woMap.set(o.id, o);
    });
    await Promise.all(
      Array.from({ length: Math.ceil(relatedWoIds.length / 100) }, (_, i) => {
        const chunk = relatedWoIds.slice(i * 100, i * 100 + 100);
        if (chunk.length === 0) return Promise.resolve();
        return safeQuery<any[]>(supabase.from("work_orders").select("*").in("id", chunk)).then((res) => {
          (res?.data || []).forEach((o: any) => {
            if (o?.id) woMap.set(o.id, o);
          });
        });
      })
    );
    const workOrders = Array.from(woMap.values());

    // 3b2. RECONSTRUIR discount_amount/allow_modifications DESDE SNAPSHOTS wo_mod_*:
    // discount_amount NO es columna de work_orders (vive en el snapshot wo_mod_<id>).
    // Sin esto, el sync operativo traía la OT SIN descuento y Caja mostraba el total
    // completo (bug BCT-750: descuento S/5 en Taller, card de Caja seguía en S/20 hasta
    // que pasaba el sync completo de 30s).
    const woIdsForSnap = Array.from(woMap.keys());
    if (woIdsForSnap.length > 0) {
      const woModSnapMap = new Map<string, any>();
      await Promise.all(
        Array.from({ length: Math.ceil(woIdsForSnap.length / 100) }, (_, bi) => {
          const chunk = woIdsForSnap.slice(bi * 100, bi * 100 + 100);
          if (chunk.length === 0) return Promise.resolve();
          return safeQuery<any[]>(
            supabase.from("site_content").select("key, value").in("key", chunk.map((k) => "wo_mod_" + k))
          ).then((res) => {
            (res?.data || []).forEach((row: any) => {
              const k = row.key || row.section_key || "";
              let val: any = row.value !== undefined ? row.value : row.content;
              if (typeof val === "string") { try { val = JSON.parse(val); } catch { val = undefined; } }
              const id = k.replace("wo_mod_", "");
              if (val && typeof val === "object") woModSnapMap.set(id, val);
            });
          });
        })
      );
      if (woModSnapMap.size > 0) {
        workOrders.forEach((o: any, idx: number) => {
          const snap = woModSnapMap.get(o.id);
          if (!snap) return;
          const snapDiscount = snap.discount_amount !== undefined && snap.discount_amount !== null ? Number(snap.discount_amount) : undefined;
          const colDiscount = o.discount_amount !== undefined && o.discount_amount !== null ? Number(o.discount_amount) : undefined;
          const finalDiscount = colDiscount !== undefined ? colDiscount : (snapDiscount !== undefined ? snapDiscount : 0);
          const finalAllowMod = snap.allow_modifications !== undefined ? !!snap.allow_modifications : (o.allow_modifications !== undefined ? !!o.allow_modifications : false);
          // LISTA DE TÉCNICOS (multi-técnico): assigned_technician_ids no es columna,
          // vive en el snapshot wo_mod_<id>. Se restaura aquí para que otra tablet que
          // cargue la OT conserve los técnicos asignados.
          const snapTechs = Array.isArray(snap.assigned_technician_ids) ? snap.assigned_technician_ids : undefined;
          const colTechs = Array.isArray((o as any).assigned_technician_ids) ? (o as any).assigned_technician_ids : undefined;
          const finalTechs = snapTechs !== undefined ? snapTechs : colTechs;
          if (finalDiscount !== 0 || finalAllowMod || finalTechs !== undefined) {
            workOrders[idx] = {
              ...o,
              discount_amount: finalDiscount,
              allow_modifications: finalAllowMod,
              ...(finalTechs !== undefined ? { assigned_technician_ids: finalTechs } : {}),
            };
          }
        });
      }
    }

    // 3b. FIX (cards del día sin historial): la ventana de FACTURAS PAGADAS RECIENTES
    // (1000 por paid_at) deja FUERA pagos de días anteriores (ej. re-ingreso 17/08 con
    // 23k facturas pagadas después) -> la card de Caja mostraba la OT pero SIN su factura
    // ni historial de pago. Se cargan TAMBIÉN las facturas de las OTs de la ventana
    // reciente (por work_order_id), así toda card visible tiene su factura + historial.
    const recentWoIds = Array.from(woMap.keys());
    if (recentWoIds.length > 0) {
      await Promise.all(
        Array.from({ length: Math.ceil(recentWoIds.length / 100) }, (_, i) => {
          const chunk = recentWoIds.slice(i * 100, i * 100 + 100);
          if (chunk.length === 0) return Promise.resolve();
          return safeQuery<any[]>(supabase.from("invoices").select("*").in("work_order_id", chunk)).then((res) => {
            (res?.data || []).forEach((inv: any) => {
              const k = inv?.work_order_id || inv?.id;
              if (k && !invMap.has(k)) invMap.set(k, inv);
            });
          });
        })
      );
    }

    // 3c. RECONSTRUIR HISTORIAL DE PAGOS desde snapshots (inv_payhistory_* / inv_full_*):
    //     la tabla invoices guarda payment_history como NULL (el historial vive en los
    //     snapshots). Sin esto, el store local queda con la factura SIN historial y la
    //     edición de fecha/método de un pago falla en silencio (C8Q-096: skip_record_not_found
    //     con historyCount 0). El sync operativo ligero debe traer el historial real.
    const cappedInvoices = Array.from(invMap.values());
    const cappedInvoiceKeys = new Set<string>();
    cappedInvoices.forEach((inv: any) => {
      if (inv?.id) cappedInvoiceKeys.add(inv.id);
      if (inv?.work_order_id) cappedInvoiceKeys.add(inv.work_order_id);
    });
    const histKeys = Array.from(cappedInvoiceKeys);
    if (histKeys.length > 0) {
      // Cache de 15s: si otra pestaña/sync ya cargó los snapshots hace poco, reutilizarlos
      // (el historial cambia poco en segundos; el sync completo de 30s refresca el resto).
      const nowCache = Date.now();
      if (!cappedHistoryCache || nowCache - cappedHistoryCache.at > CAPPED_HISTORY_TTL) {
        const payHistMap = new Map<string, any[]>();
        const invFullMapCapped = new Map<string, any>();
        // Snapshots por LOTES de 100 keys (postgREST limita el IN)
        await Promise.all(
          Array.from({ length: Math.ceil(histKeys.length / 100) }, (_, bi) => {
            const chunk = histKeys.slice(bi * 100, bi * 100 + 100);
            if (chunk.length === 0) return Promise.resolve();
            return safeQuery<any[]>(
              supabase.from("site_content").select("key, value").in("key", [
                ...chunk.map((k) => `inv_payhistory_${k}`),
                ...chunk.map((k) => `inv_full_${k}`),
              ])
            ).then((res) => {
              (res?.data || []).forEach((row: any) => {
                const k = row.key || row.section_key || "";
                let val: any = row.value !== undefined ? row.value : row.content;
                if (typeof val === "string") { try { val = JSON.parse(val); } catch { val = undefined; } }
                if (k.startsWith("inv_payhistory_")) {
                  const id = k.replace("inv_payhistory_", "");
                  if (Array.isArray(val)) payHistMap.set(id, val);
                } else if (k.startsWith("inv_full_")) {
                  const id = k.replace("inv_full_", "");
                  if (val && typeof val === "object") invFullMapCapped.set(id, val);
                }
              });
            });
          })
        );
        cappedHistoryCache = { at: nowCache, pay: payHistMap, full: invFullMapCapped };
      }
      const payHistMap = cappedHistoryCache.pay;
      const invFullMapCapped = cappedHistoryCache.full;
      // Fusionar historial en cada factura (fuente: inv.payment_history -> inv_full -> inv_payhistory)
      cappedInvoices.forEach((inv: any, idx: number) => {
        const k = inv?.id || inv?.work_order_id;
        if (!k) return;
        const invFull = invFullMapCapped.get(inv.id) || (inv.work_order_id ? invFullMapCapped.get(inv.work_order_id) : undefined) || {};
        // Prioridad: tabla -> inv_full_ (se actualiza SIEMPRE en cada save, incluso con
        // payment_history VACÍO tras "Borrar todos") -> inv_payhistory_ (fallback SOLO si
        // el full no trae el campo). Antes, un inv_full_ con historial vacío saltaba al
        // inv_payhistory_ VIEJO y revivía pagos borrados (bug card saldo 0).
        let hist: any[] = Array.isArray(inv.payment_history)
          ? inv.payment_history
          : (Array.isArray(invFull.payment_history)
            ? invFull.payment_history
            : (payHistMap.get(inv.id) || (inv.work_order_id ? payHistMap.get(inv.work_order_id) : undefined) || []));
        if (Array.isArray(hist) && hist.length > 0) {
          cappedInvoices[idx] = {
            ...invFull,
            ...inv,
            payment_history: hist,
          };
        } else {
          cappedInvoices[idx] = { ...invFull, ...inv };
        }
      });
    }

    // Si el tope devolvió vacío (algo raro), caer a la carga completa
    if (workOrders.length === 0 && invMap.size === 0) {
      return {
        workOrders: await fetchAllSupabaseTable("work_orders"),
        invoices: await fetchAllSupabaseTable("invoices"),
        vehicles: await fetchAllSupabaseTable("vehicles"),
        deletedWorkOrderIds: Array.from(deletedWoIdSet),
      };
    }

    // TIMING del sync operativo: cuánto tardó en traer los datos (determina cuánto
    // demora en aparecer una card nueva en Caja/Almacén/Taller).
    logTiming("sync.operational.duration", fetchStart, {
      orders: workOrders.length,
      invoices: cappedInvoices.length,
      vehicles: vehicles.length,
    }, "services:fetchCappedOperationalData");
    return { workOrders, invoices: cappedInvoices, vehicles, deletedWorkOrderIds: Array.from(deletedWoIdSet) };
  } catch (err) {
    logTiming("sync.operational.error.duration", fetchStart, {
      err: err instanceof Error ? err.message : String(err),
    }, "services:fetchCappedOperationalData");
    console.warn("Capped operational fetch failed, fallback to full load:", err);
    return {
      workOrders: await fetchAllSupabaseTable("work_orders"),
      invoices: await fetchAllSupabaseTable("invoices"),
      vehicles: await fetchAllSupabaseTable("vehicles"),
      deletedWorkOrderIds: [],
    };
  }
}

export async function fetchSupabaseErpData() {
  try {
    const [techRes, invData, cappedData, appRes, certData, contentRes] = await Promise.all([
      // Slim select: solo las columnas que la UI necesita (evita descargar columnas pesadas innecesarias)
      safeQuery<any[]>(
        supabase
          .from("technicians")
          .select("id, full_name, specialty, phone, is_active, allowed_tabs, can_receive_payment, is_debt_responsible, email, username, password, created_at")
      ),
      fetchAllSupabaseTable("inventory_items"),
      fetchCappedOperationalData(),
      queryAppointmentsWithMissingGuard(),
      safeQuery<any[]>(supabase.from("certifications").select("*")),
      // OPTIMIZACIÓN: excluir del fetch GENERAL de site_content el backup masivo
      // (master_workshop_backup, solo se carga bajo demanda) y los snapshots inv_full_*
      // (los más pesados y redundantes: la tabla invoices tiene los datos base y
      // inv_payhistory_/inv_breakdown_ conservan historial/desglose por separado).
      // Los snapshots wo_mod_/wo_removed_/wo_deleted_/inv_payhistory_/inv_breakdown_
      // SÍ se mantienen (críticos para borrado cross-device y reconstrucción).
      // select de solo las columnas que el parseo usa (value + fallback content) para
      // reducir el payload (~40% menos); el código siempre lee row.value primero.
      safeQuery<any[]>(
        supabase
          .from("site_content")
          .select("section_key, key, value, content, category")
          .not("key", "eq", "master_workshop_backup")
          .not("section_key", "eq", "master_workshop_backup")
          .not("section_key", "like", "inv_full_%")
      ),
    ]);

    const orderData = (cappedData && cappedData.workOrders) || [];
    const invoiceData = (cappedData && cappedData.invoices) || [];
    const vehicleData = (cappedData && cappedData.vehicles) || [];

    // Build permissions, certifications, and schedule records from site_content if any
    const permsMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; is_debt_responsible?: boolean; is_attention_responsible?: boolean; is_mechanic_responsible?: boolean; is_certification_responsible?: boolean; payment_nickname?: string; email?: string; username?: string; password?: string }> = {};
    const permsNameMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; is_debt_responsible?: boolean; is_attention_responsible?: boolean; is_mechanic_responsible?: boolean; is_certification_responsible?: boolean; payment_nickname?: string; email?: string; username?: string; password?: string }> = {};
    const fallbackCerts: any[] = [];
    const fallbackSched: any[] = [];
    const fallbackApps: any[] = [];
    const fallbackInventory: InventoryItem[] = [];
    let fallbackServices: any[] = [];
    let fallbackRecentIngresos: any[] = [];
    let fallbackToolLoans: ToolLoan[] = [];
    let fallbackAttendanceLogs: AttendanceLog[] = [];
    const fallbackTechs: any[] = [];
    const invBreakdownsMap = new Map<string, any[]>();
    const invPayhistoryMap = new Map<string, any[]>();
    const invFullMap = new Map<string, any>();
    const woModMap = new Map<string, any>();
    // Registro GLOBAL de ítems eliminados por OT (wo_removed_<id>): aplica a la
    // reconstrucción para que un ítem borrado en Taller NO reaparezca desde el snapshot
    // wo_mod_ viejo de Almacén ni desde la columna items (fix F2Z-050 cross-device).
    const woRemovedMap = new Map<string, Set<string>>();
    // TOMBSTONES de OTs borradas (wo_deleted_<id>): el sync los usa para DROPear
    // fantasmas locales (una OT borrada en otra tablet no debe seguir apareciendo
    // en este dispositivo aunque se haya perdido el evento realtime).
    const deletedWoIdSet = new Set<string>();

    if (contentRes.data) {
      contentRes.data.forEach((row: any) => {
        const k = row.key || row.section_key;
        if (k && k.startsWith("tech_perms_name_")) {
          const techName = decodeURIComponent(k.replace("tech_perms_name_", "")).trim().toLowerCase();
          try {
            const rawVal = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (rawVal && typeof rawVal === "object") {
              permsNameMap[techName] = {
                allowed_tabs: Array.isArray(rawVal.allowed_tabs) ? rawVal.allowed_tabs : undefined,
                can_receive_payment: rawVal.can_receive_payment !== undefined ? !!rawVal.can_receive_payment : undefined,
                is_debt_responsible: rawVal.is_debt_responsible !== undefined ? !!rawVal.is_debt_responsible : undefined,
                is_attention_responsible: rawVal.is_attention_responsible !== undefined ? !!rawVal.is_attention_responsible : undefined,
                is_mechanic_responsible: rawVal.is_mechanic_responsible !== undefined ? !!rawVal.is_mechanic_responsible : undefined,
                is_certification_responsible: rawVal.is_certification_responsible !== undefined ? !!rawVal.is_certification_responsible : undefined,
                payment_nickname: rawVal.payment_nickname || "",
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch { }
        } else if (k && k.startsWith("tech_perms_")) {
          const techId = k.replace("tech_perms_", "");
          try {
            const rawVal = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(rawVal)) {
              permsMap[techId] = { allowed_tabs: rawVal };
            } else if (rawVal && typeof rawVal === "object") {
              permsMap[techId] = {
                allowed_tabs: Array.isArray(rawVal.allowed_tabs) ? rawVal.allowed_tabs : undefined,
                can_receive_payment: rawVal.can_receive_payment !== undefined ? !!rawVal.can_receive_payment : undefined,
                is_debt_responsible: rawVal.is_debt_responsible !== undefined ? !!rawVal.is_debt_responsible : undefined,
                is_attention_responsible: rawVal.is_attention_responsible !== undefined ? !!rawVal.is_attention_responsible : undefined,
                is_mechanic_responsible: rawVal.is_mechanic_responsible !== undefined ? !!rawVal.is_mechanic_responsible : undefined,
                is_certification_responsible: rawVal.is_certification_responsible !== undefined ? !!rawVal.is_certification_responsible : undefined,
                payment_nickname: rawVal.payment_nickname || "",
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch { }
        } else if (k === "all_technicians") {
          try {
            const tList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(tList)) fallbackTechs.push(...tList);
          } catch { }
        } else if (k && k.startsWith("cert_")) {
          try {
            const certObj = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (certObj && certObj.id) fallbackCerts.push(certObj);
          } catch { }
        } else if (k && k.startsWith("sched_")) {
          try {
            const sObj = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (sObj && sObj.id) fallbackSched.push(sObj);
          } catch { }
        } else if (k === "all_schedule_records") {
          try {
            const sList = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(sList)) fallbackSched.push(...sList);
          } catch { }
        } else if (k === "tool_loans_all") {
          try {
            const tList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(tList)) fallbackToolLoans = tList;
          } catch { }
        } else if (k === "attendance_logs_all") {
          try {
            const aList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(aList)) fallbackAttendanceLogs = aList;
          } catch { }
        } else if (k && k.startsWith("appt_")) {
          try {
            const aObj = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (aObj && aObj.id) fallbackApps.push(aObj);
          } catch { }
        } else if (k === "all_inventory_records") {
          try {
            const invList = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(invList)) fallbackInventory.push(...invList);
          } catch { }
        } else if (k === "workshopServices" || k === "workshop_services" || k === "all_services") {
          try {
            const sList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(sList) && sList.length > 0) fallbackServices = sList;
          } catch { }
        } else if (k === "inventory_recent_ingresos") {
          try {
            const list = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(list)) fallbackRecentIngresos = list;
          } catch { }
        } else if (k && k.startsWith("inv_breakdown_")) {
          const invKey = k.replace("inv_breakdown_", "");
          try {
            const bd = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(bd)) {
              invBreakdownsMap.set(invKey, bd);
            }
          } catch { }
        } else if (k && k.startsWith("inv_payhistory_")) {
          const invKey = k.replace("inv_payhistory_", "");
          try {
            const hist = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(hist)) invPayhistoryMap.set(invKey, hist);
          } catch { }
        } else if (k && k.startsWith("inv_full_")) {
          const invKey = k.replace("inv_full_", "");
          try {
            const val = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (val && typeof val === "object") invFullMap.set(invKey, val);
          } catch { }
        } else if (k && k.startsWith("wo_mod_")) {
          const woKey = k.replace("wo_mod_", "");
          try {
            const val = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (val && typeof val === "object") woModMap.set(woKey, val);
          } catch { }
        } else if (k && k.startsWith("wo_removed_")) {
          const woKey = k.replace("wo_removed_", "");
          try {
            const val = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            const ids: string[] = val && Array.isArray(val.ids)
              ? val.ids.filter((x: any) => typeof x === "string")
              : (Array.isArray(val) ? val.filter((x: any) => typeof x === "string") : []);
            if (ids.length > 0) woRemovedMap.set(woKey, new Set(ids));
          } catch { }
        } else if (k && k.startsWith("wo_deleted_")) {
          const woKey = k.replace("wo_deleted_", "");
          if (woKey) deletedWoIdSet.add(woKey);
        }
      });
    }

    // Check if master workshop backup exists in site_content
    let masterBackup: { vehicles?: any[]; workOrders?: any[]; invoices?: any[] } | null = null;
    if (contentRes.data) {
      const backupRow = contentRes.data.find((r: any) => (r.key || r.section_key) === "master_workshop_backup");
      if (backupRow) {
        try {
          masterBackup = typeof backupRow.value === "string" ? JSON.parse(backupRow.value) : (backupRow.value || backupRow.content);
        } catch { }
      }
    }

    const reconstructedVehiclesMap = new Map<string, any>();
    const reconstructedInvoicesMap = new Map<string, any>();

    // 1. Database vehicles and invoices are the PRIMARY source of truth
    if (Array.isArray(vehicleData)) {
      vehicleData.forEach((v: any) => {
        if (v && v.plate) {
          reconstructedVehiclesMap.set(v.plate.toUpperCase().trim(), v);
        }
      });
    }

    if (Array.isArray(invoiceData)) {
      invoiceData.forEach((i: any) => {
        if (i && (i.work_order_id || i.id)) {
          if (i.id) reconstructedInvoicesMap.set(i.id, i);
          if (i.work_order_id) reconstructedInvoicesMap.set(i.work_order_id, i);
        }
      });
    }

    // 2. Seed backup vehicles/invoices ONLY for records missing from the database
    if (masterBackup?.vehicles) {
      masterBackup.vehicles.forEach((v: any) => {
        if (v && v.plate) {
          const pk = v.plate.toUpperCase().trim();
          if (!reconstructedVehiclesMap.has(pk)) reconstructedVehiclesMap.set(pk, v);
        }
      });
    }
    if (masterBackup?.invoices) {
      masterBackup.invoices.forEach((i: any) => {
        const k = i.work_order_id || i.id;
        if (k && !reconstructedInvoicesMap.has(k)) reconstructedInvoicesMap.set(k, i);
      });
    }

    const rawOrderList = (orderData && orderData.length > 0) ? orderData : (masterBackup?.workOrders || []);

    const formattedOrders = rawOrderList.map((o: any) => {
      const rawDiag = o.diagnostic_notes || "";
      let diagNotes = rawDiag;
      let obs = "";
      let allowMod = false;
      let quinquennialDate = o.quinquennial_date || "";
      let chipExpiryDate = o.chip_expiry_date || "";
      let vehicleType = o.vehicle_type || "";
      let generalMaintenanceService = o.general_maintenance_service || o.problem_description || "";
      let sparePartsServices = o.spare_parts_services || "";

      // Decode [ERP_META]: JSON if present
      if (diagNotes.includes("[ERP_META]:")) {
        try {
          const metaStr = diagNotes.split("[ERP_META]:")[1].trim();
          const meta = JSON.parse(metaStr);
          if (meta) {
            quinquennialDate = o.quinquennial_date || meta.q_date || meta.quinquennial_date || quinquennialDate;
            chipExpiryDate = o.chip_expiry_date || meta.c_date || meta.chip_expiry_date || chipExpiryDate;
            vehicleType = o.vehicle_type || meta.v_type || meta.vehicle_type || vehicleType;
            generalMaintenanceService = o.general_maintenance_service || meta.m_serv || meta.general_maintenance_service || generalMaintenanceService;
            sparePartsServices = o.spare_parts_services || meta.sp_serv || meta.spare_parts_services || sparePartsServices;

            // Reconstruct vehicle ONLY if missing from database
            if (o.vehicle_plate) {
              const plateKey = o.vehicle_plate.toUpperCase().trim();
              if (!reconstructedVehiclesMap.has(plateKey)) {
                reconstructedVehiclesMap.set(plateKey, {
                  plate: o.vehicle_plate,
                  brand: meta.brand || "",
                  model: "",
                  year: 0,
                  color: "",
                  fuel_type: meta.fuel || "",
                  vehicle_type: vehicleType || "",
                  owner_name: meta.c_name || meta.client_name || "",
                  owner_phone: meta.c_phone || meta.client_phone || "",
                  current_mileage: meta.km || meta.current_mileage || 0,
                  last_visit_date: o.entry_time || new Date().toISOString(),
                });
              }
            }

            // Reconstruct invoice ONLY if missing from database.
            // BUG FIX: las órdenes que AÚN están en el taller (ingresado / diagnóstico /
            // repuestos / en servicio / en espera) NUNCA reciben una factura fantasma
            // "pagado": esa reconstrucción era para registros históricos importados.
            // Si no, una orden nueva con [ERP_META] (ej. "Instalación FISE") se marca
            // automáticamente como PAGADA sin haberse cobrado en Caja (caso A3Z-187,
            // CWU-571, ALI-052 del 18/08 que siguen en servicio).
            // Solo los estados OPERATIVOS actuales del taller (vehículo trabajándose ahora).
            // "en_espera" queda fuera: es un estado histórico de importación y sus registros
            // con comprobante sí deben conservar la factura reconstruida (pago histórico).
            const IN_WORKSHOP_STATUSES = ["ingresado", "en_diagnostico", "esperando_repuestos", "en_servicio"];
            const invKey = o.id;
            if (!reconstructedInvoicesMap.has(invKey) && !reconstructedInvoicesMap.has(`inv-${o.id}`) && !IN_WORKSHOP_STATUSES.includes(o.status)) {
              reconstructedInvoicesMap.set(invKey, {
                id: `inv-${o.id}`,
                work_order_id: o.id,
                vehicle_plate: o.vehicle_plate,
                client_name: meta.c_name || meta.client_name || "",
                customer_doc: meta.doc || "",
                customer_address: "",
                labor_fee: 0,
                parts_total: 0,
                certification_fee: 0,
                grand_total: 0,
                payment_status: "pagado",
                payment_method: meta.p_method || "",
                issued_at: o.entry_time || new Date().toISOString(),
                receipt_number: meta.rcpt_num || "",
                receipt_type: meta.rcpt_type || "",
                discounts: meta.disc !== undefined ? meta.disc : "",
                credit_amount: meta.cred || 0,
                raw_price_str: meta.r_price || "",
                raw_credit_str: meta.r_cred || "",
                payment_condition: meta.cond || "",
                payment_destination: meta.p_dest || "",
              });
            }
          }
          diagNotes = diagNotes.split("[ERP_META]:")[0].trim();
        } catch (e) {
          // ignore parse error
        }
      }

      // Legacy fallback parsing from textual diagnostic_notes
      if (!quinquennialDate && diagNotes.includes("Quinquenal:")) {
        const match = diagNotes.match(/Quinquenal:\s*([^•\n]+)/);
        if (match) quinquennialDate = match[1].trim();
      }
      if (!chipExpiryDate && diagNotes.includes("Chip Anual:")) {
        const match = diagNotes.match(/Chip Anual:\s*([^•\n]+)/);
        if (match) chipExpiryDate = match[1].trim();
      }

      if (diagNotes.includes("[ALLOW_MOD]: true")) {
        allowMod = true;
        diagNotes = diagNotes.replace("[ALLOW_MOD]: true", "").trim();
      }
      if (diagNotes.includes("[OBSERVACIONES]:")) {
        const parts = diagNotes.split("[OBSERVACIONES]:");
        diagNotes = parts[0].trim();
        obs = parts[1].trim();
      }

      const woMod = woModMap.get(o.id) || {};
      const finalDiscount = (o.discount_amount !== undefined && o.discount_amount !== null)
        ? Number(o.discount_amount)
        : (woMod.discount_amount !== undefined ? Number(woMod.discount_amount) : 0);
      const isAllowedMod = woMod.allow_modifications !== undefined ? !!woMod.allow_modifications : (allowMod || !!o.allow_modifications);

      return {
        ...o,
        quinquennial_date: quinquennialDate || o.quinquennial_date || "",
        chip_expiry_date: chipExpiryDate || o.chip_expiry_date || "",
        vehicle_type: vehicleType || o.vehicle_type || "",
        general_maintenance_service: generalMaintenanceService || o.general_maintenance_service || "",
        spare_parts_services: sparePartsServices || o.spare_parts_services || "",
        discount_amount: finalDiscount,
        allow_modifications: isAllowedMod,
        diagnostic_notes: diagNotes,
        observations: obs || o.observations || undefined,
        items: (() => {
          // El snapshot wo_mod_<id> (escrito por saveSupabaseWorkOrder) es la fuente
          // más reciente de items; si existe, se usa como fuente preferente con
          // fallback a la columna items de la tabla work_orders.
          const itemsSource = (woMod && Array.isArray(woMod.items)) ? woMod.items : o.items;
          let parsed: any[] = [];
          try {
            parsed = typeof itemsSource === "string" ? JSON.parse(itemsSource || "[]") : itemsSource || [];
          } catch {
            parsed = [];
          }
          // FIX ELIMINAR REPUESTO (F2Z-050 cross-device): excluir los ítems eliminados
          // globalmente (wo_removed_<id>) para que NO reaparezcan en la reconstrucción
          // aunque el snapshot wo_mod_ viejo aún los tenga.
          const woRemovedIds = woRemovedMap.get(o.id);
          if (woRemovedIds && woRemovedIds.size > 0) {
            parsed = parsed.filter((it: any) => !(it && it.id && woRemovedIds.has(it.id)));
          }
          const orderDateStr = (o.entry_time || "").slice(0, 10);
          const isMigratedOrBilled =
            (orderDateStr && orderDateStr <= "2026-08-08") ||
            o.status === "finalizado" ||
            o.status === "entregado" ||
            reconstructedInvoicesMap.has(o.id) ||
            reconstructedInvoicesMap.has(o.vehicle_plate);

          return parsed.map((it: any) => {
            if (isMigratedOrBilled && (it.dispatched === undefined || it.dispatched === null || it.dispatched === false)) {
              return {
                ...it,
                dispatched: true,
                dispatched_at: it.dispatched_at || o.entry_time || new Date().toISOString(),
              };
            }
            return it;
          });
        })(),
      };
    });

    const finalVehicles = Array.from(reconstructedVehiclesMap.values());
    const finalInvoices = Array.from(reconstructedInvoicesMap.values()).map((inv: any) => {
      const invFull = invFullMap.get(inv.id) || (inv.work_order_id ? invFullMap.get(inv.work_order_id) : undefined) || {};
      const bd = inv.payment_breakdown || invFull.payment_breakdown || invBreakdownsMap.get(inv.id) || (inv.work_order_id ? invBreakdownsMap.get(inv.work_order_id) : undefined);
      let bdArr: any = bd;
      if (typeof bdArr === "string") {
        try { bdArr = JSON.parse(bdArr); } catch { bdArr = undefined; }
      }
      const rawHistory = Array.isArray(inv.payment_history)
        ? inv.payment_history
        : (Array.isArray(invFull.payment_history) && invFull.payment_history.length > 0
          ? invFull.payment_history
          : (invPayhistoryMap.get(inv.id) || (inv.work_order_id ? invPayhistoryMap.get(inv.work_order_id) : undefined) || []));
      const historyAmount = rawHistory.reduce((s: number, rr: any) => s + (Number(rr.amount) || 0), 0);
      // Limpia el método de pago: desanida "Mixto (Mixto (...))" obsoleto para que los
      // abonos borrados NO aparezcan en el método mostrado en caja/tablas/reportes.
      const methodClean = cleanMethodDisplay(inv.payment_method || invFull.payment_method, historyAmount > 0 ? historyAmount : undefined);
      return {
        ...invFull,
        ...inv,
        // FIX PERÚ/UTC: anclar issued_at/paid_at a -05:00 para que los filtros por
        // fecha de Caja/reportes (slice(0,10)) vean el día correcto de Perú.
        issued_at: toPeruAnchoredISO(inv.issued_at || invFull.issued_at) || inv.issued_at || invFull.issued_at,
        paid_at: toPeruAnchoredISO(inv.paid_at || invFull.paid_at) || inv.paid_at || invFull.paid_at || undefined,
        receipt_number: inv.receipt_number || invFull.receipt_number || "",
        receipt_type: inv.receipt_type || invFull.receipt_type || "",
        discounts: inv.discounts !== undefined && inv.discounts !== null && inv.discounts !== "" ? inv.discounts : (invFull.discounts !== undefined ? invFull.discounts : ""),
        credit_amount: typeof inv.credit_amount === "number" ? inv.credit_amount : (typeof invFull.credit_amount === "number" ? invFull.credit_amount : 0),
        payment_destination: inv.payment_destination || invFull.payment_destination || "",
        payment_condition: inv.payment_condition || invFull.payment_condition || "",
        observations: inv.observations || invFull.observations || "",
        payment_method: methodClean,
        payment_history: rawHistory.map((rr: any) => ({
          ...rr,
          date: toPeruAnchoredISO(rr.date) || rr.date,
          method: cleanMethodDisplay(rr.method, Number(rr.amount) || 0),
        })),
        payment_breakdown: Array.isArray(bdArr)
          ? bdArr.map((s: any) => ({ ...s, method: cleanMethodDisplay(s.method, Number(s.amount) || 0) }))
          : bdArr,
      };
    });
    const mergedCerts = certData.data && certData.data.length > 0 ? certData.data : fallbackCerts;

    // Normalizar columnas reales de la DB (stock/min_stock/sale_price) a la interfaz de la app
    // y fusionar campos extra (counted/initial/entries/exits) que viven en site_content.
    const invMap = new Map<string, InventoryItem>();
    (Array.isArray(invData) ? invData : []).forEach((dbRow: any) => {
      const normalized = normalizeDbInventoryItem(dbRow);
      if (normalized.id) invMap.set(normalized.id, normalized);
    });
    fallbackInventory.forEach((fb) => {
      if (fb && fb.id && invMap.has(fb.id)) {
        invMap.set(fb.id, { ...invMap.get(fb.id)!, ...fb });
      }
    });
    let finalInventory: InventoryItem[] = [];
    if (invMap.size > 0) {
      finalInventory = Array.from(invMap.values());
    } else if (fallbackInventory.length > 0) {
      finalInventory = fallbackInventory;
    }

    const fallbackTechMap = new Map<string, any>();
    fallbackTechs.forEach((ft) => {
      if (ft.id) fallbackTechMap.set(ft.id, ft);
      if (ft.full_name) fallbackTechMap.set(ft.full_name.trim().toLowerCase(), ft);
    });

    let finalTechnicians: Technician[] | null = null;
    if (techRes.data && techRes.data.length > 0) {
      finalTechnicians = techRes.data.map((t: any) => {
        const normName = (t.full_name || "").trim().toLowerCase();
        const perm = permsMap[t.id] || permsNameMap[normName];
        const fbTech = fallbackTechMap.get(t.id) || fallbackTechMap.get(normName);
        const defUser = generateDefaultUsername(t.full_name);

        let finalAllowedTabs: string[] | undefined = undefined;
        if (perm?.allowed_tabs !== undefined && Array.isArray(perm.allowed_tabs)) {
          finalAllowedTabs = perm.allowed_tabs;
        } else if (fbTech?.allowed_tabs !== undefined && Array.isArray(fbTech.allowed_tabs)) {
          finalAllowedTabs = fbTech.allowed_tabs;
        } else if (t.allowed_tabs !== undefined && Array.isArray(t.allowed_tabs)) {
          finalAllowedTabs = t.allowed_tabs;
        }

        const isDbPaymentTrue = t.can_receive_payment === true || (t.can_receive_payment as any) === "true" || (t.can_receive_payment as any) === 1;
        const isDbPaymentFalse = t.can_receive_payment === false || (t.can_receive_payment as any) === "false" || (t.can_receive_payment as any) === 0;
        const isDbDebtTrue = t.is_debt_responsible === true || (t.is_debt_responsible as any) === "true" || (t.is_debt_responsible as any) === 1;
        const isDbDebtFalse = t.is_debt_responsible === false || (t.is_debt_responsible as any) === "false" || (t.is_debt_responsible as any) === 0;

        return {
          ...t,
          email: perm?.email || fbTech?.email || t.email || "",
          username: perm?.username || fbTech?.username || t.username || defUser,
          password: perm?.password || fbTech?.password || t.password || defUser,
          allowed_tabs: finalAllowedTabs,
          can_receive_payment: isDbPaymentTrue
            ? true
            : isDbPaymentFalse
              ? false
              : (perm?.can_receive_payment !== undefined
                ? !!perm.can_receive_payment
                : (fbTech?.can_receive_payment !== undefined ? !!fbTech.can_receive_payment : false)),
          is_debt_responsible: isDbDebtTrue
            ? true
            : isDbDebtFalse
              ? false
              : (perm?.is_debt_responsible !== undefined
                ? !!perm.is_debt_responsible
                : (fbTech?.is_debt_responsible !== undefined ? !!fbTech.is_debt_responsible : false)),
          is_attention_responsible: (perm?.is_attention_responsible !== undefined
            ? !!perm.is_attention_responsible
            : (fbTech?.is_attention_responsible !== undefined ? !!fbTech.is_attention_responsible : false)),
          is_mechanic_responsible: (perm?.is_mechanic_responsible !== undefined
            ? !!perm.is_mechanic_responsible
            : (fbTech?.is_mechanic_responsible !== undefined ? !!fbTech.is_mechanic_responsible : false)),
          is_certification_responsible: (perm?.is_certification_responsible !== undefined
            ? !!perm.is_certification_responsible
            : (fbTech?.is_certification_responsible !== undefined ? !!fbTech.is_certification_responsible : false)),
          payment_nickname: perm?.payment_nickname || fbTech?.payment_nickname || (t as any).payment_nickname || "",
        };
      });
    } else if (fallbackTechs.length > 0) {
      finalTechnicians = fallbackTechs;
    }

    let finalServices: any[] = [];
    const cmsData: Partial<SiteContent> = {};
    if (contentRes.data) {
      contentRes.data.forEach((row: any) => {
        const sectionKey = row.key || row.section_key;
        const rawVal = row.value !== undefined ? row.value : row.content;
        if (sectionKey && rawVal !== undefined) {
          try {
            const parsed = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
            (cmsData as any)[sectionKey] = parsed;
            if ((sectionKey === "services" || sectionKey === "workshopServices") && Array.isArray(parsed) && parsed.length > 0) {
              finalServices = parsed;
            }
          } catch {
            (cmsData as any)[sectionKey] = rawVal;
          }
        }
      });
    }

    return {
      cmsData,
      technicians: finalTechnicians,
      inventoryItems: finalInventory,
      workOrders: formattedOrders.length > 0 ? formattedOrders : null,
      deletedWorkOrderIds: Array.from(deletedWoIdSet),
      // Citas: merge de la tabla con los snapshots appt_* de site_content (patrón roster).
      // La tabla aporta lo más reciente; site_content aporta campos extendidos que no son
      // columna (ej. responsible de la Tabla de Programación) para que sobrevivan en
      // cualquier dispositivo.
      appointments: (() => {
        const baseApps = (appRes.data && appRes.data.length > 0) ? [...appRes.data] : [];
        if (baseApps.length === 0) return fallbackApps.length > 0 ? fallbackApps : null;
        if (fallbackApps.length === 0) return baseApps;
        const appMap = new Map<string, any>();
        baseApps.forEach((a: any) => { if (a && a.id) appMap.set(a.id, a); });
        fallbackApps.forEach((fb: any) => {
          if (fb && fb.id && appMap.has(fb.id)) {
            appMap.set(fb.id, { ...fb, ...appMap.get(fb.id) });
          }
        });
        return Array.from(appMap.values());
      })(),
      invoices: finalInvoices.length > 0 ? finalInvoices : (invoiceData || []),
      vehicles: finalVehicles.length > 0 ? finalVehicles : (vehicleData || []),
      certifications: mergedCerts.length > 0 ? mergedCerts : null,
      scheduleRecords: fallbackSched.length > 0 ? fallbackSched : null,
      workshopServices: finalServices.length > 0 ? finalServices : null,
      recentIngresos: fallbackRecentIngresos,
      toolLoans: fallbackToolLoans,
      attendanceLogs: fallbackAttendanceLogs,
    };
  } catch (err) {
    console.warn("Supabase ERP fetch warning:", err);
    return null;
  }
}

// ---------------------------------------------------------------------
// APPOINTMENTS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseAppointment(app: Appointment) {
  try {
    // La tabla appointments puede no existir aún en la base; siempre respaldar en site_content.
    await saveSupabaseSiteContent(`appt_${app.id}`, app, "appointments");
    // REALTIME CROSS-DEVICE: señal a TODAS las tablets/dispositivos para que la cita
    // aparezca/actualice al instante (sin refresh). El provider escucha "appointment"
    // y dispara el sync ligero + aplica la fila directa por postgres_changes.
    broadcastRealtimeChange("appointment_updated");
    if (appointmentsTableMissing) return;
    const { error } = await supabase.from("appointments").upsert({
      id: app.id,
      client_name: app.client_name,
      client_phone: app.client_phone,
      plate: app.plate,
      service_type: app.service_type,
      scheduled_date: app.scheduled_date,
      status: app.status,
      notes: app.notes,
    });
    if (error) console.warn("Supabase appointment save warning (tabla aún no creada; backup en site_content):", error.message);
    emitCloudSavedToast("Cita guardada en la nube ✓");
  } catch (err) {
    console.warn("Supabase appointment deferred:", err);
  }
}

export async function deleteSupabaseAppointment(id: string) {
  try {
    await supabase.from("site_content").delete().eq("section_key", `appt_${id}`);
    // REALTIME CROSS-DEVICE: señal de BORRADO a TODAS las tablets/dispositivos para
    // que la reserva desaparezca al instante (sin refresh). El provider escucha
    // "appointment_deleted" y la quita del store local + postgres_changes DELETE.
    broadcastRealtimeChange("appointment_deleted", { deletedId: id });
    if (appointmentsTableMissing) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) console.warn("Supabase appointment delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase appointment delete deferred:", err);
  }
}

// ---------------------------------------------------------------------
// CERTIFICATIONS DELETE (solicitud/retiro de certificación en Taller)
// ---------------------------------------------------------------------
export async function deleteSupabaseCertification(id: string) {
  try {
    markLocalMutation("certifications");
    await supabase.from("site_content").delete().eq("section_key", `cert_${id}`);
    const { error } = await supabase.from("certifications").delete().eq("id", id);
    if (error) console.warn("Supabase certification delete warning:", error.message);
    broadcastRealtimeChange("certification_updated");
  } catch (err) {
    console.warn("Supabase certification delete deferred:", err);
  }
}

// ---------------------------------------------------------------------
// TOOL LOANS (PRÉSTAMO DE HERRAMIENTAS) SUPABASE SYNC
// El modelo local usa technician_name (no technician_id), por lo que la
// fuente canónica es el roster en site_content (tool_loans_<id>) y el
// snapshot completo tool_loans_all; la tabla tool_loans es un espejo
// opcional (se intenta el upsert pero nunca rompe el flujo).
// ---------------------------------------------------------------------
export async function saveSupabaseToolLoans(loans: ToolLoan[]) {
  try {
    markLocalMutation("toolLoans");
    await saveSupabaseSiteContent("tool_loans_all", loans, "tool_loans");
    await Promise.all(
      loans.map((tl) => saveSupabaseSiteContent(`tool_loan_${tl.id}`, tl, "tool_loans", false))
    );
    broadcastRealtimeChange("tool_loans_updated");
    emitCloudSavedToast("Préstamo de herramientas guardado en la nube ✓");
  } catch (err) {
    console.warn("Supabase tool loans deferred:", err);
  }
}

export async function deleteSupabaseToolLoan(id: string) {
  try {
    markLocalMutation("toolLoans");
    await supabase.from("site_content").delete().eq("section_key", `tool_loan_${id}`);
    broadcastRealtimeChange("tool_loans_updated");
  } catch (err) {
    console.warn("Supabase tool loan delete deferred:", err);
  }
}

// ---------------------------------------------------------------------
// ATTENDANCE LOGS (ASISTENCIA BIOMÉTRICA) SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseAttendanceLogs(logs: AttendanceLog[]) {
  try {
    markLocalMutation("attendanceLogs");
    const deduped = Array.from(new Map(logs.map((l) => [l.id, l])).values());
    await saveSupabaseSiteContent("attendance_logs_all", deduped, "attendance");
    if (deduped.length > 0) {
      const rows = deduped.map((l) => ({
        id: l.id,
        employee_name: l.employee_name,
        check_time: l.check_time,
        log_type: l.log_type,
        source_file: l.source_file || null,
      }));
      const { error } = await supabase.from("attendance_logs").upsert(rows);
      if (error) console.warn("Supabase attendance logs save warning:", error.message);
    }
    broadcastRealtimeChange("attendance_updated");
    emitCloudSavedToast("Asistencia guardada en la nube ✓");
  } catch (err) {
    console.warn("Supabase attendance logs deferred:", err);
  }
}

// ---------------------------------------------------------------------
// INVOICES SUPABASE SYNC
// ---------------------------------------------------------------------
// COLAs de guardado de facturas (fix 22/08 'se duplica correlativo'):
// resolveUniqueReceiptNumber hace check-and-upsert NO atómico -> con N facturas
// guardadas en PARALELO (ráfaga de saves) todas resolvían el MISMO siguiente número
// y el ticket se duplicaba en la nube (log: TK01-00004650/652/653/660/661/662 x2).
// Se serializan TODOS los saveSupabaseInvoice: cada guardado resuelve y ocupa su
// correlativo ANTES de que el siguiente comience.
let invoiceSaveChain: Promise<unknown> = Promise.resolve();
function enqueueInvoiceSave<T>(task: () => Promise<T>): Promise<T> {
  const run = invoiceSaveChain.then(task, task);
  invoiceSaveChain = run.catch(() => {});
  return run;
}

export async function saveSupabaseInvoice(inv: Invoice) {
  return enqueueInvoiceSave(() => saveSupabaseInvoiceInner(inv));
}

async function saveSupabaseInvoiceInner(inv: Invoice) {
  const invSaveStart = Date.now();
  try {
    markLocalMutation("invoices");
    // BUG FIX: las facturas FANTASMA (id = "inv-<work_order_id>") son artefactos de la
    // reconstrucción para reflejar el estado de registros importados; NO deben persistirse
    // en la tabla invoices (generaban filas duplicadas/fantasmas en la base: AFT-598 tenía
    // 3 facturas para la misma OT, y había 64 filas fantasma en total).
    if (inv.id && inv.work_order_id && inv.id === `inv-${inv.work_order_id}`) {
      // LOG INTERNO: este descarte en silencio es la causa raíz de OT pagada sin
      // factura real: el store local reconstruye una factura fantasma y el flujo de
      // pago la "guarda" aquí sin persistir nada en Supabase.
      logSystemEvent("warn", "invoice.fantasma.descartada", {
        invId: String(inv.id).slice(0, 26),
        woId: String(inv.work_order_id).slice(0, 8),
        plate: inv.vehicle_plate || "",
        receipt: inv.receipt_number || "",
        total: inv.grand_total,
        status: inv.payment_status || "",
      }, "services:saveSupabaseInvoice");
      return;
    }
    // ANTI-FACTURA FANTASMA: si la OT vinculada fue BORRADA (tombstone wo_deleted_<id>),
    // NO se guarda/crea su factura (un dispositivo con la OT en caché podía re-crearla
    // DESPUÉS del borrado -> factura fantasma que quedaba huérfana en la base).
    if (inv.work_order_id && await isWorkOrderDeleted(inv.work_order_id)) {
      logSystemEvent("warn", "invoice.save.skipped_ot_borrada", {
        invId: String(inv.id).slice(0, 26),
        woId: String(inv.work_order_id).slice(0, 8),
        plate: inv.vehicle_plate || "",
        receipt: inv.receipt_number || "",
        total: inv.grand_total,
      }, "services:saveSupabaseInvoice");
      return;
    }
    // BUG FIX (AFT-598): un work_order_id INVÁLIDO ("x" o 1-2 caracteres, p. ej. desde
    // una confirmación con OT corrupta) rompía el vínculo OT<->factura: la Tabla Maestra
    // mostraba la placa SIN número de boleta. Se recupera el UUID correcto desde el
    // snapshot previo de la misma factura, o desde la OT real de la misma placa.
    if (!inv.work_order_id || String(inv.work_order_id).length < 3 || String(inv.work_order_id) === "x") {
      try {
        const snapRes = await supabase.from("site_content").select("value").eq("key", `inv_full_${inv.id}`).maybeSingle();
        const snapVal = snapRes?.data?.value;
        const snapInv: any = typeof snapVal === "string" ? JSON.parse(snapVal) : snapVal;
        if (snapInv?.work_order_id && String(snapInv.work_order_id).length >= 3 && String(snapInv.work_order_id) !== "x") {
          inv = { ...inv, work_order_id: String(snapInv.work_order_id) };
        } else if (inv.vehicle_plate) {
          const woRes = await supabase
            .from("work_orders")
            .select("id")
            .eq("vehicle_plate", inv.vehicle_plate)
            .order("entry_time", { ascending: false })
            .limit(1);
          const woId = woRes?.data?.[0]?.id;
          if (woId) inv = { ...inv, work_order_id: String(woId) };
        }
      } catch (e) {
        console.warn("saveSupabaseInvoice work_order_id repair warning:", e);
      }
    }
    // FILTRO ANTI-DUPLICADO DE CORRELATIVO: si el número de comprobante ya existe
    // en OTRA factura (fuente de verdad = Supabase, no el store local), se notifica
    // por toast y se reasigna automáticamente al siguiente número libre de la serie
    // para que NUNCA haya dos facturas con el mismo ticket/boleta/factura.
    logSystemEvent("info", "invoice.save.start", {
      invId: String(inv.id).slice(0, 26),
      woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
      plate: inv.vehicle_plate || "",
      receipt: inv.receipt_number || "",
      type: inv.receipt_type || "",
      total: inv.grand_total,
      status: inv.payment_status || "",
      isPhantom: !!(inv.id && inv.work_order_id && inv.id === `inv-${inv.work_order_id}`),
    }, "services:saveSupabaseInvoice");
    // EN EDICIÓN MANUAL (el cajero escribió el N° de comprobante a mano): se RESPETA
    // el número digitado, NO se reasigna (bug reportado: TK01-00004597 -> TK01-34703486).
    const respectManualReceipt = (inv as any)?.__respectManualReceipt === true;
    if (respectManualReceipt) {
      delete (inv as any).__respectManualReceipt;
      logSystemEvent("info", "invoice.correlativo.manual_respetado", {
        invId: String(inv.id).slice(0, 26),
        woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
        receipt: inv.receipt_number || "",
      }, "services:saveSupabaseInvoice");
    }
    if (!respectManualReceipt && inv.receipt_number && String(inv.receipt_number).trim()) {
      const invType: "Ticket" | "Boleta" | "Factura" =
        inv.receipt_type === "Factura" || inv.receipt_type === "Boleta"
          ? (inv.receipt_type as "Ticket" | "Boleta" | "Factura")
          : "Ticket";
      const resolved = await resolveUniqueReceiptNumber(String(inv.receipt_number), invType, inv.id);
      if (resolved.collision) {
        const oldNum = String(inv.receipt_number);
        const newNum = resolved.number;
        logSystemEvent("warn", "invoice.correlativo.duplicado", {
          invId: String(inv.id).slice(0, 26),
          woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
          oldNum,
          newNum,
          type: invType,
        }, "services:saveSupabaseInvoice");
        emitCloudSavedToast(
          `⚠️ El correlativo ${oldNum} ya existe en otra factura. Se asignó ${newNum} para evitar duplicado.`,
          "warning"
        );
        // Reasigna en la factura Y en el historial de pagos (cada registro lleva su comprobante)
        inv = { ...inv, receipt_number: newNum };
        if (Array.isArray(inv.payment_history) && inv.payment_history.length > 0) {
          inv = {
            ...inv,
            payment_history: inv.payment_history.map((p) =>
              p && p.receipt_number === oldNum ? { ...p, receipt_number: newNum, receipt_type: p.receipt_type || inv.receipt_type } : p
            ),
          };
        }
      }
    }

    const payload: any = {
      id: inv.id,
      work_order_id: inv.work_order_id,
      vehicle_plate: inv.vehicle_plate || "",
      client_name: inv.client_name || "",
      customer_doc: inv.customer_doc || null,
      customer_address: inv.customer_address || null,
      labor_fee: typeof inv.labor_fee === "number" && !isNaN(inv.labor_fee) ? inv.labor_fee : 0,
      parts_total: typeof inv.parts_total === "number" && !isNaN(inv.parts_total) ? inv.parts_total : 0,
      certification_fee: typeof inv.certification_fee === "number" && !isNaN(inv.certification_fee) ? inv.certification_fee : 0,
      grand_total: typeof inv.grand_total === "number" && !isNaN(inv.grand_total) ? inv.grand_total : 0,
      payment_status: inv.payment_status || "pagado",
      payment_method: inv.payment_method || "",
      issued_at: inv.issued_at || new Date().toISOString(),
      paid_at: inv.paid_at || null,
      receipt_number: inv.receipt_number || null,
      receipt_type: inv.receipt_type || null,
      discounts: inv.discounts !== undefined ? String(inv.discounts) : null,
      credit_amount: typeof inv.credit_amount === "number" ? inv.credit_amount : 0,
      raw_price_str: inv.raw_price_str || null,
      raw_credit_str: inv.raw_credit_str || null,
      payment_condition: inv.payment_condition || null,
      payment_destination: inv.payment_destination || null,
      observations: inv.observations || null,
      debt_observation: inv.debt_observation || null,
      debt_responsible: inv.debt_responsible || null,
    };

    try {
      const { error } = await supabase.from("invoices").upsert(payload);
      if (error) {
        logSystemEvent("error", "invoice.save.upsert_error", {
          invId: String(inv.id).slice(0, 26),
          woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
          receipt: inv.receipt_number || "",
          error: error.message,
        }, "services:saveSupabaseInvoice");
        console.warn("Supabase invoice upsert notice, trying core columns fallback:", error.message);
        await supabase.from("invoices").upsert({
          id: inv.id,
          work_order_id: inv.work_order_id,
          vehicle_plate: inv.vehicle_plate || "",
          client_name: inv.client_name || "",
          customer_doc: inv.customer_doc || null,
          labor_fee: typeof inv.labor_fee === "number" ? inv.labor_fee : 0,
          parts_total: typeof inv.parts_total === "number" ? inv.parts_total : 0,
          certification_fee: typeof inv.certification_fee === "number" ? inv.certification_fee : 0,
          grand_total: typeof inv.grand_total === "number" ? inv.grand_total : 0,
          payment_status: inv.payment_status || "pagado",
          payment_method: inv.payment_method || "",
          issued_at: inv.issued_at || new Date().toISOString(),
        });
      }
    } catch (upsertErr) {
      // EXCEPCIÓN de red/API en el upsert: se registra y SE CONTINÚA con los
      // snapshots (abajo), para que el historial del pago nunca se pierda de la card.
      logSystemEvent("error", "invoice.save.upsert_throw", {
        invId: String(inv.id).slice(0, 26),
        woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
        receipt: inv.receipt_number || "",
        err: upsertErr instanceof Error ? upsertErr.message : String(upsertErr),
      }, "services:saveSupabaseInvoice");
    }

    // Always persist full snapshot in site_content to guarantee 100% cloud resilience
    await saveSupabaseSiteContent(`inv_full_${inv.id}`, inv, "invoices", false);
    if (inv.work_order_id) {
      await saveSupabaseSiteContent(`inv_full_${inv.work_order_id}`, inv, "invoices", false);
    }

    if (inv.payment_breakdown && Array.isArray(inv.payment_breakdown) && inv.payment_breakdown.length > 0) {
      await saveSupabaseSiteContent(`inv_breakdown_${inv.id}`, inv.payment_breakdown, "invoices", false);
      if (inv.work_order_id) {
        await saveSupabaseSiteContent(`inv_breakdown_${inv.work_order_id}`, inv.payment_breakdown, "invoices", false);
      }
    }

    // Historial de pagos por fecha (abonos parciales) -> roster independiente en la nube
    if (inv.payment_history && Array.isArray(inv.payment_history) && inv.payment_history.length > 0) {
      await saveSupabaseSiteContent(`inv_payhistory_${inv.id}`, inv.payment_history, "invoices", false);
      if (inv.work_order_id) {
        await saveSupabaseSiteContent(`inv_payhistory_${inv.work_order_id}`, inv.payment_history, "invoices", false);
      }
    }

    // Vínculo directo recurso -> pago (para VENTAS POR CONCEPTO sin repartos inferidos)
    if (inv.resource_payments && Array.isArray(inv.resource_payments) && inv.resource_payments.length > 0) {
      await saveSupabaseSiteContent(`inv_resources_${inv.id}`, inv.resource_payments, "invoices", false);
      if (inv.work_order_id) {
        await saveSupabaseSiteContent(`inv_resources_${inv.work_order_id}`, inv.resource_payments, "invoices", false);
      }
    }

    // BUG FIX (card con saldo 0 tras desmarcar/borrar factura): los snapshots de
    // historial/desglose/recursos SOLO se escribían si había datos, pero NUNCA se
    // borraban si quedaban VACÍOS (ej. "Borrar todos" en Caja). El sync operativo
    // reconstruía el historial desde el snapshot VIEJO y la card "revivía" los pagos
    // borrados (mismos datos de factura, saldo 0) aunque el toast dijera pendiente.
    // Regla: si el array quedó vacío, el snapshot huérfano se ELIMINA (por id y woId).
    if (!inv.payment_history || inv.payment_history.length === 0) {
      await supabase.from("site_content").delete().eq("key", `inv_payhistory_${inv.id}`);
      if (inv.work_order_id) {
        await supabase.from("site_content").delete().eq("key", `inv_payhistory_${inv.work_order_id}`);
      }
    }
    if (!inv.payment_breakdown || inv.payment_breakdown.length === 0) {
      await supabase.from("site_content").delete().eq("key", `inv_breakdown_${inv.id}`);
      if (inv.work_order_id) {
        await supabase.from("site_content").delete().eq("key", `inv_breakdown_${inv.work_order_id}`);
      }
    }
    if (!inv.resource_payments || inv.resource_payments.length === 0) {
      await supabase.from("site_content").delete().eq("key", `inv_resources_${inv.id}`);
      if (inv.work_order_id) {
        await supabase.from("site_content").delete().eq("key", `inv_resources_${inv.work_order_id}`);
      }
    }
    broadcastRealtimeChange("invoice_updated");
    // Invalida el cache de historial del sync operativo: sin esto, un pago recién
    // eliminado/agregado "volvía a aparecer" hasta 15s (cache viejo en otras pestañas).
    invalidateCappedHistoryCache();
    logSystemEvent("info", "invoice.save.ok", {
      invId: String(inv.id).slice(0, 26),
      woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
      receipt: inv.receipt_number || "",
      type: inv.receipt_type || "",
      total: inv.grand_total,
      hasHistory: Array.isArray(inv.payment_history) ? inv.payment_history.length : 0,
    }, "services:saveSupabaseInvoice");
    // TIMING del guardado de factura (pago/abono): cuánto tarda en persistir
    logTiming("invoice.save.duration", invSaveStart, {
      invId: String(inv.id).slice(0, 26),
      woId: inv.work_order_id ? String(inv.work_order_id).slice(0, 8) : null,
      total: inv.grand_total,
    }, "services:saveSupabaseInvoice");
    emitCloudSavedToast("Comprobante guardado en la nube ✓");
  } catch (err) {
    logTiming("invoice.save.error.duration", invSaveStart, {
      invId: inv.id ? String(inv.id).slice(0, 26) : null,
      err: err instanceof Error ? err.message : String(err),
    }, "services:saveSupabaseInvoice");
    logSystemEvent("error", "invoice.save.exception", {
      invId: inv.id ? String(inv.id).slice(0, 26) : null,
      err: err instanceof Error ? err.message : String(err),
    }, "services:saveSupabaseInvoice");
    console.warn("Supabase invoice deferred:", err);
  }
}

// ELIMINA UNA FACTURA COMPLETA EN CASCADA (tabla invoices + snapshots inv_full_/
// inv_payhistory_/inv_breakdown_/inv_resources_ por id Y por work_order_id).
// Se usa cuando se borra el ÚLTIMO pago del historial: la factura deja de existir
// y la card de Caja queda como OT sin comprobante vinculado (bug BAG-123: la card
// seguía mostrando "Recibo/Comp: F001-..." aunque el historial estuviera vacío).
export async function deleteSupabaseInvoice(invoiceId: string, workOrderId?: string) {
  try {
    markLocalMutation("invoices");
    await supabase.from("invoices").delete().eq("id", invoiceId);
    const keys = [
      "inv_full_" + invoiceId,
      "inv_payhistory_" + invoiceId,
      "inv_breakdown_" + invoiceId,
      "inv_resources_" + invoiceId,
    ];
    if (workOrderId) {
      keys.push(
        "inv_full_" + workOrderId,
        "inv_payhistory_" + workOrderId,
        "inv_breakdown_" + workOrderId,
        "inv_resources_" + workOrderId
      );
    }
    for (const k of keys) {
      await supabase.from("site_content").delete().eq("key", k);
    }
    // Invalida el cache de historial del sync operativo (evita que la factura revive)
    invalidateCappedHistoryCache();
    logSystemEvent("info", "invoice.delete.ok", {
      invId: String(invoiceId).slice(0, 26),
      woId: workOrderId ? String(workOrderId).slice(0, 8) : null,
    }, "services:deleteSupabaseInvoice");
  } catch (err) {
    logSystemEvent("error", "invoice.delete.exception", {
      invId: String(invoiceId).slice(0, 26),
      err: err instanceof Error ? err.message : String(err),
    }, "services:deleteSupabaseInvoice");
  }
}

// Chunked Batch Upsert for Workshop Data to avoid Supabase API payload limits & browser memory crash
export async function saveSupabaseBulkWorkshopData(
  vehicles: Vehicle[],
  orders: WorkOrder[],
  invoices: Invoice[]
): Promise<{ success: boolean; errorMsg?: string }> {
  try {
    const CHUNK_SIZE = 150;
    let lastError: string | null = null;

    // 1. Vehicles chunked save (Deduplicate by plate to prevent PostgreSQL ON CONFLICT error)
    if (vehicles.length > 0) {
      const uniqueVehiclesMap = new Map<string, any>();
      vehicles.forEach((v) => {
        const plate = (v.plate || "").trim().toUpperCase();
        if (!plate) return;
        uniqueVehiclesMap.set(plate, {
          plate: plate,
          brand: v.brand || "",
          model: v.model || "",
          year: v.year || 0,
          color: v.color || "",
          fuel_type: v.fuel_type || "",
          vehicle_type: v.vehicle_type || null,
          owner_name: v.owner_name || "",
          owner_phone: v.owner_phone || "",
          current_mileage: v.current_mileage || 0,
          last_visit_date: v.last_visit_date || new Date().toISOString(),
        });
      });

      const vehiclesPayload = Array.from(uniqueVehiclesMap.values());

      for (let i = 0; i < vehiclesPayload.length; i += CHUNK_SIZE) {
        const chunk = vehiclesPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("vehicles").upsert(chunk, { onConflict: "plate" });
        if (error) {
          console.warn("Supabase vehicles upsert notice:", error.message);
        }
      }
    }

    // 2. Work Orders chunked save (embeds all 20 columns in [ERP_META] tag & saves all physical columns)
    if (orders.length > 0) {
      const vehiclesMap = new Map((vehicles || []).map((v) => [v.plate, v]));
      const invoicesMap = new Map((invoices || []).map((i) => [i.work_order_id, i]));
      const invoicesByPlate = new Map((invoices || []).map((i) => [i.vehicle_plate, i]));

      const uniqueOrdersMap = new Map<string, any>();

      orders.forEach((o) => {
        if (!o.id) return;
        const veh = vehiclesMap.get(o.vehicle_plate);
        const inv = invoicesMap.get(o.id) || invoicesByPlate.get(o.vehicle_plate);

        const meta = {
          q_date: o.quinquennial_date || "",
          c_date: o.chip_expiry_date || "",
          v_type: o.vehicle_type || veh?.vehicle_type || "",
          brand: veh?.brand || "",
          fuel: veh?.fuel_type || "",
          km: veh?.current_mileage || 0,
          c_name: veh?.owner_name || inv?.client_name || "",
          c_phone: veh?.owner_phone || "",
          tech: o.assigned_technician_id || "",
          m_serv: o.general_maintenance_service || "",
          sp_serv: o.spare_parts_services || "",
          rcpt_num: inv?.receipt_number || "",
          rcpt_type: inv?.receipt_type || "",
          disc: inv?.discounts !== undefined ? String(inv.discounts) : "",
          cred: inv?.credit_amount || 0,
          r_price: inv?.raw_price_str || "",
          r_cred: inv?.raw_credit_str || "",
          cond: inv?.payment_condition || "",
          p_dest: inv?.payment_destination || "",
          doc: inv?.customer_doc || "",
          p_method: inv?.payment_method || "",
        };

        let diagText = (o.diagnostic_notes || "").replace(/\[ERP_META\]:[^\n]+/g, "").trim();
        if (o.observations && !diagText.includes("[OBSERVACIONES]:")) {
          diagText = `${diagText}\n[OBSERVACIONES]: ${o.observations}`.trim();
        }
        diagText = `${diagText}\n[ERP_META]:${JSON.stringify(meta)}`.trim();

        uniqueOrdersMap.set(o.id, {
          id: o.id,
          vehicle_plate: o.vehicle_plate || "SN-PLACA",
          status: o.status || "pagado_autorizado",
          assigned_technician_id: o.assigned_technician_id || null,
          problem_description: o.problem_description || "",
          diagnostic_notes: diagText,
          observations: o.observations || null,
          entry_time: o.entry_time || new Date().toISOString(),
          completion_time: o.completion_time || null,
          items: typeof o.items === "string" ? o.items : JSON.stringify(o.items || []),
          quinquennial_date: o.quinquennial_date || null,
          chip_expiry_date: o.chip_expiry_date || null,
          vehicle_type: o.vehicle_type || null,
          general_maintenance_service: o.general_maintenance_service || null,
          spare_parts_services: o.spare_parts_services || null,
          requires_certification: !!o.requires_certification,
          certification_type: o.certification_type || null,
          certification_price: o.certification_price || 0,
          allow_modifications: !!o.allow_modifications,
        });
      });

      const ordersPayload = Array.from(uniqueOrdersMap.values());

      for (let i = 0; i < ordersPayload.length; i += CHUNK_SIZE) {
        const chunk = ordersPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("work_orders").upsert(chunk, { onConflict: "id" });
        if (error) {
          console.warn("Supabase work_orders upsert warning:", error.message);
          lastError = `Tabla órdenes: ${error.message}`;
        }
      }
    }

    // 3. Invoices chunked save (all columns included)
    if (invoices.length > 0) {
      const uniqueInvoicesMap = new Map<string, any>();

      invoices.forEach((inv) => {
        if (!inv.id) return;
        uniqueInvoicesMap.set(inv.id, {
          id: inv.id,
          work_order_id: inv.work_order_id,
          vehicle_plate: inv.vehicle_plate || "SN-PLACA",
          client_name: inv.client_name || "Cliente Taller",
          customer_doc: inv.customer_doc || null,
          customer_address: inv.customer_address || null,
          labor_fee: typeof inv.labor_fee === "number" && !isNaN(inv.labor_fee) ? inv.labor_fee : 0,
          parts_total: typeof inv.parts_total === "number" && !isNaN(inv.parts_total) ? inv.parts_total : 0,
          certification_fee: typeof inv.certification_fee === "number" && !isNaN(inv.certification_fee) ? inv.certification_fee : 0,
          grand_total: typeof inv.grand_total === "number" && !isNaN(inv.grand_total) ? inv.grand_total : 0,
          payment_status: inv.payment_status || "pagado",
          payment_method: inv.payment_method || "",
          issued_at: inv.issued_at || new Date().toISOString(),
          paid_at: inv.paid_at || null,
          receipt_number: inv.receipt_number || null,
          receipt_type: inv.receipt_type || null,
          discounts: inv.discounts !== undefined ? String(inv.discounts) : null,
          credit_amount: typeof inv.credit_amount === "number" ? inv.credit_amount : 0,
          raw_price_str: inv.raw_price_str || null,
          raw_credit_str: inv.raw_credit_str || null,
          payment_condition: inv.payment_condition || null,
          payment_destination: inv.payment_destination || null,
          observations: inv.observations || null,
        });
      });

      const invoicesPayload = Array.from(uniqueInvoicesMap.values());

      for (let i = 0; i < invoicesPayload.length; i += CHUNK_SIZE) {
        const chunk = invoicesPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("invoices").upsert(chunk, { onConflict: "id" });
        if (error) {
          console.warn("Supabase invoices upsert warning:", error.message);
        }
      }
    }

    // 4. Save metadata summary backup in site_content (avoids 25MB payload rejection)
    try {
      await saveSupabaseSiteContent("master_workshop_backup", {
        total_vehicles: vehicles.length,
        total_orders: orders.length,
        total_invoices: invoices.length,
        last_updated: new Date().toISOString(),
      }, "workshop");
    } catch { }

    broadcastRealtimeChange("bulk_workshop_saved");

    if (lastError) {
      return { success: false, errorMsg: lastError };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("Supabase bulk save error:", err);
    return { success: false, errorMsg: err?.message || "Error al conectar con Supabase" };
  }
}
