import mysql from 'mysql2/promise';

const globalForDb = global as unknown as { mysqlPool: mysql.Pool };

const REQUIRED_DB_ENV = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'] as const;
const missingDbEnv = REQUIRED_DB_ENV.filter((key) => !process.env[key]);
if (missingDbEnv.length > 0) {
    throw new Error(`Faltan variables de entorno de la BD: ${missingDbEnv.join(', ')}. Defínelas en .env`);
}

const pool = globalForDb.mysqlPool || mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'BDIntegraProjects',
    waitForConnections: true,
    connectionLimit: 5, // Reduced from 10 to 5
    queueLimit: 0,
    charset: 'latin1'
});

pool.on('connection', (connection) => {
    connection.query('SET NAMES latin1');
    connection.query("SET collation_connection = 'latin1_swedish_ci'");
});

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;

export async function query(sql: string, params?: any[]) {
    const [results] = await pool.query(sql, params);
    return results;
}

export async function execute(sql: string, params?: any[]) {
    const [results] = await pool.query(sql, params);
    return results;
}

export async function getConnection() {
    return await pool.getConnection();
}

export default pool;
