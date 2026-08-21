// Utilidades del catálogo de servicios ReyGas.
// isCertificationService: identifica si un servicio del catálogo es de CERTIFICACIÓN
// (se usa igual en Tablas Maestras y en Taller para el kit de instalaciones).

export function isCertificationService(s: { name: string; category?: string }): boolean {
  const cat = (s.category || "").toLowerCase().trim();
  const name = s.name.toLowerCase();
  return (
    cat === "certificación" ||
    cat === "certificacion" ||
    name.includes("certificado") ||
    name.includes("certificacion") ||
    name.includes("anual gnv") ||
    name.includes("anual glp") ||
    name.includes("hidrostática") ||
    name.includes("hidrostatica") ||
    name.includes("chip")
  );
}
