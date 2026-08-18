---
name: reygas-supabase-congruence
description: >
  Guía estándar para garantizar que TODA la web ReyGas sea 100% funcional y en tiempo real:
  persistencia total en Supabase, propagación en tiempo real entre tablets y confirmación
  visual (toast) para cada acción de TODOS los flujos (Portería, Recepción, Taller, Caja,
  Almacén, Certificaciones, Asistencia, Consultas, Reportes y Configuración) SIN cambiar
  el flujo de la interfaz. Debe usarse SIEMPRE que se cree o modifique una acción que
  guarde, actualice, elimine o sincronice datos, para que ninguna funcionalidad futura
  quede fuera del tiempo real.
---

# ReyGas Supabase Congruence (Usuario ↔ Nube) — Toda la Web en Tiempo Real

Esta skill define el patrón **obligatorio** para que **toda acción de toda la web** quede
persistida en Supabase, se propague en tiempo real a las demás tablets/dispositivos y
confirme al usuario con un toast, **sin alterar el flujo de la interfaz** (así como se hizo
con las tablas). Es la garantía de que la web sea **100% funcional**: ningún registro se
pierde, todo se mantiene sincronizado y nada se guarda solo "en el navegador".

---

## 1. Principios de Congruencia (el estándar de TODO el flujo)

1. **La Nube es la Fuente Única de la Verdad:** todo registro de Portería, Recepción,
   Taller, Caja, Almacén, Certificaciones, Asistencia, Consultas, Reportes y Configuración
   se persiste en Supabase. `localStorage`/Zustand solo actúa como caché de hidratación.
2. **El flujo web NO cambia:** las páginas llaman a las mismas acciones del store. La
   persistencia, el realtime y el toast viven en las capas de servicio
   (`src/lib/supabase/services.ts`) y en el store (`src/lib/store/app-store.ts`), no en cada botón.
3. **Nada creado localmente puede desaparecer:** el sync en segundo plano debe **fusionar
   por id (merge)**, nunca sobrescribir ciegamente el estado local con la nube cuando el
   upsert aún no confirmó (consistencia eventual).
4. **Toda escritura confirma visualmente:** cada `saveSupabase*` emite el evento de toast
   "Guardado en la nube ✓" vía `emitCloudSavedToast`.
5. **Toda entidad operativa tiene 3 canales:** (a) tabla dedicada si existe, (b) backup
   en `site_content` (patrón roster, nunca se pierde), (c) `broadcastRealtimeChange` para
   tiempo real instantáneo.
6. **Regla de oro para lo futuro:** *si alguien agrega una pantalla o botón que escriba
   datos, DEBE seguir este patrón. No se entrega ninguna funcionalidad que no sea en
   tiempo real y persistida en la nube.*

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
`emitCloudSavedToast()` (definido en `src/lib/supabase/services.ts`) lanza un `CustomEvent`
`reygas:cloud-saved`. El componente `Toast` (`src/components/ui/toast.tsx`) lo escucha y lo
muestra automáticamente:

```ts
window.dispatchEvent(new CustomEvent("reygas:cloud-saved", { detail: { message } }));
```

Las páginas NO necesitan importar nada nuevo para confirmar el guardado: basta con que la
acción del store llame al `saveSupabase*` correspondiente.

---

## 3. Regla de Oro: MERGE por id en el Sync (nunca sobrescribir)

En `syncFromSupabase` (app-store.ts), los datos operativos se fusionan por id/clave natural.
El dato remoto confirmado en la nube gana sobre el local, pero **el dato local recién creado
nunca se pierde** si todavía no llegó a la nube:

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

Los catálogos ligeros (`technicians`, `inventoryItems`, `certifications`, `scheduleRecords`,
`toolLoans`, `attendanceLogs`, CMS) se protegen además con `!hasRecentLocalMutation("clave")`
para no pisar una edición activa del usuario.

---

## 4. Mapa del Flujo Completo: TODAS las acciones y su estado de congruencia

Esta tabla es la auditoría de **todo el flujo web**. Cualquier acción marcada con ✗ debe
corregirse ANTES de considerar la web "100% funcional". Al agregar acciones nuevas se agregan
a esta tabla.

| Área | Acciones del store | Persistencia | Realtime | Toast |
|---|---|---|---|---|
| Config / CMS | `updateSiteContent`, `updateTheme`, `updateCorrelativeConfig`, `getAndIncrementReceiptNumber`, `updateAISettings` | `saveSupabaseSiteContent` | ✓ broadcast | ✓ |
| Servicios | `addWorkshopService`, `updateWorkshopService`, `deleteWorkshopService` | `saveSupabaseSiteContent("workshopServices"/"services")` | ✓ | ✓ |
| Técnicos | `addTechnician`, `updateTechnician`, `toggleTechnicianActive`, `changeTechnicianPassword`, `deleteTechnician` | `saveSupabaseTechnician` / `deleteSupabaseTechnician` | ✓ | ✓ |
| Vehículos | `registerVehicle`, `updateVehicle` | `saveSupabaseVehicle` | ✓ | ✓ |
| OT (todas las internas) | `createWorkOrder`, `updateWorkOrder`, `updateWorkOrderStatus`, `assignTechnicianToOrder`, `addWorkOrderItem`, `addMultipleWorkOrderItems`, `updateWorkOrderItem`, `removeWorkOrderItem`, `markWorkOrderItemDispatched`, `toggleWorkOrderItemDispatched`, `markAllWorkOrderItemsDispatched`, `markAllMigratedWorkOrderItemsDispatched`, `updateDiagnosticNotes`, `updateDiagnosticAndObservations`, `toggleAllowModificationsInWorkshop`, `setWorkOrderDiscount`, `deleteWorkOrder`, `deleteMultipleWorkOrders`, `clearAllWorkOrders` | `saveSupabaseWorkOrder` | ✓ | ✓ |
| Certificación (Taller) | `requestCertificationForWorkOrder` | **DEBE** llamar `saveSupabaseCertification(newCert)` + broadcast | ✓ | ✓ |
| Certificación (retiro) | `removeCertificationFromWorkOrder` | **DEBE** llamar `deleteSupabaseCertification` + broadcast | ✓ | ✓ |
| Certificaciones | `addCertification`, `updateCertificationPrice`, `updateCertification` | `saveSupabaseCertification` (+ `saveSupabaseWorkOrder`/`saveSupabaseInvoice` si enlaza) | ✓ | ✓ |
| Inventario | `addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `deleteMultipleInventoryItems`, `clearAllInventory`, `importBulkInventoryItems`, `deductStock` | `saveSupabaseInventoryItem` / `deleteSupabase*` / `saveSupabaseBulkInventory` | ✓ | ✓ |
| Ingresos Almacén | `addRecentIngreso`, `removeRecentIngreso`, `clearRecentIngresos` | `saveSupabaseSiteContent("inventory_recent_ingresos")` | ✓ | ✓ |
| Préstamo Herramientas | `addToolLoan`, `returnTool` | `saveSupabaseToolLoans` (roster `tool_loans_all`) | ✓ | ✓ |
| Facturación | `createInvoice`, `createInvoiceForOrder`, `updateInvoice`, `payInvoice`, `togglePayInvoice`, `toggleOrderPayment`, `confirmInvoicePayment`, `registerDirectWorkshopPayment` | `saveSupabaseInvoice` + `saveSupabaseWorkOrder` (+ correlativos) | ✓ | ✓ |
| Citas | `addAppointment`, `updateAppointmentStatus`, `updateAppointment`, `deleteAppointment` | `saveSupabaseAppointment` / `deleteSupabaseAppointment` | ✓ | ✓ |
| Programación | `addScheduleRecord`, `updateScheduleRecord`, `deleteScheduleRecord`, `deleteMultipleScheduleRecords`, `clearAllScheduleRecords`, `importBulkScheduleRecords` | `saveSupabaseScheduleRecord` / `deleteSupabase*` / `saveSupabaseBulkScheduleRecords` | ✓ | ✓ |
| Asistencia | `addAttendanceLogs` | `saveSupabaseAttendanceLogs` (tabla `attendance_logs` + roster `attendance_logs_all`) | ✓ | ✓ |

> Todas las filas de esta tabla están verificadas como congruentes (persistencia + realtime + toast).
> Si una fila tiene ✗, NO está completa.

---

## 5. Checklist para CUALQUIER nueva acción o funcionalidad futura

**Obligatorio** al agregar o modificar una acción que escriba datos. Si falta un punto, la
funcionalidad NO se considera terminada:

- [ ] El store hace la **actualización optimista** local (`set`) ANTES de persistir.
- [ ] Se llama a la función `saveSupabase*` correspondiente (que ya incluye los pasos 2.2).
- [ ] La función `saveSupabase*` tiene `markLocalMutation("clave")`.
- [ ] Hace `upsert` en la tabla dedicada (si existe) + backup en `site_content` (patrón roster).
- [ ] Emite `broadcastRealtimeChange("evento")` para tiempo real.
- [ ] Emite `emitCloudSavedToast("...")` para la confirmación visual.
- [ ] Si es una eliminación, se llama a la función `deleteSupabase*` correspondiente (tabla + site_content).
- [ ] `syncFromSupabase` fusiona por id esa entidad (o ya existe el merge; si no, SE AGREGA).
- [ ] `supabase-sync-provider.tsx` tiene el listener `postgres_changes` / broadcast para la entidad.
- [ ] Se actualiza la **tabla del punto 4** con la nueva acción.
- [ ] `npx tsc --noEmit` pasa sin errores.

---

## 6. Dónde vive cada pieza

| Pieza | Ubicación |
|---|---|
| Event bus de toast de nube | `emitCloudSavedToast()` en `src/lib/supabase/services.ts` |
| Escucha del toast | `useEffect` en `src/components/ui/toast.tsx` (evento `reygas:cloud-saved`) |
| Persistencia + realtime | funciones `saveSupabase*` / `deleteSupabase*` en `src/lib/supabase/services.ts` |
| Actualización optimista | acciones del store en `src/lib/store/app-store.ts` |
| Merge por id | `syncFromSupabase` en `src/lib/store/app-store.ts` |
| Suscripciones realtime | `src/components/providers/supabase-sync-provider.tsx` |
| Auditoría del flujo completo | Tabla del punto 4 de esta skill |

---

## 7. Funciones de servicio de referencia

- `saveSupabaseWorkOrder` / `saveSupabaseVehicle` / `saveSupabaseTechnician` / `saveSupabaseInventoryItem`
- `saveSupabaseCertification` / `deleteSupabaseCertification` (certificación Taller)
- `saveSupabaseScheduleRecord` / `deleteSupabaseScheduleRecord` / `saveSupabaseBulkScheduleRecords`
- `saveSupabaseAppointment` / `deleteSupabaseAppointment`
- `saveSupabaseInvoice`
- `saveSupabaseToolLoans` / `deleteSupabaseToolLoan` (préstamo de herramientas)
- `saveSupabaseAttendanceLogs` (asistencia biométrica)
- `saveSupabaseSiteContent` (CMS, servicios, correlativos, tema, recientes)

Cumplir esta guía garantiza que **todo lo que hace el usuario en TODA la web se guarda en la
nube, se mantiene en tiempo real entre tablets y confirma con un toast, sin cambiar el flujo web**.
