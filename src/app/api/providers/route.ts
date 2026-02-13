
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { cookies } from 'next/headers';

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

export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Auto-create table if not exists (Lazy migration)
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS \`${project.dbName}\`.tblProveedores (
                IdProveedor INT AUTO_INCREMENT PRIMARY KEY,
                Proveedor VARCHAR(255) NOT NULL,
                RFC VARCHAR(20),
                Contacto VARCHAR(255),
                Direccion1 VARCHAR(255),
                Direccion2 VARCHAR(255),
                Pais VARCHAR(100),
                Estado VARCHAR(100),
                Localidad VARCHAR(100),
                CodigoPostal VARCHAR(20),
                Telefono VARCHAR(50),
                CorreoElectronico VARCHAR(255),
                Status INT DEFAULT 0,
                FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await execute(createTableSql);

        const providers = await query(
            `SELECT * FROM \`${project.dbName}\`.tblProveedores 
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

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblProveedores 
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

        await query(
            `UPDATE \`${project.dbName}\`.tblProveedores SET 
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

        await query(
            `UPDATE \`${project.dbName}\`.tblProveedores SET Status = 2, FechaAct = NOW() WHERE IdProveedor = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Provider error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
