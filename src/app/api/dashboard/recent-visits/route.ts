
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { projectId, branchId } = JSON.parse(sessionCookie.value);

        const projectData = await query(
            'SELECT BaseDatos FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        ) as any[];

        if (!projectData.length) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const dbName = projectData[0].BaseDatos;

        const hasBranch = branchId && branchId !== 0;

        // User provided query
        const sql = `
            SELECT 
                CASE WHEN A.IdSocio > 0 THEN B.CodigoSocio ELSE CONCAT('USU', A.IdUsuario) END AS CodigoSocio, 
                CASE WHEN A.IdSocio > 0 THEN B.Socio ELSE C.Usuario END AS Socio, 
                CASE WHEN A.IdSocio > 0 THEN B.FechaVencimiento ELSE 'N/A' END AS FechaVencimiento, 
                CASE WHEN A.IdSocio = 0 THEN 1 ELSE 0 END AS EsEmpleado, 
                A.FechaVisita, 
                CASE WHEN A.IdSocio > 0 THEN B.ArchivoFoto ELSE C.ArchivoFoto END AS ArchivoFoto,
                CASE WHEN A.IdSocio > 0 THEN DATEDIFF(B.FechaVencimiento, Now()) ELSE -1 END AS DiasVence
            FROM \`${dbName}\`.tblVisitasRecientes A
            LEFT JOIN \`${dbName}\`.tblSocios B ON A.IdSocio = B.IdSocio
            LEFT JOIN \`${dbName}\`.tblUsuarios C ON A.IdUsuario = C.IdUsuario 
            ${hasBranch ? 'WHERE A.IdSucursal = ?' : ''}
            ORDER BY FechaVisita DESC LIMIT 11
        `;

        const visits = await query(sql, hasBranch ? [branchId] : []);

        return NextResponse.json(visits);
    } catch (error: any) {
        console.error('Recent visits error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
