---
name: reygas-performance-cloud-hardware
description: >
  Guía estándar de optimización web, rendimiento extremo, sincronización Cloud-First con Supabase,
  visualización optimizada para pantallas de 10 pulgadas o más
  y compatibilidad con dispositivos de hardware del taller (Tablet Industrial Chainway P80 y Lector de Códigos SEISA).
  Debe utilizarse para garantizar alta velocidad, respuesta táctil instantánea y persistencia 100% en la nube.
---

# ReyGas Performance, Cloud-First & Hardware Optimization

Esta skill define las reglas obligatorias de arquitectura, optimización de velocidad, sincronización en la nube y diseño adaptado al hardware del taller ReyGas (especialmente la **Tablet Industrial Chainway P80** y el **Lector Láser SEISA YHD-8200L**).

---

## 1. Hardware del Taller: Especificaciones & Compatibilidad

### 1.1 Tablet Industrial Chainway P80 (pantalla mínima 10")
* **Dispositivo:** Tablet rugerizada Android con procesador móvil Octa-Core.
* **PANTALLA MÍNIMA SOPORTADA: 10 pulgadas.** La web debe verse y operarse correctamente en resoluciones efectivas de diseño de **1280×800 (landscape)** y **800×1280 (portrait)** como mínimo; nunca optimizar por debajo de 10".
* **Entorno de uso:** En patio y taller por mecánicos, recepcionistas y jefes de taller, frecuentemente operada con una mano o con guantes.
* **Reglas de Rendimiento para Chainway P80:**
  1. **Touch Targets Grandes:** Todos los botones, checkboxes y enlaces interactivos deben tener un tamaño mínimo de **$44\text{px} \times 44\text{px}$** (`touch-target`, `p-2.5`, `py-2 sm:py-2.5`).
  2. **Paginación Ligera:** Nunca renderizar listas completas de más de 250 elementos sin paginar. Utilizar siempre la barra de paginación estándar con salto directo (`Página [input] de [total]`).
  3. **Búsqueda Diferida (`useDeferredValue`):** Utilizar siempre `React.useDeferredValue` en inputs de búsqueda para que la interfaz no se congele al escribir o escanear códigos de barra.
  4. **Sin Bloqueos por Polling:** Queda **estrictamente prohibido** usar `setInterval` periódicos que refresquen y sobreescriban el estado cada pocos segundos. La sincronización se realiza por eventos Realtime o al ingresar/recargar.

### 1.2 Estándar de Visualización para Pantallas ≥ 10" (OBLIGATORIO)
Toda página nueva o modificada debe cumplir estas reglas (verificadas en DevTools a 1280×800 y 800×1280):

1. **CERO scroll horizontal de página:** el `body`/`html` usan `overflow-x: clip`; TODA tabla ancha vive en un contenedor con `overflow-x-auto` + scroll táctil (`touch-scroll`). Una tabla que desborda la pantalla NUNCA debe empujar el layout de la página.
2. **Legibilidad mínima:** texto de cuerpo ≥ **13–14px**; tablas densas pueden usar 10–12px solo para datos secundarios; montos y totales clave ≥ **14px** (`font-black`/`font-mono`). `globals.css` fija `body { font-size: 14px }` y sube `.text-xs` a `0.8rem` en tablets.
3. **Touch & formularios:** inputs/selects con `min-height: 44px` y `font-size: 15px` (evita auto-zoom Android). Botones de acción siempre `py-2`+ y con texto legible (`btn-full-text` si aplica).
4. **Selects con opciones de texto LARGO:** si un `<select>` puede mostrar opciones largas (ej. "S/N (Sin sistema)"), **limitar su ancho** con `max-w-[120px–160px]` + `truncate` y etiquetas de opción CORTAS — de lo contrario el select se agranda y se superpone a las cards vecinas en tablet (caso real: selector GNV/GLP del Taller). Nunca dejar que el ancho del select dependa del texto de la opción seleccionada.
5. **Grillas responsivas:** en portrait (800px) las grillas de cards usan `grid-cols-1`/`grid-cols-2`; en landscape (1280px) `sm:`/`lg:` suben a 3–4 columnas. Nunca fijar anchos mínimos de página.
6. **Modales:** `max-height: 92vh` con scroll interno (`custom-scrollbar`), ancho acotado al contenido (`max-w-sm`…`max-w-4xl`), nunca más ancho que el viewport.
7. **KPI/totales:** las filas de totales (ej. TOTAL GENERAL DEL DÍA) se separan con filas espaciadoras; los egresos (GASTOS) se muestran en rojo con signo negativo y su fila de caja resultante en verde.
8. **Verificación obligatoria:** antes de desplegar, revisar la página en DevTools a **1280×800** y **800×1280** (simula la tablet 10") y en el navegador de la tablet real. No debe haber desbordes horizontales, textos cortados ni botones menores a 44px.

### 1.3 Lector de Códigos de Barra Láser (SEISA YHD-8200L)
* Emula teclado físico US en un sistema operativo con configuración en español.
* Utilizar siempre `normalizeScannerCode()` para corregir apóstrofes (`'`) por guiones (`-`) y duplicaciones de escaneo.

---

## 2. Principio: Supabase Cloud First (Cero Datos Ficticios / Locales)

1. **La Nube es la Fuente Única de la Verdad:**
   * Todos los registros de Taller, Almacén, Caja, Clientes, Vehículos, Personal y Permisos se almacenan y sincronizan con Supabase.
   * `localStorage` funciona únicamente como caché de hidratación ultrarrápida al abrir la app (Zustand persist), pero la persistencia definitiva es siempre en Supabase.
2. **Sincronización por Eventos en Tiempo Real (Realtime):**
   * Cuando se realiza un cambio (ej. venta, despacho de repuesto, guardado de técnico), se emite `broadcastRealtimeChange("evento")`.
   * Los clientes conectados reciben la actualización de inmediato vía WebSocket de Supabase, evitando llamadas cíclicas continuas que saturan el CPU y la batería de la tablet.
3. **Respeto al Foco y Edición del Usuario:**
   * Si un usuario está editando un formulario o marcando casillas (ej. en *Roster & Permisos*), ninguna sincronización en segundo plano debe reiniciar ni borrar los campos que está modificando.

---

## 3. Guía de Implementación para Desarrolladores

### 3.1 Actualizaciones Optimistas (Instantáneas)
```tsx
// 1. Modificar el estado local inmediatamente (0ms latencia para el mecánico en la tablet)
set((state) => ({
  technicians: state.technicians.map((t) => (t.id === id ? { ...t, ...updates } : t)),
}));

// 2. Persistir en segundo plano en Supabase y difundir
saveSupabaseTechnician(updatedTechnician);
```

### 3.2 Manejo Seguro de Permisos y Roles
Al guardar datos de personal o configuraciones, asegurar la sincronización de campos extendidos como `allowed_tabs` y `can_receive_payment`:
```tsx
await saveSupabaseSiteContent(`tech_perms_${tech.id}`, {
  allowed_tabs: tech.allowed_tabs || [],
  can_receive_payment: !!tech.can_receive_payment,
});
```

### 3.3 Optimizaciones de Renderizado y Memoria
- **Limpieza de Listeners:** Todo `addEventListener` o canal de Supabase debe removerse en la función de limpieza de `useEffect`.
- **Portales de Impresión:** La impresión A4 debe renderizarse en `ReactDOM.createPortal(..., document.body)` con visibilidad oculta en pantalla, evitando sobrecargar el DOM del modal interactivo.
- **Formateo Numérico Estándar:** Usar `formatPEN()` y `formatQty()` con separadores de miles para garantizar lectura rápida y evitar errores visuales.

### 3.4 Topes de Volumen de Datos (CRÍTICO para no detener producción)
El ERP tiene **41k+ órdenes y 118k+ facturas**. Descargarlas TODAS al navegador hace que **cada pestaña demore** y que la tablet quede saturada. Reglas obligatorias:
1. **Sync inicial acotado:** `fetchCappedOperationalData()` carga solo la ventana operativa: 3,000 órdenes recientes, TODAS las facturas pendientes/crédito + 3,000 pagadas recientes, 2,000 vehículos recientes. El histórico se consulta bajo demanda (fecha/placa).
2. **Throttle de sync completo (30s):** ninguna llamada (foco, broadcast, heartbeat, montaje de página) dispara una re-descarga masiva antes de 30s del último sync (`lastFullSyncAt` en el store).
3. **Heartbeat de seguridad cada 5 minutos** (nunca 90s): los cambios reales llegan por Realtime/broadcast; el heartbeat solo es red de seguridad.
4. **Caché local acotada:** persistir ventana reciente (600 órdenes, pendientes + 400 pagadas, 300 vehículos) con escritura diferida (1 write/3s) para hidratación instantánea al reabrir.
5. **`siteContent` sin snapshots pesados:** filtrar del merge las claves `inv_full_*`, `wo_mod_*`, `tech_perms_*`, `sched_*`, `cert_*`, `appt_*` (evita duplicar ~100MB en memoria).
6. **Fetch paginado concurrente:** al leer tablas completas, descargar páginas de 1000 en lotes de 5 concurrentes (`Promise.all`) para reducir ~5x el tiempo de arranque.

---

## 4. Checklist de Optimización & Calidad

- [ ] ¿La página se ve correcta en una pantalla de **10 pulgadas mínimo** (1280×800 y 800×1280, sin scroll horizontal de página)?
- [ ] ¿Toda tabla ancha usa `overflow-x-auto` y no empuja el layout de la página?
- [ ] ¿El texto de cuerpo es legible (≥ 13px) y los montos clave destacan (≥ 14px)?
- [ ] ¿Los botones y campos táctiles son cómodos para operar en la tablet Chainway P80?
- [ ] ¿Las búsquedas utilizan `useDeferredValue` para evitar tirones de frames?
- [ ] ¿La tabla está paginada (50 a 250 ítems) con salto directo de página?
- [ ] ¿La edición de formularios está protegida contra sobreescrituras accidentales?
- [ ] ¿Todos los datos se sincronizan directamente con Supabase en tiempo real?
- [ ] ¿No existen temporizadores cíclicos agresivos (`setInterval`) que agoten la batería del dispositivo?
- [ ] ¿El sync inicial carga SOLO la ventana operativa (`fetchCappedOperationalData`), NO las 118k facturas completas?
- [ ] ¿El sync completo está throttled a 30s y el heartbeat es de 5 minutos (no 90s)?
- [ ] ¿Existe caché local acotada (`reygas-store-cache-v1`) para hidratación instantánea al reabrir?
- [ ] ¿`siteContent` no acumula snapshots pesados (`inv_full_*`, `wo_mod_*`, `tech_perms_*`)?
- [ ] ¿El fetch paginado de tablas completas usa lotes concurrentes (5 a la vez)?
