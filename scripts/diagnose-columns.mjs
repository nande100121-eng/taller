// Muestra las columnas REALES de cada tabla Supabase haciendo SELECT * limit 1
const SUPABASE_URL = "https://zkqlegxjynwurxzfhyzt.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw";

async function req(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            Accept: "application/json",
            Prefer: "return=representation",
        },
    });
    let body = null;
    try {
        body = await res.json();
    } catch { }
    return { status: res.status, body };
}

const tables = [
    "technicians",
    "work_orders",
    "vehicles",
    "invoices",
    "inventory_items",
    "certifications",
    "schedule_records",
    "site_content",
];

for (const table of tables) {
    const { status, body } = await req(`${table}?select=*&limit=1`);
    console.log(`\n=== ${table} === (status ${status})`);
    if (status >= 400) {
        console.log(`  ERROR: ${JSON.stringify(body)}`);
    } else if (Array.isArray(body) && body.length > 0) {
        console.log(`  COLUMNAS (${Object.keys(body[0]).length}): ${Object.keys(body[0]).join(", ")}`);
    } else {
        console.log(`  (tabla vacía — ${status})`);
    }
}
console.log("\n=== FIN ===");
