'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ClipboardList, History, Package, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import StockAdjustModal from '@/components/inventory/StockAdjustModal';
import KardexModal from '@/components/inventory/KardexModal';

interface InventorySummary {
    productos: number;
    unidades: number;
    valor: number;
    bajoStock: number;
    sinExistencia: number;
}

const EMPTY_SUMMARY: InventorySummary = { productos: 0, unidades: 0, valor: 0, bajoStock: 0, sinExistencia: 0 };

const currency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

export default function InventoryPage() {
    const t = useTranslations('Inventory');
    const ct = useTranslations('Common');

    const [items, setItems] = useState<any[]>([]);
    const [summary, setSummary] = useState<InventorySummary>(EMPTY_SUMMARY);
    const [branchId, setBranchId] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [onlyLowStock, setOnlyLowStock] = useState(false);

    const [adjustProduct, setAdjustProduct] = useState<any>(null);
    const [kardexProduct, setKardexProduct] = useState<any>(null);

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (onlyLowStock) params.set('lowStock', '1');

            const res = await fetch(`/api/inventory?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t('errorLoad'));
                return;
            }

            setItems(Array.isArray(data.items) ? data.items : []);
            setSummary(data.summary || EMPTY_SUMMARY);
            setBranchId(Number(data.branchId) || 0);
        } catch (err: any) {
            setError(err.message || t('errorLoad'));
        } finally {
            setLoading(false);
        }
    }, [onlyLowStock, t]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    // El filtro de texto se resuelve en memoria: el catalogo de productos de un
    // gimnasio es pequeno y asi la busqueda responde sin ir al servidor.
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleItems = normalizedSearch
        ? items.filter(
            (item) =>
                (item.Producto || '').toLowerCase().includes(normalizedSearch) ||
                (item.CodigoBarras || '').toLowerCase().includes(normalizedSearch)
        )
        : items;

    const stockCell = (item: any) => {
        const color = item.SinExistencia ? '#ff4444' : item.BajoStock ? '#f5a623' : 'var(--neon-green)';
        return (
            <span style={{ color, fontWeight: 700, fontSize: '1rem' }}>
                {item.Existencia}
                {item.BajoStock && !item.SinExistencia && (
                    <AlertTriangle size={14} style={{ display: 'inline', marginLeft: '0.4rem', verticalAlign: 'text-top' }} />
                )}
            </span>
        );
    };

    const summaryCards = [
        { label: t('cardProducts'), value: String(summary.productos), accent: 'var(--neon-blue)' },
        { label: t('cardUnits'), value: String(summary.unidades), accent: 'var(--foreground)' },
        { label: t('cardValue'), value: currency(summary.valor), accent: 'var(--neon-green)' },
        { label: t('cardLowStock'), value: String(summary.bajoStock), accent: summary.bajoStock > 0 ? '#f5a623' : 'var(--foreground)' },
        { label: t('cardOutOfStock'), value: String(summary.sinExistencia), accent: summary.sinExistencia > 0 ? '#ff4444' : 'var(--foreground)' }
    ];

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ClipboardList size={32} />
                        {t('title')}
                    </h1>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>{t('subtitle')}</p>
                </div>
                <button onClick={fetchInventory} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={18} />
                    {t('refresh')}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {summaryCards.map((card) => (
                    <div key={card.label} className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.35rem' }}>{card.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.accent }}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                        type="text"
                        className="input-field"
                        style={{ paddingLeft: '3rem', marginTop: 0 }}
                        placeholder={t('searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                        type="checkbox"
                        checked={onlyLowStock}
                        onChange={(e) => setOnlyLowStock(e.target.checked)}
                        style={{ accentColor: 'var(--neon-blue)', width: '1.1rem', height: '1.1rem' }}
                    />
                    {t('filterLowStock')}
                </label>
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
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colCode')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colProduct')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colStock')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colMinStock')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colAvgCost')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colPrice')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colValue')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{ct('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                            <Package size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <div>{t('noProducts')}</div>
                                        </td>
                                    </tr>
                                ) : (
                                    visibleItems.map((item) => (
                                        <tr key={item.IdCuota} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem', opacity: 0.7 }}>{item.CodigoBarras || '-'}</td>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{item.Producto}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>{stockCell(item)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', opacity: 0.7 }}>{item.StockMinimo || '-'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>{currency(item.CostoPromedio)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', opacity: 0.7 }}>{currency(item.Precio)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>{currency(item.Valor)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                    <button onClick={() => setAdjustProduct(item)} className="btn-icon" title={t('adjust')}>
                                                        <SlidersHorizontal size={16} />
                                                    </button>
                                                    <button onClick={() => setKardexProduct(item)} className="btn-icon" title={t('kardex')}>
                                                        <History size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {adjustProduct && (
                <StockAdjustModal
                    product={adjustProduct}
                    branchId={branchId}
                    onClose={() => setAdjustProduct(null)}
                    onSaved={fetchInventory}
                />
            )}

            {kardexProduct && (
                <KardexModal product={kardexProduct} branchId={branchId} onClose={() => setKardexProduct(null)} />
            )}

            <style jsx>{`
                table tr:hover { background: rgba(255, 255, 255, 0.02); }
            `}</style>
        </div>
    );
}
