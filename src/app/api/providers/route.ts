
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';
import { ensureInventorySchema } from '@/lib/inventory';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const { projectId } = JSON.parse(sessionCookie.value);

    const projectData = await query(
        'SELECT BaseDatos, Pais, UUID FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    if (projectData.length === 0) return null;
    return {
        projectId,
        dbName: projectData[0].BaseDatos,
        country: projectData[0].Pais,
        uuid: projectData[0].UUID
    };
}

/**
 * Los proveedores viven en la BD del gimnasio, que puede estar en otro servidor
 * que el pool principal. bypassVirtual = true mantiene la consulta en el
 * gimnasio activo aunque la sesion este en modo Proyectos Integrados.
 */
async function providerQuery(projectId: number, sql: string, params: any[] = []) {
    return await projectQuery(projectId, sql, params, undefined, true) as any;
}

export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Crea las tablas del modulo si la BD del gimnasio aun no las tiene.
        await ensureInventorySchema(project.projectId);

        const providers = await providerQuery(
            project.projectId,
            `SELECT * FROM tblProveedores
             WHERE Status != 2
             ORDER BY Proveedor ASC`
        ) as any[];

        return NextResponse.json(providers);
    } catch (error: any) {
        console.error('GET Providers error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            Proveedor, RFC, Contacto,
            Direccion1, Direccion2, Pais, Estado, Localidad, CodigoPostal,
            Telefono, CorreoElectronico
        } = body;

        await ensureInventorySchema(project.projectId);

        const result = await providerQuery(
            project.projectId,
            `INSERT INTO tblProveedores
            (Proveedor, RFC, Contacto, Direccion1, Direccion2, Pais, Estado, Localidad, CodigoPostal, Telefono, CorreoElectronico, Status, FechaAct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
                Proveedor, RFC || null, Contacto || null,
                Direccion1 || null, Direccion2 || null, Pais || null, Estado || null, Localidad || null, CodigoPostal || null,
                Telefono || null, CorreoElectronico || null
            ]
        );

        const insertId = (result as any).insertId;
        return NextResponse.json({ success: true, id: insertId });
    } catch (error: any) {
        console.error('POST Provider error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            IdProveedor,
            Proveedor, RFC, Contacto,
            Direccion1, Direccion2, Pais, Estado, Localidad, CodigoPostal,
            Telefono, CorreoElectronico
        } = body;

        await providerQuery(
            project.projectId,
            `UPDATE tblProveedores SET
             Proveedor = ?, RFC = ?, Contacto = ?,
             Direccion1 = ?, Direccion2 = ?, Pais = ?, Estado = ?, Localidad = ?, CodigoPostal = ?,
             Telefono = ?, CorreoElectronico = ?,
             FechaAct = NOW()
             WHERE IdProveedor = ?`,
            [
                Proveedor, RFC || null, Contacto || null,
                Direccion1 || null, Direccion2 || null, Pais || null, Estado || null, Localidad || null, CodigoPostal || null,
                Telefono || null, CorreoElectronico || null,
                IdProveedor
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Provider error:', error);
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

        await providerQuery(
            project.projectId,
            'UPDATE tblProveedores SET Status = 2, FechaAct = NOW() WHERE IdProveedor = ?',
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Provider error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
