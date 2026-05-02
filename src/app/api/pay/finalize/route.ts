import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getProjectByUUID, getProjectConnectionPool } from '@/lib/projectDb';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { uuidProject, uuidSolicitud, paymentIntentId } = body;

        if (!uuidProject || !uuidSolicitud || !paymentIntentId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Resolve project and keys
        const project = await getProjectByUUID(uuidProject);
        const { IdProyecto } = project;

        const stripeParams: any = await query(
            'SELECT Valor FROM tblParametros WHERE IdProyecto = ? AND Grupo = "Stripe" AND Campo = "API_KEY_PRIVATE"',
            [IdProyecto]
        );

        if (stripeParams.length === 0) {
            return NextResponse.json({ error: 'Stripe configuration missing (Private Key)' }, { status: 500 });
        }

        const stripe = new Stripe(stripeParams[0].Valor, {
            apiVersion: '2023-10-16' as any,
        });

        // 1. Retrieve the payment intent to verify its state and get linked IDs
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return NextResponse.json({
                error: `Payment status is ${paymentIntent.status}. Expected "succeeded".`
            }, { status: 400 });
        }

        // 2. Extract needed IDs
        const customerId = (typeof paymentIntent.customer === 'string')
            ? paymentIntent.customer
            : (paymentIntent.customer?.id || '');

        const paymentMethodId = (typeof paymentIntent.payment_method === 'string')
            ? paymentIntent.payment_method
            : (paymentIntent.payment_method?.id || '');

        // 2.1 Attach and set as default payment method for future off-session charges
        if (customerId && paymentMethodId) {
            try {
                // Set as default for invoices and future payments
                await stripe.customers.update(customerId, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });
                console.log(`DEBUG (pay/finalize): Payment method ${paymentMethodId} set as default for customer ${customerId}`);
            } catch (err) {
                console.error('DEBUG (pay/finalize): Error setting default payment method:', err);
                // We don't block the process if this fails, but it's important for recurrence
            }
        }

        // 3. Connect to project-specific database and update solicitation
        const pool = await getProjectConnectionPool(IdProyecto, project);

        // Update solicitation record
        await pool.query(
            `UPDATE tblSolicitudesStripe 
             SET Pagado = 1, 
                 PaymentMethod = ?, 
                 CustomerId = ?, 
                 PaymentIntent = ?,
                 FechaPago = NOW()
             WHERE UUID = ?`,
            [
                paymentMethodId,
                customerId,
                paymentIntentId,
                uuidSolicitud
            ]
        );

        // 4. Retrieve solicitation data for subscription upsert
        console.log('DEBUG (pay/finalize): Fetching solicitation data for UUID:', uuidSolicitud);
        const [rows]: any = await pool.query(
            `SELECT IdSocio, IdSucursalSocio, IdSucursal, PagoRecurrente, IdCuotaRecurrente 
             FROM tblSolicitudesStripe 
             WHERE UUID = ?`,
            [uuidSolicitud]
        );

        if (rows && rows.length > 0) {
            try {
                const { IdSocio, IdSucursalSocio, IdSucursal, PagoRecurrente, IdCuotaRecurrente } = rows[0];

                // 5. Upsert subscription record
                console.log('DEBUG (pay/finalize): Checking existing subscription for Socio:', IdSocio, 'SucursalSocio:', IdSucursalSocio, 'Sucursal:', IdSucursal);
                const [existingSubscription]: any = await pool.query(
                    `SELECT IdSocio FROM tblSuscripcionesStripe 
                     WHERE IdSocio = ? AND IdSucursalSocio = ? AND IdSucursal = ?`,
                    [IdSocio, IdSucursalSocio, IdSucursal]
                );

                if (existingSubscription.length > 0) {
                    // Update
                    console.log('DEBUG (pay/finalize): Updating existing subscription');
                    const updateQuery = `UPDATE tblSuscripcionesStripe 
                         SET UUID = ?, 
                             PaymentMethod = ?, 
                             CustomerId = ?, 
                             PagoRecurrente = ?, 
                             IdCuotaRecurrente = ?, 
                             FechaAct = NOW(), 
                             FechaProximoPago = DATE_ADD(NOW(), INTERVAL 1 MONTH), 
                             Status = 0
                         WHERE IdSocio = ? AND IdSucursalSocio = ? AND IdSucursal = ?`;
                    const updateParams = [uuidSolicitud, paymentMethodId, customerId, PagoRecurrente, IdCuotaRecurrente, IdSocio, IdSucursalSocio, IdSucursal];
                    console.log('DEBUG (pay/finalize): Query:', updateQuery);
                    console.log('DEBUG (pay/finalize): Params:', updateParams);
                    await pool.query(updateQuery, updateParams);
                } else {
                    // Insert
                    console.log('DEBUG (pay/finalize): Inserting new subscription');
                    const insertQuery = `INSERT INTO tblSuscripcionesStripe 
                         (UUID, IdSocio, IdSucursalSocio, IdSucursal, PaymentMethod, CustomerId, PagoRecurrente, IdCuotaRecurrente, FechaAct, FechaProximoPago, Status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), 0)`;
                    const insertParams = [uuidSolicitud, IdSocio, IdSucursalSocio, IdSucursal, paymentMethodId, customerId, PagoRecurrente, IdCuotaRecurrente];
                    console.log('DEBUG (pay/finalize): Query:', insertQuery);
                    console.log('DEBUG (pay/finalize): Params:', insertParams);
                    await pool.query(insertQuery, insertParams);
                }
                console.log('DEBUG (pay/finalize): Subscription upsert successful');
            } catch (subError: any) {
                console.error('DEBUG (pay/finalize): ERROR in subscription upsert:', subError);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error (pay/finalize):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
