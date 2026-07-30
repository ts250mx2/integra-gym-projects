'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModalShell from './ModalShell';

type Props = {
    product: any;
    branchId: number;
    onClose: () => void;
};

const TYPE_COLORS: Record<string, string> = {
    COMPRA: 'var(--neon-green)',
    INICIAL: 'var(--neon-green)',
    VENTA: 'var(--neon-blue)',
    AJUSTE: '#f5a623',
    MERMA: '#ff4444',
    CANCELA_COMPRA: '#ff4444'
};

const TYPE_LABEL_KEYS: Record<string, string> = {
    COMPRA: 'movementPurchase',
    INICIAL: 'movementInitial',
    VENTA: 'movementSale',
    AJUSTE: 'movementAdjustment',
    MERMA: 'movementWaste',
    CANCELA_COMPRA: 'movementPurchaseCancel'
};

/** Kardex: historial de movimientos del producto en la sucursal. */
export default function KardexModal({ product, branchId, onClose }: Props) {
    const t = useTranslations('Inventory');
    const ct = useTranslations('Common');

    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/inventory/movements?idCuota=${product.IdCuota}&branchId=${branchId}&limit=100`,
                    { signal: controller.signal }
                );
                const data = await res.json();
                if (Array.isArray(data)) setMovements(data);
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error('Kardex fetch error:', err);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [product.IdCuota, branchId]);

    const formatDate = (value: string) =>
        value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-';

    // Etiqueta traducida del movimiento; si es un tipo desconocido, se muestra crudo.
    const typeLabel = (tipo: string) => {
        const key = TYPE_LABEL_KEYS[tipo];
        return key ? t(key as any) : tipo;
    };

    return (
        <ModalShell
            title={t('kardexTitle')}
            subtitle={product.Producto}
            maxWidth="900px"
            onClose={onClose}
            footer={
                <button type="button" onClick={onClose} className="btn-secondary">
                    {t('close')}
                </button>
            }
        >
            {loading ? (
                <div className="neon-text">{ct('loading')}</div>
            ) : movements.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noMovements')}</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colDate')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colType')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colQuantity')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colBefore')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--neon-blue)' }}>{t('colAfter')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colReference')}</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colUser')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.map((movement) => {
                                const quantity = Number(movement.Cantidad) || 0;
                                return (
                                    <tr key={movement.IdMovimientoInv} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{formatDate(movement.Fecha)}</td>
                                        <td style={{ padding: '0.75rem', color: TYPE_COLORS[movement.Tipo] || 'inherit', fontWeight: 600 }}>
                                            {typeLabel(movement.Tipo)}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: quantity >= 0 ? 'var(--neon-green)' : '#ff4444', fontWeight: 600 }}>
                                            {quantity > 0 ? `+${quantity}` : quantity}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.7 }}>{Number(movement.ExistenciaAnterior) || 0}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{Number(movement.ExistenciaNueva) || 0}</td>
                                        <td style={{ padding: '0.75rem', opacity: 0.7 }}>{movement.Referencia || movement.Notas || '-'}</td>
                                        <td style={{ padding: '0.75rem', opacity: 0.7 }}>{movement.Usuario || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </ModalShell>
    );
}
