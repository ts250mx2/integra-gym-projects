import { NextRequest, NextResponse } from 'next/server';
import {
    analyticsQuery,
    branchFilter,
    getAnalyticsSession,
    getProjectSource
} from '@/lib/analytics/source';
import { percentDelta, periodBounds, resolvePeriod } from '@/lib/analytics/period';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const TOP_LIMIT = 10;

export async function GET(req: NextRequest) {
    try {
        const session = await getAnalyticsSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const period = resolvePeriod(searchParams);
        const { members, sales } = await getProjectSource(session.projectId);

        const [from, to] = periodBounds(period.from, period.to);
        const [prevFrom, prevTo] = periodBounds(period.prevFrom, period.prevTo);

        const socioBranch = branchFilter(session.branchId);
        const visitBranch = branchFilter(session.branchId, 'v');

        const joinCol = members.joinDateCol;
        // DATE_FORMAT y no DATE(): DATE() regresa un objeto Date que al
        // serializarse rompe las etiquetas del eje.
        const dateExpr = period.grain === 'month'
            ? `DATE_FORMAT(${joinCol}, '%Y-%m')`
            : `DATE_FORMAT(${joinCol}, '%Y-%m-%d')`;

        // Solo socios (IdSocio > 0); en v2 tblVisitas tambien guarda asistencia de personal.
        const memberVisitFilter = members.hasStaffVisits ? ' AND v.IdSocio > 0' : '';

        const [snapshot, newMembers, prevNewMembers, joinTrend, visitsByWeekday, visitsByHour, topMemberships, visitsTotal] =
            await Promise.all([
                analyticsQuery(
                    session.projectId,
                    `SELECT
                        COUNT(*) AS total,
                        SUM(CASE WHEN FechaVencimiento >= CURDATE() THEN 1 ELSE 0 END) AS activos,
                        SUM(CASE WHEN FechaVencimiento < CURDATE() THEN 1 ELSE 0 END) AS vencidos,
                        SUM(CASE WHEN FechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS porVencer
                     FROM tblSocios
                     WHERE Status = 0${socioBranch.clause}`,
                    socioBranch.params
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT COUNT(*) AS n FROM tblSocios
                     WHERE Status <> 2 AND ${joinCol} BETWEEN ? AND ?${socioBranch.clause}`,
                    [from, to, ...socioBranch.params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT COUNT(*) AS n FROM tblSocios
                     WHERE Status <> 2 AND ${joinCol} BETWEEN ? AND ?${socioBranch.clause}`,
                    [prevFrom, prevTo, ...socioBranch.params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT ${dateExpr} AS bucket, COUNT(*) AS n
                     FROM tblSocios
                     WHERE Status <> 2 AND ${joinCol} BETWEEN ? AND ?${socioBranch.clause}
                     GROUP BY bucket
                     ORDER BY bucket ASC`,
                    [from, to, ...socioBranch.params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT DAYOFWEEK(v.FechaVisita) AS dow, COUNT(*) AS n
                     FROM tblVisitas v
                     WHERE v.FechaVisita BETWEEN ? AND ?${memberVisitFilter}${visitBranch.clause}
                     GROUP BY dow
                     ORDER BY dow ASC`,
                    [from, to, ...visitBranch.params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT HOUR(v.FechaVisita) AS hour, COUNT(*) AS n
                     FROM tblVisitas v
                     WHERE v.FechaVisita BETWEEN ? AND ?${memberVisitFilter}${visitBranch.clause}
                     GROUP BY hour
                     ORDER BY hour ASC`,
                    [from, to, ...visitBranch.params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT
                        COALESCE(NULLIF(d.${sales.productCol}, ''), c.Cuota, 'Sin nombre') AS name,
                        COUNT(*) AS n
                     FROM ${sales.detail} d
                     JOIN ${sales.header} h ON h.${sales.headerId} = d.${sales.headerId} AND h.IdSucursal = d.IdSucursal
                     LEFT JOIN tblCuotas c ON c.IdCuota = d.IdCuota
                     WHERE h.Status <> 2 AND h.${sales.dateCol} BETWEEN ? AND ?
                       AND d.TipoCuota <> 2${branchFilter(session.branchId, 'h').clause}
                     GROUP BY name
                     ORDER BY n DESC
                     LIMIT ${TOP_LIMIT}`,
                    [from, to, ...branchFilter(session.branchId, 'h').params]
                ),
                analyticsQuery(
                    session.projectId,
                    `SELECT COUNT(*) AS n, COUNT(DISTINCT v.IdSocio) AS unicos
                     FROM tblVisitas v
                     WHERE v.FechaVisita BETWEEN ? AND ?${memberVisitFilter}${visitBranch.clause}`,
                    [from, to, ...visitBranch.params]
                )
            ]);

        const snap = snapshot[0] || {};
        const altas = Number(newMembers[0]?.n) || 0;
        const prevAltas = Number(prevNewMembers[0]?.n) || 0;

        // Todos los dias/horas presentes aunque no tengan visitas: un hueco en el
        // eje se lee como "cerrado", no como dato faltante.
        const weekdayMap = new Map(visitsByWeekday.map((row) => [Number(row.dow), Number(row.n) || 0]));
        const hourMap = new Map(visitsByHour.map((row) => [Number(row.hour), Number(row.n) || 0]));

        return NextResponse.json({
            period,
            summary: {
                activos: Number(snap.activos) || 0,
                vencidos: Number(snap.vencidos) || 0,
                total: Number(snap.total) || 0,
                porVencer: Number(snap.porVencer) || 0,
                altas,
                deltaAltas: percentDelta(altas, prevAltas),
                visitas: Number(visitsTotal[0]?.n) || 0,
                visitantesUnicos: Number(visitsTotal[0]?.unicos) || 0
            },
            joinTrend: joinTrend.map((row) => ({ name: String(row.bucket), value: Number(row.n) || 0 })),
            visitsByWeekday: WEEKDAYS.map((label, index) => ({
                name: label,
                value: weekdayMap.get(index + 1) || 0
            })),
            visitsByHour: Array.from({ length: 24 }, (_, hour) => ({
                name: `${String(hour).padStart(2, '0')}h`,
                value: hourMap.get(hour) || 0
            })),
            topMemberships: topMemberships.map((row) => ({ name: String(row.name), value: Number(row.n) || 0 }))
        });
    } catch (error: any) {
        console.error('GET Members analytics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
