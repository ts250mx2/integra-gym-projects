import { NextRequest, NextResponse } from 'next/server';
import {
    MOVEMENT_TYPES,
    applyStockMovement,
    ensureInventorySchema,
    getSession,
    inventoryQuery
} from '@/lib/inventory';

async function loadPurchase(projectId: number, idCompra: number) {
    const rows = await inventoryQuery(
        projectId,
        `SELECT c.*, COALESCE(u.Usuario, '-') AS Usuario, COALESCE(s.Sucursal, '') AS Sucursal
         FROM tblCompras c
         LEFT JOIN tblUsuarios u ON u.IdUsuario = c.IdUsuario
         LEFT JOIN tblSucursales s ON s.IdSucursal = c.IdSucursal
         WHERE c.IdCompra = ?`,
        [idCompra]
    );
    return rows[0] || null;
}

/** Detalle de una compra: encabezado + partidas. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const { id } = await params;
        const idCompra = Number(id) || 0;
        if (!idCompra) return NextResponse.json({ error: 'missingId' }, { status: 400 });

        const purchase = await loadPurchase(session.projectId, idCompra);
        if (!purchase) return NextResponse.json({ error: 'purchaseNotFound' }, { status: 404 });

        const items = await inventoryQuery(
            session.projectId,
            `SELECT d.*, c.CodigoBarras
             FROM tblDetalleCompras d
             LEFT JOIN tblCuotas c ON c.IdCuota = d.IdCuota
             WHERE d.IdCompra = ?
             ORDER BY d.IdDetalleCompra ASC`,
            [idCompra]
        );

        return NextResponse.json({ purchase, items });
    } catch (error: any) {
        console.error('GET Purchase detail error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Cancela una compra: marca Status = 2 y devuelve al inventario la entrada
 * que habia generado. Si el stock ya se vendio, la existencia puede quedar
 * negativa y se registra igual para que el kardex sea auditable.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const { id } = await params;
        const idCompra = Number(id) || 0;
        if (!idCompra) return NextResponse.json({ error: 'missingId' }, { status: 400 });

        const purchase = await loadPurchase(session.projectId, idCompra);
        if (!purchase) return NextResponse.json({ error: 'purchaseNotFound' }, { status: 404 });
        if (Number(purchase.Status) === 2) {
            return NextResponse.json({ error: 'alreadyCancelled' }, { status: 400 });
        }

        const items = await inventoryQuery(
            session.projectId,
            'SELECT IdCuota, Cantidad, Costo FROM tblDetalleCompras WHERE IdCompra = ?',
            [idCompra]
        );

        await inventoryQuery(
            session.projectId,
            'UPDATE tblCompras SET Status = 2, FechaAct = NOW() WHERE IdCompra = ?',
            [idCompra]
        );

        for (const item of items) {
            await applyStockMovement(session.projectId, {
                branchId: Number(purchase.IdSucursal) || 0,
                idCuota: Number(item.IdCuota),
                cantidad: -Math.abs(Number(item.Cantidad) || 0),
                tipo: MOVEMENT_TYPES.PURCHASE_CANCEL,
                referencia: purchase.Folio,
                idReferencia: idCompra,
                idUsuario: session.userId,
                notas: 'Cancelacion de compra'
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Purchase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
