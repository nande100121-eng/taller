const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'registro taller.csv');
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'workshop-csv-lookup.ts');

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.replace(/\r/g, '').split('\n');

const lookupMap = {};
const dayRecordsMap = {};

function parseDateISO(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    return year + '-' + month + '-' + day;
  }
  return dStr;
}

lines.forEach((line, idx) => {
  if (idx === 0 || !line.trim()) return;
  const cols = line.split(';');
  const rawDate = (cols[0] || '').trim();
  const dateISO = parseDateISO(rawDate);
  const rawPlate = (cols[7] || '').trim().toUpperCase();
  const plate = rawPlate.replace(/[^A-Z0-9-]/g, '');
  if (!plate && !cols[8]) return;

  const effectivePlate = plate || 'S/P';
  const receiptNum = (cols[8] || '').trim();
  const clientName = (cols[9] || '').trim();
  const clientPhone = (cols[10] || '').trim();
  const tech = (cols[11] || '').trim();
  const service = (cols[12] || '').trim();
  const parts = (cols[13] || '').trim();
  const priceRaw = (cols[14] || '').replace(/[\$S\/,\s]/g, '').trim();
  const price = parseFloat(priceRaw) || 0;
  const discountsRaw = (cols[15] || '').trim();
  const creditRaw = (cols[16] || '').replace(/[\$S\/,\s]/g, '').trim();
  const credit = parseFloat(creditRaw) || 0;
  const condition = (cols[17] || '').trim();
  const method = (cols[18] || '').trim();
  const dest = (cols[19] || '').trim();
  const receiptType = (cols[20] || '').trim();
  const rucFactura = (cols[21] || '').replace(/[^0-9]/g, '').trim();
  const quinquennial = (cols[1] || '').trim();
  const chipExpiry = (cols[2] || '').trim();
  const brand = (cols[5] || '').trim();

  const record = {
    plate: effectivePlate,
    dateISO,
    rawDate,
    receiptNumber: receiptNum,
    receiptType: receiptType || (receiptNum.startsWith('F') || (parseInt(receiptNum) < 1000 && parseInt(receiptNum) > 0) ? 'FACTURA' : 'TICKET'),
    clientName,
    clientPhone,
    technician: tech,
    service,
    parts,
    price,
    discounts: discountsRaw,
    credit,
    condition,
    method: method || (condition === 'PAGADO' ? 'Efectivo' : 'PENDIENTE'),
    destination: dest || 'EMPRESA',
    rucFactura,
    quinquennial,
    chipExpiry,
    brand
  };

  const key = effectivePlate + '_' + dateISO;
  lookupMap[key] = record;
  if (receiptNum && receiptNum !== '0') {
    lookupMap['REC_' + receiptNum + '_' + dateISO] = record;
  }

  if (dateISO) {
    if (!dayRecordsMap[dateISO]) {
      dayRecordsMap[dateISO] = [];
    }
    dayRecordsMap[dateISO].push(record);
  }
});

const fileContent = 'export interface WorkshopCSVRecord {\n' +
  '  plate: string;\n' +
  '  dateISO: string;\n' +
  '  rawDate: string;\n' +
  '  receiptNumber: string;\n' +
  '  receiptType: string;\n' +
  '  clientName: string;\n' +
  '  clientPhone: string;\n' +
  '  technician: string;\n' +
  '  service: string;\n' +
  '  parts: string;\n' +
  '  price: number;\n' +
  '  discounts?: string;\n' +
  '  credit: number;\n' +
  '  condition: string;\n' +
  '  method: string;\n' +
  '  destination: string;\n' +
  '  rucFactura: string;\n' +
  '  quinquennial: string;\n' +
  '  chipExpiry: string;\n' +
  '  brand: string;\n' +
  '}\n\n' +
  'export const WORKSHOP_CSV_LOOKUP: Record<string, WorkshopCSVRecord> = ' + JSON.stringify(lookupMap) + ';\n\n' +
  'export const WORKSHOP_DAY_RECORDS: Record<string, WorkshopCSVRecord[]> = ' + JSON.stringify(dayRecordsMap) + ';\n\n' +
  'export function getWorkshopCSVRecord(plate: string, dateISO?: string, receiptNumber?: string): WorkshopCSVRecord | undefined {\n' +
  '  if (receiptNumber && receiptNumber !== "0" && dateISO) {\n' +
  '    const cleanDate = dateISO.slice(0, 10);\n' +
  '    const exactRec = WORKSHOP_CSV_LOOKUP["REC_" + receiptNumber + "_" + cleanDate];\n' +
  '    if (exactRec) return exactRec;\n' +
  '  }\n' +
  '  if (!plate) return undefined;\n' +
  '  const cleanPlate = plate.toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");\n' +
  '  if (dateISO) {\n' +
  '    const cleanDate = dateISO.slice(0, 10);\n' +
  '    const exact = WORKSHOP_CSV_LOOKUP[cleanPlate + "_" + cleanDate];\n' +
  '    if (exact) return exact;\n' +
  '  }\n' +
  '  for (const k in WORKSHOP_CSV_LOOKUP) {\n' +
  '    if (k.startsWith(cleanPlate + "_")) return WORKSHOP_CSV_LOOKUP[k];\n' +
  '  }\n' +
  '  return undefined;\n' +
  '}\n\n' +
  'export function getWorkshopDayRecords(dateISO: string): WorkshopCSVRecord[] {\n' +
  '  if (!dateISO) return [];\n' +
  '  const cleanDate = dateISO.slice(0, 10);\n' +
  '  return WORKSHOP_DAY_RECORDS[cleanDate] || [];\n' +
  '}\n';

fs.writeFileSync(outputPath, fileContent, 'utf8');
console.log('Successfully written', outputPath, 'with lookup keys:', Object.keys(lookupMap).length, 'and days:', Object.keys(dayRecordsMap).length);
