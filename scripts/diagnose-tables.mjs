// Diagnóstico de tablas Supabase (ReyGas) — prueba el flujo REAL de escritura
// Uso: node scripts/diagnose-tables.mjs
const SUPABASE_URL = "https://zkqlegxjynwurxzfhyzt.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw";

async function req(path, opts = {}) {
    const { headers = {}, ...restOpts } = opts;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...restOpts,
        headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
            ...headers,
        },
    });
    let body = null;
    try {
        body = await res.json();
    } catch { }
    return { status: res.status, body };
}

const now = new Date().toISOString();

// --- work_orders: upsert real con onConflict y tecnico como texto (igual que import CSV) ---
console.log("=== work_orders (onConflict + tecnico texto) ===");
const woId = `diag_wo_${Date.now()}`;
const wo = await req("work_orders?id=eq." + woId, {
    method: "POST",
    body: JSON.stringify({
        id: woId,
        vehicle_plate: "DIAG-999",
        status: "pagado_autorizado",
        assigned_technician_id: "Juan Perez",
        problem_description: "Prueba tecnico texto",
        diagnostic_notes: "Notas",
        observations: null,
        entry_time: now,
        completion_time: null,
        items: "[]",
        quinquennial_date: null,
        chip_expiry_date: null,
        vehicle_type: null,
        general_maintenance_service: null,
        spare_parts_services: null,
        discount_amount: 0,
        requires_certification: false,
        certification_type: null,
        certification_price: 0,
        allow_modifications: false,
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
});
console.log("status=" + wo.status);
console.log("resp=" + JSON.stringify(wo.body));
await req("work_orders?id=eq." + woId, { method: "DELETE" });

// --- vehicles: upsert real con onConflict por plate ---
console.log("\n=== vehicles (onConflict por plate) ===");
const plate = `DIAG-${Date.now()}`;
const veh = await req("vehicles?plate=eq." + encodeURIComponent(plate), {
    method: "POST",
    body: JSON.stringify({
        plate: plate,
        brand: "TEST",
        model: "",
        year: 0,
        color: "",
        fuel_type: "",
        vehicle_type: null,
        owner_name: "",
        owner_phone: "",
        current_mileage: 0,
        last_visit_date: now,
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
});
console.log("status=" + veh.status);
console.log("resp=" + JSON.stringify(veh.body));
await req("vehicles?plate=eq." + encodeURIComponent(plate), { method: "DELETE" });

// --- invoices: upsert real con onConflict ---
console.log("\n=== invoices (onConflict por id) ===");
const invId = `diag_inv_${Date.now()}`;
const inv = await req("invoices?id=eq." + invId, {
    method: "POST",
    body: JSON.stringify({
        id: invId,
        work_order_id: null,
        vehicle_plate: "DIAG-999",
        client_name: "Cliente",
        customer_doc: null,
        customer_address: null,
        labor_fee: 0,
        parts_total: 0,
        certification_fee: 0,
        grand_total: 0,
        payment_status: "pagado",
        payment_method: "",
        issued_at: now,
        paid_at: null,
        receipt_number: null,
        receipt_type: null,
        discounts: null,
        credit_amount: 0,
        raw_price_str: null,
        raw_credit_str: null,
        payment_condition: null,
        payment_destination: null,
        observations: null,
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
});
console.log("status=" + inv.status);
console.log("resp=" + JSON.stringify(inv.body));
await req("invoices?id=eq." + invId, { method: "DELETE" });

console.log("\n=== FIN ===");
