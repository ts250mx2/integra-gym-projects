import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId, isAdmin } = JSON.parse(sessionCookie.value);

        let projects;
        if (isAdmin === 2) {
            // Super Admin sees all active projects
            projects = await query(
                `SELECT IdProyecto, Proyecto, Version 
                 FROM tblProyectos 
                 WHERE Status = 0`,
                []
            ) as any[];
        } else {
            // Standard User sees only assigned projects
            projects = await query(
                `SELECT p.IdProyecto, p.Proyecto, p.Version 
                 FROM tblProyectos p
                 JOIN tblProyectosUsuarios pu ON p.IdProyecto = pu.IdProyecto
                 WHERE pu.IdUsuario = ? AND p.Status = 0`,
                [userId]
            ) as any[];
        }

        return NextResponse.json(projects);
    } catch (error: any) {
        console.error('Error fetching user projects:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
