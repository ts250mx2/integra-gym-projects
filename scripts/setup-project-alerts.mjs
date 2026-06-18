// =====================================================================
//  scripts/setup-project-alerts.mjs
//  Migración idempotente (BD MAESTRA):
//   - Agrega columnas Tipo / Prompt a tblAlertas y hace ConsultaSQL opcional.
//   - Crea tblProyectosAlertas (alertas activas por proyecto).
//   - Crea tblProyectosAlertasTelefonos (destinatarios por proyecto).
//   - Inserta/actualiza las 2 alertas IA (hallazgos y sugerencias).
//
//  Uso:  node scripts/setup-project-alerts.mjs
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

const AI_ALERTS = [
    {
        Clave: 'daily_findings', Tipo: 'ai', Titulo: 'Hallazgos Importantes del Día',
        Descripcion: 'Resumen generado por IA con los hallazgos más relevantes del día (ventas, accesos, vencimientos, cancelaciones y anomalías).',
        Icono: 'Sparkles',
        Prompt: 'Analiza los datos de HOY del gimnasio y redacta un resumen breve (3 a 5 viñetas) con los hallazgos más importantes del día: ventas de hoy comparadas con días recientes, accesos/asistencia, socios nuevos, membresías que vencen hoy o vencidas recientemente, cancelaciones y cualquier anomalía relevante. Tono ejecutivo y accionable, en español, en texto plano listo para enviar por WhatsApp.',
        Orden: 11,
    },
    {
        Clave: 'improvement_suggestions', Tipo: 'ai', Titulo: 'Sugerencias para Mejoras',
        Descripcion: 'Recomendaciones generadas por IA con oportunidades concretas para aumentar ingresos, retención y asistencia.',
        Icono: 'Lightbulb',
        Prompt: 'Con base en los datos de los últimos 30 días del gimnasio, identifica 3 oportunidades concretas de mejora para aumentar ingresos, retención y asistencia. Para cada sugerencia incluye una acción específica y el dato que la respalda. Tono de consultor experto en gestión de gimnasios, en español, breve y accionable, en texto plano listo para WhatsApp.',
        Orden: 12,
    },
];

const CREATE_PROY_ALERTAS = `
CREATE TABLE IF NOT EXISTS tblProyectosAlertas (
    IdProyectoAlerta    INT         NOT NULL AUTO_INCREMENT,
    IdProyecto          INT         NOT NULL,
    IdAlerta            INT         NOT NULL,
    Activa              TINYINT     NOT NULL DEFAULT 1,
    FechaAct            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdProyectoAlerta),
    UNIQUE KEY uq_proy_alerta (IdProyecto, IdAlerta)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;`;

const CREATE_PROY_ALERTAS_TEL = `
CREATE TABLE IF NOT EXISTS tblProyectosAlertasTelefonos (
    IdProyectoAlertaTelefono INT     NOT NULL AUTO_INCREMENT,
    IdProyecto          INT         NOT NULL,
    Telefono            VARCHAR(30) NOT NULL,
    Nombre              VARCHAR(160) NULL,
    Activa              TINYINT     NOT NULL DEFAULT 1,
    FechaAct            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdProyectoAlertaTelefono),
    KEY idx_proy (IdProyecto)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;`;

const UPSERT_AI = `
INSERT INTO tblAlertas
    (Clave, Tipo, Titulo, Descripcion, Icono, ConsultaSQL, Prompt, Formato, Direccion, EstatusNeutro, Orden, Activa)
VALUES (?, ?, ?, ?, ?, NULL, ?, 'text', 'neutro', 'info', ?, 1)
ON DUPLICATE KEY UPDATE
    Tipo=VALUES(Tipo), Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion),
    Icono=VALUES(Icono), Prompt=VALUES(Prompt), Formato=VALUES(Formato),
    Direccion=VALUES(Direccion), EstatusNeutro=VALUES(EstatusNeutro), Orden=VALUES(Orden);`;

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);

        // 1. Columnas nuevas en tblAlertas
        if (!(await columnExists(conn, 'tblAlertas', 'Tipo'))) {
            await conn.query(`ALTER TABLE tblAlertas ADD COLUMN Tipo VARCHAR(10) NOT NULL DEFAULT 'sql' AFTER Clave`);
            console.log('  + columna tblAlertas.Tipo');
        } else { console.log('  = tblAlertas.Tipo ya existe'); }

        if (!(await columnExists(conn, 'tblAlertas', 'Prompt'))) {
            await conn.query(`ALTER TABLE tblAlertas ADD COLUMN Prompt TEXT NULL AFTER ConsultaSQL`);
            console.log('  + columna tblAlertas.Prompt');
        } else { console.log('  = tblAlertas.Prompt ya existe'); }

        // ConsultaSQL opcional (las alertas IA no la usan). Idempotente.
        await conn.query(`ALTER TABLE tblAlertas MODIFY ConsultaSQL TEXT NULL`);
        console.log('  = tblAlertas.ConsultaSQL ahora es NULL-able');

        // 2. Tablas de asignación
        await conn.query(CREATE_PROY_ALERTAS);
        console.log('  = tabla tblProyectosAlertas lista');
        await conn.query(CREATE_PROY_ALERTAS_TEL);
        console.log('  = tabla tblProyectosAlertasTelefonos lista');

        // 3. Alertas IA
        for (const a of AI_ALERTS) {
            await conn.execute(UPSERT_AI, [a.Clave, a.Tipo, a.Titulo, a.Descripcion, a.Icono, a.Prompt, a.Orden]);
            console.log(`  ✓ alerta IA: ${a.Clave}`);
        }

        const [rows] = await conn.query("SELECT COUNT(*) AS total FROM tblAlertas");
        console.log(`\nListo. ${rows[0].total} alertas en tblAlertas (incluye SQL e IA).`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-project-alerts:', err.message);
    process.exit(1);
});
