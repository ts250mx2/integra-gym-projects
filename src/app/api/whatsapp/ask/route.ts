import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { getProjectConnectionPool } from '@/lib/projectDb';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';

/**
 * POST /api/whatsapp/ask
 *
 * Endpoint para un bridge de WhatsApp (Twilio, Meta Cloud API, n8n, Worker…).
 * Recibe una pregunta de lenguaje natural + el número que la envía y devuelve una
 * respuesta corta lista para enviar al chat, como el agente de Integra Gym.
 *
 * RESOLUCIÓN DE PROYECTO (clave de este sistema multi-tenant):
 *   1. Valida el número en BDIntegraProjects.tblProyectosTelefonos.
 *   2. Si el número tiene UN solo proyecto → el agente responde sobre la BD de ese gimnasio.
 *   3. Si el número tiene VARIOS proyectos → devuelve un menú para que el usuario elija;
 *      la elección se recuerda por número (sesión en memoria) y a partir de ahí responde
 *      sobre el gimnasio seleccionado.
 *
 * Body: { question, from_phone, projectId?, reset?, timestamp? }
 * Auth: header X-API-Key debe coincidir con WHATSAPP_API_KEY.
 *
 * Respuesta: { answer, needsSelection?, options?, project?, meta }
 */

const MAX_TURNS = 8;
const SELECTED_TTL_MS = 30 * 60 * 1000; // gimnasio recordado 30 min
const PENDING_TTL_MS  = 10 * 60 * 1000; // menú pendiente 10 min
const ANSWER_CAP = 1500;

// Modelo (configurable). Sonnet equilibra calidad de SQL y latencia.
const WA_MODEL = process.env.WHATSAPP_AI_MODEL || 'claude-sonnet-4-6';
const WA_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

interface WhatsAppRequest {
    question?: string;
    from_phone?: string;
    projectId?: number | string;
    reset?: boolean;
    timestamp?: string;
}

interface PhoneProject {
    IdProyecto: number;
    Proyecto: string;
    Nombre: string | null;
}

// ─── Sesión por número (en memoria; la app corre como servidor único) ──────────
interface PendingChoice { question: string; options: PhoneProject[]; expires: number; }
interface SelectedProject { projectId: number; projectName: string; expires: number; }
const PENDING  = new Map<string, PendingChoice>();
const SELECTED = new Map<string, SelectedProject>();

// ─── Helpers de teléfono ───────────────────────────────────────────────────────
const digits = (s: string) => (s || '').replace(/\D/g, '');
const last10 = (s: string) => digits(s).slice(-10);

// ─── Lookup de proyectos por número ────────────────────────────────────────────
async function findProjectsForPhone(fromPhone: string): Promise<PhoneProject[]> {
    const tail = last10(fromPhone);
    if (tail.length < 8) return [];
    // Compara por los últimos 10 dígitos, ignorando lada/espacios/signos del registro.
    const rows = await query(
        `SELECT t.IdProyecto, t.Nombre, p.Proyecto
         FROM tblProyectosTelefonos t
         JOIN tblProyectos p ON t.IdProyecto = p.IdProyecto
         WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(t.Telefono,' ',''),'-',''),'(',''),')',''),'+',''),'.','') , 10) = ?
         ORDER BY p.Proyecto ASC`,
        [tail]
    ) as any[];

    // Dedup por IdProyecto (un número podría estar repetido entre filas).
    const seen = new Set<number>();
    const out: PhoneProject[] = [];
    for (const r of rows) {
        const id = Number(r.IdProyecto);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ IdProyecto: id, Proyecto: String(r.Proyecto || `Proyecto ${id}`), Nombre: r.Nombre ?? null });
    }
    return out;
}

// ─── Tool ──────────────────────────────────────────────────────────────────────
const AGENT_TOOLS: any[] = [
    {
        name: 'query_database',
        description: `Ejecuta SQL SELECT/WITH de solo lectura contra la BD MySQL del gimnasio.
REGLAS:
- VENTAS: exclusivamente tblMovimientos (fecha FechaMovimiento), detalle tblDetalleMovimientos, pagos tblMovimientosPagos. NUNCA tblVentas.
- CLIENTES/SOCIOS: tblSocios. ACTIVO = Status = 0 AND FechaVencimiento >= CURDATE().
- VISITAS de socios: tblVisitas (FechaVisita). ASISTENCIAS de empleados: tblAsistencias (FechaAsistencia).
- PRODUCTOS/membresías: tblCuotas (TipoCuota=1 membresía, =2 producto).
- Status=2 = cancelado/eliminado: filtra "Status <> 2".
- Fechas DATETIME reales: usa DATE()/MONTH()/YEAR()/BETWEEN. MySQL: LIMIT obligatorio. Nunca TOP.
Puedes encadenar varias llamadas para explorar antes de responder.`,
        input_schema: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'SELECT o WITH. Un statement. Sin ; al final. Con LIMIT.' },
            },
            required: ['sql'],
        },
    },
];

async function executeQuery(pool: any, sql: string): Promise<any[]> {
    const trimmed = sql.toLowerCase().trim();
    if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
        throw new Error('Solo se permiten consultas SELECT / WITH.');
    }
    const [rows] = await pool.query(sql);
    return rows as any[];
}

async function runToolBlocks(pool: any, content: any[], executedSql: string[]): Promise<any[]> {
    const toolResults: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const sql = String((block.input as any)?.sql || '').replace(/```sql|```/g, '').trim();
        if (sql) executedSql.push(sql);
        try {
            const rows = await executeQuery(pool, sql);
            const resultStr = JSON.stringify(rows);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: resultStr.length > 12000 ? resultStr.slice(0, 12000) + '…]' : resultStr,
            });
        } catch (err: any) {
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: err.message }),
                is_error: true,
            });
        }
    }
    return toolResults;
}

function buildSystemPrompt(projectCatalog: string, gymName: string): string {
    const now = new Date();
    const fecha = now.toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'full', timeStyle: 'short' });
    const monthNames = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const m = now.getMonth() + 1, y = now.getFullYear();
    const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;

    return `Eres el AGENTE INTEGRA GYM respondiendo por WhatsApp para el gimnasio "${gymName || 'actual'}".
Eres un consultor experto en gestión, socios, asistencia y rentabilidad de gimnasios.

FECHA Y HORA ACTUAL: ${fecha}
INTERPRETACIÓN DE PERÍODO:
  - "hoy" → DATE(fecha)=CURDATE()
  - "este mes" → MONTH(fecha)=${m} AND YEAR(fecha)=${y}
  - "mes pasado" → MONTH(fecha)=${pm} AND YEAR(fecha)=${py}

${DATABASE_SCHEMA}

${projectCatalog}

──────────────────────────────────────────────────────────────
CÓMO RESPONDES (no negociable)
──────────────────────────────────────────────────────────────
- Tienes acceso COMPLETO de SOLO LECTURA a la BD del gimnasio vía query_database.
- Si la pregunta involucra datos (ventas, socios, visitas, asistencias, cuotas, productos, sucursales, formas de pago, fechas, montos) → USA query_database. Nunca digas "no tengo acceso".
- Encadena consultas si necesitas explorar IDs/nombres o aislar una causa.
- Para preguntas que NO son de datos (saludo, "¿qué puedes hacer?") responde directo, breve y cordial, SIN consultar.
- Nunca inventes cifras: si una consulta sale vacía revisa el filtro (sucursal, Status, fecha, tabla correcta) y reintenta antes de decir que no hay datos.

──────────────────────────────────────────────────────────────
FORMATO WHATSAPP (obligatorio)
──────────────────────────────────────────────────────────────
- Respuesta CORTA: 1 a 5 oraciones (target ~300 chars, máx ~700).
- TEXTO PLANO: nada de markdown, tablas, viñetas con # o **. Emojis ligeros está bien.
- Cifras en MXN con coma de miles ($14,820.00). Tutea, tono humano y directo.
- Si hay una comparativa relevante (vs mes pasado) o algo accionable (socios por vencer, asistencia cayendo), méncionalo en una frase.
- Responde SIEMPRE en español. Devuelve SOLO el texto de la respuesta, sin prefijos.`;
}

async function createWithFallback(anthropic: Anthropic, params: any, primary: string): Promise<{ msg: Anthropic.Message; model: string }> {
    const chain = primary === WA_FALLBACK_MODEL ? [WA_FALLBACK_MODEL] : [primary, WA_FALLBACK_MODEL];
    let lastErr: any;
    for (let i = 0; i < chain.length; i++) {
        try {
            const msg = await anthropic.messages.create({ ...params, model: chain[i] });
            return { msg, model: chain[i] };
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

// Corre el loop agéntico (multi-turno) y devuelve la respuesta corta de WhatsApp.
async function runAgent(projectId: number, gymName: string, question: string): Promise<{ answer: string; executedSql: string[]; model: string }> {
    const pool = await getProjectConnectionPool(projectId);

    let projectCatalog = '';
    try {
        projectCatalog = await buildProjectCatalog(pool, String(projectId));
    } catch (e) {
        console.error('[whatsapp/ask] catálogo falló:', e);
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const system = buildSystemPrompt(projectCatalog, gymName);
    const executedSql: string[] = [];
    const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: question }];

    let finalText = '';
    let modelUsed = WA_MODEL;
    let turns = 0;

    while (turns < MAX_TURNS) {
        turns++;
        const { msg, model } = await createWithFallback(anthropic, {
            max_tokens: 1500,
            system,
            tools: AGENT_TOOLS,
            tool_choice: { type: 'auto' },
            messages,
        }, modelUsed);
        modelUsed = model;

        const textBlock = msg.content.find((c: any) => c.type === 'text') as any;
        if (textBlock?.text) finalText = textBlock.text;

        if (msg.stop_reason !== 'tool_use') break;

        messages.push({ role: 'assistant', content: msg.content });
        const toolResults = await runToolBlocks(pool, msg.content, executedSql);
        messages.push({ role: 'user', content: toolResults });
    }

    return { answer: finalText.trim().slice(0, ANSWER_CAP), executedSql, model: modelUsed };
}

// Interpreta el mensaje como una selección del menú pendiente (número o nombre).
function resolveSelection(text: string, options: PhoneProject[]): PhoneProject | null {
    const t = text.trim().toLowerCase();
    // Por número (1..N)
    const num = parseInt(t.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= options.length && /^\s*\d+\s*$/.test(t)) {
        return options[num - 1];
    }
    // Por nombre (coincidencia única por substring)
    const matches = options.filter(o =>
        o.Proyecto.toLowerCase().includes(t) || t.includes(o.Proyecto.toLowerCase())
    );
    if (matches.length === 1) return matches[0];
    return null;
}

function menuText(options: PhoneProject[]): string {
    const lines = options.map((o, i) => `${i + 1}. ${o.Proyecto}`).join('\n');
    return `Tu número tiene acceso a varios gimnasios. ¿Sobre cuál quieres consultar? Responde con el número:\n${lines}`;
}

function isResetCmd(text: string): boolean {
    const t = text.trim().toLowerCase();
    return ['cambiar', 'cambiar gimnasio', 'cambiar proyecto', 'otro gimnasio', 'otro proyecto', 'menu', 'menú', 'salir', 'reset']
        .some(k => t === k || t.startsWith(k + ' '));
}

export async function POST(req: Request) {
    const startTime = Date.now();
    const requestId = `wa_${startTime.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
        // 1. Auth
        const expectedKey = process.env.WHATSAPP_API_KEY;
        if (!expectedKey) {
            return NextResponse.json({ error: 'WhatsApp endpoint no configurado (falta WHATSAPP_API_KEY)' }, { status: 503 });
        }
        const providedKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
        if (!providedKey || providedKey !== expectedKey) {
            return NextResponse.json({ error: 'API key inválida o ausente' }, { status: 401 });
        }

        // 2. Body
        const body: WhatsAppRequest = await req.json();
        const question = (body.question || '').trim();
        const fromPhone = (body.from_phone || '').trim();

        if (!fromPhone) return NextResponse.json({ error: 'Falta from_phone' }, { status: 400 });
        if (!question) return NextResponse.json({ error: 'Falta question' }, { status: 400 });
        if (question.length > 600) return NextResponse.json({ error: 'question demasiado larga (max 600)' }, { status: 400 });

        const phoneKey = last10(fromPhone);
        console.log(`[${requestId}] whatsapp ask from=${fromPhone} q="${question.slice(0, 80)}"`);

        // 3. Comando de reinicio de selección
        if (body.reset || isResetCmd(question)) {
            SELECTED.delete(phoneKey);
            PENDING.delete(phoneKey);
        }

        // 4. Proyectos autorizados para este número
        const projects = await findProjectsForPhone(fromPhone);
        if (projects.length === 0) {
            return NextResponse.json({
                answer: 'Este número no está asignado a ningún proyecto Integra Members.',
                meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
            });
        }
        const allowedIds = new Set(projects.map(p => p.IdProyecto));

        // 5. Resolver proyecto activo
        let active: PhoneProject | null = null;

        // 5a. projectId explícito desde el bridge (si pertenece al número)
        if (body.projectId != null && allowedIds.has(Number(body.projectId))) {
            active = projects.find(p => p.IdProyecto === Number(body.projectId)) || null;
        }

        // 5b. Hay un menú pendiente → intentar resolver la selección
        if (!active) {
            const pend = PENDING.get(phoneKey);
            if (pend && pend.expires > Date.now()) {
                const picked = resolveSelection(question, pend.options);
                if (picked) {
                    active = picked;
                    PENDING.delete(phoneKey);
                    // Respondemos la pregunta ORIGINAL que disparó el menú.
                    return await answerForProject(picked, pend.question, fromPhone, requestId, startTime, true);
                }
                // No fue una selección válida → reenviar el menú con la nueva pregunta.
                PENDING.set(phoneKey, { question, options: projects, expires: Date.now() + PENDING_TTL_MS });
                return NextResponse.json({
                    answer: `No reconocí esa opción. ${menuText(projects)}`,
                    needsSelection: true,
                    options: projects.map((p, i) => ({ index: i + 1, projectId: p.IdProyecto, name: p.Proyecto })),
                    meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
                });
            }
        }

        // 5c. Selección recordada (sticky) dentro del TTL
        if (!active) {
            const sel = SELECTED.get(phoneKey);
            if (sel && sel.expires > Date.now() && allowedIds.has(sel.projectId)) {
                active = projects.find(p => p.IdProyecto === sel.projectId) || null;
            }
        }

        // 5d. Un solo proyecto → directo
        if (!active && projects.length === 1) {
            active = projects[0];
        }

        // 5e. Varios proyectos y sin selección → mostrar menú y guardar la pregunta
        if (!active) {
            PENDING.set(phoneKey, { question, options: projects, expires: Date.now() + PENDING_TTL_MS });
            return NextResponse.json({
                answer: menuText(projects),
                needsSelection: true,
                options: projects.map((p, i) => ({ index: i + 1, projectId: p.IdProyecto, name: p.Proyecto })),
                meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
            });
        }

        // 6. Responder sobre el proyecto activo
        return await answerForProject(active, question, fromPhone, requestId, startTime, false);

    } catch (e: any) {
        console.error(`[${requestId}] error:`, e);
        return NextResponse.json({
            answer: 'Tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?',
            error: e?.message || 'Error desconocido',
        }, { status: 500 });
    }
}

async function answerForProject(
    project: PhoneProject, question: string, fromPhone: string,
    requestId: string, startTime: number, justSelected: boolean
): Promise<Response> {
    const phoneKey = last10(fromPhone);
    // Recordar la selección para siguientes preguntas del mismo número.
    SELECTED.set(phoneKey, { projectId: project.IdProyecto, projectName: project.Proyecto, expires: Date.now() + SELECTED_TTL_MS });

    const { answer, executedSql, model } = await runAgent(project.IdProyecto, project.Proyecto, question);
    if (executedSql.length) {
        console.log(`[${requestId}] project=${project.IdProyecto} SQL: ${executedSql.join(' | ').slice(0, 240)}`);
    }

    // Si acaba de elegir gimnasio, prefijamos para dar contexto en el chat.
    const prefix = justSelected ? `📍 ${project.Proyecto}\n` : '';
    const finalAnswer = (prefix + (answer || 'No pude generar una respuesta. ¿Puedes reformular tu pregunta?')).slice(0, ANSWER_CAP + 60);

    return NextResponse.json({
        answer: finalAnswer,
        project: { idProyecto: project.IdProyecto, nombre: project.Proyecto },
        meta: {
            request_id: requestId,
            from_phone: fromPhone,
            model_used: model,
            rows_queries: executedSql.length,
            elapsed_ms: Date.now() - startTime,
        },
    });
}
