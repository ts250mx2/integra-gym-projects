// =====================================================================
//  scripts/setup-alert-recipients.mjs
//  Migración idempotente (BD MAESTRA):
//   - Agrega IdAlerta a tblProyectosAlertasTelefonos para que los
//     destinatarios sean POR ALERTA (no por proyecto).
//
//  Uso:  node scripts/setup-alert-recipients.mjs
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

async function indexExists(conn, table, index) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [DB.database, table, index]
    );
    return rows[0].n > 0;
}

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);

        if (!(await columnExists(conn, 'tblProyectosAlertasTelefonos', 'IdAlerta'))) {
            await conn.query(`ALTER TABLE tblProyectosAlertasTelefonos ADD COLUMN IdAlerta INT NULL AFTER IdProyecto`);
            console.log('  + columna tblProyectosAlertasTelefonos.IdAlerta');
        } else {
            console.log('  = tblProyectosAlertasTelefonos.IdAlerta ya existe');
        }

        if (!(await indexExists(conn, 'tblProyectosAlertasTelefonos', 'idx_proy_alerta'))) {
            await conn.query(`ALTER TABLE tblProyectosAlertasTelefonos ADD INDEX idx_proy_alerta (IdProyecto, IdAlerta)`);
            console.log('  + índice idx_proy_alerta');
        } else {
            console.log('  = índice idx_proy_alerta ya existe');
        }

        const [[legacy]] = await conn.query(
            'SELECT COUNT(*) AS n FROM tblProyectosAlertasTelefonos WHERE IdAlerta IS NULL'
        );
        if (legacy.n > 0) {
            console.log(`  ⚠ ${legacy.n} destinatario(s) previo(s) sin alerta (IdAlerta NULL). Ahora los destinatarios son por alerta; reasígnalos desde el modal.`);
        }

        console.log('\nListo. Destinatarios de alertas ahora son por alerta.');
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-alert-recipients:', err.message);
    process.exit(1);
});
