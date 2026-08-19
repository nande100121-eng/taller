// -----------------------------------------------------------------------------
// REPARTO MANUAL POR CONCEPTO — SOLO para comprobantes históricos ingresados
// desde la Tabla Maestra (registro taller CSV). Esos registros NO tienen
// item_type en la card (un solo ítem combinado, ej. "MANTENIMIENTO GENERAL+
// FILTRO DE GAS+4 BUJÍAS PKH16"), así que el reparto fue definido por el
// usuario por N° de boleta/ticket/factura: los montos por concepto suman
// EXACTAMENTE el total de cada comprobante.
//
// Los comprobantes creados DESDE la card del Taller NO van aquí: siguen la
// distribución por item_type (botón servicios -> Servicios, botón repuestos/
// Almacén -> Almacén, certificación -> Certificados) calculada en el reporte.
// -----------------------------------------------------------------------------
export const MANUAL_CONCEPT_SPLIT_BY_RECEIPT: Record<
  string,
  { serv: number; rep: number; cert: number }
> = {
  // Servicios (820)
  "4579": { serv: 10, rep: 0, cert: 0 },
  "4580": { serv: 15, rep: 0, cert: 0 },
  "4582": { serv: 20, rep: 80, cert: 0 },
  "4584": { serv: 50, rep: 117.5, cert: 0 },
  "4586": { serv: 110, rep: 250, cert: 0 },
  "4587": { serv: 110, rep: 170, cert: 0 },
  "4588": { serv: 200, rep: 0, cert: 0 },
  "4590": { serv: 110, rep: 370, cert: 0 },
  "287": { serv: 30, rep: 40, cert: 0 },
  "4592": { serv: 10, rep: 0, cert: 0 },
  "4594": { serv: 10, rep: 0, cert: 0 },
  "289": { serv: 110, rep: 255, cert: 0 },
  "4595": { serv: 5, rep: 10, cert: 0 },
  "4596": { serv: 30, rep: 0, cert: 0 },
  // Certificados (570)
  "4578": { serv: 0, rep: 0, cert: 80 },
  "4581": { serv: 0, rep: 0, cert: 80 },
  "285": { serv: 0, rep: 0, cert: 120 },
  "273": { serv: 0, rep: 0, cert: 80 },
  "4585": { serv: 0, rep: 0, cert: 50 },
  "274": { serv: 0, rep: 0, cert: 80 },
  "288": { serv: 0, rep: 0, cert: 80 },
  // Almacén (2007.5)
  "272": { serv: 0, rep: 25, cert: 0 },
  "4583": { serv: 0, rep: 450, cert: 0 },
  "286": { serv: 0, rep: 40, cert: 0 },
  "4589": { serv: 0, rep: 110, cert: 0 },
  "4593": { serv: 0, rep: 90, cert: 0 },
};

// "TK01-00004586" -> "4586", "B001-00000272" -> "272", "289" -> "289", "272" -> "272"
export function normalizeReceiptKey(receipt: string): string {
  const m = String(receipt || "").match(/(\d+)\s*$/);
  return m ? m[1].replace(/^0+/, "") : "";
}
