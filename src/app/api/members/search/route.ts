import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const { projectId } = JSON.parse(sessionCookie.value);

    const projectData = await query(
        'SELECT BaseDatos, UUID FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    if (projectData.length === 0) return null;
    return {
        dbName: projectData[0].BaseDatos,
        uuid: projectData[0].UUID
    };
}

export async function GET(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const searchParams = req.nextUrl.searchParams;
        const q = searchParams.get('q') || '';
        if (!q) return NextResponse.json([]);

        // Search by Code or Name (Socio)
        // Status = 0 (Active)
        const members = await query(
            `SELECT IdSocio, Socio AS Nombre, CodigoSocio, FotoActiva, ArchivoFoto, FechaVencimiento
             FROM \`${project.dbName}\`.tblSocios 
             WHERE Status = 0 
             AND (Socio LIKE ? OR CodigoSocio LIKE ?)
             LIMIT 10`,
            [`%${q}%`, `%${q}%`]
        ) as any[];

        const membersWithUuid = members.map(m => ({ ...m, UUID: project.uuid }));

        return NextResponse.json(membersWithUuid);

    } catch (error: any) {
        console.error('Search Members error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
