// =====================================================================
//  scripts/setup-alert-default-hour.mjs
//  Hora de envío por DEFAULT = 22:30 (BD MAESTRA):
//   - Pone DEFAULT '22:30:00' a tblProyectosAlertas.HoraEnvio.
//   - Backfill: asigna 22:30 a las asignaciones que aún no tienen hora.
//
//  Uso:  node scripts/setup-alert-default-hour.mjs
// =====================================================================
import mysql from 'mysql2/promise';
import { DB } from './_dbenv.mjs';

const DEFAULT_HORA = '22:30:00';

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);

        await conn.query(`ALTER TABLE tblProyectosAlertas MODIFY HoraEnvio TIME NULL DEFAULT '${DEFAULT_HORA}'`);
        console.log(`  = HoraEnvio con DEFAULT ${DEFAULT_HORA}`);

        const [res] = await conn.query(`UPDATE tblProyectosAlertas SET HoraEnvio = ? WHERE HoraEnvio IS NULL`, [DEFAULT_HORA]);
        console.log(`  = backfill: ${res.affectedRows} asignación(es) sin hora ahora a las 22:30`);

        console.log('\nListo. La hora de envío por default es 22:30.');
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-alert-default-hour:', err.message);
    process.exit(1);
});
