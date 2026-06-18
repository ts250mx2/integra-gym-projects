import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { runProjectAlerts } from '@/lib/alerts/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);
    if (session.isAdmin === 1 || session.isAdmin === 2) return session;
    return false;
}

/**
 * POST { idProyecto, idAlerta }
 * Genera/evalúa UNA alerta para el proyecto y devuelve el texto SIN enviarlo.
 * Sirve para el botón "Probar" del modal.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { idProyecto, idAlerta } = await req.json();
        if (!idProyecto || !idAlerta) {
            return NextResponse.json({ error: 'missingFields', details: 'Faltan idProyecto e idAlerta.' }, { status: 400 });
        }

        const run = await runProjectAlerts(Number(idProyecto), { send: false, onlyAlertaId: Number(idAlerta) });
        const item = run.results[0];
        if (!item) {
            return NextResponse.json({ error: 'notEnabled', details: 'La alerta no está activa para este proyecto.' }, { status: 400 });
        }
        if (item.error) {
            return NextResponse.json({ error: 'generationError', details: item.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, titulo: item.titulo, tipo: item.tipo, resumen: item.resumen, detalle: item.detalle, gymName: run.gymName });
    } catch (error: any) {
        console.error('Alert preview error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
