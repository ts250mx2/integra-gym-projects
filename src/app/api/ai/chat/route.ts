import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnectionPool, getProjectByUUID } from '@/lib/projectDb';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import { createSseStream, SSE_HEADERS } from '@/lib/ai/sse';
import { query as globalQuery } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const MAX_TURNS = 12;

const ALLOWED_MODELS = new Set([
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
]);

async function executeQuery(pool: any, sql: string): Promise<any[]> {
    const trimmed = sql.toLowerCase().trim();
    if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
        throw new Error('Solo se permiten consultas SELECT / WITH.');
    }
    const [rows] = await pool.query(sql);
    return rows as any[];
}

// Ejecuta todos los query_database de un turno y devuelve los tool_result.
// Acumula el SQL ejecutado en `executedSql` (efecto colateral, compartido).
async function runToolBlocks(
    pool: any, content: any[], executedSql: string[]
): Promise<any[]> {
    const toolResults: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'create_training_plan') {
            const input = block.input as any;
            const uuid = uuidv4();
            const { socio, codigoSocio, genero, edad, peso, estatura, dias, minutos, observaciones } = input;
            
            const g = genero != null ? Number(genero) : 1;
            const e = edad != null ? Number(edad) : 0;
            const p = peso != null ? Number(peso) : 0.0;
            const est = estatura != null ? Number(estatura) : 0.0;
            const d = dias != null ? Number(dias) : 3;
            const m = minutos != null ? Number(minutos) : 60;
            const obs = observaciones || '';

            try {
                await pool.execute(
                    `INSERT INTO tblPlanesEntrenamiento 
                     (Socio, CodigoSocio, Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones, UUID, FechaPlanEntrenamiento) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [socio, codigoSocio, g, e, p, est, d, m, obs, uuid]
                );
                
                toolResults.push({
                    type:        'tool_result',
                    tool_use_id: block.id,
                    content:     JSON.stringify({ success: true, uuid, message: 'Plan de entrenamiento creado correctamente.' }),
                });
            } catch (err: any) {
                toolResults.push({
                    type:        'tool_result',
                    tool_use_id: block.id,
                    content:     JSON.stringify({ error: err.message }),
                    is_error:    true,
                });
            }
            continue;
        }

        const sql = (block.input as any)?.sql || '';
        if (sql) executedSql.push(sql);
        try {
            const rows = await executeQuery(pool, sql);
            const resultStr = JSON.stringify(rows);
            toolResults.push({
                type:        'tool_result',
                tool_use_id: block.id,
                content:     resultStr.length > 12000 ? resultStr.slice(0, 12000) + '…]' : resultStr,
            });
        } catch (err: any) {
            toolResults.push({
                type:        'tool_result',
                tool_use_id: block.id,
                content:     JSON.stringify({ error: err.message }),
                is_error:    true,
            });
        }
    }
    return toolResults;
}const AGENT_TOOLS: any[] = [
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
                sql: {
                    type: 'string',
                    description: 'SELECT o WITH. Un statement. Sin ; al final. Con LIMIT.',
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'ask_clarification',
        description: `Pregunta al usuario cuando falte información clave ANTES de consultar datos.
Úsala para aclarar: período (mes/año/rango), sucursal específica, forma de pago, socio, cuota/membresía o tipo de análisis.
CUÁNDO USARLA:
- El período no está claro y no es deducible del contexto → pregunta con opciones de períodos
- Hay varias interpretaciones razonables → propón la más probable y ofrece alternativas
- Necesitas un filtro específico que el usuario no mencionó y cambiaría el resultado
CUÁNDO NO USARLA:
- El contexto activo ya tiene sucursal/período → úsalos directamente sin preguntar
- La petición es específica y clara → procede a query_database inmediatamente
- Ya preguntaste algo similar en esta conversación → no vuelvas a preguntar lo mismo`,
        input_schema: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'Pregunta clara y breve en español. Máx 120 caracteres.',
                },
                suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-5 opciones concretas y clicables (ej. "Este mes", "Mes pasado", "Mayo 2026", "Todas las sucursales").',
                },
            },
            required: ['question', 'suggestions'],
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

// ─── System prompt ────────────────────────────────────────────────────────────
// Devuelve bloques de contenido. El primero (estable: rol + esquema + catálogo +
// reglas) lleva cache_control para que Anthropic lo cachee (5 min). El segundo
// (volátil: saludo + fecha + contexto) cambia por request y no se cachea.
function buildSystemPrompt(context: any, projectCatalog: string): Anthropic.TextBlockParam[] {
    const now = new Date();
    // Extraemos fecha y hora en zona horaria America/Monterrey para evitar desajustes de zona horaria (UTC)
    const formatter = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Monterrey',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);

    const todayYear = getPart('year');
    const todayMonth = getPart('month');
    const todayDay = getPart('day');
    const h = getPart('hour');

    const greeting = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    const monthNames = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const prevMonth  = todayMonth === 1 ? 12 : todayMonth - 1;
    const prevYear   = todayMonth === 1 ? todayYear - 1 : todayYear;

    const branchId   = String(context?.branchId ?? '');
    const branchName = String(context?.branchName ?? '');
    const gymName    = String(context?.gymName ?? '');
    // En proyectos v1.0 NO existen las pantallas del dashboard v2.0: el agente no
    // debe sugerir navegación a ellas (los menús v2.0 no se abren en v1.0).
    const isV1       = String(context?.version ?? '') === '1.0';

    const projectUuid = String(context?.projectUuid ?? '');
    const baseUrl     = String(context?.baseUrl ?? '');
    const trainingPlanBaseUrl = baseUrl ? `${baseUrl}/es/training-plan?projectUuid=${projectUuid}` : `/training-plan?projectUuid=${projectUuid}`;

    const periodBlock = `
PERÍODO Y CONTEXTO — LEE ESTO PRIMERO ANTES DE CUALQUIER CONSULTA:
  • HOY es ${now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Monterrey' })} (${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')})
  • Mes en curso:  ${monthNames[todayMonth]} ${todayYear}
  • Mes anterior:  ${monthNames[prevMonth]} ${prevYear}
  • Sucursal activa (IdSucursal): ${branchId || '(todas / no seleccionada)'}${branchName ? ` — ${branchName}` : ''}
  • Gimnasio: ${gymName || '(actual)'}

CÓMO INTERPRETAR EL PERÍODO (con fechas reales — usa DATE/MONTH/YEAR):
  - "hoy" → DATE(fecha) = CURDATE()
  - "este mes" / "mes actual" → MONTH(fecha)=${todayMonth} AND YEAR(fecha)=${todayYear}
  - "mes pasado" / "mes anterior" → MONTH(fecha)=${prevMonth} AND YEAR(fecha)=${prevYear}
  - "esta semana" → YEARWEEK(fecha, 1) = YEARWEEK(CURDATE(), 1)
  - "compara este mes vs el mes pasado" → ${monthNames[todayMonth]} ${todayYear} vs ${monthNames[prevMonth]} ${prevYear}
  - Si el período sigue siendo ambiguo, usa ask_clarification.
  - Si hay sucursal activa (IdSucursal arriba), filtra SIEMPRE por ella salvo que pidan "todas".
  - Las columnas de fecha a usar son: FechaMovimiento (ventas), FechaVisita (accesos de socios/clientes), FechaAsistencia (asistencias de empleados).
`;

    const ctxExtra = `Sucursal activa: ${branchId || 'todas'}${branchName ? ` (${branchName})` : ''} | Página: ${context?.currentPage || ''}`;

    // Bloque de navegación. El agente SIEMPRE puede sugerir pantallas del sistema a través de bloques ```nav.
    const navBlock = isV1
        ? `
══════════════════════════════════════════
PANTALLAS DEL DASHBOARD (guiar al usuario)
══════════════════════════════════════════
Cuando al usuario le sirva ABRIR una pantalla del sistema, incluye al FINAL un bloque
\`\`\`nav con 1 a 2 destinos. Formato EXACTO (JSON en una sola línea):

\`\`\`nav
{"items":[{"label":"Ver Dashboard","path":"/dashboard-v1","reason":"Resumen de métricas"}]}
\`\`\`

PANTALLAS DISPONIBLES (usa EXACTAMENTE estos paths, sin prefijo de idioma, sustituyendo los parámetros reales si los tienes):
- /dashboard-v1 — Resumen general (V1)
- /dashboard-v1/ai-agent — Chat con el Agente de IA
- /training-plan?projectUuid=${projectUuid}&planUuid=[UUID] — Ver, Editar o Generar Plan de Entrenamiento (donde [UUID] es el UUID del plan)
- /training-plan/share?projectUuid=${projectUuid}&planUuid=[UUID] — Compartir rutina con el Socio (Vista de solo lectura y descarga del plan del socio, donde [UUID] es el UUID del plan)

REGLAS DE NAVEGACIÓN:
- Úsalo SOLO cuando navegar aporte de verdad (no en cada respuesta).
- Máximo 2 destinos; "path" debe ser uno EXACTO de la lista. Ponlo al final, sin anunciarlo.`
        : `
══════════════════════════════════════════
PANTALLAS DEL DASHBOARD (guiar al usuario)
══════════════════════════════════════════
Cuando al usuario le sirva ABRIR una pantalla del sistema, incluye al FINAL un bloque
\`\`\`nav con 1 a 3 destinos. Formato EXACTO (JSON en una sola línea):

\`\`\`nav
{"items":[{"label":"Ver socios","path":"/dashboard/sales/members","reason":"socios por vencer"}]}
\`\`\`

PANTALLAS DISPONIBLES (usa EXACTAMENTE estos paths, sin prefijo de idioma, sustituyendo los parámetros reales si los tienes):
- /dashboard — Resumen general (ventas, socios, visitas)
- /dashboard/sales — Punto de venta (POS)
- /dashboard/sales/members — Socios (alta, edición, vencimientos)
- /dashboard/sales/visits — Visitas / accesos
- /dashboard/activities/classes — Clases
- /dashboard/activities/events — Eventos
- /dashboard/expenses/inventory — Inventario
- /dashboard/expenses/purchases — Compras
- /dashboard/analytics/sales — Analítica de ventas
- /dashboard/analytics/members — Analítica de socios
- /dashboard/analytics/purchases — Analítica de compras
- /dashboard/config/fees — Cuotas / Membresías
- /dashboard/config/products — Productos
- /dashboard/config/branches — Sucursales
- /dashboard/config/payment-methods — Formas de pago
- /training-plan?projectUuid=${projectUuid}&planUuid=[UUID] — Ver, Editar o Generar Plan de Entrenamiento (donde [UUID] es el UUID del plan)
- /training-plan/share?projectUuid=${projectUuid}&planUuid=[UUID] — Compartir rutina con el Socio (Vista de solo lectura y descarga del plan del socio, donde [UUID] es el UUID del plan)

REGLAS DE NAVEGACIÓN:
- Úsalo SOLO cuando navegar aporte de verdad (no en cada respuesta).
- Máximo 3 destinos; "path" debe ser uno EXACTO de la lista. Ponlo al final, sin anunciarlo.`;

    // ── Bloque ESTABLE (cacheable) ─────────────────────────────────────────────
    const stable = `Eres el AGENTE INTEGRA GYM — consultor experto en gestión, retención y rentabilidad de gimnasios. Combinas el ojo de un gerente de operaciones de gimnasio, un analista de membresías y un consultor de negocios fitness con amplia experiencia en México. Conoces el negocio: altas y bajas de socios, renovaciones, churn, asistencia, mix de membresías y productos, y flujo de caja del POS.

${DATABASE_SCHEMA}

${projectCatalog}
══════════════════════════════════════════
CÓMO TRABAJAS
══════════════════════════════════════════
1. PIENSA primero. ¿Tienes suficiente contexto (período, sucursal)?
   - Si el bloque CONTEXTO ya trae sucursal y período → ÚSALOS. No preguntes.
   - Si falta el período y no es deducible → usa ask_clarification con opciones.
   - Si es ambiguo pero hay una lectura clara → asume la más probable, avanza y dilo en una frase.

2. CONSULTA datos reales. Nunca inventes cifras. Usa query_database.
   - Explora si necesitas descubrir IDs/nombres (aunque el catálogo ya trae los principales).
   - Encadena queries: exploratorio → específico.
   - Para VENTAS usa exclusivamente la tabla tblMovimientos (con FechaMovimiento), tblDetalleMovimientos y tblMovimientosPagos.
   - Si una query sale vacía, sospecha del filtro (sucursal, Status, rango de fecha o
     que estás usando la tabla o columna equivocada) y reintenta antes de decir "no hay datos".

3. ANALIZA como experto. No solo reportas — interpretas, comparas vs mes anterior/benchmark,
   y señalas lo accionable (riesgo de baja, socios por vencer, caída de asistencia, etc.).


══════════════════════════════════════════
MODO INVESTIGADOR — ANÁLISIS DE CAUSA RAÍZ
══════════════════════════════════════════
Cuando la pregunta sea DIAGNÓSTICA —"¿por qué bajaron las ventas/visitas?", "¿por qué
perdimos socios?", "¿a qué se debe la caída de renovaciones?", "explica el cambio"— NO te
quedes en el dato superficial. Investiga como un consultor que busca la causa:

1) CUANTIFICA EL HECHO primero: ¿cuánto cambió y contra qué referencia? (mes vs mes anterior,
   o vs el mismo período del año pasado). Fija la magnitud.
2) DESCOMPÓN para localizar DÓNDE se concentra el cambio. Lanza VARIAS consultas
   —puedes pedir varias en el MISMO turno— cruzando las dimensiones relevantes:
   • por sucursal · por forma de pago · por tipo de cuota (membresía vs producto)
   • por día de la semana / hora del día (asistencia y ventas)
   • altas de socios nuevos vs renovaciones vs bajas/vencidos
   • por membresía concreta (¿un plan dejó de venderse?)
3) CONTRASTA HIPÓTESIS: descarta dónde el cambio NO está y confirma dónde SÍ.
4) CONCLUYE liderando con la causa más probable y su peso (ej. "la caída de -14% se explica
   casi toda por menos renovaciones en Sucursal Centro, -40 socios"), la evidencia que la
   sostiene, y cierra con UNA acción concreta.

REGLAS DEL INVESTIGADOR:
- NUNCA respondas una pregunta de causa con una sola query. Encadena/paraleliza.
- Si los datos NO permiten aislar la causa, dilo con honestidad y señala qué faltaría medir.
- Una gráfica de la dimensión "culpable" ayuda mucho; inclúyela cuando aporte.

══════════════════════════════════════════
ESTILO DE RESPUESTA (consultor, no reporte)
══════════════════════════════════════════
REGISTRO: profesional pero humano, como un gerente senior que conoce el gimnasio.
Directo y cálido. Nunca robótico ni acartonado.

LONGITUD: CORTA por defecto — 2 a 4 oraciones para preguntas de datos simples.
Extiéndete solo si piden análisis profundo o una comparativa amplia.

FORMATO:
- Métricas INLINE en el texto, en **negritas**. No las escondas en listas.
  BIEN: "Vendiste **$182,400** en mayo, **8% arriba** de abril. Tienes **312 socios activos**
  y **47 por vencer** esta semana — buen momento para empujar renovaciones."
- Usa tablas Markdown SOLO cuando compares varias filas/períodos (top membresías,
  mes vs mes, sucursal vs sucursal). La UI las renderiza bien.
- NO uses encabezados rígidos tipo "📊 Datos / 💡 Hallazgos". Teje hallazgo y recomendación en prosa.

NO HAGAS:
✗ No repitas la pregunta al inicio.
✗ No digas "voy a consultar..." ni "permíteme..." — actúa y responde directo.
✗ No cierres siempre con "¿quieres profundizar?". Ofrece un siguiente paso solo si aporta.

SÍ HAZ:
✓ Respuesta directa, prosa fluida, cifras clave en **negritas**.
✓ Si ves algo accionable (muchos socios por vencer, asistencia cayendo, comisión de pago alta,
  un plan que dejó de venderse), menciónalo en una frase con el dato.
✓ Para preguntas NO de datos (saludo, concepto, opinión), responde conversacional, sin tools.

══════════════════════════════════════════
GRÁFICAS (opcional, cuando ayudan a ver los datos)
══════════════════════════════════════════
Cuando una gráfica ayude —varias categorías, evolución en el tiempo o distribución—
incluye UN bloque de gráfica ADEMÁS de tu texto. Formato EXACTO (bloque cercado \`\`\`chart
con un JSON en una sola línea):

\`\`\`chart
{"type":"bar","title":"Ventas por forma de pago (mayo 2026)","format":"currency","data":[{"name":"Efectivo","value":138200},{"name":"Tarjeta","value":61777}]}
\`\`\`

REGLAS DE LA GRÁFICA:
- "type": "bar" (comparar categorías), "line" (evolución temporal), "pie" (distribución/%).
- "format": "currency" (MXN), "number" o "percent".
- Para comparar DOS series (ej. mayo vs abril) agrega "value2" a cada punto y "seriesLabels":["Mayo","Abril"].
- Máximo ~12 puntos. Nombres cortos. Valores crudos (sin $, sin comas, sin %).
- Pon la gráfica DESPUÉS de tu texto — nunca en lugar del texto. No la anuncies.
- NO la uses para un solo dato ni para preguntas conceptuales.
${navBlock}

══════════════════════════════════════════
BENCHMARKS DEL NEGOCIO DE GIMNASIOS
══════════════════════════════════════════
- Churn mensual de socios:        sano <5%   |  >8% = alerta
- Tasa de renovación mensual:     ideal >80%
- Frecuencia de asistencia:       sano 8-12 visitas/socio activo al mes (≈2-3/semana)
- Socios que NO asisten en 14 días: riesgo de baja → candidatos a recuperación
- Mix de ingreso:                 membresías deben ser el grueso; productos complementan
- Comisión de tarjeta:            típica 2-4% — vigila su peso sobre la venta
- Estacionalidad:                 enero (propósitos) y septiembre suelen ser picos de alta

REGLAS ADICIONALES:
- Responde SIEMPRE en español.
- Formatea montos como moneda MXN ($12,345.00).
- NUNCA expongas nombres técnicos de tablas/columnas al usuario.
- NUNCA digas "no tengo acceso a datos" sin antes intentar al menos una query.
- Si hay sucursal activa (ver CONTEXTO), filtra SIEMPRE por su IdSucursal salvo que pidan "todas".
- Para VENTAS usa SIEMPRE tblMovimientos (FechaMovimiento, tblDetalleMovimientos, tblMovimientosPagos).
- Para CLIENTES consulta siempre la tabla tblSocios. El contacto prioritario de un socio es siempre su teléfono en la columna 'OtroTelefono' (vale más y es más importante que su correo). Al consultar o listar socios, especialmente los que vencen o vencidos, incluye SIEMPRE la columna 'OtroTelefono' en tu SELECT. Si pide consulta de Hombres/Mujeres, debes consultar el campo 'Sexo' en 'tblSocios', donde: 0 o 1 = Hombre, y 2 = Mujer.
- Para ASISTENCIAS de empleados usa la tabla tblAsistencias. Para visitas de socios usa tblVisitas. Al preguntar por la asistencia de una persona por su nombre (ej. "asistencia de Juan"), primero búscala en 'tblSocios' y si existe consulta en 'tblVisitas' usando 'IdSocio'; si no existe en 'tblSocios', búscala en 'tblUsuarios' y si existe ahí, consulta 'tblAsistencias' usando 'IdUsuario'.
- Para PRODUCTOS usa tblCuotas (IdCuota es IdProducto, Cuota es Producto).
- Para RUTINAS Y PLANES DE ENTRENAMIENTO: Si preguntan por su rutina registrada (ej: "dame mi rutina de Juan Perez", "ver mi plan"):
  1. Busca primero en 'tblPlanesEntrenamiento' por 'Socio' o 'CodigoSocio'.
  2. Si NO existe el registro en 'tblPlanesEntrenamiento', ¡debes CREARLO usando la herramienta 'create_training_plan'! Primero busca al socio y sus datos básicos (nombre, código, sexo, edad) en 'tblSocios' para pasárselos a la herramienta.
  3. Una vez creado el plan (o si ya existía):
     - Si tiene 'PlanEntrenamiento' con contenido, preséntale un resumen claro y proporciónale dos enlaces:
       * Para edición/staff: [Ver, Editar e Imprimir mi Plan de Entrenamiento](${trainingPlanBaseUrl}&planUuid=[UUID]) (con el UUID real).
       * Para compartir con el socio (solo lectura): [Compartir rutina con el Socio](${trainingPlanBaseUrl.replace('/training-plan', '/training-plan/share')}&planUuid=[UUID]).
     - Si está vacío, dile de forma entusiasta que tiene su perfil listo para generar su rutina y dale el enlace para que lo genere con un solo clic: [Ver, Editar e Imprimir mi Plan de Entrenamiento](${trainingPlanBaseUrl}&planUuid=[UUID]).
     - Proporciona SIEMPRE un bloque de navegación \`\`\`nav al final de tu respuesta con dos botones de acción: uno para editar y otro para compartir con el socio (ej. {"items":[{"label":"Ver y Editar Plan","path":"/training-plan?projectUuid=${projectUuid}&planUuid=[UUID]","reason":"Ver o Editar"},{"label":"Compartir con Socio","path":"/training-plan/share?projectUuid=${projectUuid}&planUuid=[UUID]","reason":"Solo lectura"}]}).
  4. Si piden diseñar una rutina directamente en el chat, asume el rol de un Entrenador Personal de Élite y genérala con estructura completa.
- Si ves muchos socios por vencer o asistencia cayendo, menciónalo con el dato y una acción.
- Al comparar meses, SIEMPRE menciona los nombres (ej. "Mayo vs Abril").`;

    // ── Bloque VOLÁTIL (no cacheable) ──────────────────────────────────────────
    const volatile = `${greeting}.

${periodBlock}

CONTEXTO ACTIVO: ${ctxExtra}`;

    return [
        { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: volatile },
    ];
}

// ─── Fallback de modelo ─────────────────────────────────────────────────────
const MODEL_FALLBACKS: Record<string, string[]> = {
    'claude-opus-4-8':           ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    'claude-sonnet-4-6':         ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    'claude-haiku-4-5-20251001': ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
};

function shouldFallback(err: any): boolean {
    const status = err?.status;
    const msg = String(err?.message || '').toLowerCase();
    if ([429, 500, 502, 503, 529].includes(status)) return true;
    return ['overloaded', 'credit', 'rate limit', 'billing'].some(s => msg.includes(s));
}

async function createMessageWithFallback(
    anthropic: Anthropic,
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
    primaryModel: string,
): Promise<{ response: Anthropic.Message; modelUsed: string }> {
    const chain = MODEL_FALLBACKS[primaryModel] || [primaryModel];
    let lastErr: any;
    for (let i = 0; i < chain.length; i++) {
        try {
            const response = await anthropic.messages.create({ ...params, model: chain[i] });
            return { response, modelUsed: chain[i] };
        } catch (err) {
            lastErr = err;
            if (i < chain.length - 1 && shouldFallback(err)) {
                console.warn(`[ai/chat] modelo ${chain[i]} falló (${(err as any)?.status ?? ''}); probando ${chain[i + 1]}`);
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

// Resuelve el proyecto (gimnasio) de la sesión, o por projectId/projectUuid del body
// (para el acceso al dashboard sin login). Devuelve el contexto base del gimnasio.
async function resolveProject(body: any): Promise<{ projectId: number; gymName: string; branchId: any; branchName: string; version: string; projectUuid: string } | null> {
    // 1) Sesión autenticada (cookie httpOnly) — fuente principal.
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (sessionCookie?.value) {
            const s = JSON.parse(sessionCookie.value);
            if (s?.projectId) {
                const projRows = await globalQuery('SELECT UUID FROM tblProyectos WHERE IdProyecto = ?', [Number(s.projectId)]) as any[];
                const projectUuid = projRows[0]?.UUID || '';
                return {
                    projectId: Number(s.projectId),
                    gymName: s.gymName || '',
                    branchId: s.branchId ?? '',
                    branchName: s.branchName || '',
                    version: String(s.version ?? ''),
                    projectUuid,
                };
            }
        }
    } catch { /* sin sesión válida */ }

    // 2) Acceso sin login por UUID o projectId explícito en el body.
    if (body?.projectUuid) {
        try {
            const p = await getProjectByUUID(String(body.projectUuid));
            return { projectId: p.IdProyecto, gymName: p.Proyecto || '', branchId: body?.context?.branchId ?? '', branchName: '', version: '', projectUuid: String(body.projectUuid) };
        } catch { /* no encontrado */ }
    }
    if (body?.projectId) {
        try {
            const projRows = await globalQuery('SELECT UUID, Proyecto FROM tblProyectos WHERE IdProyecto = ?', [Number(body.projectId)]) as any[];
            const projectUuid = projRows[0]?.UUID || '';
            const gymName = projRows[0]?.Proyecto || '';
            return { projectId: Number(body.projectId), gymName, branchId: body?.context?.branchId ?? '', branchName: '', version: '', projectUuid };
        } catch { /* no encontrado */ }
    }
    return null;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, model, context } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages requerido' }, { status: 400 });
        }

        const project = await resolveProject(body);
        if (!project) {
            return NextResponse.json({
                content: 'No se detectó un gimnasio activo. Inicia sesión para que pueda consultar tus datos.',
                modelUsed: 'none',
            });
        }

        const resolvedModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-6';
        const anthropic     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Pool compartido del proyecto (NO se cierra: lo gestiona projectDb).
        const pool = await getProjectConnectionPool(project.projectId);

        // Catálogo dinámico del gimnasio: dimensiones reales + fuente de ventas activa.
        let projectCatalog = '';
        try {
            projectCatalog = await buildProjectCatalog(pool, String(project.projectId));
        } catch (e) {
            console.error('No se pudo construir el catálogo del proyecto:', e);
        }

                const proto = req.headers.get('x-forwarded-proto') || 'https';
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
        const baseUrl = host ? `${proto}://${host}` : '';

        const mergedContext = {
            ...(context || {}),
            branchId:   context?.branchId   ?? project.branchId,
            branchName: context?.branchName ?? project.branchName,
            gymName:    context?.gymName    ?? project.gymName,
            version:    context?.version    ?? project.version,
            projectUuid: project.projectUuid,
            baseUrl,
        };
        const systemPrompt = buildSystemPrompt(mergedContext, projectCatalog);
        const executedSql: string[] = [];

        const conversationMessages: { role: 'user' | 'assistant'; content: any }[] = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));

        // ── BRANCH STREAMING (SSE) ────────────────────────────────────────────
        const useStreaming = new URL(req.url).searchParams.get('stream') === 'true';
        if (useStreaming) {
            const stream = createSseStream(async (emit) => {
                let turns       = 0;
                let finalText   = '';
                let activeModel = resolvedModel;
                emit({ type: 'status', phase: 'thinking' });

                while (turns < MAX_TURNS) {
                    turns++;
                    const msgStream = anthropic.messages.stream({
                        model:       activeModel,
                        max_tokens:  8192,
                        system:      systemPrompt,
                        tools:       AGENT_TOOLS,
                        tool_choice: { type: 'auto' },
                        messages:    conversationMessages,
                    });

                    let turnText  = '';
                    let sawTool   = false;
                    let resetSent = false;
                    for await (const ev of msgStream) {
                        if (ev.type === 'content_block_start' && (ev as any).content_block?.type === 'tool_use') {
                            sawTool = true;
                            if (turnText && !resetSent) { emit({ type: 'reset' }); resetSent = true; turnText = ''; }
                        } else if (ev.type === 'content_block_delta' && (ev as any).delta?.type === 'text_delta') {
                            if (!sawTool) {
                                const t = (ev as any).delta.text as string;
                                turnText += t;
                                emit({ type: 'text', delta: t });
                            }
                        }
                    }

                    const finalMessage = await msgStream.finalMessage();

                    if (finalMessage.stop_reason !== 'tool_use') {
                        const tb = finalMessage.content.find((c: any) => c.type === 'text') as any;
                        finalText = turnText || tb?.text || '';
                        break;
                    }

                    const clar = finalMessage.content.find(
                        (c: any) => c.type === 'tool_use' && c.name === 'ask_clarification'
                    ) as any;
                    if (clar) {
                        emit({
                            type: 'clarification',
                            question:    clar.input?.question || '¿Qué período te gustaría analizar?',
                            suggestions: clar.input?.suggestions || [],
                        });
                        emit({ type: 'done', modelUsed: activeModel, executedSql: executedSql.join(';\n') });
                        return;
                    }

                    emit({ type: 'status', phase: 'querying' });
                    conversationMessages.push({ role: 'assistant', content: finalMessage.content });
                    const toolResults = await runToolBlocks(pool, finalMessage.content, executedSql);
                    conversationMessages.push({ role: 'user', content: toolResults });
                    emit({ type: 'status', phase: 'analyzing' });
                }

                emit({ type: 'done', content: finalText, modelUsed: activeModel, executedSql: executedSql.join(';\n') });
            });
            return new Response(stream, { headers: SSE_HEADERS });
        }

        // ── BRANCH NO-STREAMING (JSON, back-compat) ───────────────────────────
        let turns       = 0;
        let finalText   = '';
        let activeModel = resolvedModel;

        while (turns < MAX_TURNS) {
            turns++;

            const { response: resp, modelUsed } = await createMessageWithFallback(anthropic, {
                max_tokens: 8192,
                system:     systemPrompt,
                tools:      AGENT_TOOLS,
                tool_choice: { type: 'auto' },
                messages:   conversationMessages,
            }, activeModel);
            activeModel = modelUsed;

            const textBlock = resp.content.find((c: any) => c.type === 'text');
            if (textBlock?.type === 'text') finalText = textBlock.text;

            if (resp.stop_reason !== 'tool_use') break;

            const clarificationBlock = resp.content.find(
                (c: any) => c.type === 'tool_use' && c.name === 'ask_clarification'
            );
            if (clarificationBlock?.type === 'tool_use') {
                const input = clarificationBlock.input as any;
                return NextResponse.json({
                    clarification: {
                        question:    input.question    || '¿Qué período te gustaría analizar?',
                        suggestions: input.suggestions || [],
                    },
                    modelUsed: activeModel,
                    executedSql: executedSql.join(';\n'),
                });
            }

            conversationMessages.push({ role: 'assistant', content: resp.content });
            const toolResults = await runToolBlocks(pool, resp.content, executedSql);
            conversationMessages.push({ role: 'user', content: toolResults });
        }

        return NextResponse.json({
            content:    finalText,
            modelUsed:  activeModel,
            executedSql: executedSql.join(';\n'),
        });

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({ error: 'Error en la IA', details: error.message }, { status: 500 });
    }
}
