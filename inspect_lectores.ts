import { query } from './src/lib/db';

async function main() {
    try {
        const rows = await query('DESCRIBE tblLectores');
        console.log(rows);
    } catch (err) {
        console.error(err);
    }
}

main();
