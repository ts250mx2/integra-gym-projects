import { query } from './src/lib/db';

async function main() {
    try {
        const rows = await query('DESCRIBE tblSucursales');
        console.log("tblSucursales schema:", rows);

        // Check for any other table linking readers/projects
        const tables = await query("SHOW TABLES LIKE '%Lector%'");
        console.log("Tables with Lector:", tables);
    } catch (err) {
        console.error(err);
    }
}

main();
