'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Save } from 'lucide-react';
import ModalShell from './ModalShell';

export type AdjustMode = 'set' | 'in' | 'out';

type Props = {
    product: any;
    branchId: number;
    onClose: () => void;
    onSaved: () => void;
};

/** Ajuste manual de existencias + punto de reorden de un producto. */
export default function StockAdjustModal({ product, branchId, onClose, onSaved }: Props) {
    const t = useTranslations('Inventory');
    const ct = useTranslations('Common');

    const currentStock = Number(product.Existencia) || 0;

    const [mode, setMode] = useState<AdjustMode>('set');
    const [cantidad, setCantidad] = useState<string>(String(currentStock));
    const [costo, setCosto] = useState<string>(String(Number(product.CostoPromedio) || 0));
    const [stockMinimo, setStockMinimo] = useState<string>(String(Number(product.StockMinimo) || 0));
    const [notas, setNotas] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const parsedQuantity = Number(cantidad);
    const resultingStock =
        mode === 'set' ? parsedQuantity
            : mode === 'in' ? currentStock + parsedQuantity
                : currentStock - parsedQuantity;

    const handleModeChange = (next: AdjustMode) => {
        setMode(next);
        setCantidad(next === 'set' ? String(currentStock) : '');
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
            setError(t('errorInvalidQuantity'));
            return;
        }
        if (mode === 'out' && parsedQuantity > currentStock) {
            setError(t('errorInsufficientStock'));
            return;
        }

        setSaving(true);
        try {
            const minimoRes = await fetch('/api/inventory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdCuota: product.IdCuota,
                    IdSucursal: branchId,
                    StockMinimo: Number(stockMinimo) || 0
                })
            });
            if (!minimoRes.ok) throw new Error(t('errorSave'));

            const res = await fetch('/api/inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdCuota: product.IdCuota,
                    IdSucursal: branchId,
                    Modo: mode,
                    Cantidad: parsedQuantity,
                    Costo: mode === 'out' ? undefined : Number(costo) || 0,
                    Notas: notas
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error === 'insufficientStock' ? t('errorInsufficientStock') : t('errorSave'));
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

    const modeOptions: Array<{ id: AdjustMode; label: string; hint: string }> = [
        { id: 'set', label: t('modeSet'), hint: t('modeSetHint') },
        { id: 'in', label: t('modeIn'), hint: t('modeInHint') },
        { id: 'out', label: t('modeOut'), hint: t('modeOutHint') }
    ];

    return (
        <ModalShell
            title={t('adjustTitle')}
            subtitle={`${product.Producto} · ${t('currentStock')}: ${currentStock}`}
            onClose={onClose}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn-secondary">
                        {ct('cancel')}
                    </button>
                    <button
                        type="submit"
                        form="stock-adjust-form"
                        className="btn-primary"
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Save size={18} />
                        {saving ? ct('saving') : ct('save')}
                    </button>
                </>
            }
        >
            <form id="stock-adjust-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    {modeOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => handleModeChange(option.id)}
                            style={{
                                textAlign: 'left',
                                padding: '0.85rem 1rem',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                background: mode === option.id ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${mode === option.id ? 'var(--neon-blue)' : 'var(--glass-border)'}`,
                                color: 'var(--foreground)'
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{option.label}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{option.hint}</div>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                        <label className="label-text">{mode === 'set' ? t('countedQuantity') : t('quantity')}</label>
                        <input
                            className="input-field"
                            type="number"
                            min="0"
                            step="any"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    {mode !== 'out' && (
                        <div style={{ flex: 1, minWidth: '160px' }}>
                            <label className="label-text">{t('unitCost')}</label>
                            <input
                                className="input-field"
                                type="number"
                                min="0"
                                step="any"
                                value={costo}
                                onChange={(e) => setCosto(e.target.value)}
                            />
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: '160px' }}>
                        <label className="label-text">{t('minStock')}</label>
                        <input
                            className="input-field"
                            type="number"
                            min="0"
                            step="any"
                            value={stockMinimo}
                            onChange={(e) => setStockMinimo(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="label-text">{t('notes')}</label>
                    <input
                        className="input-field"
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder={t('notesPlaceholder')}
                        maxLength={255}
                    />
                </div>

                <div
                    style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{t('resultingStock')}</span>
                    <strong
                        className={resultingStock < 0 ? '' : 'neon-text'}
                        style={{ fontSize: '1.2rem', color: resultingStock < 0 ? '#ff4444' : undefined }}
                    >
                        {Number.isFinite(resultingStock) ? resultingStock : '-'}
                    </strong>
                </div>

                {error && <div style={{ color: '#ff4444', fontSize: '0.85rem' }}>{error}</div>}
            </form>
        </ModalShell>
    );
}
