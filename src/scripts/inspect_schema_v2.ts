
import { projectQuery, getProjectConnectionPool } from '../lib/projectDb';
import mysql from 'mysql2/promise';

async function inspect() {
    try {
        // 1. Get a valid project ID
        // We'll just hardcode 1 again but this time we'll check if we can actually connect
        // Or better, querying the main DB Config to get valid projects
        // But since I don't have access to the main DB easily without knowing credentials (they are in projectDb.ts but hidden in logic)
        // I will rely on the fact that I can run a query.

        const projectId = 1;
        console.log(`Checking tables for Project ${projectId}`);

        const tables = ['tblVentas', 'tblDetalleVentas', 'tblVentasPagos', 'tblCuotas', 'tblFormasPago'];

        for (const table of tables) {
            console.log(`--- ${table} ---`);
            try {
                const cols = await projectQuery(projectId, `DESCRIBE ${table}`);
                console.log((cols as any[]).map((c: any) => `${c.Field} (${c.Type})`).join(', '));
            } catch (e: any) {
                console.log(`Error: ${e.message}`);
            }
        }

    } catch (error) {
        console.error('Script error:', error);
    }
    process.exit(0);
}

inspect();
