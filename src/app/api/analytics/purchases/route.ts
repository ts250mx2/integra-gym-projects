import { NextRequest, NextResponse } from 'next/server';
import {
    analyticsQuery,
    branchFilter,
    getAnalyticsSession,
    getProjectSource
} from '@/lib/analytics/source';
import { percentDelta, periodBounds, resolvePeriod } from '@/lib/analytics/period';

const TOP_LIMIT = 10;

/** Respuesta vacia para gimnasios que aun no registran ninguna compra. */
const EMPTY = {
    summary: { total: 0, compras: 0, partidas: 0, unidades: 0, deltaTotal: null, valorInventario: 0, bajoStock: 0 },
    trend: [],
    topProviders: [],
    topProducts: [],
    costVsPrice: []
};

export async function GET(req: NextRequest) {
    try {
        const session = await getAnalyticsSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const period = resolvePeriod(searchParams);
        const source = await getProjectSource(session.projectId);

        if (!source.hasPurchases) {
            return NextResponse.json({ period, empty: true, ...EMPTY });
        }

        const [from, to] = periodBounds(period.from, period.to);
        const [prevFrom, prevTo] = periodBounds(period.prevFrom, period.prevTo);
        const branch = branchFilter(session.branchId, 'c');
        const invBranch = branchFilter(session.branchId, 'i');

        const headerWhere = `c.Status = 0 AND c.FechaCompra BETWEEN ? AND ?${branch.clause}`;
        // DATE_FORMAT y no DATE(): DATE() regresa un objeto Date que al
        // serializarse rompe las etiquetas del eje.
        const dateExpr = period.grain === 'month'
            ? "DATE_FORMAT(c.FechaCompra, '%Y-%m')"
            : "DATE_FORMAT(c.FechaCompra, '%Y-%m-%d')";

        const [totals, prevTotals, trend, topProviders, topProducts, inventory, costVsPrice] = await Promise.all([
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(SUM(c.Total), 0) AS total, COUNT(*) AS compras
                 FROM tblCompras c WHERE ${headerWhere}`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(SUM(c.Total), 0) AS total FROM tblCompras c WHERE ${headerWhere}`,
                [prevFrom, prevTo, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT ${dateExpr} AS bucket, COALESCE(SUM(c.Total), 0) AS total
                 FROM tblCompras c WHERE ${headerWhere}
                 GROUP BY bucket ORDER BY bucket ASC`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(NULLIF(c.Proveedor, ''), 'Sin proveedor') AS name,
                        COALESCE(SUM(c.Total), 0) AS total, COUNT(*) AS compras
                 FROM tblCompras c WHERE ${headerWhere}
                 GROUP BY name ORDER BY total DESC LIMIT ${TOP_LIMIT}`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT d.Producto AS name,
                        COALESCE(SUM(d.Importe), 0) AS total,
                        COALESCE(SUM(d.Cantidad), 0) AS units
                 FROM tblDetalleCompras d
                 JOIN tblCompras c ON c.IdCompra = d.IdCompra
                 WHERE ${headerWhere}
                 GROUP BY name ORDER BY total DESC LIMIT ${TOP_LIMIT}`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT
                    COALESCE(SUM(i.Existencia * i.CostoPromedio), 0) AS valor,
                    SUM(CASE WHEN i.StockMinimo > 0 AND i.Existencia <= i.StockMinimo THEN 1 ELSE 0 END) AS bajoStock
                 FROM tblInventario i
                 WHERE 1 = 1${invBranch.clause}`,
                invBranch.params
            ),
            // Costo promedio vs precio de venta: dos medidas en la MISMA unidad ($),
            // por eso van en un solo eje como barras agrupadas (nunca doble eje).
            analyticsQuery(
                session.projectId,
                `SELECT q.Cuota AS name,
                        COALESCE(NULLIF(i.CostoPromedio, 0), q.Costo, 0) AS costo,
                        COALESCE(q.Precio, 0) AS precio
                 FROM tblInventario i
                 JOIN tblCuotas q ON q.IdCuota = i.IdCuota
                 WHERE q.TipoCuota = 2 AND q.Status = 0 AND i.Existencia > 0${invBranch.clause}
                 ORDER BY (COALESCE(q.Precio, 0) - COALESCE(NULLIF(i.CostoPromedio, 0), q.Costo, 0)) DESC
                 LIMIT ${TOP_LIMIT}`,
                invBranch.params
            )
        ]);

        const total = Number(totals[0]?.total) || 0;
        const prevTotal = Number(prevTotals[0]?.total) || 0;

        const partidas = topProducts.length;
        const unidades = topProducts.reduce((acc, row) => acc + (Number(row.units) || 0), 0);

        return NextResponse.json({
            period,
            empty: false,
            summary: {
                total,
                compras: Number(totals[0]?.compras) || 0,
                partidas,
                unidades,
                deltaTotal: percentDelta(total, prevTotal),
                valorInventario: Number(inventory[0]?.valor) || 0,
                bajoStock: Number(inventory[0]?.bajoStock) || 0
            },
            trend: trend.map((row) => ({ name: String(row.bucket), value: Number(row.total) || 0 })),
            topProviders: topProviders.map((row) => ({
                name: String(row.name),
                value: Number(row.total) || 0,
                compras: Number(row.compras) || 0
            })),
            topProducts: topProducts.map((row) => ({
                name: String(row.name),
                value: Number(row.total) || 0,
                units: Number(row.units) || 0
            })),
            costVsPrice: costVsPrice.map((row) => ({
                name: String(row.name),
                costo: Number(row.costo) || 0,
                precio: Number(row.precio) || 0
            }))
        });
    } catch (error: any) {
        console.error('GET Purchases analytics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
