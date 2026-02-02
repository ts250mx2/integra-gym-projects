
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';
import { query } from '@/lib/db'; // For Main DB (Project Info)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const saleId = parseInt(id);

        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        const { projectId } = session;

        // 1. Fetch Sale Header & Branch Info & User & Member
        // We join with tblSucursales to get address at the time of printing (assuming branch address doesn't change often or we want valid current address)
        // Join with tblUsuarios for User Name
        // Join with tblSocios for Member Name (Left join as it might be null/0)
        const saleRes = await projectQuery(
            projectId,
            `SELECT 
                V.IdVenta, V.FolioVenta, V.FechaVenta, V.Total, V.ConceptoVenta, V.IdApertura,
                V.IdSucursal, S.Direccion1, S.Direccion2, S.Estado, S.Localidad, S.CodigoPostal, S.Telefono, S.CorreoElectronico,
                U.Usuario as Vendedor,
                Mem.CodigoSocio,
                CASE WHEN V.IdSocio = 0 THEN 'Público General' ELSE Mem.Socio END as Cliente
             FROM tblVentas V
             INNER JOIN tblSucursales S ON V.IdSucursal = S.IdSucursal
             INNER JOIN tblUsuarios U ON V.IdUsuario = U.IdUsuario
             LEFT JOIN tblSocios Mem ON V.IdSocio = Mem.IdSocio
             WHERE V.IdVenta = ?`,
            [saleId]
        ) as any[];

        if (saleRes.length === 0) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        const sale = saleRes[0];

        // 2. Fetch Details
        const items = await projectQuery(
            projectId,
            `SELECT IdCuota, Cantidad, Precio, Cuota as Producto, Periodo 
             FROM tblDetalleVentas 
             WHERE IdVenta = ?`,
            [saleId]
        ) as any[];

        // 3. Fetch Payments
        // We need Payment Method Name. tblVentasPagos has IdFormaPago.
        // We join with tblFormasPago
        const payments = await projectQuery(
            projectId,
            `SELECT P.Pago, F.FormaPago 
             FROM tblVentasPagos P
             INNER JOIN tblFormasPago F ON P.IdFormaPago = F.IdFormaPago
             WHERE P.IdVenta = ?`,
            [saleId]
        ) as any[];

        // 4. Fetch Project Info (Logo & Name)
        let projectInfo = { GymName: 'Integra Gym', ProjectLogo: null };
        try {
            const projectRes = await query('SELECT ArchivoLogo, Proyecto FROM tblProyectos WHERE IdProyecto = ?', [projectId]) as any[];
            if (projectRes.length > 0) {
                projectInfo.GymName = projectRes[0].Proyecto;
                projectInfo.ProjectLogo = projectRes[0].ArchivoLogo;
            }
        } catch (e) {
            console.error('Error fetching project info', e);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...sale,
                items,
                payments,
                ...projectInfo
            }
        });

    } catch (error: any) {
        console.error('Get ticket error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
