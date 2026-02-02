import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const { projectId } = JSON.parse(sessionCookie.value);

    const projectData = await query(
        'SELECT BaseDatos FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    return projectData.length > 0 ? projectData[0].BaseDatos : null;
}

export async function GET(req: NextRequest) {
    try {
        const dbName = await getProjectDB();
        if (!dbName) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const positions = await query(`
            SELECT IdPuesto, Puesto, EsAdministrador 
            FROM \`${dbName}\`.tblPuestos 
            WHERE Status = 0
            ORDER BY Puesto ASC
        `);
        return NextResponse.json(positions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const dbName = await getProjectDB();
        if (!dbName) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { name, isAdmin } = await req.json();

        await query(
            `INSERT INTO \`${dbName}\`.tblPuestos (Puesto, EsAdministrador, Status, FechaAct) 
             VALUES (?, ?, 0, NOW())`,
            [name, isAdmin ? 1 : 0]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const dbName = await getProjectDB();
        if (!dbName) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id, name, isAdmin } = await req.json();

        await query(
            `UPDATE \`${dbName}\`.tblPuestos 
             SET Puesto = ?, EsAdministrador = ?, FechaAct = NOW() 
             WHERE IdPuesto = ?`,
            [name, isAdmin ? 1 : 0, id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const dbName = await getProjectDB();
        if (!dbName) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        await query(
            `UPDATE \`${dbName}\`.tblPuestos 
             SET Status = 2, FechaAct = NOW() 
             WHERE IdPuesto = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
