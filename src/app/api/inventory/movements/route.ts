import { NextRequest, NextResponse } from 'next/server';
import { ensureInventorySchema, getSession, inventoryQuery, resolveBranchId } from '@/lib/inventory';

const MAX_LIMIT = 200;

/** Kardex: movimientos de un producto en una sucursal, del mas reciente al mas antiguo. */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const { searchParams } = new URL(req.url);
        const idCuota = Number(searchParams.get('idCuota')) || 0;
        if (!idCuota) return NextResponse.json({ error: 'missingProduct' }, { status: 400 });

        const branchId = await resolveBranchId(session.projectId, Number(searchParams.get('branchId')) || session.branchId);
        const requestedLimit = Number(searchParams.get('limit')) || 50;
        const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

        const movements = await inventoryQuery(
            session.projectId,
            `SELECT
                m.IdMovimientoInv, m.Fecha, m.Tipo, m.Cantidad, m.Costo,
                m.ExistenciaAnterior, m.ExistenciaNueva, m.Referencia, m.IdReferencia, m.Notas,
                COALESCE(u.Usuario, '-') AS Usuario
             FROM tblMovimientosInventario m
             LEFT JOIN tblUsuarios u ON u.IdUsuario = m.IdUsuario
             WHERE m.IdSucursal = ? AND m.IdCuota = ?
             ORDER BY m.Fecha DESC, m.IdMovimientoInv DESC
             LIMIT ${limit}`,
            [branchId, idCuota]
        );

        return NextResponse.json(movements);
    } catch (error: any) {
        console.error('GET Inventory movements error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
