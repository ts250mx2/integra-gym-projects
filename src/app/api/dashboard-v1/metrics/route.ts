import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const growthMode = searchParams.get('growthMode') || 'total'; // 'total' or 'mtd'
        const gender = searchParams.get('gender') || 'all'; // 'all', 'men', 'women'

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        // 1. Ventas, Operaciones & Ticket Promedio
        const salesQuery = `
            SELECT 
                SUM(total) as totalVentas,
                COUNT(IdMovimiento) as operaciones,
                CASE WHEN COUNT(IdMovimiento) > 0 THEN SUM(total)/COUNT(IdMovimiento) ELSE 0 END AS TicketPromedio
            FROM tblMovimientos
            WHERE Status = 0
            AND FechaMovimiento >= ? 
            AND FechaMovimiento <= ?
        `;
        const salesData = await projectQuery(session.projectId, salesQuery, [`${startDate} 00:00:00`, `${endDate} 23:59:59`]) as any[];

        // 2. Visitas
        const visitsQuery = `
            SELECT COUNT(IdVisita) as visitas
            FROM tblVisitas
            WHERE FechaVisita BETWEEN ? AND ?
        `;
        const visitsData = await projectQuery(session.projectId, visitsQuery, [`${startDate} 00:00:00`, `${endDate} 23:59:59`]) as any[];

        // Calculate average visits per day
        const dStart = new Date(startDate);
        const dEnd = new Date(endDate);
        const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
        const totalVisits = visitsData[0]?.visitas || 0;
        const avgVisits = diffDays > 0 ? (totalVisits / diffDays).toFixed(1) : totalVisits;

        // 3. Socios Activos (Status = 0 and Vencimiento >= today)
        const activeMembersQuery = `
            SELECT COUNT(IdSocio) as sociosActivos
            FROM tblSocios
            WHERE Status = 0
            AND FechaVencimiento >= CURDATE()
        `;
        const activeMembersData = await projectQuery(session.projectId, activeMembersQuery, []) as any[];

        // 4. Sales Growth Calculation (Month-to-Date vs Previous Month-to-Date)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();

        // Current MTD range: YYYY-MM-01 00:00:00 to Today 23:59:59
        const mtdStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01 00:00:00`;
        const mtdEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')} 23:59:59`;

        // Previous MTD range: Same days but for the previous month
        const prevMonthDate = new Date(currentYear, currentMonth - 2, currentDay);
        const lmtdYear = prevMonthDate.getFullYear();
        const lmtdMonth = prevMonthDate.getMonth() + 1;
        const lmtdStart = `${lmtdYear}-${String(lmtdMonth).padStart(2, '0')}-01 00:00:00`;
        const lmtdEnd = `${lmtdYear}-${String(lmtdMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')} 23:59:59`;

        const growthQuery = `
            SELECT 
                (SELECT SUM(total) FROM tblMovimientos WHERE Status = 0 AND FechaMovimiento >= ? AND FechaMovimiento <= ?) as mtd,
                (SELECT SUM(total) FROM tblMovimientos WHERE Status = 0 AND FechaMovimiento >= ? AND FechaMovimiento <= ?) as lmtd
        `;
        const growthData = await projectQuery(session.projectId, growthQuery, [mtdStart, mtdEnd, lmtdStart, lmtdEnd]) as any[];

        const mtdVal = growthData[0]?.mtd || 0;
        const lmtdVal = growthData[0]?.lmtd || 0;
        let diffPercent = 0;
        if (lmtdVal > 0) {
            diffPercent = ((mtdVal - lmtdVal) / lmtdVal) * 100;
        } else if (mtdVal > 0) {
            diffPercent = 100; // From 0 to something
        }

        // 5. Sales by Branch
        const branchSalesQuery = `
            SELECT 
                COALESCE(s.Sucursal, 'Sin Sucursal') as name,
                m.IdSucursal,
                SUM(m.total) as total,
                COUNT(m.IdMovimiento) as operaciones,
                CASE WHEN COUNT(m.IdMovimiento) > 0 THEN SUM(m.total)/COUNT(m.IdMovimiento) ELSE 0 END as ticketPromedio
            FROM tblMovimientos m
            LEFT JOIN tblSucursales s ON m.IdSucursal = s.IdSucursal
            WHERE m.Status = 0
            AND m.FechaMovimiento >= ? 
            AND m.FechaMovimiento <= ?
            GROUP BY s.Sucursal, m.IdSucursal
            ORDER BY total DESC
        `;
        const branchSalesData = await projectQuery(session.projectId, branchSalesQuery, [`${startDate} 00:00:00`, `${endDate} 23:59:59`]) as any[];

        // 6. Monthly History (for Growth View)
        const prevYearStart = `${currentYear - 1}-01-01 00:00:00`;

        const historyQuery = `
            SELECT 
                DATE_FORMAT(FechaMovimiento, '%m-%Y') as monthId,
                CONCAT(DATE_FORMAT(FechaMovimiento, '%M'), ' ', YEAR(FechaMovimiento)) as MesTexto,
                SUM(total) as Total,
                YEAR(FechaMovimiento) as year_num,
                MONTH(FechaMovimiento) as month_num
            FROM tblMovimientos
            WHERE Status = 0 
            AND FechaMovimiento >= ?
            ${growthMode === 'mtd' ? 'AND DAY(FechaMovimiento) <= DAY(Now())' : ''}
            GROUP BY YEAR(FechaMovimiento), MONTH(FechaMovimiento), MesTexto, monthId
            ORDER BY year_num ASC, month_num ASC
        `;
        const historyData = await projectQuery(session.projectId, historyQuery, [prevYearStart]) as any[];

        // 7. Visits Heatmap (Day vs Hour)
        let visitsHeatmapData: any[] = [];
        try {
            let genderFilter = '';
            let genderJoin = '';

            if (gender === 'men') {
                genderJoin = 'INNER JOIN tblSocios B ON A.IdSocio = B.IdSocio';
                genderFilter = 'AND B.Sexo IN (0, 1)';
            } else if (gender === 'women') {
                genderJoin = 'INNER JOIN tblSocios B ON A.IdSocio = B.IdSocio';
                genderFilter = 'AND B.Sexo = 2';
            }

            const visitsHeatmapQuery = `
                SELECT 
                    DAYOFWEEK(A.FechaVisita) as dayOfWeek,
                    HOUR(A.FechaVisita) as hourOfDay,
                    COUNT(A.IdVisita) as count
                FROM tblVisitas A
                ${genderJoin}
                WHERE A.FechaVisita BETWEEN ? AND ?
                ${genderFilter}
                GROUP BY dayOfWeek, hourOfDay
                ORDER BY dayOfWeek, hourOfDay
            `;
            visitsHeatmapData = await projectQuery(session.projectId, visitsHeatmapQuery, [`${startDate} 00:00:00`, `${endDate} 23:59:59`]) as any[];
        } catch (vhError) {
            console.error('Error fetching visits heatmap:', vhError);
            // Fallback to empty if join fails or table missing
            visitsHeatmapData = [];
        }

        // 8. Active Members History (Timeline)
        // Range: Today - 30 days to Today + 30 days
        const timelineStart = new Date();
        timelineStart.setHours(0, 0, 0, 0);
        timelineStart.setDate(timelineStart.getDate() - 30);

        const amHistoryQuery = `
            SELECT 
                DATE_FORMAT(S.FechaVencimiento, '%Y-%m-%d') as vDate, 
                COALESCE(B.Sucursal, 'Sin Sucursal') as branch,
                COUNT(*) as qty
            FROM tblSocios S
            LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal
            WHERE S.Status = 0
            AND S.FechaVencimiento IS NOT NULL
            AND S.FechaVencimiento != '0000-00-00'
            GROUP BY vDate, branch
            ORDER BY vDate ASC
        `;
        let amData: any[] = [];
        try {
            console.log(`[Metrics V1] Fetching active members history for Project: ${session.projectId}`);
            amData = await projectQuery(session.projectId, amHistoryQuery, []) as any[];
            if (!Array.isArray(amData)) {
                console.warn('[Metrics V1] amData is not an array:', amData);
                amData = [];
            }
            console.log(`[Metrics V1] amData rows: ${amData.length}. Sample:`, amData.slice(0, 3));
        } catch (e: any) {
            console.error('[Metrics V1] Error fetching amData:', e.message);
            amData = [];
        }

        const uniqueBranches = Array.from(new Set(amData.map(r => r.branch || 'Sin Sucursal')));

        const activeMembersHistory = [];
        for (let i = 0; i <= 60; i++) {
            const d = new Date(timelineStart);
            d.setDate(d.getDate() + i);
            const dStr = d.toISOString().split('T')[0];

            const point: any = {
                date: dStr,
                label: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
            };

            let totalCount = 0;
            uniqueBranches.forEach(branch => {
                const branchCount = amData.reduce((acc, curr) => {
                    const rowDate = curr.vDate || curr.vdate;
                    const rowBranch = curr.branch || 'Sin Sucursal';
                    if (rowBranch === branch && rowDate && rowDate >= dStr) {
                        return acc + (Number(curr.qty) || 0);
                    }
                    return acc;
                }, 0);
                point[branch] = branchCount;
                totalCount += branchCount;
            });

            point.count = totalCount;
            activeMembersHistory.push(point);
        }

        console.log(`[Metrics V1] Timeline generated: ${activeMembersHistory.length} points.`);

        // 9. Members Expiring This Month
        // Reuse variables declared earlier in the scope
        const expiringQuery = `
            SELECT S.Nombres as name, S.FechaVencimiento as expiry, B.Sucursal as branch
            FROM tblSocios S
            LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal
            WHERE S.Status = 0
            AND MONTH(S.FechaVencimiento) = ?
            AND YEAR(S.FechaVencimiento) = ?
            ORDER BY S.FechaVencimiento ASC
            LIMIT 200
        `;
        let expiringMembers: any[] = [];
        try {
            expiringMembers = await projectQuery(session.projectId, expiringQuery, [currentMonth, currentYear]) as any[];
        } catch (e: any) {
            console.error('[Metrics V1] Error fetching expiringMembers:', e.message);
        }

        return NextResponse.json({
            ventas: salesData[0]?.totalVentas || 0,
            operaciones: salesData[0]?.operaciones || 0,
            ticketPromedio: salesData[0]?.TicketPromedio || 0,
            visitas: visitsData[0]?.visitas || 0,
            promedioVisitas: avgVisits,
            sociosActivos: activeMembersData[0]?.sociosActivos || 0,
            growth: {
                mtd: mtdVal,
                lmtd: lmtdVal,
                percent: diffPercent
            },
            branchSales: branchSalesData,
            monthlyHistory: historyData,
            visitsHeatmap: visitsHeatmapData,
            activeMembersHistory: activeMembersHistory,
            expiringMembers: expiringMembers
        });

    } catch (error: any) {
        console.error('Error fetching V1.0 metrics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
