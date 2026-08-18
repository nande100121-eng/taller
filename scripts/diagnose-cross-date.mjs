// Diagnóstico de CRUCES DE FECHA en el reporte del taller (ReyGas)
// Uso: node scripts/diagnose-cross-date.mjs [YYYY-MM-DD]
// Detecta invoices emitidos el día X que apuntan a WOs de otra fecha,
// y WOs duplicados para la misma placa en el mismo día.
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

// Todos los WOs que tengan una invoice emitida el día objetivo (para detectar el cruce real)
console.log(`=== INVOICES emitidas el ${targetDate}: análisis WO->fecha ===`);
const invs = await req(`invoices?issued_at=gte.${targetDate}T00:00:00-05:00&issued_at=lt.${targetDate}T23:59:59-05:00&select=id,work_order_id,vehicle_plate,payment_status,grand_total,issued_at,receipt_number&order=issued_at.desc`);
console.log(`Invoices del día: ${Array.isArray(invs.body) ? invs.body.length : 0}`);

const woCache = new Map();
async function getWo(woId) {
    if (!woId) return null;
    if (woCache.has(woId)) return woCache.get(woId);
    const r = await req(`work_orders?id=eq.${woId}&select=id,vehicle_plate,entry_time,status,items,general_maintenance_service`);
    let wo = null;
    if (Array.isArray(r.body) && r.body.length > 0) wo = r.body[0];
    woCache.set(woId, wo);
    return wo;
}

let crossCount = 0;
let woCrossCount = 0;
const crossList = [];

if (Array.isArray(invs.body)) {
    for (const inv of invs.body) {
        const wo = await getWo(inv.work_order_id);
        if (!wo) {
            // WO no encontrado (puede ser null o id sin registro)
            crossCount++;
            crossList.push({ type: "WO_NO_ENCONTRADO", inv: inv.id, woId: inv.work_order_id, plate: inv.vehicle_plate, total: inv.grand_total, status: inv.payment_status });
            continue;
        }
        const woDate = (wo.entry_time || "").slice(0, 10);
        if (woDate && woDate !== targetDate) {
            crossCount++;
            const itemsArr = Array.isArray(wo.items) ? wo.items : (() => { try { const p = JSON.parse(wo.items || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })();
            const subTotal = itemsArr.reduce((a, it) => a + (Number(it.subtotal) || 0), 0);
            crossList.push({
                type: "CRUCE",
                inv: inv.id,
                woId: inv.work_order_id,
                plate: inv.vehicle_plate,
                invDate: (inv.issued_at || "").slice(0, 10),
                woDate,
                invTotal: inv.grand_total,
                woStatus: wo.status,
                woSubtotal: subTotal,
                gms: (wo.general_maintenance_service || "").slice(0, 40),
            });
        }
    }
}

console.log(`\n--- CRUCES: invoices del ${targetDate} cuyo WO es de otra fecha ---`);
console.log(`Total cruces: ${crossCount}`);
crossList.forEach((c) => {
    if (c.type === "CRUCE") {
        console.log(`  !! INV ${c.inv} (${c.plate}) emitida ${c.invDate} -> WO ${c.woId} de ${c.woDate} | invTotal=${c.invTotal} | woStatus=${c.woStatus} | woSubtotal=${c.woSubtotal} | ${c.gms}`);
    } else {
        console.log(`  ?? INV ${c.inv} (${c.plate}) con WO ${c.woId} NO ENCONTRADO | total=${c.total}`);
    }
});

// Duplicados: placas con más de un WO en el día
console.log(`\n=== WOs del ${targetDate}: duplicados por placa ===`);
const woDay = await req(`work_orders?entry_time=gte.${targetDate}T00:00:00-05:00&entry_time=lt.${targetDate}T23:59:59-05:00&select=id,vehicle_plate,status,entry_time,items,general_maintenance_service&order=entry_time.desc`);
const woList = Array.isArray(woDay.body) ? woDay.body : [];
console.log(`WOs del día: ${woList.length}`);
const byPlate = {};
woList.forEach((w) => {
    const p = (w.vehicle_plate || "S/P").toUpperCase().trim();
    if (!byPlate[p]) byPlate[p] = [];
    byPlate[p].push(w);
});
Object.keys(byPlate).forEach((p) => {
    const list = byPlate[p];
    if (list.length > 1) {
        console.log(`  PLACA ${p} tiene ${list.length} WOs:`);
        list.forEach((w) => {
            const itemsArr = Array.isArray(w.items) ? w.items : (() => { try { const pp = JSON.parse(w.items || "[]"); return Array.isArray(pp) ? pp : []; } catch { return []; } })();
            const sub = itemsArr.reduce((a, it) => a + (Number(it.subtotal) || 0), 0);
            console.log(`     WO ${w.id} | status=${w.status} | subtotal=${sub} | gms=${(w.general_maintenance_service || "").slice(0, 35)}`);
        });
    }
});

// Totales duplicados de invoices por placa en el día
console.log(`\n=== INVOICES del ${targetDate}: duplicadas por placa ===`);
const byPlateInv = {};
invs.body.forEach((i) => {
    const p = (i.vehicle_plate || "S/P").toUpperCase().trim();
    if (!byPlateInv[p]) byPlateInv[p] = [];
    byPlateInv[p].push(i);
});
Object.keys(byPlateInv).forEach((p) => {
    const list = byPlateInv[p];
    if (list.length > 1) {
        const totals = list.map((i) => `${i.grand_total}${i.work_order_id ? "*" : ""}`).join(", ");
        console.log(`  PLACA ${p} tiene ${list.length} invoices: [${totals}]`);
    }
});

console.log("\n=== FIN ===");
