const mysql = require('mysql2/promise');
const dbConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDIntegraProjects'
};

const memberConfig = {
    host: '74.208.192.90',
    user: 'kyk',
    password: 'merkurio',
    database: 'IM_IntegraMembers'
};


async function inspect() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [lectores] = await conn.execute('DESCRIBE tblLectores');
        console.log('--- tblLectores (BDIntegraProjects) ---');
        console.table(lectores);
        await conn.end();

        const mConn = await mysql.createConnection(memberConfig);
        const [params] = await mConn.execute('DESCRIBE tblParametros');
        console.log('--- tblParametros (IM_IntegraMembers) ---');
        console.table(params);
        await mConn.end();

    } catch (error) {
        console.error('Error:', error);
    }
}

inspect();
