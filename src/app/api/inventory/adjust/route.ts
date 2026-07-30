import { NextRequest, NextResponse } from 'next/server';
import {
    MOVEMENT_TYPES,
    MovementType,
    applyStockMovement,
    ensureInventorySchema,
    findProduct,
    getSession,
    inventoryQuery,
    resolveBranchId
} from '@/lib/inventory';

type AdjustMode = 'set' | 'in' | 'out';

const MODE_MOVEMENT: Record<AdjustMode, MovementType> = {
    set: MOVEMENT_TYPES.ADJUSTMENT,
    in: MOVEMENT_TYPES.INITIAL,
    out: MOVEMENT_TYPES.WASTE
};

/**
 * Ajuste manual de existencias.
 * - set: fija la existencia al conteo fisico (calcula la diferencia).
 * - in:  entrada manual (alta inicial, devolucion).
 * - out: salida manual (merma, consumo interno).
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const body = await req.json();
        const idCuota = Number(body.IdCuota) || 0;
        const cantidad = Number(body.Cantidad);
        const mode = (body.Modo || 'set') as AdjustMode;
        const notas = (body.Notas || '').toString().slice(0, 255) || null;

        if (!idCuota) return NextResponse.json({ error: 'missingProduct' }, { status: 400 });
        if (!MODE_MOVEMENT[mode]) return NextResponse.json({ error: 'invalidMode' }, { status: 400 });
        if (!Number.isFinite(cantidad) || cantidad < 0) {
            return NextResponse.json({ error: 'invalidQuantity' }, { status: 400 });
        }

        const branchId = await resolveBranchId(session.projectId, Number(body.IdSucursal) || session.branchId);
        if (!branchId) return NextResponse.json({ error: 'missingBranch' }, { status: 400 });

        // Solo productos: una cuota/membresia nunca puede tener existencia.
        const product = await findProduct(session.projectId, idCuota);
        if (!product) return NextResponse.json({ error: 'productNotFound' }, { status: 404 });

        const current = await inventoryQuery(
            session.projectId,
            'SELECT Existencia FROM tblInventario WHERE IdSucursal = ? AND IdCuota = ?',
            [branchId, idCuota]
        );
        const existencia = Number(current[0]?.Existencia) || 0;

        let delta: number;
        if (mode === 'set') delta = cantidad - existencia;
        else if (mode === 'in') delta = cantidad;
        else delta = -cantidad;

        if (delta === 0) {
            return NextResponse.json({ success: true, existencia, sinCambios: true });
        }

        if (mode === 'out' && existencia - cantidad < 0) {
            return NextResponse.json({ error: 'insufficientStock', existencia }, { status: 400 });
        }

        const costo = body.Costo !== undefined && body.Costo !== null && body.Costo !== ''
            ? Number(body.Costo) || 0
            : Number(product.Costo) || 0;

        const nuevaExistencia = await applyStockMovement(session.projectId, {
            branchId,
            idCuota,
            cantidad: delta,
            tipo: MODE_MOVEMENT[mode],
            costo: delta > 0 ? costo : 0,
            idUsuario: session.userId,
            notas
        });

        return NextResponse.json({ success: true, existencia: nuevaExistencia });
    } catch (error: any) {
        console.error('POST Inventory adjust error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
