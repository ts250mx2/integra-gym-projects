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
                MAX(C.Foto) AS Foto,
                CASE WHEN B.CodigoBarras IS NULL THEN '' ELSE B.CodigoBarras END AS Codigo,
                CASE WHEN B.Nombres IS NULL OR B.Nombres = '' THEN 'PUBLICO GENERAL' ELSE B.Nombres END AS Socio,
                COUNT(D.IdDetalleMovimiento) AS Cantidad,
                A.FormaPago,
                A.Total,
                CASE WHEN A.Status = 2 THEN 'CANCELADO' ELSE 'ACTIVO' END AS Status,
                GROUP_CONCAT(COALESCE(D.DescripcionCuota, D.ConceptoCargo, '') SEPARATOR ' | ') AS Descripcion
            FROM tblMovimientos A
            LEFT JOIN tblSocios B ON A.IdSocio = B.IdSocio AND A.IdSucursalSocio = B.IdSucursal
            LEFT JOIN tblSociosFotos C ON B.IdSocio = C.IdSocio AND C.EsUltimaFoto = 1
            INNER JOIN tblDetalleMovimientos D ON A.IdMovimiento = D.IdMovimiento AND A.IdSucursal = D.IdSucursal
            INNER JOIN tblSucursales E ON A.IdSucursal = E.IdSucursal
            WHERE A.FechaMovimiento >= ?
            AND A.FechaMovimiento <= ?
            AND A.IdSucursal = ?
            GROUP BY E.Sucursal, A.IdMovimiento, A.IdSucursal, A.FolioMovimiento, A.FechaMovimiento, B.CodigoBarras, B.Nombres, A.FormaPago, A.Total, A.Status
            ORDER BY A.FechaMovimiento DESC
        `;

        const rawRows = await projectQuery(projectIdToQuery, detailQuery, [
            `${startDate} 00:00:00`,
            `${endDate} 23:59:59`,
            parseInt(branchId)
        ], undefined, bypassVirtual) as any[];

        // DEBUG: log what we got from DB
        const withFoto = rawRows.filter((r: any) => r.Foto != null && r.Foto !== 0);
        const sample = rawRows[0];
        console.log('[Branch Detail DEBUG]', {
            totalRows: rawRows.length,
            rowsWithFoto: withFoto.length,
            fotoType: withFoto[0] ? typeof withFoto[0].Foto : 'n/a',
            isBuffer: withFoto[0] ? Buffer.isBuffer(withFoto[0].Foto) : 'n/a',
            fotoConstructor: withFoto[0]?.Foto?.constructor?.name,
            fotoLength: withFoto[0]?.Foto?.length ?? withFoto[0]?.Foto?.byteLength,
            sampleSocio: sample?.Socio,
            sampleCodigo: sample?.Codigo,
            bypassVirtual,
            projectIdToQuery,
        });

        // Convert binary Foto Buffer to base64 data URL for frontend display
        const rows = rawRows.map((row: any) => {
            if (row.Foto) {
                try {
                    let fotoBuffer: Buffer | null = null;
                    if (Buffer.isBuffer(row.Foto)) {
                        fotoBuffer = row.Foto;
                    } else if (row.Foto instanceof Uint8Array) {
                        fotoBuffer = Buffer.from(row.Foto);
                    } else if (typeof row.Foto === 'object' && row.Foto !== null) {
                        // mysql2 may return binary data as an object with numeric keys
                        fotoBuffer = Buffer.from(Object.values(row.Foto) as number[]);
                    } else if (typeof row.Foto === 'string') {
                        // Already a string (shouldn't happen with binary blobs, but handle it)
                        if (!row.Foto.startsWith('data:')) {
                            row.Foto = `data:image/jpeg;base64,${row.Foto}`;
                        }
                        fotoBuffer = null;
                    }
                    if (fotoBuffer && fotoBuffer.length > 0) {
                        row.Foto = `data:image/jpeg;base64,${fotoBuffer.toString('base64')}`;
                    } else if (fotoBuffer !== null) {
                        row.Foto = null;
                    }
                } catch {
                    row.Foto = null;
                }
            }
            return row;
        });

        return NextResponse.json({ data: rows });

    } catch (error: any) {
        console.error('[Branch Detail API] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
