// Diagnóstico v3: cobertura del WORKSHOP_CSV_LOOKUP generado y máximos por tipo de comprobante.
import { WORKSHOP_CSV_LOOKUP } from "../src/lib/workshop-csv-lookup.ts";

const dates = new Set();
const maxNum = { TICKET: 0, BOLETA: 0, FACTURA: 0 };
const counts = { TICKET: 0, BOLETA: 0, FACTURA: 0, OTRO: 0 };
const withNum = { TICKET: 0, BOLETA: 0, FACTURA: 0, OTRO: 0 };
const examples = { TICKET: new Set(), BOLETA: new Set(), FACTURA: new Set(), OTRO: new Set() };

for (const key of Object.keys(WORKSHOP_CSV_LOOKUP)) {
    if (key.startsWith("REC_")) continue;
    const rec = WORKSHOP_CSV_LOOKUP[key];
    if (rec.dateISO) dates.add(rec.dateISO);
    const rt = String(rec.receiptType || "").toUpperCase();
    let cls = "OTRO";
    if (rt.includes("FACTURA")) cls = "FACTURA";
    else if (rt.includes("BOLETA")) cls = "BOLETA";
    else if (rt.includes("TICKET")) cls = "TICKET";
    counts[cls]++;
    const num = parseInt(String(rec.receiptNumber || "0").replace(/\D/g, ""), 10);
    if (rec.receiptNumber && rec.receiptNumber !== "0" && !isNaN(num) && num > 0) {
        withNum[cls]++;
        if (num > maxNum[cls] && num < 99999999) maxNum[cls] = num;
        if (examples[cls].size < 6) examples[cls].add(String(rec.receiptNumber) + " / " + rt);
    }
}

const sortedDates = [...dates].sort();
console.log("Total keys (sin REC_):", Object.keys(WORKSHOP_CSV_LOOKUP).filter((k) => !k.startsWith("REC_")).length);
console.log("Rango fechas:", sortedDates[0], "->", sortedDates[sortedDates.length - 1]);
console.log("Últimas 5 fechas:", sortedDates.slice(-5));
for (const k of ["TICKET", "BOLETA", "FACTURA", "OTRO"]) {
    console.log(`\n[${k}] count=${counts[k]} withNum=${withNum[k]} maxNum=${maxNum[k]}`);
    console.log("  ejemplos:", [...examples[k]]);
}
