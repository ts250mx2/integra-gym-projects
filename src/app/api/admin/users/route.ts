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

        const users = await query('SELECT IdUsuario, Usuario, CorreoElectronico, Telefono, Status, EsAdmin, ProyectoIntegrados FROM tblUsuarios WHERE Status = 0 ORDER BY Usuario ASC', []);
        return NextResponse.json(users);
    } catch (error: any) {
        console.error('Users GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { Usuario, CorreoElectronico, Telefono, passwd, EsAdmin, ProyectoIntegrados } = body;

        if (!Usuario || !CorreoElectronico || !passwd) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        // Since we are dealing with admin users, hardcode EsAdmin if not provided
        const adminLevel = EsAdmin ?? 1;
        const projectIntegrated = ProyectoIntegrados ? 1 : 0;
        const currentDatetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const insertQuery = `
            INSERT INTO tblUsuarios (Usuario, CorreoElectronico, Telefono, passwd, Status, EsAdmin, ProyectoIntegrados, FechaAct) 
            VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `;
        const result: any = await query(insertQuery, [Usuario, CorreoElectronico, Telefono || '', passwd, adminLevel, projectIntegrated, currentDatetime]);

        return NextResponse.json({ success: true, insertId: result.insertId });
    } catch (error: any) {
        console.error('Users POST API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdUsuario, Usuario, CorreoElectronico, Telefono, passwd, EsAdmin, ProyectoIntegrados } = body;

        if (!IdUsuario || !Usuario || !CorreoElectronico) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        let updateQuery = '';
        let params: any[] = [];
        const projectIntegrated = ProyectoIntegrados ? 1 : 0;

        if (passwd) {
            // Update with password
            updateQuery = `
                UPDATE tblUsuarios 
                SET Usuario = ?, CorreoElectronico = ?, Telefono = ?, passwd = ?, EsAdmin = ?, ProyectoIntegrados = ?
                WHERE IdUsuario = ?
            `;
            params = [Usuario, CorreoElectronico, Telefono || '', passwd, EsAdmin ?? 1, projectIntegrated, IdUsuario];
        } else {
            // Update without password
            updateQuery = `
                UPDATE tblUsuarios 
                SET Usuario = ?, CorreoElectronico = ?, Telefono = ?, EsAdmin = ?, ProyectoIntegrados = ?
                WHERE IdUsuario = ?
            `;
            params = [Usuario, CorreoElectronico, Telefono || '', EsAdmin ?? 1, projectIntegrated, IdUsuario];
        }

        await query(updateQuery, params);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Users PUT API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const IdUsuario = searchParams.get('id');

        if (!IdUsuario) {
            return NextResponse.json({ error: 'missingId' }, { status: 400 });
        }

        // Soft delete
        const deleteQuery = `
            UPDATE tblUsuarios 
            SET Status = 1
            WHERE IdUsuario = ?
        `;
        await query(deleteQuery, [IdUsuario]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Users DELETE API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
