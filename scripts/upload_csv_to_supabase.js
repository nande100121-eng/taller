const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = 'zkqlegxjynwurxzfhyzt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw';

function parseISODate(dateStr) {
  if (!dateStr || !dateStr.trim() || dateStr.trim() === '-') {
    return new Date().toISOString();
  }
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    let part1 = parseInt(parts[0], 10);
    let part2 = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    let day = part1;
    let month = part2;
    if (part1 > 12 && part2 <= 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1;
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      const d = new Date(`${year}-${pad(month)}-${pad(day)}T12:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return new Date().toISOString();
}

function sendSupabaseRequest(table, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error(`Error on ${table} batch: Status ${res.statusCode} - ${body}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Network error on ${table}:`, err.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function runUpload() {
  const filePath = path.join(__dirname, '..', 'registro taller.csv');
  console.log('Reading CSV file:', filePath);

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const lines = rawContent.split(/\r\n|\n/);

  console.log(`Total CSV lines to process: ${lines.length}`);

  const workOrders = [];
  const invoices = [];

  for (let idx = 1; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line || !line.trim()) continue;

    const cols = line.split(/,|\t|;/).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));

    const plateRaw = cols[6] || cols[0];
    if (!plateRaw) continue;

    const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!plate || plate.length < 3) continue;

    const dateISO = parseISODate(cols[0]);
    const quinquennial_date = cols[1] || '';
    const chip_expiry_date = cols[2] || '';
    const brand = cols[4] || 'Automóvil';
    const client_name = cols[8] || 'Cliente Taller';
    const tech_name = cols[10] || 'Mecánico Asignado';
    const maintenance_service = cols[11] || 'Mantenimiento General';
    const spare_parts_services = cols[12] || '';

    const price = Math.min(99999, Math.max(0, parseFloat((cols[13] || '').replace(/[^0-9.]/g, '')) || 0));
    const discounts = Math.min(99999, Math.max(0, parseFloat((cols[14] || '').replace(/[^0-9.]/g, '')) || 0));
    const payment_method = cols[17] || 'Efectivo';

    const orderId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();

    const labor_fee = Math.min(99999, Math.max(0, price > 150 ? 150 : price));
    const parts_total = Math.min(99999, Math.max(0, price - labor_fee));
    const grand_total = Math.min(99999, Math.max(0, price - discounts));

    workOrders.push({
      id: orderId,
      vehicle_plate: plate,
      status: 'pagado_autorizado',
      assigned_technician_id: null,
      problem_description: maintenance_service,
      diagnostic_notes: `Registro Histórico Taller. Quinquenal: ${quinquennial_date || 'N/A'} • Chip Anual: ${chip_expiry_date || 'N/A'} • Técnico: ${tech_name} • Insumos: ${spare_parts_services}`,
      entry_time: dateISO,
      items: spare_parts_services ? JSON.stringify([{ description: spare_parts_services, quantity: 1, unit_price: parts_total, subtotal: parts_total }]) : '[]'
    });

    invoices.push({
      id: invoiceId,
      work_order_id: orderId,
      vehicle_plate: plate,
      client_name: client_name,
      labor_fee: labor_fee,
      parts_total: parts_total,
      certification_fee: 0,
      grand_total: grand_total,
      payment_status: 'pagado',
      payment_method: payment_method,
      issued_at: dateISO
    });
  }

  console.log(`Parsed ${workOrders.length} valid work orders and ${invoices.length} invoices.`);

  const CHUNK_SIZE = 100;

  // 1. Upload work orders in batches
  console.log('--- Uploading Work Orders to Supabase ---');
  let successOrders = 0;
  for (let i = 0; i < workOrders.length; i += CHUNK_SIZE) {
    const chunk = workOrders.slice(i, i + CHUNK_SIZE);
    const ok = await sendSupabaseRequest('work_orders', chunk);
    if (ok) {
      successOrders += chunk.length;
      console.log(`[Work Orders] Uploaded ${successOrders} / ${workOrders.length}`);
    } else {
      console.warn(`[Work Orders] Chunk at index ${i} failed.`);
    }
  }

  // 2. Upload invoices in batches
  console.log('--- Uploading Invoices to Supabase ---');
  let successInvoices = 0;
  for (let i = 0; i < invoices.length; i += CHUNK_SIZE) {
    const chunk = invoices.slice(i, i + CHUNK_SIZE);
    const ok = await sendSupabaseRequest('invoices', chunk);
    if (ok) {
      successInvoices += chunk.length;
      console.log(`[Invoices] Uploaded ${successInvoices} / ${invoices.length}`);
    } else {
      console.warn(`[Invoices] Chunk at index ${i} failed.`);
    }
  }

  console.log('=== UPLOAD COMPLETE ===');
  console.log(`Successfully persisted ${successOrders} work orders and ${successInvoices} invoices in Supabase PostgreSQL!`);
}

runUpload().catch(console.error);
