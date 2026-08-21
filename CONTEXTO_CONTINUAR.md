# REYGAS — CONTEXTO PARA CONTINUAR (ACTUALIZADO)

> Exportado: 20/08/2026 (sesión larga con ~40+ cambios desplegados).
> Último commit en `main`: `6db0905` — producción: https://taller-two-gamma.vercel.app
> **MODO AHORRO ACTIVADO**: respuestas compactas, tsc 1x por lote, 1 commit+push+deploy por lote, lecturas quirúrgicas (grep + solo zona a editar), sin verificación redundante del usuario.

---

## 0. MODO AHORRO (IMPORTANTE — activar en el nuevo chat)

El usuario pidió optimizar consumo de crédito de la API. Reglas para TODA la sesión:

1. **Agrupar cambios**: cuando el usuario manda varios pedidos, procesarlos en UN solo lote → 1 tsc → 1 commit → 1 push → 1 verificación de deploy.
2. **Respuestas compactas**: confirmar cada cambio en 2-4 líneas (qué se hizo → tsc ✓ → commit → deploy). Nada de explicaciones largas salvo que el usuario lo pida.
3. **Lecturas mínimas**: usar grep para localizar, leer SOLO la zona a editar (nunca archivos completos de 5000+ líneas).
4. **No verificar redundante**: si el usuario dice que algo se ve bien, seguir al siguiente punto sin re-verificar.
5. **Checkpoint temprano**: si la sesión crece mucho, sugerir actualizar CONTEXTO_CONTINUAR.md y abrir chat nuevo (el usuario ya lo sabe y lo aprueba).

---

## 1. QUÉ ES EL PROYECTO

**ReyGas (repo GitHub `nande100121-eng/taller`)** — Sistema web de gestión integral de un taller de gas vehicular (GNV/GLP) en Perú.

- **Stack**: Next.js 14.2.4 (App Router), React 18, TypeScript 5.5, TailwindCSS 3.4, Zustand 4.5, Supabase (cloud-first + realtime), date-fns, lucide-react
- **Hardware**: Tablet industrial Chainway P80 + lector SEISA
- **Despliegue**: Vercel (git push auto-deploy), producción: https://taller-two-gamma.vercel.app

### REGLAS OBLIGATORIAS DEL USUARIO (nunca violar)
- **Publicar cada cambio**: `npx tsc --noEmit` → commit en `main` → `git push origin main` (Vercel auto-deploy por git).
- **NO usar `npx vercel --prod`** (doble deploy gasta el límite diario). Solo git push.
- **NUNCA modificar los CSV del usuario** (`registro taller *.csv`, `DEUDA 17.08.26.csv`): stagear SOLO archivos fuente, nunca CSV ni scripts de trabajo.
- Responder en español.

### Skills estándar (OBLIGATORIO consultarlos según la tarea)
- **`reygas-supabase-congruence`**: SIEMPRE que se cree/modifique una acción que guarde, actualice, borre o sincronice datos en Supabase (toast de confirmación, realtime, persistencia 100% cloud).
- **`reygas-ui-design-system`**: SIEMPRE que se agregue/modifique cualquier UI (modales glassmórficos, botones, formularios, calendarios, tablas).
- **`reygas-reports-system`**: SIEMPRE que se cree/modifique cualquier reporte (Reporte Diario, VENTAS POR CONCEPTO, liquidaciones).
- **`reygas-printing`**: SIEMPRE que se agregue/modifique impresión (recibos térmicos, reportes A4, códigos de barras).
- **`reygas-performance-cloud-hardware`**: optimización de rendimiento, sync Cloud-First, tablets Chainway P80.

---

## 2. ARQUITECTURA Y ARCHIVOS CLAVE

### Módulos (`src/app/dashboard/`)
`admin` (CMS + Tabla Maestra Registros/Personal), `almacen`, `asistencia`, `caja`, `certificaciones`, `configuracion`, `consultas`, `porteria`, `recepcion`, `reportes`, `taller`.

### Archivos núcleo
| Archivo | Rol |
|---|---|
| `src/lib/store/app-store.ts` | Store Zustand persist (`reygas-store-cache-v2`): workOrders, invoices, payment_history, sync, acciones de pago, applyRemoteWorkOrderLocal/Invoice/Vehicle (realtime fila directa) |
| `src/lib/supabase/services.ts` | Persistencia: saveSupabaseWorkOrder (MERGE defensivo de items), saveSupabaseInvoice (filtro anti-duplicado de correlativo), deleteSupabaseWorkOrder (CASCADA), deleteSupabaseInvoice (CASCADA), fetchCappedOperationalData (ventana PAGE=400 + reconstrucción descuento/historial), fetchSupabaseDayReport |
| `src/lib/system-log.ts` | **LOG LOCAL en localStorage** (`reygas-syslog-local`, buffer FIFO 3000, flush 2s): logSystemEvent, logTiming, logTimingThreshold, getLocalLogs, exportLocalLogs. NO usa Supabase (evita saturación) |
| `src/lib/utils/date-utils.ts` | Hora PERÚ: getPeruDateString, buildPeruISOString ("YYYY-MM-DDTHH:mm:00-05:00"), toPeruDateKey, toPeruAnchoredISO |
| `src/lib/deuda-csv.ts` | Deuda oficial (DEUDA 17.08.26.csv): DEBT_CSV_BY_RECEIPT, matchDebtCsvByInvoice |
| `src/lib/workshop-csv-lookup.ts` | Registro taller CSV (WORKSHOP_CSV_LOOKUP, WORKSHOP_DAY_RECORDS) |
| `src/lib/report-concept-split.ts` | Reparto manual por boleta (MANUAL_CONCEPT_SPLIT_BY_RECEIPT) — SOLO comprobantes históricos |
| `src/components/DailyWorkshopReportModal.tsx` | Reporte diario (REPORTE DEL DÍA, VENTAS POR CONCEPTO, YAPES & TRANSFERENCIAS, TOTAL GENERAL) + realtime report-day-realtime |
| `src/components/ui/mini-date-picker.tsx` | Calendario unificado: popup con **createPortal al body** (escapa overflow-hidden y backdrop-blur), stopPropagation, popupRef (click dentro no cierra), log calendario.abrir/seleccionar |
| `src/components/providers/supabase-sync-provider.tsx` | Realtime cross-device: postgres_changes aplica fila directa (applyRemote*) SIN refetch completo; BroadcastChannel local como refuerzo; heartbeat 5 min; focus/visibility sync operativo |
| `src/app/dashboard/caja/page.tsx` | Caja: cards de cobro, modal pago/abono, historial SIEMPRE visible, etiquetas de saldo con total real de la OT |
| `src/app/dashboard/taller/page.tsx` | Taller: stepper "Enviar a Cobrar" con modal glassmórfico de confirmación; diagnóstico/observación INLINE; logs del flujo |
| `src/app/dashboard/porteria/page.tsx` | Portería: ingreso de vehículos (Monto solo en Venta Directa) |

---

## 3. MODELO DE DATOS / CONCEPTOS CLAVE

### Zona horaria (CRÍTICO)
- PostgreSQL `timestamptz` guarda UTC internamente. Usuario ve hora Perú (−05:00).
- Día PERUANO en queries: `[díaT05:00:00, día+1T05:00:00)` UTC (el día Perú empieza 05:00 UTC).
- Al reconstruir timestamps: `toPeruAnchoredISO`; al filtrar por día: `toPeruDateKey`.

### Vínculo recurso → pago (desde 17/08/2026)
- `PaymentResource`: { id?, description, category: "servicio"|"repuesto"|"certificado", amount, receipt_number?, receipt_type? }
- `PaymentSplit.resources?`, `PaymentRecord.resources?`, `Invoice.resource_payments?`.
- Se persiste en site_content: `inv_resources_<id>` (y por work_order_id).
- VENTAS POR CONCEPTO usa recursos directos; fallback por suma exacta de ítems; fallback report-concept-split.

### Facturas y snapshots
- La tabla `invoices` guarda `payment_history` como NULL: el historial vive en snapshots `inv_payhistory_<id>` / `inv_full_<id>` (por id y por work_order_id).
- `saveSupabaseInvoice` filtra correlativos duplicados (resolveUniqueReceiptNumber) y descarta facturas fantasma (id === `inv-<woId>`).
- `deleteSupabaseInvoice(id, woId)` borra tabla + snapshots + invalida cache de historial (evita que reviva).

### Descuento (NO es columna de work_orders)
- `discount_amount` vive en el snapshot `wo_mod_<id>`; `fetchCappedOperationalData` lo reconstruye (fix BCT-750).
- Al eliminar el ÚLTIMO pago, `deletePaymentRecord` borra la factura completa en cascada y sincroniza el total con la OT.

---

## 4. CAMBIOS RECIENTES DESPLEGADOS (20/08/2026, en orden — sesión actual)

1. `d566117` feat(log): cobertura TOTAL del store (descuento, crear/editar OT, editar/eliminar item, despachar, técnico, diagnóstico, certificación, vehículo).
2. `47a76de` feat(log): medición de tiempos (logTiming/logTimingThreshold) — syncs, guardados OT/factura, render Caja, latencia realtime→store.
3. `b5b1650` fix(caja): sync operativo reconstruye discount_amount/allow_modifications desde snapshots wo_mod_ (BCT-750).
4. `95353ee` **perf(web)**: log LOCAL en localStorage (sin Supabase); realtime SIN refetch completo (fila directa applyRemote* en <100ms); render Caja optimizado; PAGE 1000→400.
5. `a993285` fix(ui): popup del calendario con posición calculada (escapaba overflow-hidden).
6. `73a2548` fix(ui): calendario con **createPortal al body** (escapa overflow-hidden Y backdrop-blur que descolocaba el fixed) + stopPropagation (no expande card Portería) + log calendario.abrir/seleccionar; **visor de Log local en Configuración** (Ver Log + Descargar JSON + filtro).
7. `6db0905` fix(ui): click en fecha del calendario ya selecciona (handler "click fuera" verifica también popupRef).

### Otros fixes previos de la sesión (flujo cobro/realtime)
- `738090d` fix(caja): abono de VENTA no engancha factura de otra venta por placa genérica (bug detectado vía log).
- `6c23d04` feat(realtime): sync operativo ligero (BroadcastChannel + syncOperationalOnly 2s) — luego optimizado en 95353ee.
- `c9b4da5` fix(caja): syncOperationalOnly no pisa historial local con null (editar fecha pago).
- `24ebade` fix(caja): reconstruir historial desde snapshots en fetchCapped (editar fecha de pago).
- `7d52fdc` fix(sync): merge defensivo de items en saveSupabaseWorkOrder (nunca revierte despacho, gana updated_at más reciente).
- `66fe131` feat(flujo): "Enviar a Cobrar" con confirmación en Taller; habilitar edición desde Caja vuelve la OT a en_servicio (card desaparece).
- `451b2b9` feat(caja): eliminar último pago borra factura en cascada; Historial de Pagos SIEMPRE visible; no muestra comprobante CSV viejo.
- `50b63bb` fix(caja): etiquetas crédito/saldo usan total real de la OT (no credit_amount viejo).
- `fd7759e` fix(caja): card muestra precio ACTUAL de la OT tras cambio en Taller (BAG-123).
- `e19e048` fix(caja): al eliminar último pago la factura sincroniza total con la OT; registerInvoicePayment usa total actual sin pagos.
- `b04b11d` feat(log): cada evento registra source (página/componente) + invalidar cache historial al guardar factura.
- `79b58ee` feat(log): sistema de log interno en Supabase (syslog_) — LUEGO movido a local en 95353ee.
- `498aa13` fix(caja): filtro anti-duplicado de correlativo al guardar factura (toast warning + siguiente libre).
- `d7e9906` fix(caja): al eliminar pago la card ya no lo muestra (fallbacks solo si payment_history undefined; delete limpia resource_payments; protección 3s).
- `b2ea472` fix(caja): OT pagada sin factura crea factura al agregar material desde Taller (Pedir Repuesto).
- `780a99b` fix(caja/reporte): OT marcada pagado sin factura crea factura con ticket automático.
- `080f4fa` feat(porteria): venta de repuesto sin precio (material se define en Pedir Repuesto).

### Estado de la base (20/08)
- 17/08 REINGRESADO por el usuario con la nueva forma de pago (flujo Portería→Taller→Caja).
- 18/08 intacto (34 OTs, 21 facturas).
- Correlativo actualizado en Supabase: tickets hasta TK01-00004621 (siguiente 4622), boletas 275, facturas 290.

---

## 5. PENDIENTES / PRÓXIMOS PASOS POSIBLES

- El usuario probará el flujo completo y reportará inconsistencias → corregir con modo ahorro.
- Optimizaciones adicionales propuestas (pendientes de aprobación):
  - Almacén: reducir carga inicial del inventario completo (`fetchAllSupabaseTable("inventory_items")`).
  - Consolidar logs de `card_estado`/`sync.operational` (registrar solo cambios reales).
- El log ahora es LOCAL (localStorage): para diagnosticar pedir al usuario Configuración → Log Interno → Ver Log/Descargar JSON, o que copie las líneas relevantes.

---

## 6. ERRORES COMUNES / TRAMPAS AL EDITAR

- `tsc` falla si hay `)`/llaves desbalanceadas al insertar JSX con IIFE dentro de `return (` → usar fragmento `<>...</>` si hay 2+ hijos, o verificar balance.
- Al editar archivos con template literals anidados (backticks dentro del código del programa): construir el contenido por concatenación de líneas, no con template anidado (falla con "Expected ;").
- `saveSupabaseInvoice` omite facturas fantasma (id === `inv-<woId>`) y descarta correlativos duplicados.
- El `MiniDatePicker` usa **createPortal al body**: cualquier fix de cierre debe verificar `popupRef` además de `containerRef` (si no, el click dentro cierra el popup antes de seleccionar).
- El popup del calendario NO debe volver a `absolute` (el glass-panel con backdrop-blur lo descoloca) ni quedar dentro de overflow-hidden.
- El log NO está en Supabase (es local): no consultar `site_content like syslog_%` para el log actual.
- Al `git add`: nunca stagear CSVs (cambian solos por el usuario) ni scripts temporales `.tmp-*.mjs` — borrarlos antes del commit.
- Si push no dispara deploy: `git commit --allow-empty -m "chore: re-trigger vercel deploy"` + push.
