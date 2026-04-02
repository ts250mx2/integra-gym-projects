import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) return false;
    try {
        const session = JSON.parse(sessionCookie.value);
        if (session.isAdmin === 1 || session.isAdmin === 2) {
            return session;
        }
    } catch (e) {
        return false;
    }
    return false;
}

async function ensureTableExists() {
    await query(`
        CREATE TABLE IF NOT EXISTS tblParametros (
            IdParametro INT AUTO_INCREMENT PRIMARY KEY,
            IdProyecto INT NOT NULL,
            Grupo VARCHAR(255) NOT NULL,
            Campo VARCHAR(255) NOT NULL,
            Valor TEXT,
            Leido INT DEFAULT 0,
            FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT FK_Parametros_Proyectos FOREIGN KEY (IdProyecto) REFERENCES tblProyectos(IdProyecto),
            UNIQUE KEY UNQ_Proyecto_Grupo_Campo (IdProyecto, Grupo, Campo)
        )
    `);
    
    // Safety check: add column if it doesn't exist (in case table was already there)
    try {
        const cols: any = await query('SHOW COLUMNS FROM tblParametros LIKE "Leido"');
        if (cols.length === 0) {
            await query('ALTER TABLE tblParametros ADD COLUMN Leido INT DEFAULT 0 AFTER Valor');
        }
    } catch (e) {
        console.error('Error adding Leido column:', e);
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const idProyecto = searchParams.get('idProyecto');

        if (!idProyecto) {
            return NextResponse.json({ error: 'missingProject' }, { status: 400 });
        }

        await ensureTableExists();

        const parameters = await query(
            'SELECT IdParametro, Grupo, Campo, Valor, Leido, FechaAct FROM tblParametros WHERE IdProyecto = ? ORDER BY Grupo, Campo',
            [idProyecto]
        );

        return NextResponse.json(parameters);
    } catch (error: any) {
        console.error('Parameters GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdProyecto, Grupo, Campo, Valor, IdParametro } = body;

        if (!IdProyecto || !Grupo || !Campo) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        await ensureTableExists();

        if (IdParametro) {
            // Update - Reset Leido to 0
            const updateQuery = `
                UPDATE tblParametros 
                SET Grupo = ?, Campo = ?, Valor = ?, Leido = 0 
                WHERE IdParametro = ? AND IdProyecto = ?
            `;
            await query(updateQuery, [Grupo, Campo, Valor, IdParametro, IdProyecto]);
            return NextResponse.json({ success: true });
        } else {
            // Create - Leido defaults to 0
            const insertQuery = `
                INSERT INTO tblParametros (IdProyecto, Grupo, Campo, Valor, Leido) 
                VALUES (?, ?, ?, ?, 0)
            `;
            await query(insertQuery, [IdProyecto, Grupo, Campo, Valor]);
            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error('Parameters POST API error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'duplicateEntry', message: 'Ese campo ya existe en el grupo seleccionado.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'missingId' }, { status: 400 });
        }

        await ensureTableExists();

        await query('DELETE FROM tblParametros WHERE IdParametro = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Parameters DELETE API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
