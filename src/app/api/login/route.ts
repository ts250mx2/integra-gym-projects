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
            console.log('User', user);

            // SPECIAL LOGIC FOR SUPER ADMIN (EsAdministrador = 2)
            if (user.EsAdministrador === 2) {
                const { projectQuery } = require('@/lib/projectDb');

                // 1. Fetch User 1 Data specific to this project
                const user1Data = await projectQuery(
                    user.IdProyecto,
                    'SELECT A.IdUsuario, A.Usuario, A.IdSucursal, B.Sucursal, A.IdPuesto, C.Puesto FROM tblUsuarios A LEFT JOIN tblSucursales B ON A.IdSucursal = B.IdSucursal LEFT JOIN tblPuestos C ON A.IdPuesto = C.IdPuesto WHERE A.IdUsuario = 1',
                    []
                ) as any[];


                if (user1Data.length > 0) {
                    const u1 = user1Data[0];
                    console.log('Impersonating User 1:', u1);

                    // Overwrite user details with User 1 details
                    user.IdUsuario = 1;
                    user.Usuario = u1.Usuario;
                    user.IdPuesto = u1.IdPuesto;
                    user.Puesto = 'Super User';
                    user.EsAdministrador = 2;
                    // Ensure valid branch (Use User 1's branch if Set, otherwise standard logic)
                    // If User 1 has a branch set, use it.
                    if (u1.IdSucursal && u1.IdSucursal !== 0) {
                        branchId = u1.IdSucursal;
                        branchName = u1.Sucursal;
                    } else {
                        // Fallback to active branches logic if User 1 has no branch (unlikely for admin, but safe)
                        // Query active branches in the project DB
                        const activeBranches = await projectQuery(
                            user.IdProyecto,
                            'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0',
                            []
                        ) as any[];

                        if (activeBranches.length === 1) {
                            branchId = activeBranches[0].IdSucursal;
                            branchName = activeBranches[0].Sucursal;
                        } else {
                            branchId = 0;
                            branchName = 'Seleccionar...';
                        }
                    }
                } else {
                    console.warn("User 1 not found in project DB. creating session as Super Admin without impersonation.");
                    // Query active branches in the project DB
                    const activeBranches = await projectQuery(
                        user.IdProyecto,
                        'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0',
                        []
                    ) as any[];

                    if (activeBranches.length === 1) {
                        branchId = activeBranches[0].IdSucursal;
                        branchName = activeBranches[0].Sucursal;
                    } else if (activeBranches.length > 1) {
                        branchId = 0;
                        branchName = 'Seleccionar...';
                    }
                }
            }
            console.log('Branch ID', branchId);
            console.log('Branch Name', branchName);
            // Sync Schema before session creation
            if (user.BaseDatos) {
                await syncDatabaseSchema(user.BaseDatos);
            }

            console.log('Session data', sessionData);
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

        console.log('Setting session cookie', sessionData);
        const cookieStore = await cookies();
        cookieStore.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: false, // process.env.NODE_ENV === 'production', // Disabled for now to allow HTTP production
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
        console.log('Login success');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'serverError' }, { status: 500 });
    }
}
