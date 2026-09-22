import * as XLSX from 'xlsx';

/**
 * Plantilla de socios: armado del archivo vacio, lectura del archivo que sube el
 * usuario y validacion de cada renglon. Todo aqui es puro (no toca la BD) para
 * poder probarlo solo; lo que consulta y escribe vive en src/lib/members-import.ts.
 */

export const TEMPLATE_SHEET = 'Socios';
export const INSTRUCTIONS_SHEET = 'Instrucciones';
export const MAX_ROWS = 5000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { nombre: 200, codigo: 45, telefono: 45, correo: 200 };

export type TemplateKey = 'idSocio' | 'codigo' | 'nombre' | 'telefono' | 'correo' | 'vencimiento';

export interface TemplateColumn {
    key: TemplateKey;
    header: string;
    hint: string;
    width: number;
}

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
    { key: 'idSocio', header: 'IdSocio', hint: 'Dejalo vacio para dar de alta un socio nuevo. Con IdSocio se actualiza al socio de esa sucursal.', width: 12 },
    { key: 'codigo', header: 'Codigo Socio', hint: 'Codigo con el que se identifica al socio. Si lo dejas vacio en un alta, el sistema lo genera.', width: 16 },
    { key: 'nombre', header: 'Nombre Socio', hint: 'Nombre completo. Obligatorio para dar de alta.', width: 34 },
    { key: 'telefono', header: 'Telefono', hint: 'Opcional.', width: 18 },
    { key: 'correo', header: 'Correo Electronico', hint: 'Opcional.', width: 28 },
    { key: 'vencimiento', header: 'Fecha Vencimiento', hint: 'Formato AAAA-MM-DD. Tambien se acepta DD/MM/AAAA o una fecha de Excel.', width: 18 }
];

const HEADER_ALIASES: Record<string, TemplateKey> = {
    idsocio: 'idSocio', id: 'idSocio', numerosocio: 'idSocio',
    codigosocio: 'codigo', codigo: 'codigo', codigodesocio: 'codigo', codigobarras: 'codigo', clave: 'codigo',
    nombresocio: 'nombre', nombre: 'nombre', socio: 'nombre', nombredelsocio: 'nombre', nombrecompleto: 'nombre',
    telefono: 'telefono', telefonos: 'telefono', tel: 'telefono', celular: 'telefono',
    correoelectronico: 'correo', correo: 'correo', email: 'correo', mail: 'correo',
    fechavencimiento: 'vencimiento', vencimiento: 'vencimiento', fechadevencimiento: 'vencimiento', vence: 'vencimiento'
};

export interface RawRow {
    line: number;
    idSocio: string;
    codigo: string;
    nombre: string;
    telefono: string;
    correo: string;
    vencimiento: unknown;
}

export type RowAction = 'update' | 'create' | 'skip' | 'error';

export interface PlannedRow {
    line: number;
    action: RowAction;
    message: string;
    idSocio: number | null;
    codigo: string | null;
    nombre: string | null;
    telefono: string | null;
    correo: string | null;
    vencimiento: string | null;
}

export interface ImportPlan {
    rows: PlannedRow[];
    updates: number;
    creates: number;
    skipped: number;
    errors: number;
}

export interface ExistingMember {
    IdSocio: number;
    Codigo: string | null;
    Nombre: string | null;
}

function normalizeHeader(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
}

/** Libro de la plantilla vacia: hoja de captura mas hoja de instrucciones. */
export function buildTemplateWorkbook(branchName: string, isLegacy: boolean): Buffer {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS.map((column) => column.header)]);
    sheet['!cols'] = TEMPLATE_COLUMNS.map((column) => ({ wch: column.width }));

    const instructions: string[][] = [
        ['Plantilla de socios'],
        [`Sucursal: ${branchName}`],
        [''],
        ['Captura un socio por renglon en la hoja "Socios" y sube el archivo en Socios > Importar socios.'],
        ['Los socios se importan en la sucursal que elijas al subir el archivo.'],
        ['Una celda vacia no borra el dato: ese campo se queda como estaba.'],
        [''],
        ['Columna', 'Para que sirve'],
        ...TEMPLATE_COLUMNS.map((column) => [column.header, column.hint]),
        [''],
        ['Esquema de este gimnasio', isLegacy ? 'Anterior (Nombres / CodigoBarras)' : 'Nuevo (Socio / CodigoSocio)']
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(instructions);
    infoSheet['!cols'] = [{ wch: 26 }, { wch: 96 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, TEMPLATE_SHEET);
    XLSX.utils.book_append_sheet(book, infoSheet, INSTRUCTIONS_SHEET);

    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Lee el archivo subido (.xlsx o .csv) y devuelve un renglon por fila con datos. */
export function parseTemplate(buffer: Buffer): { rows: RawRow[]; missing: string[]; truncated: boolean } {
    const allHeaders = TEMPLATE_COLUMNS.map((column) => column.header);
    const book = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = book.SheetNames.includes(TEMPLATE_SHEET) ? TEMPLATE_SHEET : book.SheetNames[0];
    const sheet = sheetName ? book.Sheets[sheetName] : null;
    if (!sheet) return { rows: [], missing: allHeaders, truncated: false };

    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
    if (grid.length === 0) return { rows: [], missing: allHeaders, truncated: false };

    const headerRow = grid[0] || [];
    const indexes = new Map<TemplateKey, number>();
    headerRow.forEach((cellValue, index) => {
        const key = HEADER_ALIASES[normalizeHeader(cellValue)];
        if (key && !indexes.has(key)) indexes.set(key, index);
    });

    const missing = TEMPLATE_COLUMNS.filter((column) => !indexes.has(column.key)).map((column) => column.header);
    if (missing.length === TEMPLATE_COLUMNS.length) return { rows: [], missing, truncated: false };

    const cellOf = (row: unknown[], key: TemplateKey): unknown => {
        const index = indexes.get(key);
        return index === undefined ? '' : row[index];
    };

    const rows: RawRow[] = [];
    let truncated = false;
    for (let i = 1; i < grid.length; i++) {
        const row = grid[i] || [];
        const raw: RawRow = {
            line: i + 1, // el numero de renglon tal como se ve en Excel
            idSocio: text(cellOf(row, 'idSocio')),
            codigo: text(cellOf(row, 'codigo')),
            nombre: text(cellOf(row, 'nombre')),
            telefono: text(cellOf(row, 'telefono')),
            correo: text(cellOf(row, 'correo')),
            vencimiento: cellOf(row, 'vencimiento')
        };
        const isEmpty = !raw.idSocio && !raw.codigo && !raw.nombre && !raw.telefono && !raw.correo && !text(raw.vencimiento);
        if (isEmpty) continue;
        if (rows.length >= MAX_ROWS) {
            truncated = true;
            break;
        }
        rows.push(raw);
    }

    return { rows, missing, truncated };
}

/** Acepta fecha de Excel, Date, AAAA-MM-DD o DD/MM/AAAA. */
export function parseExpiry(value: unknown): { value: string | null; error: string } {
    if (value === null || value === undefined || value === '') return { value: null, error: '' };

    const pad = (n: number) => String(n).padStart(2, '0');

    if (value instanceof Date) {
        if (isNaN(value.getTime())) return { value: null, error: 'la fecha de vencimiento no es valida' };
        return { value: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} 00:00:00`, error: '' };
    }

    if (typeof value === 'number' && isFinite(value)) {
        // Serial de Excel: el dia 25569 es 1970-01-01.
        const date = new Date(Math.round((value - 25569) * 86400000));
        if (isNaN(date.getTime())) return { value: null, error: 'la fecha de vencimiento no es valida' };
        return { value: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} 00:00:00`, error: '' };
    }

    const raw = String(value).trim();
    if (!raw) return { value: null, error: '' };

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
    if (iso) return { value: `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))} 00:00:00`, error: '' };

    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
    if (dmy) return { value: `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))} 00:00:00`, error: '' };

    return { value: null, error: `no se entiende la fecha "${raw}", usa AAAA-MM-DD` };
}

/**
 * Decide que hace cada renglon sin tocar todavia la BD: con IdSocio actualiza, sin
 * IdSocio da de alta, y cualquier problema se reporta con su numero de renglon.
 */
export function buildImportPlan(rows: RawRow[], existing: ExistingMember[]): ImportPlan {
    const byId = new Map<number, ExistingMember>();
    const byCode = new Map<string, ExistingMember>();
    for (const member of existing) {
        byId.set(Number(member.IdSocio), member);
        const code = (member.Codigo || '').trim().toLowerCase();
        if (code) byCode.set(code, member);
    }

    const seenIds = new Set<number>();
    const seenCodes = new Set<string>();
    const planned: PlannedRow[] = [];

    for (const row of rows) {
        const base: PlannedRow = {
            line: row.line,
            action: 'error',
            message: '',
            idSocio: null,
            codigo: row.codigo || null,
            nombre: row.nombre || null,
            telefono: row.telefono || null,
            correo: row.correo || null,
            vencimiento: null
        };
        const fail = (message: string) => planned.push({ ...base, action: 'error', message });

        const expiry = parseExpiry(row.vencimiento);
        if (expiry.error) { fail(expiry.error); continue; }
        base.vencimiento = expiry.value;

        if (row.nombre.length > LIMITS.nombre) { fail(`el nombre pasa de ${LIMITS.nombre} caracteres`); continue; }
        if (row.codigo.length > LIMITS.codigo) { fail(`el codigo pasa de ${LIMITS.codigo} caracteres`); continue; }
        if (row.telefono.length > LIMITS.telefono) { fail(`el telefono pasa de ${LIMITS.telefono} caracteres`); continue; }
        if (row.correo.length > LIMITS.correo) { fail(`el correo pasa de ${LIMITS.correo} caracteres`); continue; }
        if (row.correo && !EMAIL_RE.test(row.correo)) { fail(`el correo "${row.correo}" no tiene forma de correo`); continue; }

        const codeKey = row.codigo.toLowerCase();
        if (codeKey && seenCodes.has(codeKey)) { fail(`el codigo "${row.codigo}" viene repetido en el archivo`); continue; }

        if (row.idSocio) {
            if (!/^\d+$/.test(row.idSocio)) { fail(`el IdSocio "${row.idSocio}" no es un numero`); continue; }
            const id = Number(row.idSocio);
            base.idSocio = id; // tambien en los errores, para poder ubicar el renglon
            if (!byId.has(id)) { fail(`el socio ${id} no existe en esta sucursal`); continue; }
            if (seenIds.has(id)) { fail(`el socio ${id} viene repetido en el archivo`); continue; }

            const owner = codeKey ? byCode.get(codeKey) : undefined;
            if (owner && Number(owner.IdSocio) !== id) {
                fail(`el codigo "${row.codigo}" ya lo usa el socio ${owner.IdSocio}`);
                continue;
            }

            const hasChanges = Boolean(row.codigo || row.nombre || row.telefono || row.correo || base.vencimiento);
            if (!hasChanges) {
                planned.push({ ...base, action: 'skip', idSocio: id, message: 'el renglon no trae datos que actualizar' });
                continue;
            }

            seenIds.add(id);
            if (codeKey) seenCodes.add(codeKey);
            planned.push({ ...base, action: 'update', idSocio: id, message: '' });
            continue;
        }

        if (!row.nombre) { fail('falta el nombre para dar de alta'); continue; }
        const owner = codeKey ? byCode.get(codeKey) : undefined;
        if (owner) { fail(`el codigo "${row.codigo}" ya lo usa el socio ${owner.IdSocio}`); continue; }

        if (codeKey) seenCodes.add(codeKey);
        planned.push({ ...base, action: 'create', message: '' });
    }

    return {
        rows: planned,
        updates: planned.filter((row) => row.action === 'update').length,
        creates: planned.filter((row) => row.action === 'create').length,
        skipped: planned.filter((row) => row.action === 'skip').length,
        errors: planned.filter((row) => row.action === 'error').length
    };
}
