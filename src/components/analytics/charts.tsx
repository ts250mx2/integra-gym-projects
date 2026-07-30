'use client';

import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { VIZ, ValueFormat, formatBucket, formatCompact, formatValue } from './vizTokens';

const AXIS_TICK = { fontSize: 11, fill: VIZ.inkMuted };
const PLOT_HEIGHT = 260;

/** Tooltip comun: el valor manda, el nombre de la serie es secundario. */
function vizTooltip(format: ValueFormat, labelFormatter?: (label: string) => string) {
    return (
        <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.06)' }}
            formatter={(value: any, name: any) => [formatValue(Number(value), format), name]}
            labelFormatter={labelFormatter as any}
            contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: `1px solid ${VIZ.axis}`,
                background: VIZ.tooltipBg,
                color: VIZ.ink
            }}
            itemStyle={{ color: VIZ.ink, fontWeight: 700 }}
            labelStyle={{ color: VIZ.inkSecondary, fontWeight: 500 }}
        />
    );
}

interface Point { name: string; value: number; }

/**
 * Tendencia en el tiempo, una sola serie.
 * Sin leyenda: con una serie el titulo ya dice que se grafica.
 */
export function TrendLine({ data, format = 'number' }: { data: Point[]; format?: ValueFormat }) {
    return (
        <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={VIZ.grid} vertical={false} />
                <XAxis
                    dataKey="name"
                    tick={AXIS_TICK}
                    tickFormatter={formatBucket}
                    stroke={VIZ.axis}
                    minTickGap={24}
                />
                <YAxis
                    tick={AXIS_TICK}
                    tickFormatter={(v) => formatCompact(Number(v), format)}
                    stroke={VIZ.axis}
                    width={58}
                />
                {vizTooltip(format, formatBucket)}
                <Line
                    type="monotone"
                    dataKey="value"
                    name="Total"
                    stroke={VIZ.series1}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: VIZ.surface }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

/**
 * Ranking por magnitud. Una sola serie, un solo color para todas las barras:
 * teñir cada barra segun su tamaño duplicaria el largo en el tono y gastaria el
 * unico canal libre en informacion que la barra ya muestra.
 */
export function RankedBar({
    data,
    format = 'number',
    layout = 'vertical'
}: {
    data: Point[];
    format?: ValueFormat;
    layout?: 'vertical' | 'horizontal';
}) {
    // layout 'vertical' en recharts = barras horizontales (categoria en el eje Y),
    // que es lo correcto para nombres largos de productos o proveedores.
    const isHorizontalBars = layout === 'vertical';
    const height = isHorizontalBars ? Math.max(PLOT_HEIGHT, data.length * 34 + 40) : PLOT_HEIGHT;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                layout={layout}
                margin={{ top: 8, right: 20, left: isHorizontalBars ? 8 : 4, bottom: 4 }}
                barCategoryGap={isHorizontalBars ? 6 : '18%'}
            >
                <CartesianGrid stroke={VIZ.grid} horizontal={!isHorizontalBars} vertical={isHorizontalBars} />
                {isHorizontalBars ? (
                    <>
                        <XAxis
                            type="number"
                            tick={AXIS_TICK}
                            tickFormatter={(v) => formatCompact(Number(v), format)}
                            stroke={VIZ.axis}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            tick={AXIS_TICK}
                            stroke={VIZ.axis}
                            width={140}
                            interval={0}
                        />
                    </>
                ) : (
                    <>
                        <XAxis dataKey="name" tick={AXIS_TICK} stroke={VIZ.axis} interval={0} />
                        <YAxis
                            tick={AXIS_TICK}
                            tickFormatter={(v) => formatCompact(Number(v), format)}
                            stroke={VIZ.axis}
                            width={58}
                        />
                    </>
                )}
                {vizTooltip(format)}
                <Bar
                    dataKey="value"
                    name="Total"
                    fill={VIZ.series1}
                    radius={isHorizontalBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                    maxBarSize={24}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * Ranking con enfasis: la barra destacada lleva el color de serie y el resto
 * queda en gris. Es la forma correcta cuando la historia es "esta de aqui".
 */
export function EmphasisBar({
    data,
    highlightIndex = 0,
    format = 'number'
}: {
    data: Point[];
    highlightIndex?: number;
    format?: ValueFormat;
}) {
    const height = Math.max(PLOT_HEIGHT, data.length * 34 + 40);

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid stroke={VIZ.grid} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCompact(Number(v), format)} stroke={VIZ.axis} />
                <YAxis type="category" dataKey="name" tick={AXIS_TICK} stroke={VIZ.axis} width={140} interval={0} />
                {vizTooltip(format)}
                <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {data.map((_, index) => (
                        <Cell key={index} fill={index === highlightIndex ? VIZ.series1 : VIZ.axis} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * Dos medidas de la MISMA unidad comparadas por categoria (costo vs precio).
 * Van en un solo eje: dos escalas en un plot inventan una correlacion que los
 * datos no tienen.
 */
export function GroupedBar({
    data,
    keys,
    labels,
    format = 'currency'
}: {
    data: any[];
    keys: [string, string];
    labels: [string, string];
    format?: ValueFormat;
}) {
    const height = Math.max(PLOT_HEIGHT, data.length * 44 + 60);

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 4 }} barCategoryGap={10} barGap={2}>
                <CartesianGrid stroke={VIZ.grid} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCompact(Number(v), format)} stroke={VIZ.axis} />
                <YAxis type="category" dataKey="name" tick={AXIS_TICK} stroke={VIZ.axis} width={140} interval={0} />
                {vizTooltip(format)}
                <Legend wrapperStyle={{ fontSize: 11, color: VIZ.inkSecondary }} />
                <Bar dataKey={keys[0]} name={labels[0]} fill={VIZ.series1} radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey={keys[1]} name={labels[1]} fill={VIZ.series2} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * Parte-todo de dos clases como barra apilada horizontal (no un pastel de dos
 * rebanadas). La separacion entre segmentos es un hueco del color de la
 * superficie, nunca un borde dibujado alrededor.
 */
export function StackedShare({
    segments,
    format = 'currency'
}: {
    segments: { label: string; value: number }[];
    format?: ValueFormat;
}) {
    const total = segments.reduce((acc, segment) => acc + segment.value, 0);
    const colors = [VIZ.series1, VIZ.series2, VIZ.series3, VIZ.series4];

    if (total <= 0) {
        return <div style={{ color: VIZ.inkMuted, fontSize: '0.85rem', padding: '2rem 0' }}>Sin datos en el periodo.</div>;
    }

    return (
        <div style={{ padding: '0.5rem 0 1rem' }}>
            <div style={{ display: 'flex', width: '100%', height: 28, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
                {segments.map((segment, index) => {
                    const share = (segment.value / total) * 100;
                    if (share <= 0) return null;
                    return (
                        <div
                            key={segment.label}
                            title={`${segment.label}: ${formatValue(segment.value, format)} (${share.toFixed(1)}%)`}
                            style={{ width: `${share}%`, background: colors[index % colors.length] }}
                        />
                    );
                })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginTop: '1rem' }}>
                {segments.map((segment, index) => {
                    const share = total > 0 ? (segment.value / total) * 100 : 0;
                    return (
                        <div key={segment.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 3,
                                    background: colors[index % colors.length],
                                    flexShrink: 0
                                }}
                            />
                            <span style={{ fontSize: '0.8rem', color: VIZ.inkSecondary }}>{segment.label}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: VIZ.ink }}>
                                {formatValue(segment.value, format)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: VIZ.inkMuted }}>{share.toFixed(1)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
