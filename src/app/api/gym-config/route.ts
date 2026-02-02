import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { projectId, userId } = JSON.parse(sessionCookie.value);

        // 1. Fetch Project Data
        const projectData = await query(
            `SELECT Proyecto, Pais, Estado, Localidad, CodigoPostal, Direccion1, Direccion2, Telefono as GymTelefono, CorreoElectronico as GymEmail, DominioIM, RFC, ArchivoLogo 
             FROM tblProyectos 
             WHERE IdProyecto = ?`,
            [projectId]
        ) as any[];

        if (projectData.length === 0) return NextResponse.json({ error: 'projectNotFound' }, { status: 404 });

        // 2. Fetch User Data
        const userData = await query(
            `SELECT Usuario, CorreoElectronico, Telefono 
             FROM tblUsuarios 
             WHERE IdUsuario = ?`,
            [userId]
        ) as any[];

        const p = projectData[0];
        const u = userData[0] || {};

        return NextResponse.json({
            // General & Address (from tblProyectos)
            gymName: p.Proyecto,
            domain: p.DominioIM || '',
            rfc: p.RFC || '',
            logo: p.ArchivoLogo || null,
            country: p.Pais || 'MX',
            state: p.Estado || '',
            city: p.Localidad || '',
            zipCode: p.CodigoPostal || '',
            address1: p.Direccion1 || '',
            address2: p.Direccion2 || '',
            gymPhone: p.GymTelefono || '',
            gymEmail: p.GymEmail || '',

            // Admin User (from tblUsuarios)
            adminUser: {
                username: u.Usuario || '',
                email: u.CorreoElectronico || '',
                phone: u.Telefono || ''
            }
        });
    } catch (error: any) {
        console.error('Gym config GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { projectId, userId } = JSON.parse(sessionCookie.value);

        const body = await req.json();
        const {
            gymName, domain, rfc, logo,
            country, state, city, zipCode, address1, address2, gymPhone, gymEmail,
            adminUser
        } = body;

        // 1. Update tblProyectos
        await query(
            `UPDATE tblProyectos 
             SET Proyecto = ?, DominioIM = ?, RFC = ?, ArchivoLogo = ?, 
                 Pais = ?, Estado = ?, Localidad = ?, CodigoPostal = ?, 
                 Direccion1 = ?, Direccion2 = ?, Telefono = ?, CorreoElectronico = ?, 
                 FechaAct = NOW()
             WHERE IdProyecto = ?`,
            [
                gymName, domain, rfc, logo,
                country, state, city, zipCode,
                address1, address2, gymPhone, gymEmail,
                projectId
            ]
        );

        // 2. Update tblUsuarios
        if (adminUser) {
            await query(
                `UPDATE tblUsuarios 
                 SET Usuario = ?, Telefono = ?, FechaAct = NOW() 
                 WHERE IdUsuario = ?`,
                [adminUser.username, adminUser.phone, userId]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Gym config PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
