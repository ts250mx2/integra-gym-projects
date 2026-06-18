/**
 * Cliente del webservice de salida (WhatsApp) de Axon Logic.
 *
 *   POST https://api.axonlogic.com.mx/v1/outbound/alert
 *   Header: X-API-Key: <WHATSAPP_OUTBOUND_API_KEY>
 *   Body:   { to, message, source_app }
 *
 * Configurable por entorno:
 *   - WHATSAPP_OUTBOUND_URL      (default: el de arriba)
 *   - WHATSAPP_OUTBOUND_API_KEY  (REQUERIDO — no tiene default por seguridad)
 *   - WHATSAPP_SOURCE_APP        (default: 'fitness-plus')
 */

const DEFAULT_OUTBOUND_URL = 'https://api.axonlogic.com.mx/v1/outbound/alert';
const DEFAULT_SOURCE_APP = 'fitness-plus';

export interface SendResult {
    ok: boolean;
    status?: number;
    error?: string;
}

// Normaliza a E.164 asumiendo México por defecto:
//   - Si el usuario escribió '+...'    → se respeta esa lada.
//   - Si son 10 dígitos (local MX)     → se antepone +52.
//   - Si ya empieza con 52             → se deja con '+'.
//   - Otro caso                        → '+' + dígitos.
export function normalizeMxPhone(raw: string): string {
    const hadPlus = (raw || '').trim().startsWith('+');
    const d = (raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (hadPlus) return `+${d}`;
    if (d.length === 10) return `+52${d}`;
    if (d.startsWith('52')) return `+${d}`;
    return `+${d}`;
}

export async function sendAlertMessage(to: string, message: string): Promise<SendResult> {
    const url = process.env.WHATSAPP_OUTBOUND_URL || DEFAULT_OUTBOUND_URL;
    const apiKey = process.env.WHATSAPP_OUTBOUND_API_KEY;
    const sourceApp = process.env.WHATSAPP_SOURCE_APP || DEFAULT_SOURCE_APP;

    if (!apiKey) return { ok: false, error: 'Falta WHATSAPP_OUTBOUND_API_KEY en el entorno.' };

    const phone = normalizeMxPhone(to);
    if (!phone) return { ok: false, error: 'Teléfono inválido' };
    if (!message?.trim()) return { ok: false, error: 'Mensaje vacío' };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify({ to: phone, message, source_app: sourceApp }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, status: res.status, error: body.slice(0, 300) || `HTTP ${res.status}` };
        }
        return { ok: true, status: res.status };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Error de red al enviar la alerta' };
    }
}
