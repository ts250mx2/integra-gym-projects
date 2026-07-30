import { NextRequest, NextResponse } from 'next/server';
import {
    analyticsQuery,
    branchFilter,
    getAnalyticsSession,
    getProjectSource
} from '@/lib/analytics/source';
import { percentDelta, periodBounds, resolvePeriod } from '@/lib/analytics/period';

const TOP_LIMIT = 10;

export async function GET(req: NextRequest) {
    try {
        const session = await getAnalyticsSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const period = resolvePeriod(searchParams);
        const { sales } = await getProjectSource(session.projectId);

        const [from, to] = periodBounds(period.from, period.to);
        const [prevFrom, prevTo] = periodBounds(period.prevFrom, period.prevTo);
        const branch = branchFilter(session.branchId, 'h');

        // Encabezados vivos del periodo (Status <> 2 = no cancelada).
        const headerWhere = `h.Status <> 2 AND h.${sales.dateCol} BETWEEN ? AND ?${branch.clause}`;

        // DATE_FORMAT y no DATE(): DATE() regresa un objeto Date de JS que al
        // serializarse queda como "Sat May 02 2026 00:00:00 GMT-0600…" y rompe
        // las etiquetas del eje. Aqui el bucket tiene que viajar como string.
        const dateExpr = period.grain === 'month'
            ? `DATE_FORMAT(h.${sales.dateCol}, '%Y-%m')`
            : `DATE_FORMAT(h.${sales.dateCol}, '%Y-%m-%d')`;

        const [totals, prevTotals, trend, topProducts, mix, byPayment, byBranch] = await Promise.all([
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(SUM(h.Total), 0) AS total, COUNT(*) AS tickets
                 FROM ${sales.header} h
                 WHERE ${headerWhere}`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(SUM(h.Total), 0) AS total, COUNT(*) AS tickets
                 FROM ${sales.header} h
                 WHERE ${headerWhere}`,
                [prevFrom, prevTo, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT ${dateExpr} AS bucket, COALESCE(SUM(h.Total), 0) AS total, COUNT(*) AS tickets
                 FROM ${sales.header} h
                 WHERE ${headerWhere}
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT
                    COALESCE(NULLIF(d.${sales.productCol}, ''), c.Cuota, 'Sin nombre') AS name,
                    COALESCE(SUM(d.Precio * COALESCE(d.Cantidad, 1)), 0) AS total,
                    COALESCE(SUM(COALESCE(d.Cantidad, 1)), 0) AS units
                 FROM ${sales.detail} d
                 JOIN ${sales.header} h ON h.${sales.headerId} = d.${sales.headerId} AND h.IdSucursal = d.IdSucursal
                 LEFT JOIN tblCuotas c ON c.IdCuota = d.IdCuota
                 WHERE ${headerWhere}
                 GROUP BY name
                 ORDER BY total DESC
                 LIMIT ${TOP_LIMIT}`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT
                    CASE WHEN d.TipoCuota = 2 THEN 'productos' ELSE 'membresias' END AS kind,
                    COALESCE(SUM(d.Precio * COALESCE(d.Cantidad, 1)), 0) AS total,
                    COALESCE(SUM(COALESCE(d.Cantidad, 1)), 0) AS units
                 FROM ${sales.detail} d
                 JOIN ${sales.header} h ON h.${sales.headerId} = d.${sales.headerId} AND h.IdSucursal = d.IdSucursal
                 WHERE ${headerWhere}
                 GROUP BY kind`,
                [from, to, ...branch.params]
            ),
            // Nota: en BDs v1 la suma de pagos puede quedar unos puntos arriba del
            // total del encabezado (abonos y anticipos aplicados a movimientos de
            // otra fecha). Medido en Clandestino Gym 2025: +4.6%. Pago es la
            // columna que mas se acerca; TotalPago y Pago-Comision se alejan.
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(f.FormaPago, 'Sin especificar') AS name, COALESCE(SUM(p.Pago), 0) AS total
                 FROM ${sales.payments} p
                 JOIN ${sales.header} h ON h.${sales.headerId} = p.${sales.headerId} AND h.IdSucursal = p.IdSucursal
                 LEFT JOIN tblFormasPago f ON f.IdFormaPago = p.IdFormaPago
                 WHERE ${headerWhere}
                 GROUP BY name
                 ORDER BY total DESC`,
                [from, to, ...branch.params]
            ),
            analyticsQuery(
                session.projectId,
                `SELECT COALESCE(s.Sucursal, CONCAT('Sucursal ', h.IdSucursal)) AS name,
                        COALESCE(SUM(h.Total), 0) AS total
                 FROM ${sales.header} h
                 LEFT JOIN tblSucursales s ON s.IdSucursal = h.IdSucursal
                 WHERE ${headerWhere}
                 GROUP BY name
                 ORDER BY total DESC`,
                [from, to, ...branch.params]
            )
        ]);

        const total = Number(totals[0]?.total) || 0;
        const tickets = Number(totals[0]?.tickets) || 0;
        const prevTotal = Number(prevTotals[0]?.total) || 0;
        const prevTickets = Number(prevTotals[0]?.tickets) || 0;

        const avgTicket = tickets > 0 ? total / tickets : 0;
        const prevAvgTicket = prevTickets > 0 ? prevTotal / prevTickets : 0;

        const units = mix.reduce((acc, row) => acc + (Number(row.units) || 0), 0);

        return NextResponse.json({
            period,
            source: sales.kind,
            summary: {
                total,
                tickets,
                avgTicket,
                units,
                deltaTotal: percentDelta(total, prevTotal),
                deltaTickets: percentDelta(tickets, prevTickets),
                deltaAvgTicket: percentDelta(avgTicket, prevAvgTicket),
                prevTotal
            },
            trend: trend.map((row) => ({
                name: String(row.bucket),
                value: Number(row.total) || 0,
                tickets: Number(row.tickets) || 0
            })),
            topProducts: topProducts.map((row) => ({
                name: String(row.name),
                value: Number(row.total) || 0,
                units: Number(row.units) || 0
            })),
            mix: {
                membresias: Number(mix.find((row) => row.kind === 'membresias')?.total) || 0,
                productos: Number(mix.find((row) => row.kind === 'productos')?.total) || 0
            },
            byPayment: byPayment.map((row) => ({ name: String(row.name), value: Number(row.total) || 0 })),
            byBranch: byBranch.map((row) => ({ name: String(row.name), value: Number(row.total) || 0 }))
        });
    } catch (error: any) {
        console.error('GET Sales analytics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
