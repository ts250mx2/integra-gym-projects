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
        'dayOfWeek', 'hourOfDay', 'name', 'branch', 'Sucursal'
    ]);
    
    const sampleRow = flatRows[0];
    const keys = Object.keys(sampleRow).filter(k => !k.startsWith('_'));
    
    const groupingKeys = keys.filter(k => {
        const val = sampleRow[k];
        if (typeof val === 'string' || val instanceof Date) return true;
        if (groupKeySet.has(k) || groupKeySet.has(k.toLowerCase())) return true;
        return false;
    });

    const metricKeys = keys.filter(k => !groupingKeys.includes(k));

    const grouped = new Map<string, any>();
    flatRows.forEach(row => {
        const groupVal = groupingKeys.map(k => String(row[k] ?? '')).join('|');
        if (!grouped.has(groupVal)) {
            const newRow: any = {};
            groupingKeys.forEach(k => { newRow[k] = row[k]; });
            metricKeys.forEach(k => { newRow[k] = 0; });
            grouped.set(groupVal, newRow);
        }
        const accumulated = grouped.get(groupVal);
        metricKeys.forEach(k => {
            accumulated[k] += Number(row[k] || 0);
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

// Wrapper to intercept queries and execute across all user-assigned databases
class VirtualPoolWrapper {
    private primaryProjectId: number;
    private projects: any[];

    constructor(primaryProjectId: number, projects: any[]) {
        this.primaryProjectId = primaryProjectId;
        this.projects = projects;
    }

    async query(sql: string, params?: any[]): Promise<[any[], any]> {
        const isRead = /^\s*(select|with)/i.test(sql);
        if (!isRead) {
            const primaryPool = await getProjectConnectionPoolRaw(this.primaryProjectId);
            return await primaryPool.query(sql, params);
        }

        let branchIdParam: string | undefined = undefined;
        const match = sql.match(/\/\*SELECTED_BRANCHES:([^*]+)\*\//);
        if (match) {
            branchIdParam = match[1];
        }

        const promises = this.projects.map(async (proj) => {
            try {
                const filteredSql = applyBranchFilters(sql, proj.IdProyecto, branchIdParam);
                const pool = await getProjectConnectionPoolRaw(proj.IdProyecto, proj);
                const [results] = await pool.query(filteredSql, params);
                return results as any[];
            } catch (err) {
                console.error(`VirtualPool query error on project ${proj.IdProyecto}:`, err);
                return [];
            }
        });
        const allResults = await Promise.all(promises);
        const merged = mergeDbResults(sql, allResults, this.projects);
        return [merged, null] as any;
    }

    async execute(sql: string, params?: any[]): Promise<[any[], any]> {
        const isRead = /^\s*(select|with)/i.test(sql);
        if (!isRead) {
            const primaryPool = await getProjectConnectionPoolRaw(this.primaryProjectId);
            return await primaryPool.execute(sql, params);
        }

        let branchIdParam: string | undefined = undefined;
        const match = sql.match(/\/\*SELECTED_BRANCHES:([^*]+)\*\//);
        if (match) {
            branchIdParam = match[1];
        }

        const promises = this.projects.map(async (proj) => {
            try {
                const filteredSql = applyBranchFilters(sql, proj.IdProyecto, branchIdParam);
                const pool = await getProjectConnectionPoolRaw(proj.IdProyecto, proj);
                const [results] = await pool.execute(filteredSql, params);
                return results as any[];
            } catch (err) {
                console.error(`VirtualPool execute error on project ${proj.IdProyecto}:`, err);
                return [];
            }
        });
        const allResults = await Promise.all(promises);
        const merged = mergeDbResults(sql, allResults, this.projects);
        return [merged, null] as any;
    }
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
