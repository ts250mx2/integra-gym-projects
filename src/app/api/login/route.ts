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
                    'SELECT IdProyecto, Proyecto, BaseDatos, Version FROM tblProyectos WHERE DominioIM = ?',
                    [domain]
                ) as any[];

                if (projects.length > 0) {
                    const project = projects[0];
                    const projectId = project.IdProyecto;

                    if (project.Version === '1.0') {
                        // V1.0 uses main BDIntegraProjects.tblUsuarios
                        const mainUsers = await query(
                            `SELECT IdUsuario, Usuario, EsAdmin 
                             FROM tblUsuarios 
                             WHERE (CorreoElectronico = ? OR Usuario = ?) 
                             AND Passwd = ? AND Status = 0`,
                            [email, userLogin, password]
                        ) as any[];

                        if (mainUsers.length > 0) {
                            const user = mainUsers[0];
                            sessionData = {
                                userId: user.IdUsuario,
                                userName: user.Usuario,
                                projectId: project.IdProyecto,
                                gymName: project.Proyecto,
                                branchId: 0,
                                branchName: 'General',
                                positionId: 0,
                                position: 'Usuario V1',
                                isAdmin: user.EsAdmin ?? 1,
                                version: '1.0'
                            };
                        }
                    } else {
                        // 2. Find user in project database (V2.0+)
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
                                isAdmin: user.EsAdministrador,
                                version: project.Version || '2.0'
                            };
                        }
                    }
                }
            }
        }

        // Fallback to standard login if no session created yet
        if (!sessionData) {
            // 1. Check if the user is a Global Admin (tblUsuarios directly)
            const globalAdminData = await query(
                `SELECT IdUsuario, Usuario, EsAdmin, ProyectoIntegrados, 0 AS IdProyecto, 'Integra Admin' AS Proyecto, 'BDIntegraProjects' AS BaseDatos, 0 AS IdPuesto, CASE WHEN EsAdmin = 2 THEN 'Super Admin' ELSE 'Project Admin' END AS Puesto, 0 AS IdSucursal, 'Central' AS Sucursal, '2.0' AS Version 
                 FROM tblUsuarios 
                 WHERE CorreoElectronico = ? AND Passwd = ? AND Status = 0 AND (EsAdmin = 1 OR EsAdmin = 2)`,
                [email, password]
            ) as any[];

            if (globalAdminData.length > 0) {
                // User is a Global Admin, create session immediately, no need to touch project databases
                const user = globalAdminData[0];
                console.log('Global Admin login:', user);

                sessionData = {
                    userId: user.IdUsuario,
                    userName: user.Usuario,
                    projectId: user.IdProyecto,
                    gymName: user.Proyecto,
                    branchId: user.IdSucursal,
                    branchName: user.Sucursal,
                    positionId: user.IdPuesto,
                    position: user.Puesto,
                    isAdmin: user.EsAdmin,
                    version: user.Version || '2.0',
                    proyectoIntegrados: user.ProyectoIntegrados || 0
                };
            } else {
                // 2. Not a Global Admin, find standard user and their project
                const userData = await query(
                    `SELECT u.IdUsuario, u.Usuario, u.EsAdmin, u.ProyectoIntegrados, p.IdProyecto, p.Proyecto, p.BaseDatos, p.Version, 0 AS IdPuesto, 'Usuario' AS Puesto, 0 AS IdSucursal, '' AS Sucursal 
                     FROM tblUsuarios u
                     JOIN tblProyectosUsuarios pu ON u.IdUsuario = pu.IdUsuario
                     JOIN tblProyectos p ON pu.IdProyecto = p.IdProyecto
                     WHERE u.CorreoElectronico = ? AND u.Passwd = ? AND u.Status = 0`,
                    [email, password]
                ) as any[];

                if (userData.length === 0) {
                    return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
                }

                const user = userData[0];

                let branchId = user.IdSucursal;
                let branchName = user.Sucursal;
                let isAdminLevel = user.EsAdmin || 0;

                console.log('Standard User login', user);

                // Sync Schema before session creation for standard users
                if (user.BaseDatos && user.Version !== '1.0') {
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
                    isAdmin: isAdminLevel,
                    version: user.Version || '1.0',
                    proyectoIntegrados: user.ProyectoIntegrados || 0
                };
            }
        }

        if (!sessionData) {
            return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
        }

        console.log('Setting session cookie', sessionData);

        const response = NextResponse.json({
            success: true,
            isAdmin: sessionData.isAdmin,
            version: sessionData.version
        });

        response.cookies.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: false, // process.env.NODE_ENV === 'production', // Disabled for now to allow HTTP production
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        console.log('Login success');
        return response;
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'serverError' }, { status: 500 });
    }
}
