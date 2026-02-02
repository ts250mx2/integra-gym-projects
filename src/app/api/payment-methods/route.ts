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

    if (projectData.length === 0) return null;
    return {
        projectId,
        dbName: projectData[0].BaseDatos
    };
}

export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const methods = await query(
            `SELECT * FROM \`${project.dbName}\`.tblFormasPago WHERE Status = 0 ORDER BY FormaPago ASC`
        );

        return NextResponse.json(methods);
    } catch (error: any) {
        console.error('GET Payment Methods error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { FormaPago, Comision } = body;

        if (!FormaPago) {
            return NextResponse.json({ error: 'FormaPago is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblFormasPago (FormaPago, Comision, Status, FechaAct) VALUES (?, ?, 0, NOW())`,
            [FormaPago, Comision || 0]
        );

        return NextResponse.json({ success: true, id: (result as any).insertId });
    } catch (error: any) {
        console.error('POST Payment Method error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdFormaPago, FormaPago, Comision } = body;

        if (!IdFormaPago || !FormaPago) {
            return NextResponse.json({ error: 'IdFormaPago and FormaPago are required' }, { status: 400 });
        }

        await query(
            `UPDATE \`${project.dbName}\`.tblFormasPago SET FormaPago = ?, Comision = ?, FechaAct = NOW() WHERE IdFormaPago = ?`,
            [FormaPago, Comision || 0, IdFormaPago]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Payment Method error:', error);
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
            `UPDATE \`${project.dbName}\`.tblFormasPago SET Status = 2, FechaAct = NOW() WHERE IdFormaPago = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Payment Method error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
