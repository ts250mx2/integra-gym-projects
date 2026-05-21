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
        const version = project.Version || '1.0';

        if (project.BaseDatos && version !== '1.0') {
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
            version: version,
            projectUuid: project.UUID,
            publicAccess: true
        };

        // Determine correct return target based on project version
        let targetPath = returnTo;
        if (version === '1.0') {
            // Force dashboard-v1 if it currently tries to go to standard dashboard
            if (!targetPath.includes('/dashboard-v1')) {
                targetPath = targetPath.replace(/\/dashboard(\/|$)/, '/dashboard-v1$1');
            }
        } else {
            // Force standard dashboard if it currently tries to go to dashboard-v1
            if (targetPath.includes('/dashboard-v1')) {
                targetPath = targetPath.replace(/\/dashboard-v1(\/|$)/, '/dashboard$1');
            }
        }

        const safeReturn = targetPath.startsWith('/') ? targetPath : (version === '1.0' ? '/es/dashboard-v1' : '/es/dashboard');
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
