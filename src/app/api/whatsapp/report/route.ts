import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/whatsapp/report?r=<uuid>
 *
 * Devuelve el reporte (tablas + gráficas) que generó el agente de WhatsApp,
 * guardado en BDIntegraProjects.tblWhatsappReportes. Público por UUID — el UUID
 * no es adivinable, igual que las páginas de pago/recorrido.
 */
export async function GET(req: Request) {
    try {
        const uuid = new URL(req.url).searchParams.get('r');
        if (!uuid) {
            return NextResponse.json({ error: 'Falta el parámetro r (uuid)' }, { status: 400 });
        }

        const rows = await query(
            `SELECT r.IdProyecto, r.Pregunta, r.Respuesta, r.Titulo, r.Datos, r.FechaAct, p.Proyecto
             FROM tblWhatsappReportes r
             LEFT JOIN tblProyectos p ON r.IdProyecto = p.IdProyecto
             WHERE r.UUID = ? LIMIT 1`,
            [uuid]
        ) as any[];

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
        }

        const row = rows[0];
        let datos: any = {};
        try { datos = JSON.parse(row.Datos || '{}'); } catch { datos = {}; }

        return NextResponse.json({
            title: row.Titulo || datos.title || null,
            question: row.Pregunta || '',
            answer: row.Respuesta || '',
            gymName: row.Proyecto || '',
            fecha: row.FechaAct,
            tables: Array.isArray(datos.tables) ? datos.tables : [],
            charts: Array.isArray(datos.charts) ? datos.charts : [],
            insights: Array.isArray(datos.insights) ? datos.insights : [],
        });
    } catch (e: any) {
        console.error('[whatsapp/report] error:', e);
        return NextResponse.json({ error: 'Error al cargar el reporte', detail: e?.message }, { status: 500 });
    }
}
