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
        const IdUsuario = searchParams.get('userId');

        if (!IdUsuario) {
            return NextResponse.json({ error: 'missingId' }, { status: 400 });
        }

        const relations = await query('SELECT IdProyecto FROM tblProyectosUsuarios WHERE IdUsuario = ? AND Status = 0', [IdUsuario]);
        return NextResponse.json(relations);
    } catch (error: any) {
        console.error('User Projects GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdUsuario, projectIds } = body;

        if (!IdUsuario || !Array.isArray(projectIds)) {
            return NextResponse.json({ error: 'invalidPayload' }, { status: 400 });
        }

        const currentDatetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Safest approach: delete all current active assignments for this user, then insert the new ones
        await query('DELETE FROM tblProyectosUsuarios WHERE IdUsuario = ?', [IdUsuario]);

        if (projectIds.length > 0) {
            const values = projectIds.map(id => `(${id}, ${IdUsuario}, '${currentDatetime}', 1, '${currentDatetime}', 1, 0)`).join(', ');
            const insertQuery = `
                INSERT INTO tblProyectosUsuarios 
                (IdProyecto, IdUsuario, FechaAct, CuentaActivada, FechaActivacion, CuentaActiva, Status)
                VALUES ${values}
            `;
            await query(insertQuery, []);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('User Projects POST API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
