import { NextRequest, NextResponse } from 'next/server';
import { getProjectByUUID, getProjectConnectionPool } from '@/lib/projectDb';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            uuidProject,
            idSucursal,
            socio,
            correoElectronico,
            telefono,
            sexo,
            calleNumero,
            colonia,
            cp,
            estado,
            municipio,
            fechaNacimiento,
            contacto,
            fuente,
            foto // Base64
        } = body;

        if (!uuidProject || !socio || !correoElectronico || !telefono || !sexo || !fechaNacimiento || !contacto || !fuente) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1. Resolve project
        const project = await getProjectByUUID(uuidProject);
        const pool = await getProjectConnectionPool(project.IdProyecto, project);

        // 2. Process Photo to JPG Buffer if exists
        let fotoBuffer: Buffer | null = null;
        if (foto) {
            try {
                // Extract base64 content
                const base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Convert to JPG using sharp
                fotoBuffer = await sharp(buffer)
                    .jpeg({ quality: 80 })
                    .toBuffer();
            } catch (err) {
                console.error('Error processing photo with sharp:', err);
                // Continue without photo or throw error? 
                // The user said "Foto ... no obligatorio", so maybe continue?
                // But if they sent one and it failed, maybe tell them.
            }
        }

        // 3. Insert into tblRecorridosWeb
        const query = `
            INSERT INTO tblRecorridosWeb (
                Socio, 
                CorreoElectronico, 
                Telefono, 
                Sexo, 
                CalleNumero, 
                Colonia, 
                CP, 
                Estado, 
                Municipio, 
                FechaNacimiento, 
                Contacto, 
                Fuente,
                IdSucursal,
                Status,
                Foto, 
                FechaRecorrido
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const params = [
            Buffer.from(socio, 'latin1'),
            Buffer.from(correoElectronico, 'latin1'),
            Buffer.from(telefono, 'latin1'),
            parseInt(sexo),
            calleNumero ? Buffer.from(calleNumero, 'latin1') : null,
            colonia ? Buffer.from(colonia, 'latin1') : null,
            cp ? Buffer.from(cp, 'latin1') : null,
            estado ? Buffer.from(estado, 'latin1') : null,
            municipio ? Buffer.from(municipio, 'latin1') : null,
            Buffer.from(fechaNacimiento, 'latin1'),
            Buffer.from(contacto, 'latin1'),
            Buffer.from(fuente, 'latin1'),
            idSucursal ? parseInt(idSucursal) : null,
            0, // Status always 0 
            fotoBuffer
        ];

        await pool.query(query, params);

        return NextResponse.json({ success: true, message: 'Registro guardado exitosamente' });

    } catch (error: any) {
        console.error('API Error (recorrido/save):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
