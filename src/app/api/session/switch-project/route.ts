import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { syncDatabaseSchema } from '@/lib/schema-sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { projectId } = body;

        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) {
            console.error('[SwitchProject] No session cookie found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sessionData = JSON.parse(sessionCookie.value);
        const userId = sessionData.userId;
        const isAdmin = sessionData.isAdmin;

        console.log(`[SwitchProject] User ${userId} (isAdmin: ${isAdmin}) switching to project ${projectId}`);

        // 1. Verify user access (Admins can switch to anything)
        if (isAdmin !== 2) {
            const access = await query(
                'SELECT IdProyecto FROM tblProyectosUsuarios WHERE IdProyecto = ? AND IdUsuario = ?',
                [projectId, userId]
            ) as any[];

            if (access.length === 0) {
                console.error(`[SwitchProject] Forbidden: User ${userId} has no access to project ${projectId}`);
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // 2. Fetch new project details
        const projects = await query(
            'SELECT IdProyecto, Proyecto, BaseDatos, Version FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        ) as any[];

        if (projects.length === 0) {
            console.error(`[SwitchProject] Project ${projectId} not found`);
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = projects[0];

        // 3. Reconstruct fresh session data based on the new project
        // We keep the identity of the user but update the project context
        const newSessionData = {
            userId: sessionData.userId,
            userName: sessionData.userName,
            projectId: project.IdProyecto,
            gymName: project.Proyecto,
            branchId: 0,
            branchName: project.Version === '1.0' ? 'General' : 'Default',
            positionId: sessionData.positionId || 0,
            position: sessionData.position || 'Usuario',
            isAdmin: sessionData.isAdmin,
            version: project.Version || '1.0',
            proyectoIntegrados: sessionData.proyectoIntegrados || 0
        };

        // If V2, sync schema
        if (project.Version !== '1.0' && project.BaseDatos) {
            await syncDatabaseSchema(project.BaseDatos);
        }

        console.log(`[SwitchProject] New session prepared for ${project.Proyecto} (${newSessionData.version})`);

        // 4. Prepare response and set cookie using the response object
        const response = NextResponse.json({
            success: true,
            version: newSessionData.version,
            projectId: project.IdProyecto
        });

        // Use standard cookie options that match login route
        response.cookies.set('session', JSON.stringify(newSessionData), {
            httpOnly: true,
            secure: false, // Explicitly false for dev/standard HTTP
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        console.log(`[SwitchProject] Cookie set successfully, returning response`);
        return response;
    } catch (error: any) {
        console.error('[SwitchProject] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
