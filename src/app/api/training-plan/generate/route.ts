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

        El plan debe ser detallado, profesional y motivador. 
        Incluye:
        1. Una introducción personalizada y motivadora.
        2. Distribución de ejercicios por día claramente estructurada.
        3. Para cada ejercicio, especifica series, repeticiones y una **Referencia Gráfica**.
           - La Referencia Gráfica debe ser un enlace directo a una imagen o video demostrativo (puedes usar enlaces de YouTube o Google Images) o una descripción técnica muy visual.
           - Si usas enlaces, asegúrate de que sean descriptivos. Ejemplo: [Ver ejecución del ejercicio](enlace).
        4. Recomendaciones de calentamiento y estiramiento.
        5. Consejos adicionales basados en las observaciones.

        Formato: Devuelve el contenido en **Markdown** bien estructurado. Usa negritas para los nombres de los ejercicios y listas para las repeticiones.
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
