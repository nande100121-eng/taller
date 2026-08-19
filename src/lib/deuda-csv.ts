// Deuda (crédito) de la empresa al 17/08/2026 — FUENTE: DEUDA 17.08.26.csv (archivo del usuario).
// Esta tabla es la referencia oficial de cuentas por cobrar: placa, nº de boleta y saldo.
// Se usa para CORREGIR la placa y el nº de comprobante que muestran los pendientes en la web
// (los montos ya coinciden: S/ 7,125.00 en 39 boletas).
export interface DebtCsvEntry {
  boleta: string;
  fecha: string;
  nombre: string;
  placa: string;
  servicio: string;
  total: number;
  adelanto: number;
  saldo: number;
}

export const DEBT_CSV_2026_08_17: DebtCsvEntry[] = [
  {
    "boleta": "441",
    "fecha": "15/01/2026",
    "nombre": "ROSA PANTOJA",
    "placa": "BCD-846",
    "servicio": "CALIBRACIÓN + 1 INYECTOR 0120 (AUTORIZADO FRANCO)",
    "total": 130,
    "adelanto": 10,
    "saldo": 120
  },
  {
    "boleta": "991",
    "fecha": "12/02/2026",
    "nombre": "ERNESTO YAMIL BAZALAR OYOLA - 44577709",
    "placa": "ATN-067",
    "servicio": "DUPLICADO INICIAL GNV",
    "total": 120,
    "adelanto": 0,
    "saldo": 120
  },
  {
    "boleta": "1372",
    "fecha": "4/03/2026",
    "nombre": "CARLOS ANTONIO BALAREZO COCA - 72804408",
    "placa": "BTH-583",
    "servicio": "1 REDUCTOR +1 TOMA DE CARGA+ SERVICIO DE INSTALACIÓN",
    "total": 600,
    "adelanto": 500,
    "saldo": 100
  },
  {
    "boleta": "1747",
    "fecha": "24/03/2026",
    "nombre": "Edson Cespedes",
    "placa": "AHK-161",
    "servicio": "2 BOBINAS KIA PICANTO 0400(120 C/U)",
    "total": 240,
    "adelanto": 160,
    "saldo": 80
  },
  {
    "boleta": "2035",
    "fecha": "7/04/2026",
    "nombre": "ASUNCION ELEUTERIO BALABARCA ORTIZ - 31921979",
    "placa": "D9B-201",
    "servicio": "4 BUJIAS BKR5E(50)+1 CAÑA MEDIANA BOCA CHICA(20)+MANT.INYECTORES DE GASOLINA+1VAVULA PSV CHANGAN(35) (PENDIENTE 35)",
    "total": 155,
    "adelanto": 120,
    "saldo": 35
  },
  {
    "boleta": "2060",
    "fecha": "7/04/2026",
    "nombre": "JIMMY ALAN PATRICIO ANCAJIMA - 40920517",
    "placa": "BEN-371",
    "servicio": "MANT.GENERAL+FILTRO DE GAS+BOBINA DE REDUCTOR CON TERMINALES+1/2M MANG.GAS(10)+1/2M MANG.VACÍO(10)+1/2M MANG.AGUA GNV(10)+4BUJIAS LZK(80)+4 CAÑAS CHEVROLET SAIL(20C/U)",
    "total": 430,
    "adelanto": 200,
    "saldo": 230
  },
  {
    "boleta": "2289",
    "fecha": "17/04/2026",
    "nombre": "LUIS CARQUIN - PUBLICIDAD",
    "placa": "CBX-224",
    "servicio": "4 BUJIAS BKR5E(50)+2 CAÑAS GRANDE BOCA ANCHA+1 REDUCTOR 5TA GNV+1/2M MANGUERA AGUA GNV",
    "total": 400,
    "adelanto": 300,
    "saldo": 100
  },
  {
    "boleta": "2298",
    "fecha": "17/04/2026",
    "nombre": "JAIME MENSOZZA REYES",
    "placa": "ATF-452",
    "servicio": "CHIP POR DETERIORO",
    "total": 180,
    "adelanto": 0,
    "saldo": 180
  },
  {
    "boleta": "2333",
    "fecha": "20/04/2026",
    "nombre": "OSCARALCIDES ROJAS ALDAVE - 43618762",
    "placa": "F2H-141",
    "servicio": "COMPUTADORA 2DA(QUEDARÁ PENDIENTE 50SOLES PARA MÑANA)",
    "total": 250,
    "adelanto": 200,
    "saldo": 50
  },
  {
    "boleta": "2444",
    "fecha": "24/04/2026",
    "nombre": "JAIME MENSOZZA REYES",
    "placa": "A6Y-239",
    "servicio": "CHIP POR DETERIORO (JAIME RESPONSABLE DE PAGO)",
    "total": 180,
    "adelanto": 0,
    "saldo": 180
  },
  {
    "boleta": "2778",
    "fecha": "13/05/2026",
    "nombre": "ELAY APONTE MENDOZA",
    "placa": "A1G-201",
    "servicio": "SERVICIO(REDUCTOR DE SEGUNDA)",
    "total": 250,
    "adelanto": 0,
    "saldo": 250
  },
  {
    "boleta": "3330",
    "fecha": "8/06/2026",
    "nombre": "Edson Cespedes",
    "placa": "AHK-161",
    "servicio": "PORTA FUSIBLE",
    "total": 15,
    "adelanto": 0,
    "saldo": 15
  },
  {
    "boleta": "3542",
    "fecha": "19/06/2026",
    "nombre": "FELIPE MORALES",
    "placa": "F6Q-444",
    "servicio": "1 BOBINA DE ENCENDIDO 02258+4 BUJIAS 18855-10060",
    "total": 220,
    "adelanto": 70,
    "saldo": 150
  },
  {
    "boleta": "3549",
    "fecha": "19/06/2026",
    "nombre": "FELIPE MORALES",
    "placa": "ATK-315",
    "servicio": "PRUEBA QUINQUENAL",
    "total": 350,
    "adelanto": 0,
    "saldo": 350
  },
  {
    "boleta": "3550",
    "fecha": "19/06/2026",
    "nombre": "RENZO FIESTAS",
    "placa": "BCD-846",
    "servicio": "BOBINA DE ENCENDIDO 0074+4 BUJÍAS LZK",
    "total": 210,
    "adelanto": 110,
    "saldo": 100
  },
  {
    "boleta": "3570",
    "fecha": "22/06/2026",
    "nombre": "FELIZ ARMANDO ROJAS",
    "placa": "BBF-936",
    "servicio": "COMPUTADORA AEB",
    "total": 450,
    "adelanto": 400,
    "saldo": 50
  },
  {
    "boleta": "3653",
    "fecha": "25/06/2026",
    "nombre": "BRAVO VALENCIA NICHER",
    "placa": "ABP-062",
    "servicio": "MONTADO DE TANQUE+VALVULA GNV",
    "total": 180,
    "adelanto": 0,
    "saldo": 180
  },
  {
    "boleta": "3676",
    "fecha": "26/06/2026",
    "nombre": "MOISES GUITIERRES",
    "placa": "C2T-684",
    "servicio": "1 TANQUE DE 55 LT GNV",
    "total": 1200,
    "adelanto": 400,
    "saldo": 800
  },
  {
    "boleta": "3967",
    "fecha": "11/07/2026",
    "nombre": "OSCAR OYOLA",
    "placa": "F7V-220",
    "servicio": "4 BUJÍAS BKR5E",
    "total": 50,
    "adelanto": 0,
    "saldo": 50
  },
  {
    "boleta": "3996",
    "fecha": "14/07/2026",
    "nombre": "YAMILE VENTONCILLA",
    "placa": "C3X-239",
    "servicio": "ELECTROVALVULA DE GASOLNA",
    "total": 60,
    "adelanto": 0,
    "saldo": 60
  },
  {
    "boleta": "4073",
    "fecha": "17/07/2026",
    "nombre": "JUNIOR CARRERA",
    "placa": "ARY-343",
    "servicio": "SENSOR DE LEVAS 96325868+4 BUJÍAS DCPR",
    "total": 170,
    "adelanto": 80,
    "saldo": 90
  },
  {
    "boleta": "4074",
    "fecha": "17/07/2026",
    "nombre": "JUNIOR CARRERA",
    "placa": "ARY-343",
    "servicio": "PRUEBA QUINQUENAL",
    "total": 350,
    "adelanto": 0,
    "saldo": 350
  },
  {
    "boleta": "4205",
    "fecha": "24/07/2026",
    "nombre": "EDGAR MORALES",
    "placa": "BFZ-596",
    "servicio": "SERVICIO+2 BOBINAS DE ENCENDIDO 04110(130C/U)",
    "total": 260,
    "adelanto": 0,
    "saldo": 260
  },
  {
    "boleta": "4316",
    "fecha": "1/08/2026",
    "nombre": "OSCAR OYOLA",
    "placa": "F7V-220",
    "servicio": "ANUAL GNV",
    "total": 80,
    "adelanto": 30,
    "saldo": 50
  },
  {
    "boleta": "4339",
    "fecha": "3/08/2026",
    "nombre": "EDGAR TORRES TORRES",
    "placa": "BEK-790",
    "servicio": "MANT.OBTURADOR+2 UNIONES 3/4+1/2M MANG.AGUA",
    "total": 90,
    "adelanto": 0,
    "saldo": 90
  },
  {
    "boleta": "4395",
    "fecha": "6/08/2026",
    "nombre": "JULIO BOZA",
    "placa": "F3W-477",
    "servicio": "BOBINA DE IMPORTACION TOYOTA YARIS",
    "total": 150,
    "adelanto": 0,
    "saldo": 150
  },
  {
    "boleta": "4411",
    "fecha": "7/08/2026",
    "nombre": "VICTOR VIRU",
    "placa": "AZX-546",
    "servicio": "MANTENIMIENTO GENERAL+FILTRO DE GAS+2T DE AGUA 19X8X19+1M MANG.AGUA GNV+4 BUJÍAS LZK+VALVULA PSV 4070+2 CONECTOR DDE INYECTOR DE GASOLINA CHEVROLET-SAIL",
    "total": 375,
    "adelanto": 100,
    "saldo": 275
  },
  {
    "boleta": "4459",
    "fecha": "10/08/2026",
    "nombre": "JUAN OMAR ASABACHE BAZALAR",
    "placa": "BBN-282",
    "servicio": "KIT DE ACCESORIOS RAIL",
    "total": 120,
    "adelanto": 60,
    "saldo": 60
  },
  {
    "boleta": "4462",
    "fecha": "10/08/2026",
    "nombre": "EYLIN JULCA - TRANSPORTE Y SERVICIOS J Y A - 20606158204",
    "placa": "BWF-101",
    "servicio": "ANUAL GNV",
    "total": 80,
    "adelanto": 0,
    "saldo": 80
  },
  {
    "boleta": "4463",
    "fecha": "10/08/2026",
    "nombre": "JUAN OMAR ASABACHE BAZALAR",
    "placa": "BBN-282",
    "servicio": "1 CÑA NISSAN QG",
    "total": 20,
    "adelanto": 0,
    "saldo": 20
  },
  {
    "boleta": "4467",
    "fecha": "10/08/2026",
    "nombre": "IVAN PURGA",
    "placa": "BJP-144",
    "servicio": "CHIP POR DETERIORO",
    "total": 180,
    "adelanto": 0,
    "saldo": 180
  },
  {
    "boleta": "4469",
    "fecha": "10/08/2026",
    "nombre": "LENIN COTA",
    "placa": "B0Q-614",
    "servicio": "SERVICIO(RIEL RAIL SALIO EL DÍA 20-6)",
    "total": 280,
    "adelanto": 200,
    "saldo": 80
  },
  {
    "boleta": "4474",
    "fecha": "11/08/2026",
    "nombre": "JAVIER MORALES",
    "placa": "CFU-232",
    "servicio": "CALIBRACIÓN",
    "total": 20,
    "adelanto": 0,
    "saldo": 20
  },
  {
    "boleta": "4483",
    "fecha": "11/08/2026",
    "nombre": "EYLIN JULCA - TRANSPORTE Y SERVICIOS J Y A - 20606158204",
    "placa": "CVA-350",
    "servicio": "MANTENIMIENTO GENERAL+FILTRO DE GAS 14X14+4 BUJÍAS LFR5A",
    "total": 240,
    "adelanto": 0,
    "saldo": 240
  },
  {
    "boleta": "4491",
    "fecha": "11/08/2026",
    "nombre": "BRANDON PERALTA",
    "placa": "C4J-331",
    "servicio": "REINSTALACIÓN GNV A GLP",
    "total": 1000,
    "adelanto": 300,
    "saldo": 700
  },
  {
    "boleta": "4496",
    "fecha": "12/08/2026",
    "nombre": "JOEL MAGUIÑA",
    "placa": "AHD-442",
    "servicio": "PRUEBA QUINQUENAL+ANUAL GNV",
    "total": 730,
    "adelanto": 330,
    "saldo": 400
  },
  {
    "boleta": "4504",
    "fecha": "12/08/2026",
    "nombre": "FREDY RONALD ESCALANTE TELLO",
    "placa": "F2B-061",
    "servicio": "4 BOBINAS DE ENCENDIDO 2E000 ALT",
    "total": 360,
    "adelanto": 0,
    "saldo": 360
  },
  {
    "boleta": "4552",
    "fecha": "14/08/2026",
    "nombre": "FREDY RONALD ESCALANTE TELLO",
    "placa": "F2B-061",
    "servicio": "MANTENIMIENTO GENERAL+FILTRO DE GAS+BOBINA REDUCTOR CONECTOR+FILTRO REDUCTOR+1 UNIÓN 3/4+1M MANG.GAS",
    "total": 330,
    "adelanto": 0,
    "saldo": 330
  },
  {
    "boleta": "4556",
    "fecha": "14/08/2026",
    "nombre": "BRAYAN SUSANIBAR",
    "placa": "C7M-456",
    "servicio": "4 BUJÍAS FXE20HR",
    "total": 190,
    "adelanto": 0,
    "saldo": 190
  }
];

export const DEBT_CSV_BY_RECEIPT: Record<string, DebtCsvEntry> = {};
export const DEBT_CSV_BY_PLATE: Record<string, DebtCsvEntry[]> = {};
for (const e of DEBT_CSV_2026_08_17) {
  DEBT_CSV_BY_RECEIPT[e.boleta] = e;
  const p = e.placa.replace(/[^A-Z0-9]/g, "");
  (DEBT_CSV_BY_PLATE[p] = DEBT_CSV_BY_PLATE[p] || []).push(e);
}

// Encuentra la deuda del CSV que corresponde a una factura pendiente de la web.
// 1º por nº de comprobante (normalizado a dígitos); 2º por placa + saldo (para
// comprobantes mal digitados, p.ej. B0Q-614 que figura como TK01-00004588 en la web).
export function matchDebtCsvByInvoice(inv: any, balance: number): DebtCsvEntry | null {
  const rn = String(inv?.receipt_number || "").replace(/\D/g, "");
  if (DEBT_CSV_BY_RECEIPT[rn]) return DEBT_CSV_BY_RECEIPT[rn];
  const plate = String(inv?.vehicle_plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const plateEntries = DEBT_CSV_BY_PLATE[plate] || [];
  if (plateEntries.length === 1) {
    const [e] = plateEntries;
    if (Math.abs(e.saldo - balance) <= 0.01) return e;
  }
  const bySaldo = plateEntries.filter((e) => Math.abs(e.saldo - balance) <= 0.01);
  if (bySaldo.length === 1) return bySaldo[0];
  return null;
}