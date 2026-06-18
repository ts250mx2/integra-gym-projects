-- =====================================================================
--  Asignación de alertas por proyecto + destinatarios + alertas IA
--  (BD MAESTRA: BDIntegraProjects)
-- =====================================================================

-- 1) Extensión de tblAlertas: tipo de alerta y prompt para alertas IA.
--    Tipo = 'sql' (evaluada por consulta + umbrales) | 'ai' (generada por IA).
ALTER TABLE tblAlertas ADD COLUMN Tipo VARCHAR(10) NOT NULL DEFAULT 'sql' AFTER Clave;
ALTER TABLE tblAlertas ADD COLUMN Prompt TEXT NULL AFTER ConsultaSQL;
-- Las alertas IA no usan ConsultaSQL, así que la hacemos opcional.
ALTER TABLE tblAlertas MODIFY ConsultaSQL TEXT NULL;

-- 2) Qué alertas están activas para cada proyecto.
CREATE TABLE IF NOT EXISTS tblProyectosAlertas (
    IdProyectoAlerta    INT         NOT NULL AUTO_INCREMENT,
    IdProyecto          INT         NOT NULL,
    IdAlerta            INT         NOT NULL,
    Activa              TINYINT     NOT NULL DEFAULT 1,
    FechaAct            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdProyectoAlerta),
    UNIQUE KEY uq_proy_alerta (IdProyecto, IdAlerta)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- 3) Teléfonos destinatarios de las alertas, por proyecto.
CREATE TABLE IF NOT EXISTS tblProyectosAlertasTelefonos (
    IdProyectoAlertaTelefono INT     NOT NULL AUTO_INCREMENT,
    IdProyecto          INT         NOT NULL,
    Telefono            VARCHAR(30) NOT NULL,
    Nombre              VARCHAR(160) NULL,
    Activa              TINYINT     NOT NULL DEFAULT 1,
    FechaAct            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IdProyectoAlertaTelefono),
    KEY idx_proy (IdProyecto)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- 4) Alertas IA sugeridas.
INSERT INTO tblAlertas (Clave, Tipo, Titulo, Descripcion, Icono, ConsultaSQL, Prompt, Formato, Direccion, EstatusNeutro, MensajeExito, Orden, Activa)
VALUES
    ('daily_findings', 'ai', 'Hallazgos Importantes del Día',
     'Resumen generado por IA con los hallazgos más relevantes del día (ventas, accesos, vencimientos, cancelaciones y anomalías).',
     'Sparkles', NULL,
     'Analiza los datos de HOY del gimnasio y redacta un resumen breve (3 a 5 viñetas) con los hallazgos más importantes del día: ventas de hoy comparadas con días recientes, accesos/asistencia, socios nuevos, membresías que vencen hoy o vencidas recientemente, cancelaciones y cualquier anomalía relevante. Tono ejecutivo y accionable, en español, en texto plano listo para enviar por WhatsApp.',
     'text', 'neutro', 'info', NULL, 11, 1),
    ('improvement_suggestions', 'ai', 'Sugerencias para Mejoras',
     'Recomendaciones generadas por IA con oportunidades concretas para aumentar ingresos, retención y asistencia.',
     'Lightbulb', NULL,
     'Con base en los datos de los últimos 30 días del gimnasio, identifica 3 oportunidades concretas de mejora para aumentar ingresos, retención y asistencia. Para cada sugerencia incluye una acción específica y el dato que la respalda. Tono de consultor experto en gestión de gimnasios, en español, breve y accionable, en texto plano listo para WhatsApp.',
     'text', 'neutro', 'info', NULL, 12, 1)
ON DUPLICATE KEY UPDATE
    Tipo=VALUES(Tipo), Titulo=VALUES(Titulo), Descripcion=VALUES(Descripcion), Icono=VALUES(Icono),
    Prompt=VALUES(Prompt), Formato=VALUES(Formato), Direccion=VALUES(Direccion),
    EstatusNeutro=VALUES(EstatusNeutro), Orden=VALUES(Orden);
