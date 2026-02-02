
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = JSON.parse(sessionCookie.value);

        const readers = await query(
            `SELECT * FROM BDIntegraProjects.tblLectores WHERE IdProyecto = ? AND Status != 2 ORDER BY NumLector ASC`,
            [projectId]
        ) as any[];

        return NextResponse.json(readers);
    } catch (error) {
        console.error('Error fetching readers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = JSON.parse(sessionCookie.value);
        const body = await request.json();

        // Calculate next NumLector
        const maxNumResult = await query(
            `SELECT MAX(NumLector) as maxNum FROM BDIntegraProjects.tblLectores WHERE IdProyecto = ?`,
            [projectId]
        ) as any[];

        const nextNumLector = (maxNumResult[0]?.maxNum || 0) + 1;

        const {
            Lector,
            SerialNumber,
            DeviceName,
            FirmwareVer,
            Mac,
            Platform,
            FPAlg,
            FaceAlg,
            Manufacturer,
            Modelo,
            IdSucursal
        } = body;

        await query(
            `INSERT INTO BDIntegraProjects.tblLectores 
            (IdProyecto, NumLector, Lector, SerialNumber, Modelo, IdSucursal, Status, FechaAct) 
            VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
                projectId,
                nextNumLector,
                Lector || null,
                SerialNumber || null,
                Modelo || null,
                IdSucursal || null
            ]
        );

        return NextResponse.json({ success: true, NumLector: nextNumLector });
    } catch (error) {
        console.error('Error creating reader:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { IdLector, Lector, SerialNumber, Modelo, IdSucursal } = body;

        await query(
            `UPDATE BDIntegraProjects.tblLectores 
             SET Lector = ?, SerialNumber = ?, Modelo = ?, IdSucursal = ?, FechaAct = NOW() 
             WHERE IdLector = ?`,
            [Lector || null, SerialNumber || null, Modelo || null, IdSucursal || null, IdLector]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating reader:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        await query(
            `UPDATE BDIntegraProjects.tblLectores SET Status = 2, FechaAct = NOW() WHERE IdLector = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting reader:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
