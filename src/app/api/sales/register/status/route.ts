import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery, getProjectConnectionPool } from '@/lib/projectDb';
import { query } from '@/lib/db'; // Import Main DB query

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        const { projectId, branchId } = session;

        // 1. Ensure Table Exists (Lazy Migration)
        try {
            await projectQuery(projectId, 'SELECT 1 FROM tblAperturasCierres LIMIT 1');
        } catch (e: any) {
            if (e.code === 'ER_NO_SUCH_TABLE') {
                await projectQuery(projectId, `
                    CREATE TABLE IF NOT EXISTS tblAperturasCierres (
                        IdApertura INT NOT NULL,
                        IdSucursal INT NOT NULL,
                        FechaApertura DATETIME DEFAULT NULL,
                        IdUsuarioApertura INT DEFAULT NULL,
                        FondoCaja DECIMAL(18,2) DEFAULT 0.00,
                        IdUsuarioCorte INT DEFAULT NULL,
                        FechaCorte DATETIME DEFAULT NULL,
                        FechaAct DATETIME DEFAULT NULL,
                        PRIMARY KEY (IdApertura, IdSucursal)
                    )
                `);
            }
        }

        // 2. Query Active Session
        // "SELECT IdApertura, Usuario, FechaApertura, FondoCaja FROM tblAperturasCierres A INNER JOIN tblUsuarios B ON A.IdUsuarioApertura = B.IdUsuario WHERE A.IdSucursal = {{SessionData.IdBranch}}"
        // And check if open (IdUsuarioCorte = 0)

        // 2. Query Active Session & Branch Details
        // Join with tblSucursales to get address info
        const activeSessions = await projectQuery(
            projectId,
            `SELECT 
                A.IdApertura, 
                B.Usuario, 
                A.FechaApertura, 
                A.FondoCaja,
                S.Direccion1, S.Direccion2, S.Estado, S.Localidad, S.CodigoPostal, S.Telefono, S.CorreoElectronico
             FROM tblAperturasCierres A 
             INNER JOIN tblUsuarios B ON A.IdUsuarioApertura = B.IdUsuario 
             INNER JOIN tblSucursales S ON A.IdSucursal = S.IdSucursal
             WHERE A.IdSucursal = ? AND A.IdUsuarioCorte = 0 ORDER BY A.IdApertura DESC LIMIT 1`,
            [branchId]
        ) as any[];

        if (activeSessions.length > 0) {
            const details = activeSessions[0];

            // 3. Fetch Project Logo and Name from Main DB
            try {
                const projectRes = await query('SELECT ArchivoLogo, Proyecto FROM tblProyectos WHERE IdProyecto = ?', [projectId]) as any[];
                if (projectRes.length > 0) {
                    details.ProjectLogo = projectRes[0].ArchivoLogo;
                    details.GymName = projectRes[0].Proyecto;
                }
            } catch (err) {
                console.error('Error fetching logo/name:', err);
                // Do not fail the status check if logo fails
            }

            return NextResponse.json({
                isOpen: true,
                details: details
            });
        } else {
            return NextResponse.json({ isOpen: false });
        }

    } catch (error: any) {
        console.error('Register status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
