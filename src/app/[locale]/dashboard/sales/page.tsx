'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Plus, User, Search, X, Package, FileSignature, IdCard, Lock } from 'lucide-react';
import Image from 'next/image';
import { printTicket } from '@/lib/ticket-utils';

// Simple Modal Component
function CashOpeningModal({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (amount: number) => void }) {
    const [amount, setAmount] = useState('');

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                background: 'var(--background)', padding: '2rem', borderRadius: '12px',
                border: '1px solid var(--neon-blue)', width: '400px', maxWidth: '90%'
            }}>
                <h3 className="neon-text" style={{ marginTop: 0 }}>Apertura de Caja</h3>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Fondo de Caja</label>
                    <input
                        type="text"
                        className="input-field"
                        value={amount}
                        onChange={e => {
                            // Only allow numbers and decimal point
                            const val = e.target.value;
                            if (/^[\d.,]*$/.test(val)) {
                                setAmount(val);
                            }
                        }}
                        onBlur={() => {
                            const val = parseFloat(amount.replace(/[^0-9.]/g, ''));
                            if (!isNaN(val)) {
                                setAmount(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val));
                            }
                        }}
                        onFocus={() => {
                            const val = parseFloat(amount.replace(/[^0-9.]/g, ''));
                            if (!isNaN(val)) {
                                setAmount(val.toString());
                            } else {
                                setAmount('');
                            }
                        }}
                        placeholder="$0.00"
                        autoFocus
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ccc', background: 'transparent', color: 'var(--foreground)' }}>
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            const val = parseFloat(amount.replace(/[^0-9.]/g, ''));
                            onSave(val || 0);
                        }}
                        style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: 'var(--neon-blue)', color: 'var(--background)', fontWeight: 'bold' }}
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// Checkout Modal
// Update Checkout Modal Props to accept extended onConfirm if needed, or just pass generic args
function CheckoutModal({ isOpen, onClose, total, onConfirm, loading }: { isOpen: boolean; onClose: () => void; total: number; onConfirm: (payments: any[], methods: any[]) => void; loading: boolean }) {
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [payments, setPayments] = useState<{ id: number, methodId: number, amount: number }[]>([]);
    const [focusedPaymentId, setFocusedPaymentId] = useState<number | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            fetch('/api/payment-methods')
                .then(res => res.json())
                .then(data => {
                    setPaymentMethods(data);
                    // Initialize with one payment covering the full total
                    if (data.length > 0) {
                        setPayments([{ id: Date.now(), methodId: data[0].IdFormaPago, amount: total }]);
                    }
                });
            setPosition({ x: 0, y: 0 }); // Reset position on open
        }
    }, [isOpen, total]);

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        // Calculate offset relative to the modal element (not window)
        // Note: Simple implementation assuming modal is centered initially or tracking delta
        // We will track delta from the mouse position
        setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    }, [isDragging, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);


    const addPayment = () => {
        const currentSum = payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = total - currentSum;
        if (remaining <= 0) return;

        // Find first payment method not already used
        const usedMethodIds = new Set(payments.map(p => p.methodId));
        const nextMethod = paymentMethods.find(pm => !usedMethodIds.has(pm.IdFormaPago));

        if (nextMethod) {
            setPayments([...payments, { id: Date.now(), methodId: nextMethod.IdFormaPago, amount: remaining }]);
        } else {
            // Fallback if all taken (should ideally disable button, but for safety)
            // or maybe reuse last logic if business logic allowed duplicates (user said no)
            // We'll just alert or do nothing if no more methods available?
            // Actually, disabling the button is better UI, but let's just use the first available logic here
            if (paymentMethods.length > 0) {
                // Even if used, logic prevents it? No, user explicitly said "no se debe de repetir"
                // So if no unique method available, don't add
                return;
            }
        }
    };

    const removePayment = (id: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter(p => p.id !== id));
        }
    };

    const updatePayment = (id: number, field: 'methodId' | 'amount', value: number) => {
        setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const currentTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const difference = total - currentTotal;

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div
                style={{
                    background: 'var(--background)', // Use theme background
                    padding: '2rem', borderRadius: '12px',
                    border: '1px solid var(--neon-blue)', width: '500px', maxWidth: '95%',
                    position: 'relative',
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
            >
                {/* Header / Drag Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem',
                        margin: '-1rem -1rem 1.5rem -1rem', padding: '1rem'
                    }}
                >
                    <h3 className="neon-text" style={{ margin: 0 }}>Cierre de Venta (Pago Mixto)</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                    </div>
                    <div style={{ opacity: 0.7 }}>Total a Pagar</div>
                </div>

                <div style={{ marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {payments.map((payment, index) => (
                        <div key={payment.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                            <select
                                className="input-field"
                                style={{ flex: 2 }}
                                value={payment.methodId}
                                onChange={e => updatePayment(payment.id, 'methodId', Number(e.target.value))}
                            >
                                {paymentMethods.map(pm => {
                                    // Disable option if used by OTHER payment row
                                    const isUsed = payments.some(p => p.methodId === pm.IdFormaPago && p.id !== payment.id);
                                    if (isUsed) return null; // Or render disabled option? Better to hide or disable.
                                    // User said "no se debe de repetir", so hiding is cleaner or disabling. 
                                    // Let's hide it to avoid confusion or keep it simple.
                                    // Actually, standard practice is to show but disable or filter out.
                                    // Let's filter out for cleaner UI.
                                    return (
                                        <option key={pm.IdFormaPago} value={pm.IdFormaPago} style={{ color: 'black' }}>
                                            {pm.FormaPago}
                                        </option>
                                    )
                                })}
                            </select>
                            <input
                                type="text"
                                className="input-field"
                                style={{ flex: 1, textAlign: 'right' }}
                                value={focusedPaymentId === payment.id ? payment.amount : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payment.amount)}
                                onChange={e => {
                                    // Allow numbers and decimal point
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    updatePayment(payment.id, 'amount', val === '' ? 0 : parseFloat(val));
                                }}
                                onFocus={() => setFocusedPaymentId(payment.id)}
                                onBlur={() => setFocusedPaymentId(null)}
                                onClick={e => (e.target as HTMLInputElement).select()}
                            />
                            {payments.length > 1 && (
                                <button
                                    onClick={() => removePayment(payment.id)}
                                    style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0 0.5rem' }}
                                >✕</button>
                            )}
                        </div>
                    ))}

                    <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                        <button
                            onClick={addPayment}
                            disabled={difference <= 0 || payments.length >= paymentMethods.length}
                            style={{
                                background: 'transparent', border: '1px dashed var(--neon-blue)', color: 'var(--neon-blue)',
                                borderRadius: '6px', padding: '0.3rem 0.8rem', cursor: difference <= 0 ? 'not-allowed' : 'pointer',
                                opacity: difference <= 0 ? 0.5 : 1
                            }}
                        >
                            + Agregar Pago
                        </button>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: Math.abs(difference) < 0.01 ? 'var(--neon-green)' : '#ff4444' }}>
                        <span>Restante:</span>
                        <span style={{ fontWeight: 'bold' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(difference)}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ccc', background: 'transparent', color: 'var(--foreground)' }}>
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            const payloadPayments = payments.map(p => ({ IdFormaPago: p.methodId, Monto: p.amount }));
                            onConfirm(payloadPayments, paymentMethods);
                        }}
                        disabled={loading || Math.abs(difference) > 0.01}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '6px', border: 'none',
                            background: Math.abs(difference) > 0.01 ? '#555' : 'var(--neon-blue)',
                            color: 'var(--background)', fontWeight: 'bold',
                            cursor: Math.abs(difference) > 0.01 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Procesando...' : 'Confirmar Venta'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Close Register Modal
function CloseRegisterModal({ isOpen, onClose, registerDetails, onConfirm, loading }: { isOpen: boolean; onClose: () => void; registerDetails: any; onConfirm: () => void; loading: boolean }) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    }, [isDragging, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!isOpen) return null;

    const fondo = registerDetails?.FondoCaja || 0;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div
                style={{
                    background: 'var(--background)', // Solid background from theme
                    padding: '2rem', borderRadius: '12px',
                    border: '1px solid var(--neon-purple)', width: '400px', maxWidth: '90%',
                    position: 'relative',
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
            >
                {/* Header / Drag Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem',
                        margin: '-1rem -1rem 1.5rem -1rem', padding: '1rem'
                    }}
                >
                    <h3 className="neon-text" style={{ margin: 0, color: 'var(--neon-purple)' }}>Corte de Caja</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span>Fondo Inicial:</span>
                        <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fondo)}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                        Al confirmar, se calculará el total de ventas y se cerrará la sesión actual.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '6px',
                            border: '1px solid #4B5563', background: 'transparent',
                            color: 'var(--foreground)', cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="btn-primary" // Use same class as sales button
                        style={{ justifyContent: 'center', padding: '0.5rem 1rem', fontSize: '1rem' }}
                    >
                        {loading ? 'Cerrando...' : 'Confirmar Corte'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SalesPage() {
    const t = useTranslations('Sidebar');

    // Register State
    const [registerStatus, setRegisterStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false); // Opening Modal
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null); // For Success Modal // Checkout Modal
    const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false); // Close Reg Modal
    const [processingSale, setProcessingSale] = useState(false);
    const [processingClose, setProcessingClose] = useState(false);

    // POS State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    // Member Selection State
    const [isPublicGeneral, setIsPublicGeneral] = useState(true);
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [memberResults, setMemberResults] = useState<any[]>([]);
    const [searchingMember, setSearchingMember] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/sales/register/status');
            const data = await res.json();
            setRegisterStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // Search Logic (Debounced or on Enter)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.length > 2) {
                performSearch(searchTerm);
            } else if (searchTerm.length === 0) {
                performSearch(''); // Fetch defaults
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Initial Load
    useEffect(() => {
        performSearch('');
    }, []);

    // Member Search Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (memberSearchTerm.length > 2) {
                performMemberSearch(memberSearchTerm);
            } else {
                setMemberResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [memberSearchTerm]);

    const performMemberSearch = async (query: string) => {
        setSearchingMember(true);
        try {
            const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setMemberResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setSearchingMember(false);
        }
    };

    const performSearch = async (query: string) => {
        setSearching(true);
        try {
            const res = await fetch(`/api/sales/products/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setSearching(false);
        }
    };

    // Cart Logic
    // Date Helpers
    const calculateEndDate = (startDate: Date, amount: number, type: number): Date => {
        const newDate = new Date(startDate);
        if (type === 0) return newDate; // Same day
        if (type === 1) newDate.setDate(newDate.getDate() + amount); // Days
        if (type === 2) newDate.setDate(newDate.getDate() + (amount * 7)); // Weeks
        if (type === 3) newDate.setMonth(newDate.getMonth() + amount); // Months
        return newDate;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const addToCart = async (product: any) => {
        // Validation: If Member product (TipoCuota == 1), check if same TipoMembresia exists
        if (product.TipoCuota === 1) {
            const existingMembership = cart.find(item => item.TipoCuota === 1 && item.TipoMembresia === product.TipoMembresia);
            if (existingMembership) {
                alert("No está permitido tener más de una cuota con el mismo tipo de membresía.");
                return;
            }
        }

        const existingItemIndex = cart.findIndex(item => item.IdProducto === product.IdProducto);

        if (existingItemIndex >= 0) {
            // Update quantity of existing
            updateQuantity(existingItemIndex, 1);
        } else {
            let newItem = { ...product, quantity: 1, period: '' };

            // Logic for Membership (TipoCuota = 1)
            if (product.TipoCuota === 1 && selectedMember) {
                try {
                    // Use FechaVencimiento from selectedMember if available
                    // The requirement:
                    // If FechaVencimiento < CurDate -> Start = CurDate
                    // If FechaVencimiento > CurDate -> Start = FechaVencimiento

                    const now = new Date();
                    let fechaInicio = now;

                    if (selectedMember.FechaVencimiento) {
                        const fecVenc = new Date(selectedMember.FechaVencimiento);
                        // Be careful with timezones, usually we want to compare dates only?
                        // Assuming FechaVencimiento is a date or datetime.
                        if (fecVenc > now) {
                            fechaInicio = fecVenc;
                        }
                    }

                    const vigencia = Number(product.Vigencia || 0);
                    const tipoVigencia = Number(product.TipoVigencia || 0);

                    const fechaFin = calculateEndDate(fechaInicio, vigencia * 1, tipoVigencia); // Quantity 1 initially

                    newItem.FechaInicio = fechaInicio;
                    newItem.originalStartDate = new Date(fechaInicio); // Store original for validation
                    newItem.FechaFin = fechaFin;
                    newItem.period = `${formatDate(fechaInicio)} - ${formatDate(fechaFin)}`;

                } catch (e) {
                    console.error("Error setting dates", e);
                }
            }

            setCart([...cart, newItem]);
        }
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const updateQuantity = (index: number, change: number) => {
        setCart(cart.map((item, i) => {
            if (i === index) {
                const newQuantity = Math.max(1, item.quantity + change);
                let updatedItem = { ...item, quantity: newQuantity };

                // Recalculate dates if membership
                if (item.TipoCuota === 1 && item.FechaInicio) {
                    const vigencia = Number(item.Vigencia || 0);
                    const tipoVigencia = Number(item.TipoVigencia || 0);
                    const fechaFin = calculateEndDate(new Date(item.FechaInicio), vigencia * newQuantity, tipoVigencia);

                    updatedItem.FechaFin = fechaFin;
                    updatedItem.period = `${formatDate(new Date(item.FechaInicio))} - ${formatDate(fechaFin)}`;
                }

                return updatedItem;
            }
            return item;
        }));
    };

    const updateStartDate = (index: number, newDateString: string) => {
        setCart(cart.map((item, i) => {
            if (i === index && item.TipoCuota === 1) {
                const newDate = new Date(newDateString);
                // Adjust for timezone offset to keep strict date selection
                const adjustedDate = new Date(newDate.getTime() + newDate.getTimezoneOffset() * 60000);

                const originalDate = new Date(item.originalStartDate);

                const diffTime = Math.abs(adjustedDate.getTime() - originalDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Check positive/negative explicitly to be safe, though abs() < 7 covers both directions from center
                // Actually need to check direction if user wanted specific logic, but "mayor o menor a 7 dias" usually means range +/- 7
                if (diffDays > 7) {
                    alert("La fecha de inicio no puede variar más de 7 días de la fecha calculada.");
                    return item; // Constraint check failed
                }

                const vigencia = item.Vigencia || 0;
                const tipoVigencia = item.TipoVigencia || 0;
                const fechaFin = calculateEndDate(adjustedDate, vigencia * item.quantity, tipoVigencia);

                return {
                    ...item,
                    FechaInicio: adjustedDate,
                    FechaFin: fechaFin,
                    period: `${formatDate(adjustedDate)} - ${formatDate(fechaFin)}`
                };
            }
            return item;
        }));
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.Precio * item.quantity), 0);
    };



    const handleSelectMember = (member: any) => {
        // Clear memberships when changing member
        setCart(prev => prev.filter(item => item.TipoCuota !== 1));

        setSelectedMember(member);
        setMemberSearchTerm('');
        setMemberResults([]);
    };

    const handleOpenRegister = async (amount: number) => {
        try {
            const res = await fetch('/api/sales/register/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchStatus();
            } else {
                alert('Error al abrir caja');
            }
        } catch (error) {
            console.error(error);
            alert('Error al abrir caja');
        }
    };

    const handlePrintTicket = () => {
        if (lastSale?.id) {
            printTicket(lastSale.id);
        }
    };

    // Original inline printTicket logic removed


    const handleCheckout = async (payments: any[], paymentMethods: any[]) => {
        if (!registerStatus?.isOpen) return;

        setProcessingSale(true);
        try {
            const total = calculateTotal(); // Calculate total here
            const res = await fetch('/api/sales/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart,
                    payments,
                    total: total,
                    idApertura: registerStatus.details.IdApertura,
                    memberId: selectedMember?.IdSocio || 0,
                    memberName: isPublicGeneral ? 'Público General' : selectedMember?.Nombre
                })
            });

            const data = await res.json();
            if (data.success) {
                // Clear Cart
                setCart([]);

                // Reset Member Selection
                setIsPublicGeneral(true);
                setSelectedMember(null);
                setMemberSearchTerm('');
                setMemberResults([]);

                // Map payments to include names
                const enrichedPayments = payments.map(p => {
                    const method = paymentMethods.find((pm: any) => pm.IdFormaPago === p.IdFormaPago);
                    return { ...p, Name: method ? method.FormaPago : 'Desconocido' };
                });

                // Show success modal
                setLastSale({
                    id: data.saleId,
                    folio: data.folioVenta,
                    total: total,
                    date: new Date(),
                    user: registerStatus?.details?.Usuario,
                    items: cart, // Snapshot of cart
                    member: isPublicGeneral ? null : selectedMember,
                    payments: enrichedPayments
                });
                setIsCheckoutModalOpen(false);
            } else {
                alert('Error al procesar venta: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error al conectar con el servidor');
        } finally {
            setProcessingSale(false);
        }
    };

    const handleCloseRegister = async () => {
        if (!registerStatus?.details?.IdApertura) return;

        setProcessingClose(true);
        try {
            const res = await fetch('/api/sales/register/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idApertura: registerStatus.details.IdApertura })
            });
            const data = await res.json();

            if (res.ok) {
                alert(`Corte realizado con éxito.\nVentas Totales: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.totalSales)}`);
                setIsCloseRegisterOpen(false);
                fetchStatus(); // Refresh to show "Closed" state
            } else {
                alert('Error al cerrar caja: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setProcessingClose(false);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header */}
            <div style={{
                background: 'var(--card-bg)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <h1 className="neon-text" style={{ fontSize: '1.5rem', margin: 0 }}>
                        {t('sales')}
                    </h1>

                    {!loading && registerStatus?.isOpen && registerStatus.details ? (
                        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: 'var(--foreground)' }}>
                            <div>
                                <strong>Apertura #:</strong> {registerStatus.details.IdApertura}
                            </div>
                            <div>
                                <strong>Fecha:</strong> {new Date(registerStatus.details.FechaApertura).toLocaleDateString()} {new Date(registerStatus.details.FechaApertura).toLocaleTimeString()}
                            </div>
                            <div>
                                <strong>Usuario:</strong> {registerStatus.details.Usuario}
                            </div>
                            <div>
                                <strong>Fondo:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(registerStatus.details.FondoCaja)}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div>
                    {!loading ? (
                        registerStatus?.isOpen ? (
                            <button
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={() => setIsCloseRegisterOpen(true)}
                            >
                                <Lock size={18} />
                                Corte de Caja
                            </button>
                        ) : (
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    if (registerStatus?.isOpen) {
                                        // Logic for "Cobrar" (this seems to be the Open Register button in the current view? No, this is the header button)
                                        // Actually, wait, the "Cobrar" button is usually in the summary section (right column).
                                        // I need to find the "Cobrar" button which triggers setIsCheckoutModalOpen(true).
                                        // The button I am identifying here is "Apertura de Caja" (if !isOpen).
                                        // Or "Corte de Caja" (if isOpen).
                                        // The "Cobrar" button is elsewhere. I should look further down.
                                        setIsModalOpen(true);
                                    } else {
                                        setIsModalOpen(true);
                                    }
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Plus size={18} />
                                Apertura de Caja
                            </button>
                        )
                    ) : (
                        <span>Cargando...</span>
                    )}
                </div>
            </div>

            {/* POS Content */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '3fr 2fr',
                gap: '1rem',
                minHeight: 0,
                opacity: (!loading && !registerStatus?.isOpen) ? 0.3 : 1,
                pointerEvents: (!loading && !registerStatus?.isOpen) ? 'none' : 'auto',
                transition: 'opacity 0.3s'
            }}>
                {/* Left Column: Search */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                    {/* Member Selection Toggle */}
                    <div style={{
                        background: 'var(--card-bg)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="customerType"
                                    checked={isPublicGeneral}
                                    onChange={() => {
                                        setIsPublicGeneral(true);
                                        setSelectedMember(null);
                                        // Clear items that are not products (TipoCuota != 1)
                                        setCart(prev => prev.filter(item => item.TipoCuota !== 1));
                                    }}
                                    style={{ accentColor: 'var(--neon-blue)', width: '1.2rem', height: '1.2rem' }}
                                />
                                <span style={{ fontSize: '1.1rem', fontWeight: isPublicGeneral ? 'bold' : 'normal', color: isPublicGeneral ? 'var(--neon-blue)' : 'var(--foreground)' }}>
                                    Público General
                                </span>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="customerType"
                                    checked={!isPublicGeneral}
                                    onChange={() => setIsPublicGeneral(false)}
                                    style={{ accentColor: 'var(--neon-blue)', width: '1.2rem', height: '1.2rem' }}
                                />
                                <span style={{ fontSize: '1.1rem', fontWeight: !isPublicGeneral ? 'bold' : 'normal', color: !isPublicGeneral ? 'var(--neon-blue)' : 'var(--foreground)' }}>
                                    Buscar Socio
                                </span>
                            </label>
                        </div>

                        {!isPublicGeneral && (
                            <div style={{ flex: 1, marginLeft: '2rem', position: 'relative' }}>
                                {selectedMember ? (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--neon-blue)'
                                    }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#333' }}>
                                            {selectedMember.FotoActiva === 1 ? (
                                                <Image
                                                    src={selectedMember.ArchivoFoto}
                                                    alt={selectedMember.Nombre}
                                                    width={40}
                                                    height={40}
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <User size={24} style={{ margin: 8 }} />
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{selectedMember.Nombre}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{selectedMember.CodigoSocio}</div>
                                        </div>
                                        <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                            <X size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Buscar socio (Nombre, Código)..."
                                            value={memberSearchTerm}
                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            style={{ paddingRight: '2.5rem' }}
                                            autoFocus
                                        />
                                        <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />

                                        {/* Drilldown Results */}
                                        {(memberResults.length > 0 || searchingMember) && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                                background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px',
                                                marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                backgroundColor: 'var(--background)', // Theme-aware solid background
                                            }}>
                                                {searchingMember ? (
                                                    <div style={{ padding: '1rem', textAlign: 'center' }}>Buscando...</div>
                                                ) : (
                                                    memberResults.map(member => (
                                                        <div
                                                            key={member.IdSocio}
                                                            onClick={() => handleSelectMember(member)}
                                                            style={{
                                                                padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem',
                                                                cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                            }}
                                                            className="hover:bg-white/5"
                                                        >
                                                            <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                                                                {member.FotoActiva === 1 ? (
                                                                    <Image
                                                                        src={member.ArchivoFoto}
                                                                        alt={member.Nombre}
                                                                        width={40}
                                                                        height={40}
                                                                        style={{ objectFit: 'cover' }}
                                                                    />
                                                                ) : (
                                                                    <User size={24} style={{ margin: 8 }} />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{member.Nombre}</div>
                                                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{member.CodigoSocio}</div>
                                                                {member.FechaVencimiento && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--neon-blue)', marginTop: '0.1rem' }}>
                                                                        Vence: {new Date(member.FechaVencimiento).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: 'var(--card-bg)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        flex: 1
                    }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Buscar producto (Nombre, Código)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            disabled={!registerStatus?.isOpen}
                        />

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem' }}>
                            {searching ? (
                                <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>Buscando...</div>
                            ) : searchResults.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.8rem' }}>
                                    {searchResults.map(product => {
                                        const isRestricted = (isPublicGeneral || !selectedMember) && product.TipoCuota !== 2;
                                        return (
                                            <div
                                                key={product.IdProducto}
                                                onClick={() => !isRestricted && addToCart(product)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    cursor: isRestricted ? 'not-allowed' : 'pointer',
                                                    border: '1px solid transparent',
                                                    transition: 'all 0.2s',
                                                    opacity: isRestricted ? 0.3 : 1,
                                                    filter: isRestricted ? 'grayscale(100%)' : 'none'
                                                }}
                                                className={!isRestricted ? "hover:border-blue-400 hover:bg-white/10" : ""}
                                            >
                                                <div style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
                                                        margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--neon-blue)'
                                                    }}>
                                                        {(() => {
                                                            const tipoCuota = product.TipoCuota;
                                                            const tipoMembresia = product.TipoMembresia;

                                                            if (tipoCuota === 2) return <Package size={24} />; // Product
                                                            if (tipoCuota < 2) {
                                                                if (tipoMembresia === 0) return <FileSignature size={24} />; // Enrollment
                                                                if (tipoMembresia === 1) return <IdCard size={24} />; // Membership
                                                                if (tipoMembresia === 2) return <Lock size={20} />; // Locker
                                                            }
                                                            return <Package size={20} />; // Default fallback
                                                        })()}
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.2rem', wordBreak: 'break-word' }}>{product.Producto}</div>
                                                    <div style={{ color: 'var(--neon-purple)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.Precio)}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                    {searchTerm ? 'No se encontraron resultados' : 'Ingresa el nombre de un producto para buscar'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Cart / Ticket */}
                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 className="neon-text" style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Ticket de Venta</h3>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', opacity: 0.5, fontStyle: 'italic', marginTop: '2rem' }}>El carrito está vacío</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', fontSize: '0.8rem', opacity: 0.7 }}>
                                        <th style={{ padding: '0.5rem' }}>Prod</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Cant</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '0.5rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => (
                                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div>{item.Producto}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>${item.Precio}</div>
                                                {item.period && (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--neon-green)', marginTop: '2px' }}>
                                                        {item.TipoCuota === 1 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <span style={{ opacity: 0.7 }}>Inicio:</span>
                                                                    <input
                                                                        type="date"
                                                                        value={item.FechaInicio ? new Date(item.FechaInicio).toISOString().split('T')[0] : ''}
                                                                        onChange={(e) => updateStartDate(index, e.target.value)}
                                                                        style={{
                                                                            background: 'transparent', border: 'none', color: 'var(--neon-green)',
                                                                            fontSize: '0.75rem', fontFamily: 'inherit', padding: 0,
                                                                            width: '85px', cursor: 'pointer'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>Fin: {formatDate(new Date(item.FechaFin))}</div>
                                                            </div>
                                                        ) : (
                                                            item.period
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => updateQuantity(index, -1)}
                                                        disabled={item.TipoCuota === 1}
                                                        style={{
                                                            background: item.TipoCuota === 1 ? 'transparent' : 'rgba(255,255,255,0.1)',
                                                            border: 'none', borderRadius: '4px', width: '24px', height: '24px',
                                                            cursor: item.TipoCuota === 1 ? 'default' : 'pointer',
                                                            color: item.TipoCuota === 1 ? '#555' : 'white',
                                                            opacity: item.TipoCuota === 1 ? 0.3 : 1
                                                        }}
                                                    >-</button>
                                                    <span>{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(index, 1)}
                                                        disabled={item.TipoCuota === 1}
                                                        style={{
                                                            background: item.TipoCuota === 1 ? 'transparent' : 'rgba(255,255,255,0.1)',
                                                            border: 'none', borderRadius: '4px', width: '24px', height: '24px',
                                                            cursor: item.TipoCuota === 1 ? 'default' : 'pointer',
                                                            color: item.TipoCuota === 1 ? '#555' : 'white',
                                                            opacity: item.TipoCuota === 1 ? 0.3 : 1
                                                        }}
                                                    >+</button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                                ${(item.Precio * item.quantity).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => removeFromCart(index)}
                                                    style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}
                                                >✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Subtotal:</span>
                            <span>${calculateTotal().toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--neon-blue)' }}>
                            <span>Total:</span>
                            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}</span>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            disabled={cart.length === 0}
                            onClick={() => {
                                const hasMembership = cart.some(item => item.TipoCuota === 1);
                                if (hasMembership && (isPublicGeneral || !selectedMember)) {
                                    alert("Para vender una membresía (Cuota), debe seleccionar un socio.");
                                    return;
                                }
                                setIsCheckoutModalOpen(true);
                            }}
                        >
                            <span style={{ fontSize: '1.1rem' }}>Cobrar</span>
                        </button>
                    </div>
                </div>
            </div>

            <CashOpeningModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleOpenRegister}
            />

            {/* Checkout Modal */}
            <CheckoutModal
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                total={calculateTotal()}
                onConfirm={handleCheckout}
                loading={processingSale}
            />

            {/* Success / Print Modal */}
            {lastSale && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: '#1F2937', padding: '2rem', borderRadius: '12px', width: '400px',
                        textAlign: 'center', border: '1px solid #374151', color: 'white'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#10B981' }}>
                            ¡Venta Exitosa!
                        </h2>
                        <div style={{ marginBottom: '1.5rem', opacity: 0.8 }}>
                            <p>Folio: <strong>{lastSale.folio}</strong></p>
                            <p>Total: <strong>${lastSale.total.toFixed(2)}</strong></p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                onClick={handlePrintTicket}
                                style={{
                                    padding: '0.75rem', borderRadius: '8px', border: 'none',
                                    background: '#3B82F6', color: 'white', fontWeight: 'bold', cursor: 'pointer',
                                    fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}
                            >
                                <span>🖨️</span> Imprimir Ticket
                            </button>

                            <button
                                onClick={() => setLastSale(null)}
                                style={{
                                    padding: '0.75rem', borderRadius: '8px', border: '1px solid #4B5563',
                                    background: 'transparent', color: '#9CA3AF', cursor: 'pointer'
                                }}
                            >
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CloseRegisterModal
                isOpen={isCloseRegisterOpen}
                onClose={() => setIsCloseRegisterOpen(false)}
                registerDetails={registerStatus?.details}
                onConfirm={handleCloseRegister}
                loading={processingClose}
            />
        </div >
    );
}
