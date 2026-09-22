// Prueba de src/lib/members-template.ts:  node scripts/test-members-template.mts
import assert from 'node:assert';
import * as XLSX from 'xlsx';
import { buildImportPlan, buildTemplateWorkbook, parseExpiry, parseTemplate } from '../src/lib/members-template.ts';

const existing = [
    { IdSocio: 10, Codigo: 'CC10', Nombre: 'JUAN' },
    { IdSocio: 11, Codigo: 'CC11', Nombre: 'ANA' }
];

const toBuffer = (aoa: unknown[][]): Buffer => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), 'Socios');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

// 1. La plantilla que se descarga se puede volver a leer sin perder columnas.
const template = parseTemplate(buildTemplateWorkbook('Malibu', true));
assert.deepStrictEqual(template.missing, [], 'la plantilla vacia no debe tener columnas faltantes');
assert.strictEqual(template.rows.length, 0, 'la plantilla vacia no trae renglones');

// 2. Encabezados con acentos, mayusculas y orden distinto.
const headers = ['Código Socio', 'IdSocio', 'NOMBRE SOCIO', 'Teléfono', 'Correo electrónico', 'Fecha Vencimiento'];
const rows: unknown[][] = [
    headers,
    ['', 10, 'JUAN PEREZ', '8180001111', 'juan@mail.com', '2026-12-31'],   // 2 actualiza
    ['NEW1', '', 'MARIA LOPEZ', '', '', new Date(2027, 0, 15)],            // 3 alta con Date
    ['', '', '', '', '', ''],                                              // (vacio, se ignora)
    ['', 99, 'NO EXISTE', '', '', ''],                                     // 5 error: no existe
    ['', '', '', '8181112222', '', ''],                                    // 6 error: falta nombre
    ['', 11, '', '', 'correo-malo', ''],                                   // 7 error: correo
    ['CC10', '', 'PEDRO', '', '', ''],                                     // 8 error: codigo ocupado
    ['', 11, '', '', '', ''],                                              // 9 sin cambios
    ['NEW1', '', 'OTRO', '', '', ''],                                      // 10 error: codigo repetido
    ['', 10, 'OTRO JUAN', '', '', ''],                                     // 11 error: socio repetido
    ['', '', 'FECHA MALA', '', '', 'ayer'],                                // 12 error: fecha
    ['', '', 'FECHA DDMM', '', '', '05/03/2027'],                          // 13 alta
    ['', '', 'FECHA EXCEL', '', '', 46000]                                 // 14 alta con serial
];

const parsed = parseTemplate(toBuffer(rows));
assert.deepStrictEqual(parsed.missing, [], 'debe reconocer encabezados con acentos y en otro orden');
assert.strictEqual(parsed.rows.length, 12, `renglones con datos: ${parsed.rows.length}`);

const plan = buildImportPlan(parsed.rows, existing);
const byLine = new Map(plan.rows.map((row) => [row.line, row]));

assert.strictEqual(byLine.get(2)!.action, 'update');
assert.strictEqual(byLine.get(2)!.vencimiento, '2026-12-31 00:00:00');
assert.strictEqual(byLine.get(3)!.action, 'create');
assert.strictEqual(byLine.get(3)!.vencimiento, '2027-01-15 00:00:00');
assert.strictEqual(byLine.get(5)!.action, 'error');
assert.match(byLine.get(5)!.message, /no existe/);
assert.match(byLine.get(6)!.message, /falta el nombre/);
assert.match(byLine.get(7)!.message, /correo/);
assert.match(byLine.get(8)!.message, /ya lo usa el socio 10/);
assert.strictEqual(byLine.get(9)!.action, 'skip');
assert.match(byLine.get(10)!.message, /repetido en el archivo/);
assert.match(byLine.get(11)!.message, /repetido en el archivo/);
assert.match(byLine.get(12)!.message, /fecha/);
assert.strictEqual(byLine.get(13)!.vencimiento, '2027-03-05 00:00:00');
assert.match(byLine.get(14)!.vencimiento || '', /^\d{4}-\d{2}-\d{2} 00:00:00$/);

assert.deepStrictEqual(
    { creates: plan.creates, updates: plan.updates, skipped: plan.skipped, errors: plan.errors },
    { creates: 3, updates: 1, skipped: 1, errors: 7 }
);

// 3. CSV con las mismas columnas.
const csv = 'IdSocio,Codigo Socio,Nombre Socio,Telefono,Correo Electronico,Fecha Vencimiento\n11,,ANA MARIA,8112223333,ana@mail.com,2026-06-30\n';
const fromCsv = parseTemplate(Buffer.from(csv, 'utf8'));
assert.strictEqual(fromCsv.rows.length, 1, 'debe leer CSV');
const csvPlan = buildImportPlan(fromCsv.rows, existing);
assert.strictEqual(csvPlan.updates, 1, 'el CSV debe actualizar al socio 11');

// 4. Fechas sueltas.
assert.strictEqual(parseExpiry('').value, null);
assert.strictEqual(parseExpiry('2026-3-7').value, '2026-03-07 00:00:00');
assert.match(parseExpiry('mañana').error, /no se entiende la fecha/);

console.log('OK: plantilla, encabezados con acentos, CSV, fechas y plan de importacion');
console.log(JSON.stringify({ creates: plan.creates, updates: plan.updates, skipped: plan.skipped, errors: plan.errors }));
