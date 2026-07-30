import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
    MOVEMENT_TYPES,
    applyStockMovement,
    ensureInventorySchema,
    findProduct,
    getSession,
    inventoryExecute,
    inventoryQuery,
    resolveBranchId,
    round2
} from '@/lib/inventory';

const MAX_LIMIT = 200;

interface PurchaseLine {
    IdCuota: number;
    Producto: string;
    Cantidad: number;
    Costo: number;
    Iva: number;
    Importe: number;
}

/** Listado de compras de la sucursal, con filtros de fecha, proveedor y estatus. */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const { searchParams } = new URL(req.url);
        const branchId = await resolveBranchId(session.projectId, Number(searchParams.get('branchId')) || session.branchId);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const providerId = Number(searchParams.get('providerId')) || 0;
        const includeCancelled = searchParams.get('includeCancelled') === '1';
        const requestedLimit = Number(searchParams.get('limit')) || 100;
        const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

        const params: any[] = [branchId];
        let sql = `
            SELECT
                c.IdCompra, c.Folio, c.Referencia, c.FechaCompra, c.IdProveedor, c.Proveedor,
                c.Subtotal, c.Iva, c.Total, c.Notas, c.Status,
                COALESCE(u.Usuario, '-') AS Usuario,
                (SELECT COUNT(*) FROM tblDetalleCompras d WHERE d.IdCompra = c.IdCompra) AS Partidas
            FROM tblCompras c
            LEFT JOIN tblUsuarios u ON u.IdUsuario = c.IdUsuario
            WHERE c.IdSucursal = ?`;

        if (!includeCancelled) sql += ' AND c.Status = 0';

        if (from) {
            sql += ' AND c.FechaCompra >= ?';
            params.push(`${from} 00:00:00`);
        }
        if (to) {
            sql += ' AND c.FechaCompra <= ?';
            params.push(`${to} 23:59:59`);
        }
        if (providerId) {
            sql += ' AND c.IdProveedor = ?';
            params.push(providerId);
        }

        sql += ` ORDER BY c.FechaCompra DESC, c.IdCompra DESC LIMIT ${limit}`;

        const purchases = await inventoryQuery(session.projectId, sql, params);

        const active = purchases.filter((p) => Number(p.Status) === 0);
        const summary = {
            compras: active.length,
            total: round2(active.reduce((acc, p) => acc + (Number(p.Total) || 0), 0))
        };

        return NextResponse.json({ branchId, purchases, summary });
    } catch (error: any) {
        console.error('GET Purchases error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Registra una compra y da entrada al inventario.
 * Solo admite productos (tblCuotas.TipoCuota = 2); las cuotas se rechazan.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const body = await req.json();
        const rawItems = Array.isArray(body.items) ? body.items : [];
        if (rawItems.length === 0) return NextResponse.json({ error: 'emptyPurchase' }, { status: 400 });

        const branchId = await resolveBranchId(session.projectId, Number(body.IdSucursal) || session.branchId);
        if (!branchId) return NextResponse.json({ error: 'missingBranch' }, { status: 400 });

        const idProveedor = Number(body.IdProveedor) || 0;
        if (!idProveedor) return NextResponse.json({ error: 'missingProvider' }, { status: 400 });

        const providerRows = await inventoryQuery(
            session.projectId,
            'SELECT IdProveedor, Proveedor FROM tblProveedores WHERE IdProveedor = ? AND Status != 2',
            [idProveedor]
        );
        if (providerRows.length === 0) return NextResponse.json({ error: 'providerNotFound' }, { status: 404 });

        // Valida cada partida contra el catalogo antes de escribir nada.
        const lines: PurchaseLine[] = [];
        for (const raw of rawItems) {
            const idCuota = Number(raw.IdCuota) || 0;
            const cantidad = Number(raw.Cantidad) || 0;
            const costo = Number(raw.Costo) || 0;

            if (cantidad <= 0) return NextResponse.json({ error: 'invalidQuantity' }, { status: 400 });
            if (costo < 0) return NextResponse.json({ error: 'invalidCost' }, { status: 400 });

            const product = await findProduct(session.projectId, idCuota);
            if (!product) return NextResponse.json({ error: 'productNotFound', IdCuota: idCuota }, { status: 400 });

            const iva = raw.Iva !== undefined && raw.Iva !== null && raw.Iva !== ''
                ? Number(raw.Iva) || 0
                : Number(product.IVA) || 0;

            lines.push({
                IdCuota: idCuota,
                Producto: product.Cuota,
                Cantidad: cantidad,
                Costo: costo,
                Iva: iva,
                Importe: round2(cantidad * costo)
            });
        }

        const subtotal = round2(lines.reduce((acc, line) => acc + line.Importe, 0));
        const ivaTotal = round2(lines.reduce((acc, line) => acc + (line.Importe * line.Iva) / 100, 0));
        const total = round2(subtotal + ivaTotal);

        const fechaCompra = body.FechaCompra ? `${body.FechaCompra} 00:00:00` : null;

        const insert = await inventoryExecute(
            session.projectId,
            `INSERT INTO tblCompras
             (IdSucursal, IdProveedor, Proveedor, Folio, Referencia, FechaCompra, Subtotal, Iva, Total, Notas, IdUsuario, Status, FechaAct, UUID)
             VALUES (?, ?, ?, '', ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, 0, NOW(), ?)`,
            [
                branchId,
                idProveedor,
                providerRows[0].Proveedor,
                (body.Referencia || '').toString().slice(0, 100) || null,
                fechaCompra,
                subtotal,
                ivaTotal,
                total,
                (body.Notas || '').toString().slice(0, 500) || null,
                session.userId,
                uuidv4()
            ]
        );

        const idCompra = Number(insert?.insertId) || 0;
        if (!idCompra) return NextResponse.json({ error: 'purchaseNotCreated' }, { status: 500 });

        const branchRows = await inventoryQuery(
            session.projectId,
            'SELECT Clave FROM tblSucursales WHERE IdSucursal = ?',
            [branchId]
        );
        const folio = `C${branchRows[0]?.Clave || 'X'}${idCompra}`;
        await inventoryQuery(session.projectId, 'UPDATE tblCompras SET Folio = ? WHERE IdCompra = ?', [folio, idCompra]);

        for (const line of lines) {
            await inventoryQuery(
                session.projectId,
                `INSERT INTO tblDetalleCompras (IdCompra, IdSucursal, IdCuota, Producto, Cantidad, Costo, Iva, Importe)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [idCompra, branchId, line.IdCuota, line.Producto, line.Cantidad, line.Costo, line.Iva, line.Importe]
            );

            await applyStockMovement(session.projectId, {
                branchId,
                idCuota: line.IdCuota,
                cantidad: line.Cantidad,
                tipo: MOVEMENT_TYPES.PURCHASE,
                costo: line.Costo,
                referencia: folio,
                idReferencia: idCompra,
                idUsuario: session.userId
            });

            // El catalogo guarda el ultimo costo conocido del producto.
            if (line.Costo > 0) {
                await inventoryQuery(
                    session.projectId,
                    'UPDATE tblCuotas SET Costo = ? WHERE IdCuota = ?',
                    [line.Costo, line.IdCuota]
                );
            }
        }

        return NextResponse.json({ success: true, IdCompra: idCompra, Folio: folio, Total: total });
    } catch (error: any) {
        console.error('POST Purchase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
