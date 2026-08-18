import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const url = envRaw.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = envRaw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const client = createClient(url, key);

async function fetchAll(table) {
  const PAGE = 1000;
  let all = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + PAGE - 1);
    if (error) { console.log("ERROR", table, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// 1. CSV
const csvRaw = fs.readFileSync(path.join(process.cwd(), "DEUDA 15.08.26.csv"), "utf8");
const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim());
const header = lines[0].split(";");
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const csvRows = lines.slice(1)
  .map((l) => l.split(";"))
  .filter((c) => c[0] && /^\d+$/.test(c[0].trim()))
  .map((c) => ({
    boleta: c[idx["BOLETA"]].trim(),
    placa: (c[idx["PLACA"]] || "").trim().toUpperCase(),
    saldo: parseFloat((c[idx["SALDO PENDIENTE"]] || "").replace(/[^0-9.]/g, "")) || 0,
    total: parseFloat((c[idx["COSTO TOTAL DEL SERVICIO"]] || "").replace(/[^0-9.]/g, "")) || 0,
    obs: (c[idx["OBSERVACION"]] || "").trim(),
    resp: (c[idx["RESPONSABLE"]] || "").trim(),
  }));

const invoices = await fetchAll("invoices");
const workOrders = await fetchAll("work_orders");
const woIds = new Set(workOrders.map((w) => w.id));
const pend = invoices.filter((i) => i.payment_status === "pendiente" || (Number(i.credit_amount) || 0) > 0);
console.log("Pendientes actuales:", pend.length);

// 2. Canónicas por boleta CSV
const canonicalIds = new Set();
const canonicalPatches = [];
csvRows.forEach((r) => {
  const sameNum = pend.filter((i) => (i.receipt_number || "").replace(/\D/g, "") === r.boleta);
  if (sameNum.length === 0) return;
  const withPlate = sameNum.filter((i) => (i.vehicle_plate || "").trim().toUpperCase() === r.placa);
  const cand = (withPlate.length > 0 ? withPlate : sameNum)
    .sort((a, b) => (woIds.has(b.work_order_id) ? 1 : 0) - (woIds.has(a.work_order_id) ? 1 : 0))[0];
  canonicalIds.add(cand.id);
  canonicalPatches.push({
    id: cand.id,
    invoice: cand,
    boleta: r.boleta,
    placa: r.placa,
    patch: {
      grand_total: r.total,
      credit_amount: r.saldo,
      payment_status: "pendiente",
      payment_condition: "PENDIENTE",
      debt_observation: r.obs || null,
      debt_responsible: r.resp || null,
      paid_at: null,
    },
  });
});
console.log("Canónicas:", canonicalPatches.length);

// 3. Aplicar canónicas (idempotente): tabla con columnas existentes + snapshot completo en site_content
for (const cp of canonicalPatches) {
  const inv = cp.invoice;
  const fullSnapshot = {
    ...inv,
    ...cp.patch,
    id: inv.id,
    work_order_id: inv.work_order_id,
  };
  // a) Tabla invoices: solo columnas que existen (debt_* viven en site_content)
  const { error } = await client.from("invoices").update({
    grand_total: cp.patch.grand_total,
    credit_amount: cp.patch.credit_amount,
    payment_status: "pendiente",
    payment_condition: "PENDIENTE",
    paid_at: null,
  }).eq("id", inv.id);
  if (error) console.log("ERR tabla canónica", cp.boleta, error.message);
  // b) Snapshot completo (patrón roster) con debt_observation / debt_responsible
  const snap = {
    section_key: `inv_full_${inv.id}`,
    key: `inv_full_${inv.id}`,
    value: JSON.stringify(fullSnapshot),
    content: fullSnapshot,
    category: "invoices",
    updated_at: new Date().toISOString(),
  };
  await client.from("site_content").upsert(snap, { onConflict: "section_key" });
  if (inv.work_order_id) {
    await client.from("site_content").upsert(
      { ...snap, section_key: `inv_full_${inv.work_order_id}`, key: `inv_full_${inv.work_order_id}` },
      { onConflict: "section_key" }
    );
  }
}
console.log("Canónicas aplicadas ✓ (tabla + snapshot con debt_*)");

// 4. Marcar PAGADAS todas las demás facturas con deuda (status pendiente o credit>0) que no sean canónica
const toPayOff = pend.filter((i) => !canonicalIds.has(i.id));
console.log("A marcar pagadas:", toPayOff.length);

const CHUNK = 500;
let done = 0;
for (let i = 0; i < toPayOff.length; i += CHUNK) {
  const chunk = toPayOff.slice(i, i + CHUNK);
  const ids = chunk.map((c) => c.id);
  const { error } = await client
    .from("invoices")
    .update({
      payment_status: "pagado",
      credit_amount: 0,
      payment_condition: "PAGADO",
      paid_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) {
    console.log("ERR chunk", i, error.message);
  } else {
    done += chunk.length;
  }
  if (i % 2500 === 0) console.log(`  ...${done}/${toPayOff.length}`);
}
console.log("Marcadas pagadas:", done);

// 5. Verificación
const final = await fetchAll("invoices");
const pendFinal = final.filter((i) => i.payment_status === "pendiente" && (Number(i.credit_amount) || 0) > 0);
const sumFinal = pendFinal.reduce((s, i) => s + (Number(i.credit_amount) || 0), 0);
console.log("\n=== VERIFICACIÓN FINAL ===");
console.log("Pendientes restantes:", pendFinal.length, "| suma credit:", sumFinal.toFixed(2), "| esperado: 39 / 7325.00");
pendFinal.forEach((i) => console.log(`boleta=${i.receipt_number} placa=${i.vehicle_plate} credit=${Number(i.credit_amount)||0} resp=${i.debt_responsible || "-"}`));
