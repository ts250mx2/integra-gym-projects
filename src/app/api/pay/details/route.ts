import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getProjectByUUID, getProjectConnectionPool } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uuidProject = searchParams.get('uuidProject');
    const uuidSolicitud = searchParams.get('uuidSolicitud');

    if (!uuidProject || !uuidSolicitud) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const project = await getProjectByUUID(uuidProject);
        const { IdProyecto, Titulo, Proyecto, ArchivoLogo } = project;

        // Fetch Stripe Public Key from tblParametros in BDIntegraProjects
        const stripeParams = await query(
            'SELECT Campo, Valor FROM tblParametros WHERE IdProyecto = ? AND Grupo = "Stripe"',
            [IdProyecto]
        ) as any[];

        const publicKey = stripeParams.find(p => p.Campo === 'API_KEY_PUBLIC')?.Valor;

        if (!publicKey) {
            return NextResponse.json({ error: 'Stripe configuration missing (Public Key)' }, { status: 500 });
        }

        // Connect to project-specific database
        const pool = await getProjectConnectionPool(IdProyecto, project);

        // Fetch Solicitation main info
        const [solicitationRows]: any = await pool.execute(
            'SELECT CodigoSocio, Socio, Pagado, IdSocio, idSucursalSocio FROM tblSolicitudesStripe WHERE UUID = ?',
            [uuidSolicitud]
        );

        if (solicitationRows.length === 0) {
            return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
        }

        const solicitation = solicitationRows[0];

        // Fetch Member Photo
        let memberPhoto = null;
        if (solicitation.IdSocio && solicitation.idSucursalSocio) {
            const [photoRows]: any = await pool.execute(
                'SELECT Foto FROM tblSociosFotos WHERE IdSocio = ? AND IdSucursal = ? AND EsUltimaFoto = 1',
                [solicitation.IdSocio, solicitation.idSucursalSocio]
            );
            if (photoRows.length > 0 && photoRows[0].Foto) {
                const fotoBuffer = photoRows[0].Foto;
                if (Buffer.isBuffer(fotoBuffer)) {
                    memberPhoto = `data:image/jpeg;base64,${fotoBuffer.toString('base64')}`;
                } else {
                    memberPhoto = `data:image/jpeg;base64,${Buffer.from(fotoBuffer).toString('base64')}`;
                }
            }
        }

        // Fetch Solicitation details
        // Note: Assuming detail mapping is done via a foreign key or lookup from solicitation
        const [detailsRows]: any = await pool.execute(
            'SELECT Cantidad, DescripcionVenta, Precio FROM tblDetalleSolicitudesStripe WHERE UUID = ?',
            [uuidSolicitud]
        );

        const details = detailsRows.map((d: any) => ({
            cantidad: d.Cantidad,
            descripcion: d.DescripcionVenta,
            precio: d.Precio,
            total: (d.Cantidad || 0) * (d.Precio || 0)
        }));

        const totalAmount = details.reduce((acc: number, d: any) => acc + d.total, 0);

        return NextResponse.json({
            project: {
                title: Titulo || Proyecto,
                logo: ArchivoLogo,
                publicKey
            },
            member: {
                code: solicitation.CodigoSocio,
                name: solicitation.Socio,
                photo: memberPhoto
            },
            isPaid: solicitation.Pagado === 1,
            items: details,
            total: totalAmount
        });

    } catch (error: any) {
        console.error('API Error (pay/details):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
