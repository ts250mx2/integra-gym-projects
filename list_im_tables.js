
const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'IM_IntegraMembers'
    });

    try {
        const [rows] = await connection.execute('SHOW TABLES');
        console.log("TABLES IN IM_IntegraMembers:");
        rows.forEach(r => console.log(`- ${Object.values(r)[0]}`));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
