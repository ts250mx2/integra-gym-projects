// =====================================================================
//  scripts/setup-alerts-firstofday.mjs
//  Inserta/actualiza 2 alertas IA en tblAlertas (BD MAESTRA):
//   - primera_visita     : la PRIMERA visita de socio registrada hoy.
//   - primera_asistencia : la PRIMERA asistencia de empleado registrada hoy.
//
//  Credenciales por entorno/.env (ver scripts/_dbenv.mjs).
//  Uso:  node scripts/setup-alerts-firstofday.mjs
// =====================================================================
import mysql from 'mysql2/promise';
import { DB } from './_dbenv.mjs';

const ALERTS = [
    {
        Clave: 'primera_visita',
        Titulo: 'Primera Visita del Día',
        Descripcion: 'El primer acceso de socio registrado hoy (el más temprano): hora y nombre del socio.',
        Icono: 'DoorOpen',
        Prompt: 'Identifica la PRIMERA visita de socio registrada HOY: en tblVisitas busca el acceso con la FechaVisita más temprana de hoy (DATE(FechaVisita) = CURDATE()). Obtén la hora y el nombre del socio (relaciona tblVisitas con tblSocios por IdSocio e IdSucursal; el nombre está en Nombres). Si hoy todavía no hay ninguna visita, indícalo claramente. Resume en una sola frase (ej.: "Primera visita de hoy: Juan Pérez a las 06:32") y agrega un par de líneas de detalle.',
        Orden: 13,
    },
    {
        Clave: 'primera_asistencia',
        Titulo: 'Primera Asistencia del Día',
        Descripcion: 'La primera asistencia de empleado registrada hoy (la más temprana): hora y nombre del empleado.',
        Icono: 'Clock',
        Prompt: 'Identifica la PRIMERA asistencia de empleado registrada HOY: en tblAsistencias busca la asistencia con la FechaAsistencia más temprana de hoy (DATE(FechaAsistencia) = CURDATE()). Obtén la hora y el nombre del empleado (relaciona tblAsistencias con tblUsuarios por IdUsuario; el nombre está en Usuario). Si hoy todavía no hay ninguna asistencia, indícalo claramente. Resume en una sola frase (ej.: "Primera asistencia de hoy: María López a las 05:50") y agrega un par de líneas de detalle.',
        Orden: 14,
    },
];

const UPSERT = `
INSERT INTO tblAlertas
    (Clave, Tipo, Titulo, Descripcion, Icono, ConsultaSQL, Prompt, Formato, Direccion, EstatusNeutro, Orden, Activa)
VALUES (?, 'ai', ?, ?, ?, NULL, ?, 'text', 'neutro', 'info', ?, 1)
ON DUPLICATE KEY UPDATE
    Tipo='ai', Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono),
    Prompt=VALUES(Prompt), ConsultaSQL=NULL, Formato='text', Direccion='neutro',
    EstatusNeutro='info', Orden=VALUES(Orden);`;

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);
        for (const a of ALERTS) {
            await conn.execute(UPSERT, [a.Clave, a.Titulo, a.Descripcion, a.Icono, a.Prompt, a.Orden]);
            console.log(`  ✓ ${a.Clave}`);
        }
        const [rows] = await conn.query('SELECT COUNT(*) AS total FROM tblAlertas');
        console.log(`\nListo. ${rows[0].total} alertas en el catálogo.`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-alerts-firstofday:', err.message);
    process.exit(1);
});
