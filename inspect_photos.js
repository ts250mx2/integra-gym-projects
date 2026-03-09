
const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'IM_IntegraMembers'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE tblSociosFotos');
        console.log("COLUMNS FOR tblSociosFotos:");
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
