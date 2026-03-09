import { query } from '../lib/db';

async function main() {
    try {
        const tables = await query('SHOW TABLES LIKE "%Usuar%"');
        console.log("Tables containing Usuar:", tables);

        const tables2 = await query('SHOW TABLES LIKE "%Proyect%"');
        console.log("Tables containing Proyect:", tables2);

        // check if tblUsuariosProyectos exists
        try {
            const cols = await query('SHOW COLUMNS FROM tblUsuariosProyectos');
            console.log("tblUsuariosProyectos exists:", cols);
        } catch (e) {
            console.log("tblUsuariosProyectos does NOT exist.");
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main();
