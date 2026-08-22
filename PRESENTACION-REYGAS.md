# ReyGas ERP Web
## Presentacion a Gerencia - Implementacion en el Taller

> Sistema de gestion integral en la nube, con control en tiempo real de Porteria, Taller, Almacen, Caja y Certificaciones.

---

## 1. Que es ReyGas ERP Web

- **Un solo sistema para todo el taller**: reemplaza el cuaderno y el papel por un registro digital centralizado en la nube.
- **Hecho a la medida del taller**: sigue el flujo real (Porteria recibe, Taller repara, Almacen despacha, Caja cobra, Certificaciones emite).
- **Sin instalacion**: se abre en el navegador de cualquier tablet/celular/PC con internet.
- **Seguro y respaldado**: toda la informacion se respalda automaticamente en la nube.

## 2. Como funciona

| Componente | Detalle |
|---|---|
| Nube central (Supabase) | Una sola base de datos para todas las estaciones |
| Tiempo real | Lo que registra una estacion aparece al instante en las demas |
| Tablets y hardware | Optimizado para Tablet Industrial Chainway P80 y lector SEISA |
| Respaldo automatico | Tabla principal + copia de seguridad + sincronizacion en vivo |

## 3. Las 11 estaciones

1. **Porteria** - ingreso de vehiculos y patios del dia
2. **Recepcion** - citas y confirmaciones
3. **Taller** - ordenes de trabajo, mecanicos, servicios y repuestos
4. **Almacen** - inventario y despacho de repuestos
5. **Caja** - cobros, abonos, saldos y comprobantes (ticket/boleta/factura)
6. **Certificaciones** - inspeccion GNV, chip/quinquenal y emision
7. **Asistencia** - entrada/salida del personal
8. **Consultas** - busqueda rapida por placa/fecha/cliente
9. **Reportes** - indicadores del dia, mes y ventas
10. **Tabla Maestra** - personal, permisos, servicios y precios
11. **Configuracion** - ajustes y log del sistema

## 4. Flujo operativo completo

Porteria -> Recepcion -> Taller -> Almacen -> Caja -> Certificaciones -> Entrega

- Todo queda registrado (cada paso genera su card e historial)
- Nada se pierde (el vehiculo no sale sin pago o sin certificacion)
- Todo se ve en tiempo real entre estaciones

### Ejemplo de atencion tipica
1. **Porteria**: se digita la placa y se abre la card del dia (si tiene cita, aparece sola)
2. **Taller**: el mecanico abre la OT, marca el servicio (ej. Anual GNV) y los repuestos
3. **Almacen**: despacha repuestos y confirma stock
4. **Caja**: cobra el total y emite el comprobante
5. **Certificaciones**: emite la certificacion vigente y la envia a Caja si aplica
6. **Entrega**: con pago registrado, el vehiculo sale con historial listo

## 5. Beneficios para gerencia

- Orden y control total (que entro, que se hizo, cuanto costo, cuando salio)
- Menos errores y perdidas (cobro automatico, salidas sin pagar eliminadas)
- Informacion al instante (vehiculos en patio, facturacion del dia, certificaciones pendientes)
- Historial del cliente por placa (servicios, saldos, vencimientos chip/quinquenal)
- Responsabilidades claras (permisos y trazabilidad por usuario)
- Respaldo y continuidad (nube, consultable desde cualquier equipo)

## 6. Mejoras administrativas recomendadas

1. **Responsables por estacion**: un encargado por area (el sistema ya soporta permisos por persona)
2. **Procedimiento estandar**: toda salida requiere pago o autorizacion registrada
3. **Politica de creditos**: montos maximos, plazos y responsables de cobranza
4. **Inventario con conteo ciclico**: validar stock semanal contra lo registrado
5. **Capacitacion del personal**: 1 hora por estacion + una semana de acompanamiento
6. **Indicadores semanales**: vehiculos, facturacion, certificaciones y saldos pendientes
7. **Manual de procesos impreso** en cada estacion
8. **Stock minimo y reposicion** de repuestos criticos

## 7. Mejoras fisicas / infraestructura

1. **Red WiFi industrial** con repetidores en todas las areas (prioridad #1)
2. **Una tablet por estacion** (Chainway P80) con soporte de pared
3. **Lector de codigos SEISA** en Almacen y Caja
4. **Impresora termica** de comprobantes en Caja
5. **UPS / estabilizador** para router y estaciones
6. **Ordenamiento 5S**: estanterias numeradas, repuestos etiquetados
7. **Señalizacion y parqueo numerado** para ubicar vehiculos al instante
8. **Punto de carga por estacion y camaras** en areas de dinero/almacen

## 8. Plan de implementacion

| Fase | Periodo | Actividades |
|---|---|---|
| 1. Preparacion | Semana 1 | Red WiFi, tabletas, personal/permisos, capacitacion inicial |
| 2. Puesta en marcha | Semanas 2-3 | Porteria+Taller, luego Almacen+Caja, luego Certificaciones+Asistencia, acompanamiento |
| 3. Estabilizacion | Semanas 4-6 | Ajustes, saldos e inventario contra sistema, comprobantes |
| 4. Gestion | En adelante | Reunion semanal de indicadores y mejora continua |

## 9. Cierre

El sistema ya es **funcional de punta a punta**. Con las mejoras administrativas y fisicas propuestas, el taller gana orden, control y datos para decidir.
