import mysql from 'mysql2/promise';

const globalForDb = global as unknown as { mysqlPool: mysql.Pool };

const pool = globalForDb.mysqlPool || mysql.createPool({
    host: process.env.DB_HOST || '74.208.192.90',
    user: process.env.DB_USER || 'kyk',
    password: process.env.DB_PASSWORD || 'merkurio',
    database: process.env.DB_NAME || 'BDIntegraProjects',
    waitForConnections: true,
    connectionLimit: 5, // Reduced from 10 to 5
    queueLimit: 0,
});

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;

export async function query(sql: string, params?: any[]) {
    const [results] = await pool.execute(sql, params);
    return results;
}

export async function execute(sql: string, params?: any[]) {
    const [results] = await pool.execute(sql, params);
    return results;
}

export async function getConnection() {
    return await pool.getConnection();
}

export default pool;
