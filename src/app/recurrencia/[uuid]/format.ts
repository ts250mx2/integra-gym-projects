const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const EMPTY = '—';
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;

const moneyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function formatMoney(amount: number): string {
    return moneyFormatter.format(amount);
}

// Las fechas llegan como texto 'YYYY-MM-DD HH:mm:ss' con la hora del servidor de BD; se
// formatean sin pasar por Date para que la zona horaria del servidor web no las recorra.
export function formatDate(value: string | null): string {
    const match = value ? DATE_RE.exec(value) : null;
    if (!match) return EMPTY;
    const [, year, month, day] = match;
    return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

export function formatDateTime(value: string | null): string {
    const match = value ? DATE_RE.exec(value) : null;
    if (!match) return EMPTY;
    const [, , , , hour, minute] = match;
    return hour ? `${formatDate(value)}, ${hour}:${minute}` : formatDate(value);
}

export function formatMonthName(yearMonth: string): string {
    return MONTHS_LONG[Number(yearMonth.slice(5, 7)) - 1] ?? yearMonth;
}

export function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
