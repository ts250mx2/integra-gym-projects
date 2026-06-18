import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendAlertMessage, normalizeMxPhone } from '@/lib/alerts/outbound';

export const dynamic = 'force-dynamic';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);
    if (session.isAdmin === 1 || session.isAdmin === 2) return session;
    return false;
}

/**
 * Diagnóstico del envío de alertas (admin).
 *   GET /api/admin/projects/alerts/diag             → estado de la configuración
 *   GET /api/admin/projects/alerts/diag?to=+52...   → además, envío de prueba REAL
 *
 * No expone la clave: solo indica si está presente y su longitud.
 */
export async function GET(req: NextRequest) {
    const session = await verifyAdminSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const key = process.env.WHATSAPP_OUTBOUND_API_KEY || '';
    const config = {
        hasOutboundKey: !!key,
        outboundKeyLength: key.length,
        outboundKeyPrefix: key ? key.slice(0, 6) : null,
        outboundUrl: process.env.WHATSAPP_OUTBOUND_URL || 'https://api.axonlogic.com.mx/v1/outbound/alert (default)',
        sourceApp: process.env.WHATSAPP_SOURCE_APP || 'fitness-plus (default)',
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasCronSecret: !!(process.env.ALERTS_CRON_SECRET || process.env.CRON_SECRET),
    };

    const to = req.nextUrl.searchParams.get('to');
    if (!to) {
        return NextResponse.json({ config, hint: 'Agrega ?to=+52XXXXXXXXXX para hacer un envío de prueba real.' });
    }

    const normalized = normalizeMxPhone(to);
    const result = await sendAlertMessage(to, `Prueba de diagnóstico de alertas — ${new Date().toISOString()}`);
    return NextResponse.json({ config, test: { toEntered: to, toNormalized: normalized, ...result } });
}
