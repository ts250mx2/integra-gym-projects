'use client';

import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    product: any | null;
}

export default function ProductModal({ isOpen, onClose, onSave, product }: ProductModalProps) {
    const tCommon = useTranslations('Common');
    // Using a fallback for specific product labels if not yet in i18n
    // Ideally we would add them to messages/es.json etc.
    // For now hardcoding labels or assuming they might exist or using generic placeholders

    const [gymCountry, setGymCountry] = useState('MX');
    const [isPriceFocused, setIsPriceFocused] = useState(false);
    const [formData, setFormData] = useState({
        CodigoBarras: '',
        Cuota: '', // Changed from Producto
        Precio: '',
        IVA: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchGymConfig();
    }, []);

    const fetchGymConfig = async () => {
        try {
            const res = await fetch('/api/gym-config');
            if (res.ok) {
                const data = await res.json();
                setGymCountry(data.country || 'MX');
            }
        } catch (error) {
            console.error('Error fetching gym config:', error);
        }
    };

    const formatCurrency = (amount: number) => {
        const locale = gymCountry === 'MX' ? 'es-MX' : 'en-US';
        const currency = gymCountry === 'MX' ? 'MXN' : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    };

    useEffect(() => {
        if (product) {
            setFormData({
                CodigoBarras: product.CodigoBarras || '',
                Cuota: product.Cuota || '', // Changed from Producto
                Precio: product.Precio || '',
                IVA: product.IVA || ''
            });
        } else {
            setFormData({
                CodigoBarras: '',
                Cuota: '',
                Precio: '',
                IVA: ''
            });
        }
    }, [product, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = product ? 'PUT' : 'POST';
            const body = {
                ...formData,
                IdCuota: product?.IdCuota
            };

            const response = await fetch('/api/products', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to save product');

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '2rem'
        }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={24} />
                        {product ? 'Editar Producto' : 'Agregar Producto'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label className="label-text">Código de Barras</label>
                        <input
                            className="input-field"
                            value={formData.CodigoBarras}
                            onChange={(e) => setFormData({ ...formData, CodigoBarras: e.target.value })}
                            placeholder="Ej. 123456789"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="label-text">Nombre del Producto</label>
                        <input
                            className="input-field"
                            value={formData.Cuota} // Changed from Producto
                            onChange={(e) => setFormData({ ...formData, Cuota: e.target.value })}
                            required
                            placeholder="Ej. Membresía Mensual"
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label className="label-text">Precio</label>
                            <input
                                type="text"
                                className="input-field"
                                value={isPriceFocused ? formData.Precio : formatCurrency(Number(formData.Precio) || 0)}
                                onFocus={() => setIsPriceFocused(true)}
                                onBlur={() => setIsPriceFocused(false)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^\d*\.?\d*$/.test(val)) {
                                        setFormData({ ...formData, Precio: val });
                                    }
                                }}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="label-text">Impuestos (%)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.IVA}
                                onChange={(e) => setFormData({ ...formData, IVA: e.target.value })}
                                placeholder="16"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} style={{ marginRight: '1rem', background: 'none', border: 'none', color: 'var(--foreground)', opacity: 0.7, cursor: 'pointer' }}>
                            {tCommon('cancel')}
                        </button>
                        <button type="submit" className="btn-primary" style={{ minWidth: '160px' }} disabled={isSaving}>
                            {isSaving ? tCommon('saving') : tCommon('saveChanges')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
