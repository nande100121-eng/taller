import { supabase } from "./client";
import { SiteContent, SiteTheme, Technician, InventoryItem, Vehicle, WorkOrder, Appointment, Invoice, Certification } from "@/lib/store/app-store";

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

    // Attempt Schema 1: { key, value }
    let { error } = await supabase.from("site_content").upsert({
      key,
      value: serializedValue,
      category,
      updated_at: new Date().toISOString(),
    });

    // Fallback Attempt Schema 2: { section_key, content } if table uses section_key column
    if (error) {
      const retry = await supabase.from("site_content").upsert({
        section_key: key,
        content: typeof value === "object" ? value : { data: value },
        updated_at: new Date().toISOString(),
      });
      if (retry.error) {
        console.warn(`Supabase site_content upsert warning for key [${key}]:`, retry.error.message);
      }
    }
  } catch (err) {
    console.warn("Supabase API call deferred:", err);
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
export async function saveSupabaseTechnician(tech: Technician) {
  try {
    const { error } = await supabase.from("technicians").upsert({
      id: tech.id,
      full_name: tech.full_name,
      specialty: tech.specialty,
      phone: tech.phone,
      is_active: tech.is_active,
    });
    if (tech.allowed_tabs) {
      await saveSupabaseSiteContent(`tech_perms_${tech.id}`, tech.allowed_tabs);
    }
    if (error) console.warn("Supabase technician save warning:", error.message);
  } catch (err) {
    console.warn("Supabase technician deferred:", err);
  }
}

// ---------------------------------------------------------------------
// INVENTORY SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseInventoryItem(item: InventoryItem) {
  try {
    const { error } = await supabase.from("inventory_items").upsert({
      id: item.id,
      sku_barcode: item.sku_barcode,
      name: item.name,
      category: item.category,
      stock_quantity: item.stock_quantity,
      unit_price: item.unit_price,
      min_stock_alert: item.min_stock_alert,
    });
    if (error) console.warn("Supabase inventory save warning:", error.message);
  } catch (err) {
    console.warn("Supabase inventory deferred:", err);
  }
}

export async function deleteSupabaseInventoryItem(id: string) {
  try {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) console.warn("Supabase inventory delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase inventory delete deferred:", err);
  }
}

export async function deleteMultipleSupabaseInventoryItems(ids: string[]) {
  try {
    const { error } = await supabase.from("inventory_items").delete().in("id", ids);
    if (error) console.warn("Supabase inventory multi-delete warning:", error.message);
  } catch (err) {
    console.warn("Supabase inventory multi-delete deferred:", err);
  }
}

export async function clearSupabaseInventory() {
  try {
    const { error } = await supabase.from("inventory_items").delete().neq("id", "");
    if (error) console.warn("Supabase inventory clear warning:", error.message);
  } catch (err) {
    console.warn("Supabase inventory clear deferred:", err);
  }
}

// ---------------------------------------------------------------------
// WORK ORDERS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseWorkOrder(order: WorkOrder) {
  try {
    let diagText = order.diagnostic_notes || "";
    if (order.observations) {
      diagText = `${diagText}\n[OBSERVACIONES]: ${order.observations}`.trim();
    }

    const { error } = await supabase.from("work_orders").upsert({
      id: order.id,
      vehicle_plate: order.vehicle_plate || "SN-PLACA",
      status: order.status || "pagado_autorizado",
      assigned_technician_id: order.assigned_technician_id || null,
      problem_description: order.problem_description || "Mantenimiento General",
      diagnostic_notes: diagText || null,
      entry_time: order.entry_time || new Date().toISOString(),
      items: typeof order.items === "string" ? order.items : JSON.stringify(order.items || []),
    });
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
      if (rawDiag.includes("[OBSERVACIONES]:")) {
        const parts = rawDiag.split("[OBSERVACIONES]:");
        diagNotes = parts[0].trim();
        obs = parts[1].trim();
      }
      return {
        ...o,
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

export async function fetchSupabaseErpData() {
  try {
    const [techRes, invRes, orderData, appRes, invoiceData, vehicleData, contentRes] = await Promise.all([
      safeQuery<any[]>(supabase.from("technicians").select("*")),
      safeQuery<any[]>(supabase.from("inventory_items").select("*")),
      fetchAllSupabaseTable("work_orders"),
      safeQuery<any[]>(supabase.from("appointments").select("*")),
      fetchAllSupabaseTable("invoices"),
      fetchAllSupabaseTable("vehicles"),
      safeQuery<any[]>(supabase.from("site_content").select("*")),
    ]);

    // Build permissions map from site_content if any
    const permsMap: Record<string, string[]> = {};
    if (contentRes.data) {
      contentRes.data.forEach((row: any) => {
        const k = row.key || row.section_key;
        if (k && k.startsWith("tech_perms_")) {
          const techId = k.replace("tech_perms_", "");
          try {
            permsMap[techId] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          } catch {}
        }
      });
    }

    return {
      technicians: techRes.data
        ? techRes.data.map((t: any) => ({
            ...t,
            allowed_tabs: permsMap[t.id] || t.allowed_tabs || undefined,
          }))
        : null,
      inventoryItems: invRes.data ? invRes.data : null,
      workOrders: orderData
        ? orderData.map((o: any) => {
            const rawDiag = o.diagnostic_notes || "";
            let diagNotes = rawDiag;
            let obs = "";
            if (rawDiag.includes("[OBSERVACIONES]:")) {
              const parts = rawDiag.split("[OBSERVACIONES]:");
              diagNotes = parts[0].trim();
              obs = parts[1].trim();
            }
            return {
              ...o,
              diagnostic_notes: diagNotes,
              observations: obs || o.observations || undefined,
              items: typeof o.items === "string" ? JSON.parse(o.items || "[]") : o.items || [],
            };
          })
        : null,
      appointments: appRes.data ? appRes.data : null,
      invoices: invoiceData,
      vehicles: vehicleData,
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
      vehicle_plate: inv.vehicle_plate || "SN-PLACA",
      client_name: inv.client_name || "Cliente Taller",
      labor_fee: typeof inv.labor_fee === "number" && !isNaN(inv.labor_fee) ? inv.labor_fee : 0,
      parts_total: typeof inv.parts_total === "number" && !isNaN(inv.parts_total) ? inv.parts_total : 0,
      certification_fee: typeof inv.certification_fee === "number" && !isNaN(inv.certification_fee) ? inv.certification_fee : 0,
      grand_total: typeof inv.grand_total === "number" && !isNaN(inv.grand_total) ? inv.grand_total : 0,
      payment_status: inv.payment_status || "pagado",
      payment_method: inv.payment_method || "Efectivo",
      issued_at: inv.issued_at || new Date().toISOString(),
    });
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
        plate: v.plate || "SN-PLACA",
        brand: v.brand || "Automóvil",
        model: v.model || "Importado",
        year: v.year || 2023,
        color: v.color || "Plata",
        fuel_type: v.fuel_type || "GNV",
        owner_name: v.owner_name || "Cliente Taller",
        owner_phone: v.owner_phone || "+51 900000000",
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

    // 2. Work Orders chunked save (only physical schema columns)
    if (orders.length > 0) {
      const ordersPayload = orders.map((o) => {
        let diagText = o.diagnostic_notes || "";
        if (o.observations && !diagText.includes("[OBSERVACIONES]:")) {
          diagText = `${diagText}\n[OBSERVACIONES]: ${o.observations}`.trim();
        }
        return {
          id: o.id,
          vehicle_plate: o.vehicle_plate || "SN-PLACA",
          status: o.status || "pagado_autorizado",
          assigned_technician_id: o.assigned_technician_id || null,
          problem_description: o.problem_description || "Mantenimiento General",
          diagnostic_notes: diagText || null,
          entry_time: o.entry_time || new Date().toISOString(),
          items: typeof o.items === "string" ? o.items : JSON.stringify(o.items || []),
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

    // 3. Invoices chunked save (only valid columns in Supabase schema with safe non-null values)
    if (invoices.length > 0) {
      const invoicesPayload = invoices.map((inv) => ({
        id: inv.id,
        work_order_id: inv.work_order_id,
        vehicle_plate: inv.vehicle_plate || "SN-PLACA",
        client_name: inv.client_name || "Cliente Taller",
        labor_fee: typeof inv.labor_fee === "number" && !isNaN(inv.labor_fee) ? inv.labor_fee : 0,
        parts_total: typeof inv.parts_total === "number" && !isNaN(inv.parts_total) ? inv.parts_total : 0,
        certification_fee: typeof inv.certification_fee === "number" && !isNaN(inv.certification_fee) ? inv.certification_fee : 0,
        grand_total: typeof inv.grand_total === "number" && !isNaN(inv.grand_total) ? inv.grand_total : 0,
        payment_status: inv.payment_status || "pagado",
        payment_method: inv.payment_method || "Efectivo",
        issued_at: inv.issued_at || new Date().toISOString(),
      }));

      for (let i = 0; i < invoicesPayload.length; i += CHUNK_SIZE) {
        const chunk = invoicesPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("invoices").upsert(chunk);
        if (error) {
          console.warn("Supabase invoices upsert warning:", error.message);
        }
      }
    }

    if (lastError) {
      return { success: false, errorMsg: lastError };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("Supabase bulk save error:", err);
    return { success: false, errorMsg: err?.message || "Error al conectar con Supabase" };
  }
}
