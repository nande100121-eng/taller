---
name: reygas-reports-system
description: >
  Guía y estándar integral para diseñar, estructurar e implementar reportes e informes ejecutivos y operativos
  para todas las áreas de la web ReyGas (Almacén, Caja, Taller, Certificaciones, Portería, Asistencia y Gerencia).
  Debe utilizarse siempre que se cree, modifique o estandarice cualquier reporte en la aplicación.
---

# ReyGas Reports System — Estándar Universal de Reportes e Informes

Este documento define las reglas de diseño, arquitectura técnica, narrativa ejecutiva y formato de impresión para todos los **Reportes e Informes Gerenciales y Operativos** del ecosistema ReyGas.

---

## 1. Filosofía de Reportes: "Comprensión Inmediata y Ejecutiva"

Todo reporte en ReyGas debe cumplir con tres principios obligatorios:

1. **Ultra-Claro y Sin Rodeos:** La gerencia o cualquier auditor debe entender en 5 segundos el estado del área sin necesidad de descifrar fórmulas complejas.
2. **Narrativa Ejecutiva Automática:** Cada reporte debe incluir un bloque de resumen redactado en lenguaje natural que sintetice los números clave del día/periodo.
3. **Semáforo Visual de Alertas:** Clasificación directa por colores:
   - 🟢 **Verde / Óptimo:** Todo en orden, metas cumplidas o stock suficiente.
   - 🟡 **Amarillo / Alerta:** Atención requerida (ej. stock bajo mínimo, pagos pendientes, demoras leves).
   - 🔴 **Rojo / Crítico:** Acción inmediata requerida (ej. repuesto agotado en 0, descuadre de caja, vehículo varado).

---

## 2. Mapa de Reportes por Áreas de la Web

| Área / Módulo | Nombre del Reporte | Métricas y Contenido Clave |
|---|---|---|
| **📦 Almacén & Logística** | *Informe Diario de Almacén* | Stock físico total, valorización en S/, compras/ingresos del día, repuestos despachados a vehículos en taller, semáforo de reposición urgente (Stock 0), herramientas prestadas. |
| **💰 Caja & Finanzas** | *Cuadre y Cierre Diario de Caja* | Total recaudado, desglose por método (Efectivo, Yape, Transferencia, POS, Crédito), ingresos de Taller vs Certificaciones, egresos/gastos, arqueo físico y saldo neto. |
| **🚗 Taller & Conversiones** | *Informe de Productividad de Taller* | Autos atendidos por placa, órdenes completadas vs en proceso, repuestos instalados por auto, productividad y rendimiento por mecánico/técnico. |
| **📜 Certificaciones GNV/GLP** | *Reporte de Emisión de Certificados* | Certificados anuales GNV, GLP y Pruebas Hidrostáticas emitidos, seriales de cilindros, códigos de chip, cobros por entidad certificadora y vencimientos. |
| **🚪 Portería & Recepción** | *Control de Tránsito y Patio* | Flujo de ingreso y salida vehicular, registro de placas, kilometraje, inspección de inventario de cabina/tanque y tiempo de permanencia en taller. |
| **⏱️ Asistencia & Personal** | *Consolidado de Asistencia y Horas* | Asistencia diaria, marcas de entrada/salida, cálculo de tardanzas, horas efectivas trabajadas y permisos por técnico. |
| **👔 Gerencia General** | *Dashboard Ejecutivo Consolidado* | Visión 360° del negocio: Facturación total, margen operativo, valorización de inventario, cuentas por cobrar y alertas críticas de todas las estaciones. |

---

## 3. Estructura Estándar de la Interfaz del Reporte (UI)

Cada módulo de reporte debe implementar la siguiente anatomía de componentes:

### 3.1 Cabecera de Control y Navegación
- **Selector de Fechas Universal:**
  ```tsx
  import { getPeruDateString, formatPeruDate } from "@/lib/utils/date-utils";

  <div className="flex items-center bg-black/60 rounded-xl border border-white/15 p-1">
    <button onClick={() => changeDate(-1)}><ChevronLeft className="w-4 h-4" /></button>
    <Calendar className="w-4 h-4 text-amber-400" />
    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
    <button onClick={() => changeDate(1)}><ChevronRight className="w-4 h-4" /></button>
    {!isToday && <button onClick={() => setSelectedDate(getPeruDateString())}>Hoy</button>}
  </div>
  ```
- **Botón de Acción Principal:** `🖨️ Imprimir / PDF A4` (Estilo dorado con sombra `shadow-amber-500/25`).

### 3.2 Matriz de KPIs Ejecutivos (Tarjetas Visuales)
Grid responsivo (2 a 6 columnas) con:
- Título en mayúsculas con ícono correspondiente (`LucideIcon`).
- Número principal grande en tipografía monoespaciada (`font-mono font-black text-xl`).
- Leyenda descriptiva del indicador.

### 3.3 Bloque de Narrativa Ejecutiva
Recuadro con gradiente sutil y borde dorado:
```tsx
<div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-black/40 to-emerald-500/10 border border-amber-500/30 space-y-3">
  <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase">
    <Sparkles className="w-5 h-5" />
    <span>Resumen Ejecutivo para Gerencia</span>
  </div>
  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium">
    Al corte del día <strong>{formatPeruDate(selectedDate)}</strong>...
  </p>
</div>
```

### 3.4 Pestañas / Tablas de Detalle Operativo
Tablas con encabezados oscuros, fuentes legibles, badges de estado redondeados y alineación numérica a la derecha para montos en soles.

### 3.5 Metadatos y Observaciones
- **Responsable que emite:** Nombre y cargo del usuario/técnico.
- **Destinatario:** Gerencia General o Directorio.
- **Área de Texto de Observaciones:** Campo libre donde el responsable puede anotar incidencias o justificaciones antes de imprimir.

---

## 4. Estándar de Impresión y Exportación PDF (A4 Formal)

Todo reporte DEBE integrarse con la skill `reygas-printing` (`ReactDOM.createPortal` directo a `document.body`):

```tsx
import ReactDOM from "react-dom";

{typeof document !== "undefined" &&
  ReactDOM.createPortal(
    <div
      id="nombre-reporte-print"
      className="reygas-print-container"
      style={{
        display: "none",
        visibility: "hidden",
        position: "fixed",
        left: "-9999px",
        top: 0,
      }}
    >
      <div className="reygas-print-page" style={{ fontFamily: "Arial, sans-serif", color: "#000000", padding: "12mm" }}>
        
        {/* 1. Membrete Oficial ReyGas */}
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2.5px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "900" }}>REYGAS AUTOGAS EQUIPMENT E.I.R.L.</div>
            <div style={{ fontSize: "10px", color: "#333" }}>RUC: 20608557341 | TALLER DE CONVERSIÓN & MANTENIMIENTO GNV / GLP</div>
            <div style={{ fontSize: "9px", color: "#555" }}>Av. Separadora Industrial Nro. 647, Ate, Lima | Central: (01) 987-654-321</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", fontWeight: "900", background: "#f0f0f0", border: "1.5px solid #000", padding: "4px 8px", borderRadius: "4px" }}>
              [TÍTULO DEL REPORTE]
            </div>
            <div style={{ fontSize: "9.5px", fontWeight: "bold", marginTop: "4px" }}>
              FECHA: {formatPeruDate(selectedDate)}
            </div>
          </div>
        </div>

        {/* 2. Resumen de Métricas en Cajas */}
        {/* 3. Tablas de Detalle con Bordes Claros */}
        {/* 4. Observaciones del Responsable */}

        {/* 5. Bloque de Firmas Obligatorio */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", marginTop: "24px", textAlign: "center" }}>
          <div>
            <div style={{ borderTop: "1.5px solid #000", paddingTop: "5px", fontSize: "10px", fontWeight: "bold" }}>
              {responsibleName}
            </div>
            <div style={{ fontSize: "8.5px", color: "#555" }}>RESPONSABLE DEL ÁREA</div>
          </div>
          <div>
            <div style={{ borderTop: "1.5px solid #000", paddingTop: "5px", fontSize: "10px", fontWeight: "bold" }}>
              {managerName}
            </div>
            <div style={{ fontSize: "8.5px", color: "#555" }}>V°B° GERENCIA GENERAL</div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )}
```

---

## 5. Reglas de Negocio & Supabase Cloud First

1. **Sin Datos Ficticios / Mock:** Todos los cálculos se deben realizar sobre los estados reales sincronizados con Supabase (`inventory_items`, `work_orders`, `invoices`, `vehicles`, `technicians`, `tool_loans`, `attendance_logs`).
2. **Actualización en Tiempo Real:** Al registrar una venta, salida de material, nuevo ingreso o certificación, los cálculos del reporte deben refrescarse instantáneamente sin recargar la página gracias a `broadcastRealtimeChange`.
3. **Zona Horaria Perú:** Las fechas, horas de corte y formateos deben utilizar siempre las utilidades de `date-utils.ts` (`getPeruDateString()`, `formatPeruDate()`).

---

## 6. Checklist para Nuevos Reportes

- [ ] ¿Tiene selector de fecha estándar Perú (`<`, `>`, calendario, `Hoy`)?
- [ ] ¿Incluye matriz de KPIs con tipografía `font-mono` para valores y montos?
- [ ] ¿Tiene el bloque de **Resumen Ejecutivo Narrativo** redactado para gerencia?
- [ ] ¿Aplica el **Semáforo de Colores** (Verde / Amarillo / Rojo)?
- [ ] ¿Tiene el contenedor de impresión A4 formal con membrete y firmas (`reygas-printing`)?
- [ ] ¿Se alimenta 100% de los datos de Supabase en tiempo real?
- [ ] ¿Cuenta con un botón visible y distinguible en la cabecera del módulo correspondiente?
