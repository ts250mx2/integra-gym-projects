'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShoppingBag, User, CreditCard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Stripe CheckoutForm handles the actual payment submission
function CheckoutForm({ clientSecret, total, onPaymentSuccess }: { clientSecret: string; total: number; onPaymentSuccess: (id: string) => Promise<void> }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [elementReady, setElementReady] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !acceptedTerms) return;

        setIsProcessing(true);
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required',
        });

        if (error) {
            setMessage(error.message || 'Ocurrió un error inesperado.');
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            await onPaymentSuccess(paymentIntent.id);
        } else {
            setMessage('Estado de pago no reconocido.');
        }
        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ minHeight: '120px', position: 'relative' }}>
                {!elementReady && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                        <Loader2 className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                        Cargando componentes de pago de Stripe...
                    </div>
                )}
                <PaymentElement 
                    onReady={() => setElementReady(true)} 
                    options={{ layout: 'tabs' }}
                />
            </div>

            {/* Recurring Charges Checkbox */}
            <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                padding: '1rem', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)',
                alignItems: 'flex-start',
                cursor: 'pointer'
            }} onClick={() => setAcceptedTerms(!acceptedTerms)}>
                <input 
                    type="checkbox" 
                    id="recurring-terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    style={{ 
                        marginTop: '0.2rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: 'var(--neon-blue)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
                <label 
                    htmlFor="recurring-terms" 
                    style={{ 
                        fontSize: '0.8rem', 
                        lineHeight: '1.4', 
                        color: acceptedTerms ? 'var(--foreground)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    Estoy consciente de que se me generarán cargos automáticos al finalizar el mes, con múltiples intentos hasta que se realice el pago. Si deseo cancelar la recurrencia, deberé avisar por escrito a la recepción 30 días naturales antes.
                </label>
            </div>
            
            <button
                disabled={isProcessing || !stripe || !elements || !elementReady || !acceptedTerms}
                className="btn-primary"
                style={{
                    width: '100%',
                    padding: '1.25rem',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    background: (elementReady && acceptedTerms) ? 'var(--neon-blue)' : '#333',
                    color: '#000',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: (elementReady && acceptedTerms) ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease',
                    opacity: (isProcessing || !elementReady || !acceptedTerms) ? 0.7 : 1,
                    marginTop: '0.5rem'
                }}
            >
                {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard size={22} />}
                {isProcessing ? 'Procesando...' : `Pagar ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}`}
            </button>
            {message && <div style={{ color: '#ef4444', textAlign: 'center', fontSize: '0.875rem', marginTop: '1rem' }}>{message}</div>}
        </form>
    );
}

// Main payment logic (wrapped in Suspense for searchParams)
function PayContent() {
    const searchParams = useSearchParams();
    const uuidProject = searchParams.get('UUIDProject');
    const uuidSolicitud = searchParams.get('UUIDSolicitud');

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [stripeObj, setStripeObj] = useState<Stripe | null>(null);
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        if (!uuidProject || !uuidSolicitud) {
            setError('Faltan parámetros de pago (UUIDProject / UUIDSolicitud)');
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
                // 1. Fetch Details & Public Key
                const detailsRes = await fetch(`/api/pay/details?uuidProject=${uuidProject}&uuidSolicitud=${uuidSolicitud}`);
                if (!detailsRes.ok) {
                    const errDetail = await detailsRes.json();
                    throw new Error(errDetail.error || 'Error al obtener detalles del pago');
                }
                const detailsData = await detailsRes.json();
                setData(detailsData);

                if (detailsData.isPaid) {
                    setPaid(true);
                    setLoading(false);
                    return;
                }

                if (!detailsData.project.publicKey) {
                    throw new Error('Configuración de Stripe incompleta (falta llave pública)');
                }

                // 2. Initialize Stripe Object
                const stripe = await loadStripe(detailsData.project.publicKey);
                if (!stripe) throw new Error('No se pudo cargar el SDK de Stripe. Verifica tu conexión.');
                setStripeObj(stripe);

                // 3. Create Checkout / PaymentIntent
                const checkoutRes = await fetch('/api/pay/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uuidProject, uuidSolicitud })
                });
                
                if (!checkoutRes.ok) {
                    const errCheckout = await checkoutRes.json();
                    throw new Error(errCheckout.error || 'Error al iniciar la pasarela de pago');
                }
                
                const checkoutData = await checkoutRes.json();
                if (!checkoutData.clientSecret) {
                     throw new Error('No se recibió el clientSecret del servidor');
                }
                setClientSecret(checkoutData.clientSecret);

            } catch (err: any) {
                console.error('PayPage Init Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [uuidProject, uuidSolicitud]);

    const handlePaymentSuccess = async (paymentIntentId: string) => {
        setFinalizing(true);
        try {
            const finalizeRes = await fetch('/api/pay/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuidProject, uuidSolicitud, paymentIntentId })
            });

            if (!finalizeRes.ok) throw new Error('Pago realizado pero hubo un error al actualizar los registros el servidor.');
            
            setPaid(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFinalizing(false);
        }
    };

    if (loading || finalizing) return (
        <div style={{ height: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <Loader2 size={48} color="var(--neon-blue)" className="animate-spin" />
            <p style={{ color: 'var(--text-secondary)' }}>{finalizing ? 'Finalizando transacción...' : 'Preparando tu pago...'}</p>
        </div>
    );

    if (error) return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '2.5rem 1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>No se pudo procesar</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{error}</p>
            </div>
        </div>
    );

    if (paid) return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '3rem 1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>¡Pago Confirmado!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tu transacción se completó con éxito.</p>
                <div style={{ marginTop: '2rem', padding: '1rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                     <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Comprobante enviado a tu correo.</p>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ paddingBottom: '3rem' }}>
            {/* Logo & Title */}
            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                {data.project.logo && (
                    <img src={data.project.logo} alt="Logo" style={{ height: '70px', marginBottom: '1.5rem', maxWidth: '100%', objectFit: 'contain' }} />
                )}
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{data.project.title}</h1>
            </div>

            {/* Member Card */}
            <div style={{ padding: '0 1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 243, 255, 0.03)' }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        background: 'rgba(0, 243, 255, 0.1)', 
                        borderRadius: '12px', 
                        color: 'var(--neon-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                    }}>
                        {data.member.photo ? (
                            <img src={data.member.photo} alt="Member" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <User size={28} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Información del Socio</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{data.member.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--neon-blue)' }}>ID: {data.member.code}</div>
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', opacity: 0.7 }}>
                        <ShoppingBag size={18} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Resumen del Pago</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {data.items.map((item: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{item.descripcion}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.cantidad} unidad(es)</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.total)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Total</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--neon-blue)' }}>
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(data.total)}
                        </span>
                    </div>
                </div>

                {/* Stripe Element Container - Note: Removed backdrop-filter to ensure iframe visibility */}
                <div style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px', 
                    padding: '1.5rem', 
                    minHeight: '280px' 
                }}>
                    {clientSecret && stripeObj ? (
                        <Elements 
                            key={clientSecret} 
                            stripe={stripeObj} 
                            options={{ 
                                clientSecret,
                                appearance: {
                                    variables: {
                                        colorPrimary: '#00f3ff',
                                        colorBackground: '#1a1a1a',
                                        colorText: '#ffffff',
                                        colorDanger: '#df1b41',
                                        fontFamily: 'Inter, system-ui, sans-serif',
                                        spacingUnit: '4px',
                                        borderRadius: '8px',
                                    },
                                }
                            }}
                        >
                            <CheckoutForm clientSecret={clientSecret} total={data.total} onPaymentSuccess={handlePaymentSuccess} />
                        </Elements>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            {clientSecret ? (
                                <p>Error: El cliente secreto está presente pero el SDK de Stripe no se inicializó correctamente.</p>
                            ) : (
                                <>
                                    <Loader2 className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                    Cargando pasarela segura...
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PayPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
            <Suspense fallback={<div>Cargando...</div>}>
                <PayContent />
            </Suspense>
        </div>
    );
}
