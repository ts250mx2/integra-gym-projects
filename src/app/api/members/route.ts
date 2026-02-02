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
        let matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            if (!base64Data.startsWith('data:')) {
                matches = [base64Data, 'image/jpeg', base64Data];
            } else {
                return;
            }
        }

        const buffer = Buffer.from(matches[2], 'base64');
        const dir = path.join(process.cwd(), 'public', 'photosm', uuid); // photosm for members? Users is photosu. Let's use photosm.

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, `${filename}.jpg`);
        await sharp(buffer).jpeg().toFile(filePath);
    } catch (error) {
        console.error('Error saving photo to disk:', error);
    }
}

export async function GET() {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const members = await query(
            `SELECT * FROM \`${project.dbName}\`.tblSocios WHERE Status != 2 ORDER BY FechaAct DESC`
        ) as any[];

        return NextResponse.json(members);
    } catch (error: any) {
        console.error('GET Members error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            Socio = null,
            IdSucursal = null,
            ArchivoFoto = null,
            Direccion1 = null,
            Direccion2 = null,
            Estado = null,
            Municipio = null,
            CodigoPostal = null,
            Telefono = null,
            CorreoElectronico = null,
            TarjetaRFID = null,
            Pais = null,
            Genero = null,
            ContactoEmergencia = null
        } = body;

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblSocios 
            (Socio, IdSucursal, ArchivoFoto, FotoActiva, 
             Direccion1, Direccion2, Estado, Localidad, CodigoPostal, 
             Telefono, CorreoElectronico, TarjetaRFID, Pais, Genero, ContactoEmergencia,
             Status, FechaAct) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
                Socio, IdSucursal, ArchivoFoto, ArchivoFoto ? 1 : 0,
                Direccion1, Direccion2, Estado, Municipio, CodigoPostal,
                Telefono, CorreoElectronico, TarjetaRFID, Pais || project.country,
                Genero, ContactoEmergencia,
                // Use provided CodigoSocio or fallback to generated ID (we will update it later if needed, but for now let's insert what we have)
                // Actually CodigoSocio is usually the manual code. Let's insert it if provided.
                // Wait, the SQL INSERT above (lines 95-100) does NOT include CodigoSocio in the column list.
                // I need to add it to the column list and values.
            ]
        );

        const insertId = (result as any).insertId;
        const IdFotoZK = (insertId * 10000); // Requested: IdSocio * 10000

        await query(
            `UPDATE \`${project.dbName}\`.tblSocios SET IdFotoZK = ? WHERE IdSocio = ?`,
            [IdFotoZK, insertId]
        );

        // Fetch Branch Clave and update CodigoSocio
        // Although the user might have provided a manually entered code if we kept the input open,
        // the requirement is "save its value in CodigoSocio" AND "read-only", implying auto-generation.
        // So we generate it: Clave + IdSocio
        const branchData = await query(
            `SELECT Clave FROM \`${project.dbName}\`.tblSucursales WHERE IdSucursal = ?`,
            [IdSucursal]
        ) as any[];

        if (branchData.length > 0) {
            const clave = branchData[0].Clave || '';
            const codigoSocio = `${clave}${insertId}`;
            await query(
                `UPDATE \`${project.dbName}\`.tblSocios SET CodigoSocio = ? WHERE IdSocio = ?`,
                [codigoSocio, insertId]
            );
        }

        if (ArchivoFoto) {
            await savePhotoToDisk(ArchivoFoto, insertId.toString(), project.uuid);
        }

        return NextResponse.json({ success: true, id: insertId });
    } catch (error: any) {
        console.error('POST Member error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            IdSocio,
            Socio = null,
            IdSucursal = null,
            ArchivoFoto = null,
            Direccion1 = null,
            Direccion2 = null,
            Estado = null,
            Municipio = null,
            CodigoPostal = null,
            Telefono = null,
            CorreoElectronico = null,
            TarjetaRFID = null,
            Pais = null,
            Genero = null,
            ContactoEmergencia = null,
            CodigoSocio = null
        } = body;

        const branchData = await query(
            `SELECT Clave FROM \`${project.dbName}\`.tblSucursales WHERE IdSucursal = ?`,
            [IdSucursal]
        ) as any[];

        const clave = branchData[0]?.Clave || '';
        const codigoSocio = `${clave}${IdSocio}`;

        // Add CodigoSocio to the update
        let sql = `UPDATE \`${project.dbName}\`.tblSocios SET 
                   Socio = ?, IdSucursal = ?, 
                   Direccion1 = ?, Direccion2 = ?, Estado = ?, Localidad = ?, 
                   CodigoPostal = ?, Telefono = ?, CorreoElectronico = ?,
                   TarjetaRFID = ?, Pais = ?, Genero = ?, ContactoEmergencia = ?,
                   CodigoSocio = ?,
                   FechaAct = NOW()`;

        // Rebuild params completely because spreading inserted CodigoSocio smoothly into array is tricky with previous push/pop logic order
        const newParams = [
            Socio, IdSucursal,
            Direccion1, Direccion2, Estado, Municipio,
            CodigoPostal, Telefono, CorreoElectronico,
            TarjetaRFID, Pais || project.country, Genero, ContactoEmergencia,
            codigoSocio
        ];

        if (ArchivoFoto) {
            sql += `, ArchivoFoto = ?, FotoActiva = 1`;
            newParams.push(ArchivoFoto);
        }

        sql += ` WHERE IdSocio = ?`;
        newParams.push(IdSocio);

        await query(sql, newParams);

        if (ArchivoFoto) {
            await savePhotoToDisk(ArchivoFoto, IdSocio.toString(), project.uuid);

            // Trigger update for active memberships to sync new photo to devices
            await query(
                `UPDATE \`${project.dbName}\`.tblVentas v
                 INNER JOIN \`${project.dbName}\`.tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdSucursal = dv.IdSucursal
                 SET 
                 v.ModificadoLector1 = 1, v.ModificadoLector2 = 1, v.ModificadoLector3 = 1, v.ModificadoLector4 = 1, v.ModificadoLector5 = 1,
                 v.ModificadoLector6 = 1, v.ModificadoLector7 = 1, v.ModificadoLector8 = 1, v.ModificadoLector9 = 1, v.ModificadoLector10 = 1
                 WHERE v.IdSocio = ? AND dv.FechaInicio < NOW() AND dv.FechaFin > NOW() AND v.Status = 0`,
                [IdSocio]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Member error:', error);
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

        await query(
            `UPDATE \`${project.dbName}\`.tblSocios SET Status = 2, FechaAct = NOW() WHERE IdSocio = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Member error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
