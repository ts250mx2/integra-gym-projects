/**
 * Roles de color y formateadores compartidos por las graficas de analiticas.
 * Los valores viven en globals.css (.viz-root / .light-theme .viz-root) para que
 * el tema claro/oscuro se resuelva en un solo lugar; aqui solo se nombran.
 */

export const VIZ = {
    series1: 'var(--viz-series-1)',
    series2: 'var(--viz-series-2)',
    series3: 'var(--viz-series-3)',
    series4: 'var(--viz-series-4)',
    grid: 'var(--viz-grid)',
    axis: 'var(--viz-axis)',
    ink: 'var(--viz-ink)',
    inkSecondary: 'var(--viz-ink-secondary)',
    inkMuted: 'var(--viz-ink-muted)',
    tooltipBg: 'var(--viz-tooltip-bg)',
    surface: 'var(--viz-surface)',
    good: 'var(--viz-good)',
    critical: 'var(--viz-critical)'
} as const;

/** Orden fijo de asignacion. Nunca se cicla ni se genera un color extra. */
export const SERIES_ORDER = [VIZ.series1, VIZ.series2, VIZ.series3, VIZ.series4];

export type ValueFormat = 'currency' | 'number' | 'percent';

export function formatValue(value: number, format: ValueFormat = 'number'): string {
    const n = Number(value) || 0;
    if (format === 'currency') {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);
    }
    if (format === 'percent') return `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
    return n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

/** Version compacta para los ticks del eje, que no tienen ancho para el valor completo. */
export function formatCompact(value: number, format: ValueFormat = 'number'): string {
    const n = Number(value) || 0;
    const abs = Math.abs(n);

    let text: string;
    if (abs >= 1e6) text = `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    else if (abs >= 1e3) text = `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
    else text = n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

    if (format === 'currency') return `$${text}`;
    if (format === 'percent') return `${text}%`;
    return text;
}

/** Etiqueta legible para los buckets del eje X (`2026-07-29` o `2026-07`). */
export function formatBucket(bucket: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
        const [, month, day] = bucket.split('-');
        return `${day}/${month}`;
    }
    if (/^\d{4}-\d{2}$/.test(bucket)) {
        const [year, month] = bucket.split('-');
        const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${names[Number(month) - 1] || month} ${year.slice(2)}`;
    }
    return bucket;
}
