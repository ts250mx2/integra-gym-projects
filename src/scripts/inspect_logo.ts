
import { query } from '../lib/db';

async function inspect() {
    try {
        console.log('--- Inspecting tblProyectos ArchivoLogo ---');
        // Check column type
        const cols = await query("DESCRIBE tblProyectos");
        const logoCol = (cols as any[]).find((c: any) => c.Field === 'ArchivoLogo');
        console.log('Column Info:', logoCol);

        // Check sample data (length/preview)
        const data = await query("SELECT IdProyecto, LEFT(ArchivoLogo, 50) as Preview, LENGTH(ArchivoLogo) as Len FROM tblProyectos LIMIT 5");
        console.log('Sample Data:', data);

    } catch (error: any) {
        console.error('Inspection failed:', error.message);
    }
    process.exit(0);
}

inspect();
