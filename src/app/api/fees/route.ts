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

// GET: Fetch fees with Group Name
export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Filter for TipoCuota < 2
        // Join with tblGruposHorarios to get the name
        const fees = await query(
            `SELECT c.*, g.GrupoHorario
             FROM \`${project.dbName}\`.tblCuotas c
             LEFT JOIN \`${project.dbName}\`.tblGruposHorarios g ON c.IdGrupoHorario = g.IdGrupoHorario
             WHERE c.Status != 2 AND c.TipoCuota < 2 
             ORDER BY c.Cuota ASC`
        ) as any[];

        return NextResponse.json(fees);
    } catch (error: any) {
        console.error('GET Fees error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            Cuota,
            Descripcion = '',
            Precio = 0,
            IVA,
            IdMoneda = 1,
            // New fields
            Codigo, // Maps to CodigoBarras
            Sesiones,
            IdGrupoHorario, // Replaces HoraEntrada/Salida
            Multisucursal,
            TipoMembresia,
            Vigencia,
            TipoVigencia
        } = body;

        const safeIVA = IVA || 0;
        const safeIdGrupoHorario = IdGrupoHorario || 0;
        const safeMultisucursal = Multisucursal ? 1 : 0;
        const safeSesiones = Sesiones ? parseInt(Sesiones) : 0;
        const safeVigencia = Vigencia ? parseInt(Vigencia) : 0;
        const safeTipoVigencia = TipoVigencia ? parseInt(TipoVigencia) : 0;

        // Fixed values as per requirement
        const fixedTipoCuota = 1;

        await query(
            `INSERT INTO \`${project.dbName}\`.tblCuotas 
            (Cuota, Descripcion, Precio, IVA, TipoCuota, Status, FechaAct,
             CodigoBarras, Sesiones, IdGrupoHorario, Multisucursal, TipoMembresia, Vigencia, TipoVigencia) 
            VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [
                Cuota, Descripcion, Precio, safeIVA, fixedTipoCuota,
                Codigo || null, safeSesiones, safeIdGrupoHorario, safeMultisucursal, TipoMembresia,
                safeVigencia, safeTipoVigencia
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('POST Fee error:', error);
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
            Cuota,
            Descripcion = '',
            Precio,
            IVA,
            IdMoneda,
            // New fields
            Codigo,
            Sesiones,
            IdGrupoHorario,
            Multisucursal,
            TipoMembresia,
            Vigencia,
            TipoVigencia
        } = body;

        const safeIVA = IVA || 0;
        const safeIdGrupoHorario = IdGrupoHorario || 0;
        const safeMultisucursal = Multisucursal ? 1 : 0;
        const safeSesiones = Sesiones ? parseInt(Sesiones) : 0;
        const safeVigencia = Vigencia ? parseInt(Vigencia) : 0;
        const safeTipoVigencia = TipoVigencia ? parseInt(TipoVigencia) : 0;

        // Fixed values as per requirement
        const fixedTipoCuota = 1;

        await query(
            `UPDATE \`${project.dbName}\`.tblCuotas 
            SET Cuota = ?, Descripcion = ?, Precio = ?, IVA = ?, TipoCuota = ?, FechaAct = NOW(),
                CodigoBarras = ?, Sesiones = ?, IdGrupoHorario = ?, Multisucursal = ?, TipoMembresia = ?,
                Vigencia = ?, TipoVigencia = ?
            WHERE IdCuota = ?`,
            [
                Cuota, Descripcion, Precio, safeIVA, fixedTipoCuota,
                Codigo || null, safeSesiones, safeIdGrupoHorario, safeMultisucursal, TipoMembresia,
                safeVigencia, safeTipoVigencia,
                IdCuota
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Fee error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await query(
            `UPDATE \`${project.dbName}\`.tblCuotas SET Status = 2, FechaAct = NOW() WHERE IdCuota = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Fee error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
