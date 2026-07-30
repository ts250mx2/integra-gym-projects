'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Eye, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import PurchaseFormModal from '@/components/inventory/PurchaseFormModal';
import PurchaseDetailModal from '@/components/inventory/PurchaseDetailModal';

const currency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const firstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PurchasesPage() {
    const t = useTranslations('Purchases');
    const ct = useTranslations('Common');

    const [purchases, setPurchases] = useState<any[]>([]);
    const [summary, setSummary] = useState({ compras: 0, total: 0 });
    const [providers, setProviders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [from, setFrom] = useState(firstDayOfMonth());
    const [to, setTo] = useState(todayISO());
    const [providerId, setProviderId] = useState('');
    const [includeCancelled, setIncludeCancelled] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailId, setDetailId] = useState<number | null>(null);

    const fetchPurchases = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ from, to });
            if (providerId) params.set('providerId', providerId);
            if (includeCancelled) params.set('includeCancelled', '1');

            const res = await fetch(`/api/purchases?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t('errorLoad'));
                return;
            }

            setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
            setSummary(data.summary || { compras: 0, total: 0 });
        } catch (err: any) {
            setError(err.message || t('errorLoad'));
        } finally {
            setLoading(false);
        }
    }, [from, to, providerId, includeCancelled, t]);

    useEffect(() => {
        fetchPurchases();
    }, [fetchPurchases]);

    useEffect(() => {
        const controller = new AbortController();

        const loadProviders = async () => {
            try {
                const res = await fetch('/api/providers', { signal: controller.signal });
                const data = await res.json();
                if (Array.isArray(data)) setProviders(data);
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error('Providers fetch error:', err);
            }
        };

        loadProviders();
        return () => controller.abort();
    }, []);

    const handleCancel = async (purchase: any) => {
        if (!confirm(t('cancelConfirm', { folio: purchase.Folio || purchase.IdCompra }))) return;

        try {
            const res = await fetch(`/api/purchases/${purchase.IdCompra}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error === 'alreadyCancelled' ? t('errorAlreadyCancelled') : t('errorCancel'));
                return;
            }
            fetchPurchases();
        } catch (err: any) {
            setError(err.message || t('errorCancel'));
        }
    };

    const formatDate = (value: string) => (value ? new Date(value).toLocaleDateString('es-MX') : '-');

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShoppingBag size={32} />
                        {t('title')}
                    </h1>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>{t('subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={fetchPurchases} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RefreshCw size={18} />
                        {t('refresh')}
                    </button>
                    <button onClick={() => setIsFormOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} />
                        {t('newPurchase')}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.35rem' }}>{t('cardPurchases')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--neon-blue)' }}>{summary.compras}</div>
                </div>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.35rem' }}>{t('cardTotal')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--neon-green)' }}>{currency(summary.total)}</div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ minWidth: '150px' }}>
                        <label className="label-text">{t('from')}</label>
                        <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div style={{ minWidth: '150px' }}>
                        <label className="label-text">{t('to')}</label>
                        <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div style={{ minWidth: '200px', flex: 1, maxWidth: '320px' }}>
                        <label className="label-text">{t('provider')}</label>
                        <select className="input-field" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                            <option value="">{t('allProviders')}</option>
                            {providers.map((provider) => (
                                <option key={provider.IdProveedor} value={provider.IdProveedor}>
                                    {provider.Proveedor}
                                </option>
                            ))}
                        </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', paddingBottom: '0.75rem' }}>
                        <input
                            type="checkbox"
                            checked={includeCancelled}
                            onChange={(e) => setIncludeCancelled(e.target.checked)}
                            style={{ accentColor: 'var(--neon-blue)', width: '1.1rem', height: '1.1rem' }}
                        />
                        {t('showCancelled')}
                    </label>
                </div>
            </div>

            {error && (
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', color: '#ff4444' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="neon-text">{ct('loading')}</div>
            ) : (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colFolio')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colDate')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colProvider')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colReference')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colLines')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colTotal')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colUser')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{ct('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                            <ShoppingBag size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <div>{t('noPurchases')}</div>
                                        </td>
                                    </tr>
                                ) : (
                                    purchases.map((purchase) => {
                                        const isCancelled = Number(purchase.Status) === 2;
                                        return (
                                            <tr
                                                key={purchase.IdCompra}
                                                style={{ borderTop: '1px solid rgba(255,255,255,0.05)', opacity: isCancelled ? 0.45 : 1 }}
                                            >
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>
                                                    {purchase.Folio || purchase.IdCompra}
                                                    {isCancelled && (
                                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#ff4444', textTransform: 'uppercase' }}>
                                                            {t('cancelled')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem' }}>{formatDate(purchase.FechaCompra)}</td>
                                                <td style={{ padding: '1rem' }}>{purchase.Proveedor || '-'}</td>
                                                <td style={{ padding: '1rem', opacity: 0.7 }}>{purchase.Referencia || '-'}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', opacity: 0.7 }}>{purchase.Partidas}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>{currency(purchase.Total)}</td>
                                                <td style={{ padding: '1rem', opacity: 0.7 }}>{purchase.Usuario || '-'}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <button onClick={() => setDetailId(purchase.IdCompra)} className="btn-icon" title={t('viewDetail')}>
                                                            <Eye size={16} />
                                                        </button>
                                                        {!isCancelled && (
                                                            <button
                                                                onClick={() => handleCancel(purchase)}
                                                                className="btn-icon"
                                                                style={{ color: '#ff4444' }}
                                                                title={t('cancelPurchase')}
                                                            >
                                                                <Ban size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isFormOpen && <PurchaseFormModal onClose={() => setIsFormOpen(false)} onSaved={fetchPurchases} />}
            {detailId !== null && <PurchaseDetailModal idCompra={detailId} onClose={() => setDetailId(null)} />}

            <style jsx>{`
                table tr:hover { background: rgba(255, 255, 255, 0.02); }
            `}</style>
        </div>
    );
}
