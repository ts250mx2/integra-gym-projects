// =====================================================================
//  scripts/setup-alert-schedule.mjs
//  Migración idempotente (BD MAESTRA):
//   - Agrega HoraEnvio (hora local del envío diario) y UltimoEnvio
//     (fecha del último envío, para no duplicar) a tblProyectosAlertas.
//
//  Uso:  node scripts/setup-alert-schedule.mjs
// =====================================================================
import mysql from 'mysql2/promise';
import { DB } from './_dbenv.mjs';

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [DB.database, table, column]
    );
    return rows[0].n > 0;
}

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);

        if (!(await columnExists(conn, 'tblProyectosAlertas', 'HoraEnvio'))) {
            await conn.query(`ALTER TABLE tblProyectosAlertas ADD COLUMN HoraEnvio TIME NULL AFTER Activa`);
            console.log('  + columna tblProyectosAlertas.HoraEnvio');
        } else {
            console.log('  = tblProyectosAlertas.HoraEnvio ya existe');
        }

        if (!(await columnExists(conn, 'tblProyectosAlertas', 'UltimoEnvio'))) {
            await conn.query(`ALTER TABLE tblProyectosAlertas ADD COLUMN UltimoEnvio DATE NULL AFTER HoraEnvio`);
            console.log('  + columna tblProyectosAlertas.UltimoEnvio');
        } else {
            console.log('  = tblProyectosAlertas.UltimoEnvio ya existe');
        }

        console.log('\nListo. Programación de hora de envío disponible.');
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-alert-schedule:', err.message);
    process.exit(1);
});
