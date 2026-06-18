/**
 * Guarda el DETALLE de una alerta como reporte accesible por UUID, reutilizando
 * la misma tabla e infraestructura del agente de WhatsApp (tblWhatsappReportes →
 * página pública /es/wa-report?r=<uuid>). Así la alerta de WhatsApp manda solo un
 * resumen de una línea + la liga al detalle completo.
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';

let ensured = false;
async function ensureReportTable(): Promise<void> {
    if (ensured) return;
    await query(`CREATE TABLE IF NOT EXISTS tblWhatsappReportes (
        IdReporte INT NOT NULL AUTO_INCREMENT,
        UUID CHAR(36) NOT NULL,
        IdProyecto INT NOT NULL,
        Telefono VARCHAR(30) NULL,
        Pregunta TEXT NULL,
        Respuesta TEXT NULL,
        Titulo VARCHAR(255) NULL,
        Datos LONGTEXT NULL,
        FechaAct DATETIME NULL,
        PRIMARY KEY (IdReporte),
        KEY idx_uuid (UUID)
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1`);
    ensured = true;
}

// Guarda el detalle y devuelve el UUID para armar la liga.
export async function saveAlertReport(projectId: number, titulo: string, detalle: string): Promise<string> {
    await ensureReportTable();
    const uuid = uuidv4();
    const datos = JSON.stringify({ title: titulo, tables: [], charts: [] });
    await query(
        `INSERT INTO tblWhatsappReportes (UUID, IdProyecto, Telefono, Pregunta, Respuesta, Titulo, Datos, FechaAct)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuid, projectId, null, '', (detalle || '').slice(0, 5000), (titulo || '').slice(0, 250), datos]
    );
    return uuid;
}

// Base URL pública para la liga. Prioriza APP_PUBLIC_URL; si no, deriva de los
// headers del proxy / origin de la petición. http para localhost, https para el resto.
export function computeBaseUrl(req: Request): string {
    const env = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (env) return env;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (host) {
        const isLocal = /localhost|127\.0\.0\.1/.test(host);
        const proto = req.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
        return `${proto}://${host}`;
    }
    try { return new URL(req.url).origin; } catch { return ''; }
}

export function reportLink(baseUrl: string, uuid: string): string {
    return baseUrl ? `${baseUrl}/es/wa-report?r=${uuid}` : '';
}
