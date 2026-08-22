# REYGAS — CONTEXTO PARA CONTINUAR (ACTUALIZADO)

> Exportado: 21/08/2026 (noche) — sesión de fixes: reporte redirect, ticket por pagar, auditoría/limpieza DB, destinos, edición de pagos mixtos, Abonar Saldo.
> Último commit en main (origin): 687fa20 — producción: https://taller-two-gamma.vercel.app
> **IMPORTANTE — DEPLOY PENDIENTE**: Vercel NO desplegó automáticamente 25628cc ni 687fa20 (el usuario lanzó 25628cc manual ~22:10; 687fa20 quedó sin deploy confirmado). Si el usuario ve un build viejo: Ctrl+F5; si sigue, deploy manual en Vercel o empty commit re-trigger.
> **MODO AHORRO ACTIVADO**: respuestas compactas, tsc 1x por lote, 1 commit+push+deploy por lote, lecturas quirúrgicas (grep + solo zona a editar), sin verificación redundante.

---

## 0. MODO AHORRO (IMPORTANTE — activar en el nuevo chat)

El usuario pidió optimizar consumo de crédito de la API. Reglas para TODA la sesión:

1. **Agrupar cambios**: procesar los pedidos en UN lote → 1 tsc → 1 commit → 1 push → 1 verificación de deploy.
2. **Respuestas compactas**: confirmar en 2-4 líneas (qué se hizo → tsc ✓ → commit → deploy).
3. **Lecturas mínimas**: grep para localizar, leer SOLO la zona a editar (nunca archivos completos de 5000+ líneas).
4. **No verificar redundante**: si el usuario dice que se ve bien, seguir sin re-verificar.
5. **Checkpoint temprano**: si la sesión crece, actualizar CONTEXTO_CONTINUAR.md y abrir chat nuevo.

---

## 1. QUÉ ES EL PROYECTO

**ReyGas (repo GitHub nande100121-eng/taller)** — Sistema web de gestión integral de un taller de gas vehicular (GNV/GLP) en Perú.

- **Stack**: Next.js 14.2.4 (App Router), React 18, TypeScript 5.5, TailwindCSS 3.4, Zustand 4.5, Supabase (cloud-first + realtime), date-fns, lucide-react
- **Hardware**: Tablet industrial Chainway P80 + lector SEISA
- **Despliegue**: Vercel (git push auto-deploy). Prod: taller-two-gamma.vercel.app (Chrome Safe Browsing dio falso positivo; sin resolver).

### REGLAS OBLIGATORIAS DEL USUARIO (nunca violar)
- **Publicar cada cambio**: npx tsc --noEmit → commit en main → git push origin main (Vercel auto-deploy).
- **NO usar npx vercel --prod** (doble deploy gasta límite). Solo git push.
- **NUNCA modificar ni stagear CSVs** (registro taller *.csv, DEUDA 17.08.26.csv) ni scripts/_*.ps1, scripts/*.mjs, iniciar-dsh-web.bat (working tree tiene muchos sucios).
- Responder en español.

### Skills estándar (OBLIGATORIO según la tarea)
- reygas-supabase-congruence: SIEMPRE que se cree/modifique una acción que guarde/borre/sincronice datos en Supabase.
- reygas-ui-design-system: SIEMPRE que se agregue/modifique UI.
- reygas-reports-system: SIEMPRE que se cree/modifique un reporte.
- reygas-printing: SIEMPRE que se agregue/modifique impresión.
- reygas-performance-cloud-hardware: rendimiento, sync Cloud-First, tablets.

---

## 2. ARQUITECTURA Y ARCHIVOS CLAVE

### Módulos (src/app/dashboard/)
admin (CMS + Tabla Maestra), almacen, asistencia, caja, certificaciones, configuracion, consultas, porteria, recepcion, reportes, taller.

### Archivos núcleo
- src/lib/store/app-store.ts — Store Zustand persist (reygas-store-cache-v2). set envuelto en setWithLog (invoca updater UNA vez; CRITICAL — no duplicar). Acciones: registerInvoicePayment (crea inv-<Date.now()>), confirmInvoicePayment, updatePaymentRecord (dedup historial por id + conserva payment_breakdown real), deletePaymentRecord (si remaining 0 borra factura cascada), syncOperationalOnly/syncFromSupabase (dropean facturas locales de OTs tombstoned), getAndIncrementReceiptNumber (sanity cap folio < 999999).
- src/lib/supabase/services.ts — saveSupabaseWorkOrder (per-OT queue woSaveQueues, tombstone wo_deleted_ check, merge defensivo), saveSupabaseInvoice (filtro fantasma inv-<woId>, ANTI-GHOST tombstone wo_deleted_<id> → skip, __respectManualReceipt respeta N° digitado, resolveUniqueReceiptNumber cap < 999999, snapshots inv_full_/inv_payhistory_/inv_resources_/inv_breakdown_ por id Y woId, snapshots vacíos se borran), deleteSupabaseWorkOrder (CASCADA + tombstone), deleteSupabaseInvoice, fetchCappedOperationalData (ventana PAGE=400 + reconstrucción historial desde snapshots con cache 15s cappedHistoryCache + invalidar al guardar), fetchSupabaseDayReport.
- src/lib/system-log.ts — LOG LOCAL en localStorage (reygas-syslog-local, FIFO 12000): logSystemEvent, logTiming, initGlobalLogging (clicks/change/red/errores; interceptor filtra writes/errores/GET lentos >1500ms). NO usa Supabase.
- src/components/caja/thermal-receipt-modal.tsx — impresión térmica 80mm (boleta/ticket/factura + modo ticketPorPagar: TICKET POR PAGAR, sin correlativo, sin forma de pago, placa negrita, sin impuestos, DESCUENTO antes del TOTAL solo si >0).
- src/components/DailyWorkshopReportModal.tsx — reporte diario (REPORTE DEL DÍA, VENTAS POR CONCEPTO, YAPES & TRANSFERENCIAS POR DESTINO). Abonos respetan redirect_category; breakdownFromSources usa destination de cada split; dayPaymentsDeduped evita dobles.
NaN
- src/lib/utils/receipt-utils.ts — parseCorrelative (folio tras último guion), matchesReceiptSeries, formatReceiptNumber.

---

## 3. MODELO DE DATOS / CONCEPTOS CLAVE

### Zona horaria (CRÍTICO)
Perú = UTC−5. Fechas: getPeruDateString, buildPeruISOString (YYYY-MM-DDTHH:mm:00-05:00), toPeruDateKey. El reporte filtra por fecha de PAGO (no emisión).

### Vínculo recurso → pago (desde 17/08/2026)
- Cada pago guarda resources: [{description, category (servicio/repuesto/certificado), amount, receipt_number, receipt_type, redirect_category}].
- redirect_category (redirección del cajero): un recurso servicio puede redirigirse a repuesto/certificado — VENTAS POR CONCEPTO lo respeta (redirect_category || category).

### Pagos mixtos (1 comprobante, varios métodos)
- payment_breakdown guarda UN split por método: {method, destination, amount, splitResources, receipt_number, receipt_type}.
- DESTINO del comprobante: si todos los métodos coinciden → ese; si difieren → el del método de MAYOR monto. NUNCA se concatenan (CAJA / FRANCO fue el bug).
- Cada método tiene SU select de destino (NO hay select global — el usuario lo rechazó).
- Al EDITAR un mixto: handleOpenEditPaymentRecord reconstruye los splits del breakdown real (renormaliza keys de recursos contra el pool edit-res-*); el saldo restante de cada recurso es SECUENCIAL por método (método 1 toma 10 → saldo restante 120; método 2 dispone del faltante 120).
- Al EDITAR NO se valida contra el saldo (supera saldo solo en abonos nuevos); el monto REEMPLAZA, no suma.

### Facturas y snapshots (site_content)
- La tabla invoices NO tiene payment_history/breakdown/resource_payments como columnas — viven en snapshots: inv_full_<id> (prioridad), inv_payhistory_<id>, inv_resources_<id>, inv_breakdown_<id> — CADA UNO también por <work_order_id>.
- inv_full_<itemId> con category inventory = items del almacén (ids inv-RYG-*) — NO son facturas, NO tocar.
- wo_mod_<id> = snapshot de OT (descuento, assigned_technician_ids, items); wo_deleted_<id> = TOMBSTONE (bloquea re-creación); wo_removed_<id> = ítems eliminados.
- upsert site_content: POST/PATCH con on_conflict=section_key + Prefer resolution=merge-duplicates, body UTF-8.

### Descuento (NO es columna de work_orders)
Vive en wo_mod_<id>; el sync lo reconstruye. Al abonar, el cajero asigna el descuento a UN recurso (moveAbonoDiscount).

---

## 4. CAMBIOS RECIENTES (21/08 — sesión actual, en orden)

1. 18cc71b fix(reporte): abonos del día respetan redirect_category (recurso redirigido a Almacén/Certificados ya se distribuye en VENTAS POR CONCEPTO; caso AZX-546 TK01-00004607).
2. 2773fdc feat(taller): botón Ticket por Pagar en la card → modal térmico modo ticketPorPagar (sin correlativo, sin forma de pago, placa negrita, detalle de la card, solo TOTAL, sin op. gravadas/IGV).
3. ad25ce4 feat(ticket por pagar): DESCUENTO antes del TOTAL (solo si la card tiene descuento).
4. 9598baf fix(anti-fantasma/correlativo): (a) syncs dropean facturas locales de OTs borradas (tombstone); (b) sanity cap correlativo < 1M en getAndIncrementReceiptNumber.
5. 17cb822 fix(caja): al EDITAR se reconstruye el PAGO MIXTO real desde su desglose; DESTINO ÚNICO (select global — luego revertido).
6. 0273057 fix(caja): quitar el select de Destino global duplicado (cada método tiene el suyo); el destino se deriva de los métodos (mayor monto si difieren).
7. 46a8e52 fix(distribución mixta): rebuildBreakdownFromHistory DESANIDA Mixto (...) en métodos; rebuildDestFromHistory devuelve UN solo destino; la edición conserva el desglose real.
8. d631a47 fix(caja): al EDITAR ya NO se bloquea por supera saldo (el monto reemplaza; el saldo se recalcula); en edición se sincroniza el monto de cada método con sus recursos; dedup del historial por id.
9. 25628cc fix(caja edición): saldo restante SECUENCIAL por método (D7U-622 DIAFRAGMA S/130: método 1 toma 10 → saldo 120; método 2 dispone del faltante 120) — arregla keys desnormalizadas (abono-res-* vs edit-res-*).
10. 687fa20 fix(caja): Abonar Saldo SIEMPRE abre abono NUEVO (sin heredar editingRecordId); pagos RECONSTRUIDOS de la card (id rp-<invoiceId>/bd-, cuando el store no trae payment_history) ya NO abren edición (el lápiz abre Abonar Saldo; eliminar deshabilitado); el submit solo usa modo edición si el id existe en el historial real.
11. 256b354 fix(caja BEF-098 "abonar jala factura borrada"): clearInvoicePayments ("Borrar todos") retornaba SIN hacer nada si el store no traía payment_history (pagos reconstruidos rp-/bd-, historyCount 0) → la factura de prueba seguía en el caché con su crédito/comprobante y el modal de abono abría con sus datos. Ahora "Borrar todos" ELIMINA la factura COMPLETA en cascada (tabla + snapshots inv_full_/inv_payhistory_/inv_breakdown_/inv_resources_ por id y woId) + OT a por_cobrar, funcione o no con historial. Botón "Borrar todos" solo se muestra si la card tiene factura; toast/tooltip actualizados. (Verificado en prod 22:54: payment.clear_all.invoice_removed → invoice.delete.ok → abono abre invId null.)
12. 0f18a14 fix(caja abono BBF-936 "vincula recurso y jala el TOTAL no el saldo"): al marcar un recurso del comprobante el payAmount se limitaba a min(fullAmount, saldoDisponible del recurso) y para facturas pre-17/08 (fallback con pendingAmount=fullAmount) tomaba el TOTAL del recurso aunque el saldo pendiente fuera menor (BBF-936: total 450, saldo 50). Ahora el límite es el SALDO GLOBAL del comprobante (totalDue - invoicePaidSoFar - lo ya marcado en otros recursos/métodos): si el recurso es menor al saldo se completa al 100%; si es mayor solo se toma lo restante. Aplica a: click del checkbox, botón "✓ Todos" (reparto secuencial), input manual (max/val) y disabled cuando el saldo global ya está cubierto. En EDICIÓN no se limita (el monto reemplaza).
13. 8c02222 feat(portería): (a) la card "Citas & Reservas Programadas" ahora va ARRIBA de "Registrar Ingreso de Vehículo" (antes: ingreso → citas → semáforo; ahora: citas → ingreso → semáforo); (b) aviso inteligente en el campo PLACA: si la placa digitada tiene una cita/reserva pendiente o confirmada para la fecha seleccionada del ingreso (entryDate/selectedDate), se muestra un mensaje ámbar debajo del campo (plateHasAppointmentOnDate, compara scheduled_date slice(0,10) === fecha, normaliza placa sin [^A-Z0-9]).
14. b8893e4 feat(portería): el aviso del campo PLACA ahora también muestra si la placa tiene un INGRESO EN TALLER vigente con su estado (plateActiveWorkOrder: OT más reciente no finalizada, excluye GASTO; label via plateOrderStatusLabel: Ingreso/Diagnóstico/Esperando Repuestos/En Servicio/Por Pagar/Por Pagar (abonos)/Pagado-Listo para Entregar + contexto: pendiente de cobro en Caja, autorizado a salir, o en proceso de atención).
15. 985db2d feat: (a) portería: el aviso de ingreso en Taller del campo PLACA ahora incluye la FECHA/HORA de ingreso (formatPeruDateTime(entry_time)): "ingreso en Taller del DD/MM/AAAA HH:MM: ESTADO"; (b) taller: la card COLAPSADA muestra también "📅 Registro: fecha/hora" junto a OT/ítems/cliente.

### Estado de la base (21/08 — limpieza hecha)
- 118,082 facturas auditadas: 0 tickets absurdos, 0 correlativos duplicados con serie, 0 facturas fantasma en la tabla. (Los 7,926 duplicados restantes son folios históricos SIN serie de CSVs — NO tocar.)
- 84 snapshots huérfanos eliminados (15 inv_full_, 4 inv_payhistory_, 1 inv_breakdown_, 64 wo_mod_) + 64 tombstones wo_deleted_ creados. Verificado: 0 huérfanos restantes.
- Destinos dobles corregidos a FRANCO: TK01-00004617, TK01-00004585, TK01-00004608, TK01-00006804 (tabla + snapshots). 0 destinos con / en la base.
- BEF-098 restaurada: factura bef098-restaurada-0001 (TK01-00004610, total S/2800, abono Transferencia S/1000 el 18/08, saldo S/1800, destino FRANCO) vinculada a OT 268bffbe — con snapshots por id y woId. La factura original se perdió al borrar una OT (cascada).
- 21/08: los pagos mixtos de D7U-622 (180), BBL-219, T2V-669, BVZ-412 siguen en la base con sus desgloses (splits con destino FRANCO).

---

## 5. PENDIENTES / PRÓXIMOS PASOS

- **VERIFICAR deploy de 687fa20 (y 25628cc) en prod**: Vercel no desplegó automático. Ctrl+F5; si sigue viejo → deploy manual del usuario o empty commit re-trigger.
- El usuario sigue probando Caja (editar comprobantes, abonos, pagos mixtos, reporte 18/08) — corregir inconsistencias (modo ahorro).
- Eliminar la factura de prueba de BEF-098: con 256b354, pulsar "Borrar todos" en la card ya elimina la factura completa aunque el historial sea reconstruido. (Alternativa manual: borrar el pago REAL pay-bef098-1000-1808 — cascada.)
- Pago mixto con destinos distintos (Efectivo→CAJA + Yape→FRANCO en un solo comprobante): YA se soporta — cada método guarda monto+destino; la matriz YAPES muestra el yape en su destino; el destino del comprobante es único (mayor monto).
- Mejora pendiente (mencionada antes): Almacén reducir carga inicial de inventario completo.

---

## 6. ERRORES COMUNES / TRAMPAS AL EDITAR

- Al editar archivos con template literals anidados (backticks dentro del código run_code): construir por concatenación de líneas (array join) o comillas simples externas; un backtick interno rompe con Expected ','. Los ${...} en old_string también se interpolan → usar comillas simples.
- PowerShell 5.1: no existe || (usar if); pwsh no existe (usar powershell o & .\scripts\x.ps1); PATCH/POST body debe ser bytes UTF-8; ConvertFrom-Json no admite añadir props (reconstruir con [ordered]); Invoke-WebRequest falla en modo no interactivo (curl.exe o Invoke-RestMethod).
- El log es LOCAL (localStorage): no consultar Supabase; pedir Configuración → Log Interno → Ver Log/Descargar JSON/Copiar.
- El campo build del log = NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0,8) — sirve para verificar qué commit está desplegado (buscar el SHA en los chunks JS de producción).
- saveSupabaseInvoice omite fantasmas (inv-<woId>), salta si la OT tiene tombstone, respeta N° manual (__respectManualReceipt).
- setWithLog invoca el updater UNA vez — nunca duplicar (causaba dobles facturas/abonos/instalaciones).
- No stagear CSVs ni scripts/_* ni iniciar-dsh-web.bat.
- Si push no dispara deploy: git commit --allow-empty -m "chore: re-trigger vercel deploy" + push (o deploy manual).
- El MiniDatePicker usa createPortal al body: verificar popupRef al cerrar.
- Los pagos reconstruidos (rp-/bd-) NO tienen registro real: no editar/eliminar directamente (usar Abonar Saldo).
