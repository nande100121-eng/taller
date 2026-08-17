---
name: reygas-printing
description: >
  Guía estándar para implementar cualquier tipo de impresión desde el navegador en la aplicación ReyGas.
  Cubre impresión de códigos de barras, recibos térmicos, reportes A4, tablas y cualquier contenido imprimible.
  Debe usarse siempre que se necesite agregar o modificar funcionalidad de impresión.
---

# ReyGas Printing Skill — Sistema Universal de Impresión

Este skill define las reglas, patrones y buenas prácticas para implementar **cualquier tipo de impresión** en la aplicación ReyGas desde el navegador.

---

## 1. Arquitectura de Impresión

La impresión en ReyGas sigue un patrón de **contenedor dual**:

1. **Contenido visible en pantalla** (UI interactiva, vista previa, controles).
2. **Contenido imprimible oculto** (HTML optimizado para papel, renderizado a nivel `<body>` con `ReactDOM.createPortal`).

### Regla Fundamental
> **NUNCA usar `className="hidden"` ni `display: none` en el contenedor imprimible.**
> La clase `hidden` de Tailwind aplica `display: none` que **NO puede ser anulado** por `visibility: visible` en `@media print`, ya que son propiedades CSS independientes.

---

## 2. Patrón de Contenedor Imprimible (Portal)

Todo contenido imprimible DEBE ser renderizado fuera del modal/overlay usando `ReactDOM.createPortal` directamente en `document.body`:

```tsx
import ReactDOM from "react-dom";

// Dentro del componente:
return (
  <>
    {/* Modal UI visible en pantalla */}
    <div className="fixed inset-0 z-50 ...">
      {/* Controles, vista previa, botón Imprimir */}
    </div>

    {/* Contenedor imprimible — Portal a <body> */}
    {typeof document !== "undefined" &&
      ReactDOM.createPortal(
        <div
          id="mi-print-container"
          className="reygas-print-container"
          style={{
            display: "none",
            visibility: "hidden",
            position: "fixed",
            left: "-9999px",
            top: 0,
          }}
        >
          {/* Contenido optimizado para papel */}
          <div className="reygas-print-page">
            {/* Cada página A4 */}
          </div>
        </div>,
        document.body
      )}
  </>
);
```

### Clases CSS Disponibles

| Clase CSS                  | Propósito                                    |
|----------------------------|----------------------------------------------|
| `.reygas-print-container`  | Contenedor raíz de impresión (a nivel body)  |
| `.reygas-print-page`       | Cada página individual (A4, carta, etc.)     |
| `#barcode-print-sheets`    | ID específico para hojas de código de barras |
| `.barcode-print-page`      | Página específica de etiquetas de barras     |
| `.barcode-card-print`      | Cada tarjeta/etiqueta individual             |

---

## 3. Estilos CSS para Impresión (`globals.css`)

Los estilos de `@media print` en `globals.css` implementan la siguiente estrategia:

```css
@media print {
  /* 1. Ocultar TODO excepto los contenedores de impresión */
  body > *:not(#barcode-print-sheets):not(.reygas-print-container) {
    display: none !important;
  }

  /* 2. Mostrar el contenedor de impresión */
  #barcode-print-sheets,
  .reygas-print-container {
    display: block !important;
    visibility: visible !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
  }

  /* 3. Todos los hijos deben ser visibles */
  #barcode-print-sheets *,
  .reygas-print-container * {
    visibility: visible !important;
    print-color-adjust: exact !important;
  }

  /* 4. Cada página A4 */
  .reygas-print-page,
  .barcode-print-page {
    width: 210mm !important;
    min-height: 295mm !important;
    page-break-after: always !important;
    background: #ffffff !important;
  }
}
```

### Regla de Adición de Nuevos Tipos de Impresión
Al agregar un nuevo tipo de impresión, usar la clase `.reygas-print-container` en el contenedor portal y `.reygas-print-page` para cada página. El CSS universal ya los soporta.

---

## 4. Función handlePrint()

Siempre usar `setTimeout` antes de `window.print()` para dar tiempo al navegador:

```tsx
const handlePrint = () => {
  const el = document.getElementById("mi-print-container");
  if (el) {
    // Re-render SVGs si es necesario
  }
  setTimeout(() => window.print(), 150);
};
```

---

## 5. Tipos de Impresión Soportados

### 5.1 Códigos de Barras (Etiquetas A4)
- **Componente**: `BarcodePrintModal.tsx`
- **Layout**: 8 etiquetas por hoja A4 (2 columnas x 4 filas)
- **Regla**: Cada letra inicial del producto empieza en hoja nueva

### 5.2 Recibos Térmicos
- **Componente**: `thermal-receipt-modal.tsx`
- **Layout**: Rollo térmico de 80mm

### 5.3 Reportes y Tablas
- **Clase**: `.reygas-print-container` + `.reygas-print-page`
- **Layout**: A4 portrait u horizontal

---

## 6. Checklist para Nuevas Implementaciones

- [ ] Usar `ReactDOM.createPortal(contenido, document.body)`
- [ ] NO usar `className="hidden"` — usar inline styles
- [ ] Agregar clase `.reygas-print-container` al contenedor raíz
- [ ] Agregar clase `.reygas-print-page` a cada página
- [ ] Usar `setTimeout(() => window.print(), 150)`
- [ ] Usar inline styles para layout de papel (mm, pt, cm)
- [ ] Asegurar `background: #ffffff`, `color: #000000`
- [ ] Usar `page-break-after: always` entre páginas
- [ ] Definir `@page { size: A4 portrait; margin: 0; }`
- [ ] Probar con Ctrl+P

---

## 7. Errores Comunes

| Error                          | Causa                         | Solución                                      |
|--------------------------------|-------------------------------|-----------------------------------------------|
| Hojas vacías                   | `className="hidden"`          | Usar inline display:none + portal a body      |
| SVGs no aparecen               | Elemento invisible            | Re-render en handlePrint                      |
| UI aparece al imprimir         | @media print incorrecto       | Usar body > *:not(.reygas-print-container)    |
| Contenido cortado              | Falta page-break-inside       | Agregar avoid a tarjetas                      |
| Colores no se imprimen         | Navegador omite colores       | print-color-adjust: exact                     |

---

## 8. Archivos Clave

| Archivo                                         | Rol                                    |
|--------------------------------------------------|----------------------------------------|
| `src/app/globals.css`                            | Estilos @media print universales       |
| `src/components/BarcodePrintModal.tsx`           | Impresión de códigos de barras         |
| `src/components/BarcodeSvg.tsx`                  | Componente SVG JsBarcode              |
| `src/components/caja/thermal-receipt-modal.tsx`  | Impresión de recibos térmicos          |
