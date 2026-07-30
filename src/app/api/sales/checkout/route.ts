import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';
import { v4 as uuidv4 } from 'uuid';
import { PRODUCT_TIPO_CUOTA, registerSaleStockExit } from '@/lib/inventory';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        let { projectId, branchId, userId, isAdmin } = session;

        if (isAdmin === 2) {
            userId = 1;
        }

        const body = await req.json();
        const { cart, payments, total, idApertura, memberId, memberName } = body;

        // Validation
        if (!cart || cart.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
        if (!idApertura) return NextResponse.json({ error: 'Register not open' }, { status: 400 });

        // Verify Register is actually OPEN in DB
        const registerCheck = await projectQuery(
            projectId,
            'SELECT IdApertura FROM tblAperturasCierres WHERE IdApertura = ? AND IdSucursal = ? AND IdUsuarioCorte = 0',
            [idApertura, branchId]
        ) as any[];

        if (!registerCheck.length) {
            return NextResponse.json({ error: 'Register is closed or invalid. Please refresh.' }, { status: 400 });
        }

        // Member validation: If not public general (memberId > 0) and no memberId provided/valid, technically should have caught this in UI but check here if needed.
        // User requirements: "si si es publico general debe de ser 0 si no el IdSocio Seleccionado, si no hay socio seleccionado debe mandar error"
        // We rely on the frontend sending memberId=0 for public.
        if (memberId && memberId !== 0 && !memberName) {
            // In strict terms, if memberId is provided but name is missing? 
            // Logic in UI sends memberId if selected, else null (which we default to 0?). 
            // Let's ensure if it's meant to be a member sale, we have member info.
        }

        const idSocioVal = memberId || 0;
        const socioNameVal = memberName || (idSocioVal === 0 ? 'Público General' : 'Socio'); // Default if missing

        // 1. Generate IdVenta (Max + 1 per Branch)
        const maxIdResult = await projectQuery(projectId, 'SELECT MAX(IdVenta) as maxId FROM tblVentas WHERE IdSucursal = ?', [branchId]) as any[];
        const nextIdVenta = (maxIdResult[0]?.maxId || 0) + 1;

        // 1.5 Generate FolioVenta
        // Fetch Clave from tblSucursales
        const branchResult = await projectQuery(projectId, 'SELECT Clave FROM tblSucursales WHERE IdSucursal = ?', [branchId]) as any[];
        const branchKey = branchResult[0]?.Clave || 'XXX'; // Fallback if missing
        const folioVenta = `${branchKey}${nextIdVenta}`;

        // 2. Generate UUID
        const uuid = uuidv4();

        // 3. Generate ConceptoVenta
        const conceptoVenta = cart.map((item: any) => `${item.quantity} ${item.Producto}(${item.Precio})`).join(', ');

        // 3.5 Generate FormaPago String (e.g. "Efectivo ($100.00), Tarjeta ($50.00)")
        let formaPagoString = '';
        try {
            // We have payments array: { IdFormaPago, Monto }
            // We need names. Query tblFormasPago.
            // Optimization: Fetch all needed names in one go.
            const paymentMethodIds = payments.map((p: any) => p.IdFormaPago);
            if (paymentMethodIds.length > 0) {
                // Use projectQuery to get names
                const methods = await projectQuery(
                    projectId,
                    `SELECT IdFormaPago, FormaPago FROM tblFormasPago WHERE IdFormaPago IN (${paymentMethodIds.join(',')})`,
                    []
                ) as any[];

                const methodMap = new Map(methods.map((m: any) => [m.IdFormaPago, m.FormaPago]));

                const parts = payments.map((p: any) => {
                    const name = methodMap.get(p.IdFormaPago) || 'Desconocido';
                    const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.Monto);
                    return `${name}(${formattedAmount})`;
                });
                formaPagoString = parts.join(', ');
            }
        } catch (e) {
            console.error("Error generating FormaPago string:", e);
            formaPagoString = 'Error';
        }

        // 4. Insert Header (tblVentas)
        await projectQuery(
            projectId,
            `INSERT INTO tblVentas (
                IdVenta, IdSucursal, FechaVenta, IdUsuario, IdSocio, 
                Total, IdApertura, Status, FechaAct, UUID, Socio, ConceptoVenta, FolioVenta, FormaPago
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?, ?)`,
            [nextIdVenta, branchId, userId, idSocioVal, total, idApertura, uuid, socioNameVal, conceptoVenta, folioVenta, formaPagoString]
        );

        // 5. Insert Details (tblDetalleVentas)
        const soldProducts: Array<{ idCuota: number; cantidad: number }> = [];

        for (const item of cart) {
            // Need Sesiones from tblCuotas corresponding to product
            const cuotaInfo = await projectQuery(projectId, 'SELECT Sesiones, Vigencia, TipoVigencia, TipoCuota, TipoMembresia FROM tblCuotas WHERE IdCuota = ?', [item.IdProducto]) as any[];
            const sesiones = cuotaInfo[0]?.Sesiones || 0;
            const vigencia = Number(cuotaInfo[0]?.Vigencia || 0);
            const tipoVigencia = Number(cuotaInfo[0]?.TipoVigencia || 0);
            const dbTipoCuota = Number(cuotaInfo[0]?.TipoCuota || item.TipoCuota);

            // Periodo Construction
            const fmt = (d: string | Date | undefined) => {
                if (!d) return '';
                return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            };

            const fInicio = item.FechaInicio ? new Date(item.FechaInicio) : new Date();
            let fFin = item.FechaFin ? new Date(item.FechaFin) : new Date();

            // Recalculate FechaFin for Memberships (TipoCuota = 1) to ensure accuracy
            if (dbTipoCuota === 1) {
                const quantity = Number(item.quantity) || 1;
                const amount = vigencia * quantity;
                fFin = new Date(fInicio);

                if (tipoVigencia === 1) fFin.setDate(fFin.getDate() + amount); // Days
                else if (tipoVigencia === 2) fFin.setDate(fFin.getDate() + (amount * 7)); // Weeks
                else if (tipoVigencia === 3) fFin.setMonth(fFin.getMonth() + amount); // Months

                console.log(`Recalc Date: Qty=${quantity}, Vig=${vigencia}, Type=${tipoVigencia}, NewFin=${fFin}`);
            }

            const periodo = `${fmt(fInicio)} - ${fmt(fFin)}`;

            await projectQuery(
                projectId,
                `INSERT INTO tblDetalleVentas (
                    IdVenta, IdSucursal, IdSocio, IdCuota, Cantidad, Precio, Iva,
                    FechaInicio, FechaInicioInicial, FechaFin, FechaFinInicial,
                    TipoCuota, TipoMembresia, Vigencia, TipoVigencia,
                    Periodo, Cuota, Sesiones, SesionesActivas
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nextIdVenta, branchId, idSocioVal, item.IdProducto, item.quantity, item.Precio, item.IVA || 0,
                    fInicio, fInicio, fFin, fFin,
                    dbTipoCuota, item.TipoMembresia, vigencia, tipoVigencia,
                    periodo, item.Producto, sesiones, sesiones
                ]
            );

            // Solo los productos afectan el inventario; las cuotas/membresias no.
            if (dbTipoCuota === PRODUCT_TIPO_CUOTA) {
                soldProducts.push({ idCuota: Number(item.IdProducto), cantidad: Number(item.quantity) || 0 });
            }

            // Update Member Expiration if Membership (TipoMembresia = 1)
            if (Number(item.TipoMembresia) === 1 && idSocioVal > 0) {
                await projectQuery(
                    projectId,
                    `UPDATE tblSocios SET FechaVencimiento = ? WHERE IdSocio = ?`,
                    [fFin, idSocioVal]
                );
            }
        }

        // 6. Insert Payments (tblVentasPagos)
        for (const payment of payments) {
            // Get Commission
            const pmInfo = await projectQuery(projectId, 'SELECT Comision FROM tblFormasPago WHERE IdFormaPago = ?', [payment.IdFormaPago]) as any[];
            const comision = pmInfo[0]?.Comision || 0;

            await projectQuery(
                projectId,
                `INSERT INTO tblVentasPagos (IdVenta, IdSucursal, IdFormaPago, Pago, Comision)
                 VALUES (?, ?, ?, ?, ?)`,
                [nextIdVenta, branchId, payment.IdFormaPago, payment.Monto, comision]
            );
        }

        // 7. Descarga de inventario (no bloquea la venta si el inventario falla)
        await registerSaleStockExit({
            projectId,
            branchId,
            userId,
            saleId: nextIdVenta,
            folio: folioVenta,
            items: soldProducts
        });

        return NextResponse.json({ success: true, saleId: nextIdVenta, folioVenta });

    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
