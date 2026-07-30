/**
 * Rango de fechas de las analiticas. Un solo periodo alimenta TODAS las tarjetas
 * y graficas de una pagina, y cada consulta trae ademas el periodo anterior de
 * la misma longitud para poder mostrar el delta.
 */

export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'custom';

export const PERIOD_PRESETS: PeriodPreset[] = ['today', '7d', '30d', '90d', 'mtd'];

export interface Period {
    preset: PeriodPreset;
    from: string;
    to: string;
    /** Periodo inmediatamente anterior, de la misma longitud, para comparar. */
    prevFrom: string;
    prevTo: string;
    days: number;
    /** Agrupar por dia o por mes segun el largo del rango. */
    grain: 'day' | 'month';
}

const MS_DAY = 24 * 60 * 60 * 1000;

const toISO = (date: Date) => date.toISOString().slice(0, 10);

const parseISO = (value: string | null): Date | null => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const shiftDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_DAY);

export function resolvePeriod(searchParams: URLSearchParams): Period {
    const preset = (searchParams.get('preset') || '30d') as PeriodPreset;
    const today = new Date(`${toISO(new Date())}T00:00:00Z`);

    let from: Date;
    let to = today;

    const customFrom = parseISO(searchParams.get('from'));
    const customTo = parseISO(searchParams.get('to'));

    if (preset === 'custom' && customFrom && customTo) {
        from = customFrom;
        to = customTo;
        if (from > to) [from, to] = [to, from];
    } else if (preset === 'today') {
        from = today;
    } else if (preset === 'mtd') {
        from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    } else {
        const span = preset === '7d' ? 6 : preset === '90d' ? 89 : 29;
        from = shiftDays(today, -span);
    }

    const days = Math.round((to.getTime() - from.getTime()) / MS_DAY) + 1;
    const prevTo = shiftDays(from, -1);
    const prevFrom = shiftDays(prevTo, -(days - 1));

    return {
        preset: preset === 'custom' && customFrom && customTo ? 'custom' : (PERIOD_PRESETS.includes(preset) ? preset : '30d'),
        from: toISO(from),
        to: toISO(to),
        prevFrom: toISO(prevFrom),
        prevTo: toISO(prevTo),
        days,
        // Mas de ~4 meses por dia se vuelve ilegible; se agrupa por mes.
        grain: days > 120 ? 'month' : 'day'
    };
}

/** Limites datetime inclusivos para comparar contra columnas DATETIME. */
export function periodBounds(from: string, to: string): [string, string] {
    return [`${from} 00:00:00`, `${to} 23:59:59`];
}

export function percentDelta(current: number, previous: number): number | null {
    if (!previous) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}
