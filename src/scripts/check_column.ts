import { query } from '../lib/db';

async function main() {
    try {
        console.log("Checking columns of tblUsuarios...");
        const columns: any = await query('SHOW COLUMNS FROM tblUsuarios');
        console.log("Columns:", columns.map((c: any) => c.Field));
        
        const hasCol = columns.some((c: any) => c.Field === 'ProyectoIntegrados');
        if (!hasCol) {
            console.log("Column 'ProyectoIntegrados' not found, adding it...");
            await query('ALTER TABLE tblUsuarios ADD COLUMN ProyectoIntegrados TINYINT NOT NULL DEFAULT 0');
            console.log("Column added successfully!");
        } else {
            console.log("Column 'ProyectoIntegrados' already exists.");
        }
        process.exit(0);
    } catch (error) {
        console.error("Error in check_column script:", error);
        process.exit(1);
    }
}
main();
