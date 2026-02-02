
import mysql from 'mysql2/promise';

async function main() {
    const pool = mysql.createPool({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDIntegraProjects',
        waitForConnections: true,
        connectionLimit: 1
    });

    try {
        console.log("Connected to Master DB");

        // 1. Get Project
        const [projects] = await pool.execute('SELECT * FROM tblProyectos LIMIT 1') as any[];
        if (!projects.length) {
            console.log("No projects found");
            return;
        }
        const project = projects[0];
        console.log(`Using Project DB: ${project.BaseDatos}`);

        // 2. Connect to Project DB
        const projectPool = mysql.createPool({
            host: project.Servidor,
            user: project.UsuarioBD,
            password: project.PasswordBD,
            database: project.BaseDatos,
            connectionLimit: 1
        });

        // 3. List Tables
        const [tables] = await projectPool.execute('SHOW TABLES') as any[];
        const tableNames = tables.map((t: any) => Object.values(t)[0]);
        console.log("Tables found:", tableNames.filter((t: string) => ['tblVentas', 'tblSocios', 'tblVisitas', 'tblSucursales'].includes(t)));

        // 4. Check Data Counts for Branch 1
        const branchId = 1;

        if (tableNames.includes('tblVentas')) {
            const [sales] = await projectPool.execute('SELECT COUNT(*) as C, SUM(Total) as T FROM tblVentas WHERE Date(FechaVenta) = CURDATE() AND IdSucursal = ?', [branchId]) as any[];
            console.log(`Sales Today (Branch ${branchId}):`, sales[0]);
        }

        if (tableNames.includes('tblSocios')) {
            const [members] = await projectPool.execute('SELECT COUNT(*) as C FROM tblSocios WHERE Status=0 AND IdSucursal = ?', [branchId]) as any[];
            console.log(`Active Members (Branch ${branchId}):`, members[0]);
        }

        await projectPool.end();

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

main();
