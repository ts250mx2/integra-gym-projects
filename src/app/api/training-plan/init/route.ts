import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID, projectQuery } from '@/lib/projectDb';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get('projectUuid');
    const planUuid = searchParams.get('planUuid');

    if (!projectUuid || !planUuid) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        // 1. Get project metadata
        const project = await getProjectByUUID(projectUuid);

        // 2. Query the project database for the training plan record
        const planData = await projectQuery(
            project.IdProyecto,
            'SELECT Socio, CodigoSocio, Genero, Edad, Peso, Estatura, Dias, Minutos, Observaciones FROM tblPlanesEntrenamiento WHERE UUID = ?',
            [planUuid],
            project
        ) as any[];

        if (planData.length === 0) {
            return NextResponse.json({ error: 'Training plan not found' }, { status: 404 });
        }

        return NextResponse.json(planData[0]);
    } catch (error: any) {
        console.error('Error in training-plan/init:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
