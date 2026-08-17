import { supabase } from "./client";
import { SiteContent, SiteTheme, Technician, InventoryItem, Vehicle, WorkOrder, Appointment, Invoice, Certification, ScheduleRecord, generateDefaultUsername } from "@/lib/store/app-store";

// =====================================================================
// SUPABASE REALTIME CMS & ERP DATABASE SERVICE
// Syncs all site content, rates, inventory and ERP tables directly to PostgreSQL
// =====================================================================

export async function fetchSupabaseSiteContent(): Promise<Partial<SiteContent> | null> {
  try {
    const { data, error } = await supabase.from("site_content").select("*");
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

export async function saveSupabaseSiteContent(key: string, value: any, category: string = "general") {
  try {
    const serializedValue = typeof value === "object" ? JSON.stringify(value) : value;

    // Standard upsert with onConflict: "key" (PostgreSQL UNIQUE key constraint)
    const { error } = await supabase.from("site_content").upsert(
      {
        key,
        value: serializedValue,
        category,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      // If upsert reports an issue, fallback to update by key
      const updateRes = await supabase
        .from("site_content")
        .update({
          value: serializedValue,
          category,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);

      if (updateRes.error) {
        console.warn(`Supabase site_content save warning [${key}]:`, updateRes.error.message);
      }
    }
  } catch (err) {
    console.warn("Supabase site_content deferred:", err);
  }
}

export async function saveAllTechnicianPermissions(technicians: Technician[]): Promise<boolean> {
  try {
    // 1. Save master catalog to site_content
    await saveSupabaseSiteContent("all_technicians", technicians, "technicians");

    // 2. Save individual technician permission keys
    for (const tech of technicians) {
      const permsPayload = {
        allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
        can_receive_payment: !!tech.can_receive_payment,
        email: tech.email || "",
        username: tech.username || "",
        password: tech.password || "",
      };
      await saveSupabaseSiteContent(`tech_perms_${tech.id}`, permsPayload, "technicians");
      const normName = tech.full_name.trim().toLowerCase();
      await saveSupabaseSiteContent(`tech_perms_name_${encodeURIComponent(normName)}`, permsPayload, "technicians");

      // Also upsert to technicians table
      const { error: techErr } = await supabase.from("technicians").upsert({
        id: tech.id,
        full_name: tech.full_name,
        specialty: tech.specialty,
        phone: tech.phone,
        is_active: tech.is_active,
      });
      if (techErr) {
        await supabase.from("technicians").upsert({
          full_name: tech.full_name,
          specialty: tech.specialty,
          phone: tech.phone,
          is_active: tech.is_active,
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
export async function saveSupabaseTechnician(tech: Technician, allTechs?: Technician[]) {
  try {
    const { error } = await supabase.from("technicians").upsert({
      id: tech.id,
      full_name: tech.full_name,
      specialty: tech.specialty,
      phone: tech.phone,
      is_active: tech.is_active,
    });
    if (error) {
      await supabase.from("technicians").upsert({
        full_name: tech.full_name,
        specialty: tech.specialty,
        phone: tech.phone,
        is_active: tech.is_active,
      });
    }

    const permsPayload = {
      allowed_tabs: Array.isArray(tech.allowed_tabs) ? tech.allowed_tabs : [],
      can_receive_payment: !!tech.can_receive_payment,
      email: tech.email || "",
      username: tech.username || "",
      password: tech.password || "",
    };
    await saveSupabaseSiteContent(`tech_perms_${tech.id}`, permsPayload, "technicians");
    const normName = tech.full_name.trim().toLowerCase();
    await saveSupabaseSiteContent(`tech_perms_name_${encodeURIComponent(normName)}`, permsPayload, "technicians");

    if (allTechs && Array.isArray(allTechs)) {
      await saveSupabaseSiteContent("all_technicians", allTechs, "technicians");
    }
    broadcastRealtimeChange("technician_saved");
  } catch (err) {
    console.warn("Supabase technician deferred:", err);
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
export async function saveSupabaseInventoryItem(item: InventoryItem) {
  try {
    // 1. Try upserting with all columns
    const { error } = await supabase.from("inventory_items").upsert({
      id: item.id,
      sku_barcode: item.sku_barcode,
      name: item.name,
      brand: item.brand || null,
      serial_number: item.serial_number || null,
      category: item.category || "Repuestos",
      stock_quantity: typeof item.stock_quantity === "number" ? item.stock_quantity : 0,
      initial_stock: typeof item.initial_stock === "number" ? item.initial_stock : null,
      entries: typeof item.entries === "number" ? item.entries : 0,
      exits: typeof item.exits === "number" ? item.exits : 0,
      counted_stock: typeof item.counted_stock === "number" ? item.counted_stock : null,
      counted_status: item.counted_status || null,
      unit_price: typeof item.unit_price === "number" ? item.unit_price : 0,
      min_stock_alert: typeof item.min_stock_alert === "number" ? item.min_stock_alert : 2,
    });

    if (error) {
      // 2. Fallback to base columns if extended columns (brand, serial_number, etc.) do not exist yet
      console.warn("Retrying with base inventory columns due to schema error:", error.message);
      await supabase.from("inventory_items").upsert({
        id: item.id,
        sku_barcode: item.sku_barcode,
        name: item.name,
        category: item.category || "Repuestos",
        stock_quantity: typeof item.stock_quantity === "number" ? item.stock_quantity : 0,
        unit_price: typeof item.unit_price === "number" ? item.unit_price : 0,
        min_stock_alert: typeof item.min_stock_alert === "number" ? item.min_stock_alert : 2,
      });
    }
    broadcastRealtimeChange("inventory_item_updated");
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
    const fullPayload = sanitizedItems.map((item) => ({
      id: item.id,
      sku_barcode: item.sku_barcode,
      name: item.name,
      brand: item.brand || null,
      serial_number: item.serial_number || null,
      category: item.category || "Repuestos",
      stock_quantity: typeof item.stock_quantity === "number" ? item.stock_quantity : 0,
      initial_stock: typeof item.initial_stock === "number" ? item.initial_stock : null,
      entries: typeof item.entries === "number" ? item.entries : 0,
      exits: typeof item.exits === "number" ? item.exits : 0,
      counted_stock: typeof item.counted_stock === "number" ? item.counted_stock : null,
      counted_status: item.counted_status || null,
      unit_price: typeof item.unit_price === "number" ? item.unit_price : 0,
      min_stock_alert: typeof item.min_stock_alert === "number" ? item.min_stock_alert : 2,
    }));

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
export async function saveSupabaseWorkOrder(order: WorkOrder) {
  try {
    let diagText = (order.diagnostic_notes || "").replace(/\[ALLOW_MOD\]:\s*(true|false)/gi, "").trim();
    if (order.allow_modifications) {
      diagText = `${diagText}\n[ALLOW_MOD]: true`.trim();
    }
    if (order.observations && !diagText.includes("[OBSERVACIONES]:")) {
      diagText = `${diagText}\n[OBSERVACIONES]: ${order.observations}`.trim();
    }

    const { error } = await supabase.from("work_orders").upsert({
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
    });
    // Also save in site_content key as fallback sync
    await saveSupabaseSiteContent(`wo_mod_${order.id}`, {
      allow_modifications: !!order.allow_modifications,
      status: order.status,
      updated_at: new Date().toISOString(),
    });
    broadcastRealtimeChange("work_order_updated");
    if (error) console.warn("Supabase work order save warning:", error.message);
  } catch (err) {
    console.warn("Supabase work order deferred:", err);
  }
}

export async function deleteSupabaseWorkOrder(id: string) {
  try {
    const { error } = await supabase.from("work_orders").delete().eq("id", id);
    if (error) console.warn("Supabase work order delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase work order delete deferred:", err);
  }
}

export async function deleteSupabaseMultipleWorkOrders(ids: string[]) {
  try {
    const { error } = await supabase.from("work_orders").delete().in("id", ids);
    if (error) console.warn("Supabase multiple work orders delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase multiple work orders delete deferred:", err);
  }
}

export const deleteMultipleSupabaseWorkOrders = deleteSupabaseMultipleWorkOrders;

export async function clearSupabaseWorkOrders() {
  try {
    const { error } = await supabase.from("work_orders").delete().neq("id", "");
    if (error) console.warn("Supabase work orders clear warning:", error.message);
  } catch (err) {
    console.warn("Supabase work orders clear deferred:", err);
  }
}

// ---------------------------------------------------------------------
// VEHICLES SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseVehicle(v: Vehicle) {
  try {
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
  } catch (err) {
    console.warn("Supabase vehicle deferred:", err);
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

// Generic fast parallel batch fetcher for tables with > 1000 records
async function fetchAllSupabaseTable(tableName: string) {
  try {
    const PAGE_SIZE = 1000;
    const { data: firstPage, error } = await supabase
      .from(tableName)
      .select("*")
      .range(0, PAGE_SIZE - 1);

    if (error || !firstPage || firstPage.length === 0) {
      return firstPage || [];
    }

    if (firstPage.length < PAGE_SIZE) {
      return firstPage;
    }

    // If more rows exist, fetch remaining pages in fast parallel batches
    let allRecords = [...firstPage];
    const parallelRanges = [
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
      [6000, 6999],
      [7000, 7999],
      [8000, 8999],
      [9000, 9999],
      [10000, 10999],
    ];

    const results = await Promise.all(
      parallelRanges.map(([from, to]) =>
        supabase.from(tableName).select("*").range(from, to)
      )
    );

    for (const res of results) {
      if (res.data && res.data.length > 0) {
        allRecords = allRecords.concat(res.data);
      }
    }

    return allRecords;
  } catch (err) {
    console.warn(`Supabase pagination fetch deferred for table ${tableName}:`, err);
    return null;
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
      orderQuery = orderQuery
        .gte("entry_time", `${queryDate}T00:00:00`)
        .lte("entry_time", `${queryDate}T23:59:59`);
      invoiceQuery = invoiceQuery
        .gte("issued_at", `${queryDate}T00:00:00`)
        .lte("issued_at", `${queryDate}T23:59:59`);
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

// Broadcast instant real-time signal to all other connected devices/tablets
export async function broadcastRealtimeChange(eventType: string = "db_update") {
  try {
    const channel = supabase.channel("global-erp-sync");
    await channel.send({
      type: "broadcast",
      event: "db_update",
      payload: { eventType, timestamp: Date.now() },
    });
  } catch (err) {
    // deferred
  }
}

// ---------------------------------------------------------------------
// CERTIFICATIONS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseCertification(cert: Certification) {
  try {
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
  } catch (err) {
    console.warn("Supabase certification deferred:", err);
  }
}

// ---------------------------------------------------------------------
// SCHEDULE & PROGRAMACION SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseScheduleRecord(record: ScheduleRecord) {
  try {
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

export async function fetchSupabaseErpData() {
  try {
    const [techRes, invData, orderData, appRes, invoiceData, vehicleData, certData, contentRes] = await Promise.all([
      safeQuery<any[]>(supabase.from("technicians").select("*")),
      fetchAllSupabaseTable("inventory_items"),
      fetchAllSupabaseTable("work_orders"),
      safeQuery<any[]>(supabase.from("appointments").select("*")),
      fetchAllSupabaseTable("invoices"),
      fetchAllSupabaseTable("vehicles"),
      safeQuery<any[]>(supabase.from("certifications").select("*")),
      safeQuery<any[]>(supabase.from("site_content").select("*")),
    ]);

    // Build permissions, certifications, and schedule records from site_content if any
    const permsMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; email?: string; username?: string; password?: string }> = {};
    const permsNameMap: Record<string, { allowed_tabs?: string[]; can_receive_payment?: boolean; email?: string; username?: string; password?: string }> = {};
    const fallbackCerts: any[] = [];
    const fallbackSched: any[] = [];
    const fallbackInventory: InventoryItem[] = [];
    let fallbackRecentIngresos: any[] = [];
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
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch {}
        } else if (k && k.startsWith("tech_perms_")) {
          const techId = k.replace("tech_perms_", "");
          try {
            const rawVal = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(rawVal)) {
              permsMap[techId] = { allowed_tabs: rawVal, can_receive_payment: false };
            } else if (rawVal && typeof rawVal === "object") {
              permsMap[techId] = {
                allowed_tabs: Array.isArray(rawVal.allowed_tabs) ? rawVal.allowed_tabs : undefined,
                can_receive_payment: rawVal.can_receive_payment !== undefined ? !!rawVal.can_receive_payment : undefined,
                email: rawVal.email || "",
                username: rawVal.username || "",
                password: rawVal.password || "",
              };
            }
          } catch {}
        } else if (k === "all_technicians") {
          try {
            const tList = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(tList)) fallbackTechs.push(...tList);
          } catch {}
        } else if (k && k.startsWith("cert_")) {
          try {
            const certObj = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (certObj && certObj.id) fallbackCerts.push(certObj);
          } catch {}
        } else if (k && k.startsWith("sched_")) {
          try {
            const sObj = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (sObj && sObj.id) fallbackSched.push(sObj);
          } catch {}
        } else if (k === "all_schedule_records") {
          try {
            const sList = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(sList)) fallbackSched.push(...sList);
          } catch {}
        } else if (k === "all_inventory_records") {
          try {
            const invList = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(invList)) fallbackInventory.push(...invList);
          } catch {}
        } else if (k === "inventory_recent_ingresos") {
          try {
            const list = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || row.content);
            if (Array.isArray(list)) fallbackRecentIngresos = list;
          } catch {}
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
        } catch {}
      }
    }

    const reconstructedVehiclesMap = new Map<string, any>();
    const reconstructedInvoicesMap = new Map<string, any>();

    // Seed with backup vehicles/invoices if available
    if (masterBackup?.vehicles) {
      masterBackup.vehicles.forEach((v: any) => {
        if (v && v.plate) reconstructedVehiclesMap.set(v.plate.toUpperCase(), v);
      });
    }
    if (masterBackup?.invoices) {
      masterBackup.invoices.forEach((i: any) => {
        if (i && (i.work_order_id || i.id)) reconstructedInvoicesMap.set(i.work_order_id || i.id, i);
      });
    }

    // Also populate with database vehicles/invoices
    if (Array.isArray(vehicleData)) {
      vehicleData.forEach((v: any) => {
        if (v && v.plate) {
          const existing = reconstructedVehiclesMap.get(v.plate.toUpperCase());
          reconstructedVehiclesMap.set(v.plate.toUpperCase(), { ...existing, ...v });
        }
      });
    }
    if (Array.isArray(invoiceData)) {
      invoiceData.forEach((i: any) => {
        if (i && (i.work_order_id || i.id)) {
          const existing = reconstructedInvoicesMap.get(i.work_order_id || i.id);
          reconstructedInvoicesMap.set(i.work_order_id || i.id, { ...existing, ...i });
        }
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
            quinquennialDate = meta.q_date || meta.quinquennial_date || quinquennialDate;
            chipExpiryDate = meta.c_date || meta.chip_expiry_date || chipExpiryDate;
            vehicleType = meta.v_type || meta.vehicle_type || vehicleType;
            generalMaintenanceService = meta.m_serv || meta.general_maintenance_service || generalMaintenanceService;
            sparePartsServices = meta.sp_serv || meta.spare_parts_services || sparePartsServices;

            // Reconstruct vehicle
            if (o.vehicle_plate) {
              const plateKey = o.vehicle_plate.toUpperCase();
              const existingVeh = reconstructedVehiclesMap.get(plateKey) || {};
              reconstructedVehiclesMap.set(plateKey, {
                plate: o.vehicle_plate,
                brand: meta.brand || existingVeh.brand || "",
                model: existingVeh.model || "",
                year: existingVeh.year || 0,
                color: existingVeh.color || "",
                fuel_type: meta.fuel || existingVeh.fuel_type || "",
                vehicle_type: vehicleType || existingVeh.vehicle_type || "",
                owner_name: meta.c_name || meta.client_name || existingVeh.owner_name || "",
                owner_phone: meta.c_phone || meta.client_phone || existingVeh.owner_phone || "",
                current_mileage: meta.km || meta.current_mileage || existingVeh.current_mileage || 0,
                last_visit_date: o.entry_time || existingVeh.last_visit_date || new Date().toISOString(),
              });
            }

            // Reconstruct invoice
            const invKey = o.id;
            const existingInv = reconstructedInvoicesMap.get(invKey) || {};
            reconstructedInvoicesMap.set(invKey, {
              id: existingInv.id || `inv-${o.id}`,
              work_order_id: o.id,
              vehicle_plate: o.vehicle_plate,
              client_name: meta.c_name || meta.client_name || existingInv.client_name || "",
              customer_doc: meta.doc || existingInv.customer_doc || "",
              customer_address: existingInv.customer_address || "",
              labor_fee: existingInv.labor_fee || 0,
              parts_total: existingInv.parts_total || 0,
              certification_fee: existingInv.certification_fee || 0,
              grand_total: existingInv.grand_total || 0,
              payment_status: existingInv.payment_status || "pagado",
              payment_method: meta.p_method || existingInv.payment_method || "",
              issued_at: o.entry_time || existingInv.issued_at || new Date().toISOString(),
              receipt_number: meta.rcpt_num || existingInv.receipt_number || "",
              receipt_type: meta.rcpt_type || existingInv.receipt_type || "",
              discounts: meta.disc !== undefined ? meta.disc : (existingInv.discounts || ""),
              credit_amount: meta.cred || existingInv.credit_amount || 0,
              raw_price_str: meta.r_price || existingInv.raw_price_str || "",
              raw_credit_str: meta.r_cred || existingInv.raw_credit_str || "",
              payment_condition: meta.cond || existingInv.payment_condition || "",
              payment_destination: meta.p_dest || existingInv.payment_destination || "",
            });
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

      return {
        ...o,
        quinquennial_date: quinquennialDate || o.quinquennial_date || "",
        chip_expiry_date: chipExpiryDate || o.chip_expiry_date || "",
        vehicle_type: vehicleType || o.vehicle_type || "",
        general_maintenance_service: generalMaintenanceService || o.general_maintenance_service || "",
        spare_parts_services: sparePartsServices || o.spare_parts_services || "",
        allow_modifications: allowMod || !!o.allow_modifications,
        diagnostic_notes: diagNotes,
        observations: obs || o.observations || undefined,
        items: (() => {
          let parsed: any[] = [];
          try {
            parsed = typeof o.items === "string" ? JSON.parse(o.items || "[]") : o.items || [];
          } catch {
            parsed = [];
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
    const finalInvoices = Array.from(reconstructedInvoicesMap.values());
    const mergedCerts = certData.data && certData.data.length > 0 ? certData.data : fallbackCerts;

    let finalInventory: InventoryItem[] = [];
    if (Array.isArray(invData) && invData.length >= fallbackInventory.length && invData.length > 0) {
      finalInventory = invData;
    } else if (fallbackInventory.length > 0) {
      finalInventory = fallbackInventory;
    } else if (Array.isArray(invData) && invData.length > 0) {
      finalInventory = invData;
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

        return {
          ...t,
          email: perm?.email || fbTech?.email || t.email || "",
          username: perm?.username || fbTech?.username || t.username || defUser,
          password: perm?.password || fbTech?.password || t.password || defUser,
          allowed_tabs: finalAllowedTabs,
          can_receive_payment: perm?.can_receive_payment !== undefined
            ? perm.can_receive_payment
            : (fbTech?.can_receive_payment !== undefined ? fbTech.can_receive_payment : !!t.can_receive_payment),
        };
      });
    } else if (fallbackTechs.length > 0) {
      finalTechnicians = fallbackTechs;
    }

    return {
      technicians: finalTechnicians,
      inventoryItems: finalInventory,
      workOrders: formattedOrders.length > 0 ? formattedOrders : null,
      appointments: appRes.data ? appRes.data : null,
      invoices: finalInvoices.length > 0 ? finalInvoices : (invoiceData || []),
      vehicles: finalVehicles.length > 0 ? finalVehicles : (vehicleData || []),
      certifications: mergedCerts.length > 0 ? mergedCerts : null,
      scheduleRecords: fallbackSched.length > 0 ? fallbackSched : null,
      recentIngresos: fallbackRecentIngresos,
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
    if (error) console.warn("Supabase appointment save warning:", error.message);
  } catch (err) {
    console.warn("Supabase appointment deferred:", err);
  }
}

export async function deleteSupabaseAppointment(id: string) {
  try {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) console.warn("Supabase appointment delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase appointment delete deferred:", err);
  }
}

// ---------------------------------------------------------------------
// INVOICES SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseInvoice(inv: Invoice) {
  try {
    const { error } = await supabase.from("invoices").upsert({
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
    });
    broadcastRealtimeChange("invoice_updated");
    if (error) console.warn("Supabase invoice save warning:", error.message);
  } catch (err) {
    console.warn("Supabase invoice deferred:", err);
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

    // 1. Vehicles chunked save
    if (vehicles.length > 0) {
      const vehiclesPayload = vehicles.map((v) => ({
        plate: v.plate || "",
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
      }));

      for (let i = 0; i < vehiclesPayload.length; i += CHUNK_SIZE) {
        const chunk = vehiclesPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("vehicles").upsert(chunk);
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

      const ordersPayload = orders.map((o) => {
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

        return {
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
        };
      });

      for (let i = 0; i < ordersPayload.length; i += CHUNK_SIZE) {
        const chunk = ordersPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("work_orders").upsert(chunk);
        if (error) {
          console.warn("Supabase work_orders upsert warning:", error.message);
          lastError = `Tabla órdenes: ${error.message}`;
        }
      }
    }

    // 3. Invoices chunked save (all columns included)
    if (invoices.length > 0) {
      const invoicesPayload = invoices.map((inv) => ({
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
      }));

      for (let i = 0; i < invoicesPayload.length; i += CHUNK_SIZE) {
        const chunk = invoicesPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("invoices").upsert(chunk);
        if (error) {
          console.warn("Supabase invoices upsert warning:", error.message);
        }
      }
    }

    // 4. Save entire workshop data package in site_content backup
    await saveSupabaseSiteContent("master_workshop_backup", {
      vehicles,
      workOrders: orders,
      invoices,
      updated_at: new Date().toISOString(),
    }, "workshop");

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
