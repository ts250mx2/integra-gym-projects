import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';
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

        // User requested: ID, Clave, Sucursal, Localidad, Estado, Telefono, Correo Electronico
        const branches = await query(`
            SELECT IdSucursal, Clave, Sucursal, Pais, Estado, Localidad, CodigoPostal, Direccion1, Direccion2, Telefono, CorreoElectronico 
            FROM \`${dbName}\`.tblSucursales 
            WHERE Status = 0
        `);
        return NextResponse.json(branches);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const dbName = await getProjectDB();
        if (!dbName) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            clave: rawClave, name, country, state, city, zipCode, address1, address2, phone, email
        } = body;
        const clave = rawClave?.toUpperCase();

        // Check uniqueness
        const existing = await query(
            `SELECT IdSucursal FROM \`${dbName}\`.tblSucursales WHERE Clave = ? AND Status = 0`,
            [clave]
        ) as any[];

        if (existing.length > 0) {
            return NextResponse.json({ error: 'claveExists' }, { status: 400 });
        }

        await query(
            `INSERT INTO \`${dbName}\`.tblSucursales 
            (Clave, Sucursal, Pais, Estado, Localidad, CodigoPostal, Direccion1, Direccion2, Telefono, CorreoElectronico, Status, FechaAct) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [clave, name, country, state, city, zipCode, address1, address2, phone, email]
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

        const body = await req.json();
        const {
            id, clave: rawClave, name, country, state, city, zipCode, address1, address2, phone, email
        } = body;
        const clave = rawClave?.toUpperCase();

        // Check uniqueness excluding current record
        const existing = await query(
            `SELECT IdSucursal FROM \`${dbName}\`.tblSucursales WHERE Clave = ? AND IdSucursal != ? AND Status = 0`,
            [clave, id]
        ) as any[];

        if (existing.length > 0) {
            return NextResponse.json({ error: 'claveExists' }, { status: 400 });
        }

        await query(
            `UPDATE \`${dbName}\`.tblSucursales 
             SET Clave = ?, Sucursal = ?, Pais = ?, Estado = ?, Localidad = ?, CodigoPostal = ?, 
                 Direccion1 = ?, Direccion2 = ?, Telefono = ?, CorreoElectronico = ?, 
                 FechaAct = NOW() 
             WHERE IdSucursal = ?`,
            [clave, name, country, state, city, zipCode, address1, address2, phone, email, id]
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

        if (id === '1') {
            return NextResponse.json({ error: 'cannotDeleteMainBranch' }, { status: 400 });
        }

        // User requested Status = 2 for deleted
        await query(
            `UPDATE \`${dbName}\`.tblSucursales SET Status = 2, FechaAct = NOW() WHERE IdSucursal = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
