const mysql = require('mysql2/promise');
const dbConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDIntegraProjects'
};

async function getColumns() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tblLectores' AND TABLE_SCHEMA = 'BDIntegraProjects'");
        console.log(rows.map(r => r.COLUMN_NAME));
        await conn.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

getColumns();
