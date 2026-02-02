
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        const { projectId } = session;

        // Query tblDetalleVentas (Assuming legacy table for memberships)
        // If this table doesn't exist, we might need to look elsewhere or use tblVentasDetalle if it had dates
        // But based on user request "buscar en SELECT MAX(FechaFin) FROM tblDetalleVentas"
        const result = await projectQuery(
            projectId,
            `SELECT MAX(FechaFin) as LastDate 
             FROM tblDetalleVentas 
             WHERE IdSocio = ? AND Status = 0`,
            [id]
        ) as any[];

        const lastDate = result[0]?.LastDate || null;

        return NextResponse.json({ lastDate });

    } catch (error: any) {
        console.error('Last active date error:', error);
        // Fallback or error
        return NextResponse.json({ error: error.message, lastDate: null }, { status: 500 });
    }
}
