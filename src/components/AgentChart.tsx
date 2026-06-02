'use client';

import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface ChartPoint { name: string; value: number; value2?: number; }
interface ChartSpec {
    type: 'bar' | 'line' | 'pie';
    title?: string;
    data: ChartPoint[];
    format?: 'currency' | 'number' | 'percent';
    seriesLabels?: string[];
}

const PALETTE = ['#3b82f6', '#06b6d4', '#22c55e', '#a855f7', '#f59e0b', '#ec4899',
    '#14b8a6', '#64748b', '#eab308', '#0ea5e9', '#84cc16', '#ef4444'];
const PRIMARY = '#3b82f6';
const SECONDARY = '#94a3b8';

function fmtFull(v: number, format?: string): string {
    if (typeof v !== 'number' || isNaN(v)) return String(v);
    if (format === 'currency') return '$' + v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    if (format === 'percent') return v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%';
    return v.toLocaleString('es-MX');
}
function fmtCompact(v: number, format?: string): string {
    if (typeof v !== 'number' || isNaN(v)) return String(v);
    const abs = Math.abs(v);
    let s: string;
    if (abs >= 1e6) s = (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (abs >= 1e3) s = (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    else s = String(v);
    if (format === 'currency') return '$' + s;
    if (format === 'percent') return s + '%';
    return s;
}

/**
 * Renderiza un bloque de gráfica que el agente embebe como ```chart {json}```.
 * Si el JSON está incompleto (llega por streaming) o es inválido, no rompe:
 * simplemente no renderiza nada hasta que el JSON esté completo.
 */
export default function AgentChart({ json }: { json: string }) {
    let spec: ChartSpec | null = null;
    try { spec = JSON.parse(json); } catch { return null; }
    if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) return null;

    const { type, title, data, format } = spec;
    const hasV2 = data.some(d => typeof d.value2 === 'number');
    const l1 = spec.seriesLabels?.[0] || 'Valor';
    const l2 = spec.seriesLabels?.[1] || 'Comparación';
    const rotate = data.length > 5;

    const axisTick = { fontSize: 10, fill: '#94a3b8' };
    const tooltip = (
        <Tooltip
            formatter={(v: any, n: any) => [fmtFull(Number(v), format), n]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
            labelStyle={{ color: '#e2e8f0' }}
        />
    );

    let chart: React.ReactElement;
    if (type === 'pie') {
        chart = (
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} innerRadius={42} paddingAngle={2}
                    label={(e: any) => `${(e.percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                {tooltip}
                <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
        );
    } else if (type === 'line') {
        chart = (
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: rotate ? 16 : 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} interval={0}
                    angle={rotate ? -20 : 0} textAnchor={rotate ? 'end' : 'middle'} height={rotate ? 44 : 24} />
                <YAxis tick={axisTick} tickFormatter={(v) => fmtCompact(Number(v), format)} width={50} />
                {tooltip}
                {hasV2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                <Line type="monotone" dataKey="value" name={l1} stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 3 }} />
                {hasV2 && <Line type="monotone" dataKey="value2" name={l2} stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />}
            </LineChart>
        );
    } else {
        chart = (
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: rotate ? 16 : 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} interval={0}
                    angle={rotate ? -20 : 0} textAnchor={rotate ? 'end' : 'middle'} height={rotate ? 44 : 24} />
                <YAxis tick={axisTick} tickFormatter={(v) => fmtCompact(Number(v), format)} width={50} />
                {tooltip}
                {hasV2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                <Bar dataKey="value" name={l1} fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={48} />
                {hasV2 && <Bar dataKey="value2" name={l2} fill={SECONDARY} radius={[4, 4, 0, 0]} maxBarSize={48} />}
            </BarChart>
        );
    }

    return (
        <div className="agent-chart-card my-3 rounded-xl not-prose" style={{ border: '1px solid #1e293b', background: 'rgba(15,23,42,0.5)', padding: '12px 8px 4px' }}>
            {title && <p className="text-xs font-bold mb-1 text-center" style={{ color: '#cbd5e1' }}>{title}</p>}
            <ResponsiveContainer width="100%" height={type === 'pie' ? 240 : 210}>
                {chart}
            </ResponsiveContainer>
        </div>
    );
}
