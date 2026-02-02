const mysql = require('mysql2/promise');
const dbConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'IM_IntegraMembers'
};

async function inspect() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const tables = ['tblVisitas', 'tblAsistencias', 'tblAccesosZK', 'tblInterfaceZK'];

        for (const t of tables) {
            try {
                const [cols] = await conn.execute(`DESCRIBE ${t}`);
                console.log(`--- ${t} ---`);
                console.table(cols);
            } catch (e) {
                console.log(`Table ${t} not found in master template.`);
            }
        }
        await conn.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

inspect();
