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
        const movId = searchParams.get('movId');
        const branchId = searchParams.get('branchId');
        const projectIdParam = searchParams.get('projectId');

        if (!movId || !branchId) {
            return NextResponse.json({ error: 'Missing parameters: movId and branchId are required.' }, { status: 400 });
        }

        const projectIdToQuery = projectIdParam ? parseInt(projectIdParam, 10) : session.projectId;
        const bypassVirtual = projectIdParam !== null;

        const detailQuery = `
            SELECT 
                Cantidad, 
                DescripcionCuota AS Descripcion, 
                FechaInicio AS Inicio, 
                FechaFin AS Fin, 
                Precio, 
                Cantidad * Precio AS Total
            FROM tblDetalleMovimientos 
            WHERE IdMovimiento = ? 
            AND IdSucursal = ?
        `;

        const rows = await projectQuery(projectIdToQuery, detailQuery, [
            parseInt(movId),
            parseInt(branchId)
        ], undefined, bypassVirtual) as any[];

        return NextResponse.json({ data: rows });

    } catch (error: any) {
        console.error('[Sale Detail API] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
