
import { query } from './src/lib/db';
import mysql from 'mysql2/promise';

async function main() {
    try {
        const projects = await query('SELECT * FROM tblProyectos LIMIT 1', []) as any[];
        if (projects.length === 0) return;
        const project = projects[0];

        const pool = mysql.createPool({
            host: project.Servidor,
            user: project.UsuarioBD,
            password: project.PasswordBD,
            database: project.BaseDatos,
            connectionLimit: 1
        });

        const [tables] = await pool.execute(`SHOW TABLES LIKE 'tblVisitasRecientes'`) as any[];
        console.log("Tables found:", tables);
        await pool.end();
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
