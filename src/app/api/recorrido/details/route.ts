import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uuidProject = searchParams.get('UUIDProject');

    if (!uuidProject) {
        return NextResponse.json({ error: 'Missing UUIDProject' }, { status: 400 });
    }

    try {
        const project = await getProjectByUUID(uuidProject);
        
        return NextResponse.json({
            title: project.Titulo || project.Proyecto,
            logo: project.ArchivoLogo,
            id: project.IdProyecto
        });

    } catch (error: any) {
        console.error('API Error (recorrido/details):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
