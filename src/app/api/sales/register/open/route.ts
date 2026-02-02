import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        const { projectId, branchId, userId } = session;

        const body = await req.json();
        const { amount } = body; // FondoCaja

        // 1. Get Max IdApertura
        const maxResult = await projectQuery(
            projectId,
            'SELECT MAX(IdApertura) as MaxId FROM tblAperturasCierres WHERE IdSucursal = ?',
            [branchId]
        ) as any[];

        const nextId = (maxResult[0]?.MaxId || 0) + 1;

        // 2. Insert
        // VALUES(nextId, branchId, NOW(), userId, amount, NULL, NULL, NOW())
        // Corresponding check on Schema create: IdSupervisorCorte default 0.
        // The user prompted: "values(..., IdUsuario, FechaCorte, FechaAct)" where IdUsuario was NULL (likely meaning the closer).
        // My CREATE TABLE has IdUsuario separate from IdSupervisorCorte? 
        // User's prompt: "IdUsuario, FechaCorte, FechaAct) VALUES(..., NULL, NULL, Now())"
        // I will follow the insert structure.

        await projectQuery(
            projectId,
            `INSERT INTO tblAperturasCierres 
             (IdApertura, IdSucursal, FechaApertura, IdUsuarioApertura, FondoCaja, IdUsuario, FechaCorte, FechaAct, IdSupervisorCorte) 
             VALUES (?, ?, NOW(), ?, ?, NULL, NULL, NOW(), 0)`,
            [nextId, branchId, userId, amount]
        );

        return NextResponse.json({ success: true, id: nextId });

    } catch (error: any) {
        console.error('Register open error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
