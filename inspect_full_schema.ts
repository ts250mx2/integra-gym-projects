import { query } from './src/lib/db';

async function main() {
    try {
        const lectores = await query('SHOW COLUMNS FROM tblLectores') as any[];
        console.log("tblLectores Columns:", lectores.map((c: any) => c.Field));

        const proyectos = await query('SHOW COLUMNS FROM tblProyectos') as any[];
        console.log("tblProyectos Columns:", proyectos.map((c: any) => c.Field));
    } catch (err) {
        console.error(err);
    }
}

main();
