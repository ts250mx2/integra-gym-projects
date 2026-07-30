'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Save, Search, Trash2 } from 'lucide-react';
import ModalShell from './ModalShell';

interface PurchaseLine {
    IdCuota: number;
    Producto: string;
    CodigoBarras: string | null;
    Cantidad: number;
    Costo: number;
    Iva: number;
}

type Props = {
    onClose: () => void;
    onSaved: () => void;
};

const currency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Captura de una compra a proveedor. Solo admite productos, nunca cuotas. */
export default function PurchaseFormModal({ onClose, onSaved }: Props) {
    const t = useTranslations('Purchases');
    const ct = useTranslations('Common');

    const [providers, setProviders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    const [idProveedor, setIdProveedor] = useState('');
    const [fechaCompra, setFechaCompra] = useState(todayISO());
    const [referencia, setReferencia] = useState('');
    const [notas, setNotas] = useState('');
    const [lines, setLines] = useState<PurchaseLine[]>([]);

    const [productSearch, setProductSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();

        const loadCatalog = async () => {
            setLoadingCatalog(true);
            try {
                const [providersRes, inventoryRes] = await Promise.all([
                    fetch('/api/providers', { signal: controller.signal }),
                    fetch('/api/inventory', { signal: controller.signal })
                ]);

                const providersData = await providersRes.json();
                const inventoryData = await inventoryRes.json();

                if (Array.isArray(providersData)) setProviders(providersData);
                if (Array.isArray(inventoryData?.items)) setProducts(inventoryData.items);
            } catch (err: any) {
                if (err.name !== 'AbortError') setError(t('errorCatalog'));
            } finally {
                if (!controller.signal.aborted) setLoadingCatalog(false);
            }
        };

        loadCatalog();
        return () => controller.abort();
    }, [t]);

    const availableProducts = useMemo(() => {
        const term = productSearch.trim().toLowerCase();
        const chosen = new Set(lines.map((line) => line.IdCuota));
        return products
            .filter((product) => !chosen.has(product.IdCuota))
            .filter(
                (product) =>
                    !term ||
                    (product.Producto || '').toLowerCase().includes(term) ||
                    (product.CodigoBarras || '').toLowerCase().includes(term)
            )
            .slice(0, 8);
    }, [products, productSearch, lines]);

    const totals = useMemo(() => {
        const subtotal = lines.reduce((acc, line) => acc + line.Cantidad * line.Costo, 0);
        const iva = lines.reduce((acc, line) => acc + (line.Cantidad * line.Costo * line.Iva) / 100, 0);
        return { subtotal, iva, total: subtotal + iva };
    }, [lines]);

    const addLine = (product: any) => {
        setLines((prev) => [
            ...prev,
            {
                IdCuota: product.IdCuota,
                Producto: product.Producto,
                CodigoBarras: product.CodigoBarras || null,
                Cantidad: 1,
                Costo: Number(product.CostoPromedio) || Number(product.Costo) || 0,
                Iva: Number(product.IVA) || 0
            }
        ]);
        setProductSearch('');
    };

    const updateLine = (idCuota: number, field: 'Cantidad' | 'Costo' | 'Iva', value: string) => {
        const parsed = Number(value);
        setLines((prev) =>
            prev.map((line) => (line.IdCuota === idCuota ? { ...line, [field]: Number.isFinite(parsed) ? parsed : 0 } : line))
        );
    };

    const removeLine = (idCuota: number) => {
        setLines((prev) => prev.filter((line) => line.IdCuota !== idCuota));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!idProveedor) {
            setError(t('errorProviderRequired'));
            return;
        }
        if (lines.length === 0) {
            setError(t('errorEmptyPurchase'));
            return;
        }
        if (lines.some((line) => line.Cantidad <= 0)) {
            setError(t('errorInvalidQuantity'));
            return;
        }
        if (lines.some((line) => line.Costo < 0)) {
            setError(t('errorInvalidCost'));
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdProveedor: Number(idProveedor),
                    FechaCompra: fechaCompra,
                    Referencia: referencia,
                    Notas: notas,
                    items: lines.map((line) => ({
                        IdCuota: line.IdCuota,
                        Cantidad: line.Cantidad,
                        Costo: line.Costo,
                        Iva: line.Iva
                    }))
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error === 'productNotFound' ? t('errorProductNotFound') : t('errorSave'));
                return;
            }

            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message || t('errorSave'));
        } finally {
            setSaving(false);
        }
    };

    const cellStyle = { padding: '0.5rem', fontSize: '0.85rem' } as const;
    const numberInputStyle = { marginTop: 0, padding: '0.5rem', textAlign: 'right' as const, width: '90px' };

    return (
        <ModalShell
            title={t('newPurchase')}
            subtitle={t('newPurchaseHint')}
            maxWidth="1000px"
            onClose={onClose}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn-secondary">
                        {ct('cancel')}
                    </button>
                    <button
                        type="submit"
                        form="purchase-form"
                        className="btn-primary"
                        disabled={saving || loadingCatalog}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Save size={18} />
                        {saving ? ct('saving') : t('savePurchase')}
                    </button>
                </>
            }
        >
            <form id="purchase-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label className="label-text">{t('provider')} *</label>
                        <select
                            className="input-field"
                            value={idProveedor}
                            onChange={(e) => setIdProveedor(e.target.value)}
                            required
                        >
                            <option value="">{ct('selectOption')}</option>
                            {providers.map((provider) => (
                                <option key={provider.IdProveedor} value={provider.IdProveedor}>
                                    {provider.Proveedor}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label-text">{t('date')}</label>
                        <input
                            className="input-field"
                            type="date"
                            value={fechaCompra}
                            onChange={(e) => setFechaCompra(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label-text">{t('reference')}</label>
                        <input
                            className="input-field"
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value)}
                            placeholder={t('referencePlaceholder')}
                            maxLength={100}
                        />
                    </div>
                </div>

                <div>
                    <label className="label-text">{t('addProduct')}</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        <input
                            className="input-field"
                            style={{ paddingLeft: '2.8rem', marginTop: 0 }}
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder={loadingCatalog ? ct('loading') : t('searchProductPlaceholder')}
                            disabled={loadingCatalog}
                        />
                    </div>

                    {productSearch.trim() && (
                        <div
                            style={{
                                marginTop: '0.5rem',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                background: 'rgba(0,0,0,0.35)'
                            }}
                        >
                            {availableProducts.length === 0 ? (
                                <div style={{ padding: '0.85rem 1rem', opacity: 0.5, fontSize: '0.85rem' }}>{t('noProductsFound')}</div>
                            ) : (
                                availableProducts.map((product) => (
                                    <button
                                        key={product.IdCuota}
                                        type="button"
                                        onClick={() => addLine(product)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            padding: '0.7rem 1rem',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            color: 'var(--foreground)',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span>
                                            <strong style={{ fontSize: '0.9rem' }}>{product.Producto}</strong>
                                            <span style={{ opacity: 0.5, fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                                                {product.CodigoBarras || '-'} · {t('stock')}: {product.Existencia}
                                            </span>
                                        </span>
                                        <Plus size={16} style={{ color: 'var(--neon-blue)', flexShrink: 0 }} />
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <tr>
                                    <th style={{ ...cellStyle, textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colProduct')}</th>
                                    <th style={{ ...cellStyle, textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colQuantity')}</th>
                                    <th style={{ ...cellStyle, textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colCost')}</th>
                                    <th style={{ ...cellStyle, textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colVat')}</th>
                                    <th style={{ ...cellStyle, textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colAmount')}</th>
                                    <th style={{ ...cellStyle, width: '48px' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '1.75rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
                                            {t('noLines')}
                                        </td>
                                    </tr>
                                ) : (
                                    lines.map((line) => (
                                        <tr key={line.IdCuota} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={cellStyle}>
                                                <div style={{ fontWeight: 600 }}>{line.Producto}</div>
                                                <div style={{ opacity: 0.5, fontSize: '0.75rem' }}>{line.CodigoBarras || '-'}</div>
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>
                                                <input
                                                    className="input-field"
                                                    style={numberInputStyle}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={line.Cantidad}
                                                    onChange={(e) => updateLine(line.IdCuota, 'Cantidad', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>
                                                <input
                                                    className="input-field"
                                                    style={numberInputStyle}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={line.Costo}
                                                    onChange={(e) => updateLine(line.IdCuota, 'Costo', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>
                                                <input
                                                    className="input-field"
                                                    style={{ ...numberInputStyle, width: '70px' }}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={line.Iva}
                                                    onChange={(e) => updateLine(line.IdCuota, 'Iva', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {currency(line.Cantidad * line.Costo)}
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(line.IdCuota)}
                                                    className="btn-icon"
                                                    style={{ color: '#ff4444' }}
                                                    title={ct('delete')}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                        <label className="label-text">{t('notes')}</label>
                        <textarea
                            className="input-field"
                            rows={3}
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            maxLength={500}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div
                        style={{
                            minWidth: '260px',
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255,255,255,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.75 }}>
                            <span>{t('subtotal')}</span>
                            <span>{currency(totals.subtotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.75 }}>
                            <span>{t('vat')}</span>
                            <span>{currency(totals.iva)}</span>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '1.15rem',
                                fontWeight: 700,
                                borderTop: '1px solid var(--glass-border)',
                                paddingTop: '0.5rem'
                            }}
                        >
                            <span>{t('total')}</span>
                            <span className="neon-text">{currency(totals.total)}</span>
                        </div>
                    </div>
                </div>

                {error && <div style={{ color: '#ff4444', fontSize: '0.85rem' }}>{error}</div>}
            </form>
        </ModalShell>
    );
}
