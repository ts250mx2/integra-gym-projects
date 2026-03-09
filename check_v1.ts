import { query } from './src/lib/db';

async function main() {
    try {
        const db = 'BDIntegraMembersBestTime';

        const vCols = await query(`SHOW COLUMNS FROM ${db}.tblVentas`, []) as any[];
        console.log("\ntblVentas:", vCols.map(c => c.Field).join(', '));

        const mCols = await query(`SHOW COLUMNS FROM ${db}.tblSocios`, []) as any[];
        console.log("\ntblSocios:", mCols.map(c => c.Field).join(', '));

        const viCols = await query(`SHOW COLUMNS FROM ${db}.tblVisitas`, []) as any[];
        console.log("\ntblVisitas:", viCols.map(c => c.Field).join(', '));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
main();
