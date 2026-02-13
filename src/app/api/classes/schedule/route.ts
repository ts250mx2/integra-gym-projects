import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const project = JSON.parse(sessionCookie.value);

    // Fetch full project details to get DB info if not fully in session
    const projectData = await query(
        'SELECT BaseDatos, DominioIM, Pais, UUID FROM tblProyectos WHERE IdProyecto = ?',
        [project.projectId]
    ) as any[];

    if (projectData.length === 0) return null;

    return {
        projectId: project.projectId,
        dbName: projectData[0].BaseDatos
    };
}

export async function GET(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const classId = searchParams.get('classId');

        if (!classId) return NextResponse.json({ error: 'Missing classId' }, { status: 400 });

        const schedules = await query(
            `SELECT * FROM \`${project.dbName}\`.tblClasesDias 
             WHERE IdClase = ? 
             ORDER BY Dia, HoraInicio`,
            [classId]
        );

        return NextResponse.json(schedules);
    } catch (error: any) {
        console.error('GET Schedules error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdClase, Dia, HoraInicio, HoraFin } = body;

        if (!IdClase || !Dia || !HoraInicio || !HoraFin) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblClasesDias 
             (IdClase, Dia, HoraInicio, HoraFin, FechaAct) 
             VALUES (?, ?, ?, ?, NOW())`,
            [IdClase, Dia, HoraInicio, HoraFin]
        );

        return NextResponse.json({ success: true, id: (result as any).insertId });
    } catch (error: any) {
        console.error('POST Schedule error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await query(
            `DELETE FROM \`${project.dbName}\`.tblClasesDias WHERE IdClaseDia = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Schedule error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
