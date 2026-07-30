'use client';

import { Check, RefreshCw } from 'lucide-react';
import { VIZ } from './vizTokens';

export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'custom';

export interface PeriodState {
    preset: PeriodPreset;
    from: string;
    to: string;
}

const PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: '90d', label: '90 días' },
    { id: 'mtd', label: 'Mes actual' }
];

type Props = {
    value: PeriodState;
    onChange: (next: PeriodState) => void;
    onRefresh: () => void;
    /** Rango efectivo que devolvio el servidor, para que el usuario vea que abarca. */
    resolvedRange?: { from: string; to: string } | null;
};

/**
 * Fila unica de filtros, arriba de todo lo que acota. Los presets van primero
 * porque son lo que se usa el 90% de las veces; el rango libre queda detras.
 * Todo lo que esta debajo se recalcula contra el mismo periodo, asi que las
 * cifras de tarjetas, graficas y tablas siempre concuerdan.
 */
export default function PeriodFilter({ value, onChange, onRefresh, resolvedRange }: Props) {
    const selectPreset = (preset: PeriodPreset) => onChange({ ...value, preset });

    const setCustom = (field: 'from' | 'to', date: string) =>
        onChange({ ...value, preset: 'custom', [field]: date });

    return (
        <div
            className="glass-card"
            style={{
                padding: '0.9rem 1.1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem'
            }}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {PRESETS.map((preset) => {
                    const isActive = value.preset === preset.id;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => selectPreset(preset.id)}
                            aria-pressed={isActive}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.45rem 0.8rem',
                                borderRadius: 8,
                                fontSize: '0.8rem',
                                fontWeight: isActive ? 700 : 500,
                                cursor: 'pointer',
                                background: isActive ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
                                border: `1px solid ${isActive ? 'var(--neon-blue)' : VIZ.axis}`,
                                color: isActive ? 'var(--neon-blue)' : VIZ.inkSecondary
                            }}
                        >
                            {isActive && <Check size={13} strokeWidth={3} />}
                            {preset.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.75rem', borderLeft: `1px solid ${VIZ.axis}` }}>
                <input
                    type="date"
                    value={value.from}
                    max={value.to}
                    onChange={(e) => setCustom('from', e.target.value)}
                    aria-label="Desde"
                    className="input-field"
                    style={{ marginTop: 0, padding: '0.4rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                />
                <span style={{ color: VIZ.inkMuted, fontSize: '0.8rem' }}>a</span>
                <input
                    type="date"
                    value={value.to}
                    min={value.from}
                    onChange={(e) => setCustom('to', e.target.value)}
                    aria-label="Hasta"
                    className="input-field"
                    style={{ marginTop: 0, padding: '0.4rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {resolvedRange && (
                    <span style={{ fontSize: '0.75rem', color: VIZ.inkMuted }}>
                        {resolvedRange.from} → {resolvedRange.to}
                    </span>
                )}
                <button
                    type="button"
                    onClick={onRefresh}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                >
                    <RefreshCw size={15} />
                    Actualizar
                </button>
            </div>
        </div>
    );
}
