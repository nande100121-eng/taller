# Reglas de Consistencia Visual y Diseño UI - ReyGas

1. **Diseño Oscuro Glassmorphic Obligatorio**:
   - Todo panel, tarjeta o contenedor debe utilizar el estilo glassmorphic de la web (`glass-panel bg-reygas-dark border border-white/10 rounded-2xl`).
   - Fondos base: `bg-reygas-dark` (`#0B0F17`), superficies: `bg-reygas-surface` (`#161E2E` o `bg-white/5`), acentos: ámbar (`bg-amber-500 text-black`) y esmeralda (`bg-emerald-600 text-white`).

2. **Ventanas Flotantes y Modales**:
   - Fondo oscurecido con desenfoque: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn`.
   - Contenedor: `glass-panel bg-reygas-dark/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl`.
   - Inputs: `bg-reygas-surface border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none`.

3. **Selector de Fecha / Calendarios**:
   - Debe ser el componente estándar unificado: flecha izquierda (`ChevronLeft`), ícono de calendario (`Calendar text-amber-400`), input de fecha nativo tipo `date` con tipografía mono, flecha derecha (`ChevronRight`) y botón **"Hoy"**.
   - Toda fecha debe gestionarse en la zona horaria de Perú (`America/Lima`) utilizando `getPeruDateString()` y `formatPeruDate()`.

4. **Paginación y Tablas**:
   - Siempre que se muestren datos paginados, implementar la barra estándar de páginas con texto resumen (`Mostrando X a Y de N`), botones `Anterior` / `Siguiente`, e input numérico para saltar a cualquier página (`Página [ ] de Total`) con botón `Ir`.
