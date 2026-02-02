
import { query } from './src/lib/db';

async function main() {
    try {
        // Query the main DB pool directly, which connects to BDIntegraProjects (or whatever is in env)
        const rows = await query('DESCRIBE tblProyectos', []) as any[];
        console.log("Projects Columns:", rows.map((c: any) => c.Field));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
