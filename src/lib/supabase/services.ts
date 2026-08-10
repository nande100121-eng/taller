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
      result[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    });
    return result as Partial<SiteContent>;
  } catch (err) {
    console.warn("Supabase not connected, using resilient state fallback.", err);
    return null;
  }
}

export async function saveSupabaseSiteContent(key: string, value: any, category: string = "general") {
  try {
    const { error } = await supabase.from("site_content").upsert({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : value,
      category,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(`Supabase site_content upsert warning for key [${key}]:`, error.message);
    }
  } catch (err) {
    console.warn("Supabase API call deferred:", err);
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

// ---------------------------------------------------------------------
// WORK ORDERS SUPABASE SYNC
// ---------------------------------------------------------------------
export async function saveSupabaseWorkOrder(order: WorkOrder) {
  try {
    const { error } = await supabase.from("work_orders").upsert({
      id: order.id,
      vehicle_plate: order.vehicle_plate,
      status: order.status,
      assigned_technician_id: order.assigned_technician_id,
      problem_description: order.problem_description,
      diagnostic_notes: order.diagnostic_notes,
      entry_time: order.entry_time,
    });
    if (error) console.warn("Supabase work order save warning:", error.message);
  } catch (err) {
    console.warn("Supabase work order deferred:", err);
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
      labor_fee: inv.labor_fee,
      parts_total: inv.parts_total,
      certification_fee: inv.certification_fee,
      grand_total: inv.grand_total,
      payment_status: inv.payment_status,
      payment_method: inv.payment_method,
      issued_at: inv.issued_at,
    });
    if (error) console.warn("Supabase invoice save warning:", error.message);
  } catch (err) {
    console.warn("Supabase invoice deferred:", err);
  }
}
