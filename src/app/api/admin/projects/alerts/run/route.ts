import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { runProjectAlerts } from '@/lib/alerts/runner';
import { computeBaseUrl } from '@/lib/alerts/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);
    if (session.isAdmin === 1 || session.isAdmin === 2) return session;
    return false;
}

/**
 * POST { idProyecto, idAlerta?, to? }
 * Genera y ENVÍA las alertas del proyecto a los teléfonos destinatarios.
 *  - idAlerta → solo esa alerta; si no, todas las activas del proyecto.
 *  - to       → envía SOLO a ese número (probar por número asignado).
 */
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { idProyecto, idAlerta, to } = await req.json();
        if (!idProyecto) {
            return NextResponse.json({ error: 'missingFields', details: 'Falta idProyecto.' }, { status: 400 });
        }

        const run = await runProjectAlerts(Number(idProyecto), {
            send: true,
            onlyAlertaId: idAlerta ? Number(idAlerta) : undefined,
            toPhone: typeof to === 'string' && to.trim() ? to.trim() : undefined,
            baseUrl: computeBaseUrl(req),
        });

        // Caso "probar por número": devolvemos el error EXACTO si falla.
        if (to) {
            const item = run.results[0];
            if (!item) {
                return NextResponse.json({ error: 'notActive', details: 'La alerta no está activa para este proyecto. Actívala con el interruptor antes de enviar.' }, { status: 400 });
            }
            if (item.error) {
                return NextResponse.json({ error: 'generationError', details: `No se pudo generar la alerta: ${item.error}` }, { status: 500 });
            }
            const s = item.sends?.[0];
            if (!s) {
                return NextResponse.json({ error: 'noSend', details: 'No se intentó el envío (sin destinatario).' }, { status: 500 });
            }
            console.log(`[alerts/run] to=${s.to} ok=${s.ok} status=${s.status ?? ''} err=${s.error ?? ''}`);
            if (!s.ok) {
                return NextResponse.json({ error: 'sendFailed', details: s.error || `HTTP ${s.status}`, status: s.status }, { status: 502 });
            }
            return NextResponse.json({ success: true, to: s.to, status: s.status });
        }

        // Resumen de envíos (todas / por alerta)
        let sent = 0, failed = 0;
        for (const item of run.results) {
            for (const sn of item.sends || []) (sn.ok ? sent++ : failed++);
        }

        return NextResponse.json({ success: true, ...run, summary: { sent, failed } });
    } catch (error: any) {
        console.error('Alert run error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
