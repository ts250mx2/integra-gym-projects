'use client';

import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { VIZ } from './vizTokens';

export interface TableColumn {
    key: string;
    label: string;
    align?: 'left' | 'right';
    format?: (row: any) => string;
}

type Props = {
    title: string;
    subtitle?: string;
    /** Filas y columnas de la vista de tabla, el gemelo accesible de la grafica. */
    columns: TableColumn[];
    rows: any[];
    isStale?: boolean;
    children: React.ReactNode;
};

/**
 * Tarjeta de grafica con vista de tabla.
 *
 * La tabla no es un extra: es el canal que hace que ningun valor dependa del
 * color ni del tooltip. En tema claro tres colores de la paleta quedan por
 * debajo de 3:1 contra la superficie, y esta vista es la compensacion exigida.
 */
export default function ChartCard({ title, subtitle, columns, rows, isStale = false, children }: Props) {
    const [showTable, setShowTable] = useState(false);

    return (
        <div className="glass-card" style={{ padding: '1.25rem 1.25rem 0.75rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: VIZ.ink }}>{title}</h3>
                    {subtitle && (
                        <p style={{ fontSize: '0.78rem', color: VIZ.inkMuted, marginTop: '0.15rem' }}>{subtitle}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setShowTable((v) => !v)}
                    title={showTable ? 'Ver gráfica' : 'Ver tabla'}
                    aria-pressed={showTable}
                    style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'transparent',
                        border: `1px solid ${VIZ.axis}`,
                        color: VIZ.inkSecondary
                    }}
                >
                    {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
                    {showTable ? 'Gráfica' : 'Tabla'}
                </button>
            </div>

            <div style={{ opacity: isStale ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                {showTable ? (
                    <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto', marginBottom: '0.5rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    {columns.map((col) => (
                                        <th
                                            key={col.key}
                                            style={{
                                                position: 'sticky',
                                                top: 0,
                                                background: VIZ.tooltipBg,
                                                padding: '0.5rem 0.6rem',
                                                textAlign: col.align || 'left',
                                                color: VIZ.inkSecondary,
                                                fontWeight: 600,
                                                borderBottom: `1px solid ${VIZ.axis}`
                                            }}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} style={{ padding: '1.5rem', textAlign: 'center', color: VIZ.inkMuted }}>
                                            Sin datos en el periodo.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, index) => (
                                        <tr key={index}>
                                            {columns.map((col) => (
                                                <td
                                                    key={col.key}
                                                    style={{
                                                        padding: '0.45rem 0.6rem',
                                                        textAlign: col.align || 'left',
                                                        color: VIZ.ink,
                                                        borderBottom: `1px solid ${VIZ.grid}`,
                                                        fontVariantNumeric: col.align === 'right' ? 'tabular-nums' : 'normal'
                                                    }}
                                                >
                                                    {col.format ? col.format(row) : String(row[col.key] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: VIZ.inkMuted, fontSize: '0.85rem' }}>
                        Sin datos en el periodo.
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}
