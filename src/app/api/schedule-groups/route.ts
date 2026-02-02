import { NextRequest, NextResponse } from 'next/server';
import { projectQuery } from '@/lib/projectDb';
import { cookies } from 'next/headers';

async function getSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    return JSON.parse(sessionCookie.value);
}

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rows = await projectQuery(session.projectId, `
            SELECT * FROM tblGruposHorarios
            WHERE Status = 0
            ORDER BY IdGrupoHorario ASC
        `) as any[];

        // Map columns back to Days array for frontend compatibility if needed, 
        // or just send rows and let frontend handle? 
        // The frontend expects a 'Days' array for the modal.
        // Let's construct it.
        const result = rows.map(row => {
            const days = [];
            // Map 0-6 to columns
            // 0: Domingo, 1: Lunes, ...
            const dayMap: any = {
                0: { start: row.DomingoHoraInicio, end: row.DomingoHoraFin },
                1: { start: row.LunesHoraInicio, end: row.LunesHoraFin },
                2: { start: row.MartesHoraInicio, end: row.MartesHoraFin },
                3: { start: row.MiercolesHoraInicio, end: row.MiercolesHoraFin },
                4: { start: row.JuevesHoraInicio, end: row.JuevesHoraFin },
                5: { start: row.ViernesHoraInicio, end: row.ViernesHoraFin },
                6: { start: row.SabadoHoraInicio, end: row.SabadoHoraFin }
            };

            for (let i = 0; i < 7; i++) {
                if (dayMap[i].start && dayMap[i].end) {
                    days.push({
                        DiaSemanaMySQL: i,
                        HoraEntrada: dayMap[i].start,
                        HoraSalida: dayMap[i].end
                    });
                }
            }

            return {
                ...row,
                Days: days
            };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching schedule groups:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { GrupoHorario, HoraInicio, HoraFin, TieneDias, Days } = body;

        // Get max ID
        const maxRows = await projectQuery(session.projectId, 'SELECT MAX(IdGrupoHorario) as maxId FROM tblGruposHorarios') as any[];
        const newId = (maxRows[0].maxId || 0) + 1;

        const now = new Date();

        // Prepare columns
        let lunesStart = null, lunesEnd = null;
        let martesStart = null, martesEnd = null;
        let miercolesStart = null, miercolesEnd = null;
        let juevesStart = null, juevesEnd = null;
        let viernesStart = null, viernesEnd = null;
        let sabadoStart = null, sabadoEnd = null;
        let domingoStart = null, domingoEnd = null;

        if (TieneDias === 1 && Days && Array.isArray(Days)) {
            for (const day of Days) {
                switch (day.DiaSemanaMySQL) {
                    case 1: lunesStart = day.HoraEntrada; lunesEnd = day.HoraSalida; break;
                    case 2: martesStart = day.HoraEntrada; martesEnd = day.HoraSalida; break;
                    case 3: miercolesStart = day.HoraEntrada; miercolesEnd = day.HoraSalida; break;
                    case 4: juevesStart = day.HoraEntrada; juevesEnd = day.HoraSalida; break;
                    case 5: viernesStart = day.HoraEntrada; viernesEnd = day.HoraSalida; break;
                    case 6: sabadoStart = day.HoraEntrada; sabadoEnd = day.HoraSalida; break;
                    case 0: domingoStart = day.HoraEntrada; domingoEnd = day.HoraSalida; break;
                }
            }
        }

        await projectQuery(session.projectId, `
            INSERT INTO tblGruposHorarios (
                IdGrupoHorario, GrupoHorario, HoraInicio, HoraFin, TieneDias, Status, FechaAct,
                LunesHoraInicio, LunesHoraFin, MartesHoraInicio, MartesHoraFin,
                MiercolesHoraInicio, MiercolesHoraFin, JuevesHoraInicio, JuevesHoraFin,
                ViernesHoraInicio, ViernesHoraFin, SabadoHoraInicio, SabadoHoraFin,
                DomingoHoraInicio, DomingoHoraFin,
                ModificadoLector1, ModificadoLector2, ModificadoLector3, ModificadoLector4, ModificadoLector5,
                ModificadoLector6, ModificadoLector7, ModificadoLector8, ModificadoLector9, ModificadoLector10
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        `, [
            newId, GrupoHorario, HoraInicio, HoraFin, TieneDias, now,
            lunesStart, lunesEnd, martesStart, martesEnd, miercolesStart, miercolesEnd,
            juevesStart, juevesEnd, viernesStart, viernesEnd, sabadoStart, sabadoEnd, domingoStart, domingoEnd
        ]);



        return NextResponse.json({ success: true, id: newId });
    } catch (error: any) {
        console.error('Error creating schedule group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdGrupoHorario, GrupoHorario, HoraInicio, HoraFin, TieneDias, Days } = body;

        if (IdGrupoHorario === 1 || IdGrupoHorario === 2) {
            return NextResponse.json({ error: 'Cannot edit system groups (ID 1 and 2)' }, { status: 403 });
        }

        const now = new Date();

        // Prepare columns
        let lunesStart = null, lunesEnd = null;
        let martesStart = null, martesEnd = null;
        let miercolesStart = null, miercolesEnd = null;
        let juevesStart = null, juevesEnd = null;
        let viernesStart = null, viernesEnd = null;
        let sabadoStart = null, sabadoEnd = null;
        let domingoStart = null, domingoEnd = null;

        if (TieneDias === 1 && Days && Array.isArray(Days)) {
            for (const day of Days) {
                switch (day.DiaSemanaMySQL) {
                    case 1: lunesStart = day.HoraEntrada; lunesEnd = day.HoraSalida; break;
                    case 2: martesStart = day.HoraEntrada; martesEnd = day.HoraSalida; break;
                    case 3: miercolesStart = day.HoraEntrada; miercolesEnd = day.HoraSalida; break;
                    case 4: juevesStart = day.HoraEntrada; juevesEnd = day.HoraSalida; break;
                    case 5: viernesStart = day.HoraEntrada; viernesEnd = day.HoraSalida; break;
                    case 6: sabadoStart = day.HoraEntrada; sabadoEnd = day.HoraSalida; break;
                    case 0: domingoStart = day.HoraEntrada; domingoEnd = day.HoraSalida; break;
                }
            }
        }

        await projectQuery(session.projectId, `
            UPDATE tblGruposHorarios SET
                GrupoHorario = ?,
                HoraInicio = ?,
                HoraFin = ?,
                TieneDias = ?,
                FechaAct = ?,
                LunesHoraInicio = ?, LunesHoraFin = ?,
                MartesHoraInicio = ?, MartesHoraFin = ?,
                MiercolesHoraInicio = ?, MiercolesHoraFin = ?,
                JuevesHoraInicio = ?, JuevesHoraFin = ?,
                ViernesHoraInicio = ?, ViernesHoraFin = ?,
                SabadoHoraInicio = ?, SabadoHoraFin = ?,
                DomingoHoraInicio = ?, DomingoHoraFin = ?,
                ModificadoLector1 = 1, ModificadoLector2 = 1, ModificadoLector3 = 1, ModificadoLector4 = 1, ModificadoLector5 = 1,
                ModificadoLector6 = 1, ModificadoLector7 = 1, ModificadoLector8 = 1, ModificadoLector9 = 1, ModificadoLector10 = 1
            WHERE IdGrupoHorario = ?
        `, [
            GrupoHorario, HoraInicio, HoraFin, TieneDias, now,
            lunesStart, lunesEnd, martesStart, martesEnd, miercolesStart, miercolesEnd,
            juevesStart, juevesEnd, viernesStart, viernesEnd, sabadoStart, sabadoEnd, domingoStart, domingoEnd,
            IdGrupoHorario
        ]);


        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating schedule group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        if (Number(id) === 1 || Number(id) === 2) {
            return NextResponse.json({ error: 'Cannot delete system groups (ID 1 and 2)' }, { status: 403 });
        }

        const now = new Date();

        await projectQuery(session.projectId, `
            UPDATE tblGruposHorarios SET 
                Status = 2, 
                FechaAct = ?,
                ModificadoLector1 = 1, ModificadoLector2 = 1, ModificadoLector3 = 1, ModificadoLector4 = 1, ModificadoLector5 = 1,
                ModificadoLector6 = 1, ModificadoLector7 = 1, ModificadoLector8 = 1, ModificadoLector9 = 1, ModificadoLector10 = 1
            WHERE IdGrupoHorario = ?
        `, [now, id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting schedule group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
