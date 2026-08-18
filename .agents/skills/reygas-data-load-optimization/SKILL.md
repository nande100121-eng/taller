# ReyGas Optimización de Carga de Datos (Data-Load Optimization)

Guía estándar y obligatoria para optimizar la **carga de datos** en todas las páginas y módulos de la web ReyGas (Taller, Almacén, Caja, Certificaciones, Portería, Asistencia, Consultas, Reportes y CMS). Su objetivo es eliminar la lentitud de carga percibida y reducir el tiempo hasta el primer dato útil (TTFP - Time To First Pixel útil).

Debe usarse **siempre** que se cree, modifique o depure cualquier lectura de datos desde Supabase, sincronización del store, o renderizado de tablas con datos remotos.

---

## 1. Principio Central: "Mostrar Rápido, Sincronizar Después"

La regla de oro de ReyGas es:

> **El usuario ve datos al instante; la nube los confirma en segundo plano.**

- **Nunca** bloquear la interfaz esperando una respuesta de red completa antes de pintar algo.
- El estado inicial se hidrata desde **caché local (Zustand persist)** si existe (0ms), y en paralelo se sincroniza con Supabase en segundo plano.
- Si no hay caché, mostrar **esqueletos de carga (skeleton)** y poblar por **secciones** a medida que llegan, no todo de golpe.

---

## 2. La Caché Local como Hidratación Ultrarrápida (NO como persistencia)

`localStorage` NO es persistencia (la persistencia real es 100% Supabase), pero **sí es caché de hidratación**.

### 2.1 Regla: persistir solo datos "de catálogo" y de referencia
Se permite (y se fomenta) persistir en el store:
- `technicians`, `workshopServices`, `certifications`, `scheduleRecords` (catálogos de referencia pequeños y de consulta frecuente).
- `siteContent` completo (CMS público).
- `correlativeConfig`, `aiSettings` (configuraciones).

Se debe **evitar** persistir en localStorage:
- `workOrders`, `invoices`, `vehicles`, `inventoryItems` completos **si son grandes** — mejor un `updatedAt` + conteo para saber si el caché está fresco.

**Implementado (store `partialize` con `reygas-store-cache-v1`):** se persiste una **ventana reciente acotada** para hidratación instantánea:
- `workOrders`: últimas 600 por orden de aparición.
- `invoices`: **TODAS las pendientes/crédito** (la deuda nunca se pierde del caché) + las 400 pagadas más recientes.
- `vehicles`: últimos 300.
- Catálogos ligeros completos (`technicians`, `workshopServices`, `certifications`, `scheduleRecords`, `siteContent` slim, `correlativeConfig`, `aiSettings`).
- Escritura **diferida** (storage wrapper: máximo 1 write cada 3s) para no bloquear el hilo principal de la tablet.

### 2.2 Regla: `updatedAt` de caché para evitar descargas innecesarias
Guardar una marca de tiempo `lastSyncAt` y, si el caché tiene menos de **60 segundos**, mostrar los datos del caché sin refetch masivo (solo suscribirse a Realtime para cambios).

---

## 3. Carga Escalonada (Progressive Hydration)

Nunca cargar TODAS las tablas a la vez al montar. Dividir en **3 niveles**:

### Nivel 1 — Datos Ligeros / Críticos (prioridad máxima, <200ms)
- `technicians` (slim select: id, full_name, specialty, phone, is_active, allowed_tabs, can_receive_payment)
- `site_content` **solo secciones ligeras** (no el backup masivo)
- `workshopServices`, `correlativeConfig`, `aiSettings`
- `certifications` (slim)

### Nivel 2 — Datos de Operación (carga bajo demanda por página)
- `inventoryItems` (solo en página Almacén, paginado)
- `workOrders` (solo en Taller/Recepción, con rango de fechas/límite)
- `invoices` (solo en Caja)
- `vehicles` (solo en Recepción/Consultas)

### Nivel 3 — Datos Pesados / Históricos (bajo demanda explícita)
- `master_workshop_backup` (solo al abrir herramientas de migración/backup)
- Reportes A4 (solo al imprimir)
- Historiales completos (solo con filtros de fecha)

**Regla:** cada página del dashboard debe sincronizar SOLO los datos que necesita, usando los syncs `Only` ya existentes (`syncTechniciansOnly`, `syncInventoryOnly`, `syncServicesOnly`, `syncCertificationsOnly`, `syncScheduleOnly`) en lugar de disparar `syncFromSupabase()` (que descarga todo).

---

## 4. Consultas "Slim" a Supabase (nunca `select("*")` en tablas grandes)

Prohibido hacer `supabase.from("tabla").select("*")` en tablas de operación o históricas.

### 4.1 Select de columnas específicas
```ts
// MAL: descarga todas las columnas incluyendo JSONB pesados
supabase.from("work_orders").select("*");

// BIEN: solo las columnas que la UI realmente usa
supabase.from("work_orders").select("id, vehicle_plate, status, assigned_technician_id, problem_description, entry_time, completion_time, diagnostic_notes");
```

### 4.2 Rangos y límites (paginación en la fuente)
```ts
// MAL: descarga toda la tabla
supabase.from("invoices").select("*");

// BIEN: descarga solo lo necesario con límite
supabase.from("invoices").select("id, grand_total, payment_status, payment_method, issued_at")
  .order("issued_at", { ascending: false })
  .limit(500);
```

### 4.3 NUNCA arrastrar `master_workshop_backup` en cada carga
El `master_workshop_backup` (JSONB masivo con vehículos+OT+facturas) **solo** debe leerse en herramientas de migración/backup, jamás en el `syncFromSupabase()` inicial. Si está presente en `site_content`, filtrarlo antes de hidratar el store.

### 4.4 TOPE DE VOLUMEN en el sync inicial (`fetchCappedOperationalData`) — OBLIGATORIO
El ERP tiene **41k+ órdenes y 118k+ facturas**. Descargarlas TODAS al navegador hace que **cada pestaña demore**. La carga operativa debe ir **acotada por SQL** (nunca `fetchAllSupabaseTable` en operación):
- `work_orders`: las **3,000 más recientes** por `entry_time` (`.order("entry_time", { ascending: false }).limit(3000)`).
- `invoices`: **TODAS las pendientes / con crédito** (`.or("payment_status.neq.pagado,payment_status.is.null,credit_amount.gt.0")` — la deuda nunca se pierde) + las **3,000 pagadas recientes** por `issued_at`.
- `vehicles`: las 2,000 más recientes por `last_visit_date` (lookups por placa se resuelven igual).
- El histórico completo se consulta **bajo demanda** (por fecha/placa) con `fetchSupabaseConsultasRealtime` / `fetchSupabaseDayReport`.
- Si el tope falla → **fallback a carga completa** (nunca dejar la web sin datos).
- Además, `siteContent` del store **NO** debe acumular snapshots pesados (`inv_full_*`, `wo_mod_*`, `tech_perms_*`, `sched_*`, `cert_*`, `appt_*`): se filtran del merge (sus datos ya llegan reconstruidos en las listas) para no duplicar ~100MB en memoria.

### 4.5 Throttle global del sync completo (30s) — OBLIGATORIO
El store (`syncFromSupabase`) debe tener un throttle de **30 segundos** (`lastFullSyncAt`): cualquier llamada (foco de ventana, broadcast, postgres_changes, heartbeat, montaje de página) que ocurra dentro de los 30s posteriores al último sync completo se **omite**. Así las re-descargas masivas colapsan a máximo ~2 por minuto y no saturan la red/batería de la tablet Chainway P80.

---

## 5. Paralelización Inteligente y Procesamiento

### 5.1 Consultas paralelas con `Promise.all`
Las consultas independientes **siempre** en paralelo (nunca `await` secuencial):
```ts
const [techs, services, certs] = await Promise.all([
  supabase.from("technicians").select("id, full_name, ..."),
  supabase.from("site_content").select("*").eq("section_key", "workshopServices"),
  supabase.from("certifications").select("id, vehicle_plate, ..."),
]);
```

### 5.2 Carga bajo demanda de módulos (`React.lazy` + `dynamic`)
Los módulos pesados (Reportes, OCR, impresión) deben cargarse con `next/dynamic` / `React.lazy` para no inflar el bundle inicial.

### 5.3 Chunking del procesamiento
Al aplicar datos masivos al store, procesar en **bloques** (`for` en trozos de 200–500) o con `requestIdleCallback`/`setTimeout` diferido, para no congelar el hilo principal de la tablet.

---

## 6. Evitar Refetches Innecesarios (Realtime First)

1. **Realtime es la fuente de cambios**: al recibir `broadcastRealtimeChange` o `postgres_changes`, usar los handlers `Only` granulares — **no** `syncFromSupabase()` completo.
2. **Throttle de foco**: `window focus` no debe disparar sync masivo si el caché está fresco (<60s) o si hubo sync reciente (<15s).
3. **Prohibido `setInterval` de refresco**: nunca refrescar tablas completas con temporizadores; solo el heartbeat de seguridad **cada 5 minutos** (el ERP tiene 41k+ órdenes y 118k+ facturas: re-descargarlas cada 90s satura la red).
4. **Protección de edición**: si `hasRecentLocalMutation(key)` es verdadero, no sobreescribir esa sección.

---

## 7. Metadatos de Freshness (si el volumen crece)

Para tablas de operación que crecen sin límite, guardar en `site_content` una clave `meta_last_updated_<tabla>` con `{ count, updatedAt }`. El sync puede:
- Leer solo el metadata (ligero) para decidir si hace falta refetch completo.
- Evitar descargar miles de filas si nada cambió.

---

## 8. Indicadores de Carga Correctos

- **Caché existente**: pintar datos del caché de inmediato (sin skeleton) y actualizar silenciosamente cuando llegue la nube.
- **Sin caché**: usar skeletons (`animate-pulse`) por sección, no spinners bloqueantes de pantalla completa.
- **Sync en curso**: indicador discreto ("Sincronizando…") sin bloquear interacción.
- **Error de red**: conservar los datos visibles y mostrar aviso no intrusivo, nunca pantalla en blanco.

---

## 9. Checklist de Optimización de Carga (aplicar en cada página/módulo)

- [ ] ¿La página muestra datos del caché local al instante (0ms) si existen?
- [ ] ¿Se usa `select` de columnas específicas (slim) en lugar de `select("*")` en tablas grandes?
- [ ] ¿Se usa `.limit()` / `.range()` para tablas de operación e históricas?
- [ ] ¿El `syncFromSupabase()` general NO arrastra `master_workshop_backup` ni tablas pesadas?
- [ ] ¿Cada página usa sus syncs `Only` específicos en lugar del sync completo?
- [ ] ¿Las consultas independientes van en `Promise.all`?
- [ ] ¿Módulos pesados (reportes, OCR, impresión) usan carga diferida?
- [ ] ¿El procesamiento masivo va en chunks para no congelar la UI?
- [ ] ¿Realtime actualiza sin refetch completo?
- [ ] ¿Los indicadores de carga son skeletons por sección, no bloqueos de pantalla?
- [ ] ¿La tablet Chainway P80 no se congela ni agota batería por polling?
