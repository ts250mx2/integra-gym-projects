import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const branchId = searchParams.get('branchId');
        const projectIdParam = searchParams.get('projectId');

        if (!startDate || !endDate || !branchId) {
            return NextResponse.json({ error: 'Missing parameters: startDate, endDate, branchId are required.' }, { status: 400 });
        }

        const projectIdToQuery = projectIdParam ? parseInt(projectIdParam, 10) : session.projectId;
        const bypassVirtual = projectIdParam !== null;

        const detailQuery = `
            SELECT 
                E.Sucursal,
                A.IdMovimiento,
                A.IdSucursal,
                A.FolioMovimiento AS Folio,
                A.FechaMovimiento AS Fecha,
                C.Foto AS Foto,
                CASE WHEN B.CodigoBarras IS NULL THEN '' ELSE B.CodigoBarras END AS Codigo,
                CASE WHEN B.Nombres IS NULL OR B.Nombres = '' THEN 'PUBLICO GENERAL' ELSE B.Nombres END AS Socio,
                COUNT(D.IdDetalleMovimiento) AS Cantidad,
                A.FormaPago,
                A.Total,
                CASE WHEN A.Status = 2 THEN 'CANCELADO' ELSE 'ACTIVO' END AS Status
            FROM tblMovimientos A
            LEFT JOIN tblSocios B ON A.IdSocio = B.IdSocio AND A.IdSucursal = B.IdSucursal
            LEFT JOIN tblSociosFotos C ON B.IdSocio = C.IdSocio AND B.IdSucursal = C.IdSucursal
            INNER JOIN tblDetalleMovimientos D ON A.IdMovimiento = D.IdMovimiento AND A.IdSucursal = D.IdSucursal
            INNER JOIN tblSucursales E ON A.IdSucursal = E.IdSucursal
            WHERE A.FechaMovimiento >= ?
            AND A.FechaMovimiento <= ?
            AND A.IdSucursal = ?
            AND (C.IdSocio IS NULL OR C.EsUltimaFoto = 1)
            GROUP BY E.Sucursal, A.IdMovimiento, A.IdSucursal, A.FolioMovimiento, A.FechaMovimiento, B.CodigoBarras, B.Nombres, A.FormaPago, A.Total, A.Status
            ORDER BY A.FechaMovimiento DESC
        `;

        const rawRows = await projectQuery(projectIdToQuery, detailQuery, [
            `${startDate} 00:00:00`,
            `${endDate} 23:59:59`,
            parseInt(branchId)
        ], undefined, bypassVirtual) as any[];

        // Convert binary Foto Buffer to base64 data URL for frontend display
        const rows = rawRows.map((row: any) => {
            if (row.Foto && Buffer.isBuffer(row.Foto)) {
                row.Foto = `data:image/jpeg;base64,${row.Foto.toString('base64')}`;
            } else if (row.Foto && typeof row.Foto !== 'string') {
                // Handle any other non-string binary type
                row.Foto = `data:image/jpeg;base64,${Buffer.from(row.Foto).toString('base64')}`;
            }
            return row;
        });

        return NextResponse.json({ data: rows });

    } catch (error: any) {
        console.error('[Branch Detail API] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
