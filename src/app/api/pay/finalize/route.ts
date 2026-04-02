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

        // 3. Connect to project-specific database and update solicitation
        const pool = await getProjectConnectionPool(IdProyecto, project);

        // Update solicitation record
        await pool.execute(
            `UPDATE tblSolicitudesStripe 
             SET Pagado = 1, 
                 PaymentMethod = ?, 
                 CustomerId = ?, 
                 PaymentIntent = ?
             WHERE UUID = ?`,
            [
                paymentMethodId,
                customerId,
                paymentIntentId,
                uuidSolicitud
            ]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error (pay/finalize):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
