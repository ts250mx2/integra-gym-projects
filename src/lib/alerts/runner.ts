/**
 * Orquestador de alertas por proyecto.
 *  - Carga las alertas ACTIVAS del proyecto (catálogo ∩ asignación).
 *  - Construye el mensaje: tipo 'sql' → evaluador; tipo 'ai' → generador IA.
 *  - Opcionalmente lo envía a los teléfonos destinatarios vía el cliente outbound.
 */
import { query } from '@/lib/db';
import { evaluateSqlAlert } from './evaluate';
import { generateAiAlert } from './generate';
import { sendAlertMessage, type SendResult } from './outbound';
import { saveAlertReport, reportLink } from './report';
import type { AlertDefinition } from './types';

const STATUS_LABEL: Record<string, string> = {
    success: 'Normal', warning: 'Atención', danger: 'Crítico', info: 'Información',
};

export async function getGymName(projectId: number): Promise<string> {
    const rows = await query('SELECT Proyecto FROM tblProyectos WHERE IdProyecto = ? LIMIT 1', [projectId]) as any[];
    return rows?.[0]?.Proyecto || `Proyecto ${projectId}`;
}

export async function getActiveAlertsForProject(projectId: number): Promise<AlertDefinition[]> {
    return await query(
        `SELECT a.* FROM tblAlertas a
         JOIN tblProyectosAlertas pa ON a.IdAlerta = pa.IdAlerta
         WHERE pa.IdProyecto = ? AND pa.Activa = 1 AND a.Activa = 1
         ORDER BY a.Orden ASC, a.IdAlerta ASC`,
        [projectId]
    ) as AlertDefinition[];
}

// Destinatarios de UNA alerta concreta del proyecto.
export async function getRecipientsForAlert(projectId: number, idAlerta: number): Promise<{ Telefono: string; Nombre: string | null }[]> {
    return await query(
        'SELECT Telefono, Nombre FROM tblProyectosAlertasTelefonos WHERE IdProyecto = ? AND IdAlerta = ? AND Activa = 1',
        [projectId, idAlerta]
    ) as any[];
}

// Genera el contenido de la alerta: un resumen de 1 línea (para WhatsApp) y el
// detalle completo (para la página accesible por liga/UUID).
export async function buildAlertContent(projectId: number, def: AlertDefinition, gymName: string): Promise<{ resumen: string; detalle: string }> {
    if (def.Tipo === 'ai') {
        return await generateAiAlert(projectId, def, gymName);
    }
    const r = await evaluateSqlAlert(projectId, def);
    const detalle = `${r.message}\n\n• Valor: ${r.value}\n• Estado: ${STATUS_LABEL[r.status] || r.status}`;
    return { resumen: r.message, detalle };
}

export interface AlertRunItem {
    idAlerta: number;
    clave: string;
    titulo: string;
    tipo: string;
    resumen?: string;
    detalle?: string;
    link?: string;
    message?: string;
    error?: string;
    sends?: ({ to: string; nombre: string | null } & SendResult)[];
}

export interface AlertRunResult {
    projectId: number;
    gymName: string;
    results: AlertRunItem[];
}

/**
 * Corre las alertas de un proyecto. Cada alerta se envía a SUS PROPIOS
 * destinatarios (por alerta).
 *  opts.send        → además de generar, envía a los destinatarios de cada alerta.
 *  opts.onlyAlertaId→ limita a una sola alerta (para "Probar"/"Enviar ahora").
 */
export async function runProjectAlerts(
    projectId: number,
    opts: { send: boolean; onlyAlertaId?: number; toPhone?: string; baseUrl?: string }
): Promise<AlertRunResult> {
    const gymName = await getGymName(projectId);
    let defs = await getActiveAlertsForProject(projectId);
    if (opts.onlyAlertaId) defs = defs.filter((d) => d.IdAlerta === opts.onlyAlertaId);

    const results: AlertRunItem[] = [];

    for (const def of defs) {
        try {
            const { resumen, detalle } = await buildAlertContent(projectId, def, gymName);

            // Al enviar, guardamos el detalle como reporte (UUID) y armamos la liga.
            let link = '';
            if (opts.send && opts.baseUrl) {
                const uuid = await saveAlertReport(projectId, def.Titulo, detalle);
                link = reportLink(opts.baseUrl, uuid);
            }
            // Mensaje de WhatsApp en UNA sola línea: título + resumen + liga.
            const resumenLinea = (resumen || '').replace(/\s+/g, ' ').trim();
            const message = `*${def.Titulo}*: ${resumenLinea}` + (link ? ` 🔗 ${link}` : '');

            const item: AlertRunItem = { idAlerta: def.IdAlerta, clave: def.Clave, titulo: def.Titulo, tipo: def.Tipo, resumen, detalle, link, message };

            if (opts.send) {
                // toPhone → enviar SOLO a ese número; si no, a todos los destinatarios de la alerta.
                const recipients = opts.toPhone
                    ? [{ Telefono: opts.toPhone, Nombre: null as string | null }]
                    : await getRecipientsForAlert(projectId, def.IdAlerta);
                item.sends = [];
                for (const r of recipients) {
                    const sr = await sendAlertMessage(r.Telefono, message);
                    item.sends.push({ to: r.Telefono, nombre: r.Nombre, ...sr });
                }
            }
            results.push(item);
        } catch (e: any) {
            results.push({ idAlerta: def.IdAlerta, clave: def.Clave, titulo: def.Titulo, tipo: def.Tipo, error: e?.message || 'Error al generar la alerta' });
        }
    }

    return { projectId, gymName, results };
}

// IdProyecto de todos los proyectos con al menos una alerta activa asignada
// (para el cron que recorre todos los gimnasios).
export async function getProjectsWithActiveAlerts(): Promise<number[]> {
    const rows = await query(
        `SELECT DISTINCT pa.IdProyecto
         FROM tblProyectosAlertas pa
         JOIN tblProyectos p ON p.IdProyecto = pa.IdProyecto AND p.Status = 0
         WHERE pa.Activa = 1`,
        []
    ) as any[];
    return rows.map((r) => Number(r.IdProyecto)).filter((n) => Number.isFinite(n));
}
