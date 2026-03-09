import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);

    // EsAdministrador 1 or 2 are admin
    if (session.isAdmin === 1 || session.isAdmin === 2) {
        return session;
    }
    return false;
}

export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const projects = await query('SELECT IdProyecto, Proyecto, BaseDatos, DominioIM, Servidor, UsuarioBD, PasswordBD, Version, Idioma, Pais, Status FROM tblProyectos WHERE Status = 0 ORDER BY Proyecto ASC', []);
        return NextResponse.json(projects);
    } catch (error: any) {
        console.error('Projects GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { Proyecto, BaseDatos, DominioIM, Servidor, UsuarioBD, PasswordBD, Version, Idioma, Pais } = body;

        if (!Proyecto || !BaseDatos || !Version || (Version === '2.0' && !DominioIM)) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        const currentDatetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const connection = await getConnection();

        try {
            await connection.beginTransaction();

            const uuid = uuidv4();

            const insertQuery = `
                INSERT INTO tblProyectos (Proyecto, BaseDatos, DominioIM, Servidor, UsuarioBD, PasswordBD, Version, Idioma, Pais, Status, FechaAct, UUID) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            `;
            const [result]: any = await connection.execute(insertQuery, [Proyecto, BaseDatos, DominioIM || '', Servidor || '', UsuarioBD || '', PasswordBD || '', Version || '', Idioma || 'es', Pais || 'MX', currentDatetime, uuid]);
            const insertId = result.insertId;

            // 1. Create new database
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${BaseDatos}\``);

            // 2. Clone structure from IM_IntegraMembers
            const [tables]: any = await connection.query('SHOW TABLES FROM IM_IntegraMembers');
            for (const row of tables) {
                const tableName = Object.values(row)[0] as string;
                await connection.query(`CREATE TABLE \`${BaseDatos}\`.\`${tableName}\` LIKE IM_IntegraMembers.\`${tableName}\``);
            }

            // 3. Insert initial branch into the new database
            await connection.execute(
                `INSERT INTO \`${BaseDatos}\`.tblSucursales (Sucursal, Pais, Clave, Status, FechaAct) 
                 VALUES (?, ?, ?, ?, ?)`,
                [Proyecto, Pais || 'MX', 'A', 0, currentDatetime]
            );

            // 4. Insert initial position
            await connection.execute(
                `INSERT INTO \`${BaseDatos}\`.tblPuestos (Puesto, EsAdministrador, Status, FechaAct) 
                 VALUES (?, ?, ?, ?)`,
                ['ADMIN', 1, 0, currentDatetime]
            );

            // 5. Insert initial admin user
            await connection.execute(
                `INSERT INTO \`${BaseDatos}\`.tblUsuarios (Usuario, CorreoElectronico, Telefono, Login, Passwd, Status, FechaAct, IdPuesto, IdSucursal) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['Administrador', 'admin@' + (DominioIM || 'gym.com'), '0000000000', 'admin', 'admin', 0, currentDatetime, 1, 1]
            );

            await connection.commit();
            connection.release();

            return NextResponse.json({ success: true, insertId });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error: any) {
        console.error('Projects POST API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdProyecto, Proyecto, BaseDatos, DominioIM, Servidor, UsuarioBD, PasswordBD, Version, Idioma, Pais } = body;

        if (!IdProyecto || !Proyecto || !BaseDatos || !Version || (Version === '2.0' && !DominioIM)) {
            return NextResponse.json({ error: 'missingFields' }, { status: 400 });
        }

        const updateQuery = `
            UPDATE tblProyectos 
            SET Proyecto = ?, BaseDatos = ?, DominioIM = ?, Servidor = ?, UsuarioBD = ?, PasswordBD = ?, Version = ?, Idioma = ?, Pais = ?
            WHERE IdProyecto = ?
        `;
        await query(updateQuery, [Proyecto, BaseDatos, DominioIM || '', Servidor || '', UsuarioBD || '', PasswordBD || '', Version || '', Idioma || 'es', Pais || 'MX', IdProyecto]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Projects PUT API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const IdProyecto = searchParams.get('id');

        if (!IdProyecto) {
            return NextResponse.json({ error: 'missingId' }, { status: 400 });
        }

        // Soft delete
        const deleteQuery = `
            UPDATE tblProyectos 
            SET Status = 1
            WHERE IdProyecto = ?
        `;
        await query(deleteQuery, [IdProyecto]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Projects DELETE API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
