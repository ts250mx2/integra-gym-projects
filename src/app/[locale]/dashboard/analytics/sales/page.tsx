'use client';

import { useState } from 'react';
import { LineChart } from 'lucide-react';
import ChartCard from '@/components/analytics/ChartCard';
import PeriodFilter, { PeriodState } from '@/components/analytics/PeriodFilter';
import StatTile from '@/components/analytics/StatTile';
import { EmphasisBar, RankedBar, StackedShare, TrendLine } from '@/components/analytics/charts';
import { DEFAULT_PERIOD, useAnalytics } from '@/components/analytics/useAnalytics';
import { VIZ, formatBucket, formatValue } from '@/components/analytics/vizTokens';

interface SalesAnalytics {
    period: { from: string; to: string; grain: 'day' | 'month' };
    source: 'ventas' | 'movimientos';
    summary: {
        total: number; tickets: number; avgTicket: number; units: number;
        deltaTotal: number | null; deltaTickets: number | null; deltaAvgTicket: number | null;
    };
    trend: { name: string; value: number; tickets: number }[];
    topProducts: { name: string; value: number; units: number }[];
    mix: { membresias: number; productos: number };
    byPayment: { name: string; value: number }[];
    byBranch: { name: string; value: number }[];
}

export default function SalesAnalyticsPage() {
    const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
    const { data, isLoading, isStale, error, refresh } = useAnalytics<SalesAnalytics>('/api/analytics/sales', period);

    const money = (row: any) => formatValue(row.value, 'currency');

    return (
        <div className="viz-root" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <LineChart size={32} />
                    Analíticas de Ventas
                </h1>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>
                    Cómo se comporta la venta en el periodo, contra el periodo anterior de la misma duración.
                </p>
            </div>

            <PeriodFilter
                value={period}
                onChange={setPeriod}
                onRefresh={refresh}
                resolvedRange={data ? { from: data.period.from, to: data.period.to } : null}
            />

            {error && (
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', color: VIZ.critical }}>
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="neon-text">Cargando...</div>
            ) : !data ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <StatTile label="Venta total" value={data.summary.total} format="currency" delta={data.summary.deltaTotal} />
                        <StatTile label="Tickets" value={data.summary.tickets} delta={data.summary.deltaTickets} />
                        <StatTile label="Ticket promedio" value={data.summary.avgTicket} format="currency" delta={data.summary.deltaAvgTicket} />
                        <StatTile label="Unidades vendidas" value={data.summary.units} hint="Suma de cantidades del detalle" />
                    </div>

                    <ChartCard
                        title="Venta en el tiempo"
                        subtitle={data.period.grain === 'month' ? 'Total vendido por mes' : 'Total vendido por día'}
                        isStale={isStale}
                        columns={[
                            { key: 'name', label: 'Periodo', format: (row) => formatBucket(row.name) },
                            { key: 'value', label: 'Venta', align: 'right', format: money },
                            { key: 'tickets', label: 'Tickets', align: 'right', format: (row) => String(row.tickets) }
                        ]}
                        rows={data.trend}
                    >
                        <TrendLine data={data.trend} format="currency" />
                    </ChartCard>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                        <ChartCard
                            title="Lo más vendido"
                            subtitle="Top 10 por importe · el primero destacado"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Concepto' },
                                { key: 'units', label: 'Unidades', align: 'right', format: (row) => String(row.units) },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={data.topProducts}
                        >
                            <EmphasisBar data={data.topProducts} format="currency" />
                        </ChartCard>

                        <ChartCard
                            title="Venta por forma de pago"
                            subtitle="Importe cobrado por método"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Forma de pago' },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={data.byPayment}
                        >
                            <RankedBar data={data.byPayment} format="currency" />
                        </ChartCard>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                        <ChartCard
                            title="Mezcla membresías vs productos"
                            subtitle="Participación en el importe del periodo"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Tipo' },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={[
                                { name: 'Membresías y cuotas', value: data.mix.membresias },
                                { name: 'Productos', value: data.mix.productos }
                            ]}
                        >
                            <StackedShare
                                segments={[
                                    { label: 'Membresías y cuotas', value: data.mix.membresias },
                                    { label: 'Productos', value: data.mix.productos }
                                ]}
                            />
                        </ChartCard>

                        <ChartCard
                            title="Venta por sucursal"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Sucursal' },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={data.byBranch}
                        >
                            <RankedBar data={data.byBranch} format="currency" />
                        </ChartCard>
                    </div>

                    <p style={{ fontSize: '0.72rem', color: VIZ.inkMuted, lineHeight: 1.6 }}>
                        Fuente de ventas detectada: {data.source === 'movimientos' ? 'tblMovimientos (POS escritorio)' : 'tblVentas (POS web)'}.
                        Se excluyen las canceladas.
                        {data.source === 'movimientos' && ' El desglose por forma de pago puede diferir unos puntos del total: en el POS de escritorio los abonos y anticipos se registran contra el movimiento original.'}
                    </p>
                </div>
            )}
        </div>
    );
}
