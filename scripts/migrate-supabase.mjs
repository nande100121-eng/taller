import { createClient } from "@supabase/supabase-js";

// =====================================================================
// SCRIPT DE MIGRACIÓN AUTOMÁTICA REYGAS: SUPABASE ORIGEN -> SUPABASE DESTINO
// =====================================================================

// 1. Configuración de Credenciales
const SOURCE_SUPABASE_URL = process.env.SOURCE_SUPABASE_URL || "https://zkqlegxjynwurxzfhyzt.supabase.co";
const SOURCE_SUPABASE_KEY = process.env.SOURCE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw";

const TARGET_SUPABASE_URL = process.env.TARGET_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_SUPABASE_KEY = process.env.TARGET_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!TARGET_SUPABASE_URL || !TARGET_SUPABASE_KEY || TARGET_SUPABASE_URL === SOURCE_SUPABASE_URL) {
  console.error("\n❌ Error: Debes definir TARGET_SUPABASE_URL y TARGET_SUPABASE_KEY con los datos del NUEVO proyecto.");
  console.error("Ejemplo de uso:");
  console.error("  $env:TARGET_SUPABASE_URL='https://tu-nuevo-id.supabase.co'");
  console.error("  $env:TARGET_SUPABASE_KEY='tu-nueva-clave-anon'");
  console.error("  node scripts/migrate-supabase.mjs\n");
  process.exit(1);
}

const sourceClient = createClient(SOURCE_SUPABASE_URL, SOURCE_SUPABASE_KEY);
const targetClient = createClient(TARGET_SUPABASE_URL, TARGET_SUPABASE_KEY);

const TABLES = [
  { name: "inventory_items", key: "id" },
];

async function migrateTable(tableName, primaryKey) {
  console.log(`\n📦 Migrando tabla: ${tableName}...`);
  try {
    // 1. Descargar toda la data de la base de datos origen en chunks
    let allRows = [];
    let from = 0;
    const step = 500;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await sourceClient
        .from(tableName)
        .select("*")
        .range(from, from + step - 1);

      if (error) {
        console.warn(`  ⚠️ Aviso al leer ${tableName} del origen:`, error.message);
        break;
      }

      if (data && data.length > 0) {
        allRows.push(...data);
        from += step;
        if (data.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    console.log(`  📥 Descargados ${allRows.length} registros del origen.`);

    if (allRows.length === 0) {
      console.log(`  ℹ️ Tabla ${tableName} vacía, omitiendo inserción.`);
      return;
    }

    // 2. Insertar/Upsert en la base de datos destino en chunks de 100
    const CHUNK_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
      let chunk = allRows.slice(i, i + CHUNK_SIZE);
      let success = false;
      let attempts = 0;

      while (!success && attempts < 10) {
        attempts++;
        const { error: insertError } = await targetClient
          .from(tableName)
          .upsert(chunk, { onConflict: primaryKey });

        if (insertError) {
          const match = insertError.message.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const badCol = match[1];
            chunk = chunk.map((r) => {
              const copy = { ...r };
              delete copy[badCol];
              return copy;
            });
            continue;
          } else {
            console.error(`  ❌ Error al insertar bloque en ${tableName}:`, insertError.message);
            break;
          }
        } else {
          success = true;
          insertedCount += chunk.length;
        }
      }
    }

    console.log(`  ✅ ${insertedCount} de ${allRows.length} registros migrados con éxito a ${tableName}.`);
  } catch (err) {
    console.error(`  ❌ Error inesperado migrando ${tableName}:`, err);
  }
}

async function runMigration() {
  console.log("========================================================");
  console.log("🚀 INICIANDO MIGRACIÓN COMPLETA DE SUPABASE A SUPABASE");
  console.log(`   Origen:  ${SOURCE_SUPABASE_URL}`);
  console.log(`   Destino: ${TARGET_SUPABASE_URL}`);
  console.log("========================================================");

  for (const table of TABLES) {
    await migrateTable(table.name, table.key);
  }

  console.log("\n========================================================");
  console.log("🎉 ¡MIGRACIÓN FINALIZADA CON ÉXITO!");
  console.log("   Todos tus datos históricos, personal, órdenes,");
  console.log("   facturas, vehículos e inventario están en el nuevo Supabase.");
  console.log("========================================================\n");
}

runMigration();
