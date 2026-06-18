/**
 * Generador de alertas tipo 'ai': corre un agente Anthropic de SOLO LECTURA sobre
 * la BD del proyecto (herramienta query_database) y devuelve el texto a enviar.
 *
 * Reutiliza el esquema y el catálogo del proyecto del agente de WhatsApp para que
 * el modelo escriba SQL correcto contra ESTE gimnasio.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnectionPoolRaw } from '@/lib/projectDb';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import type { AlertDefinition } from './types';

const MODEL = process.env.WHATSAPP_AI_MODEL || 'claude-sonnet-4-6';
const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TURNS = 6;
const MAX_OUTPUT = 1200;

const QUERY_TOOL: any = {
    name: 'query_database',
    description: `Ejecuta SQL SELECT/WITH de SOLO LECTURA contra la BD del gimnasio. Un solo statement, con LIMIT en listados, sin ';' final.
Reglas: VENTAS en tblMovimientos (FechaMovimiento, tblDetalleMovimientos, tblMovimientosPagos). SOCIOS/CLIENTES en tblSocios (activo = Status = 0 AND FechaVencimiento >= CURDATE(); vencido = FechaVencimiento < CURDATE()). VISITAS de socios en tblVisitas (FechaVisita). Status = 2 = cancelado/anulado: filtra Status <> 2. Usa los IDs reales del catálogo.`,
    input_schema: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'SELECT o WITH, un statement, con LIMIT.' } },
        required: ['sql'],
    },
};

async function execQuery(pool: any, sql: string): Promise<any[]> {
    const t = (sql || '').toLowerCase().trim();
    if (!t.startsWith('select') && !t.startsWith('with')) {
        throw new Error('Solo se permiten consultas SELECT / WITH.');
    }
    const [rows] = await pool.query(sql);
    return rows as any[];
}

function todayLabel(): string {
    try {
        return new Date().toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'full', timeStyle: 'short' });
    } catch {
        return new Date().toISOString();
    }
}

function buildSystem(def: AlertDefinition, gymName: string, catalog: string): string {
    return `Eres un consultor experto en gestión de gimnasios y generas una ALERTA automática para el gimnasio "${gymName}".
FECHA Y HORA ACTUAL: ${todayLabel()}

Tienes acceso de SOLO LECTURA a la BD del gimnasio vía la herramienta query_database. Encadena consultas si necesitas explorar antes de concluir. Nunca inventes cifras: si una consulta sale vacía, revisa el filtro (fecha, Status, sucursal, tabla) y reintenta.

${DATABASE_SCHEMA}

${catalog}

──────────────────────────────────────────────
FORMATO DE SALIDA (obligatorio)
──────────────────────────────────────────────
Devuelve EXACTAMENTE en este formato:
- PRIMERA LÍNEA: "RESUMEN: " seguido de UNA sola frase corta (máx 140 caracteres) con lo más importante y accionable del día. Sin saltos de línea.
- Luego UNA línea en blanco.
- Luego el DETALLE completo en texto plano (viñetas con "•", emojis ligeros ok), breve y accionable, máx ~700 caracteres.

Reglas: en español, cifras en MXN con coma de miles ($14,820.00), tutea, tono humano y directo. Sin markdown, sin tablas, sin nombres técnicos de tablas/columnas. No escribas nada antes de "RESUMEN:".`;
}

// Separa la salida del modelo en { resumen (1 línea), detalle (completo) }.
function splitResumenDetalle(text: string): { resumen: string; detalle: string } {
    const t = (text || '').trim();
    const lines = t.split('\n');
    if (/^\s*resumen\s*:/i.test(lines[0] || '')) {
        const resumen = lines[0].replace(/^\s*resumen\s*:\s*/i, '').trim().replace(/\s+/g, ' ').slice(0, 160);
        const detalle = lines.slice(1).join('\n').trim() || resumen;
        return { resumen, detalle };
    }
    // Respaldo: primera oración como resumen.
    const firstSentence = (t.split(/(?<=[.!?])\s/)[0] || t).replace(/\s+/g, ' ').slice(0, 160);
    return { resumen: firstSentence, detalle: t };
}

async function createWithFallback(anthropic: Anthropic, params: any, primary: string) {
    const chain = primary === FALLBACK_MODEL ? [FALLBACK_MODEL] : [primary, FALLBACK_MODEL];
    let lastErr: any;
    for (let i = 0; i < chain.length; i++) {
        try {
            return await anthropic.messages.create({ ...params, model: chain[i] });
        } catch (err: any) {
            lastErr = err;
            const status = err?.status ?? err?.response?.status;
            const transient = !status || status >= 500 || status === 429;
            if (i < chain.length - 1 && transient) continue;
            throw err;
        }
    }
    throw lastErr;
}

export async function generateAiAlert(projectId: number, def: AlertDefinition, gymName: string): Promise<{ resumen: string; detalle: string }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
    if (!def.Prompt) throw new Error('La alerta IA no tiene Prompt.');

    const pool = await getProjectConnectionPoolRaw(projectId);
    let catalog = '';
    try { catalog = await buildProjectCatalog(pool, String(projectId)); } catch { /* catálogo opcional */ }

    const anthropic = new Anthropic({ apiKey });
    const system = buildSystem(def, gymName, catalog);
    const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: def.Prompt }];

    let finalText = '';
    let turns = 0;
    let model = MODEL;

    while (turns < MAX_TURNS) {
        turns++;
        const msg = await createWithFallback(anthropic, {
            max_tokens: 1500,
            system,
            tools: [QUERY_TOOL],
            tool_choice: { type: 'auto' },
            messages,
        }, model);

        const textBlock = msg.content.find((c: any) => c.type === 'text') as any;
        if (textBlock?.text) finalText = textBlock.text;

        if (msg.stop_reason !== 'tool_use') break;

        messages.push({ role: 'assistant', content: msg.content });
        const toolResults: any[] = [];
        for (const block of msg.content as any[]) {
            if (block.type !== 'tool_use') continue;
            const sql = String(block.input?.sql || '').replace(/```sql|```/g, '').trim();
            try {
                const rows = await execQuery(pool, sql);
                const str = JSON.stringify(rows);
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: str.length > 12000 ? str.slice(0, 12000) + '…]' : str });
            } catch (err: any) {
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
            }
        }
        messages.push({ role: 'user', content: toolResults });
    }

    const clean = (finalText || 'No se pudo generar el contenido de la alerta.').trim().slice(0, MAX_OUTPUT);
    return splitResumenDetalle(clean);
}
