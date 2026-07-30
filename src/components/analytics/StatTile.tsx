'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { VIZ, ValueFormat, formatValue } from './vizTokens';

type Props = {
    label: string;
    value: number;
    format?: ValueFormat;
    /** Variacion porcentual contra el periodo anterior; null si no hay base. */
    delta?: number | null;
    /** En metricas como vencidos o merma, subir es malo. */
    upIsGood?: boolean;
    hint?: string;
    /** Metrica en estado de alerta (bajo stock, por vencer). */
    isAlert?: boolean;
};

/**
 * Tarjeta de metrica: etiqueta, valor y variacion contra el periodo anterior.
 * Es la forma correcta para un numero suelto — una grafica de una sola barra no
 * dice nada que el numero no diga.
 */
export default function StatTile({
    label,
    value,
    format = 'number',
    delta = undefined,
    upIsGood = true,
    hint,
    isAlert = false
}: Props) {
    const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
    const isUp = hasDelta && delta > 0;
    const isFlat = hasDelta && Math.abs(delta) < 0.05;
    const isGood = isUp === upIsGood;

    const deltaColor = isFlat ? VIZ.inkMuted : isGood ? VIZ.good : VIZ.critical;
    const DeltaIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="glass-card" style={{ padding: '1.15rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: VIZ.inkMuted, marginBottom: '0.45rem' }}>{label}</div>
            <div
                style={{
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: isAlert && value > 0 ? VIZ.critical : VIZ.ink
                }}
            >
                {formatValue(value, format)}
            </div>

            {hasDelta ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <DeltaIcon size={14} color={deltaColor} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: deltaColor }}>
                        {Math.abs(delta).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.72rem', color: VIZ.inkMuted }}>vs periodo anterior</span>
                </div>
            ) : hint ? (
                <div style={{ fontSize: '0.72rem', color: VIZ.inkMuted, marginTop: '0.5rem' }}>{hint}</div>
            ) : null}
        </div>
    );
}
