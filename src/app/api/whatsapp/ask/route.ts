import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { getProjectConnectionPoolRaw, getIntegratedPoolForProjectIds } from '@/lib/projectDb';
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
 *   3. Si el número tiene VARIOS proyectos → MODO INTEGRADO: cada consulta se ejecuta en
 *      la BD de TODOS los gimnasios asignados al número y los resultados se fusionan
 *      (igual que ProyectosIntegrados en la web). No se pide elegir uno.
 *   4. El bridge puede forzar un solo gimnasio del número pasando `projectId`.
 *
 * Body: { question, from_phone, projectId?, timestamp? }
 * Auth: header X-API-Key debe coincidir con WHATSAPP_API_KEY.
 *
 * Respuesta: { answer, project?, projects?, reportUrl?, meta }
 */

const MAX_TURNS = 8;
const ANSWER_CAP = 1500;

// Modelo (configurable). Sonnet equilibra calidad de SQL y latencia.
const WA_MODEL = process.env.WHATSAPP_AI_MODEL || 'claude-sonnet-4-6';
const WA_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

interface WhatsAppRequest {
    question?: string;
    from_phone?: string;
    projectId?: number | string;
    timestamp?: string;
}

interface PhoneProject {
    IdProyecto: number;
    Proyecto: string;
    Nombre: string | null;
    projectUuid: string;
}

// ─── Helpers de teléfono ───────────────────────────────────────────────────────
const digits = (s: string) => (s || '').replace(/\D/g, '');
const last10 = (s: string) => digits(s).slice(-10);

// Normaliza la columna Telefono a sus últimos 10 dígitos (ignora lada/espacios/signos).
const normPhoneSql = (col: string) =>
    `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},' ',''),'-',''),'(',''),')',''),'+',''),'.','') , 10)`;

// ─── Lookup de proyectos por número ────────────────────────────────────────────
async function findProjectsForPhone(fromPhone: string): Promise<PhoneProject[]> {
    const tail = last10(fromPhone);
    if (tail.length < 8) return [];
    // Compara por los últimos 10 dígitos, ignorando lada/espacios/signos del registro.
    // Solo gimnasios activos (Status = 0): no consultamos proyectos deshabilitados.
    const rows = await query(
        `SELECT t.IdProyecto, t.Nombre, p.Proyecto, p.UUID AS projectUuid
         FROM tblProyectosTelefonos t
         JOIN tblProyectos p ON t.IdProyecto = p.IdProyecto
         WHERE ${normPhoneSql('t.Telefono')} = ? AND p.Status = 0
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
            projectUuid: String(r.projectUuid || ''),
        });
    }
    return out;
}

// Nota que se antepone al catálogo cuando el número tiene 2+ gimnasios, para que
// el agente sepa que cada SELECT corre en TODAS las BDs y los resultados se fusionan.
function integratedNote(projects: PhoneProject[]): string {
    const names = projects.map(p => p.Proyecto).join(', ');
    const ejemplo = projects[0].Proyecto;
    return `
══════════════════════════════════════════════════════════════
MODO INTEGRADO (multi-gimnasio)
══════════════════════════════════════════════════════════════
Este número está asignado a ${projects.length} gimnasios: ${names}.
Cada consulta SQL que ejecutes se corre AUTOMÁTICAMENTE en la BD de CADA gimnasio
y los resultados se combinan en uno solo (las sumas/conteos/promedios se agregan
entre gimnasios; los listados se concatenan). Por eso:
- Escribe UN solo SELECT estándar; el sistema lo replica en todos los gimnasios.
- NO filtres por IDs específicos de sucursal/forma de pago/cuota: esos IDs son
  distintos en cada gimnasio. Filtra o agrupa por NOMBRE cuando lo necesites.

CÓMO LIMITAR A UN SOLO GIMNASIO (OBLIGATORIO cuando el usuario nombra uno):
- Si el usuario pide datos de UN gimnasio en particular (p. ej. "ventas de ${ejemplo}"),
  antepón al SELECT el comentario /*ONLY_PROJECT:Nombre*/ con el nombre EXACTO del
  gimnasio; el sistema ejecutará la consulta SOLO en la BD de ese gimnasio.
  Ejemplo: /*ONLY_PROJECT:${ejemplo}*/ SELECT SUM(Total) AS Total FROM tblMovimientos WHERE Status <> 2 AND YEAR(FechaMovimiento)=2026 AND MONTH(FechaMovimiento)=6
  Gimnasios válidos para este número: ${names}.
- La ÚNICA forma de acotar a un gimnasio es ese comentario. NUNCA lo intentes dentro
  del SQL (no uses WHERE Proyecto=... ni WHERE _Proyecto=...): el nombre del gimnasio
  NO es una columna de la BD y la consulta fallará.

SOBRE EL CAMPO _Proyecto:
- _Proyecto es SOLO una etiqueta que el sistema agrega a cada fila del RESULTADO para
  indicar de qué gimnasio salió. NO existe en la base de datos: nunca lo pongas en
  WHERE, HAVING, GROUP BY ni JOIN (causa error). Úsalo solo como columna de salida en
  los listados del reporte para distinguir cada gimnasio.
- El catálogo de abajo es una referencia de estructura (tomada de "${ejemplo}").`.trim();
}

// ─── Tool ──────────────────────────────────────────────────────────────────────
const AGENT_TOOLS: any[] = [
    {
        name: 'query_database',
        description: `Ejecuta SQL SELECT/WITH de solo lectura contra la BD MySQL del gimnasio.
REGLAS OBLIGATORIAS:
- VENTAS: Las ventas se obtienen exclusivamente de tblMovimientos (no de tblVentas). La fecha de venta es FechaMovimiento, el detalle de ventas es tblDetalleMovimientos y las formas de pago se obtienen de tblMovimientosPagos.
- CLIENTES: Los clientes son los socios y se obtienen siempre de la tabla tblSocios. El código del socio (CodigoSocio) se almacena y consulta físicamente en el campo 'CodigoBarras' en 'tblSocios'; usa siempre 'CodigoBarras' para buscar o referirte a este código. El contacto prioritario de un socio es siempre su teléfono en la columna 'OtroTelefono' (tiene mayor prioridad que su correo electrónico 'CorreoElectronico'). Al listar o consultar socios, especialmente los que vencen o vencidos, incluye SIEMPRE la columna 'OtroTelefono' como contacto principal. Si pide consulta de Hombres/Mujeres, debes consultar el campo 'Sexo' en 'tblSocios', donde: 0 o 1 = Hombre, y 2 = Mujer.
- VISITAS: La tabla tblVisitas indica visitas/asistencias únicamente de socios/clientes (FechaVisita).
- ASISTENCIAS: La tabla tblAsistencias indica las asistencias de empleados/personal (FechaAsistencia).
- ASISTENCIA INDIVIDUAL: Al preguntar por la asistencia o accesos de una persona específica por su nombre (ej. "asistencia de Juan"), busca primero en 'tblSocios'; si existe, consulta en 'tblVisitas' usando 'IdSocio'; si no existe en 'tblSocios', búscalo en 'tblUsuarios' (usuarios/empleados) y si existe ahí, consulta su asistencia en 'tblAsistencias' relacionando por 'IdUsuario'.
- PRODUCTOS: La tabla tblCuotas indica los productos (membresías y artículos). IdCuota equivale a IdProducto, y Cuota es el nombre del Producto.
- PLANES Y RUTINAS: tblPlanesEntrenamiento. Si preguntan por su rutina o plan de entrenamiento, consulta 'tblPlanesEntrenamiento' y resume su plan o dale el enlace a su página (formato: /wa-plan?projectUuid=[projectUuid]&planUuid=[UUID]). Si piden diseñar una rutina en el chat, asume el rol de un Entrenador Personal de Élite y genérala directamente.
- Fechas: son DATETIME reales. Filtra con DATE()/MONTH()/YEAR()/BETWEEN sobre la columna de fecha de cada tabla (FechaMovimiento, FechaVisita, FechaAsistencia, FechaVencimiento).
- Status=2 = cancelado/anulado/eliminado: filtra "Status <> 2" (o "Status = 0").
- SOCIO/CLIENTE ACTIVO = Status = 0 AND FechaVencimiento >= CURDATE(). VENCIDO = FechaVencimiento < CURDATE().
- Cuotas/Productos: TipoCuota=1 membresía/cuota; TipoCuota=2 producto de tienda.
- MySQL: LIMIT obligatorio en listados. Nunca TOP.
- Usa los IDs reales del catálogo del proyecto (sucursales, formas de pago, grupos horarios, cuotas).
- Puedes encadenar múltiples llamadas para explorar antes de responder.`,
        input_schema: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'SELECT o WITH. Un statement. Sin ; al final. Con LIMIT.' },
            },
            required: ['sql'],
        },
    },
    {
        name: 'create_training_plan',
        description: `Crea un nuevo registro de plan de entrenamiento en la base de datos para el socio especificado. Devuelve el UUID generado.
Usa esta herramienta cuando el usuario pida registrar, diseñar o ver una rutina de entrenamiento para un socio y NO exista un registro previo en 'tblPlanesEntrenamiento'.`,
        input_schema: {
            type: 'object',
            properties: {
                socio: { type: 'string', description: 'Nombre completo del socio' },
                codigoSocio: { type: 'string', description: 'Código del socio' },
                genero: { type: 'number', description: 'Género (1 = Hombre, 2 = Mujer)' },
                edad: { type: 'number', description: 'Edad del socio' },
                peso: { type: 'number', description: 'Peso en kg' },
                estatura: { type: 'number', description: 'Estatura en metros' },
                dias: { type: 'number', description: 'Días de entrenamiento recomendados a la semana (por defecto 3)' },
                minutos: { type: 'number', description: 'Minutos por sesión recomendados (por defecto 60)' },
                observaciones: { type: 'string', description: 'Objetivos u observaciones de entrenamiento del socio' }
            },
            required: ['socio', 'codigoSocio']
        }
    }
];

async function executeQuery(pool: any, sql: string): Promise<any[]> {
    // Tolera un comentario inicial /*ONLY_PROJECT:...*/ antes del SELECT/WITH.
    const head = sql.toLowerCase().trim().replace(/^(?:\/\*[\s\S]*?\*\/\s*)*/, '');
    if (!head.startsWith('select') && !head.startsWith('with')) {
        throw new Error('Solo se permiten consultas SELECT / WITH.');
    }
    const [rows] = await pool.query(sql);
    return rows as any[];
}

async function runToolBlocks(pool: any, content: any[], executedSql: string[], capture?: { lastRows: any[] }): Promise<any[]> {
    const toolResults: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'create_training_plan') {
            const input = block.input as any;
            const uuid = uuidv4();
            const { socio, codigoSocio, genero, edad, peso, estatura, dias, minutes, minutos, observaciones } = input;
            
            const g = genero != null ? Number(genero) : 1;
            const e = edad != null ? Number(edad) : 0;
            const p = peso != null ? Number(peso) : 0.0;
            const est = estatura != null ? Number(estatura) : 0.0;
            const d = dias != null ? Number(dias) : 3;
            const m = minutos != null ? Number(minutos) : (minutes != null ? Number(minutes) : 60);
            const obs = observaciones || '';

            try {
                await pool.execute(
                    `INSERT INTO tblPlanesEntrenamiento 
                     (Socio, CodigoSocio, Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones, UUID, FechaPlanEntrenamiento) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [socio, codigoSocio, g, e, p, est, d, m, obs, uuid]
                );
                
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({ success: true, uuid, message: 'Plan de entrenamiento creado correctamente.' }),
                });
            } catch (err: any) {
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({ error: err.message }),
                    is_error: true,
                });
            }
            continue;
        }

        const sql = String((block.input as any)?.sql || '').replace(/```sql|```/g, '').trim();
        if (sql) executedSql.push(sql);
        try {
            const rows = await executeQuery(pool, sql);
            // Guarda las filas de la última consulta con resultados (para armar
            // automáticamente la tabla del reporte si el modelo no emite el bloque).
            if (capture && Array.isArray(rows) && rows.length > 0) capture.lastRows = rows;
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

function buildSystemPrompt(projectCatalog: string, gymName: string, projectUuid: string, baseUrl: string): string {
    const now = new Date();
    const fecha = now.toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'full', timeStyle: 'short' });
    const monthNames = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // Extraemos mes y año en zona horaria America/Monterrey para evitar desajustes de zona horaria (UTC)
    const formatter = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Monterrey',
        year: 'numeric',
        month: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);

    const m = getPart('month');
    const y = getPart('year');
    const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;

    const trainingPlanBaseUrl = baseUrl ? `${baseUrl}/es/wa-plan?projectUuid=${projectUuid}` : `/wa-plan?projectUuid=${projectUuid}`;

    return `Eres el AGENTE INTEGRA GYM respondiendo por WhatsApp para el gimnasio "${gymName || 'actual'}".
Eres un consultor experto en gestión, socios, asistencia y rentabilidad de gimnasios.

FECHA Y HORA ACTUAL: ${fecha}
INTERPRETACIÓN DE PERÍODO:
  - "hoy" → DATE(fecha)=CURDATE()
  - "este mes" → MONTH(fecha)=${m} AND YEAR(fecha)=${y}
  - "mes pasado" → MONTH(fecha)=${pm} AND YEAR(fecha)=${py}

──────────────────────────────────────────────────────────────
REGLA OBLIGATORIA DE PLANES Y RUTINAS:
- Al responder sobre la rutina o plan de entrenamiento de un usuario:
  1. Busca primero en 'tblPlanesEntrenamiento' por 'Socio' o 'CodigoSocio'.
  2. Si NO existe el registro en 'tblPlanesEntrenamiento', ¡debes CREARLO usando la herramienta 'create_training_plan'! Primero busca al socio y sus datos básicos (nombre, código, sexo, edad) en 'tblSocios' para pasárselos a la herramienta.
  3. Una vez creado el plan (o si ya existía):
     * Proporciónale SIEMPRE en tu respuesta el enlace directo público para ver, editar, generar o compartir su rutina: ${trainingPlanBaseUrl}&planUuid=[UUID] (sustituyendo [UUID] por la columna UUID real o generada).
     * Ejemplo: "Puedes abrir, descargar en PDF y compartir tu rutina aquí: ${trainingPlanBaseUrl}&planUuid=..."
──────────────────────────────────────────────────────────────

${DATABASE_SCHEMA}

${projectCatalog}

──────────────────────────────────────────────────────────────
CÓMO RESPONDES (no negociable)
──────────────────────────────────────────────────────────────
- Tienes acceso COMPLETO de SOLO LECTURA a la BD del gimnasio vía query_database.
- NUNCA expongas nombres técnicos de tablas/columnas al usuario.
- NUNCA digas "no tengo acceso a datos" sin antes intentar al menos una query.
- Si la pregunta involucra datos (ventas, socios, visitas, asistencias, cuotas, productos, sucursales, formas de pago, fechas, montos) → USA query_database.
- Encadena consultas si necesitas explorar IDs/nombres o aislar una causa.
- Para VENTAS usa SIEMPRE tblMovimientos (FechaMovimiento, tblDetalleMovimientos, tblMovimientosPagos).
- Para CLIENTES consulta siempre la tabla tblSocios. El contacto prioritario de un socio es siempre su teléfono en la columna 'OtroTelefono' (vale más y es más importante que su correo). Al consultar o listar socios, especialmente los que vencen o vencidos, incluye SIEMPRE la columna 'OtroTelefono' en tu SELECT. Si pide consulta de Hombres/Mujeres, debes consultar el campo 'Sexo' en 'tblSocios', donde: 0 o 1 = Hombre, y 2 = Mujer.
- Para ASISTENCIAS de empleados usa la tabla tblAsistencias. Para visitas de socios usa tblVisitas. Al preguntar por la asistencia de una persona por su nombre (ej. "asistencia de Juan"), primero búscala en 'tblSocios' y si existe consulta en 'tblVisitas' usando 'IdSocio'; si no existe en 'tblSocios', búscala en 'tblUsuarios' y si existe ahí, consulta 'tblAsistencias' usando 'IdUsuario'.
- Para PRODUCTOS usa tblCuotas (IdCuota es IdProducto, Cuota es Producto).
- Para preguntas que NO son de datos (saludo, "¿qué puedes hacer?") responde directo, breve y cordial, SIN consultar.
- Nunca inventes cifras: si una consulta sale vacía revisa el filtro (sucursal, Status, fecha, tabla correcta) y reintenta antes de decir que no hay datos.
- Si una consulta DEVUELVE ERROR (te llega is_error) o sigue vacía tras revisar el filtro y reintentar, di la VERDAD de forma breve ("No encontré ventas de X en ese período" o "Tuve un problema técnico al consultar; ¿lo intentamos de nuevo?"). Está PROHIBIDO inventar excusas tipo "el sistema está lento, intenta más tarde" o prometer datos "en unos minutos": eso confunde al usuario.

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
- OBLIGATORIO cuando la respuesta sea una LISTA de varios registros (socios que vencen/vencidos con su teléfono, top productos, ventas por día, movimientos, socios por sucursal, etc.): SIEMPRE genera "tables" con TODAS las filas relevantes. NO metas la lista completa en el texto de WhatsApp.
- En esos casos el TEXTO de WhatsApp es SOLO un resumen de 1-2 frases (cuántos son, total, lo más relevante). El detalle completo va en la tabla, que el usuario abrirá con el link que agrega el sistema.
- El TEXTO va ANTES del bloque y debe entenderse SOLO; el bloque es el detalle ampliado.
- "tables": [{"title","columns":[...],"rows":[[...]]}]. Incluye las columnas útiles (p. ej. para socios: Nombre, Teléfono (OtroTelefono), Vence). Números crudos.
- "charts": "type" bar|line|pie, "format" currency|number|percent, "data":[{"name","value","value2"?}], "seriesLabels"?:[..]. Máx ~12 puntos, valores crudos (sin $, comas ni %).
- Incluye "tables", "charts" o ambos. Omite el bloque por completo SOLO para respuestas de un único número, saludos o conceptos.
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
// Recibe el `pool` ya resuelto (individual o integrado multi-gimnasio) y el
// catálogo ya construido, para que el caller decida el modo single/integrado.
async function runAgent(
    pool: any, projectCatalog: string, gymName: string, projectUuid: string, baseUrl: string, question: string
): Promise<{ answer: string; report: any | null; autoReport: boolean; rowCount: number; executedSql: string[]; model: string }> {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const system = buildSystemPrompt(projectCatalog, gymName, projectUuid, baseUrl);
    const executedSql: string[] = [];
    const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: question }];

    let finalText = '';
    let modelUsed = WA_MODEL;
    let turns = 0;
    const capture = { lastRows: [] as any[] };

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
        const toolResults = await runToolBlocks(pool, msg.content, executedSql, capture);
        messages.push({ role: 'user', content: toolResults });
    }

    const ex = extractReport(finalText);
    // Si el modelo no emitió bloque report pero la última consulta devolvió
    // REGISTROS CON VARIAS COLUMNAS, armamos la tabla automáticamente → liga directa.
    let report = ex.report;
    let autoReport = false;
    let rowCount = 0;
    if (!report) {
        const fb = buildFallbackReport(capture.lastRows);
        if (fb) { report = fb; autoReport = true; rowCount = Math.min(capture.lastRows.length, 200); }
    }
    return { answer: ex.clean.slice(0, ANSWER_CAP), report, autoReport, rowCount, executedSql, model: modelUsed };
}

// Arma un reporte de tabla a partir de las filas crudas de una consulta cuando el
// modelo no generó el bloque report (respaldo para garantizar el link en listas).
// Solo aplica si hay REGISTROS (≥2 filas) con VARIAS COLUMNAS (≥2).
function buildFallbackReport(rows: any[]): any | null {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const sample = rows.slice(0, 200);
    const first = sample[0];
    if (!first || typeof first !== 'object') return null;
    // Columnas útiles: descarta blobs/objetos (fotos, etc.); conserva fechas/números/texto.
    const cols = Object.keys(first).filter(k => {
        const v = first[k];
        return !(v && typeof v === 'object' && !(v instanceof Date));
    });
    if (cols.length < 2) return null;
    const sane = (v: any) => {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
        if (typeof v === 'object') return '';
        return v;
    };
    return {
        title: null,
        tables: [{ columns: cols, rows: sample.map(r => cols.map(c => sane(r[c]))) }],
        charts: [],
    };
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

// Base URL pública para el link. Prioriza APP_PUBLIC_URL (la correcta de cara al
// público). Si no está, deriva de los headers del proxy y, como último recurso,
// del origin de la propia petición — así el link NUNCA queda vacío.
function computeBaseUrl(req: Request): string {
    const env = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (env) return env;
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (host) return `${proto}://${host}`;
    try { return new URL(req.url).origin; } catch { return ''; }
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

        const baseUrl = computeBaseUrl(req);
        console.log(`[${requestId}] whatsapp ask from=${fromPhone} q="${question.slice(0, 80)}"`);

        // 3. Proyectos (gimnasios activos) asignados a este número
        const projects = await findProjectsForPhone(fromPhone);
        if (projects.length === 0) {
            return NextResponse.json({
                answer: 'Este número no está asignado a ningún proyecto Integra Members.',
                meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
            });
        }

        // 4. El bridge puede forzar UN solo gimnasio del número pasando projectId.
        //    Si no, con 1 proyecto se responde directo y con 2+ se consulta EN TODOS
        //    (modo integrado): cada query corre en las "n" BDs y se fusiona el resultado.
        let target = projects;
        if (body.projectId != null) {
            const only = projects.find(p => p.IdProyecto === Number(body.projectId));
            if (only) target = [only];
        }

        // 5. Responder (single o integrado según cuántos gimnasios queden)
        return await answerForPhone(target, question, fromPhone, requestId, startTime, baseUrl);

    } catch (e: any) {
        console.error(`[${requestId}] error:`, e);
        return NextResponse.json({
            answer: 'Tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?',
            error: e?.message || 'Error desconocido',
        }, { status: 500 });
    }
}

// Responde la pregunta sobre los gimnasios del número:
//   - 1 gimnasio  → consulta normal sobre su BD.
//   - 2+ gimnasios → MODO INTEGRADO: cada SELECT corre en TODAS las BDs y los
//     resultados se fusionan (igual que ProyectosIntegrados en la web).
async function answerForPhone(
    projects: PhoneProject[], question: string, fromPhone: string,
    requestId: string, startTime: number, baseUrl: string
): Promise<Response> {
    const integrated = projects.length > 1;
    const primary = projects[0];
    const projectIds = projects.map(p => p.IdProyecto);

    // Pool: 1 → pool individual; 2+ → pool virtual que replica y fusiona en las n BDs.
    const pool = integrated
        ? await getIntegratedPoolForProjectIds(projectIds)
        : await getProjectConnectionPoolRaw(primary.IdProyecto);

    // Catálogo: SIEMPRE desde un pool individual (el primario) para no fusionar las
    // consultas del propio catálogo. En modo integrado anteponemos la nota explicativa.
    let projectCatalog = '';
    try {
        const catalogPool = integrated
            ? await getProjectConnectionPoolRaw(primary.IdProyecto)
            : pool;
        projectCatalog = await buildProjectCatalog(catalogPool, String(primary.IdProyecto));
    } catch (e) {
        console.error('[whatsapp/ask] catálogo falló:', e);
    }
    if (integrated) projectCatalog = `${integratedNote(projects)}\n\n${projectCatalog}`;

    const gymLabel = integrated
        ? `tus gimnasios: ${projects.map(p => p.Proyecto).join(', ')}`
        : primary.Proyecto;

    const { answer, report, autoReport, rowCount, executedSql, model } = await runAgent(
        pool, projectCatalog, gymLabel, primary.projectUuid, baseUrl, question
    );
    if (executedSql.length) {
        console.log(`[${requestId}] projects=${projectIds.join(',')} SQL: ${executedSql.join(' | ').slice(0, 240)}`);
    }

    // Si el resultado son REGISTROS CON VARIAS COLUMNAS (tabla armada automáticamente),
    // mandamos la liga DIRECTO: texto corto (resumen del modelo si es breve, o un lead
    // estándar) y dejamos que el detalle viva en la página, sin volcar la lista al chat.
    let textPart = answer;
    if (autoReport) {
        const shortSummary = answer && answer.length <= 180 && !answer.includes('\n') ? answer : '';
        textPart = shortSummary || `Encontré ${rowCount}${rowCount >= 200 ? '+' : ''} registros. Te dejo el detalle 👇`;
    }
    let finalAnswer = (textPart || 'Aquí está el detalle.').slice(0, ANSWER_CAP + 60);

    // Si el agente generó datos para visualizar, guardamos el reporte y agregamos el link.
    let reportUrl: string | null = null;
    if (report) {
        try {
            const uuid = await saveReport(primary, fromPhone, question, answer, report);
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
        project: { idProyecto: primary.IdProyecto, nombre: primary.Proyecto },
        projects: projects.map(p => ({ idProyecto: p.IdProyecto, nombre: p.Proyecto })),
        integrated,
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
