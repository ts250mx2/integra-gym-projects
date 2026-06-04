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
        const branchIdParam = searchParams.get('branchId') || 'all';

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        let targetProjectId: number | null = null;
        let bypassVirtual = false;

        if (branchIdParam !== 'all') {
            const tokens = branchIdParam.split(',');
            const uniqueProjectIds = new Set<number>();
            for (const token of tokens) {
                if (token.includes('_')) {
                    const [pIdStr] = token.split('_');
                    const pId = parseInt(pIdStr, 10);
                    if (!isNaN(pId)) {
                        uniqueProjectIds.add(pId);
                    }
                }
            }
            if (uniqueProjectIds.size === 1) {
                targetProjectId = Array.from(uniqueProjectIds)[0];
                bypassVirtual = true;
            } else if (uniqueProjectIds.size === 0) {
                targetProjectId = session.projectId;
                bypassVirtual = true;
            }
        }

        const projectIdToQuery = targetProjectId !== null ? targetProjectId : session.projectId;
        const querySuffix = `/*SELECTED_BRANCHES:${branchIdParam}*/`;

        // 1. Ventas, Operaciones & Ticket Promedio
        const salesQuery = `
            SELECT 
                SUM(M.total) as totalVentas,
                COUNT(M.IdMovimiento) as operaciones,
                CASE WHEN COUNT(M.IdMovimiento) > 0 THEN SUM(M.total)/COUNT(M.IdMovimiento) ELSE 0 END AS TicketPromedio
            FROM tblMovimientos M
            LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal
            WHERE M.Status = 0
            AND (S.Status IS NULL OR S.Status != 2)
            AND M.FechaMovimiento >= ? 
            AND M.FechaMovimiento <= ?
            /*BRANCH_FILTER_S*/
        ` + querySuffix;
        const salesParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        const salesData = await projectQuery(projectIdToQuery, salesQuery, salesParams, undefined, bypassVirtual) as any[];

        // 2. Visitas
        const visitsQuery = `
            SELECT COUNT(V.IdVisita) as visitas
            FROM tblVisitas V
            LEFT JOIN tblSucursales S ON V.IdSucursal = S.IdSucursal
            WHERE V.FechaVisita BETWEEN ? AND ?
            AND (S.Status IS NULL OR S.Status != 2)
            /*BRANCH_FILTER_S*/
        ` + querySuffix;
        const visitsParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        const visitsData = await projectQuery(projectIdToQuery, visitsQuery, visitsParams, undefined, bypassVirtual) as any[];

        // Calculate average visits per day
        const dStart = new Date(startDate);
        const dEnd = new Date(endDate);
        const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
        const totalVisits = visitsData[0]?.visitas || 0;
        const avgVisits = diffDays > 0 ? (totalVisits / diffDays).toFixed(1) : totalVisits;

        // 3. Socios Activos (Status = 0 and Vencimiento >= today)
        const activeMembersQuery = `
            SELECT COUNT(S.IdSocio) as sociosActivos
            FROM tblSocios S
            LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal
            WHERE S.Status = 0
            AND S.FechaVencimiento >= CURDATE()
            AND (B.Status IS NULL OR B.Status != 2)
            /*BRANCH_FILTER_S*/
        ` + querySuffix;
        const activeMembersParams: any[] = [];
        const activeMembersData = await projectQuery(projectIdToQuery, activeMembersQuery, activeMembersParams, undefined, bypassVirtual) as any[];

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
                (SELECT SUM(M.total) FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND M.FechaMovimiento >= ? AND M.FechaMovimiento <= ? AND (S.Status IS NULL OR S.Status != 2) /*BRANCH_FILTER_S*/) as mtd,
                (SELECT SUM(M.total) FROM tblMovimientos M LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal WHERE M.Status = 0 AND M.FechaMovimiento >= ? AND M.FechaMovimiento <= ? AND (S.Status IS NULL OR S.Status != 2) /*BRANCH_FILTER_S*/) as lmtd
        ` + querySuffix;
        const growthParams = [
            mtdStart, mtdEnd,
            lmtdStart, lmtdEnd
        ];
        const growthData = await projectQuery(projectIdToQuery, growthQuery, growthParams, undefined, bypassVirtual) as any[];

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
            AND (s.Status IS NULL OR s.Status != 2)
            AND m.FechaMovimiento >= ? 
            AND m.FechaMovimiento <= ?
            /*BRANCH_FILTER_M*/
            GROUP BY s.Sucursal, m.IdSucursal
            ORDER BY total DESC
        ` + querySuffix;
        const branchSalesParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        const branchSalesData = await projectQuery(projectIdToQuery, branchSalesQuery, branchSalesParams, undefined, bypassVirtual) as any[];

        // 6. Monthly History (for Growth View)
        const prevYearStart = `${currentYear - 1}-01-01 00:00:00`;

        const historyQuery = `
            SELECT 
                DATE_FORMAT(M.FechaMovimiento, '%m-%Y') as monthId,
                CONCAT(DATE_FORMAT(M.FechaMovimiento, '%M'), ' ', YEAR(M.FechaMovimiento)) as MesTexto,
                SUM(M.total) as Total,
                YEAR(M.FechaMovimiento) as year_num,
                MONTH(M.FechaMovimiento) as month_num
            FROM tblMovimientos M
            LEFT JOIN tblSucursales S ON M.IdSucursal = S.IdSucursal
            WHERE M.Status = 0 
            AND M.FechaMovimiento >= ?
            AND (S.Status IS NULL OR S.Status != 2)
            /*BRANCH_FILTER_S*/
            ${growthMode === 'mtd' ? 'AND DAY(M.FechaMovimiento) <= DAY(Now())' : ''}
            GROUP BY YEAR(M.FechaMovimiento), MONTH(M.FechaMovimiento), MesTexto, monthId
            ORDER BY year_num ASC, month_num ASC
        ` + querySuffix;
        const historyParams = [prevYearStart];
        const historyData = await projectQuery(projectIdToQuery, historyQuery, historyParams, undefined, bypassVirtual) as any[];

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
                LEFT JOIN tblSucursales S ON A.IdSucursal = S.IdSucursal
                ${genderJoin}
                WHERE A.FechaVisita BETWEEN ? AND ?
                AND (S.Status IS NULL OR S.Status != 2)
                ${genderFilter}
                /*BRANCH_FILTER_S*/
                GROUP BY dayOfWeek, hourOfDay
                ORDER BY dayOfWeek, hourOfDay
            ` + querySuffix;
            const visitsHeatmapParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
            visitsHeatmapData = await projectQuery(projectIdToQuery, visitsHeatmapQuery, visitsHeatmapParams, undefined, bypassVirtual) as any[];
        } catch (vhError) {
            console.error('Error fetching visits heatmap:', vhError);
            visitsHeatmapData = [];
        }

        // 8. Active Members History (Timeline)
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
            AND (B.Status IS NULL OR B.Status != 2)
            /*BRANCH_FILTER_S*/
            GROUP BY vDate, branch
            ORDER BY vDate ASC
        ` + querySuffix;
        let amData: any[] = [];
        try {
            console.log(`[Metrics V1] Fetching active members history for Project: ${projectIdToQuery}`);
            const amHistoryParams: any[] = [];
            amData = await projectQuery(projectIdToQuery, amHistoryQuery, amHistoryParams, undefined, bypassVirtual) as any[];
            if (!Array.isArray(amData)) {
                console.warn('[Metrics V1] amData is not an array:', amData);
                amData = [];
            }
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

        // 9. Members Expiring This Month
        const expiringQuery = `
            SELECT S.Nombres as name, S.FechaVencimiento as expiry, B.Sucursal as branch
            FROM tblSocios S
            LEFT JOIN tblSucursales B ON S.IdSucursal = B.IdSucursal
            WHERE S.Status = 0
            AND MONTH(S.FechaVencimiento) = ?
            AND YEAR(S.FechaVencimiento) = ?
            AND (B.Status IS NULL OR B.Status != 2)
            /*BRANCH_FILTER_S*/
            ORDER BY S.FechaVencimiento ASC
            LIMIT 200
        ` + querySuffix;
        let expiringMembers: any[] = [];
        try {
            const expiringParams: any[] = [currentMonth, currentYear];
            expiringMembers = await projectQuery(projectIdToQuery, expiringQuery, expiringParams, undefined, bypassVirtual) as any[];
        } catch (e: any) {
            console.error('[Metrics V1] Error fetching expiringMembers:', e.message);
        }

        // 10. Additional Branch breakdowns (Growth & Visits)
        let branchGrowthData: any[] = [];
        try {
            const branchGrowthQuery = `
                SELECT 
                    COALESCE(s.Sucursal, 'Sin Sucursal') as name,
                    m.IdSucursal,
                    SUM(CASE WHEN m.FechaMovimiento >= ? AND m.FechaMovimiento <= ? THEN m.total ELSE 0 END) as mtd,
                    SUM(CASE WHEN m.FechaMovimiento >= ? AND m.FechaMovimiento <= ? THEN m.total ELSE 0 END) as lmtd
                FROM tblMovimientos m
                LEFT JOIN tblSucursales s ON m.IdSucursal = s.IdSucursal
                WHERE m.Status = 0
                AND (s.Status IS NULL OR s.Status != 2)
                /*BRANCH_FILTER_M*/
                GROUP BY s.Sucursal, m.IdSucursal
            ` + querySuffix;
            const branchGrowthParams = [mtdStart, mtdEnd, lmtdStart, lmtdEnd];
            const rawGrowth = await projectQuery(projectIdToQuery, branchGrowthQuery, branchGrowthParams, undefined, bypassVirtual) as any[];
            branchGrowthData = rawGrowth.map((r: any) => {
                const mtd = Number(r.mtd || 0);
                const lmtd = Number(r.lmtd || 0);
                let percent = 0;
                if (lmtd > 0) {
                    percent = ((mtd - lmtd) / lmtd) * 100;
                } else if (mtd > 0) {
                    percent = 100;
                }
                return {
                    name: r.name,
                    IdSucursal: r.IdSucursal,
                    mtd,
                    lmtd,
                    percent
                };
            }).sort((a, b) => b.percent - a.percent);
        } catch (e: any) {
            console.error('Error fetching branch growth:', e.message);
        }

        let branchVisitsData: any[] = [];
        try {
            const branchVisitsQuery = `
                SELECT 
                    COALESCE(s.Sucursal, 'Sin Sucursal') as name,
                    v.IdSucursal,
                    COUNT(v.IdVisita) as visits
                FROM tblVisitas v
                LEFT JOIN tblSucursales s ON v.IdSucursal = s.IdSucursal
                WHERE v.FechaVisita BETWEEN ? AND ?
                AND (s.Status IS NULL OR s.Status != 2)
                /*BRANCH_FILTER_V*/
                GROUP BY s.Sucursal, v.IdSucursal
                ORDER BY visits DESC
            ` + querySuffix;
            const branchVisitsParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
            branchVisitsData = await projectQuery(projectIdToQuery, branchVisitsQuery, branchVisitsParams, undefined, bypassVirtual) as any[];
        } catch (e: any) {
            console.error('Error fetching branch visits:', e.message);
        }

        // 11. All active branches (for the filter dropdown / checkboxes)
        let branchesList: any[] = [];
        try {
            const branchesQuery = `
                SELECT IdSucursal, Sucursal as name
                FROM tblSucursales
                WHERE Status != 2
                ORDER BY Sucursal ASC
            `;
            const rawBranches = await projectQuery(session.projectId, branchesQuery, []) as any[];
            branchesList = rawBranches.map((b: any) => ({
                id: b._IdProyecto ? `${b._IdProyecto}_${b.IdSucursal}` : `${session.projectId}_${b.IdSucursal}`,
                name: b.name
            }));
        } catch (e: any) {
            console.error('Error fetching branches list:', e.message);
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
            expiringMembers: expiringMembers,
            branchGrowth: branchGrowthData,
            branchVisits: branchVisitsData,
            branchesList: branchesList
        });

    } catch (error: any) {
        console.error('Error fetching V1.0 metrics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
