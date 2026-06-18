import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);

    if (session.isAdmin === 1 || session.isAdmin === 2) {
        return session;
    }
    return false;
}

function isReadOnlySql(sql: string): boolean {
    return /^\s*(select|with)\b/i.test(sql || '');
}

// Convierte '' / null / undefined a NULL; el resto a número.
function toNum(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
}

const VALID_FORMATO = ['number', 'currency', 'percent', 'text'];
const VALID_DIRECCION = ['asc', 'desc', 'neutro'];
const VALID_ESTATUS = ['success', 'warning', 'danger', 'info'];
const VALID_TIPO = ['sql', 'ai'];

// Valida los campos según el tipo de alerta. Devuelve un mensaje de error o null.
function validateAlert(b: any): string | null {
    if (!b.Clave || !b.Titulo) return 'Clave y Título son obligatorios.';
    const tipo = VALID_TIPO.includes(b.Tipo) ? b.Tipo : 'sql';
    if (tipo === 'ai') {
        if (!b.Prompt) return 'Las alertas de tipo IA requieren un Prompt.';
    } else {
        if (!b.ConsultaSQL) return 'La Consulta SQL es obligatoria para alertas de tipo SQL.';
        if (!isReadOnlySql(b.ConsultaSQL)) return 'La Consulta SQL debe ser de solo lectura (iniciar con SELECT o WITH).';
    }
    return null;
}

export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const alerts = await query(
            'SELECT * FROM tblAlertas ORDER BY Orden ASC, IdAlerta ASC',
            []
        );
        return NextResponse.json(alerts);
    } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return NextResponse.json({ error: 'noTable', details: 'La tabla tblAlertas no existe. Ejecuta: node scripts/setup-alerts.mjs' }, { status: 500 });
        }
        console.error('Alerts GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const b = await req.json();

        const err = validateAlert(b);
        if (err) return NextResponse.json({ error: 'missingFields', details: err }, { status: 400 });

        const tipo = VALID_TIPO.includes(b.Tipo) ? b.Tipo : 'sql';

        const insertQuery = `
            INSERT INTO tblAlertas
                (Clave, Tipo, Titulo, Descripcion, Icono, ConsultaSQL, Prompt, Formato, Direccion, UmbralExito, UmbralAdvertencia, EstatusNeutro, MensajeExito, MensajeAdvertencia, MensajePeligro, Orden, Activa)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result]: any = await query(insertQuery, [
            b.Clave,
            tipo,
            b.Titulo,
            b.Descripcion || null,
            b.Icono || 'Bell',
            tipo === 'ai' ? null : b.ConsultaSQL,
            tipo === 'ai' ? (b.Prompt || null) : null,
            VALID_FORMATO.includes(b.Formato) ? b.Formato : 'number',
            VALID_DIRECCION.includes(b.Direccion) ? b.Direccion : 'neutro',
            toNum(b.UmbralExito),
            toNum(b.UmbralAdvertencia),
            VALID_ESTATUS.includes(b.EstatusNeutro) ? b.EstatusNeutro : 'info',
            b.MensajeExito || null,
            b.MensajeAdvertencia || null,
            b.MensajePeligro || null,
            toNum(b.Orden) ?? 0,
            b.Activa === 0 || b.Activa === false ? 0 : 1,
        ]) as any;

        return NextResponse.json({ success: true, insertId: result.insertId });
    } catch (error: any) {
        if (error?.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'duplicateClave', details: 'Ya existe una alerta con esa Clave.' }, { status: 409 });
        }
        console.error('Alerts POST API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const b = await req.json();

        if (!b.IdAlerta) return NextResponse.json({ error: 'missingFields', details: 'Falta IdAlerta.' }, { status: 400 });
        const err = validateAlert(b);
        if (err) return NextResponse.json({ error: 'missingFields', details: err }, { status: 400 });

        const tipo = VALID_TIPO.includes(b.Tipo) ? b.Tipo : 'sql';

        const updateQuery = `
            UPDATE tblAlertas SET
                Clave = ?, Tipo = ?, Titulo = ?, Descripcion = ?, Icono = ?, ConsultaSQL = ?, Prompt = ?, Formato = ?,
                Direccion = ?, UmbralExito = ?, UmbralAdvertencia = ?, EstatusNeutro = ?,
                MensajeExito = ?, MensajeAdvertencia = ?, MensajePeligro = ?, Orden = ?, Activa = ?
            WHERE IdAlerta = ?
        `;
        await query(updateQuery, [
            b.Clave,
            tipo,
            b.Titulo,
            b.Descripcion || null,
            b.Icono || 'Bell',
            tipo === 'ai' ? null : b.ConsultaSQL,
            tipo === 'ai' ? (b.Prompt || null) : null,
            VALID_FORMATO.includes(b.Formato) ? b.Formato : 'number',
            VALID_DIRECCION.includes(b.Direccion) ? b.Direccion : 'neutro',
            toNum(b.UmbralExito),
            toNum(b.UmbralAdvertencia),
            VALID_ESTATUS.includes(b.EstatusNeutro) ? b.EstatusNeutro : 'info',
            b.MensajeExito || null,
            b.MensajeAdvertencia || null,
            b.MensajePeligro || null,
            toNum(b.Orden) ?? 0,
            b.Activa === 0 || b.Activa === false ? 0 : 1,
            b.IdAlerta,
        ]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error?.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'duplicateClave', details: 'Ya existe una alerta con esa Clave.' }, { status: 409 });
        }
        console.error('Alerts PUT API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'missingId' }, { status: 400 });

        await query('DELETE FROM tblAlertas WHERE IdAlerta = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Alerts DELETE API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
