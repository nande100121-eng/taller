// Diagnóstico de Realtime y tabla appointments (ReyGas)
// Uso: node scripts/diagnose-realtime.mjs
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

// --- 1. HEAD / GET de cada tabla relevante para detectar 404 (tabla inexistente) ---
console.log("=== Comprobación de tablas (select limit=1) ===");
const tables = [
    "appointments",
    "site_content",
    "technicians",
    "vehicles",
    "work_orders",
    "invoices",
    "inventory_items",
    "certifications",
    "schedule_records",
    "work_order_items",
];
for (const t of tables) {
    const r = await req(`${t}?select=id&limit=1`);
    const label = r.status === 200 ? "OK" : r.status === 404 ? "404 (NO EXISTE)" : `status=${r.status}`;
    console.log(`  ${t.padEnd(20)} ${label}`);
}

// --- 2. Probar el endpoint de Realtime WebSocket ---
console.log("\n=== Endpoint Realtime WebSocket ===");
const wsUrl = `${SUPABASE_URL.replace("https", "wss")}/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=1.0.0`;
console.log("URL:", wsUrl);
try {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
        console.log("  TIMEOUT: no se recibió respuesta de apertura en 8s");
        try { ws.close(); } catch { }
        process.exit(1);
    }, 8000);
    ws.onopen = () => {
        console.log("  WebSocket OPEN: conexión establecida correctamente");
        clearTimeout(timeout);
        // Enviar heartbeat del protocolo Phoenix
        ws.send(JSON.stringify({
            topic: "phoenix",
            event: "heartbeat",
            payload: {},
            ref: "1",
        }));
        setTimeout(() => {
            console.log("  Heartbeat enviado; cerrando para completar diagnóstico.");
            try { ws.close(); } catch { }
            process.exit(0);
        }, 1500);
    };
    ws.onmessage = (ev) => {
        console.log("  WebSocket MSG:", String(ev.data).slice(0, 200));
    };
    ws.onerror = (ev) => {
        console.log("  WebSocket ERROR:", ev.message || "desconocido");
        clearTimeout(timeout);
        process.exit(1);
    };
    ws.onclose = (ev) => {
        console.log(`  WebSocket CLOSE code=${ev.code} reason=${ev.reason || ""}`);
    };
} catch (err) {
    console.log("  WebSocket THROW:", err.message);
    process.exit(1);
}
