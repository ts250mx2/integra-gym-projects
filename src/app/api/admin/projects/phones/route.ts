import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);

    // EsAdministrador 1 or 2 are admin
    if (session.isAdmin === 1 || session.isAdmin === 2) {
        return session;
    }
    return false;
}

export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const idProyecto = searchParams.get('idProyecto');
        const phone = searchParams.get('phone');

        // Case 1: Search phone globally (Lookup)
        if (phone) {
            const results = await query(
                'SELECT Nombre FROM tblProyectosTelefonos WHERE Telefono = ? AND Nombre IS NOT NULL AND Nombre != "" LIMIT 1',
                [phone]
            ) as any[];

            if (results && results.length > 0) {
                return NextResponse.json({ found: true, Nombre: results[0].Nombre });
            }
            return NextResponse.json({ found: false });
        }

        // Case 2: List project phones
        if (!idProyecto) {
            return NextResponse.json({ error: 'missingIdProyecto' }, { status: 400 });
        }

        const phones = await query(
            'SELECT IdProyectoTelefono, IdProyecto, Telefono, Nombre, EsAdministrador FROM tblProyectosTelefonos WHERE IdProyecto = ? ORDER BY Nombre ASC',
            [idProyecto]
        );
        return NextResponse.json(phones);

    } catch (error: any) {
        console.error('Project Phones GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdProyecto, Telefono, Nombre, EsAdministrador, IdProyectoTelefono } = body;

        if (!IdProyecto || !Telefono || !Nombre) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        const isAdminVal = EsAdministrador ? 1 : 0;

        if (IdProyectoTelefono) {
            // Edit existing phone access
            const updateQuery = `
                UPDATE tblProyectosTelefonos 
                SET Telefono = ?, Nombre = ?, EsAdministrador = ?
                WHERE IdProyectoTelefono = ? AND IdProyecto = ?
            `;
            await query(updateQuery, [Telefono, Nombre, isAdminVal, IdProyectoTelefono, IdProyecto]);
            return NextResponse.json({ success: true, updated: true });
        } else {
            // Check if phone already has access to this project
            const existing = await query(
                'SELECT IdProyectoTelefono FROM tblProyectosTelefonos WHERE IdProyecto = ? AND Telefono = ?',
                [IdProyecto, Telefono]
            ) as any[];

            if (existing && existing.length > 0) {
                return NextResponse.json({ error: 'alreadyExists', message: 'Este teléfono ya tiene acceso a este proyecto.' }, { status: 400 });
            }

            // Add new phone access
            const insertQuery = `
                INSERT INTO tblProyectosTelefonos (IdProyecto, Telefono, Nombre, EsAdministrador) 
                VALUES (?, ?, ?, ?)
            `;
            const result: any = await query(insertQuery, [IdProyecto, Telefono, Nombre, isAdminVal]);
            return NextResponse.json({ success: true, insertId: result.insertId });
        }

    } catch (error: any) {
        console.error('Project Phones POST API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'missingId' }, { status: 400 });
        }

        const deleteQuery = `
            DELETE FROM tblProyectosTelefonos 
            WHERE IdProyectoTelefono = ?
        `;
        await query(deleteQuery, [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Project Phones DELETE API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
