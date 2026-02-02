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

        const products = await query(
            `SELECT * FROM \`${project.dbName}\`.tblCuotas WHERE Status = 0 AND TipoCuota = 2 ORDER BY Cuota ASC`
        ) as any[];

        return NextResponse.json(products);
    } catch (error: any) {
        console.error('GET Products error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            CodigoBarras = null,
            Cuota = null, // Changed from Producto
            Precio = 0,
            IVA
        } = body;

        const safeIVA = IVA || 0;

        await query(
            `INSERT INTO \`${project.dbName}\`.tblCuotas 
            (CodigoBarras, Cuota, Precio, IVA, TipoCuota, Status, FechaAct) 
            VALUES (?, ?, ?, ?, 2, 0, NOW())`,
            [CodigoBarras, Cuota, Precio, safeIVA]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('POST Product error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            IdCuota,
            CodigoBarras = null,
            Cuota = null, // Changed from Producto
            Precio = 0,
            IVA
        } = body;

        const safeIVA = IVA || 0;

        await query(
            `UPDATE \`${project.dbName}\`.tblCuotas SET 
             CodigoBarras = ?, Cuota = ?, Precio = ?, IVA = ?, FechaAct = NOW()
             WHERE IdCuota = ?`,
            [CodigoBarras, Cuota, Precio, safeIVA, IdCuota]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Product error:', error);
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
            `UPDATE \`${project.dbName}\`.tblCuotas SET Status = 2, FechaAct = NOW() WHERE IdCuota = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Product error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
