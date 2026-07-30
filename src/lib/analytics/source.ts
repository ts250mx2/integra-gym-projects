import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

/**
 * Las BDs de los gimnasios vienen en dos generaciones y NUNCA se suman entre si
 * (seria doble conteo). Este modulo detecta cual usa el proyecto activo y
 * devuelve el mapeo de tablas/columnas para que las consultas de analiticas se
 * escriban una sola vez:
 *
 *   v2 (POS web)       tblVentas       + tblDetalleVentas       + tblVentasPagos
 *   v1 (POS escritorio) tblMovimientos + tblDetalleMovimientos  + tblMovimientosPagos
 *
 * Verificado 2026-07-29: BDIGClandestinoGym (v1) tiene 146,583 movimientos y no
 * tiene tblVentas; la plantilla IM_IntegraMembers (v2) es el caso inverso.
 */

export interface SalesSource {
    kind: 'ventas' | 'movimientos';
    /** Tabla de encabezado de venta. */
    header: string;
    /**
     * OJO: el folio NO es unico por si solo. Tanto IdVenta como IdMovimiento se
     * numeran POR SUCURSAL (el POS hace MAX(IdVenta)+1 dentro de la sucursal),
     * asi que todo JOIN con el detalle o con los pagos tiene que incluir
     * ademas IdSucursal. Unir solo por el folio abanica las filas entre
     * sucursales e infla los importes tantas veces como sucursales haya.
     */
    headerId: string;
    dateCol: string;
    detail: string;
    /** Columna con el nombre del producto/cuota en el detalle. */
    productCol: string;
    ivaCol: string;
    payments: string;
}

const VENTAS: SalesSource = {
    kind: 'ventas',
    header: 'tblVentas',
    headerId: 'IdVenta',
    dateCol: 'FechaVenta',
    detail: 'tblDetalleVentas',
    productCol: 'Cuota',
    ivaCol: 'IVA',
    payments: 'tblVentasPagos'
};

const MOVIMIENTOS: SalesSource = {
    kind: 'movimientos',
    header: 'tblMovimientos',
    headerId: 'IdMovimiento',
    dateCol: 'FechaMovimiento',
    detail: 'tblDetalleMovimientos',
    productCol: 'DescripcionCuota',
    ivaCol: 'Iva',
    payments: 'tblMovimientosPagos'
};

export interface MemberSource {
    /** Expresion SQL para el nombre del socio. */
    nameExpr: string;
    /** Columna de fecha de alta. */
    joinDateCol: string;
    /** Columna de genero, o null si la BD no la tiene. */
    genderCol: string | null;
    /** tblVisitas distingue asistencia de personal (solo v2). */
    hasStaffVisits: boolean;
}

export interface ProjectSource {
    sales: SalesSource;
    members: MemberSource;
    /** Tablas del modulo de compras; ausentes hasta la primera compra registrada. */
    hasPurchases: boolean;
}

export interface AnalyticsSession {
    projectId: number;
    branchId: number;
    userId: number;
}

const sourceCache = new Map<number, ProjectSource>();

export async function getAnalyticsSession(): Promise<AnalyticsSession | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        if (!session.projectId) return null;
        return {
            projectId: Number(session.projectId),
            branchId: Number(session.branchId) || 0,
            userId: Number(session.userId) || 0
        };
    } catch {
        return null;
    }
}

/**
 * Consulta en la BD del gimnasio activo. bypassVirtual = true evita que el modo
 * Proyectos Integrados replique la consulta en todos los gimnasios y fusione
 * filas: una analitica operativa siempre es del gimnasio en el que estas.
 */
export async function analyticsQuery(projectId: number, sql: string, params: any[] = []): Promise<any[]> {
    return await projectQuery(projectId, sql, params, undefined, true) as any[];
}

async function listTables(projectId: number): Promise<Set<string>> {
    const rows = await analyticsQuery(projectId, 'SHOW TABLES');
    return new Set(rows.map((row) => String(Object.values(row)[0])));
}

async function listColumns(projectId: number, table: string): Promise<Set<string>> {
    try {
        const rows = await analyticsQuery(projectId, `SHOW COLUMNS FROM \`${table}\``);
        return new Set(rows.map((row) => String(row.Field)));
    } catch {
        return new Set();
    }
}

export async function getProjectSource(projectId: number): Promise<ProjectSource> {
    const cached = sourceCache.get(projectId);
    if (cached) return cached;

    const tables = await listTables(projectId);

    // Si existen las dos, gana la que realmente tenga movimientos capturados.
    let sales = tables.has('tblMovimientos') ? MOVIMIENTOS : VENTAS;
    if (tables.has('tblMovimientos') && tables.has('tblVentas')) {
        const [movs, ventas] = await Promise.all([
            analyticsQuery(projectId, 'SELECT COUNT(*) AS n FROM tblMovimientos WHERE Status <> 2'),
            analyticsQuery(projectId, 'SELECT COUNT(*) AS n FROM tblVentas WHERE Status <> 2')
        ]);
        sales = Number(movs[0]?.n || 0) >= Number(ventas[0]?.n || 0) ? MOVIMIENTOS : VENTAS;
    }

    const [socioCols, visitaCols] = await Promise.all([
        listColumns(projectId, 'tblSocios'),
        listColumns(projectId, 'tblVisitas')
    ]);

    const members: MemberSource = {
        nameExpr: socioCols.has('Socio')
            ? 'Socio'
            : "TRIM(CONCAT(COALESCE(Nombres, ''), ' ', COALESCE(Apellidos, '')))",
        joinDateCol: socioCols.has('FechaAlta') ? 'FechaAlta' : 'FechaInicio',
        genderCol: socioCols.has('Genero') ? 'Genero' : socioCols.has('Sexo') ? 'Sexo' : null,
        hasStaffVisits: visitaCols.has('IdUsuario')
    };

    const source: ProjectSource = {
        sales,
        members,
        hasPurchases: tables.has('tblCompras')
    };

    sourceCache.set(projectId, source);
    return source;
}

/** Filtro de sucursal reutilizable: la sesion con sucursal 0 (admin) ve todas. */
export function branchFilter(branchId: number, alias = ''): { clause: string; params: number[] } {
    if (!branchId) return { clause: '', params: [] };
    const prefix = alias ? `${alias}.` : '';
    return { clause: ` AND ${prefix}IdSucursal = ?`, params: [branchId] };
}
