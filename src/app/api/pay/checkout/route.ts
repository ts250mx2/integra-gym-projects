import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getProjectByUUID, getProjectConnectionPool } from '@/lib/projectDb';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { uuidProject, uuidSolicitud } = body;

        if (!uuidProject || !uuidSolicitud) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const project = await getProjectByUUID(uuidProject);
        const { IdProyecto } = project;

        // Fetch Stripe Private Key from tblParametros in BDIntegraProjects
        const stripeParams = await query(
            'SELECT Campo, Valor FROM tblParametros WHERE IdProyecto = ? AND Grupo = "Stripe"',
            [IdProyecto]
        ) as any[];

        const privateKey = stripeParams.find(p => p.Campo === 'API_KEY_PRIVATE')?.Valor;

        if (!privateKey) {
            return NextResponse.json({ error: 'Stripe configuration missing (Private Key)' }, { status: 500 });
        }

        // Establish connection to project-specific database
        const pool = await getProjectConnectionPool(IdProyecto, project);

        // Fetch Solicitation Info (to get Socio name)
        const [solicitationRows]: any = await pool.execute(
            'SELECT Socio FROM tblSolicitudesStripe WHERE UUID = ?',
            [uuidSolicitud]
        );

        if (solicitationRows.length === 0) {
            return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
        }

        const socioName = solicitationRows[0].Socio;

        // Fetch Solicitation Details to calculate total
        const [detailsRows]: any = await pool.execute(
            'SELECT Cantidad, Precio FROM tblDetalleSolicitudesStripe WHERE UUID = ?',
            [uuidSolicitud]
        );

        if (detailsRows.length === 0) {
            return NextResponse.json({ error: 'No details found for this solicitation' }, { status: 404 });
        }

        const totalAmount = detailsRows.reduce((acc: number, d: any) => {
            return acc + ((d.Cantidad || 0) * (d.Precio || 0));
        }, 0);

        if (totalAmount <= 0) {
            return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 });
        }

        const stripe = new Stripe(privateKey, {
            apiVersion: '2023-10-16' as any,
        });

        // 1. Search for customer by name in Stripe
        let customerId: string | undefined;
        try {
            const customers = await stripe.customers.search({
                query: `name:'${socioName.replace(/'/g, "\\'")}'`,
            });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            } else {
                // 2. Create customer if not found
                const newCustomer = await stripe.customers.create({
                    name: socioName,
                    metadata: {
                        uuidProject,
                        uuidSolicitud
                    }
                });
                customerId = newCustomer.id;
            }
        } catch (err) {
            console.error('Stripe Customer search/create error:', err);
            // Fallback: Continue without customer if it fails, or throw error as preferred
        }

        // 3. Create PaymentIntent with customer ID
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Stripe uses minor units (cents)
            currency: 'mxn', // Assuming MXN (Mexican Pesos)
            customer: customerId,
            metadata: {
                uuidProject,
                uuidSolicitud
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error: any) {
        console.error('API Error (pay/checkout):', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
