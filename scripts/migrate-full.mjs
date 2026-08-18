import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// =====================================================================
// MIGRACIÓN COMPLETA REYGAS: SUPABASE ORIGEN (gratuito) -> NUEVO PRO
// Estrategia: copia EXACTA. 1) Backup del destino a JSON local,
// 2) vaciar tablas del destino, 3) copiar todo el origen con UPSERT.
// =====================================================================

const envRaw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const SOURCE_URL = envRaw.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const SOURCE_KEY = envRaw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const TARGET_URL = "https://zpbwgodtjxhdecgsosxv.supabase.co";
const TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndnb2R0anhoZGVjZ3Nvc3h2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjIzMTk2MiwiZXhwIjoyMTAxODA3OTYyfQ.1ry6rdFVlQnwWw0EzHWeXAsoZdHef3t_cWPWE_7DWm8";

const APPLY = process.argv.includes("--apply");

console.log(`Origen:  ${SOURCE_URL}`);
console.log(`Destino: ${TARGET_URL}`);
if (!APPLY) {
  console.log("\n[DRY-RUN] No se modificará el destino. Use --apply para ejecutar.");
}

const source = createClient(SOURCE_URL, SOURCE_KEY);
const target = createClient(TARGET_URL, TARGET_KEY);

const TABLES = [
  { name: "site_content", pk: "section_key" },
  { name: "vehicles", pk: "plate" },
  { name: "technicians", pk: "id" },
  { name: "inventory_items", pk: "id" },
  { name: "work_orders", pk: "id" },
  { name: "appointments", pk: "id" },
  { name: "invoices", pk: "id" },
  { name: "certifications", pk: "id" },
  { name: "schedule_records", pk: "id" },
];

async function fetchAll(client, table) {
  const PAGE = 1000;
  let all = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + PAGE - 1);
    if (error) return { rows: all, error: error.message.slice(0, 100) };
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return { rows: all };
}

async function clearTable(client, table, pk) {
  const PAGE = 1000;
  let deleted = 0;
  let offset = 0;
  for (;;) {
    // DELETE con rango no es soportado; borramos por lotes con subquery de ids
    const { data } = await client.from(table).select(pk).range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    const ids = data.map((r) => r[pk]);
    const { error } = await client.from(table).delete().in(pk, ids);
    if (error) return { deleted, error: error.message.slice(0, 100) };
    deleted += ids.length;
    if (ids.length < PAGE) break;
    offset += PAGE;
  }
  return { deleted };
}

async function upsertChunked(client, table, rows, pk) {
  const CHUNK = 200;
  let ok = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    let chunk = rows.slice(i, i + CHUNK);
    let success = false;
    let attempts = 0;
    while (!success && attempts < 15) {
      attempts++;
      const { error } = await client.from(table).upsert(chunk, { onConflict: pk });
      if (error) {
        const m = error.message.match(/Could not find the '([^']+)' column/);
        if (m && m[1]) {
          const bad = m[1];
          chunk = chunk.map((r) => { const c = { ...r }; delete c[bad]; return c; });
          continue;
        }
        if (error.message.includes("duplicate key")) {
          // Insertar fila por fila para saltar duplicados de PK
          let rowOk = 0;
          for (const row of chunk) {
            const { error: rErr } = await client.from(table).upsert(row, { onConflict: pk });
            if (!rErr) rowOk++;
          }
          ok += rowOk;
          success = true;
          break;
        }
        return { ok, error: error.message.slice(0, 120) };
      } else {
        success = true;
        ok += chunk.length;
      }
    }
  }
  return { ok };
}

async function run() {
  const backupDir = path.join(process.cwd(), "scripts");
  const stamp = Date.now();

  for (const t of TABLES) {
    console.log(`\n=== ${t.name} ===`);
    const src = await fetchAll(source, t.name);
    if (src.error) { console.log(`  ⚠️ Origen: ${src.error}`); continue; }
    console.log(`  Origen: ${src.rows.length} filas`);

    // Backup del destino actual
    const dst = await fetchAll(target, t.name);
    if (dst.error) { console.log(`  ⚠️ Destino: ${dst.error}`); continue; }
    console.log(`  Destino actual: ${dst.rows.length} filas`);
    if (!APPLY) continue;

    const backupFile = path.join(backupDir, `backup_destino_${t.name}_${stamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(dst.rows, null, 0));
    console.log(`  💾 Backup destino -> ${backupFile}`);

    // Vaciar destino
    if (dst.rows.length > 0) {
      const clr = await clearTable(target, t.name, t.pk);
      if (clr.error) { console.log(`  ❌ No se pudo vaciar: ${clr.error}`); continue; }
      console.log(`  🗑️ Destino vaciado (${clr.deleted} filas)`);
    }

    // Copiar origen -> destino
    if (src.rows.length > 0) {
      const up = await upsertChunked(target, t.name, src.rows, t.pk);
      console.log(`  ✅ Copiadas ${up.ok}/${src.rows.length}${up.error ? " | ERR: " + up.error : ""}`);
    }
  }

  // Verificación final
  console.log("\n=== VERIFICACIÓN FINAL (destino) ===");
  for (const t of TABLES) {
    const r = await fetchAll(target, t.name);
    const s = await fetchAll(source, t.name);
    const match = !r.error && !s.error && r.rows.length === s.rows.length;
    console.log(`${t.name.padEnd(18)} origen=${String(s.rows.length).padStart(7)} destino=${String(r.rows.length).padStart(7)} ${match ? "✅" : "❌"}${r.error ? " | " + r.error : ""}`);
  }
}

run();
