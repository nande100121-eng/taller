# REYGAS — CONTEXTO PARA CONTINUAR (ACTUALIZADO)

> Exportado: 20/08/2026 (sesión larga con ~30 cambios desplegados).
> Último commit en `main`: `848eeff` — producción: https://taller-two-gamma.vercel.app (deploy taller-motyt2a4y)
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
- **Hardware**: Tablet industrial Chainway P80 + lector SEISA (skill `reygas-performance-cloud-hardware`)
- **Despliegue**: Vercel (`taller` / nande3), producción: https://taller-two-gamma.vercel.app

### REGLAS OBLIGATORIAS DEL USUARIO (nunca violar)
- **Publicar cada cambio**: `npx tsc --noEmit` → commit en `main` → `git push origin main` (Vercel auto-deploy por git).
- **NO usar `npx vercel --prod`** (doble deploy gasta el límite diario de 100 deploys). Solo git push. Verificar con `npx vercel ls --scope nande3` (read-only).
- **NUNCA modificar los CSV del usuario** (`registro taller *.csv`, `DEUDA 17.08.26.csv`): al hacer `git add` stagear SOLO archivos fuente, nunca los CSV ni scripts de trabajo.
- Responder en español.

### Skills estándar (en el nuevo entorno: `reygas-supabase-congruence`, `reygas-ui-design-system`, `reygas-reports-system`, `reygas-printing`, `reygas-performance-cloud-hardware`)

---

## 2. ARQUITECTURA Y ARCHIVOS CLAVE

### Módulos (`src/app/dashboard/`)
`admin` (CMS + Tabla Maestra Registros/Personal), `almacen`, `asistencia`, `caja`, `certificaciones`, `configuracion`, `consultas`, `porteria`, `recepcion`, `reportes`, `taller`.

### Archivos núcleo
| Archivo | Rol |
|---|---|
| `src/lib/store/app-store.ts` | Store Zustand persist (`reygas-store-cache-v2`): workOrders, invoices, payment_history, sync con Supabase, acciones de pago (confirmInvoicePayment, registerInvoicePayment, updatePaymentRecord, clearInvoicePayments) |
| `src/lib/supabase/services.ts` | Persistencia: saveSupabaseWorkOrder/Invoice, fetchSupabaseDayReport, fetchMasterTablePage, fetchCappedOperationalData, deleteSupabaseWorkOrder (CASCADA), saveSupabaseCertification, merge site_content |
| `src/lib/utils/date-utils.ts` | Hora PERÚ: getPeruDateString, buildPeruISOString ("YYYY-MM-DDTHH:mm:00-05:00"), toPeruDateKey, toPeruAnchoredISO |
| `src/lib/deuda-csv.ts` | Deuda oficial (DEUDA 17.08.26.csv): DEBT_CSV_BY_RECEIPT, matchDebtCsvByInvoice |
| `src/lib/workshop-csv-lookup.ts` | Registro taller CSV (WORKSHOP_CSV_LOOKUP, WORKSHOP_DAY_RECORDS) |
| `src/lib/report-concept-split.ts` | Reparto manual por boleta (MANUAL_CONCEPT_SPLIT_BY_RECEIPT) — SOLO comprobantes históricos |
| `src/components/DailyWorkshopReportModal.tsx` | Reporte diario (REPORTE DEL DÍA, VENTAS POR CONCEPTO, YAPES & TRANSFERENCIAS, TOTAL GENERAL) |
| `src/app/dashboard/caja/page.tsx` | Caja: cards de cobro, modal de pago (paymentModal), modal de ABONO (partialPaymentModal) con vínculo recurso->pago |
| `src/app/dashboard/taller/page.tsx` | Taller: cards con diagnóstico/observación INLINE, fechas Quinquenal/Chip con MiniDatePicker inline, botones |
| `src/app/dashboard/porteria/page.tsx` | Portería: ingreso de vehículos (Monto solo en Venta Directa) |
| `src/components/providers/supabase-sync-provider.tsx` | Realtime: maneja DELETE de OTs/facturas localmente |

---

## 3. MODELO DE DATOS / CONCEPTOS CLAVE

### Zona horaria (CRÍTICO)
- PostgreSQL `timestamptz` guarda UTC internamente. Usuario ve hora Perú (−05:00).
- Día PERUANO en queries: `[díaT05:00:00, día+1T05:00:00)` UTC (el día Perú empieza 05:00 UTC).
- Al reconstruir timestamps: `toPeruAnchoredISO`; al filtrar por día: `toPeruDateKey`.

### Vínculo recurso → pago (nueva forma de pago, desde 17/08/2026)
- `PaymentResource` (app-store.ts): { id?, description, category: "servicio"|"repuesto"|"certificado", amount, receipt_number?, receipt_type? }
- `PaymentSplit` tiene `resources?: PaymentResource[]`; `PaymentRecord` tiene `resources?`.
- `Invoice` tiene `resource_payments?: PaymentResource[]`.
- El modal de ABONO (Caja): cada método/comprobante del desglose lleva SU PROPIA lista `splitResources` (key, description, category, fullAmount, pendingAmount, payAmount, selected). El "Monto Total" del método = suma de recursos marcados. Recursos usados en otro comprobante → tachados/no disponibles (solo saldo restante).
- Se persiste en site_content: `inv_resources_<id>` (y por work_order_id).
- VENTAS POR CONCEPTO usa `resource_payments`/recursos directos si existen; si no, matching por suma exacta de ítems de la card; si no, fallback proporcional.

### Borrado en cascada (implementado en `848eeff`)
- `deleteSupabaseWorkOrder(id)`, `deleteSupabaseMultipleWorkOrders(ids)`, `clearSupabaseWorkOrders()`: borran OTs + facturas (por work_order_id) + snapshots site_content (`inv_full_`, `inv_breakdown_`, `inv_payhistory_`, `inv_resources_` por id y por woId) + certificaciones (tabla + `cert_<id>` por key y section_key).
- Motivo: al borrar desde Tabla Maestra quedaban 148 facturas huérfanas del 17/08 (ya limpiadas manualmente).

---

## 4. CAMBIOS RECIENTES DESPLEGADOS (20/08/2026, en orden)

1. `b16ee75` fix(reporte): VENTAS POR CONCEPTO solo cuenta lo cobrado en parciales (BEF-098).
2. `52d5567` fix(reporte): VENTAS POR CONCEPTO asigna ítems reales de la card a cada ticket (AUH-440: ticket 275=cert 180, ticket 276=serv 50+rep 40).
3. `19d9c62` fix(sync): merge de items ya no descarta ítems sin id (card perdía certificación AUH-440).
4. `40f76aa` feat(caja): vínculo recurso->pago desde 17/08 (selección de recursos al cobrar + edición de pagos) + reporte usa vínculo directo.
5. `39bc751` feat(caja): abonos de créditos vinculan recursos (saldo pendiente por recurso, pago parcial por recurso, próximos abonos solo muestran pendientes).
6. `d712d06` fix(caja): cards pagadas muestran historial (reconstruido desde desglose/recursos) + modo solo-vincular (linkOnly).
7. `fd806c6` fix(sync): saveSupabaseInvoice repara work_order_id inválido ("x") desde snapshot/OT real (AFT-598).
8. `99286ff` feat(caja): rediseño modal de abono — fecha primero → comprobante → método → recursos vinculables → observaciones; editar comprobante abre el mismo modal desde historial.
9. `3b11d6d` feat(taller/porteria): diagnóstico y observación INLINE en card (sin modal); fechas Quinquenal/Chip con MiniDatePicker inline; quité botón Diagnóstico y doble botón de certificación; Portería: Monto solo en Venta Directa.
10. `89b6c11` feat(caja): en el desglose de métodos del abono, cada método lleva sus recursos (Monto Total = suma de marcados); recursos usados en otro comprobante se tachan/no disponibles o solo saldo.
11. `848eeff` fix(sync): borrado en cascada de OTs (facturas, snapshots, certificaciones).

### Estado de la base (20/08)
- **17/08/2026 LIMPIADO** (a petición del usuario para re-ingresar con la nueva forma de pago): 0 OTs (solo 2 GASTO), 0 facturas, 0 snapshots huérfanos. El usuario re-ingresará los datos.
- 18/08 intacto (34 OTs, 21 facturas).
- AFT-598 reparado (work_order_id correcto, boleta TK01-00004599).
- AUH-440: card muestra 270 (fix merge ítems sin id) y VENTAS POR CONCEPTO 50/40/180.

---

## 5. PENDIENTES / PRÓXIMOS PASOS POSIBLES

- Re-ingresar datos del 17/08 con la nueva forma de pago y verificar VENTAS POR CONCEPTO + TOTAL GENERAL (CUADRADO).
- El usuario probará el flujo y reportará inconsistencias (bugs) → corregir con modo ahorro.
- NO hay tareas pendientes de código conocidas más allá de los fixes que reporte el usuario.

---

## 6. ERRORES COMUNES / TRAMPAS AL EDITAR

- `tsc` falla si hay `)`/llaves desbalanceadas al insertar JSX con IIFE dentro de `return (` → usar fragmento `<>``</>` si hay 2+ hijos, o verificar balance con contador node (ignorando strings).
- `saveSupabaseInvoice` omite facturas fantasma (id === `inv-<woId>`).
- `updateWorkOrder`/store solo tocan listas del store (ventana reciente): para Tabla Maestra usar `saveSupabaseWorkOrder` directo.
- Al `git add`: nunca stagear CSVs (cambian solos por el usuario).
- Verificar deploy con `npx vercel ls --scope nande3 --json` (mira meta.githubCommitSha) y `npx vercel inspect taller-two-gamma.vercel.app`.
- Si push no dispara deploy: `git commit --allow-empty -m "chore: re-trigger vercel deploy"` + push.
