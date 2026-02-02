import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const projectId = session.projectId;

        if (!projectId) {
            return NextResponse.json({ error: 'noProjectId' }, { status: 400 });
        }

        const projectData = await query(
            `SELECT Pais, Estado, Localidad, CodigoPostal, Direccion1, Direccion2, Telefono, CorreoElectronico 
             FROM tblProyectos 
             WHERE IdProyecto = ?`,
            [projectId]
        ) as any[];

        if (projectData.length === 0) {
            return NextResponse.json({ error: 'projectNotFound' }, { status: 404 });
        }

        const project = projectData[0];

        return NextResponse.json({
            country: project.Pais || 'MX',
            state: project.Estado || '',
            city: project.Localidad || '',
            zipCode: project.CodigoPostal || '',
            address1: project.Direccion1 || '',
            address2: project.Direccion2 || '',
            phone: project.Telefono || '',
            email: project.CorreoElectronico || ''
        });
    } catch (error: any) {
        console.error('Project defaults error:', error);
        return NextResponse.json({ error: 'serverError' }, { status: 500 });
    }
}
