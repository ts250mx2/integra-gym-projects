import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { syncDatabaseSchema } from '@/lib/schema-sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        let sessionData: any = null;

        // Check for .IM domain login
        if (email && email.toLowerCase().endsWith('.im')) {
            const parts = email.split('@');
            if (parts.length === 2) {
                const domainWithSuffix = parts[1]; // e.g., domain.im
                const domain = domainWithSuffix.substring(0, domainWithSuffix.length - 3); // Remove .im
                const userLogin = parts[0];

                // 1. Find project by domain
                const projects = await query(
                    'SELECT IdProyecto, Proyecto, BaseDatos FROM tblProyectos WHERE DominioIM = ?',
                    [domain]
                ) as any[];

                if (projects.length > 0) {
                    const project = projects[0];
                    const projectId = project.IdProyecto;

                    // 2. Find user in project database
                    // We need to import projectQuery manually or dynamically since it's not at top level if not used
                    // But we can import it at top level.
                    // Assuming projectQuery is imported:
                    const { projectQuery } = require('@/lib/projectDb');

                    const users = await projectQuery(
                        projectId,
                        'SELECT IdUsuario, Usuario, A.IdSucursal, B.Sucursal, A.IdPuesto, C.Puesto, CASE WHEN C.EsAdministrador IS NULL THEN 0 ELSE 1 END AS EsAdministrador FROM tblUsuarios A JOIN tblSucursales B ON A.IdSucursal = B.IdSucursal JOIN tblPuestos C ON A.IdPuesto = C.IdPuesto WHERE A.Login = ? AND A.Login IS NOT NULL AND A.Login != ? AND A.Passwd IS NOT NULL AND A.Passwd != ? AND A.Passwd = ?',
                        [userLogin, '', '', password]
                    ) as any[];

                    if (users.length > 0) {
                        const user = users[0];

                        // Sync Schema before session creation
                        if (project.BaseDatos) {
                            await syncDatabaseSchema(project.BaseDatos);
                        }

                        sessionData = {
                            userId: user.IdUsuario,
                            userName: user.Usuario,
                            projectId: project.IdProyecto,
                            gymName: project.Proyecto,
                            branchId: user.IdSucursal,
                            branchName: user.Sucursal,
                            positionId: user.IdPuesto,
                            position: user.Puesto,
                            isAdmin: user.EsAdministrador
                        };
                    }
                }
            }
        }

        // Fallback to standard login if no session created yet
        if (!sessionData) {
            // 1. Find user and their project
            const userData = await query(
                `SELECT u.IdUsuario, u.Usuario, p.IdProyecto, p.Proyecto, p.BaseDatos, 2 AS EsAdministrador, 0 AS IdPuesto, 'Super Admin' AS Puesto, 0 AS IdSucursal, '' AS Sucursal 
             FROM tblUsuarios u
             JOIN tblProyectosUsuarios pu ON u.IdUsuario = pu.IdUsuario
             JOIN tblProyectos p ON pu.IdProyecto = p.IdProyecto
             WHERE u.CorreoElectronico = ? AND u.Passwd = ? AND u.Status = 0`,
                [email, password]
            ) as any[];

            const user = userData[0];

            let branchId = user.IdSucursal;
            let branchName = user.Sucursal;

            // SPECIAL LOGIC FOR SUPER ADMIN (EsAdministrador = 2)
            if (user.EsAdministrador === 2) {
                const { projectQuery } = require('@/lib/projectDb');

                // Query active branches in the project DB
                const activeBranches = await projectQuery(
                    user.IdProyecto,
                    'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0',
                    []
                ) as any[];

                if (activeBranches.length === 1) {
                    // Only one active branch -> Auto-select
                    branchId = activeBranches[0].IdSucursal;
                    branchName = activeBranches[0].Sucursal;
                } else if (activeBranches.length > 1) {
                    // Multiple active branches -> Force selection
                    branchId = 0;
                    branchName = 'Seleccionar...';
                }
                // If 0 active branches? Keep user default or 0? user.IdSucursal might be valid even if status=0 logic fails? 
                // Let's stick to the requested logic: "if only exists one... else... drilldown".
            }

            // Sync Schema before session creation
            if (user.BaseDatos) {
                await syncDatabaseSchema(user.BaseDatos);
            }

            sessionData = {
                userId: user.IdUsuario,
                userName: user.Usuario,
                projectId: user.IdProyecto,
                gymName: user.Proyecto,
                branchId: branchId,
                branchName: branchName,
                positionId: user.IdPuesto,
                position: user.Puesto,
                isAdmin: user.EsAdministrador
            };
        }

        if (!sessionData) {
            return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
        }

        const cookieStore = await cookies();
        cookieStore.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        // 3. Sync database schema (Only if we have BaseDatos, which we might want to fetch for standard flow too)
        // For .IM flow, we have 'project' object in scope but not here.
        // Re-fetch project DB info or store it in session? Or just sync if we know which DB.
        // For standard flow, 'user' has BaseDatos.

        // Optimally we should sync. For now, let's keep it simple.
        // The original code synced. Let's try to maintain that if possible.
        // For .IM flow, we know the project.
        // Let's verify if we need to sync. The prompt didn't ask, but good practice.
        // I'll skip sync logic for .IM flow for this specific iteration to avoid complexity unless required, 
        // as I don't want to break the flow with imports or scope issues.
        // Actually, for standard flow, it was doing `if (user.BaseDatos) sync...`
        // I'll omit for now for .IM flow or add it if easy.

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'serverError' }, { status: 500 });
    }
}
