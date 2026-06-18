import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { normalizeMxPhone } from '@/lib/alerts/outbound';

// Hora de envío por default al activar una alerta (hora local America/Monterrey).
const DEFAULT_HORA_ENVIO = '22:30:00';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);
    if (session.isAdmin === 1 || session.isAdmin === 2) return session;
    return false;
}

/**
 * GET ?idProyecto=X
 * Devuelve, para configurar las alertas de un proyecto:
 *   - catalog:      todas las alertas activas del catálogo (tblAlertas)
 *   - enabled:      IdAlerta[] activas para el proyecto (tblProyectosAlertas)
 *   - accessPhones: teléfonos con acceso del proyecto (tblProyectosTelefonos),
 *                   para elegir como destinatarios
 *   - recipients:   destinatarios POR ALERTA (tblProyectosAlertasTelefonos)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const idProyecto = new URL(req.url).searchParams.get('idProyecto');
        if (!idProyecto) return NextResponse.json({ error: 'missingIdProyecto' }, { status: 400 });

        const catalog = await query(
            'SELECT IdAlerta, Clave, Tipo, Titulo, Descripcion, Icono FROM tblAlertas WHERE Activa = 1 ORDER BY Orden ASC, IdAlerta ASC',
            []
        ) as any[];

        const assignmentRows = await query(
            'SELECT IdAlerta, Activa, HoraEnvio FROM tblProyectosAlertas WHERE IdProyecto = ?',
            [idProyecto]
        ) as any[];
        const enabled = assignmentRows.filter((r) => r.Activa === 1).map((r) => r.IdAlerta);
        // schedules: IdAlerta -> 'HH:MM' (o null si no tiene hora programada)
        const schedules: Record<number, string | null> = {};
        for (const r of assignmentRows) {
            schedules[r.IdAlerta] = r.HoraEnvio ? String(r.HoraEnvio).slice(0, 5) : null;
        }

        const accessPhones = await query(
            'SELECT IdProyectoTelefono, Telefono, Nombre FROM tblProyectosTelefonos WHERE IdProyecto = ? ORDER BY Nombre ASC',
            [idProyecto]
        ) as any[];

        const recipients = await query(
            'SELECT IdProyectoAlertaTelefono, IdAlerta, Telefono, Nombre FROM tblProyectosAlertasTelefonos WHERE IdProyecto = ? AND Activa = 1 ORDER BY Nombre ASC',
            [idProyecto]
        ) as any[];

        return NextResponse.json({
            catalog,
            enabled,
            schedules,
            accessPhones,
            recipients,
        });
    } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return NextResponse.json({ error: 'noTable', details: 'Faltan tablas de alertas. Ejecuta: node scripts/setup-project-alerts.mjs' }, { status: 500 });
        }
        console.error('Project Alerts GET error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

/**
 * PUT { IdProyecto, IdAlerta, Activa? , HoraEnvio? }
 * Upsert de la asignación de una alerta al proyecto:
 *   - Si viene `Activa`    → activa/desactiva la alerta para el proyecto.
 *   - Si viene `HoraEnvio` → programa (o limpia, con '' / null) la hora de envío
 *     diario en formato 'HH:MM' (hora local America/Monterrey).
 */
export async function PUT(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdProyecto, IdAlerta } = body;
        if (!IdProyecto || !IdAlerta) return NextResponse.json({ error: 'missingFields' }, { status: 400 });

        const hasActiva = Object.prototype.hasOwnProperty.call(body, 'Activa');
        const hasHora = Object.prototype.hasOwnProperty.call(body, 'HoraEnvio');

        if (hasHora) {
            // 'HH:MM' válido, o NULL para limpiar.
            const raw = body.HoraEnvio;
            const hora = (typeof raw === 'string' && /^\d{2}:\d{2}$/.test(raw)) ? raw : null;
            await query(
                `INSERT INTO tblProyectosAlertas (IdProyecto, IdAlerta, Activa, HoraEnvio)
                 VALUES (?, ?, 1, ?)
                 ON DUPLICATE KEY UPDATE HoraEnvio = VALUES(HoraEnvio), FechaAct = CURRENT_TIMESTAMP`,
                [IdProyecto, IdAlerta, hora]
            );
        }

        if (hasActiva) {
            const activaVal = body.Activa === 0 || body.Activa === false ? 0 : 1;
            // En una asignación NUEVA, la hora de envío arranca en 22:30 por default.
            // En una existente solo se actualiza Activa (no se toca la hora ya configurada).
            await query(
                `INSERT INTO tblProyectosAlertas (IdProyecto, IdAlerta, Activa, HoraEnvio)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE Activa = VALUES(Activa), FechaAct = CURRENT_TIMESTAMP`,
                [IdProyecto, IdAlerta, activaVal, DEFAULT_HORA_ENVIO]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Project Alerts PUT error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

/**
 * POST { IdProyecto, IdAlerta, Telefono, Nombre }
 * Agrega un teléfono destinatario a UNA alerta del proyecto.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { IdProyecto, IdAlerta, Telefono, Nombre } = await req.json();
        if (!IdProyecto || !IdAlerta || !Telefono) {
            return NextResponse.json({ error: 'missingFields', details: 'Proyecto, alerta y teléfono son obligatorios.' }, { status: 400 });
        }

        // Normaliza a E.164 (antepone +52 si viene sin lada).
        const telefono = normalizeMxPhone(Telefono);
        if (!telefono) {
            return NextResponse.json({ error: 'invalidPhone', details: 'Teléfono inválido.' }, { status: 400 });
        }

        const existing = await query(
            'SELECT IdProyectoAlertaTelefono FROM tblProyectosAlertasTelefonos WHERE IdProyecto = ? AND IdAlerta = ? AND Telefono = ? AND Activa = 1',
            [IdProyecto, IdAlerta, telefono]
        ) as any[];
        if (existing.length > 0) {
            return NextResponse.json({ error: 'alreadyExists', details: 'Ese teléfono ya está asignado a esta alerta.' }, { status: 409 });
        }

        const result: any = await query(
            'INSERT INTO tblProyectosAlertasTelefonos (IdProyecto, IdAlerta, Telefono, Nombre) VALUES (?, ?, ?, ?)',
            [IdProyecto, IdAlerta, telefono, Nombre || null]
        );
        return NextResponse.json({ success: true, insertId: result.insertId });
    } catch (error: any) {
        console.error('Project Alerts POST error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

/**
 * DELETE ?phoneId=Y  → elimina un teléfono destinatario.
 */
export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const phoneId = new URL(req.url).searchParams.get('phoneId');
        if (!phoneId) return NextResponse.json({ error: 'missingId' }, { status: 400 });

        await query('DELETE FROM tblProyectosAlertasTelefonos WHERE IdProyectoAlertaTelefono = ?', [phoneId]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Project Alerts DELETE error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
