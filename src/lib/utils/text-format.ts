/**
 * Utilidades de formateo de texto para la web ReyGas.
 * - capitalizeFirst: primera letra en mayúscula (campo de texto genérico).
 * - titleCase: primera letra mayúscula tras cada espacio (nombres de cliente).
 * - formatPlate: placa en mayúsculas con guion automático tras 3 letras,
 *   sin duplicar guiones (seguro para escáner de código de barras / OCR).
 */

export function capitalizeFirst(raw: string): string {
    if (!raw) return raw;
    // NO hacer trim(): preserva los espacios tal como se escriben (incluido el
    // espacio final). Un trim() aquí elimina el espacio en cada tecla y hace
    // que la barra espaciadora parezca "no funcionar" (se escribe todo junto).
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function titleCase(raw: string): string {
    if (!raw) return raw;
    // Se conservan los espacios exactos del usuario (sin trim ni colapso);
    // solo se capitaliza la primera letra de cada palabra.
    return raw
        .split(" ")
        .map((word) => {
            if (!word) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

/**
 * Normaliza una placa: mayúsculas, quita símbolos/espacios, y coloca un guion
 * tras las primeras 3 letras (formato ABC-123). Nunca genera guiones dobles,
 * y tolera entradas de escáner (que ya traen el guion) y OCR (que no lo trae).
 */
export function formatPlate(raw: string): string {
    if (!raw) return raw;
    const upper = raw.toUpperCase();
    // Caso especial: código de venta directa VENTA (solo letras)
    if (upper.startsWith("VENTA")) return "VENTA";
    if (upper.startsWith("VENT")) return upper.replace(/[^A-Z]/g, "").slice(0, 5);
    // Quitar todo lo que no sea letra/dígito (guiones, espacios, símbolos)
    const clean = upper.replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (clean.length > 3) {
        return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean;
}
