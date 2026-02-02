
import mysql from 'mysql2/promise';

async function main() {
    // 1. Get Project Config
    const masterPool = mysql.createPool({
        host: '74.208.192.90',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDIntegraProjects',
        connectionLimit: 1
    });

    try {
        const [projects] = await masterPool.execute('SELECT * FROM tblProyectos LIMIT 1') as any[];
        const project = projects[0];
        console.log(`Connecting to ${project.BaseDatos}...`);

        const projectPool = mysql.createPool({
            host: project.Servidor,
            user: project.UsuarioBD,
            password: project.PasswordBD,
            database: project.BaseDatos,
            connectionLimit: 1
        });

        // Check Sales
        const [sales] = await projectPool.execute('SELECT IdVenta, FechaVenta, Total, Status FROM tblVentas ORDER BY FechaVenta DESC LIMIT 5');
        console.log("Recent Sales:", sales);

        // Check Branch ID
        const [branches] = await projectPool.execute('SELECT IdSucursal, Sucursal FROM tblSucursales');
        console.log("Branches:", branches);

        await projectPool.end();
    } catch (e) {
        console.error(e);
    } finally {
        await masterPool.end();
    }
}

main();
