import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        let { projectId, branchId, userId, isAdmin } = session;

        // Override Superuser ID to 1 for Project Operations
        if (isAdmin === 2) {
            userId = 1;
        }

        const body = await req.json();
        const { idApertura } = body;

        if (!idApertura) return NextResponse.json({ error: 'Missing IdApertura' }, { status: 400 });

        // 1. Calculate Total Sales for this Opening
        const salesResult = await projectQuery(
            projectId,
            `SELECT SUM(Total) as TotalSales 
             FROM tblVentas 
             WHERE IdApertura = ? AND IdSucursal = ? AND Status = 0`,
            [idApertura, branchId]
        ) as any[];

        const totalSales = salesResult[0]?.TotalSales || 0;

        // 2. Perform Close (Update tblAperturasCierres)
        await projectQuery(
            projectId,
            `UPDATE tblAperturasCierres 
             SET FechaCorte = NOW(), IdUsuarioCorte = ?, FechaAct = NOW()
             WHERE IdApertura = ? AND IdSucursal = ?`,
            [userId, idApertura, branchId]
        );

        return NextResponse.json({ success: true, totalSales });

    } catch (error: any) {
        console.error('Close Register error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
