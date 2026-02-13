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

        // Allow overriding branchId via query param if needed (though usually we use session's branch)
        const { searchParams } = new URL(request.url);
        const queryBranchId = searchParams.get('branchId');
        if (queryBranchId) branchId = queryBranchId;

        const sql = `
            SELECT 
                A.*, 
                B.Usuario AS UsuarioApertura, 
                C.Usuario AS UsuarioCorte 
            FROM tblAperturasCierres A 
            INNER JOIN tblUsuarios B ON A.IdUsuarioApertura = B.IdUsuario 
            LEFT JOIN tblUsuarios C ON A.IdUsuarioCorte = C.IdUsuario 
            WHERE A.IdSucursal = ? 
            ORDER BY A.IdApertura DESC
        `;

        const openings = await projectQuery(projectId, sql, [branchId]);

        return NextResponse.json(openings);
    } catch (error) {
        console.error('Error fetching openings:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
