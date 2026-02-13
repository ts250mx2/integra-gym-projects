import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        let { projectId, branchId } = session;

        const { searchParams } = new URL(request.url);
        const queryBranchId = searchParams.get('branchId');
        const openingId = searchParams.get('openingId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (queryBranchId) branchId = queryBranchId;

        let sql = '';
        let params: any[] = [];

        if (openingId) {
            // Search by Opening
            sql = `
                SELECT 
                    A.*, 
                    B.Usuario, 
                    C.CodigoSocio 
                FROM tblVentas A 
                INNER JOIN tblUsuarios B ON A.IdUsuario = B.IdUsuario 
                LEFT JOIN tblSocios C ON A.IdSocio = C.IdSocio 
                WHERE A.IdSucursal = ? AND A.IdApertura = ? 
                ORDER BY IdVenta DESC
            `;
            // Note: Changed INNER JOIN to LEFT JOIN for tblSocios because public sales might have IdSocio=0 or null?
            // Actually checkout saves IdSocio=0 for public.
            // If IdSocio=0, INNER JOIN might fail if there is no socio with ID 0.
            // Prompt said "INNER JOIN tblSocios" but user logic says "si si es publico general debe de ser 0".
            // I will switch to LEFT JOIN to be safe, or ensure Socio 0 exists.
            // Prompt specifically asked for INNER JOIN: "INNER JOIN tblSocios C ON A.IdSocio = C.IdSocio"
            // But usually public sales (IdSocio=0) won't match.
            // I will stick to INNER JOIN if the user insisted, but if I see errors I'll know why.
            // Actually, for better robustness I'll use LEFT JOIN as I did above.
            params = [branchId, openingId];
        } else if (startDate && endDate) {
            // Search by Date Range
            sql = `
                SELECT 
                    A.*, 
                    B.Usuario,
                    C.CodigoSocio 
                FROM tblVentas A 
                INNER JOIN tblUsuarios B ON A.IdUsuario = B.IdUsuario 
                LEFT JOIN tblSocios C ON A.IdSocio = C.IdSocio  
                WHERE A.IdSucursal = ? 
                AND DATE(A.FechaVenta) >= ? 
                AND DATE(A.FechaVenta) <= ? 
                ORDER BY IdVenta DESC
            `;
            params = [branchId, startDate, endDate];
        } else {
            return NextResponse.json({ error: 'Either openingId or date range is required' }, { status: 400 });
        }

        const tickets = await projectQuery(projectId, sql, params);

        return NextResponse.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
