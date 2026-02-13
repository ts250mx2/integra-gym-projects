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
    const project = JSON.parse(sessionCookie.value);

    // Fetch full project details to get DB info if not fully in session
    const projectData = await query(
        'SELECT BaseDatos, DominioIM, Pais, UUID FROM tblProyectos WHERE IdProyecto = ?',
        [project.projectId]
    ) as any[];

    if (projectData.length === 0) return null;

    return {
        projectId: project.projectId,
        branchId: project.branchId, // Current session branch
        dbName: projectData[0].BaseDatos,
        domain: projectData[0].DominioIM,
        country: projectData[0].Pais,
        uuid: projectData[0].UUID
    };
}

// Reusing photo save logic
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
        const dir = path.join(process.cwd(), 'public', 'photos_classes', uuid); // Separate folder for classes

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, `${filename}.jpg`);
        await sharp(buffer).jpeg().toFile(filePath);
    } catch (error) {
        console.error('Error saving photo:', error);
    }
}

export async function GET(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Retrieve active branch from session or query param if needed. 
        // Logic says: "IdSucursal = {{id sucursal activo}}"
        const branchId = project.branchId;

        const classes = await query(
            `SELECT A.*, B.Usuario AS Instructor 
             FROM \`${project.dbName}\`.tblClases A 
             LEFT JOIN \`${project.dbName}\`.tblUsuarios B ON A.IdUsuarioInstructor = B.IdUsuario 
             WHERE A.Status < 2 AND A.IdSucursal = ? 
             ORDER BY A.Clase`,
            [branchId]
        ) as any[];

        // Fetch schedules for these classes
        // Fetch schedules for these classes
        const classIds = classes.map(c => c.IdClase);
        let schedules: any[] = [];
        if (classIds.length > 0) {
            const placeholders = classIds.map(() => '?').join(',');
            schedules = await query(
                `SELECT * FROM \`${project.dbName}\`.tblClasesDias WHERE IdClase IN (${placeholders})`,
                classIds
            ) as any[];
        }

        // Map classes to use file path for image if it exists AND attach schedules
        const classesWithPhotos = classes.map(cls => {
            const photoPath = path.join(process.cwd(), 'public', 'photos_classes', project.uuid, `class_${cls.IdClase}.jpg`);
            let imageUrl = cls.ArchivoImagen; // Default to DB content (Base64)

            if (fs.existsSync(photoPath)) {
                // If file exists, use public URL with cache busting
                imageUrl = `/photos_classes/${project.uuid}/class_${cls.IdClase}.jpg?v=${new Date(cls.FechaAct || Date.now()).getTime()}`;
            }

            // Get schedules for this class
            const classSchedules = schedules.filter(s => s.IdClase === cls.IdClase);

            return {
                ...cls,
                ArchivoImagen: imageUrl,
                Schedules: classSchedules
            };
        });

        return NextResponse.json(classesWithPhotos);
    } catch (error: any) {
        console.error('GET Classes error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { Clase, EsEvento, FechaEvento, HourlyEvent, HoraInicio, HoraFin, IdUsuarioInstructor, ArchivoImagen } = body;
        const branchId = project.branchId;

        const result = await query(
            `INSERT INTO \`${project.dbName}\`.tblClases 
             (Clase, EsEvento, FechaEvento, HoraInicio, HoraFin, IdUsuarioInstructor, IdSucursal, ArchivoImagen, Status, FechaAct) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
                Clase || null,
                EsEvento ? 1 : 0,
                EsEvento && FechaEvento ? FechaEvento : null,
                EsEvento && HoraInicio ? HoraInicio : null,
                EsEvento && HoraFin ? HoraFin : null,
                IdUsuarioInstructor || null,
                branchId,
                ArchivoImagen || null
            ]
        );

        const insertId = (result as any).insertId;
        if (ArchivoImagen) {
            // Save photo if present
            await savePhotoToDisk(ArchivoImagen, `class_${insertId}`, project.uuid);
        }

        return NextResponse.json({ success: true, id: insertId });
    } catch (error: any) {
        console.error('POST Class error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { IdClase, Clase, EsEvento, FechaEvento, HoraInicio, HoraFin, IdUsuarioInstructor, ArchivoImagen, Status } = body;

        // Dynamic update based on what's provided
        // If Status is provided alone, it's a status toggle.
        // If other fields are provided, it's an edit.

        let sql = `UPDATE \`${project.dbName}\`.tblClases SET FechaAct = NOW()`;
        const params = [];

        if (Clase !== undefined) {
            sql += `, Clase = ?`;
            params.push(Clase);
        }
        if (EsEvento !== undefined) {
            sql += `, EsEvento = ?`;
            params.push(EsEvento ? 1 : 0);
        }
        if (FechaEvento !== undefined) {
            sql += `, FechaEvento = ?`;
            params.push(EsEvento && FechaEvento ? FechaEvento : null);
        }
        if (HoraInicio !== undefined) {
            sql += `, HoraInicio = ?`;
            params.push(EsEvento && HoraInicio ? HoraInicio : null);
        }
        if (HoraFin !== undefined) {
            sql += `, HoraFin = ?`;
            params.push(EsEvento && HoraFin ? HoraFin : null);
        }
        if (IdUsuarioInstructor !== undefined) {
            sql += `, IdUsuarioInstructor = ?`;
            params.push(IdUsuarioInstructor || null);
        }
        if (ArchivoImagen !== undefined) {
            sql += `, ArchivoImagen = ?`;
            params.push(ArchivoImagen);
        }
        if (Status !== undefined) {
            sql += `, Status = ?`;
            params.push(Status);
        }

        sql += ` WHERE IdClase = ?`;
        params.push(IdClase);

        await query(sql, params);

        if (ArchivoImagen && IdClase) {
            await savePhotoToDisk(ArchivoImagen, `class_${IdClase}`, project.uuid);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT Class error:', error);
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
            `UPDATE \`${project.dbName}\`.tblClases SET Status = 2, FechaAct = NOW() WHERE IdClase = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Class error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
