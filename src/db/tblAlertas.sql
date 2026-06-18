-- =====================================================================
--  tblAlertas  —  Catálogo de alertas del Dashboard V1
-- =====================================================================
--  Esta tabla vive en la BD MAESTRA (BDIntegraProjects), junto a
--  tblProyectos. Las definiciones de alerta son GLOBALES: la misma
--  alerta aplica a todos los gimnasios. El campo `ConsultaSQL` se
--  ejecuta contra la BD del proyecto SELECCIONADO en cada consulta.
--
--  Para agregar una alerta nueva basta con insertar un renglón aquí
--  (o desde scripts/setup-alerts.mjs). No requiere tocar código.
--
--  REGLAS DE LA CONSULTA (ConsultaSQL):
--   * Debe ser SOLO de lectura (SELECT / WITH). La API rechaza el resto.
--   * Debe devolver UNA fila con la columna numérica `valor`
--     (y opcionalmente `valor2` para un segundo dato del mensaje).
--   * El estatus y el mensaje NO se calculan en SQL: se evalúan en la
--     API a partir de los umbrales/plantillas de abajo. Esto mantiene
--     el funcionamiento correcto en modo "Proyectos Integrados", donde
--     los `valor` de cada gimnasio se SUMAN antes de evaluar.
--
--  EVALUACIÓN DEL ESTATUS (según `Direccion`):
--   * 'asc'    (más es mejor):  valor >= UmbralExito        -> success
--                               valor >= UmbralAdvertencia  -> warning
--                               en otro caso                -> danger
--   * 'desc'   (menos es mejor):valor <= UmbralExito        -> success
--                               valor <= UmbralAdvertencia  -> warning
--                               en otro caso                -> danger
--   * 'neutro' (informativa):   siempre usa `EstatusNeutro`
--
--  PLANTILLAS DE MENSAJE (placeholders):
--   {valor}   -> `valor` formateado según `Formato`
--   {n}       -> `valor` como entero
--   {valor2}  -> `valor2` como entero
--   {valor2f} -> `valor2` formateado como moneda
-- =====================================================================

CREATE TABLE IF NOT EXISTS tblAlertas (
    IdAlerta            INT             NOT NULL AUTO_INCREMENT,
    Clave               VARCHAR(80)     NOT NULL,
    Titulo              VARCHAR(160)    NOT NULL,
    Descripcion         VARCHAR(500)    NULL,
    Icono               VARCHAR(40)     NOT NULL DEFAULT 'Bell',
    ConsultaSQL         TEXT            NOT NULL,
    Formato             VARCHAR(20)     NOT NULL DEFAULT 'number',   -- number | currency | percent
    Direccion           VARCHAR(10)     NOT NULL DEFAULT 'neutro',   -- asc | desc | neutro
    UmbralExito         DECIMAL(18,2)   NULL,
    UmbralAdvertencia   DECIMAL(18,2)   NULL,
    EstatusNeutro       VARCHAR(10)     NOT NULL DEFAULT 'info',     -- success | warning | danger | info
    MensajeExito        VARCHAR(500)    NULL,
    MensajeAdvertencia  VARCHAR(500)    NULL,
    MensajePeligro      VARCHAR(500)    NULL,
    Orden               INT             NOT NULL DEFAULT 0,
    Activa              TINYINT         NOT NULL DEFAULT 1,
    FechaCreacion       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdAlerta),
    UNIQUE KEY uq_alertas_clave (Clave)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- =====================================================================
--  Seed: 10 alertas sugeridas
-- =====================================================================

-- 1) Ventas de Hoy
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, Orden)
VALUES
    ('daily_sales', 'Ventas de Hoy',
     'Monitorea el total vendido y el número de operaciones registradas durante el día de hoy.',
     'DollarSign',
     'SELECT COALESCE(SUM(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
     'currency', 'asc', 0.01, 0,
     'Hoy se han registrado {valor} en ventas a través de {valor2} operaciones.',
     'Aún no se registran ventas para el día de hoy.',
     1)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), Orden=VALUES(Orden);

-- 2) Accesos de Hoy
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, Orden)
VALUES
    ('daily_visits', 'Accesos de Hoy',
     'Cuenta las visitas/accesos de socios registrados durante el día de hoy.',
     'DoorOpen',
     'SELECT COUNT(V.IdVisita) AS valor FROM tblVisitas V LEFT JOIN tblSucursales S ON V.IdSucursal = S.IdSucursal WHERE (S.Status IS NULL OR S.Status <> 2) AND DATE(V.FechaVisita) = CURDATE()',
     'number', 'asc', 1, 0,
     'Hoy han ingresado {n} socios al gimnasio.',
     'No se registran accesos de socios para el día de hoy.',
     2)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), Orden=VALUES(Orden);

-- 3) Socios Activos
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajePeligro, Orden)
VALUES
    ('active_members', 'Socios Activos',
     'Total de socios con membresía vigente (no vencida) en el proyecto seleccionado.',
     'Users',
     'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento >= CURDATE() AND (B.Status IS NULL OR B.Status <> 2)',
     'number', 'asc', 1, 1,
     'Actualmente cuentas con {n} socios con membresía vigente.',
     'No hay socios con membresía vigente. Revisa tu cartera de clientes.',
     3)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajePeligro=VALUES(MensajePeligro), Orden=VALUES(Orden);

-- 4) Membresías por Vencer (próximos 7 días)
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, MensajePeligro, Orden)
VALUES
    ('expiring_7d', 'Membresías por Vencer (7 días)',
     'Socios cuya membresía vence en los próximos 7 días. Útil para campañas de renovación anticipada.',
     'CalendarClock',
     'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND (B.Status IS NULL OR B.Status <> 2)',
     'number', 'desc', 0, 10,
     'Ningún socio vence en los próximos 7 días.',
     '{n} membresías vencen en los próximos 7 días. ¡Contáctalos para renovar!',
     '¡Atención! {n} membresías vencen en los próximos 7 días. Prioriza las renovaciones.',
     4)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), MensajePeligro=VALUES(MensajePeligro), Orden=VALUES(Orden);

-- 5) Membresías Vencidas Recientes (últimos 30 días)
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajePeligro, Orden)
VALUES
    ('expired_30d', 'Membresías Vencidas Recientes (30 días)',
     'Socios cuya membresía venció en los últimos 30 días y aún no renuevan. Oportunidad de recuperación (win-back).',
     'UserX',
     'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND (B.Status IS NULL OR B.Status <> 2)',
     'number', 'desc', 0, 0,
     'No tienes socios vencidos sin renovar en los últimos 30 días.',
     '{n} socios vencieron en los últimos 30 días y no han renovado. ¡Es una gran oportunidad de recuperación!',
     5)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajePeligro=VALUES(MensajePeligro), Orden=VALUES(Orden);

-- 6) Socios Activos sin Asistir (últimos 30 días)
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, Orden)
VALUES
    ('active_no_visits_30d', 'Socios Activos sin Asistir (30 días)',
     'Socios con membresía vigente que no registran ningún acceso en los últimos 30 días. Riesgo de abandono.',
     'UserMinus',
     'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento >= CURDATE() AND (B.Status IS NULL OR B.Status <> 2) AND S.IdSocio NOT IN (SELECT DISTINCT IdSocio FROM tblVisitas WHERE FechaVisita >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))',
     'number', 'desc', 0, 999999,
     'Todos tus socios activos han asistido en los últimos 30 días.',
     '{n} socios activos no asisten desde hace 30 días. ¡Motívalos a regresar antes de que abandonen!',
     6)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), Orden=VALUES(Orden);

-- 7) Ventas del Mes (acumulado)
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, EstatusNeutro, MensajeExito, Orden)
VALUES
    ('sales_mtd', 'Ventas del Mes (acumulado)',
     'Total de ventas acumuladas desde el primer día del mes en curso hasta hoy.',
     'TrendingUp',
     'SELECT COALESCE(SUM(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND YEAR(M.FechaMovimiento) = YEAR(CURDATE()) AND MONTH(M.FechaMovimiento) = MONTH(CURDATE())',
     'currency', 'neutro', 'info',
     'Llevas {valor} en ventas acumuladas este mes a través de {valor2} operaciones.',
     7)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), EstatusNeutro=VALUES(EstatusNeutro), MensajeExito=VALUES(MensajeExito), Orden=VALUES(Orden);

-- 8) Ticket Promedio de Hoy
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, Orden)
VALUES
    ('avg_ticket_today', 'Ticket Promedio de Hoy',
     'Importe promedio por operación registrada el día de hoy.',
     'Receipt',
     'SELECT COALESCE(AVG(M.total),0) AS valor, COUNT(M.IdMovimiento) AS valor2 FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
     'currency', 'asc', 0.01, 0,
     'El ticket promedio de hoy es de {valor} sobre {valor2} ventas.',
     'Aún no hay ventas hoy para calcular el ticket promedio.',
     8)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), Orden=VALUES(Orden);

-- 9) Cancelaciones de Hoy
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajePeligro, Orden)
VALUES
    ('cancellations_today', 'Cancelaciones de Hoy',
     'Movimientos cancelados (Status = 2) durante el día de hoy. Útil para control operativo y prevención de fraude.',
     'Ban',
     'SELECT COUNT(M.IdMovimiento) AS valor FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 2 AND (S.Status IS NULL OR S.Status <> 2) AND DATE(M.FechaMovimiento) = CURDATE()',
     'number', 'desc', 0, 0,
     'No se han cancelado movimientos hoy.',
     'Se han cancelado {n} movimientos hoy. Revisa la operación de tus sucursales.',
     9)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajePeligro=VALUES(MensajePeligro), Orden=VALUES(Orden);

-- 10) Vencimientos de Hoy
INSERT INTO tblAlertas
    (Clave, Titulo, Descripcion, Icono, ConsultaSQL, Formato, Direccion, UmbralExito, UmbralAdvertencia, MensajeExito, MensajeAdvertencia, Orden)
VALUES
    ('expiring_today', 'Vencimientos de Hoy',
     'Membresías que vencen exactamente el día de hoy. Última oportunidad de renovación inmediata.',
     'CalendarX',
     'SELECT COUNT(S.IdSocio) AS valor FROM tblSocios S LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal WHERE S.Status = 0 AND S.FechaVencimiento = CURDATE() AND (B.Status IS NULL OR B.Status <> 2)',
     'number', 'desc', 0, 999999,
     'Ninguna membresía vence hoy.',
     '{n} membresías vencen HOY. Es la última oportunidad de renovación inmediata.',
     10)
ON DUPLICATE KEY UPDATE Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono), ConsultaSQL=VALUES(ConsultaSQL), Formato=VALUES(Formato), Direccion=VALUES(Direccion), UmbralExito=VALUES(UmbralExito), UmbralAdvertencia=VALUES(UmbralAdvertencia), MensajeExito=VALUES(MensajeExito), MensajeAdvertencia=VALUES(MensajeAdvertencia), Orden=VALUES(Orden);
