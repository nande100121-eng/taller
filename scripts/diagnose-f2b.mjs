// Diagnóstico de datos reales para la placa F2B-061 (ReyGas)
// Uso: node scripts/diagnose-f2b.mjs
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
            ...headers,
        },
    });
    let body = null;
    try { body = await res.json(); } catch { }
    return { status: res.status, body };
}

const PLATE = encodeURIComponent("F2B-061");

console.log("=== WORK_ORDERS para F2B-061 (2026-08-17) ===");
let r = await req(`work_orders?vehicle_plate=ilike.%25F2B-061%25&select=id,vehicle_plate,status,entry_time,items,general_maintenance_service,spare_parts_services,problem_description,diagnostic_notes,discount_amount,requires_certification,certification_price,allow_modifications&order=entry_time.desc`);
console.log("status=" + r.status);
if (Array.isArray(r.body)) {
    r.body.forEach((wo) => {
        console.log("WO id=" + wo.id + " status=" + wo.status + " entry_time=" + wo.entry_time);
        console.log("   items=" + wo.items);
        console.log("   gms=" + wo.general_maintenance_service + " | sps=" + wo.spare_parts_services);
        console.log("   diag=" + (wo.diagnostic_notes || "").slice(0, 200));
        console.log("   discount=" + wo.discount_amount + " reqCert=" + wo.requires_certification + " certPrice=" + wo.certification_price + " allowMod=" + wo.allow_modifications);
    });
} else {
    console.log(JSON.stringify(r.body));
}

console.log("\n=== INVOICES para F2B-061 (2026-08-17) ===");
r = await req(`invoices?vehicle_plate=ilike.%25F2B-061%25&select=id,work_order_id,vehicle_plate,client_name,parts_total,labor_fee,grand_total,payment_status,payment_method,issued_at,receipt_number,receipt_type,discounts,credit_amount,raw_price_str,raw_credit_str,payment_condition,payment_destination&order=issued_at.desc`);
console.log("status=" + r.status);
if (Array.isArray(r.body)) {
    r.body.forEach((inv) => {
        console.log("INV id=" + inv.id + " wo_id=" + inv.work_order_id + " status=" + inv.payment_status);
        console.log("   grand_total=" + inv.grand_total + " parts=" + inv.parts_total + " labor=" + inv.labor_fee);
        console.log("   raw_price_str=" + inv.raw_price_str + " raw_credit_str=" + inv.raw_credit_str);
        console.log("   credit_amount=" + inv.credit_amount + " discounts=" + inv.discounts);
        console.log("   receipt=" + inv.receipt_number + " type=" + inv.receipt_type + " method=" + inv.payment_method + " cond=" + inv.payment_condition);
        console.log("   issued_at=" + inv.issued_at);
    });
} else {
    console.log(JSON.stringify(r.body));
}

console.log("\n=== VEHICLE F2B-061 ===");
r = await req(`vehicles?plate=eq.${PLATE}&select=plate,owner_name,brand,fuel_type,current_mileage,last_visit_date`);
console.log("status=" + r.status);
console.log(JSON.stringify(r.body, null, 2));

console.log("\n=== FIN ===");
