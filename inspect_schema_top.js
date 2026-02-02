const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'IM_IntegraMembers'
    });

    const [rows] = await connection.execute('DESCRIBE tblSucursales');
    console.log(rows.slice(0, 5));
    await connection.end();
}

main().catch(console.error);
