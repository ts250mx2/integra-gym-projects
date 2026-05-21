import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { syncDatabaseSchema } from '@/lib/schema-sync';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectUuid = searchParams.get('projectUuid');
        const returnTo = searchParams.get('returnTo') || '/es/dashboard-v1';

        if (!projectUuid) {
            return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
        }

        const projects = await query(
            'SELECT IdProyecto, Proyecto, BaseDatos, Version, UUID FROM tblProyectos WHERE UUID = ?',
            [projectUuid]
        ) as any[];

        if (projects.length === 0) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = projects[0];

        if (project.BaseDatos && project.Version !== '1.0') {
            try {
                await syncDatabaseSchema(project.BaseDatos);
            } catch (e) {
                console.warn('[project-session] schema sync failed:', e);
            }
        }

        const sessionData = {
            userId: 0,
            userName: 'Visor',
            projectId: project.IdProyecto,
            gymName: project.Proyecto,
            branchId: 0,
            branchName: 'General',
            positionId: 0,
            position: 'Acceso por UUID',
            isAdmin: 2,
            version: project.Version || '1.0',
            projectUuid: project.UUID,
            publicAccess: true
        };

        const safeReturn = returnTo.startsWith('/') ? returnTo : '/es/dashboard-v1';
        const redirectUrl = new URL(safeReturn, req.url);
        const response = NextResponse.redirect(redirectUrl);

        response.cookies.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return response;
    } catch (error: any) {
        console.error('[project-session] error:', error);
        return NextResponse.json({ error: 'serverError' }, { status: 500 });
    }
}
