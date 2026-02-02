import { createPool } from 'mysql2/promise';


const pool = createPool({
    host: process.env.DB_HOST || '74.208.192.90',
    user: process.env.DB_USER || 'kyk',
    password: process.env.DB_PASSWORD || 'merkurio',
    database: 'IM_IntegraMembers',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function inspect() {
    try {
        console.log('--- IM_IntegraMembers.tblGruposHorarios ---');
        const [cols] = await pool.query("DESCRIBE tblGruposHorarios");
        (cols as any[]).forEach(col => console.log(`${col.Field}: ${col.Type}`));
    } catch (e: any) {
        console.error(e.message);
    }
    process.exit(0);
}

inspect();
