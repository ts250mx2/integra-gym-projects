import { query } from '../lib/db';

async function main() {
    try {
        const cols = await query('SHOW COLUMNS FROM tblProyectosUsuarios');
        console.log("tblProyectosUsuarios columns:", cols);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main();
