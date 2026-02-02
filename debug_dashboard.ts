
import { query } from './src/lib/db';
import mysql from 'mysql2/promise';

async function main() {
    try {
        console.log("Fetching Project Config...");
        const projects = await query('SELECT * FROM tblProyectos LIMIT 1', []) as any[];
        if (projects.length === 0) {
            console.log("No projects found.");
            return;
        }

        const project = projects[0];
        console.log(`Project Found: ${project.Proyecto}, DB: ${project.BaseDatos}`);

        // Connect to Project DB
        const pool = mysql.createPool({
            host: project.Servidor,
            user: project.UsuarioBD,
            password: project.PasswordBD,
            database: project.BaseDatos
        });

        // Test Queries
        const branchId = 1; // Assuming Branch ID 1 for testing
        console.log(`Testing with BranchId: ${branchId}`);

        // 1. Sales
        const salesQuery = `SELECT SUM(Total) AS TotalVentas, COUNT(*) as Count, MAX(FechaVenta) as LastSale FROM tblVentas WHERE DATE(FechaVenta) = CURDATE() AND Status = 0 AND IdSucursal = ?`;
        const [sales] = await pool.execute(salesQuery, [branchId]) as any[];
        console.log("Sales Today (Matches):", sales[0]);

        // Check recent sales regardless of date to see format
        const [recentSales] = await pool.execute(`SELECT IdVenta, FechaVenta, Total FROM tblVentas ORDER BY IdVenta DESC LIMIT 5`, []) as any[];
        console.log("Recent Sales Sample:", recentSales);

        // 2. Active Members
        const membersQuery = `SELECT COUNT(IdSocio) AS SociosActivos FROM tblSocios WHERE Status = 0 AND IdSucursal = ? AND FechaVencimiento > NOW()`;
        const [members] = await pool.execute(membersQuery, [branchId]) as any[];
        console.log("Active Members:", members[0]);

        // 3. Visits
        const visitsQuery = `SELECT COUNT(IdVisita) AS Visitas FROM tblVisitas WHERE IdSocio > 0 AND DATE(FechaVisita) = CURDATE() AND IdSucursal = ?`;
        const [visits] = await pool.execute(visitsQuery, [branchId]) as any[];
        console.log("Visits Today:", visits[0]);

        // 4. Employee Attendance
        const empQuery = `SELECT COUNT(IdVisita) AS Visitas FROM tblVisitas WHERE IdUsuario > 0 AND DATE(FechaVisita) = CURDATE() AND IdSucursal = ?`;
        const [emp] = await pool.execute(empQuery, [branchId]) as any[];
        console.log("Employee Attendance:", emp[0]);

        // Check DB Time
        const [time] = await pool.execute('SELECT NOW() as DBTime, CURDATE() as DBDate') as any[];
        console.log("DB Time:", time[0]);

        await pool.end();

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

main();
