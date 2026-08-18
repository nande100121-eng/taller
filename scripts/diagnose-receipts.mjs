// Diagnóstico v2: ver valores reales de columnas TIPO(3), N°(8), COMPROBANTE(20) en los CSV de registro taller.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function parseCSVRows(rawText) {
    if (!rawText) return [];
    const lines = rawText.split(/\r\n|\n/);
    const sample = lines.slice(0, 15).join("\n");
    let delimiter = ";";
    const semiCount = (sample.match(/;/g) || []).length;
    const tabCount = (sample.match(/\t/g) || []).length;
    const commaCount = (sample.match(/,/g) || []).length;
    if (semiCount >= commaCount && semiCount >= tabCount && semiCount > 0) delimiter = ";";
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
    else delimiter = ",";
    const rows = [];
    for (const line of lines) {
        if (!line || !line.trim()) continue;
        if (!line.includes('"')) {
            rows.push(line.split(delimiter).map((c) => c.trim()));
            continue;
        }
        const cols = [];
        let insideQuotes = false;
        let currentCell = "";
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (insideQuotes && line[i + 1] === '"') { currentCell += '"'; i++; }
                else insideQuotes = !insideQuotes;
            } else if (ch === delimiter && !insideQuotes) {
                cols.push(currentCell.trim());
                currentCell = "";
            } else currentCell += ch;
        }
        cols.push(currentCell.trim());
        rows.push(cols);
    }
    return rows;
}

const files = ["registro taller.csv", "registro taller 170826.csv"];
const distinctTipo = new Map();
const distinctComp = new Map();
const numSamples = { TICKET: new Set(), BOLETA: new Set(), FACTURA: new Set(), OTRO: new Set() };
const maxNum = { TICKET: 0, BOLETA: 0, FACTURA: 0 };

for (const file of files) {
    const p = path.join(projectRoot, file);
    if (!fs.existsSync(p)) continue;
    const rows = parseCSVRows(fs.readFileSync(p, "utf8"));
    console.log(`\n=== ${file} ===`);
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const tipo = String(r[3] || "").trim();
        const num = String(r[8] || "").trim();
        const comp = String(r[20] || "").trim();
        if (tipo) distinctTipo.set(tipo, (distinctTipo.get(tipo) || 0) + 1);
        if (comp) distinctComp.set(comp, (distinctComp.get(comp) || 0) + 1);
        // clasificar
        let cls = "OTRO";
        const u = (tipo + " " + comp).toUpperCase();
        if (/FACTURA/.test(u)) cls = "FACTURA";
        else if (/BOLETA/.test(u)) cls = "BOLETA";
        else if (/TICKET|TICKET|^T/.test(u)) cls = "TICKET";
        if (numSamples[cls].size < 8 && num) numSamples[cls].add(num);
        const cleanNum = parseInt(num.replace(/\D/g, ""), 10);
        if (!isNaN(cleanNum) && cleanNum < 99999999 && cleanNum > maxNum[cls]) maxNum[cls] = cleanNum;
    }
    // print some rows
    console.log("Muestra de 10 filas (tipo | num | comprobante):");
    for (let i = 1; i < Math.min(rows.length, 11); i++) {
        const r = rows[i];
        console.log(`  [${i}] tipo="${r[3]}" | num="${r[8]}" | comprobante="${r[20]}"`);
    }
}

console.log("\n===== DISTINTOS valores columna TIPO =====");
console.log([...distinctTipo.entries()]);
console.log("\n===== DISTINTOS valores columna COMPROBANTE =====");
console.log([...distinctComp.entries()]);
console.log("\n===== SAMPLES por clasificación =====");
for (const k of ["TICKET", "BOLETA", "FACTURA", "OTRO"]) {
    console.log(`[${k}] maxNum=${maxNum[k]} samples=${[...numSamples[k]]}`);
}
