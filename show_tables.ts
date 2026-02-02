import { query } from './src/lib/db';

async function main() {
    try {
        const rows = await query('SHOW TABLES');
        console.log("Tables in BDIntegraProjects:", rows);
    } catch (err) {
        console.error(err);
    }
}

main();
