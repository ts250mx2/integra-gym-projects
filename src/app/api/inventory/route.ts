import { NextRequest, NextResponse } from 'next/server';
import {
    PRODUCT_TIPO_CUOTA,
    ensureInventorySchema,
    getSession,
    inventoryQuery,
    resolveBranchId,
    round2
} from '@/lib/inventory';

/**
 * Existencias por sucursal. Solo productos (tblCuotas.TipoCuota = 2);
 * las cuotas/membresias no forman parte del inventario.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const { searchParams } = new URL(req.url);
        const branchId = await resolveBranchId(session.projectId, Number(searchParams.get('branchId')) || session.branchId);
        const search = (searchParams.get('q') || '').trim();
        const onlyLowStock = searchParams.get('lowStock') === '1';

        const params: any[] = [branchId, PRODUCT_TIPO_CUOTA];
        let sql = `
            SELECT
                c.IdCuota,
                c.Cuota AS Producto,
                c.CodigoBarras,
                c.Precio,
                c.Costo,
                c.IVA,
                COALESCE(i.Existencia, 0) AS Existencia,
                COALESCE(i.StockMinimo, 0) AS StockMinimo,
                COALESCE(NULLIF(i.CostoPromedio, 0), c.Costo, 0) AS CostoPromedio,
                i.FechaAct
            FROM tblCuotas c
            LEFT JOIN tblInventario i ON i.IdCuota = c.IdCuota AND i.IdSucursal = ?
            WHERE c.TipoCuota = ? AND c.Status = 0`;

        if (search) {
            sql += ' AND (c.Cuota LIKE ? OR c.CodigoBarras LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (onlyLowStock) {
            sql += ' AND COALESCE(i.StockMinimo, 0) > 0 AND COALESCE(i.Existencia, 0) <= COALESCE(i.StockMinimo, 0)';
        }

        sql += ' ORDER BY c.Cuota ASC';

        const rows = await inventoryQuery(session.projectId, sql, params);

        const items = rows.map((row) => {
            const existencia = Number(row.Existencia) || 0;
            const costoPromedio = Number(row.CostoPromedio) || 0;
            const stockMinimo = Number(row.StockMinimo) || 0;

            return {
                ...row,
                Existencia: existencia,
                StockMinimo: stockMinimo,
                CostoPromedio: round2(costoPromedio),
                Valor: round2(existencia * costoPromedio),
                BajoStock: stockMinimo > 0 && existencia <= stockMinimo,
                SinExistencia: existencia <= 0
            };
        });

        const summary = {
            productos: items.length,
            unidades: round2(items.reduce((acc, item) => acc + item.Existencia, 0)),
            valor: round2(items.reduce((acc, item) => acc + item.Valor, 0)),
            bajoStock: items.filter((item) => item.BajoStock).length,
            sinExistencia: items.filter((item) => item.SinExistencia).length
        };

        return NextResponse.json({ branchId, items, summary });
    } catch (error: any) {
        console.error('GET Inventory error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Actualiza el stock minimo (punto de reorden) de un producto en la sucursal. */
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await ensureInventorySchema(session.projectId);

        const body = await req.json();
        const idCuota = Number(body.IdCuota) || 0;
        const stockMinimo = Number(body.StockMinimo) || 0;

        if (!idCuota) return NextResponse.json({ error: 'missingProduct' }, { status: 400 });
        if (stockMinimo < 0) return NextResponse.json({ error: 'invalidStockMinimo' }, { status: 400 });

        const branchId = await resolveBranchId(session.projectId, Number(body.IdSucursal) || session.branchId);
        if (!branchId) return NextResponse.json({ error: 'missingBranch' }, { status: 400 });

        const existing = await inventoryQuery(
            session.projectId,
            'SELECT IdInventario FROM tblInventario WHERE IdSucursal = ? AND IdCuota = ?',
            [branchId, idCuota]
        );

        if (existing.length > 0) {
            await inventoryQuery(
                session.projectId,
                'UPDATE tblInventario SET StockMinimo = ?, FechaAct = NOW() WHERE IdInventario = ?',
                [stockMinimo, existing[0].IdInventario]
            );
        } else {
            await inventoryQuery(
                session.projectId,
                `INSERT INTO tblInventario (IdSucursal, IdCuota, Existencia, StockMinimo, CostoPromedio, FechaAct)
                 VALUES (?, ?, 0, ?, 0, NOW())`,
                [branchId, idCuota, stockMinimo]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Inventory error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
