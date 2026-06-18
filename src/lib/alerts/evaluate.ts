/**
 * Evaluador de alertas tipo 'sql': ejecuta ConsultaSQL contra la BD del proyecto
 * y calcula estatus + mensaje a partir de los umbrales/plantillas de la alerta.
 *
 * Mismo modelo que el catálogo (tblAlertas): la consulta devuelve un número
 * `valor` (y opcional `valor2`); el estatus sale de Direccion/umbrales y el
 * mensaje de las plantillas con placeholders.
 */
import { projectQuery } from '@/lib/projectDb';
import type { AlertDefinition, AlertStatus } from './types';

export function formatValue(value: number, formato: string): string {
    switch (formato) {
        case 'currency':
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
        case 'percent':
            return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)}%`;
        case 'number':
        default:
            return new Intl.NumberFormat('es-MX').format(Math.round(value));
    }
}

function evaluateStatus(def: AlertDefinition, valor: number): AlertStatus {
    const exito = def.UmbralExito;
    const adv = def.UmbralAdvertencia;
    if (def.Direccion === 'asc') {
        if (exito !== null && valor >= exito) return 'success';
        if (adv !== null && valor >= adv) return 'warning';
        return 'danger';
    }
    if (def.Direccion === 'desc') {
        if (exito !== null && valor <= exito) return 'success';
        if (adv !== null && valor <= adv) return 'warning';
        return 'danger';
    }
    return (def.EstatusNeutro as AlertStatus) || 'info';
}

function pickTemplate(def: AlertDefinition, status: AlertStatus): string {
    if (def.Direccion === 'neutro') return def.MensajeExito || '';
    if (status === 'success') return def.MensajeExito || '';
    if (status === 'warning') return def.MensajeAdvertencia || def.MensajeExito || '';
    return def.MensajePeligro || def.MensajeAdvertencia || def.MensajeExito || '';
}

function renderMessage(template: string, valor: number, valor2: number, formato: string): string {
    return (template || '')
        .replace(/\{valor2f\}/g, formatValue(valor2, 'currency'))
        .replace(/\{valor2\}/g, new Intl.NumberFormat('es-MX').format(Math.round(valor2)))
        .replace(/\{valor\}/g, formatValue(valor, formato))
        .replace(/\{n\}/g, new Intl.NumberFormat('es-MX').format(Math.round(valor)));
}

export interface SqlAlertResult {
    status: AlertStatus;
    message: string;
    value: string;
}

export async function evaluateSqlAlert(projectId: number, def: AlertDefinition): Promise<SqlAlertResult> {
    if (!def.ConsultaSQL) throw new Error('La alerta no tiene ConsultaSQL.');
    // bypassVirtual = true: siempre la BD de ESTE proyecto, sin importar la sesión.
    const rows = await projectQuery(projectId, def.ConsultaSQL, [], undefined, true) as any[];
    const row = rows?.[0] || {};
    const valor = Number(row.valor ?? 0) || 0;
    const valor2 = Number(row.valor2 ?? 0) || 0;
    const status = evaluateStatus(def, valor);
    const message = renderMessage(pickTemplate(def, status), valor, valor2, def.Formato);
    return { status, message, value: formatValue(valor, def.Formato) };
}
