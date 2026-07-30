'use client';

import { useState } from 'react';
import { PieChart, ShoppingBag } from 'lucide-react';
import { Link } from '@/navigation';
import ChartCard from '@/components/analytics/ChartCard';
import PeriodFilter, { PeriodState } from '@/components/analytics/PeriodFilter';
import StatTile from '@/components/analytics/StatTile';
import { EmphasisBar, GroupedBar, RankedBar, TrendLine } from '@/components/analytics/charts';
import { DEFAULT_PERIOD, useAnalytics } from '@/components/analytics/useAnalytics';
import { VIZ, formatBucket, formatValue } from '@/components/analytics/vizTokens';

interface PurchasesAnalytics {
    period: { from: string; to: string; grain: 'day' | 'month' };
    empty: boolean;
    summary: {
        total: number; compras: number; partidas: number; unidades: number;
        deltaTotal: number | null; valorInventario: number; bajoStock: number;
    };
    trend: { name: string; value: number }[];
    topProviders: { name: string; value: number; compras: number }[];
    topProducts: { name: string; value: number; units: number }[];
    costVsPrice: { name: string; costo: number; precio: number }[];
}

export default function PurchasesAnalyticsPage() {
    const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
    const { data, isLoading, isStale, error, refresh } = useAnalytics<PurchasesAnalytics>('/api/analytics/purchases', period);

    const money = (row: any) => formatValue(row.value, 'currency');

    return (
        <div className="viz-root" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <PieChart size={32} />
                    Analíticas de Compras
                </h1>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>
                    Gasto con proveedores y valor del inventario. Solo productos: las cuotas no se compran.
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
            ) : !data ? null : data.empty ? (
                <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                    <ShoppingBag size={40} style={{ opacity: 0.4, marginBottom: '1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>Aún no hay compras registradas</h3>
                    <p style={{ fontSize: '0.85rem', color: VIZ.inkMuted, marginBottom: '1.5rem' }}>
                        Estas analíticas se llenan solas en cuanto registres la primera compra a un proveedor.
                    </p>
                    <Link href="/dashboard/expenses/purchases" className="btn-primary" style={{ textDecoration: 'none' }}>
                        Ir a Compras
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <StatTile
                            label="Total comprado"
                            value={data.summary.total}
                            format="currency"
                            delta={data.summary.deltaTotal}
                            upIsGood={false}
                        />
                        <StatTile label="Compras" value={data.summary.compras} />
                        <StatTile label="Valor del inventario" value={data.summary.valorInventario} format="currency" hint="Existencia × costo promedio" />
                        <StatTile label="Productos bajo stock" value={data.summary.bajoStock} isAlert hint="Existencia por debajo del mínimo" />
                    </div>

                    <ChartCard
                        title="Compras en el tiempo"
                        subtitle={data.period.grain === 'month' ? 'Gasto por mes' : 'Gasto por día'}
                        isStale={isStale}
                        columns={[
                            { key: 'name', label: 'Periodo', format: (row) => formatBucket(row.name) },
                            { key: 'value', label: 'Comprado', align: 'right', format: money }
                        ]}
                        rows={data.trend}
                    >
                        <TrendLine data={data.trend} format="currency" />
                    </ChartCard>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                        <ChartCard
                            title="Proveedores por gasto"
                            subtitle="Top 10 · el principal destacado"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Proveedor' },
                                { key: 'compras', label: 'Compras', align: 'right', format: (row) => String(row.compras) },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={data.topProviders}
                        >
                            <EmphasisBar data={data.topProviders} format="currency" />
                        </ChartCard>

                        <ChartCard
                            title="Productos más comprados"
                            subtitle="Top 10 por importe"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Producto' },
                                { key: 'units', label: 'Unidades', align: 'right', format: (row) => String(row.units) },
                                { key: 'value', label: 'Importe', align: 'right', format: money }
                            ]}
                            rows={data.topProducts}
                        >
                            <RankedBar data={data.topProducts} format="currency" />
                        </ChartCard>
                    </div>

                    <ChartCard
                        title="Costo promedio vs precio de venta"
                        subtitle="Productos con existencia, ordenados por margen unitario"
                        isStale={isStale}
                        columns={[
                            { key: 'name', label: 'Producto' },
                            { key: 'costo', label: 'Costo', align: 'right', format: (row) => formatValue(row.costo, 'currency') },
                            { key: 'precio', label: 'Precio', align: 'right', format: (row) => formatValue(row.precio, 'currency') },
                            { key: 'margen', label: 'Margen', align: 'right', format: (row) => formatValue(row.precio - row.costo, 'currency') }
                        ]}
                        rows={data.costVsPrice}
                    >
                        <GroupedBar
                            data={data.costVsPrice}
                            keys={['costo', 'precio']}
                            labels={['Costo promedio', 'Precio de venta']}
                        />
                    </ChartCard>
                </div>
            )}
        </div>
    );
}
