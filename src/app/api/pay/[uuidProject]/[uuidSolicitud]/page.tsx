'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShoppingBag, User, CreditCard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// CheckoutForm handles the actual payment submission
function CheckoutForm({ clientSecret, total, onPaymentSuccess }: { clientSecret: string; total: number; onPaymentSuccess: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href, // Or a dedicated success page
            },
            redirect: 'if_required',
        });

        if (error) {
            setMessage(error.message || 'Error inesperado');
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            setMessage('¡Pago exitoso!');
            onPaymentSuccess();
        } else {
            setMessage('Estado de pago desconocido');
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <PaymentElement />
            <button
                disabled={isProcessing || !stripe || !elements}
                className="btn-primary"
                style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    marginTop: '0.5rem',
                    background: 'var(--neon-blue)',
                    color: 'black',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
            >
                {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                {isProcessing ? 'Procesando...' : `Pagar ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}`}
            </button>
            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    background: message.includes('exitoso') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.includes('exitoso') ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                    textAlign: 'center',
                    fontSize: '0.875rem'
                }}>
                    {message}
                </div>
            )}
        </form>
    );
}

export default function PayPage() {
    const params = useParams();
    const uuidProject = params.uuidProject as string;
    const uuidSolicitud = params.uuidSolicitud as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        if (!uuidProject || !uuidSolicitud) return;

        async function init() {
            try {
                // 1. Fetch details and public key
                const detailsRes = await fetch(`/api/pay/details?uuidProject=${uuidProject}&uuidSolicitud=${uuidSolicitud}`);
                if (!detailsRes.ok) throw new Error('Error al obtener detalles');
                const detailsData = await detailsRes.json();
                setData(detailsData);

                // 2. Initialize Stripe
                setStripePromise(loadStripe(detailsData.project.publicKey));

                // 3. Create PaymentIntent to get clientSecret
                const checkoutRes = await fetch('/api/pay/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uuidProject, uuidSolicitud })
                });
                if (!checkoutRes.ok) throw new Error('Error al crear checkout');
                const checkoutData = await checkoutRes.json();
                setClientSecret(checkoutData.clientSecret);

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [uuidProject, uuidSolicitud]);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--neon-blue)' }}>
            <Loader2 size={48} className="animate-spin" />
            <p>Cargando pago...</p>
        </div>
    );

    if (error) return (
        <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: '400px', width: '100%' }}>
                <AlertCircle size={48} style={{ color: 'rgb(239, 68, 68)', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Vaya...</h2>
                <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
        </div>
    );

    if (paid) return (
        <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '3rem', maxWidth: '400px', width: '100%' }}>
                <CheckCircle size={64} style={{ color: '#22c55e', marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: 'white' }}>¡Gracias!</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Tu pago ha sido procesado correctamente.</p>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
            {/* Header / Brand */}
            <div style={{
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0))',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                {data.project.logo && (
                    <img
                        src={data.project.logo}
                        alt={data.project.title}
                        style={{ height: '60px', marginBottom: '1rem', objectFit: 'contain' }}
                    />
                )}
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                    {data.project.title}
                </h1>
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
                {/* Member Info */}
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'rgba(0, 243, 255, 0.1)',
                        color: 'var(--neon-blue)',
                        padding: '0.75rem',
                        borderRadius: '12px'
                    }}>
                        <User size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Socio</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{data.member.name}</div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(0, 243, 255, 0.7)' }}>Código: {data.member.code}</div>
                    </div>
                </div>

                {/* Purchase Summary */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
                        <ShoppingBag size={18} />
                        <span style={{ fontWeight: 600 }}>Resumen de Compra</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {data.items.map((item: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{item.descripcion}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {item.cantidad} x {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.precio)}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 600 }}>
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.total)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '1.25rem 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>Total a Pagar</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neon-blue)' }}>
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(data.total)}
                        </div>
                    </div>
                </div>

                {/* Stripe Payment */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    {clientSecret && stripePromise ? (
                        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#00f3ff' } } }}>
                            <CheckoutForm clientSecret={clientSecret} total={data.total} onPaymentSuccess={() => setPaid(true)} />
                        </Elements>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                             Cargando pasarela de pago...
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                    Pago seguro procesado por Stripe
                </div>
            </div>
        </div>
    );
}
