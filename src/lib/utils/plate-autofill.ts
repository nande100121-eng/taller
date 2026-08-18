// Autocompletado por Placa: busca en la Tabla Registro del Taller (vehículos del ERP y
// el histórico CSV) y completa Nombre y Teléfono del cliente cuando se escribe una placa
// en cualquier formulario (reservas/citas, cobro manual, cartillas, portería...).

export interface PlateClientData {
  client_name: string;
  client_phone: string;
  found: boolean;
}

export interface PlateVehicleLike {
  plate?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
}

// Normaliza una placa para comparar: "abc-123" -> "ABC-123" (conserva el guion)
export function cleanPlateKey(plate: string): string {
  return (plate || "").toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");
}

// Normaliza SIN guion: "H2W-236" y "H2W236" se consideran iguales.
export function normPlate(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Indica si la placa parece completa. Acepta los formatos reales del taller:
// "ABC-123", "ABC-1234" y "H2W-236" (letra-número-letra, muy común en el registro).
export function isCompletePlate(plate: string): boolean {
  const clean = cleanPlateKey(plate);
  if (clean.length < 6 || clean.length > 10) return false;
  const letters = (clean.match(/[A-Z]/g) || []).length;
  const digits = (clean.match(/[0-9]/g) || []).length;
  return letters >= 2 && digits >= 3;
}

// Busca los datos del cliente por placa: 1) vehículos del ERP (registro taller),
// 2) histórico CSV de la Tabla Registro del Taller (cargado de forma diferida para
// no inflar los bundles de páginas que no lo usan).
export async function lookupPlateClientData(
  plate: string,
  vehicles: PlateVehicleLike[]
): Promise<PlateClientData> {
  const clean = cleanPlateKey(plate);
  const cleanNorm = normPlate(clean);
  if (!cleanNorm || cleanNorm.length < 3) {
    return { client_name: "", client_phone: "", found: false };
  }

  // 1) Vehículos del ERP (sincrónico y liviano). Comparación sin guion:
  //    "H2W-236" y "H2W236" se consideran la misma placa.
  const veh = (vehicles || []).find(
    (v) => v.plate && normPlate(v.plate) === cleanNorm
  );
  if (veh && (veh.owner_name || veh.owner_phone)) {
    return {
      client_name: veh.owner_name || "",
      client_phone: veh.owner_phone || "",
      found: true,
    };
  }

  // 2) Consulta EN VIVO a Supabase (Tabla Registro del Taller completa): cubre placas
  //    que existen en work_orders/invoices pero NO están en el caché de vehículos
  //    (p. ej. D1C-156, importada a la tabla maestra sin fila en vehicles).
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const plateVariants = Array.from(new Set([clean, cleanNorm]));
    const [vRes, iRes, wRes] = await Promise.all([
      supabase.from("vehicles").select("owner_name,owner_phone").in("plate", plateVariants).limit(1),
      supabase.from("invoices").select("client_name").in("vehicle_plate", plateVariants).order("issued_at", { ascending: false }).limit(1),
      supabase.from("work_orders").select("diagnostic_notes").in("vehicle_plate", plateVariants).order("entry_time", { ascending: false }).limit(3),
    ]);
    const vRow = vRes.data?.[0];
    const iRow = iRes.data?.[0];
    let woName = "";
    let woPhone = "";
    for (const w of (wRes.data || [])) {
      const meta = (w.diagnostic_notes || "").match(/\[ERP_META\]:(.*)/);
      if (!meta) continue;
      const nm = (meta[1].match(/"c_name":"([^"]*)"/) || [])[1] || "";
      const ph = (meta[1].match(/"c_phone":"([^"]*)"/) || [])[1] || "";
      if (nm || ph) { woName = nm; woPhone = ph; break; }
    }
    const name = vRow?.owner_name || iRow?.client_name || woName || "";
    const phone = vRow?.owner_phone || woPhone || "";
    if (name || phone) {
      return { client_name: name, client_phone: phone, found: true };
    }
  } catch {
    // Supabase no disponible: continuar con el histórico CSV.
  }

  // 3) Histórico CSV estático de la Tabla Registro del Taller (último recurso, carga diferida)
  try {
    const { WORKSHOP_CSV_LOOKUP } = await import("@/lib/workshop-csv-lookup");
    // Algunos registros históricos vienen sin cliente: buscar en TODOS los registros
    // de la placa el que sí tenga nombre/teléfono (comparación insensible a guiones).
    for (const k in WORKSHOP_CSV_LOOKUP) {
      if (normPlate(k.split("_")[0]) !== cleanNorm) continue;
      const r = WORKSHOP_CSV_LOOKUP[k];
      if (r && (r.clientName || r.clientPhone)) {
        return {
          client_name: r.clientName || "",
          client_phone: r.clientPhone || "",
          found: true,
        };
      }
    }
  } catch {
    // El chunk CSV no pudo cargarse: seguir sin autocompletar histórico.
  }

  return { client_name: "", client_phone: "", found: false };
}