
import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

async function getProjectDB() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) return null;
    const { projectId } = JSON.parse(sessionCookie.value);

    const projectData = await query(
        'SELECT BaseDatos FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    ) as any[];

    if (projectData.length === 0) return null;
    return {
        dbName: projectData[0].BaseDatos
    };
}

export async function GET(req: NextRequest) {
    try {
        const project = await getProjectDB();
        if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const sql = `
            CREATE TABLE IF NOT EXISTS \`${project.dbName}\`.tblProveedores (
                IdProveedor INT AUTO_INCREMENT PRIMARY KEY,
                Proveedor VARCHAR(255) NOT NULL,
                RFC VARCHAR(20),
                Contacto VARCHAR(255),
                Direccion1 VARCHAR(255),
                Direccion2 VARCHAR(255),
                Pais VARCHAR(100),
                Estado VARCHAR(100),
                Municipio VARCHAR(100),
                CodigoPostal VARCHAR(20),
                Telefono VARCHAR(50),
                CorreoElectronico VARCHAR(255),
                Status INT DEFAULT 0,
                FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await execute(sql);
        return NextResponse.json({ success: true, message: 'Table created' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
