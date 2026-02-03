import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const { projectId } = JSON.parse(sessionCookie.value);

    const projectData = await query(
        'SELECT BaseDatos, DominioIM, Pais, UUID FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    if (projectData.length === 0) return null;
    return {
        projectId,
        dbName: projectData[0].BaseDatos,
        domain: projectData[0].DominioIM,
        country: projectData[0].Pais,
        uuid: projectData[0].UUID
    };
}

async function savePhotoToDisk(base64Data: string, filename: string, uuid: string) {
    try {
        console.log(`Saving photo to disk: ${filename}, data length: ${base64Data?.length}, uuid: ${uuid}`);

        // Check for different base64 prefixes or no prefix
        let matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            console.log('Regex match failed on base64 data');
            // Try to handle direct base64 string without prefix if that's what's passed
            if (!base64Data.startsWith('data:')) {
                console.log('Attempting to treat as raw base64');
                matches = [base64Data, 'image/jpeg', base64Data];
            } else {
                return;
            }
        }

        const buffer = Buffer.from(matches[2], 'base64');
        // Save to public/photosu/{UUID} to make it accessible via web
        const dir = path.join(process.cwd(), 'public', 'photosu', uuid);
        console.log(`Target directory: ${dir}`);

        if (!fs.existsSync(dir)) {
            console.log('Creating directory...');
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, `${filename}.jpg`);
        console.log(`Writing file to: ${filePath}`);
        await sharp(buffer).jpeg().toFile(filePath);
        console.log('File written successfully');
    } catch (error) {
        console.error('Error saving photo to disk:', error);
    }
}

export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const users = await query(
            `SELECT u.*, p.Puesto 
             FROM \`${project.dbName}\`.tblUsuarios u 
             LEFT JOIN \`${project.dbName}\`.tblPuestos p ON u.IdPuesto = p.IdPuesto 
             WHERE u.Status != 2 
             ORDER BY u.Usuario ASC`
        ) as any[];

        const usersWithBranding = users.map(user => ({
            ...user,
            displayLogin: `${user.Login}@${project.domain}.IM`
        }));

        return NextResponse.json(usersWithBranding);
    } catch (error: any) {
        console.error('GET Users error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    console.error('!!! POST /api/users HIT !!!');
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            Usuario = null,
            IdPuesto = null,
            IdSucursal = null,
            Login = null,
            Passwd = null,
            ArchivoFoto = null,
            Direccion1 = null,
            Direccion2 = null,
            Estado = null,
            Municipio = null,
            CodigoPostal = null,
            Telefono = null,
            CorreoElectronico = null,
            TarjetaRFID = null,
            Pais = null
        } = body;

        console.log('POST User body received. ArchivoFoto present:', !!ArchivoFoto, 'Length:', ArchivoFoto?.length);

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblUsuarios 
            (Usuario, IdPuesto, IdSucursal, Login, Passwd, ArchivoFoto, ActivoFoto, 
             Direccion1, Direccion2, Estado, Municipio, CodigoPostal, 
             Telefono, CorreoElectronico, TarjetaRFID, Pais,
             ModificadoLector1, ModificadoLector2, ModificadoLector3, ModificadoLector4,
             ModificadoLector5, ModificadoLector6, ModificadoLector7, ModificadoLector8,
             ModificadoLector9, ModificadoLector10, Status, FechaAct) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, NOW())`,
            [
                Usuario, IdPuesto, IdSucursal, Login, Passwd, ArchivoFoto, ArchivoFoto ? 1 : 0,
                Direccion1, Direccion2, Estado, Municipio, CodigoPostal,
                Telefono, CorreoElectronico, TarjetaRFID, Pais || project.country
            ]
        );

        const insertId = (result as any).insertId;
        const IdFotoZK = (insertId * 100000) + project.projectId;

        await query(
            `UPDATE \`${project.dbName}\`.tblUsuarios SET IdFotoZK = ? WHERE IdUsuario = ?`,
            [IdFotoZK, insertId]
        );

        if (ArchivoFoto) {
            await savePhotoToDisk(ArchivoFoto, insertId.toString(), project.uuid);
        }

        return NextResponse.json({ success: true, id: insertId });
    } catch (error: any) {
        console.error('POST User error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    console.error('!!! PUT /api/users HIT !!!');
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            IdUsuario,
            Usuario = null,
            IdPuesto = null,
            IdSucursal = null,
            Login = null,
            Passwd = null,
            ArchivoFoto = null,
            Direccion1 = null,
            Direccion2 = null,
            Estado = null,
            Municipio = null,
            CodigoPostal = null,
            Telefono = null,
            CorreoElectronico = null,
            TarjetaRFID = null,
            Pais = null
        } = body;

        console.log('PUT User body received. ArchivoFoto present:', !!ArchivoFoto, 'Length:', ArchivoFoto?.length);

        let sql = `UPDATE \`${project.dbName}\`.tblUsuarios SET 
                   Usuario = ?, IdPuesto = ?, IdSucursal = ?, Login = ?, 
                   Direccion1 = ?, Direccion2 = ?, Estado = ?, Municipio = ?, 
                   CodigoPostal = ?, Telefono = ?, CorreoElectronico = ?,
                   TarjetaRFID = ?, Pais = ?,
                   ModificadoLector1 = 1, ModificadoLector2 = 1, ModificadoLector3 = 1, ModificadoLector4 = 1,
                   ModificadoLector5 = 1, ModificadoLector6 = 1, ModificadoLector7 = 1, ModificadoLector8 = 1,
                   ModificadoLector9 = 1, ModificadoLector10 = 1,
                   FechaAct = NOW()`;

        const params = [
            Usuario, IdPuesto, IdSucursal, Login,
            Direccion1, Direccion2, Estado, Municipio,
            CodigoPostal, Telefono, CorreoElectronico,
            TarjetaRFID, Pais || project.country
        ];

        if (Passwd) {
            sql += `, Passwd = ?`;
            params.push(Passwd);
        }

        if (ArchivoFoto) {
            sql += `, ArchivoFoto = ?, ActivoFoto = 1`;
            params.push(ArchivoFoto);
        }

        sql += ` WHERE IdUsuario = ?`;
        params.push(IdUsuario);

        await query(sql, params);

        if (ArchivoFoto) {
            await savePhotoToDisk(ArchivoFoto, IdUsuario.toString(), project.uuid);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT User error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        if (parseInt(id) === 1) {
            return NextResponse.json({ error: 'Cannot delete the main admin user' }, { status: 403 });
        }

        await query(
            `UPDATE \`${project.dbName}\`.tblUsuarios SET Status = 2, FechaAct = NOW(),
            ModificadoLector1 = 2, ModificadoLector2 = 2, ModificadoLector3 = 2, ModificadoLector4 = 2,
            ModificadoLector5 = 2, ModificadoLector6 = 2, ModificadoLector7 = 2, ModificadoLector8 = 2,
            ModificadoLector9 = 2, ModificadoLector10 = 2
            WHERE IdUsuario = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE User error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
