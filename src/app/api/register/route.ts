import { NextRequest, NextResponse } from 'next/server';
import { execute, getConnection, query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { gymName, email, phone, password, confirmPassword, userName, country, language } = body;

        // 1. Validate password match
        if (password !== confirmPassword) {
            return NextResponse.json({ error: 'passwordsDoNotMatch' }, { status: 400 });
        }

        // 2. Validate gym name uniqueness
        const existingProject = await query(
            'SELECT IdProyecto FROM tblProyectos WHERE Proyecto = ?',
            [gymName]
        ) as any[];

        if (existingProject.length > 0) {
            return NextResponse.json({ error: 'gymExistsError' }, { status: 400 });
        }

        const uuid = uuidv4();
        const dbName = `IM_${gymName.replace(/\s+/g, '_')}`;
        const domain = `${gymName.replace(/\s+/g, '')}`;
        const now = new Date();

        const connection = await getConnection();

        try {
            await connection.beginTransaction();

            // 3. Save to tblProyectos
            const [projectResult]: any = await connection.execute(
                `INSERT INTO tblProyectos (Proyecto, BaseDatos, Servidor, UsuarioBD, PasswordBD, Status, FechaAct, Idioma, Pais, DominioIM, UUID) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [gymName, dbName, connection.config.host, connection.config.user, connection.config.password, 0, now, language, country, domain, uuid]
            );
            const projectId = projectResult.insertId;

            // 4. Save to Usuarios
            const [userResult]: any = await connection.execute(
                `INSERT INTO tblUsuarios (Usuario, CorreoElectronico, Telefono, Passwd, Status, FechaAct) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [userName, email, phone, password, 0, now]
            );
            const userId = userResult.insertId;

            // 5. Save to tblProyectosUsuarios
            await connection.execute(
                `INSERT INTO tblProyectosUsuarios (IdProyecto, IdUsuario, Status, FechaAct) 
         VALUES (?, ?, ?, ?)`,
                [projectId, userId, 0, now]
            );

            await connection.commit();

            // 6. Create new database
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

            // 7. Clone structure from IM_IntegraMembers
            // Note: This assumes schema cloning is done by listing tables and creating them or using a template.
            // For simplicity in this script, we'll try to get all tables from IM_IntegraMembers.
            const [tables]: any = await connection.query('SHOW TABLES FROM IM_IntegraMembers');

            for (const row of tables) {
                const tableName = Object.values(row)[0] as string;
                await connection.query(`CREATE TABLE \`${dbName}\`.\`${tableName}\` LIKE IM_IntegraMembers.\`${tableName}\``);
            }

            // 8. Insert initial branch into the new database
            await connection.execute(
                `INSERT INTO \`${dbName}\`.tblSucursales (Sucursal, Pais, Clave, Status, FechaAct) 
                 VALUES (?, ?, ?, ?, ?)`,
                [gymName, country, 'A', 0, now]
            );

            // 9. Insert initial postion into the new database
            await connection.execute(
                `INSERT INTO \`${dbName}\`.tblPuestos (Puesto, EsAdministrador, Status, FechaAct) 
                 VALUES (?, ?, ?, ?)`,
                ['ADMIN', 1, 0, now]
            );

            // 10. Insert initial user into the new database
            await connection.execute(
                `INSERT INTO \`${dbName}\`.tblUsuarios (Usuario, CorreoElectronico, Telefono, Login, Passwd, Status, FechaAct, IdPuesto, IdSucursal) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userName, email, phone, 'admin', password, 0, now, 1, 1]
            );

            connection.release();

            return NextResponse.json({ success: true, projectId, userId });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
