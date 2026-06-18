// =====================================================================
//  scripts/setup-alerts.mjs
//  Crea (si no existe) la tabla tblAlertas en la BD MAESTRA e inserta /
//  actualiza las 10 alertas sugeridas. Es IDEMPOTENTE: se puede correr
//  las veces que quieras; usa ON DUPLICATE KEY (Clave) para refrescar.
//
//  Uso:  node scripts/setup-alerts.mjs
// =====================================================================
import mysql from 'mysql2/promise';
import { DB } from './_dbenv.mjs';

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS tblAlertas (
    IdAlerta            INT             NOT NULL AUTO_INCREMENT,
    Clave               VARCHAR(80)     NOT NULL,
    Titulo              VARCHAR(160)    NOT NULL,
    Descripcion         VARCHAR(500)    NULL,
    Icono               VARCHAR(40)     NOT NULL DEFAULT 'Bell',
    ConsultaSQL         TEXT            NOT NULL,
    Formato             VARCHAR(20)     NOT NULL DEFAULT 'number',
    Direccion           VARCHAR(10)     NOT NULL DEFAULT 'neutro',
    UmbralExito         DECIMAL(18,2)   NULL,
    UmbralAdvertencia   DECIMAL(18,2)   NULL,
    EstatusNeutro       VARCHAR(10)     NOT NULL DEFAULT 'info',
    MensajeExito        VARCHAR(500)    NULL,
    MensajeAdvertencia  VARCHAR(500)    NULL,
    MensajePeligro      VARCHAR(500)    NULL,
    Orden               INT             NOT NULL DEFAULT 0,
    Activa              TINYINT         NOT NULL DEFAULT 1,
    FechaCreacion       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdAlerta),
    UNIQUE KEY uq_alertas_clave (Clave)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
`;

// Cada alerta: valores por defecto null para columnas no usadas.
const ALERTS = [
    {
        Clave: 'daily_sales', Titulo: 'Ventas de Hoy',
        Descripcion: 'Monitorea el total vendido y el número de operaciones registradas durante el día de hoy.',
        Icono: 'DollarSign',
        ConsultaSQL: 'SELECT COALESCE(SUM(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
        Formato: 'currency', Direccion: 'asc', UmbralExito: 0.01, UmbralAdvertencia: 0, EstatusNeutro: 'info',
        MensajeExito: 'Hoy se han registrado {valor} en ventas a través de {valor2} operaciones.',
        MensajeAdvertencia: 'Aún no se registran ventas para el día de hoy.',
        MensajePeligro: null, Orden: 1,
    },
    {
        Clave: 'daily_visits', Titulo: 'Accesos de Hoy',
        Descripcion: 'Cuenta las visitas/accesos de socios registrados durante el día de hoy.',
        Icono: 'DoorOpen',
        ConsultaSQL: 'SELECT COUNT(V.IdVisita) AS valor FROM tblVisitas V LEFT JOIN tblSucursales S ON V.IdSucursal = S.IdSucursal WHERE (S.Status IS NULL OR S.Status <> 2) AND DATE(V.FechaVisita) = CURDATE()',
        Formato: 'number', Direccion: 'asc', UmbralExito: 1, UmbralAdvertencia: 0, EstatusNeutro: 'info',
        MensajeExito: 'Hoy han ingresado {n} socios al gimnasio.',
        MensajeAdvertencia: 'No se registran accesos de socios para el día de hoy.',
        MensajePeligro: null, Orden: 2,
    },
    {
        Clave: 'active_members', Titulo: 'Socios Activos',
        Descripcion: 'Total de socios con membresía vigente (no vencida) en el proyecto seleccionado.',
        Icono: 'Users',
        ConsultaSQL: 'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento >= CURDATE() AND (B.Status IS NULL OR B.Status <> 2)',
        Formato: 'number', Direccion: 'asc', UmbralExito: 1, UmbralAdvertencia: 1, EstatusNeutro: 'info',
        MensajeExito: 'Actualmente cuentas con {n} socios con membresía vigente.',
        MensajeAdvertencia: null,
        MensajePeligro: 'No hay socios con membresía vigente. Revisa tu cartera de clientes.', Orden: 3,
    },
    {
        Clave: 'expiring_7d', Titulo: 'Membresías por Vencer (7 días)',
        Descripcion: 'Socios cuya membresía vence en los próximos 7 días. Útil para campañas de renovación anticipada.',
        Icono: 'CalendarClock',
        ConsultaSQL: 'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND (B.Status IS NULL OR B.Status <> 2)',
        Formato: 'number', Direccion: 'desc', UmbralExito: 0, UmbralAdvertencia: 10, EstatusNeutro: 'info',
        MensajeExito: 'Ningún socio vence en los próximos 7 días.',
        MensajeAdvertencia: '{n} membresías vencen en los próximos 7 días. ¡Contáctalos para renovar!',
        MensajePeligro: '¡Atención! {n} membresías vencen en los próximos 7 días. Prioriza las renovaciones.', Orden: 4,
    },
    {
        Clave: 'expired_30d', Titulo: 'Membresías Vencidas Recientes (30 días)',
        Descripcion: 'Socios cuya membresía venció en los últimos 30 días y aún no renuevan. Oportunidad de recuperación (win-back).',
        Icono: 'UserX',
        ConsultaSQL: 'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND (B.Status IS NULL OR B.Status <> 2)',
        Formato: 'number', Direccion: 'desc', UmbralExito: 0, UmbralAdvertencia: 0, EstatusNeutro: 'info',
        MensajeExito: 'No tienes socios vencidos sin renovar en los últimos 30 días.',
        MensajeAdvertencia: null,
        MensajePeligro: '{n} socios vencieron en los últimos 30 días y no han renovado. ¡Es una gran oportunidad de recuperación!', Orden: 5,
    },
    {
        Clave: 'active_no_visits_30d', Titulo: 'Socios Activos sin Asistir (30 días)',
        Descripcion: 'Socios con membresía vigente que no registran ningún acceso en los últimos 30 días. Riesgo de abandono.',
        Icono: 'UserMinus',
        ConsultaSQL: 'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento >= CURDATE() AND (B.Status IS NULL OR B.Status <> 2) AND S.IdSocio NOT IN (SELECT DISTINCT IdSocio FROM tblVisitas WHERE FechaVisita >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))',
        Formato: 'number', Direccion: 'desc', UmbralExito: 0, UmbralAdvertencia: 999999, EstatusNeutro: 'info',
        MensajeExito: 'Todos tus socios activos han asistido en los últimos 30 días.',
        MensajeAdvertencia: '{n} socios activos no asisten desde hace 30 días. ¡Motívalos a regresar antes de que abandonen!',
        MensajePeligro: null, Orden: 6,
    },
    {
        Clave: 'sales_mtd', Titulo: 'Ventas del Mes (acumulado)',
        Descripcion: 'Total de ventas acumuladas desde el primer día del mes en curso hasta hoy.',
        Icono: 'TrendingUp',
        ConsultaSQL: 'SELECT COALESCE(SUM(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND YEAR(M.FechaMovimiento) = YEAR(CURDATE()) AND MONTH(M.FechaMovimiento) = MONTH(CURDATE())',
        Formato: 'currency', Direccion: 'neutro', UmbralExito: null, UmbralAdvertencia: null, EstatusNeutro: 'info',
        MensajeExito: 'Llevas {valor} en ventas acumuladas este mes a través de {valor2} operaciones.',
        MensajeAdvertencia: null, MensajePeligro: null, Orden: 7,
    },
    {
        Clave: 'avg_ticket_today', Titulo: 'Ticket Promedio de Hoy',
        Descripcion: 'Importe promedio por operación registrada el día de hoy.',
        Icono: 'Receipt',
        ConsultaSQL: 'SELECT COALESCE(AVG(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
        Formato: 'currency', Direccion: 'asc', UmbralExito: 0.01, UmbralAdvertencia: 0, EstatusNeutro: 'info',
        MensajeExito: 'El ticket promedio de hoy es de {valor} sobre {valor2} ventas.',
        MensajeAdvertencia: 'Aún no hay ventas hoy para calcular el ticket promedio.',
        MensajePeligro: null, Orden: 8,
    },
    {
        Clave: 'cancellations_today', Titulo: 'Cancelaciones de Hoy',
        Descripcion: 'Movimientos cancelados (Status = 2) durante el día de hoy. Útil para control operativo y prevención de fraude.',
        Icono: 'Ban',
        ConsultaSQL: 'SELECT COUNT(M.IdMovimiento) AS valor FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 2 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
        Formato: 'number', Direccion: 'desc', UmbralExito: 0, UmbralAdvertencia: 0, EstatusNeutro: 'info',
        MensajeExito: 'No se han cancelado movimientos hoy.',
        MensajeAdvertencia: null,
        MensajePeligro: 'Se han cancelado {n} movimientos hoy. Revisa la operación de tus sucursales.', Orden: 9,
    },
    {
        Clave: 'expiring_today', Titulo: 'Vencimientos de Hoy',
        Descripcion: 'Membresías que vencen exactamente el día de hoy. Última oportunidad de renovación inmediata.',
        Icono: 'CalendarX',
        ConsultaSQL: 'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento = CURDATE() AND (B.Status IS NULL OR B.Status <> 2)',
        Formato: 'number', Direccion: 'desc', UmbralExito: 0, UmbralAdvertencia: 999999, EstatusNeutro: 'info',
        MensajeExito: 'Ninguna membresía vence hoy.',
        MensajeAdvertencia: '{n} membresías vencen HOY. Es la última oportunidad de renovación inmediata.',
        MensajePeligro: null, Orden: 10,
    },
];

const UPSERT = `
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, EstatusNeutro, MensajeExito, MensajeAdvertencia, MensajePeligro, Orden, Activa)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
ON DUPLICATE KEY UPDATE
    Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono),
    ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion),
    UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia),
    EstatusNeutro=VALUES(EstatusNeutro), MensajeExito=VALUES(MensajeExito),
    MensajeAdvertencia=VALUES(MensajeAdvertencia), MensajePeligro=VALUES(MensajePeligro),
    Orden=VALUES(Orden);
`;

async function main() {
    const conn = await mysql.createConnection(DB);
    try {
        console.log(`Conectado a ${DB.host}/${DB.database}`);
        await conn.query(CREATE_TABLE);
        console.log('Tabla tblAlertas lista.');

        for (const a of ALERTS) {
            await conn.execute(UPSERT, [
                a.Clave, a.Titulo, a.Descripcion, a.Icono, a.ConsultaSQL, a.Formato,
                a.Direccion, a.UmbralExito, a.UmbralAdvertencia, a.EstatusNeutro,
                a.MensajeExito, a.MensajeAdvertencia, a.MensajePeligro, a.Orden,
            ]);
            console.log(`  ✓ ${a.Clave}`);
        }

        const [rows] = await conn.query('SELECT COUNT(*) AS total FROM tblAlertas WHERE Activa = 1');
        console.log(`\nListo. ${rows[0].total} alertas activas en tblAlertas.`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error en setup-alerts:', err.message);
    process.exit(1);
});
