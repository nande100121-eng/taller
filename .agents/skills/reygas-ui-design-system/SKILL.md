---
name: reygas-ui-design-system
description: >-
  Estándar y guía integral de diseño UI para la aplicación ReyGas.
  Aplica el diseño oscuro glassmórfico corporativo a todas las ventanas flotantes (modales),
  selectores de fecha / calendarios, tablas con salto de página, botones, formularios y badges.
---

# Guía y Estándar de Diseño UI - ReyGas

Este skill define la especificación visual, estructura JSX y clases de estilo que **deben cumplirse de manera obligatoria e idéntica en todas las pantallas, componentes, ventanas flotantes (modales) y calendarios de la aplicación ReyGas**.

---

## 1. Paleta de Colores Corporativa y Glassmorphism

| Elemento | Clases Tailwind / CSS | Propósito |
| :--- | :--- | :--- |
| **Fondo Principal** | `bg-reygas-dark` / `bg-[#0B0F17]` | Fondo base oscuro del sistema |
| **Paneles y Tarjetas** | `glass-panel` o `bg-reygas-surface border border-white/10 rounded-2xl` | Paneles con efecto cristal y borde sutil |
| **Acento Primario (Ámbar)** | `bg-amber-500 text-black font-black hover:bg-amber-400` | Acciones principales, estados pendientes, alertas y foco |
| **Acento Secundario (Esmeralda)** | `bg-emerald-600 text-white font-bold hover:bg-emerald-500` | Éxito, confirmaciones, estado atendido/despachado |
| **Alerta / Error (Rojo)** | `bg-red-600 text-white font-bold` / `text-reygas-red` | Stock negativo, errores críticos, eliminaciones |
| **Secundario / Documentos (Cian/Azul)** | `bg-cyan-600/20 text-cyan-300 border-cyan-500/30` | Fechas, identificadores, exportaciones |

---

## 2. Ventanas Flotantes y Modales (Floating Windows / Modals)

Todas las ventanas modales emergentes o flotantes deben seguir esta estructura visual exacta:

```tsx
{isOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
    <div className="glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl shadow-black/90 max-h-[90vh] overflow-y-auto space-y-6">
      
      {/* Encabezado del Modal */}
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Título de la Ventana</h3>
            <p className="text-xs text-gray-400">Descripción clara de la acción o contenido.</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contenido / Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
            Campo de Entrada *
          </label>
          <input
            type="text"
            required
            className="w-full px-3.5 py-2.5 bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none placeholder-gray-500 transition-all font-medium"
            placeholder="Ingrese información..."
          />
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Guardar Cambios
          </button>
        </div>
      </form>

    </div>
  </div>
)}
```

---

## 3. Calendario y Selector de Fecha Unificado

**Regla Estricta**: En cualquier pestaña donde se requiera selección de fechas, se debe utilizar el componente de barra con flechas, ícono de calendario y botón "Hoy", calculando siempre la hora local de Perú (`America/Lima`).

```tsx
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getPeruDateString } from "@/lib/utils/date-utils";

{/* Barra de Navegación de Calendario Estándar */}
<div className="flex flex-wrap items-center gap-3">
  <div className="flex items-center bg-reygas-surface rounded-xl border border-white/10 p-1">
    <button
      onClick={() => changeDateByDays(-1)}
      className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
      title="Día Anterior"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>

    <div className="flex items-center gap-2 px-2">
      <Calendar className="w-4 h-4 text-amber-400" />
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="bg-transparent text-white font-mono text-xs font-bold focus:outline-none cursor-pointer"
      />
    </div>

    <button
      onClick={() => changeDateByDays(1)}
      className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
      title="Día Siguiente"
    >
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>

  <button
    onClick={() => setSelectedDate(getPeruDateString())}
    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
  >
    Hoy
  </button>
</div>
```

---

## 4. Tablas de Datos y Barra de Salto de Página (Paginación)

Toda tabla o listado paginado debe incluir la barra de control de páginas idéntica al módulo de tablas y registro de taller:

```tsx
{totalPages > 1 && (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-gray-300">
    <div>
      Mostrando registros <span className="text-white font-bold">{startIndex + 1}</span> a{" "}
      <span className="text-white font-bold">{endIndex}</span> de{" "}
      <span className="text-white font-bold">{totalItems}</span> totales
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage <= 1}
        className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
      >
        <span>&larr;</span>
        <span>Anterior ({ITEMS_PER_PAGE})</span>
      </button>

      {/* Selector directo de página con botón Ir y tecla Enter */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-amber-500/40 text-gray-300 font-semibold shadow">
        <span className="text-amber-400 font-bold">Página</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = parseInt(pageInput);
              if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
            }
          }}
          className="w-16 px-2 py-1 bg-reygas-dark border border-white/20 rounded-lg text-white font-mono font-black text-center focus:border-amber-400 focus:outline-none"
        />
        <span>de <strong className="text-white font-black">{totalPages}</strong></span>
        <button
          type="button"
          onClick={() => {
            const val = parseInt(pageInput);
            if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
          }}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg transition-transform hover:scale-105 shadow text-xs"
        >
          Ir
        </button>
      </div>

      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage >= totalPages}
        className="px-3.5 py-2 rounded-xl bg-reygas-surface hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-bold transition-all flex items-center gap-1.5"
      >
        <span>Siguiente ({ITEMS_PER_PAGE})</span>
        <span>&rarr;</span>
      </button>
    </div>
  </div>
)}
```

---

## 5. Badges de Estado y Filtros Rápidos

- **Filtro / Estado Activo**: `bg-amber-500 text-black font-black shadow-md border-amber-400 ring-2 ring-amber-300` o `bg-emerald-600 text-white border-emerald-500`.
- **Filtro Inactivo**: `bg-reygas-surface text-gray-300 border-white/10 hover:text-white hover:bg-white/5`.
- **Badge de Alerta / Stock Negativo**: `px-2.5 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-500/40 text-[10px] font-black`.
- **Badge de Pendiente**: `px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black`.
- **Badge de Atendido / Éxito**: `px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black`.
