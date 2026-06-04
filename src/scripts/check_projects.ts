import { query } from '../lib/db';

async function main() {
    try {
        console.log("Checking tblProyectos...");
        const projects: any = await query('SELECT IdProyecto, Proyecto, BaseDatos, Servidor FROM tblProyectos WHERE Status = 0');
        console.log("Active Projects:", projects);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}
main();
