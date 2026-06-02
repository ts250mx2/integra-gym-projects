import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
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
const PENDING_TTL_MS = 10 * 60 * 1000; // menú pendiente (en memoria) 10 min
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
    ProyectoActivo: number; // 1 = es el proyecto activo de este teléfono
}

// ─── Menú pendiente por número (transitorio, en memoria) ───────────────────────
// La SELECCIÓN ACTIVA se persiste en BD (tblProyectosTelefonos.ProyectoActivo).
interface PendingChoice { question: string; options: PhoneProject[]; expires: number; }
const PENDING = new Map<string, PendingChoice>();

// ─── Helpers de teléfono ───────────────────────────────────────────────────────
const digits = (s: string) => (s || '').replace(/\D/g, '');
const last10 = (s: string) => digits(s).slice(-10);

// Normaliza la columna Telefono a sus últimos 10 dígitos (ignora lada/espacios/signos).
const normPhoneSql = (col: string) =>
    `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},' ',''),'-',''),'(',''),')',''),'+',''),'.','') , 10)`;

// Asegura que exista la columna ProyectoActivo en tblProyectosTelefonos (lazy migration).
let proyectoActivoEnsured = false;
async function ensureProyectoActivoColumn(): Promise<void> {
    if (proyectoActivoEnsured) return;
    try {
        const cols = await query("SHOW COLUMNS FROM tblProyectosTelefonos LIKE 'ProyectoActivo'") as any[];
        if (!cols || cols.length === 0) {
            await query('ALTER TABLE tblProyectosTelefonos ADD COLUMN ProyectoActivo TINYINT NOT NULL DEFAULT 0');
        }
        proyectoActivoEnsured = true;
    } catch (e) {
        console.error('[whatsapp/ask] no se pudo asegurar ProyectoActivo:', e);
    }
}

// Marca el proyecto elegido como activo (=1) y los demás del mismo teléfono como inactivos (=0).
async function setActiveProject(fromPhone: string, idProyecto: number): Promise<void> {
    const tail = last10(fromPhone);
    await query(
        `UPDATE tblProyectosTelefonos
         SET ProyectoActivo = CASE WHEN IdProyecto = ? THEN 1 ELSE 0 END
         WHERE ${normPhoneSql('Telefono')} = ?`,
        [idProyecto, tail]
    );
}

// Limpia el proyecto activo del teléfono (para "cambiar de proyecto").
async function clearActiveProject(fromPhone: string): Promise<void> {
    const tail = last10(fromPhone);
    await query(
        `UPDATE tblProyectosTelefonos SET ProyectoActivo = 0 WHERE ${normPhoneSql('Telefono')} = ?`,
        [tail]
    );
}

// ─── Lookup de proyectos por número ────────────────────────────────────────────
async function findProjectsForPhone(fromPhone: string): Promise<PhoneProject[]> {
    const tail = last10(fromPhone);
    if (tail.length < 8) return [];
    // Compara por los últimos 10 dígitos, ignorando lada/espacios/signos del registro.
    const rows = await query(
        `SELECT t.IdProyecto, t.Nombre, t.ProyectoActivo, p.Proyecto
         FROM tblProyectosTelefonos t
         JOIN tblProyectos p ON t.IdProyecto = p.IdProyecto
         WHERE ${normPhoneSql('t.Telefono')} = ?
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
        out.push({
            IdProyecto: id,
            Proyecto: String(r.Proyecto || `Proyecto ${id}`),
            Nombre: r.Nombre ?? null,
            ProyectoActivo: Number(r.ProyectoActivo) || 0,
        });
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
- CLIENTES/SOCIOS: tblSocios. ACTIVO = Status = 0 AND FechaVencimiento >= CURDATE(). Al listar o consultar socios que vencen o vencidos, incluye SIEMPRE la columna 'OtroTelefono' para poder mostrar sus teléfonos de contacto.
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
- Responde SIEMPRE en español.

──────────────────────────────────────────────────────────────
VISUALIZACIÓN OPCIONAL (tabla/gráfica en una página web)
──────────────────────────────────────────────────────────────
Cuando la respuesta involucre datos que se aprecian mejor en TABLA o GRÁFICA
(varias filas, ranking/top, desglose por sucursal/forma de pago/membresía,
evolución por día o mes, comparativa de períodos), agrega AL FINAL del mensaje un
bloque cercado \`\`\`report con un JSON en UNA sola línea con esta forma:

\`\`\`report
{"title":"Ventas por forma de pago (mayo 2026)","tables":[{"title":"Detalle","columns":["Forma de pago","Total","Tickets"],"rows":[["Efectivo",138200,210],["Tarjeta",61777,84]]}],"charts":[{"type":"bar","title":"Ventas por forma de pago","format":"currency","data":[{"name":"Efectivo","value":138200},{"name":"Tarjeta","value":61777}]}]}
\`\`\`

REGLAS DEL BLOQUE report:
- El TEXTO de WhatsApp va ANTES del bloque y debe entenderse SOLO (resume el dato clave); el bloque es el detalle ampliado.
- "charts": "type" bar|line|pie, "format" currency|number|percent, "data":[{"name","value","value2"?}], "seriesLabels"?:[..]. Máx ~12 puntos, valores crudos (sin $, comas ni %).
- "tables": [{"title","columns":[...],"rows":[[...]]}]. Números crudos.
- Incluye "tables", "charts" o ambos. Omite el bloque por completo para respuestas de un solo número, saludos o conceptos.
- NO menciones el link ni el bloque en el texto; el sistema agrega el enlace automáticamente.

Devuelve SOLO el texto (y, si aplica, el bloque \`\`\`report al final). Sin prefijos.`;
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
async function runAgent(projectId: number, gymName: string, question: string): Promise<{ answer: string; report: any | null; executedSql: string[]; model: string }> {
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

    const { clean, report } = extractReport(finalText);
    return { answer: clean.slice(0, ANSWER_CAP), report, executedSql, model: modelUsed };
}

// Extrae el bloque ```report {json}``` del texto final: devuelve el texto limpio
// (para WhatsApp) y el reporte parseado (tablas/gráficas) si tiene contenido.
function extractReport(text: string): { clean: string; report: any | null } {
    let report: any = null;
    let clean = text || '';
    const m = clean.match(/```report\s*([\s\S]*?)```/i);
    if (m) {
        try { report = JSON.parse(m[1].trim()); } catch { report = null; }
        clean = clean.replace(m[0], '').trim();
    }
    // Quita cualquier otro bloque cercado que se haya colado (no va en WhatsApp).
    clean = clean.replace(/```[\s\S]*?```/g, '').trim();
    // Sólo es válido si trae tablas o gráficas con contenido.
    const hasTables = report && Array.isArray(report.tables) && report.tables.length > 0;
    const hasCharts = report && Array.isArray(report.charts) && report.charts.length > 0;
    if (!hasTables && !hasCharts) report = null;
    return { clean, report };
}

// ─── Persistencia del reporte (BD principal, accesible por UUID) ────────────────
let reportTableEnsured = false;
async function ensureReportTable(): Promise<void> {
    if (reportTableEnsured) return;
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
    reportTableEnsured = true;
}

async function saveReport(
    project: PhoneProject, fromPhone: string, question: string, answer: string, report: any
): Promise<string> {
    await ensureReportTable();
    const uuid = uuidv4();
    const datos = JSON.stringify({
        title: report?.title || null,
        tables: Array.isArray(report?.tables) ? report.tables : [],
        charts: Array.isArray(report?.charts) ? report.charts : [],
    });
    await query(
        `INSERT INTO tblWhatsappReportes (UUID, IdProyecto, Telefono, Pregunta, Respuesta, Titulo, Datos, FechaAct)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuid, project.IdProyecto, last10(fromPhone), question.slice(0, 500), (answer || '').slice(0, 2000), String(report?.title || '').slice(0, 250), datos]
    );
    return uuid;
}

// Base URL pública para el link (env APP_PUBLIC_URL o derivada de headers del proxy).
function computeBaseUrl(req: Request): string {
    const env = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (env) return env;
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    return host ? `${proto}://${host}` : '';
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
        const baseUrl = computeBaseUrl(req);
        console.log(`[${requestId}] whatsapp ask from=${fromPhone} q="${question.slice(0, 80)}"`);

        // Asegura la columna ProyectoActivo (lazy migration) antes de leer/escribir.
        await ensureProyectoActivoColumn();

        // 3. Comando de reinicio de selección ("cambiar", "menu", reset:true)
        if (body.reset || isResetCmd(question)) {
            await clearActiveProject(fromPhone);
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
                    PENDING.delete(phoneKey);
                    // Si el menú nació de un "cambiar" (sin pregunta real) solo confirmamos.
                    if (!pend.question || isResetCmd(pend.question)) {
                        await setActiveProject(fromPhone, picked.IdProyecto);
                        return NextResponse.json({
                            answer: `Listo, ahora consultas sobre ${picked.Proyecto}. ¿Qué quieres saber?`,
                            project: { idProyecto: picked.IdProyecto, nombre: picked.Proyecto },
                            meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
                        });
                    }
                    // Respondemos la pregunta ORIGINAL que disparó el menú.
                    return await answerForProject(picked, pend.question, fromPhone, requestId, startTime, true, baseUrl);
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

        // 5c. Proyecto activo persistido en BD (ProyectoActivo = 1)
        if (!active) {
            active = projects.find(p => p.ProyectoActivo === 1) || null;
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
        return await answerForProject(active, question, fromPhone, requestId, startTime, false, baseUrl);

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
    requestId: string, startTime: number, justSelected: boolean, baseUrl: string
): Promise<Response> {
    // Persiste el proyecto elegido como activo de este teléfono en BD
    // (ProyectoActivo=1 en el elegido, 0 en los demás del mismo número).
    await setActiveProject(fromPhone, project.IdProyecto);

    const { answer, report, executedSql, model } = await runAgent(project.IdProyecto, project.Proyecto, question);
    if (executedSql.length) {
        console.log(`[${requestId}] project=${project.IdProyecto} SQL: ${executedSql.join(' | ').slice(0, 240)}`);
    }

    // Si acaba de elegir gimnasio, prefijamos para dar contexto en el chat.
    const prefix = justSelected ? `📍 ${project.Proyecto}\n` : '';
    let finalAnswer = (prefix + (answer || 'No pude generar una respuesta. ¿Puedes reformular tu pregunta?')).slice(0, ANSWER_CAP + 60);

    // Si el agente generó datos para visualizar, guardamos el reporte y agregamos el link.
    let reportUrl: string | null = null;
    if (report) {
        try {
            const uuid = await saveReport(project, fromPhone, question, answer, report);
            if (baseUrl) {
                reportUrl = `${baseUrl}/es/wa-report?r=${uuid}`;
                finalAnswer += `\n\n📊 Ver gráfica y detalle: ${reportUrl}`;
            } else {
                console.warn(`[${requestId}] reporte ${uuid} guardado pero falta APP_PUBLIC_URL para el link`);
            }
        } catch (e) {
            console.error(`[${requestId}] no se pudo guardar el reporte:`, e);
        }
    }

    return NextResponse.json({
        answer: finalAnswer,
        project: { idProyecto: project.IdProyecto, nombre: project.Proyecto },
        reportUrl,
        meta: {
            request_id: requestId,
            from_phone: fromPhone,
            model_used: model,
            rows_queries: executedSql.length,
            has_report: !!report,
            elapsed_ms: Date.now() - startTime,
        },
    });
}
