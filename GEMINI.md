# ReyGas Workspace Rules & Guidelines

- **UI Design System**: All UI components, floating windows/modals, calendar/date pickers, paginated tables, buttons, and badges must strictly follow the dark glassmorphic ReyGas design system (`.agents/skills/reygas-ui-design-system/SKILL.md`).
- **Unified Calendars & Dates**: Always use the standard date navigator (`ChevronLeft`, `Calendar`, `<input type="date">`, `ChevronRight`, `Hoy`) and Peru timezone helpers (`getPeruDateString()`, `formatPeruDate()`).
- **Pagination & Modals**: Always use standard modal glass panels (`fixed inset-0 bg-black/80 backdrop-blur-sm` + `glass-panel rounded-3xl`) and standard page jump bars (`Página [input] de [totalPages]`).
- **Supabase Cloud First**: All persistence must sync with Supabase and never invent local placeholder data.
- **Executive Reports System**: All daily/periodic reports for any area of the application must strictly follow the ReyGas Reports System standard (`.agents/skills/reygas-reports-system/SKILL.md`) with executive narrative, color-coded criticality semaphore, and formal A4 printable layout with signatures.
- **Performance & Hardware Optimization**: Code must strictly adhere to `.agents/skills/reygas-performance-cloud-hardware/SKILL.md` — ensuring lightning-fast touch response on the workshop's Chainway P80 rugged tablet, zero aggressive interval polling during user editing, and instantaneous Realtime event-driven Supabase sync.
