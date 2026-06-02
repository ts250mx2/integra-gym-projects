import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID, projectQuery } from '@/lib/projectDb';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectUuid, planUuid } = body;

        if (!projectUuid || !planUuid) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const project = await getProjectByUUID(projectUuid);

        // 1. Fetch data from DB to ensure we have the latest
        const planData = await projectQuery(
            project.IdProyecto,
            'SELECT Socio, CodigoSocio, Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones FROM tblPlanesEntrenamiento WHERE UUID = ?',
            [planUuid],
            project
        ) as any[];

        if (planData.length === 0) {
            return NextResponse.json({ error: 'Training plan not found' }, { status: 404 });
        }

        const { Socio, Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones } = planData[0];
        const genderText = Genero === 1 ? 'Hombre' : 'Mujer';

        // 2. Generate plan with OpenAI
        const prompt = `
        Genera un plan de entrenamiento personalizado para un socio de gimnasio con la siguiente información:
        - Nombre: ${Socio}
        - Género: ${genderText}
        - Edad: ${Edad} años
        - Peso: ${Peso} kg
        - Estatura: ${Estatura} mts
        - Días de entrenamiento a la semana: ${Dias}
        - Minutos de entrenamiento diario: ${Minutos}
        - Observaciones/Objetivos: ${Observaciones}

        El plan debe ser PROFESIONAL, motivador y MUY VISUAL (se renderiza en una página web).
        Estructura EXACTA:
        1. Una introducción breve y motivadora (1-2 frases).
        2. UNA SECCIÓN POR DÍA. Cada día empieza con un encabezado nivel 2 con emoji del grupo muscular,
           por ejemplo: "## 💪 Día 1 — Pecho y Tríceps".
           Debajo de cada día, una TABLA Markdown con EXACTAMENTE estas columnas:

           | Ejercicio | Series × Reps | Descanso | Video |
           |---|---|---|---|
           | **Press de banca** | 4 × 10 | 90 s | [▶ Ver](https://www.youtube.com/results?search_query=press+de+banca+tecnica+ejecucion) |
           | **Aperturas con mancuerna** | 3 × 12 | 60 s | [▶ Ver](https://www.youtube.com/results?search_query=aperturas+con+mancuerna+tecnica) |

           REGLA CRÍTICA DEL LINK: la columna Video SIEMPRE es [▶ Ver](URL). En la URL, reemplaza
           CADA espacio por el signo "+". NUNCA dejes espacios ni saltos dentro del enlace (rompería el clic).
        3. "## 🔥 Calentamiento" — lista breve (3-4 puntos).
        4. "## 🧘 Estiramiento" — lista breve (3-4 puntos).
        5. "## 💡 Consejos" — 3-5 tips basados en sus objetivos (${Observaciones || 'mejora general'}).

        FORMATO:
        - Markdown puro, empieza directo con el contenido (sin bloque de código, sin \`\`\`).
        - Cada día DEBE ir como tabla (no como lista de prosa). Nombres de ejercicio en **negritas**.
        - Todos los enlaces en formato [texto](url) y SIN espacios dentro de la url.
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Eres un entrenador personal experto y profesional de Integra Gym." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        const generatedPlan = completion.choices[0].message.content;

        // 3. Save to DB
        await projectQuery(
            project.IdProyecto,
            'UPDATE tblPlanesEntrenamiento SET PlanEntrenamiento = ?, FechaPlanEntrenamiento = NOW() WHERE UUID = ?',
            [generatedPlan, planUuid],
            project
        );

        return NextResponse.json({ plan: generatedPlan });
    } catch (error: any) {
        console.error('Error in training-plan/generate:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
