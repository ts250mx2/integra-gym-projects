const mysql = require('mysql2/promise');
const dbConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDIntegraProjects'
};

async function listTables() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SHOW TABLES');
        console.log('Tables in BDIntegraProjects:');
        rows.forEach(row => console.log(Object.values(row)[0]));
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

listTables();
