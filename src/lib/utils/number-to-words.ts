/**
 * Converts numeric amounts to official Peruvian Spanish currency text
 * e.g. 80.00 -> "SON OCHENTA CON 00/100 SOLES"
 * e.g. 90.50 -> "SON NOVENTA CON 50/100 SOLES"
 * e.g. 160.00 -> "SON CIENTO SESENTA CON 00/100 SOLES"
 */
export function numberToSpanishWords(amount: number): string {
  if (isNaN(amount) || amount < 0) return "SON CERO CON 00/100 SOLES";

  const units = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const teens = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISEIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
    "VEINTE",
    "VEINTIUNO",
    "VEINTIDOS",
    "VEINTITRES",
    "VEINTICUATRO",
    "VEINTICINCO",
    "VEINTISEIS",
    "VEINTISIETE",
    "VEINTIOCHO",
    "VEINTINUEVE",
  ];
  const tens = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const hundreds = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];

  function convertGroup(n: number): string {
    let output = "";
    if (n === 100) return "CIEN";
    if (n > 99) {
      output += hundreds[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 10 && n <= 29) {
      output += teens[n - 10] + " ";
    } else if (n >= 30) {
      output += tens[Math.floor(n / 10)];
      if (n % 10 !== 0) output += " Y " + units[n % 10];
      output += " ";
    } else if (n > 0) {
      output += units[n] + " ";
    }
    return output.trim();
  }

  const integerPart = Math.floor(amount);
  const cents = Math.round((amount - integerPart) * 100);
  const centsFormatted = cents.toString().padStart(2, "0");

  if (integerPart === 0) {
    return `SON CERO CON ${centsFormatted}/100 SOLES`;
  }

  let words = "";
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    words += (millions === 1 ? "UN MILLON " : convertGroup(millions) + " MILLONES ");
  }

  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    words += (thousands === 1 ? "MIL " : convertGroup(thousands) + " MIL ");
  }

  const remainder = integerPart % 1000;
  if (remainder > 0) {
    words += convertGroup(remainder);
  }

  words = words.trim();
  return `SON ${words} CON ${centsFormatted}/100 SOLES`;
}
