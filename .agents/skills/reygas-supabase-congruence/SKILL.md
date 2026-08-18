---
name: reygas-supabase-congruence
description: >
  Guía estándar para garantizar que la conexión entre el usuario y la nube Supabase sea congruente
  (100% persistencia, tiempo real y confirmación visual) SIN cambiar el flujo de la web ReyGas.
  Debe usarse siempre que se cree o modifique una acción que guarde, actualice o sincronice datos,
  para asegurar que ningún registro local desaparezca ni quede sin confirmación de guardado.
---

# ReyGas Supabase Congruence (Usuario ↔ Nube)

Esta skill define el patrón obligatorio para que **toda acción web quede persistida en Supabase, se propague en tiempo real a las demás tablets/dispositivos y confirme al usuario con un toast**, sin alterar el flujo de la interfaz (así como se hizo con las tablas).

---

## 1. Principios de Congruencia

1. **La Nube es la Fuente Única de la Verdad:** todo registro del Taller, Portería, Caja, Almacén, Recepción y Configuración se persiste en Supabase. `localStorage`/Zustand solo actúa como caché de hidratación.
2. **El flujo web NO cambia:** las páginas llaman a las mismas acciones del store. La persistencia, el realtime y el toast de confirmación viven en las capas de servicio (`src/lib/supabase/services.ts`) y en el store (`src/lib/store/app-store.ts`), no en cada botón.
3. **Nada creado localmente puede desaparecer:** el sync en segundo plano debe **fusionar por id (merge)**, nunca sobrescribir ciegamente el estado local con la nube cuando el upsert aún no confirmó (consistencia eventual).
4. **Toda escritura confirma visualmente:** cada `saveSupabase*` emite el evento de toast "Guardado en la nube ✓".

---

## 2. Patrón Obligatorio de una Acción de Escritura

Toda acción que modifique datos debe seguir estos 3 pasos:

### 2.1 Actualización optimista local (0 ms de latencia)
En el store, aplicar el cambio al estado de inmediato:

```ts
// app-store.ts
createWorkOrder: (order) => {
  const newOrder: WorkOrder = { ...order, id: order.id || generateUUID(), entry_time: order.entry_time || new Date().toISOString(), items: order.items || [] };
  saveSupabaseWorkOrder(newOrder);          // 2. Persistir en segundo plano
  set((state) => ({ workOrders: [...state.workOrders, newOrder] })); // 1. Optimista
},
```

### 2.2 Persistencia + realtime + toast en la capa de servicio
Toda función `saveSupabase*` DEBE incluir, en este orden:

```ts
export async function saveSupabaseWorkOrder(order: WorkOrder) {
  try {
    markLocalMutation("workOrders");                 // 1. Protege contra sobrescritura de sync en curso
    await supabase.from("work_orders").upsert(payload); // 2. Tabla principal
    await saveSupabaseSiteContent(`wo_mod_${order.id}`, order, "work_orders", false); // 3. Backup en site_content
    broadcastRealtimeChange("work_order_updated");   // 4. Realtime instantáneo a otros dispositivos
    emitCloudSavedToast("Orden de trabajo guardada en la nube ✓"); // 5. Confirmación visual
  } catch (err) {
    console.warn("Supabase work order deferred:", err); // nunca romper el flujo web
  }
}
```

### 2.3 El toast central (event bus) — no tocar las páginas
`emitCloudSavedToast()` (definido en `src/lib/supabase/services.ts`) lanza un `CustomEvent` `reygas:cloud-saved`. El componente `Toast` (`src/components/ui/toast.tsx`) lo escucha y lo muestra automáticamente:

```ts
window.dispatchEvent(new CustomEvent("reygas:cloud-saved", { detail: { message } }));
```

Las páginas NO necesitan importar nada nuevo para confirmar el guardado: basta con que la acción del store llame al `saveSupabase*` correspondiente.

---

## 3. Regla de Oro: MERGE por id en el Sync (nunca sobrescribir)

En `syncFromSupabase` (app-store.ts), los datos operativos (`workOrders`, `invoices`, `appointments`, `vehicles`) se fusionan por id/clave natural. El dato remoto confirmado en la nube gana sobre el local, pero **el dato local recién creado nunca se pierde** si todavía no llegó a la nube:

```ts
// MERGE: el local es el punto de partida; el remoto lo enriquece/confirma.
const merged = new Map<string, any>();
local.forEach((x) => merged.set(x.id, x));
remote.forEach((x) => { if (x?.id) { const l = merged.get(x.id); merged.set(x.id, l ? { ...l, ...x } : x); } });
updates.workOrders = Array.from(merged.values());
```

**Claves de merge:**
- `workOrders` / `appointments` / `invoices` → por `id` (las invoices también se indexan por `work_order_id`).
- `vehicles` → por `plate.toUpperCase()`.

Los catálogos ligeros (`technicians`, `inventoryItems`, `certifications`, `scheduleRecords`, CMS) se protegen además con `!hasRecentLocalMutation("clave")` para no pisar una edición activa del usuario.

---

## 4. Checklist para cualquier nueva acción

Al agregar o modificar una acción que escriba datos:

- [ ] El store hace la **actualización optimista** local (`set`) ANTES de persistir.
- [ ] Se llama a la función `saveSupabase*` correspondiente (que ya incluye los pasos 2.2).
- [ ] La función `saveSupabase*` tiene `markLocalMutation("clave")`.
- [ ] Hace `upsert` en la tabla + backup en `site_content` (patrón roster).
- [ ] Emite `broadcastRealtimeChange("evento")` para tiempo real.
- [ ] Emite `emitCloudSavedToast("...")` para la confirmación visual.
- [ ] `syncFromSupabase` fusiona por id esa entidad (o ya existe el merge).
- [ ] `npx tsc --noEmit` pasa sin errores.

---

## 5. Dónde vive cada pieza

| Pieza | Ubicación |
|---|---|
| Event bus de toast de nube | `emitCloudSavedToast()` en `src/lib/supabase/services.ts` |
| Escucha del toast | `useEffect` en `src/components/ui/toast.tsx` (evento `reygas:cloud-saved`) |
| Persistencia + realtime | funciones `saveSupabase*` en `src/lib/supabase/services.ts` |
| Actualización optimista | acciones del store en `src/lib/store/app-store.ts` |
| Merge por id | `syncFromSupabase` en `src/lib/store/app-store.ts` |
| Suscripciones realtime | `src/components/providers/supabase-sync-provider.tsx` |

Cumplir esta guía garantiza que **todo lo que hace el usuario se guarda en la nube, se mantiene en tiempo real entre tablets y confirma con un toast, sin cambiar el flujo web.**
