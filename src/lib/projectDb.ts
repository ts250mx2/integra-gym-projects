import mysql from 'mysql2/promise';
import { query } from './db';

const globalForProjectDb = global as unknown as { projectPools: Map<number, mysql.Pool> };

const pools = globalForProjectDb.projectPools || new Map<number, mysql.Pool>();

if (process.env.NODE_ENV !== 'production') globalForProjectDb.projectPools = pools;

export async function getProjectConnectionPool(projectId: number) {
    if (pools.has(projectId)) {
        return pools.get(projectId)!;
    }

    const projectData = await query(
        'SELECT BaseDatos, Servidor, UsuarioBD, PasswordBD FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    if (projectData.length === 0) {
        throw new Error(`Project with ID ${projectId} not found`);
    }

    const { BaseDatos, Servidor, UsuarioBD, PasswordBD } = projectData[0];

    const pool = mysql.createPool({
        host: Servidor,
        user: UsuarioBD,
        password: PasswordBD,
        database: BaseDatos,
        waitForConnections: true,
        connectionLimit: 5, // Reduced from 10 to 5
        queueLimit: 0,
    });

    pools.set(projectId, pool);
    return pool;
}

export async function projectQuery(projectId: number, sql: string, params?: any[]) {
    const pool = await getProjectConnectionPool(projectId);
    const [results] = await pool.execute(sql, params);
    console.log("sql: ", sql);
    return results;
}
