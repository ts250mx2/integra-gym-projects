import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { LayoutDashboard } from 'lucide-react';

import { projectQuery } from '@/lib/projectDb';
import { query } from '@/lib/db';
import RecentVisitsFeed from '@/components/RecentVisitsFeed';


export default async function DashboardPage(props: { searchParams: Promise<any> }) {
    const searchParams = await props.searchParams;
    const t = await getTranslations('Dashboard');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const session = JSON.parse(sessionCookie?.value || '{}');

    let todaySales = 0;
    let activeMembers = 0;
    let dailyVisits = 0;
    let employeeAttendance = 0;
    let gymLogo = null;
    let debugInfo: any = {};

    if (session.projectId && session.branchId) {
        try {
            const [salesResult, membersResult, visitsResult, attendanceResult] = await Promise.all([
                projectQuery(
                    session.projectId,
                    `SELECT SUM(Total) AS TotalVentas 
                     FROM tblVentas 
                     WHERE DATE(FechaVenta) = CURDATE() 
                     AND Status = 0 
                     AND IdSucursal = ?`,
                    [session.branchId]
                ) as Promise<any[]>,
                projectQuery(
                    session.projectId,
                    `SELECT COUNT(IdSocio) AS SociosActivos 
                     FROM tblSocios 
                     WHERE Status = 0 
                     AND IdSucursal = ? 
                     AND FechaVencimiento > NOW()`,
                    [session.branchId]
                ) as Promise<any[]>,
                projectQuery(
                    session.projectId,
                    `SELECT COUNT(IdVisita) AS Visitas 
                     FROM tblVisitas 
                     WHERE IdSocio > 0 
                     AND DATE(FechaVisita) = CURDATE() 
                     AND IdSucursal = ?`,
                    [session.branchId]
                ) as Promise<any[]>,
                projectQuery(
                    session.projectId,
                    `SELECT COUNT(IdVisita) AS Visitas 
                     FROM tblVisitas 
                     WHERE IdUsuario > 0 
                     AND DATE(FechaVisita) = CURDATE() 
                     AND IdSucursal = ?`,
                    [session.branchId]
                ) as Promise<any[]>
            ]);

            // Fetch Logo from Main DB
            const projectData = await query('SELECT ArchivoLogo FROM tblProyectos WHERE IdProyecto = ?', [session.projectId]) as any[];
            if (projectData.length > 0) {
                gymLogo = projectData[0].ArchivoLogo;
            }

            const lastSale = await projectQuery(session.projectId, 'SELECT MAX(FechaVenta) as LastDate, MAX(IdSucursal) as Branch FROM tblVentas', []) as any[];

            todaySales = salesResult[0]?.TotalVentas || 0;
            activeMembers = membersResult[0]?.SociosActivos || 0;
            dailyVisits = visitsResult[0]?.Visitas || 0;
            employeeAttendance = attendanceResult[0]?.Visitas || 0;

            // We need to fetch the logo from the MAIN database using `query`
            // NOTE: I cannot use `query` directly here easily if it's not imported.
            // Let's rely on an API call or a separate helper function?
            // Or just import `query` from `@/lib/db`.


            debugInfo = {
                branchId: session.branchId,
                projectId: session.projectId,
                salesCount: salesResult.length,
                rawSales: salesResult[0],
                lastSaleDate: lastSale[0]?.LastDate,
                lastSaleBranch: lastSale[0]?.Branch
            };
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
    }

    return (
        <div>
            <h1 className="neon-text" style={{
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
            }}>
                <LayoutDashboard size={32} />
                {t('title')}
            </h1>
            <p style={{ color: 'var(--light-gray)' }}>
                {t('welcome', { name: session.userName, gym: session.gymName })}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                {/* DEBUG INFO */}
                {searchParams?.Debug === '1' && (
                    <div style={{ gridColumn: '1 / -1', background: '#333', color: '#fff', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        <strong>Debug Info:</strong><br />
                        Branch: {debugInfo.branchId}<br />
                        Last Sale: {JSON.stringify(debugInfo.lastSaleDate)}<br />
                        Last Sale Branch: {debugInfo.lastSaleBranch}<br />
                        Raw Sales Result: {JSON.stringify(debugInfo.rawSales)}
                    </div>
                )}

                <div className="glass-card">
                    <h3 className="neon-text-blue">{t('todaySummary')}</h3>
                    <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 'bold' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaySales)}
                    </p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('dataFrom', { gym: session.gymName })}</p>
                </div>
                <div className="glass-card">
                    <h3 className="neon-text-blue">{t('members')}</h3>
                    <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 'bold' }}>{activeMembers}</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('totalMembers')}</p>
                </div>
                <div className="glass-card">
                    <h3 className="neon-text-blue">{t('visits')}</h3>
                    <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 'bold' }}>{dailyVisits}</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('dailyVisits')}</p>
                </div>
                <div className="glass-card">
                    <h3 className="neon-text-blue">{t('employeeAttendance')}</h3>
                    <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 'bold' }}>{employeeAttendance}</p>
                </div>
            </div>

            <RecentVisitsFeed gymName={session.gymName} gymLogo={gymLogo} />
        </div>
    );
}
