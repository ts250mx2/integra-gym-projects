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

        const weekStartDate = new Date(now);
        weekStartDate.setHours(0, 0, 0, 0);
        const dow = weekStartDate.getDay();
        const diffToMonday = dow === 0 ? -6 : 1 - dow;
        weekStartDate.setDate(weekStartDate.getDate() + diffToMonday);
        const wY = weekStartDate.getFullYear();
        const wM = String(weekStartDate.getMonth() + 1).padStart(2, '0');
        const wD = String(weekStartDate.getDate()).padStart(2, '0');
        const weekStart = `${wY}-${wM}-${wD} 00:00:00`;
        const weekEndStr = todayEnd;

        const [
            ventasHoyData,
            ventasMesData,
            visitasHoyData,
            sociosActivosData,
            ventasSemanaData,
            visitasSemanaData,
        ] =
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
                        DATE(FechaMovimiento) AS dia,
                        COALESCE(SUM(total), 0) AS total,
                        COUNT(IdMovimiento) AS operaciones
                     FROM tblMovimientos
                     WHERE Status = 0
                       AND FechaMovimiento BETWEEN ? AND ?
                     GROUP BY dia
                     ORDER BY dia ASC`,
                    [weekStart, weekEndStr]
                ) as Promise<any[]>,
                projectQuery(
                    projectId,
                    `SELECT
                        DATE(FechaVisita) AS dia,
                        COUNT(IdVisita) AS visitas
                     FROM tblVisitas
                     WHERE FechaVisita BETWEEN ? AND ?
                     GROUP BY dia
                     ORDER BY dia ASC`,
                    [weekStart, weekEndStr]
                ) as Promise<any[]>,
            ]);

        const ventasHoy = Number(ventasHoyData[0]?.total) || 0;
        const operacionesHoy = Number(ventasHoyData[0]?.operaciones) || 0;
        const ventasMes = Number(ventasMesData[0]?.total) || 0;
        const operacionesMes = Number(ventasMesData[0]?.operaciones) || 0;
        const visitasHoy = Number(visitasHoyData[0]?.visitas) || 0;
        const sociosActivos = Number(sociosActivosData[0]?.sociosActivos) || 0;

        const toISO = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ventasSemanaMap = new Map<string, { total: number; operaciones: number }>();
        for (const r of ventasSemanaData as any[]) {
            const k = r.dia instanceof Date ? toISO(r.dia) : String(r.dia).substring(0, 10);
            ventasSemanaMap.set(k, {
                total: Number(r.total) || 0,
                operaciones: Number(r.operaciones) || 0,
            });
        }
        const visitasSemanaMap = new Map<string, number>();
        for (const r of visitasSemanaData as any[]) {
            const k = r.dia instanceof Date ? toISO(r.dia) : String(r.dia).substring(0, 10);
            visitasSemanaMap.set(k, Number(r.visitas) || 0);
        }

        const diasSemanaNombre = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const ventasPorDiaSemana: Array<{
            fecha: string;
            diaNombre: string;
            total: number;
            operaciones: number;
            visitas: number;
        }> = [];
        let ventasSemanaTotal = 0;
        let operacionesSemanaTotal = 0;
        let visitasSemanaTotal = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStartDate);
            d.setDate(d.getDate() + i);
            if (d > now) break;
            const key = toISO(d);
            const v = ventasSemanaMap.get(key) || { total: 0, operaciones: 0 };
            const vis = visitasSemanaMap.get(key) || 0;
            ventasPorDiaSemana.push({
                fecha: key,
                diaNombre: diasSemanaNombre[d.getDay()],
                total: v.total,
                operaciones: v.operaciones,
                visitas: vis,
            });
            ventasSemanaTotal += v.total;
            operacionesSemanaTotal += v.operaciones;
            visitasSemanaTotal += vis;
        }

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

        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const detalleSemana = ventasPorDiaSemana
            .map(
                (d) =>
                    `• ${cap(d.diaNombre)}: ${fmtMoney.format(d.total)} (${fmtInt.format(d.operaciones)} tickets, ${fmtInt.format(d.visitas)} visitas)`
            )
            .join('\n');

        const mensaje =
            `📊 *${project.Proyecto}*\n` +
            `_${fechaLarga}_\n\n` +
            `El día de hoy vendimos *${fmtMoney.format(ventasHoy)}* en *${fmtInt.format(operacionesHoy)}* tickets, ` +
            `al día de hoy tenemos *${fmtInt.format(sociosActivos)}* socios activos ` +
            `y tuvimos *${fmtInt.format(visitasHoy)}* visitas.\n\n` +
            `📅 *Semana en curso*\n` +
            `Llevamos *${fmtMoney.format(ventasSemanaTotal)}* en *${fmtInt.format(operacionesSemanaTotal)}* tickets ` +
            `y *${fmtInt.format(visitasSemanaTotal)}* visitas.\n` +
            `${detalleSemana}\n\n` +
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
            semana: {
                inicio: toISO(weekStartDate),
                fin: `${yyyy}-${mm}-${dd}`,
                ventas: ventasSemanaTotal,
                tickets: operacionesSemanaTotal,
                visitas: visitasSemanaTotal,
                porDia: ventasPorDiaSemana,
            },
        });
    } catch (error: any) {
        console.error('[public/project-stats] error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', detail: error?.message },
            { status: 500 }
        );
    }
}
