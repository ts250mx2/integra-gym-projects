import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID, projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectUuid =
            searchParams.get('UUIDProject') ||
            searchParams.get('uuidProject') ||
            searchParams.get('projectUuid');

        if (!projectUuid) {
            return NextResponse.json(
                { error: 'UUIDProject is required' },
                { status: 400 }
            );
        }

        let project;
        try {
            project = await getProjectByUUID(projectUuid);
        } catch {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectId = project.IdProyecto;

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        const todayStart = `${yyyy}-${mm}-${dd} 00:00:00`;
        const todayEnd = `${yyyy}-${mm}-${dd} 23:59:59`;
        const monthStart = `${yyyy}-${mm}-01 00:00:00`;
        const monthEnd = `${yyyy}-${mm}-${dd} 23:59:59`;

        const [ventasHoyData, ventasMesData, visitasHoyData, sociosActivosData, ventasPorMesData] =
            await Promise.all([
                projectQuery(
                    projectId,
                    `SELECT
                        COALESCE(SUM(total), 0) AS total,
                        COUNT(IdMovimiento) AS operaciones
                     FROM tblMovimientos
                     WHERE Status = 0
                       AND FechaMovimiento BETWEEN ? AND ?`,
                    [todayStart, todayEnd]
                ) as Promise<any[]>,
                projectQuery(
                    projectId,
                    `SELECT
                        COALESCE(SUM(total), 0) AS total,
                        COUNT(IdMovimiento) AS operaciones
                     FROM tblMovimientos
                     WHERE Status = 0
                       AND FechaMovimiento BETWEEN ? AND ?`,
                    [monthStart, monthEnd]
                ) as Promise<any[]>,
                projectQuery(
                    projectId,
                    `SELECT COUNT(IdVisita) AS visitas
                     FROM tblVisitas
                     WHERE FechaVisita BETWEEN ? AND ?`,
                    [todayStart, todayEnd]
                ) as Promise<any[]>,
                projectQuery(
                    projectId,
                    `SELECT COUNT(IdSocio) AS sociosActivos
                     FROM tblSocios
                     WHERE Status = 0
                       AND FechaVencimiento >= CURDATE()`,
                    []
                ) as Promise<any[]>,
                projectQuery(
                    projectId,
                    `SELECT
                        DATE_FORMAT(FechaMovimiento, '%Y-%m') AS mes,
                        CONCAT(DATE_FORMAT(FechaMovimiento, '%M'), ' ', YEAR(FechaMovimiento)) AS mesNombre,
                        YEAR(FechaMovimiento) AS anio,
                        MONTH(FechaMovimiento) AS numMes,
                        COALESCE(SUM(total), 0) AS total,
                        COUNT(IdMovimiento) AS operaciones
                     FROM tblMovimientos
                     WHERE Status = 0
                       AND FechaMovimiento >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
                     GROUP BY anio, numMes, mes, mesNombre
                     ORDER BY anio ASC, numMes ASC`,
                    []
                ) as Promise<any[]>,
            ]);

        const ventasHoy = Number(ventasHoyData[0]?.total) || 0;
        const operacionesHoy = Number(ventasHoyData[0]?.operaciones) || 0;
        const ventasMes = Number(ventasMesData[0]?.total) || 0;
        const operacionesMes = Number(ventasMesData[0]?.operaciones) || 0;
        const visitasHoy = Number(visitasHoyData[0]?.visitas) || 0;
        const sociosActivos = Number(sociosActivosData[0]?.sociosActivos) || 0;

        const fmtMoney = new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        const fmtInt = new Intl.NumberFormat('es-MX');

        const fechaLarga = now.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });

        const mensaje =
            `📊 *${project.Proyecto}*\n` +
            `_${fechaLarga}_\n\n` +
            `El día de hoy vendimos *${fmtMoney.format(ventasHoy)}* en *${fmtInt.format(operacionesHoy)}* tickets, ` +
            `al día de hoy tenemos *${fmtInt.format(sociosActivos)}* socios activos ` +
            `y tuvimos *${fmtInt.format(visitasHoy)}* visitas.\n\n` +
            `💰 Ventas del mes: *${fmtMoney.format(ventasMes)}* (${fmtInt.format(operacionesMes)} tickets)`;

        return NextResponse.json({
            mensaje,
            project: {
                uuid: projectUuid,
                nombre: project.Proyecto,
            },
            fecha: `${yyyy}-${mm}-${dd}`,
            ventasHoy,
            operacionesHoy,
            ventasMes,
            operacionesMes,
            visitasHoy,
            sociosActivos,
            ventasPorMes: ventasPorMesData.map((r: any) => ({
                mes: r.mes,
                mesNombre: r.mesNombre,
                anio: Number(r.anio),
                numMes: Number(r.numMes),
                total: Number(r.total) || 0,
                operaciones: Number(r.operaciones) || 0,
            })),
        });
    } catch (error: any) {
        console.error('[public/project-stats] error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', detail: error?.message },
            { status: 500 }
        );
    }
}
