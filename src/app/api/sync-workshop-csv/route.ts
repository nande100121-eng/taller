import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ";" && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseISODate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "registro taller.csv");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Archivo registro taller.csv no encontrado" }, { status: 404 });
    }

    const rawContent = fs.readFileSync(filePath, "latin1"); // Handles Windows-1252 / ANSI cleanly
    const lines = rawContent.split(/\r?\n/);

    const vehicles: any[] = [];
    const workOrders: any[] = [];
    const invoices: any[] = [];

    const seenPlates = new Set<string>();

    let pendingCount = 0;
    let paidCount = 0;

    for (let idx = 1; idx < lines.length; idx++) {
      const line = lines[idx];
      if (!line || !line.trim()) continue;

      const cols = parseCSVLine(line);
      if (cols.length < 7) continue;

      const dateRaw = cols[0] || "";
      const dateISO = parseISODate(dateRaw);
      const quinquennial_date = cols[1] || "";
      const chip_expiry_date = cols[2] || "";
      const fuel_type = (cols[3] || "GNV").trim().toUpperCase();
      const brand = cols[4] || "Automóvil";
      const mileage = Math.min(999999, Math.max(0, parseInt((cols[5] || "").replace(/[^0-9]/g, "")) || 0));

      const plateRaw = cols[6] || "";
      const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
      if (!plate || plate.length < 3) continue;

      const receipt_number = cols[7] || "";
      const client_name = cols[8] || "Cliente Taller";
      const client_phone = cols[9] || "+51 900000000";
      const tech_name = cols[10] || "Mecánico Asignado";
      const maintenance_service = cols[11] || "Mantenimiento General";
      const spare_parts_services = cols[12] || "";

      const price = Math.min(99999, Math.max(0, parseFloat((cols[13] || "").replace(/[^0-9.]/g, "")) || 0));
      const raw_discounts = (cols[14] || "").trim();
      const discounts = Math.min(99999, Math.max(0, parseFloat(raw_discounts.replace(/[^0-9.]/g, "")) || 0));
      const credit_amount = Math.min(99999, Math.max(0, parseFloat((cols[15] || "").replace(/[^0-9.]/g, "")) || 0));
      const raw_payment_condition = (cols[16] || "").trim().toUpperCase();
      const payment_method = cols[17] || (price > 0 ? "Efectivo" : "");
      const payment_destination = cols[18] || "EMPRESA";
      const receipt_type = cols[19] || (receipt_number ? "Boleta" : "Ticket");

      // Core Pending vs Paid Logic
      const is_credit_or_pending =
        credit_amount > 0 ||
        raw_payment_condition === "PENDIENTE" ||
        raw_payment_condition.includes("CREDIT") ||
        spare_parts_services.toLowerCase().includes("pendiente") ||
        maintenance_service.toLowerCase().includes("pendiente");

      const base_amount = price > 0 ? price : credit_amount;
      const parts_total = base_amount + discounts;
      const grand_total = base_amount;

      const payment_status = is_credit_or_pending ? "pendiente" : "pagado";
      const order_status = is_credit_or_pending ? "por_cobrar" : "pagado_autorizado";

      if (is_credit_or_pending) pendingCount++;
      else paidCount++;

      const orderId = `csv-wo-${idx}`;
      const invoiceId = `csv-inv-${idx}`;

      if (!seenPlates.has(plate)) {
        seenPlates.add(plate);
        vehicles.push({
          plate,
          brand,
          model: "Importado",
          year: 2024,
          color: "Plata",
          fuel_type: fuel_type.includes("GLP") ? "GLP" : "GNV",
          owner_name: client_name,
          owner_phone: client_phone,
          current_mileage: mileage,
          last_visit_date: dateISO,
        });
      }

      workOrders.push({
        id: orderId,
        vehicle_plate: plate,
        status: order_status,
        problem_description: maintenance_service || spare_parts_services || "Servicio General",
        diagnostic_notes: `Registro Histórico Taller. Quinquenal: ${quinquennial_date || "N/A"} • Chip Anual: ${chip_expiry_date || "N/A"} • Técnico: ${tech_name}${raw_discounts ? ` • [DESCUENTO]: ${raw_discounts}` : ""}${credit_amount > 0 ? ` • [CREDITO]: ${credit_amount}` : ""}${is_credit_or_pending ? " • [CONDICION]: PENDIENTE DE PAGO" : ""}`,
        entry_time: dateISO,
        items: spare_parts_services
          ? [
              {
                id: `item-${idx}`,
                description: spare_parts_services,
                quantity: 1,
                unit_price: parts_total,
                subtotal: parts_total,
              },
            ]
          : [],
        quinquennial_date,
        chip_expiry_date,
        general_maintenance_service: maintenance_service,
        spare_parts_services,
      });

      invoices.push({
        id: invoiceId,
        work_order_id: orderId,
        vehicle_plate: plate,
        client_name,
        labor_fee: 0,
        parts_total,
        certification_fee: 0,
        grand_total,
        payment_status,
        payment_method: payment_method || "Efectivo",
        payment_destination: payment_destination || "EMPRESA",
        payment_condition: is_credit_or_pending ? "PENDIENTE" : "PAGADO",
        credit_amount,
        discounts: raw_discounts ? raw_discounts : discounts,
        receipt_number,
        receipt_type,
        issued_at: dateISO,
        paid_at: is_credit_or_pending ? undefined : dateISO,
      });
    }

    return NextResponse.json({
      success: true,
      totalRecords: lines.length - 1,
      pendingCount,
      paidCount,
      vehicles,
      workOrders,
      invoices,
    });
  } catch (err: any) {
    console.error("Error in sync-workshop-csv API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
