// Diagnóstico del reporte diario del taller (ReyGas)
// Uso: node scripts/diagnose-day.mjs [YYYY-MM-DD]
// Lista WOs, invoices y detecta cruces de fechas WO<->invoice.
const SUPABASE_URL = "https://zkqlegxjynwurxzfhyzt.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw";

const targetDate = process.argv[2] || "2026-08-17";

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

const dayA = targetDate;
const dayB = "2026-08-18";

// ---- WOs del día (rango timestamptz) ----
const woRows = [];
for (const d of [dayA, dayB]) {
    const r = await req(`work_orders?entry_time=gte.${d}T00:00:00-05:00&entry_time=lt.${d}T23:59:59-05:00&select=id,vehicle_plate,status,entry_time,items,general_maintenance_service,requires_certification,certification_price,assigned_technician_id&order=entry_time.desc`);
    if (Array.isArray(r.body)) woRows.push(...r.body.map((w) => ({ ...w, srcDay: d })));
}

// ---- Invoices del día (rango timestamptz) ----
const invRows = [];
for (const d of [dayA, dayB]) {
    const r = await req(`invoices?issued_at=gte.${d}T00:00:00-05:00&issued_at=lt.${d}T23:59:59-05:00&select=id,work_order_id,vehicle_plate,payment_status,grand_total,issued_at,receipt_number,payment_method&order=issued_at.desc`);
    if (Array.isArray(r.body)) invRows.push(...r.body.map((i) => ({ ...i, srcDay: d })));
}

console.log(`=== WORK_ORDERS (entry/created en ${dayA}) ===`);
const woDay = woRows.filter((w) => (w.entry_time || w.created_at || "").slice(0, 10) === dayA);
console.log(`Total WOs del día: ${woDay.length}`);
woDay.forEach((w) => {
    const dateStr = (w.entry_time || w.created_at || "").slice(0, 10);
    console.log(`WO ${w.id} | ${w.vehicle_plate} | status=${w.status} | fecha=${dateStr} | gms=${(w.general_maintenance_service || "").slice(0, 40)} | items=${Array.isArray(w.items) ? w.items.length : (w.items || "").toString().length}`);
});

console.log(`\n=== INVOICES (issued_at en ${dayA}) ===`);
const invDay = invRows.filter((i) => (i.issued_at || "").slice(0, 10) === dayA);
console.log(`Total invoices del día: ${invDay.length}`);
invDay.forEach((i) => {
    console.log(`INV ${i.id} | wo=${i.work_order_id || "-"} | ${i.vehicle_plate || "S/P"} | status=${i.payment_status} | total=${i.grand_total} | fecha=${(i.issued_at || "").slice(0, 10)} | rec=${i.receipt_number}`);
});

// ---- CRUCES: WOs del día con invoice emitida en otro día ----
console.log(`\n=== CRUCES POTENCIALES ===`);
console.log("--- A) WOs del día cuya invoice asociada fue emitida en OTRO día ---");
for (const w of woDay) {
    const r = await req(`invoices?work_order_id=eq.${w.id}&select=id,issued_at,grand_total,payment_status,vehicle_plate`);
    if (Array.isArray(r.body) && r.body.length > 0) {
        r.body.forEach((inv) => {
            const invDate = (inv.issued_at || "").slice(0, 10);
            if (invDate !== dayA) {
                console.log(`  !! WO ${w.id} (${w.vehicle_plate}, día ${dayA}) tiene invoice ${inv.id} de ${invDate} total=${inv.grand_total}`);
            } else {
                console.log(`  OK WO ${w.id} (${w.vehicle_plate}) invoice ${inv.id} mismo día ${invDate}`);
            }
        });
    } else {
        console.log(`  -- WO ${w.id} (${w.vehicle_plate}) sin invoice`);
    }
}

console.log("--- B) Invoices del día cuyo WO pertenece a OTRO día ---");
for (const i of invDay) {
    if (!i.work_order_id) continue;
    const r = await req(`work_orders?id=eq.${i.work_order_id}&select=id,vehicle_plate,entry_time,created_at,status`);
    if (Array.isArray(r.body) && r.body.length > 0) {
        const w = r.body[0];
        const woDate = (w.entry_time || w.created_at || "").slice(0, 10);
        if (woDate && woDate !== dayA) {
            console.log(`  !! INV ${i.id} (día ${dayA}) pertenece a WO ${w.id} de ${woDate} (${w.vehicle_plate})`);
        }
    } else {
        console.log(`  ?? INV ${i.id} con work_order_id ${i.work_order_id} no encontrado en work_orders`);
    }
}

console.log("\n=== FIN ===");
