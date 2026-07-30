'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModalShell from './ModalShell';

type Props = {
    idCompra: number;
    onClose: () => void;
};

const currency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

/** Detalle de solo lectura de una compra registrada. */
export default function PurchaseDetailModal({ idCompra, onClose }: Props) {
    const t = useTranslations('Purchases');
    const ct = useTranslations('Common');

    const [purchase, setPurchase] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/purchases/${idCompra}`, { signal: controller.signal });
                const data = await res.json();
                if (res.ok) {
                    setPurchase(data.purchase);
                    setItems(Array.isArray(data.items) ? data.items : []);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error('Purchase detail error:', err);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [idCompra]);

    const formatDate = (value: string) => (value ? new Date(value).toLocaleDateString('es-MX') : '-');

    const infoRows = purchase
        ? [
            { label: t('provider'), value: purchase.Proveedor || '-' },
            { label: t('date'), value: formatDate(purchase.FechaCompra) },
            { label: t('reference'), value: purchase.Referencia || '-' },
            { label: t('branch'), value: purchase.Sucursal || '-' },
            { label: t('user'), value: purchase.Usuario || '-' },
            { label: t('status'), value: Number(purchase.Status) === 2 ? t('cancelled') : t('active') }
        ]
        : [];

    const cellStyle = { padding: '0.65rem', fontSize: '0.85rem' } as const;

    return (
        <ModalShell
            title={purchase?.Folio ? `${t('purchase')} ${purchase.Folio}` : t('purchase')}
            maxWidth="800px"
            onClose={onClose}
            footer={
                <button type="button" onClick={onClose} className="btn-secondary">
                    {t('close')}
                </button>
            }
        >
            {loading ? (
                <div className="neon-text">{ct('loading')}</div>
            ) : !purchase ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('notFound')}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        {infoRows.map((row) => (
                            <div key={row.label}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.55 }}>{row.label}</div>
                                <div style={{ fontWeight: 600 }}>{row.value}</div>
                            </div>
                        ))}
                    </div>

                    {purchase.Notas && (
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            <strong>{t('notes')}:</strong> {purchase.Notas}
                        </div>
                    )}

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
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.IdDetalleCompra} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={cellStyle}>
                                                <div style={{ fontWeight: 600 }}>{item.Producto}</div>
                                                <div style={{ opacity: 0.5, fontSize: '0.75rem' }}>{item.CodigoBarras || '-'}</div>
                                            </td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>{Number(item.Cantidad) || 0}</td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>{currency(item.Costo)}</td>
                                            <td style={{ ...cellStyle, textAlign: 'right' }}>{Number(item.Iva) || 0}%</td>
                                            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{currency(item.Importe)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.75 }}>
                                <span>{t('subtotal')}</span>
                                <span>{currency(purchase.Subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.75 }}>
                                <span>{t('vat')}</span>
                                <span>{currency(purchase.Iva)}</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontWeight: 700,
                                    fontSize: '1.1rem',
                                    borderTop: '1px solid var(--glass-border)',
                                    paddingTop: '0.4rem'
                                }}
                            >
                                <span>{t('total')}</span>
                                <span className="neon-text">{currency(purchase.Total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ModalShell>
    );
}
