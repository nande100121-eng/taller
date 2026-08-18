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

// Normaliza una placa para comparar: "abc-123" -> "ABC-123"
export function cleanPlateKey(plate: string): string {
  return (plate || "").toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");
}

// Indica si la placa está completa (formato peruano: ABC-123 o ABC-1234).
export function isCompletePlate(plate: string): boolean {
  const clean = cleanPlateKey(plate);
  return clean.length >= 6 && /^[A-Z]{2,4}[-]?[0-9]{3,4}$/.test(clean);
}

// Busca los datos del cliente por placa: 1) vehículos del ERP (registro taller),
// 2) histórico CSV de la Tabla Registro del Taller (cargado de forma diferida para
// no inflar los bundles de páginas que no lo usan).
export async function lookupPlateClientData(
  plate: string,
  vehicles: PlateVehicleLike[]
): Promise<PlateClientData> {
  const clean = cleanPlateKey(plate);
  if (!clean || clean.length < 3) {
    return { client_name: "", client_phone: "", found: false };
  }

  // 1) Vehículos del ERP (sincrónico y liviano)
  const veh = (vehicles || []).find(
    (v) => v.plate && cleanPlateKey(v.plate) === clean
  );
  if (veh && (veh.owner_name || veh.owner_phone)) {
    return {
      client_name: veh.owner_name || "",
      client_phone: veh.owner_phone || "",
      found: true,
    };
  }

  // 2) Histórico CSV de la Tabla Registro del Taller (carga diferida)
  try {
    const { getWorkshopCSVRecord } = await import("@/lib/workshop-csv-lookup");
    const rec = getWorkshopCSVRecord(clean);
    if (rec && (rec.clientName || rec.clientPhone)) {
      return {
        client_name: rec.clientName || "",
        client_phone: rec.clientPhone || "",
        found: true,
      };
    }
  } catch {
    // El chunk CSV no pudo cargarse: seguir sin autocompletar histórico.
  }

  return { client_name: "", client_phone: "", found: false };
}