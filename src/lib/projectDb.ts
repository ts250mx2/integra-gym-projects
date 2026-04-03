import mysql from 'mysql2/promise';
import { query } from './db';

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

export async function getProjectConnectionPool(projectId: number, metadata?: ProjectMetadata) {
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

export async function projectQuery(projectId: number, sql: string, params?: any[], metadata?: ProjectMetadata) {
    const pool = await getProjectConnectionPool(projectId, metadata);
    const [results] = await pool.execute(sql, params);
    return results;
}
