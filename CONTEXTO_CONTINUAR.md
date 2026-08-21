# REYGAS — CONTEXTO PARA CONTINUAR (ACTUALIZADO)

> Exportado: 20/08/2026 — ACTUALIZADO tras sesión de fixes (fechas Perú, descuento, repuestos eliminados, reporte).
> Último commit en `main`: `9d90129` (build del fix reporte `17e931a`) — producción: https://taller-two-gamma.vercel.app
> **Deploy del último fix (17e931a) ya finalizó en Vercel según el usuario — VERIFICAR bundle prod (SHA 17e931a o 9d90129) pendiente** (último intento dio DEPLOYMENT_NOT_FOUND/404 por propagación).
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

### Sesión ACTUAL (20/08, en orden — commits nuevos tras 6db0905)
8. `4947b30` fix(fechas): card Taller/Almacén mostraba día siguiente para OTs nocturnas — Supabase guarda UTC y realtime/formatters no convertían a Perú; ancla timestamps a −05:00 en applyRemoteWorkOrderLocal/applyRemoteInvoiceLocal, requested_at/dispatched_at con nowPeruISO, formatPeruDate/formatPeruDateTime/getPeruDateString convierten strings UTC, extractDateKey usa toPeruDateKey.
9. `4892ffc` fix(descuento): card con descuento (BWV-501: 500−20=480) — recursos de abono/pago se ofrecían por monto bruto (500) y no coincidían con el neto; descuento PROPORCIONAL en buildAbonoResourceSelection + modal de pago + orderCategorySplit/buildCategoryItems (VENTAS POR CONCEPTO suma el neto).
10. `8e83787` fix(taller): no permitía eliminar un repuesto entregado (F2Z-050) — merge defensivo de saveSupabaseWorkOrder lo revivía desde la DB; se registran removedItemIds en la OT y el merge excluye esos ids del preservado.
11. `acec359` fix(taller): repuesto eliminado volvía a aparecer cuando Almacén guardaba la OT con su copia vieja (F2Z-050 cross-device) — removedItemIds solo vivía en la tablet que borraba; ahora se persiste registro GLOBAL "wo_removed_<id>" en site_content que saveSupabaseWorkOrder lee antes del merge; applyRemoteWorkOrderLocal usa lista remota como autoritativa; reconstrucción filtra por wo_removed_.
12. `858e5d2` feat(taller): vehículos ACTIVOS de días anteriores (ingresado/diagnóstico/repuestos/en servicio/por cobrar) siguen apareciendo en días posteriores según su estado actual; solo OTs finales (pagado/finalizado/entregado) viven en el día de ingreso.
13. `37ab63e` fix(caja): repuesto eliminado en Taller seguía en la card de Caja (F2Z-050) — syncOperationalOnly/syncFromSupabase fusionaban items LOCALES con el remoto; ahora la lista remota (que ya excluye wo_removed_) es autoritativa y solo se conservan items locales que coinciden.
14. `b202b29` fix(reporte): F2Z-050 del 17.08 no aparecía en Saldos Pendientes — OT quedó por_cobrar sin factura (abono mal eliminado) y pendingByPlate solo agrupaba por facturas; ahora también incluye OTs del día en por_cobrar/pendiente_pago sin factura como deuda.
15. `af81173` feat(caja-abono): descuento ya NO proporcional — en modal Abonar Saldo el cajero indica a QUÉ recurso se aplica (botón 🛡 en cada recurso, asignado por defecto al primero que lo cubre); NO permite asignarlo a recurso cuyo monto < descuento.
16. `abddcb7` feat(caja-abono): al aplicar descuento a un recurso su monto a pagar se reduce automáticamente y al quitarlo se restaura el bruto (moveAbonoDiscount ajusta payAmount); etiqueta "A abonar" avisa en rojo cuando la suma excede el saldo pendiente y sugiere aplicar descuento.
17. `2095d54` feat(caja): paneles Gastos del Día y Últimos Correlativos COLAPSADOS por defecto (toggle chevron); correlativos usan serie exacta TK01/B001/F001 — folio = parte tras el guion (TK01-00004545→4545, no 1000004545); secuencia continúa desde el último folio real de esa serie.
18. `93eb01f` feat(configuracion): nueva tabla Tipo Combustible (agregar/editar/eliminar) — selects de Portería/Taller se renderizan desde fuelTypes (persistido en site_content, fallback GNV/GLP/Gasolina/Bifuel/S/N) + realtime.
19. `17e931a` fix(reporte): BBL-219 y VENTA se duplicaban el 18.08 (una fila con recurso + una fila "ABONO" del mismo comprobante/monto) — nuevo `dayPaymentsDeduped` en DailyWorkshopReportModal.tsx filtra pagos cuya (placa + folio correlativo + monto) ya está cubierta por una fila reportable del día; aplica en liquidacionRows, abonosDelDia, liquidacionTotals y electronicMatrix (parseCorrelative).
20. `9d90129` chore: re-trigger vercel deploy (build 17e931a).

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

- **VERIFICAR deploy del fix 17e931a/9d90129 en prod** (usuario confirmó que el deploy finalizó en Vercel; falta confirmar el SHA en el bundle de prod tras la propagación del edge).

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
