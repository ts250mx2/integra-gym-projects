
const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'IM_IntegraMembers'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE tblVentas');
        console.log("COLUMNS FOR tblVentas:");
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
        const [rows2] = await connection.execute('DESCRIBE tblDetalleVentas');
        console.log("\nCOLUMNS FOR tblDetalleVentas:");
        rows2.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
