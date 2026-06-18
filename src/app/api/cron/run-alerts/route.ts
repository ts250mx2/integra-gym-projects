import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runProjectAlerts, getProjectsWithActiveAlerts } from '@/lib/alerts/runner';
import { computeBaseUrl } from '@/lib/alerts/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Disparador programado de alertas.
 *
 * Pensado para que tu scheduler lo llame con FRECUENCIA (cada ~10-15 min):
 *   GET https://<host>/api/cron/run-alerts?key=<ALERTS_CRON_SECRET>
 *
 * En cada corrida envía SOLO las alertas cuya HoraEnvio (hora local
 * America/Monterrey) ya pasó hoy y que aún no se han enviado hoy (UltimoEnvio).
 * Las alertas sin HoraEnvio no se envían automáticamente.
 *
 * Parámetros:
 *   ?key=<secreto>      (o header X-Cron-Key)  — obligatorio
 *   ?force=1            envía TODAS las alertas activas, ignorando la hora.
 *   ?idProyecto=N       limita a un proyecto.
 *
 * Protección: ALERTS_CRON_SECRET (o CRON_SECRET).
 */

// Fecha (YYYY-MM-DD) y hora (HH:MM) actuales en zona America/Monterrey.
function mxNow(): { date: string; time: string } {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Monterrey',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const p = fmt.formatToParts(new Date());
    const get = (t: string) => p.find((x) => x.type === t)?.value || '';
    let hh = get('hour'); if (hh === '24') hh = '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hh}:${get('minute')}` };
}

function ymd(v: any): string | null {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}

async function handle(req: NextRequest) {
    const secret = process.env.ALERTS_CRON_SECRET || process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'cronNotConfigured', details: 'Falta ALERTS_CRON_SECRET en el entorno.' }, { status: 503 });
    }
    const url = new URL(req.url);
    const provided = url.searchParams.get('key') || req.headers.get('x-cron-key') || '';
    if (provided !== secret) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const force = ['1', 'true', 'yes'].includes((url.searchParams.get('force') || '').toLowerCase());
    const onlyProject = url.searchParams.get('idProyecto');
    const projectIds = onlyProject ? [Number(onlyProject)] : await getProjectsWithActiveAlerts();

    const { date: today, time: nowHHMM } = mxNow();
    const baseUrl = computeBaseUrl(req);
    const startedAt = Date.now();
    let totalSent = 0, totalFailed = 0, totalDue = 0;
    const perProject: any[] = [];

    for (const pid of projectIds) {
        try {
            const assignments = await query(
                `SELECT pa.IdAlerta, pa.HoraEnvio, pa.UltimoEnvio
                 FROM tblProyectosAlertas pa
                 JOIN tblAlertas a ON a.IdAlerta = pa.IdAlerta
                 WHERE pa.IdProyecto = ? AND pa.Activa = 1 AND a.Activa = 1`,
                [pid]
            ) as any[];

            let sent = 0, failed = 0, due = 0;
            for (const row of assignments) {
                const hora = row.HoraEnvio ? String(row.HoraEnvio).slice(0, 5) : null;
                const ultimo = ymd(row.UltimoEnvio);
                const isDue = force || (hora !== null && nowHHMM >= hora && (ultimo === null || ultimo < today));
                if (!isDue) continue;
                due++;

                const run = await runProjectAlerts(pid, { send: true, onlyAlertaId: row.IdAlerta, baseUrl });
                const item = run.results[0];
                if (item && !item.error) {
                    for (const s of item.sends || []) (s.ok ? sent++ : failed++);
                    // Marca como enviada hoy para no repetir en la siguiente corrida.
                    await query('UPDATE tblProyectosAlertas SET UltimoEnvio = ? WHERE IdProyecto = ? AND IdAlerta = ?', [today, pid, row.IdAlerta]);
                } else {
                    failed++; // error de generación: no marcamos UltimoEnvio para reintentar
                }
            }
            totalSent += sent; totalFailed += failed; totalDue += due;
            if (due > 0) perProject.push({ projectId: pid, due, sent, failed });
        } catch (e: any) {
            perProject.push({ projectId: pid, error: e?.message || 'error' });
        }
    }

    return NextResponse.json({
        success: true,
        now: { date: today, time: nowHHMM, tz: 'America/Monterrey' },
        force,
        projects: projectIds.length,
        due: totalDue,
        sent: totalSent,
        failed: totalFailed,
        elapsed_ms: Date.now() - startedAt,
        perProject,
    });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
