const mysql = require('mysql2/promise');
const dbConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDIntegraProjects'
};

async function inspect() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [lectores] = await conn.execute('DESCRIBE tblLectores');
        console.log('--- tblLectores (BDIntegraProjects) ---');
        console.table(lectores);
        await conn.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

inspect();
