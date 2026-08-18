# Plan: Mensajes de carga/éxito/error y feedback de guardado

## Contexto
El 404 de PostgREST quedó resuelto ejecutando [`supabase_schema.sql`](supabase_schema.sql). Ahora falta que el usuario vea claramente si una importación CSV o un toggle (check de cobro / check de técnico activo) se guardó o falló, y que los cambios se reflejen en tiempo real en todos los dispositivos.

## Objetivos
1. Mostrar estado de carga, éxito o error en pantalla (no solo en consola) para:
   - Importación de CSV (inventario, taller, programación).
   - Toggle de "check de cobro" (`can_receive_payment`) en la tabla de personal.
   - Toggle de técnico activo (`is_active`) si aplica.
   - Cualquier acción de guardado que hoy falla en silencio.
2. Garantizar que el estado local refleje el resultado real de Supabase (éxito/error con rollback).
3. Verificar que la sincronización Realtime existente propaga cambios entre dispositivos.

## Alcance de código (a implementar en modo Code)
- Reutilizar el patrón ya implementado de confirmación/rollback en el store.
- Agregar un mecanismo de feedback UI global o local:
  - Opción recomendada: un estado `toast`/`notification` en el store (`notification: { type, message } | null` y `notify(type, message)`), renderizado en un componente Toast.
  - Alternativa mínima: estados locales `isSaving`/`savedOk`/`savedError` en los componentes de importación y en la tabla de personal.
- Mostrar el mensaje de error real devuelto por `saveSupabaseSiteContent` / `saveSupabaseBulkInventory` / `saveSupabaseBulkScheduleRecords` / `saveSupabaseBulkWorkshopData` / `saveSupabaseTechnician` cuando `success === false` o `errorMsg`.

## Puntos de integración
- Importación de inventario: acción `importBulkInventoryItems` → ya usa `saveSupabaseBulkInventory` que retorna `{ success, count, errorMsg }`.
- Importación de programación: `importBulkScheduleRecords` → `saveSupabaseBulkScheduleRecords` retorna `{ success, errorMsg }`.
- Importación de taller: `importBulkWorkshopData` → `saveSupabaseBulkWorkshopData` retorna `{ success, errorMsg }`.
- Toggle cobro/activo: `updateTechnician` / `toggleTechnicianActive` → `saveSupabaseTechnician` (hoy retorna void; convertir a retorno con confirmación).
- Toggle check de cobro en Tabla Maestra de Personal: verificar cómo se llama (puede usar `saveAllTechnicianPermissions` o `updateTechnician`).

## Verificación Realtime
- Confirmar que `SupabaseSyncProvider` ya escucha `postgres_changes` sobre `technicians`, `inventory_items`, `schedule_records`, `site_content` y aplica cambios a otros dispositivos.
- Confirmar que las mutaciones locales no se auto-descargan por el guard de `hasRecentLocalMutation`.

## Entregables
- Componente Toast + estado en el store (o feedback local equivalente).
- Mensajes visibles en las importaciones y toggles.
- Retorno de éxito/error verificado en las acciones de técnico.
- `npx tsc --noEmit` sin errores.

## Restricciones
- No cambiar el diseño UI más allá del feedback solicitado (respetar el design system glassmórfico oscuro).
- No reintroducir `localStorage` ni persistencia local de datos de dominio.
- No modificar el esquema SQL.
