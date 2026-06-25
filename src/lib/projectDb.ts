import mysql from 'mysql2/promise';
import { query } from './db';
import { cookies } from 'next/headers';

const globalForProjectDb = global as unknown as { projectPools: Map<number, mysql.Pool> };

const pools = globalForProjectDb.projectPools || new Map<number, mysql.Pool>();

if (process.env.NODE_ENV !== 'production') globalForProjectDb.projectPools = pools;

export interface ProjectMetadata {
    IdProyecto: number;
    BaseDatos: string;
    Servidor: string;
    UsuarioBD: string;
    PasswordBD: string;
    Titulo?: string;
    Proyecto: string;
    ArchivoLogo?: string;
}

export async function getProjectByUUID(uuid: string): Promise<ProjectMetadata> {
    const projectData = await query(
        'SELECT IdProyecto, BaseDatos, Servidor, UsuarioBD, PasswordBD, Titulo, Proyecto, ArchivoLogo FROM tblProyectos WHERE UUID = ?',
        [uuid]
    ) as any[];

    if (projectData.length === 0) {
        throw new Error(`Project with UUID ${uuid} not found`);
    }

    return projectData[0];
}

export async function getProjectConnectionPoolRaw(projectId: number, metadata?: ProjectMetadata) {
    if (pools.has(projectId)) {
        return pools.get(projectId)!;
    }

    let projectInfo = metadata;
    if (!projectInfo) {
        const projectData = await query(
            'SELECT BaseDatos, Servidor, UsuarioBD, PasswordBD FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        ) as any[];

        if (projectData.length === 0) {
            throw new Error(`Project with ID ${projectId} not found`);
        }
        projectInfo = projectData[0] as ProjectMetadata;
    }

    const { BaseDatos, Servidor, UsuarioBD, PasswordBD } = projectInfo;

    const pool = mysql.createPool({
        host: Servidor,
        user: UsuarioBD,
        password: PasswordBD,
        database: BaseDatos,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        charset: 'latin1'
    });

    pool.on('connection', (connection) => {
        connection.query('SET NAMES latin1');
        connection.query("SET collation_connection = 'latin1_swedish_ci'");
    });

    pools.set(projectId, pool);
    return pool;
}

export function applyBranchFilters(sql: string, projectId: number, branchIdParam: string | undefined): string {
    const cleanedSql = sql.replace(/\/\*SELECTED_BRANCHES:[^*]+\*\//g, '');

    if (!branchIdParam || branchIdParam === 'all') {
        return cleanedSql
            .replace(/\/\*BRANCH_FILTER\*\//g, '')
            .replace(/\/\*BRANCH_FILTER_S\*\//g, '')
            .replace(/\/\*BRANCH_FILTER_M\*\//g, '')
            .replace(/\/\*BRANCH_FILTER_A\*\//g, '')
            .replace(/\/\*BRANCH_FILTER_V\*\//g, '');
    }

    const tokens = branchIdParam.split(',');
    const selectedBranches: number[] = [];
    let hasBranchesForThisProject = false;

    for (const token of tokens) {
        if (token.includes('_')) {
            const [pIdStr, bIdStr] = token.split('_');
            const pId = parseInt(pIdStr, 10);
            const bId = parseInt(bIdStr, 10);
            if (pId === projectId && !isNaN(bId)) {
                selectedBranches.push(bId);
                hasBranchesForThisProject = true;
            }
        } else {
            const bId = parseInt(token, 10);
            if (!isNaN(bId)) {
                selectedBranches.push(bId);
                hasBranchesForThisProject = true;
            }
        }
    }

    if (!hasBranchesForThisProject) {
        return cleanedSql
            .replace(/\/\*BRANCH_FILTER\*\//g, ' AND 1 = 0 ')
            .replace(/\/\*BRANCH_FILTER_S\*\//g, ' AND 1 = 0 ')
            .replace(/\/\*BRANCH_FILTER_M\*\//g, ' AND 1 = 0 ')
            .replace(/\/\*BRANCH_FILTER_A\*\//g, ' AND 1 = 0 ')
            .replace(/\/\*BRANCH_FILTER_V\*\//g, ' AND 1 = 0 ');
    }

    const branchListStr = selectedBranches.join(',');
    const inClause = ` AND IdSucursal IN (${branchListStr}) `;
    const inClauseS = ` AND S.IdSucursal IN (${branchListStr}) `;
    const inClauseM = ` AND m.IdSucursal IN (${branchListStr}) `;
    const inClauseA = ` AND A.IdSucursal IN (${branchListStr}) `;
    const inClauseV = ` AND v.IdSucursal IN (${branchListStr}) `;

    return cleanedSql
        .replace(/\/\*BRANCH_FILTER\*\//g, inClause)
        .replace(/\/\*BRANCH_FILTER_S\*\//g, inClauseS)
        .replace(/\/\*BRANCH_FILTER_M\*\//g, inClauseM)
        .replace(/\/\*BRANCH_FILTER_A\*\//g, inClauseA)
        .replace(/\/\*BRANCH_FILTER_V\*\//g, inClauseV);
}

// Helper to unifiy / aggregate results from multiple databases in memory
function mergeDbResults(sql: string, allResults: any[][], projects: any[]): any[] {
    const flatRows: any[] = [];
    allResults.forEach((results, idx) => {
        if (!Array.isArray(results)) return;
        const proj = projects[idx];
        results.forEach(row => {
            flatRows.push({
                ...row,
                _IdProyecto: proj.IdProyecto,
                _Proyecto: proj.Proyecto
            });
        });
    });

    if (flatRows.length === 0) return [];

    const lowerSql = sql.toLowerCase();
    const isAggregation = /sum\(|count\(|avg\(|group\s+by/i.test(lowerSql);
    const isExpiring = lowerSql.includes('tblsocios') && (lowerSql.includes('fecha_vencimiento') || lowerSql.includes('fechavencimiento'));


    if (!isAggregation) {
        if (isExpiring) {
            flatRows.sort((a, b) => {
                const dateA = a.expiry || a.expiryDate || a.FechaVencimiento || '';
                const dateB = b.expiry || b.expiryDate || b.FechaVencimiento || '';
                return String(dateA).localeCompare(String(dateB));
            });
            const limitMatch = sql.match(/limit\s+(\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1]);
                return flatRows.slice(0, limit);
            }
        }
        return flatRows;
    }

    // Grouping / Aggregate logic
    const groupKeySet = new Set([
        'dayofweek', 'hourofday', 'monthid', 'idsucursal', 'idproyecto', 
        'year_num', 'month_num', 'vdate', 'vDate', 'MesTexto', 'monthId', 
        'dayOfWeek', 'hourOfDay', 'name', 'branch', 'Sucursal',
        // Branch detail fields — must not be summed
        'Foto', 'foto', 'Codigo', 'codigo', 'Folio', 'folio',
        'FormaPago', 'formapago', 'Descripcion', 'descripcion',
        'FolioMovimiento', 'FechaMovimiento', 'IdMovimiento',
        'IdSucursal', 'Status', 'status'
    ]);
    
    const sampleRow = flatRows[0];
    const keys = Object.keys(sampleRow).filter(k => !k.startsWith('_'));
    
    const groupingKeys = keys.filter(k => {
        const val = sampleRow[k];
        if (typeof val === 'string' || val instanceof Date) return true;
        // Binary/Buffer fields must not be summed — treat as grouping keys
        if (val instanceof Uint8Array || Buffer.isBuffer(val)) return true;
        if (groupKeySet.has(k) || groupKeySet.has(k.toLowerCase())) return true;
        return false;
    });

    const metricKeys = keys.filter(k => !groupingKeys.includes(k));

    const grouped = new Map<string, any>();
    flatRows.forEach(row => {
        const groupVal = groupingKeys.map(k => {
            const v = row[k];
            // For binary fields, use length as part of group key (not the actual data)
            if (v instanceof Uint8Array || Buffer.isBuffer(v)) return `bin:${v.length}`;
            return String(v ?? '');
        }).join('|');
        if (!grouped.has(groupVal)) {
            const newRow: any = {};
            groupingKeys.forEach(k => { newRow[k] = row[k]; });
            metricKeys.forEach(k => { newRow[k] = 0; });
            grouped.set(groupVal, newRow);
        }
        const accumulated = grouped.get(groupVal);
        metricKeys.forEach(k => {
            const val = Number(row[k] || 0);
            if (!isNaN(val)) accumulated[k] += val;
        });
    });

    const mergedRows = Array.from(grouped.values());

    // Recalculate ticket average (TicketPromedio)
    mergedRows.forEach(row => {
        keys.forEach(k => {
            const lowerK = k.toLowerCase();
            if (lowerK === 'ticketpromedio') {
                const totalKey = keys.find(x => x.toLowerCase() === 'totalventas' || x.toLowerCase() === 'total');
                const countKey = keys.find(x => x.toLowerCase() === 'operaciones' || x.toLowerCase() === 'salescount' || x.toLowerCase() === 'sales_count');
                if (totalKey && countKey) {
                    const tot = row[totalKey] || 0;
                    const cnt = row[countKey] || 0;
                    row[k] = cnt > 0 ? tot / cnt : 0;
                }
            }
        });
    });

    // Sorting
    if (lowerSql.includes('order by')) {
        const orderMatch = sql.match(/order\s+by\s+([^;]+)/i);
        if (orderMatch) {
            const clauses = orderMatch[1].split(',').map(c => c.trim());
            mergedRows.sort((a, b) => {
                for (const clause of clauses) {
                    const parts = clause.split(/\s+/);
                    let field = parts[0].split('.').pop() || '';
                    const dir = (parts[1] || 'asc').toLowerCase();
                    field = field.replace(/\(|\)/g, '').trim();
                    
                    const valA = a[field];
                    const valB = b[field];
                    if (valA === undefined || valB === undefined) continue;

                    if (typeof valA === 'string') {
                        const cmp = valA.localeCompare(valB);
                        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
                    } else {
                        const numA = Number(valA) || 0;
                        const numB = Number(valB) || 0;
                        if (numA !== numB) return dir === 'desc' ? numB - numA : numA - numB;
                    }
                }
                return 0;
            });
        }
    }

    return mergedRows;
}

// Normaliza nombres de gimnasio para comparar (sin acentos, minúsculas, sin espacios extra).
function normalizeProjectName(s: string): string {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim();
}

// Detección de lectura tolerante a un comentario inicial /*...*/ (p. ej. /*ONLY_PROJECT:X*/).
const READ_RE = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*(select|with)/i;

// Wrapper to intercept queries and execute across all user-assigned databases
class VirtualPoolWrapper {
    private primaryProjectId: number;
    private projects: any[];

    constructor(primaryProjectId: number, projects: any[]) {
        this.primaryProjectId = primaryProjectId;
        this.projects = projects;
    }

    // Acota la consulta a un solo gimnasio cuando el SQL trae /*ONLY_PROJECT:Nombre*/.
    // Si el nombre no coincide con ninguno de los gimnasios del número, lanza un error
    // claro (con los nombres válidos) en vez de correr en TODOS o devolver vacío.
    private resolveTargets(sql: string): any[] {
        const m = sql.match(/\/\*ONLY_PROJECT:([^*]*)\*\//i);
        if (!m) return this.projects;
        const wanted = normalizeProjectName(m[1]);
        if (!wanted) return this.projects;

        // 1) Coincidencia EXACTA (normalizada): preferida y sin ambigüedad. Es clave cuando
        //    un nombre es PREFIJO de otro (p. ej. "Clandestino Gym" es prefijo de
        //    "Clandestino Gym Stoa (Lazaro Cardenas)"): sin esto se colaban los dos proyectos.
        const exact = this.projects.filter((p) => normalizeProjectName(p.Proyecto) === wanted);
        if (exact.length) return exact;

        // 2) Sin exacta: gimnasios cuyo nombre CONTIENE lo pedido (p. ej. pedir "stoa"
        //    encuentra "clandestino gym stoa ..."). NUNCA al revés (wanted.includes(name)):
        //    eso captura el nombre corto que es prefijo de varios.
        const contains = this.projects.filter((p) => normalizeProjectName(p.Proyecto).includes(wanted));
        if (contains.length === 1) return contains;
        if (contains.length > 1) {
            // Ambiguo: el término aparece en varios → toma el de nombre más corto (el más cercano).
            contains.sort((a, b) => normalizeProjectName(a.Proyecto).length - normalizeProjectName(b.Proyecto).length);
            return [contains[0]];
        }

        const names = this.projects.map((p) => p.Proyecto).join(', ');
        throw new Error(
            `No se encontró el gimnasio "${m[1].trim()}" entre los asignados a este número. ` +
            `Gimnasios válidos: ${names}.`
        );
    }

    // Ejecuta el SELECT en cada gimnasio objetivo (en paralelo) y fusiona en memoria.
    // Si TODAS las BDs objetivo fallan, propaga el error (en vez de devolver vacío
    // silencioso) para que el agente lo reciba como error real y no invente excusas.
    private async runRead(sql: string, params: any[] | undefined, mode: 'query' | 'execute'): Promise<[any[], any]> {
        const targets = this.resolveTargets(sql);

        let branchIdParam: string | undefined = undefined;
        const bm = sql.match(/\/\*SELECTED_BRANCHES:([^*]+)\*\//);
        if (bm) branchIdParam = bm[1];

        // Quita la directiva ONLY_PROJECT antes de enviar el SQL a MySQL.
        const cleanSql = sql.replace(/\/\*ONLY_PROJECT:[^*]*\*\//gi, '');

        const settled = await Promise.all(targets.map(async (proj) => {
            try {
                const filteredSql = applyBranchFilters(cleanSql, proj.IdProyecto, branchIdParam);
                const pool = await getProjectConnectionPoolRaw(proj.IdProyecto, proj);
                const [results] = mode === 'execute'
                    ? await pool.execute(filteredSql, params)
                    : await pool.query(filteredSql, params);
                return { rows: results as any[], error: null as any };
            } catch (err: any) {
                console.error(`VirtualPool ${mode} error on project ${proj.IdProyecto}:`, err);
                return { rows: [] as any[], error: err };
            }
        }));

        const errors = settled.filter((s) => s.error).map((s) => s.error);
        if (targets.length > 0 && errors.length === targets.length) {
            const msg = errors[0]?.sqlMessage || errors[0]?.message || 'error desconocido';
            throw new Error(`La consulta falló en todos los gimnasios: ${msg}`);
        }

        const merged = mergeDbResults(cleanSql, settled.map((s) => s.rows), targets);
        return [merged, null] as any;
    }

    async query(sql: string, params?: any[]): Promise<[any[], any]> {
        if (!READ_RE.test(sql)) {
            const primaryPool = await getProjectConnectionPoolRaw(this.primaryProjectId);
            return await primaryPool.query(sql, params);
        }
        return this.runRead(sql, params, 'query');
    }

    async execute(sql: string, params?: any[]): Promise<[any[], any]> {
        if (!READ_RE.test(sql)) {
            const primaryPool = await getProjectConnectionPoolRaw(this.primaryProjectId);
            return await primaryPool.execute(sql, params);
        }
        return this.runRead(sql, params, 'execute');
    }
}

/**
 * Construye un pool "integrado" para un conjunto EXPLÍCITO de proyectos, sin
 * depender de la cookie de sesión (pensado para webservices como WhatsApp, que
 * se autentican por API key y no tienen sesión).
 *
 * - 1 proyecto  → pool normal de ese proyecto.
 * - 2+ proyectos → VirtualPoolWrapper: replica cada SELECT en la BD de cada
 *   gimnasio y fusiona los resultados en memoria (mismo comportamiento que el
 *   modo ProyectosIntegrados de la web).
 */
export async function getIntegratedPoolForProjectIds(projectIds: number[]): Promise<any> {
    const unique = [...new Set(projectIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (unique.length === 0) throw new Error('getIntegratedPoolForProjectIds: sin proyectos');
    if (unique.length === 1) return await getProjectConnectionPoolRaw(unique[0]);

    const placeholders = unique.map(() => '?').join(',');
    const userProjects = await query(
        `SELECT IdProyecto, BaseDatos, Servidor, UsuarioBD, PasswordBD, Proyecto
         FROM tblProyectos WHERE IdProyecto IN (${placeholders}) AND Status = 0`,
        unique
    ) as any[];

    if (userProjects.length === 0) throw new Error('getIntegratedPoolForProjectIds: proyectos no encontrados');
    if (userProjects.length === 1) {
        const only = userProjects[0];
        return await getProjectConnectionPoolRaw(only.IdProyecto, only);
    }
    return new VirtualPoolWrapper(userProjects[0].IdProyecto, userProjects) as any;
}

export async function getProjectConnectionPool(projectId: number, metadata?: ProjectMetadata, bypassVirtual: boolean = false) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!bypassVirtual && sessionCookie?.value) {
            const session = JSON.parse(sessionCookie.value);
            if (session.proyectoIntegrados === 1) {
                // Fetch all user's active projects
                let userProjects: any[] = [];
                if (session.isAdmin === 2) {
                    userProjects = await query(
                        'SELECT IdProyecto, BaseDatos, Servidor, UsuarioBD, PasswordBD, Proyecto FROM tblProyectos WHERE Status = 0',
                        []
                    ) as any[];
                } else {
                    userProjects = await query(
                        `SELECT p.IdProyecto, p.BaseDatos, p.Servidor, p.UsuarioBD, p.PasswordBD, p.Proyecto 
                         FROM tblProyectos p
                         JOIN tblProyectosUsuarios pu ON p.IdProyecto = pu.IdProyecto
                         WHERE pu.IdUsuario = ? AND p.Status = 0`,
                        [session.userId]
                    ) as any[];
                }

                if (userProjects.length > 1) {
                    return new VirtualPoolWrapper(projectId, userProjects) as any;
                }
            }
        }
    } catch {
        // Fallback to normal behavior (e.g. static rendering, script execution, or missing cookies)
    }

    return await getProjectConnectionPoolRaw(projectId, metadata);
}

export async function projectQuery(projectId: number, sql: string, params?: any[], metadata?: ProjectMetadata, bypassVirtual: boolean = false) {
    const pool = await getProjectConnectionPool(projectId, metadata, bypassVirtual);
    let finalSql = sql;
    if (!(pool instanceof VirtualPoolWrapper)) {
        let branchIdParam: string | undefined = undefined;
        const match = sql.match(/\/\*SELECTED_BRANCHES:([^*]+)\*\//);
        if (match) {
            branchIdParam = match[1];
        }
        finalSql = applyBranchFilters(sql, projectId, branchIdParam);
    }
    const [results] = await pool.execute(finalSql, params);
    return results;
}
