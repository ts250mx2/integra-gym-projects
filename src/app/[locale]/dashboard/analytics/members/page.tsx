'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import ChartCard from '@/components/analytics/ChartCard';
import PeriodFilter, { PeriodState } from '@/components/analytics/PeriodFilter';
import StatTile from '@/components/analytics/StatTile';
import { EmphasisBar, RankedBar, TrendLine } from '@/components/analytics/charts';
import { DEFAULT_PERIOD, useAnalytics } from '@/components/analytics/useAnalytics';
import { VIZ, formatBucket } from '@/components/analytics/vizTokens';

interface MembersAnalytics {
    period: { from: string; to: string; grain: 'day' | 'month' };
    summary: {
        activos: number; vencidos: number; total: number; porVencer: number;
        altas: number; deltaAltas: number | null; visitas: number; visitantesUnicos: number;
    };
    joinTrend: { name: string; value: number }[];
    visitsByWeekday: { name: string; value: number }[];
    visitsByHour: { name: string; value: number }[];
    topMemberships: { name: string; value: number }[];
}

export default function MembersAnalyticsPage() {
    const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
    const { data, isLoading, isStale, error, refresh } = useAnalytics<MembersAnalytics>('/api/analytics/members', period);

    const count = (row: any) => String(row.value);

    // El pico de asistencia se resalta: es el dato que se usa para programar
    // personal y clases, y con todas las barras iguales habria que buscarlo.
    const peakIndex = (rows: { value: number }[]) =>
        rows.reduce((best, row, index, all) => (row.value > all[best].value ? index : best), 0);

    return (
        <div className="viz-root" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Users size={32} />
                    Analíticas de Socios
                </h1>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>
                    Padrón, altas y asistencia. El padrón es una foto de hoy; altas y visitas son del periodo.
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
                        <StatTile label="Socios activos" value={data.summary.activos} hint="Vigencia al día de hoy" />
                        <StatTile label="Vencidos" value={data.summary.vencidos} hint="Padrón activo con vigencia expirada" />
                        <StatTile label="Por vencer (7 días)" value={data.summary.porVencer} hint="Ventana de renovación" isAlert />
                        <StatTile label="Altas del periodo" value={data.summary.altas} delta={data.summary.deltaAltas} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <StatTile label="Visitas del periodo" value={data.summary.visitas} />
                        <StatTile label="Socios distintos que asistieron" value={data.summary.visitantesUnicos} />
                        <StatTile
                            label="Visitas por socio"
                            value={data.summary.visitantesUnicos > 0 ? data.summary.visitas / data.summary.visitantesUnicos : 0}
                            hint="Frecuencia media en el periodo"
                        />
                        <StatTile label="Padrón total" value={data.summary.total} hint="Socios no eliminados" />
                    </div>

                    <ChartCard
                        title="Altas de socios"
                        subtitle={data.period.grain === 'month' ? 'Nuevos socios por mes' : 'Nuevos socios por día'}
                        isStale={isStale}
                        columns={[
                            { key: 'name', label: 'Periodo', format: (row) => formatBucket(row.name) },
                            { key: 'value', label: 'Altas', align: 'right', format: count }
                        ]}
                        rows={data.joinTrend}
                    >
                        <TrendLine data={data.joinTrend} />
                    </ChartCard>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                        <ChartCard
                            title="Asistencia por día de la semana"
                            subtitle="El día pico destacado"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Día' },
                                { key: 'value', label: 'Visitas', align: 'right', format: count }
                            ]}
                            rows={data.visitsByWeekday}
                        >
                            <EmphasisBar data={data.visitsByWeekday} highlightIndex={peakIndex(data.visitsByWeekday)} />
                        </ChartCard>

                        <ChartCard
                            title="Asistencia por hora"
                            subtitle="Las 24 horas, incluidas las de cero"
                            isStale={isStale}
                            columns={[
                                { key: 'name', label: 'Hora' },
                                { key: 'value', label: 'Visitas', align: 'right', format: count }
                            ]}
                            rows={data.visitsByHour}
                        >
                            <RankedBar data={data.visitsByHour} layout="horizontal" />
                        </ChartCard>
                    </div>

                    <ChartCard
                        title="Membresías más vendidas"
                        subtitle="Top 10 por número de ventas en el periodo (excluye productos)"
                        isStale={isStale}
                        columns={[
                            { key: 'name', label: 'Membresía / cuota' },
                            { key: 'value', label: 'Ventas', align: 'right', format: count }
                        ]}
                        rows={data.topMemberships}
                    >
                        <EmphasisBar data={data.topMemberships} />
                    </ChartCard>
                </div>
            )}
        </div>
    );
}
