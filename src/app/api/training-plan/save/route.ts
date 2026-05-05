import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID, projectQuery } from '@/lib/projectDb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            projectUuid, 
            planUuid, 
            Genero, 
            Edad, 
            Peso, 
            Estatura, 
            Dias, 
            Minutos, 
            Observaciones 
        } = body;

        if (!projectUuid || !planUuid) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const project = await getProjectByUUID(projectUuid);

        await projectQuery(
            project.IdProyecto,
            `UPDATE tblPlanesEntrenamiento 
             SET Genero = ?, Edad = ?, Peso = ?, Estatura = ?, Dias = ?, Minutos = ?, Observaciones = ? 
             WHERE UUID = ?`,
            [Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones, planUuid],
            project
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in training-plan/save:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
