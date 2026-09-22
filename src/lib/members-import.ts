import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getProjectConnectionPoolRaw, projectQuery } from '@/lib/projectDb';
import type { ExistingMember, ImportPlan } from '@/lib/members-template';

/**
 * Lado BD de la importacion de socios (el armado y la validacion del archivo estan
 * en src/lib/members-template.ts).
 *
 * Las BDs de los gimnasios vienen en dos generaciones (ver src/lib/analytics/source.ts):
 *   v2 (POS web)        tblSocios.Socio   + CodigoSocio  + Telefono   | IdSocio autoincremental
 *   v1 (POS escritorio) tblSocios.Nombres + CodigoBarras + Telefonos  | IdSocio por sucursal (PK IdSocio+IdSucursal)
 *
 * Verificado 2026-09-21: de los 194 gimnasios que respondieron, 190 son v1. En v1 el
 * mismo IdSocio se repite entre sucursales, asi que todo se hace dentro de una sucursal.
 */

const DELETED_STATUS = 2;

export interface MemberColumns {
    isLegacy: boolean;
    /** Columna del nombre: Socio (v2) o Nombres (v1). */
    name: string;
    /** Columna del codigo: CodigoSocio (v2) o CodigoBarras (v1). */
    code: string;
    phone: string;
    email: string;
    expiry: string;
    /** Fecha de alta: FechaAlta (v1), FechaInicio (v2) o null si no existe. */
    joinDate: string | null;
    hasIdFotoZK: boolean;
    /** Columna de tblSucursales con el prefijo del codigo: Clave (v2) o Serie (v1). */
    branchPrefix: string | null;
}

export interface BranchInfo {
    IdSucursal: number;
    Sucursal: string;
    Prefijo: string;
}

export interface ImportResult {
    updated: number;
    created: number;
    skipped: number;
    errors: number;
    createdIds: number[];
}

/** Valores que se mandan como parametros a MySQL. */
type SqlValue = string | number | null;

const columnsCache = new Map<number, MemberColumns>();

/** Mensajes de conexion/permisos de MySQL en cristiano, para no esconder la causa real. */
export function describeDbError(error: unknown): string {
    const code = typeof error === 'object' && error !== null ? String((error as { code?: string }).code || '') : '';
    const message = error instanceof Error ? error.message : String(error);

    const hints: Record<string, string> = {
        ER_DBACCESS_DENIED_ERROR: 'El usuario de la base no tiene acceso a la base de datos del gimnasio. Revisa Servidor, UsuarioBD y PasswordBD en la configuracion del proyecto.',
        ER_ACCESS_DENIED_ERROR: 'Usuario o contrasena incorrectos para la base de datos del gimnasio.',
        ER_BAD_DB_ERROR: 'La base de datos del gimnasio no existe en ese servidor.',
        ER_NO_SUCH_TABLE: 'A la base de datos del gimnasio le falta una tabla (tblSocios o tblSucursales).',
        ECONNREFUSED: 'El servidor de base de datos del gimnasio no acepto la conexion.',
        ENOTFOUND: 'No se encontro el servidor de base de datos del gimnasio.',
        ETIMEDOUT: 'Se agoto el tiempo de espera al conectar con la base de datos del gimnasio.',
        ECONNRESET: 'Se corto la conexion con la base de datos del gimnasio; vuelve a intentar.'
    };

    const hint = hints[code];
    return hint ? `${hint} (${message})` : message;
}

async function readQuery<T>(projectId: number, sql: string, params: SqlValue[] = []): Promise<T[]> {
    // bypassVirtual: el padron es de un gimnasio concreto, nunca de todos los integrados.
    return await projectQuery(projectId, sql, params, undefined, true) as T[];
}

async function listColumns(projectId: number, table: string): Promise<Set<string>> {
    const rows = await readQuery<{ Field: string }>(projectId, `SHOW COLUMNS FROM \`${table}\``);
    return new Set(rows.map((row) => String(row.Field)));
}

export async function getMemberColumns(projectId: number): Promise<MemberColumns> {
    const cached = columnsCache.get(projectId);
    if (cached) return cached;

    const [socios, sucursales] = await Promise.all([
        listColumns(projectId, 'tblSocios'),
        listColumns(projectId, 'tblSucursales')
    ]);

    const isLegacy = !socios.has('Socio');
    const columns: MemberColumns = {
        isLegacy,
        name: isLegacy ? 'Nombres' : 'Socio',
        code: socios.has('CodigoSocio') ? 'CodigoSocio' : 'CodigoBarras',
        phone: socios.has('Telefono') ? 'Telefono' : 'Telefonos',
        email: 'CorreoElectronico',
        expiry: 'FechaVencimiento',
        joinDate: socios.has('FechaAlta') ? 'FechaAlta' : socios.has('FechaInicio') ? 'FechaInicio' : null,
        hasIdFotoZK: socios.has('IdFotoZK'),
        branchPrefix: sucursales.has('Clave') ? 'Clave' : sucursales.has('Serie') ? 'Serie' : null
    };

    columnsCache.set(projectId, columns);
    return columns;
}

export async function loadBranchMembers(projectId: number, branchId: number, columns: MemberColumns): Promise<ExistingMember[]> {
    return await readQuery<ExistingMember>(
        projectId,
        `SELECT IdSocio, ${columns.code} AS Codigo, ${columns.name} AS Nombre
         FROM tblSocios
         WHERE IdSucursal = ? AND Status <> ?`,
        [branchId, DELETED_STATUS]
    );
}

export async function getBranch(projectId: number, branchId: number, columns: MemberColumns): Promise<BranchInfo | null> {
    const prefix = columns.branchPrefix ? `COALESCE(${columns.branchPrefix}, '')` : `''`;
    const rows = await readQuery<BranchInfo>(
        projectId,
        `SELECT IdSucursal, Sucursal, ${prefix} AS Prefijo FROM tblSucursales WHERE IdSucursal = ?`,
        [branchId]
    );
    return rows[0] || null;
}

async function nextLegacyId(connection: PoolConnection, branchId: number): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(IdSocio), 0) + 1 AS nextId FROM tblSocios WHERE IdSucursal = ?',
        [branchId]
    );
    return Number(rows[0]?.nextId) || 1;
}

/**
 * Aplica el plan en una sola transaccion: si algo truena a media importacion no queda
 * medio padron cambiado. Los renglones con error o sin cambios se saltan.
 */
export async function applyImport(
    projectId: number,
    branchId: number,
    branchPrefix: string,
    columns: MemberColumns,
    plan: ImportPlan
): Promise<ImportResult> {
    const pool = await getProjectConnectionPoolRaw(projectId);
    const connection = await pool.getConnection();
    const result: ImportResult = { updated: 0, created: 0, skipped: plan.skipped, errors: plan.errors, createdIds: [] };

    try {
        await connection.beginTransaction();
        let legacyId = columns.isLegacy ? await nextLegacyId(connection, branchId) : 0;

        for (const row of plan.rows) {
            if (row.action === 'update') {
                const sets: string[] = [];
                const params: SqlValue[] = [];
                if (row.nombre) { sets.push(`${columns.name} = ?`); params.push(row.nombre); }
                if (row.codigo) { sets.push(`${columns.code} = ?`); params.push(row.codigo); }
                if (row.telefono) { sets.push(`${columns.phone} = ?`); params.push(row.telefono); }
                if (row.correo) { sets.push(`${columns.email} = ?`); params.push(row.correo); }
                if (row.vencimiento) { sets.push(`${columns.expiry} = ?`); params.push(row.vencimiento); }
                if (sets.length === 0) continue;

                sets.push('FechaAct = NOW()');
                params.push(row.idSocio, branchId);
                await connection.query(
                    `UPDATE tblSocios SET ${sets.join(', ')} WHERE IdSocio = ? AND IdSucursal = ?`,
                    params
                );
                result.updated++;
                continue;
            }

            if (row.action !== 'create') continue;

            const fields = [columns.name, columns.phone, columns.email, columns.expiry, 'IdSucursal', 'Status', 'FechaAct'];
            const placeholders = ['?', '?', '?', '?', '?', '?', 'NOW()'];
            const values: SqlValue[] = [row.nombre, row.telefono || '', row.correo || '', row.vencimiento, branchId, 0];
            if (columns.joinDate) {
                fields.push(columns.joinDate);
                placeholders.push('NOW()');
            }

            let newId = 0;
            if (columns.isLegacy) {
                // v1: el IdSocio se numera por sucursal y la PK es (IdSocio, IdSucursal).
                newId = legacyId++;
                fields.unshift('IdSocio');
                placeholders.unshift('?');
                values.unshift(newId);
            }

            const [inserted] = await connection.query<ResultSetHeader>(
                `INSERT INTO tblSocios (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
                values
            );
            if (!columns.isLegacy) newId = Number(inserted.insertId);

            const extraSets = [`${columns.code} = ?`];
            const extraParams: SqlValue[] = [row.codigo || `${branchPrefix}${newId}`];
            if (columns.hasIdFotoZK) {
                extraSets.push('IdFotoZK = ?');
                extraParams.push(newId * 10000);
            }
            extraParams.push(newId, branchId);
            await connection.query(
                `UPDATE tblSocios SET ${extraSets.join(', ')} WHERE IdSocio = ? AND IdSucursal = ?`,
                extraParams
            );

            result.created++;
            result.createdIds.push(newId);
        }

        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
