// -----------------------------------------------------------------------------
// GASTOS DEL DÍA (Egresos de caja)
// Persistencia 100% en la nube vía site_content bajo la clave
// `daily_expenses_YYYY-MM-DD` (mismo patrón de snapshots que
// inv_payhistory_* / inv_breakdown_* / wo_mod_*).
// El monto se guarda SIEMPRE positivo; el reporte lo muestra como egreso (−).
// -----------------------------------------------------------------------------
import { supabase } from "./client";

export interface DailyExpense {
  id: string;
  date: string;          // YYYY-MM-DD del gasto
  description: string;   // Descripción del gasto
  amount: number;        // Monto positivo (egreso)
  destination: string;   // Destino: EMPRESA | CAJA | personal...
  delivered_to: string;  // Entregado a (personal del roster y permisos)
  created_at: string;    // ISO timestamp de registro
  wo_id?: string;        // Work Order "GASTO" creada en la Tabla Maestra (Registro del Taller)
}

export const expenseStorageKey = (date: string) =>
  `daily_expenses_${(date || "").slice(0, 10)}`;

export async function fetchDailyExpenses(date: string): Promise<DailyExpense[]> {
  if (!date) return [];
  const key = expenseStorageKey(date);
  const { data, error } = await supabase
    .from("site_content")
    .select("key, section_key, value, content")
    .eq("section_key", key);
  if (error) {
    console.warn("fetch expenses warning:", error.message);
    return [];
  }
  const row = data && data[0];
  if (!row) return [];
  let val: any = row.value ?? row.content;
  if (typeof val === "string") {
    try { val = JSON.parse(val); } catch { val = null; }
  }
  if (Array.isArray(val)) return val as DailyExpense[];
  if (val && typeof val === "object" && Array.isArray((val as any).data)) return (val as any).data as DailyExpense[];
  return [];
}

export async function saveDailyExpenses(date: string, expenses: DailyExpense[]): Promise<boolean> {
  try {
    const key = expenseStorageKey(date);
    const { error } = await supabase.from("site_content").upsert(
      {
        section_key: key,
        key,
        value: JSON.stringify(expenses),
        content: expenses,
        category: "expenses",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section_key" }
    );
    if (error) {
      console.warn("save expenses warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("save expenses failed:", msg);
    return false;
  }
}
