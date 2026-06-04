'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    Users,
    Calendar,
    RotateCcw,
    Zap,
    LayoutDashboard,
    UserPlus,
    Building2,
    DollarSign,
    UserCheck,
    Clock,
    CalendarClock,
    X
} from 'lucide-react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Treemap,
    ResponsiveContainer
} from 'recharts';

interface BranchSale {
    name: string;
    IdSucursal: number;
    total: number;
    operaciones: number;
    ticketPromedio: number;
}

interface BranchDetailRow {
    IdMovimiento: number;
    IdSucursal: number;
    Sucursal: string;
    Folio: string;
    Fecha: string;
    Foto: string | null;
    Codigo: string;
    Socio: string;
    Cantidad: number;
    FormaPago: string;
    Total: number;
    Status: string;
}

interface SaleDetailRow {
    Cantidad: number;
    Descripcion: string;
    Inicio: string | null;
    Fin: string | null;
    Precio: number;
    Total: number;
}

interface MonthlyHistory {
    MesTexto: string;
    Total: number;
}

interface VisitsHeatmapItem {
    dayOfWeek: number;
    hourOfDay: number;
    count: number;
}

interface ActiveMembersHistoryItem {
    date: string;
    label: string;
    count: number;
}

interface ExpiringMember {
    name: string;
    expiry: string;
    branch: string;
}

const VIBRANT_COLORS = [
    '#00f3ff', // neon blue
    '#d300ff', // neon purple
    '#39ff14', // neon green
    '#ff007f', // neon pink
    '#ffb700', // neon orange
    '#00ffcc', // neon mint
    '#ffff00', // neon yellow
    '#ff4d4d'  // neon red
];

interface CustomTreemapProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    index?: number;
    name?: string;
    value?: number;
    selectedField?: 'total' | 'operaciones' | 'ticketPromedio';
    formatCurrency: (v: number) => string;
}

const CustomTreemapContent = (props: CustomTreemapProps) => {
    const { x = 0, y = 0, width = 0, height = 0, index = 0, name = '', value = 0, selectedField = 'total', formatCurrency } = props;
    const color = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
    
    if (width < 45 || height < 30) return null;

    const valStr = selectedField === 'operaciones' ? String(value) : formatCurrency(value);

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: color,
                    stroke: 'rgba(10, 10, 15, 0.95)',
                    strokeWidth: 1.5,
                    fillOpacity: 0.85,
                }}
            />
            {width > 60 && height > 40 ? (
                <>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={11}
                        fontWeight="bold"
                        style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.9))' }}
                    >
                        {name}
                    </text>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 10}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.9)"
                        fontSize={10}
                        fontWeight="600"
                        style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.9))' }}
                    >
                        {valStr}
                    </text>
                </>
            ) : (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 3}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.9))' }}
                >
                    {name} ({valStr})
                </text>
            )}
        </g>
    );
};

interface Props {
    title: string;
    welcome: string;
}

export default function DashboardMetricsV1({ title, welcome }: Props) {
    const [loading, setLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState<string>('mes');
    const [metrics, setMetrics] = useState({
        ventas: 0,
        operaciones: 0,
        ticketPromedio: 0,
        visitas: 0,
        promedioVisitas: 0,
        sociosActivos: 0,
        growth: {
            mtd: 0,
            lmtd: 0,
            percent: 0
        },
        branchSales: [] as BranchSale[],
        monthlyHistory: [] as MonthlyHistory[],
        visitsHeatmap: [] as VisitsHeatmapItem[],
        activeMembersHistory: [] as ActiveMembersHistoryItem[],
        expiringMembers: [] as ExpiringMember[]
    });

    // Dates initialization (Today)
    const getTodayStr = () => new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState(getTodayStr());
    const [selectedField, setSelectedField] = useState<'total' | 'operaciones' | 'ticketPromedio'>('total');
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'treemap'>('bar');
    const [activeView, setActiveView] = useState<'branches' | 'growth' | 'visits' | 'activeMembers'>('branches');
    const [growthMode, setGrowthMode] = useState<'total' | 'mtd'>('total');
    const [gender, setGender] = useState<'all' | 'men' | 'women'>('all');

    // Branch Detail Modal state
    const [branchModal, setBranchModal] = useState<{ isOpen: boolean; branchName: string; branchId: number | null; rows: BranchDetailRow[]; loading: boolean; }>(
        { isOpen: false, branchName: '', branchId: null, rows: [], loading: false }
    );

    // Sale Detail Modal state
    const [saleModal, setSaleModal] = useState<{ isOpen: boolean; folio: string; rows: SaleDetailRow[]; loading: boolean; }>(
        { isOpen: false, folio: '', rows: [], loading: false }
    );

    const fetchBranchDetail = async (branchId: number, branchName: string) => {
        setBranchModal({ isOpen: true, branchName, branchId, rows: [], loading: true });
        try {
            const res = await fetch(`/api/dashboard-v1/branch-detail?startDate=${startDate}&endDate=${endDate}&branchId=${branchId}`);
            const data = await res.json();
            setBranchModal(prev => ({ ...prev, rows: data.data || [], loading: false }));
        } catch (err) {
            console.error('Error fetching branch detail:', err);
            setBranchModal(prev => ({ ...prev, loading: false }));
        }
    };

    const fetchSaleDetail = async (movId: number, branchId: number, folio: string) => {
        setSaleModal({ isOpen: true, folio, rows: [], loading: true });
        try {
            const res = await fetch(`/api/dashboard-v1/sale-detail?movId=${movId}&branchId=${branchId}`);
            const data = await res.json();
            setSaleModal(prev => ({ ...prev, rows: data.data || [], loading: false }));
        } catch (err) {
            console.error('Error fetching sale detail:', err);
            setSaleModal(prev => ({ ...prev, loading: false }));
        }
    };

    const exportBranchDetailToExcel = () => {
        if (!branchModal.rows.length) return;
        const exportData = branchModal.rows.map(row => ({
            'Folio': row.Folio,
            'Fecha': new Date(row.Fecha).toLocaleString('es-MX'),
            'Socio': row.Socio,
            'Código': row.Codigo || '',
            'Cantidad': row.Cantidad,
            'Forma Pago': row.FormaPago || '',
            'Total': row.Total,
            'Status': row.Status
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        // Column widths
        ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
        const fileName = `Ventas_${branchModal.branchName}_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    useEffect(() => {
        fetchMetrics();
    }, [startDate, endDate, growthMode, gender]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard-v1/metrics?startDate=${startDate}&endDate=${endDate}&growthMode=${growthMode}&gender=${gender}`);
            const data = await res.json();
            if (data && !data.error) {
                setMetrics(data);
            }
        } catch (error) {
            console.error('Error fetching v1 metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const setPeriod = (period: string) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case 'hoy':
                start = today;
                end = today;
                break;
            case 'ayer':
                start = new Date(today);
                start.setDate(today.getDate() - 1);
                end = new Date(start);
                break;
            case 'semana':
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay());
                end = today;
                break;
            case '7dias':
                start = new Date(today);
                start.setDate(today.getDate() - 6);
                end = today;
                break;
            case 'mes':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = today;
                break;
            case 'mesAnterior':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        setActivePeriod(period);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    return (
        <>
            <div style={{ marginTop: '0' }}>
                {/* Header with Title and Filters */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '1rem',
                }}>
                    <div>
                        <h1 className="neon-text" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            margin: 0
                        }}>
                            <LayoutDashboard size={32} />
                            {title}
                        </h1>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {[
                                { id: 'hoy', label: 'Hoy' },
                                { id: 'ayer', label: 'Ayer' },
                                { id: 'semana', label: 'Semana' },
                                { id: '7dias', label: '7 días' },
                                { id: 'mes', label: 'Mes' },
                                { id: 'mesAnterior', label: 'Mes anterior' },
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setPeriod(p.id)}
                                    className="btn-secondary"
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.7rem',
                                        height: '32px',
                                        backgroundColor: activePeriod === p.id ? 'rgba(0, 243, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        borderColor: activePeriod === p.id ? 'rgba(0, 243, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                                        color: activePeriod === p.id ? 'var(--neon-blue)' : 'inherit',
                                        fontWeight: activePeriod === p.id ? 'bold' : 'normal',
                                        boxShadow: activePeriod === p.id ? '0 0 8px rgba(0,243,255,0.2)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                                type="date"
                                className="input-field"
                                style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.8rem', height: '32px' }}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <input
                                type="date"
                                className="input-field"
                                style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.8rem', height: '32px' }}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                            <button
                                onClick={fetchMetrics}
                                className="btn-primary"
                                style={{ padding: '0 0.6rem', borderRadius: '8px', height: '32px' }}
                                disabled={loading}
                            >
                                <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                </div>

                <p style={{ color: 'var(--light-gray)', marginBottom: '2rem' }}>
                    {welcome}
                </p>

                {/* KPI Cards Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem'
                }}>
                    {/* Sales Card (Consolidated) */}
                    <div
                        onClick={() => setActiveView('branches')}
                        className="glass-card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '1rem',
                            minHeight: '140px',
                            cursor: 'pointer',
                            border: activeView === 'branches' ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                            transition: 'all 0.3s ease',
                            boxShadow: activeView === 'branches' ? '0 0 15px rgba(0, 243, 255, 0.2)' : 'none'
                        }}
                    >
                        <div style={{ position: 'absolute', top: '5px', right: '5px', opacity: 0.1 }}>
                            <TrendingUp size={48} color="var(--neon-blue)" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--light-gray)', marginBottom: '0.2rem' }}>
                            <TrendingUp size={14} color="var(--neon-blue)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Ventas</span>
                        </div>
                        <h2 className="neon-text-blue" style={{ fontSize: '1.75rem', margin: '0.25rem 0' }}>{formatCurrency(metrics.ventas)}</h2>

                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                            <div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Operaciones</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--neon-green)' }}>{metrics.operaciones}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Ticket Promedio</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--neon-purple)' }}>{formatCurrency(metrics.ticketPromedio)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Sales Growth Card */}
                    <div
                        onClick={() => setActiveView('growth')}
                        className="glass-card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '1rem',
                            minHeight: '140px',
                            cursor: 'pointer',
                            border: activeView === 'growth' ? '1px solid var(--neon-green)' : '1px solid var(--glass-border)',
                            transition: 'all 0.3s ease',
                            boxShadow: activeView === 'growth' ? '0 0 15px rgba(57, 255, 20, 0.2)' : 'none'
                        }}
                    >
                        <div style={{ position: 'absolute', top: '5px', right: '5px', opacity: 0.1 }}>
                            {metrics.growth.percent >= 0 ? (
                                <TrendingUp size={48} color="var(--neon-green)" />
                            ) : (
                                <TrendingDown size={48} color="#ff4d4d" />
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--light-gray)', marginBottom: '0.2rem' }}>
                            {metrics.growth.percent >= 0 ? (
                                <TrendingUp size={14} color="var(--neon-green)" />
                            ) : (
                                <TrendingDown size={14} color="#ff4d4d" />
                            )}
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Crecimiento Ventas</span>
                        </div>
                        <h2 style={{
                            fontSize: '1.75rem',
                            margin: '0.25rem 0',
                            color: metrics.growth.percent >= 0 ? 'var(--neon-green)' : '#ff4d4d',
                            textShadow: metrics.growth.percent >= 0 ? '0 0 10px rgba(57, 255, 20, 0.5)' : '0 0 10px rgba(255, 77, 77, 0.5)'
                        }}>
                            {metrics.growth.percent >= 0 ? '+' : ''}{metrics.growth.percent.toFixed(1)}%
                        </h2>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                            <div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Mes Actual</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(metrics.growth.mtd)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Mes Pasado</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>{formatCurrency(metrics.growth.lmtd)}</div>
                            </div>
                        </div>
                    </div>

                    <div
                        onClick={() => setActiveView('visits')}
                        className="glass-card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '1rem',
                            minHeight: '140px',
                            cursor: 'pointer',
                            border: activeView === 'visits' ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                            transition: 'all 0.3s ease',
                            boxShadow: activeView === 'visits' ? '0 0 15px rgba(0, 243, 255, 0.2)' : 'none'
                        }}
                    >
                        <div style={{ position: 'absolute', top: '5px', right: '5px', opacity: 0.1 }}>
                            <Clock size={48} color="var(--neon-blue)" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--light-gray)', marginBottom: '0.2rem' }}>
                            <Clock size={14} color="var(--neon-blue)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Visitas</span>
                        </div>
                        <h2 className="neon-text-blue" style={{ fontSize: '1.75rem', margin: '0.25rem 0' }}>{metrics.visitas}</h2>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Accesos registrados</span>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Promedio / día</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--neon-blue)' }}>{metrics.promedioVisitas}</div>
                            </div>
                        </div>
                    </div>

                    {/* Active Members Card */}
                    <div
                        onClick={() => setActiveView('activeMembers')}
                        className="glass-card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '1rem',
                            minHeight: '140px',
                            cursor: 'pointer',
                            border: activeView === 'activeMembers' ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                            transition: 'all 0.3s ease',
                            boxShadow: activeView === 'activeMembers' ? '0 0 15px rgba(0, 243, 255, 0.2)' : 'none'
                        }}
                    >
                        <div style={{ position: 'absolute', top: '5px', right: '5px', opacity: 0.1 }}>
                            <UserPlus size={48} color="var(--neon-blue)" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--light-gray)', marginBottom: '0.2rem' }}>
                            <UserPlus size={14} color="var(--neon-blue)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Socios Activos</span>
                        </div>
                        <h2 className="neon-text-blue" style={{ fontSize: '1.75rem', margin: '0.25rem 0' }}>{metrics.sociosActivos}</h2>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)', opacity: 0.6 }}>Total hoy</span>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase' }}>Vencen este mes</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--neon-purple)' }}>
                                    {metrics.expiringMembers?.length || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeView === 'branches' ? (
                        <>
                            {/* Branch Metrics Header & Controls */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'total', label: 'Ventas', icon: <DollarSign size={14} /> },
                                        { id: 'operaciones', label: 'Operaciones', icon: <ShoppingCart size={14} /> },
                                        { id: 'ticketPromedio', label: 'Ticket Promedio', icon: <TrendingUp size={14} /> },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setSelectedField(f.id as any)}
                                            className={selectedField === f.id ? 'btn-primary' : 'btn-secondary'}
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                height: '32px'
                                            }}
                                        >
                                            {f.icon}
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
                                    {[
                                        { id: 'bar', label: 'Barra', color: 'var(--neon-blue)' },
                                        { id: 'pie', label: 'Pastel', color: 'var(--neon-purple)' },
                                        { id: 'treemap', label: 'Rectángulos', color: 'var(--neon-green)' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setChartType(opt.id as any)}
                                            style={{
                                                padding: '0.3rem 0.7rem',
                                                fontSize: '0.7rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: chartType === opt.id ? opt.color : 'transparent',
                                                color: chartType === opt.id ? (opt.id === 'treemap' ? 'black' : 'white') : 'var(--light-gray)',
                                                fontWeight: chartType === opt.id ? 'bold' : 'normal',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                                {/* Chart Card */}
                                <div className="glass-card" style={{ padding: '1.25rem', height: '420px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <Building2 size={18} color={chartType === 'bar' ? 'var(--neon-blue)' : chartType === 'pie' ? 'var(--neon-purple)' : 'var(--neon-green)'} />
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                            {selectedField === 'total' ? 'Ventas' : selectedField === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'} por Sucursal
                                        </h3>
                                    </div>

                                    <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartType === 'bar' ? (
                                                <BarChart data={metrics.branchSales} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis
                                                        dataKey="name"
                                                        stroke="var(--light-gray)"
                                                        fontSize={10}
                                                        tick={{ fill: 'var(--light-gray)' }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        interval={0}
                                                    />
                                                    <YAxis
                                                        stroke="var(--light-gray)"
                                                        fontSize={10}
                                                        tick={{ fill: 'var(--light-gray)' }}
                                                        tickFormatter={(value) => selectedField === 'operaciones' ? value : `$${value}`}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                                                        formatter={(value: any) => [
                                                            selectedField === 'operaciones' ? value : formatCurrency(Number(value || 0)),
                                                            selectedField === 'total' ? 'Ventas' : selectedField === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'
                                                        ]}
                                                    />
                                                    <Bar dataKey={selectedField} radius={[4, 4, 0, 0]}>
                                                        {metrics.branchSales.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            ) : chartType === 'pie' ? (
                                                <PieChart>
                                                    <Pie
                                                        data={metrics.branchSales}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        dataKey={selectedField}
                                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                                    >
                                                        {metrics.branchSales.map((entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                                                        formatter={(value: any) => [
                                                            selectedField === 'operaciones' ? value : formatCurrency(Number(value || 0)),
                                                            selectedField === 'total' ? 'Ventas' : selectedField === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'
                                                        ]}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                                </PieChart>
                                            ) : (
                                                <Treemap
                                                    data={metrics.branchSales as any[]}
                                                    dataKey={selectedField}
                                                    aspectRatio={4 / 3}
                                                    stroke="rgba(10, 10, 15, 0.95)"
                                                    content={(props: any) => (
                                                        <CustomTreemapContent
                                                            {...props}
                                                            selectedField={selectedField}
                                                            formatCurrency={formatCurrency}
                                                        />
                                                    )}
                                                >
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                                                        formatter={(value: any) => [
                                                            selectedField === 'operaciones' ? value : formatCurrency(Number(value || 0)),
                                                            selectedField === 'total' ? 'Ventas' : selectedField === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'
                                                        ]}
                                                    />
                                                </Treemap>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Detail Table Card */}
                                <div className="glass-card" style={{ padding: '1.25rem', height: '420px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <LayoutDashboard size={18} color="var(--neon-green)" />
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Desglose Detallado</h3>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', color: 'var(--light-gray)', fontWeight: '500' }}>Sucursal</th>
                                                    <th style={{ textAlign: 'right', padding: '0.5rem 0', color: 'var(--light-gray)', fontWeight: '500' }}>
                                                        {selectedField === 'total' ? 'Ventas' : selectedField === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'}
                                                    </th>
                                                    <th style={{ textAlign: 'right', padding: '0.5rem 0', color: 'var(--light-gray)', fontWeight: '500' }}>%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metrics.branchSales.length > 0 ? (
                                                    metrics.branchSales.map((branch, idx) => {
                                                        const totalMetric = metrics.branchSales.reduce((acc, b) => acc + (b as any)[selectedField], 0);
                                                        const percent = totalMetric > 0 ? (((branch as any)[selectedField] / totalMetric) * 100).toFixed(1) : '0.0';

                                                        return (
                                                            <tr
                                                                key={idx}
                                                                onClick={() => branch.IdSucursal && fetchBranchDetail(branch.IdSucursal, branch.name)}
                                                                style={{
                                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                    cursor: branch.IdSucursal ? 'pointer' : 'default',
                                                                    transition: 'background 0.2s'
                                                                }}
                                                                className="table-row-hover"
                                                            >
                                                                <td style={{ padding: '0.75rem 0' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <div style={{
                                                                            width: '8px',
                                                                            height: '8px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: VIBRANT_COLORS[idx % VIBRANT_COLORS.length]
                                                                        }} />
                                                                        {branch.name}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                                    {selectedField === 'operaciones' ? (branch as any)[selectedField] : formatCurrency((branch as any)[selectedField])}
                                                                </td>
                                                                <td style={{ textAlign: 'right', color: 'var(--light-gray)', fontSize: '0.75rem' }}>{percent}%</td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay datos para el periodo seleccionado</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--light-gray)' }}>Total General</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--neon-blue)' }}>
                                            {selectedField === 'operaciones'
                                                ? metrics.branchSales.reduce((acc, b) => acc + b.operaciones, 0)
                                                : formatCurrency(metrics.branchSales.reduce((acc, b) => acc + (selectedField === 'total' ? b.total : b.ticketPromedio), 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeView === 'visits' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="glass-card" style={{ padding: '1.5rem', minHeight: '400px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <Clock size={20} color="var(--neon-blue)" />
                                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                            Mapa de Calor: Visitas por Día y Hora
                                        </h3>
                                    </div>

                                    {/* Gender Filter Toggles */}
                                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
                                        {([
                                            { id: 'all', label: 'Todos' },
                                            { id: 'men', label: 'Hombres' },
                                            { id: 'women', label: 'Mujeres' }
                                        ] as const).map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => setGender(g.id)}
                                                style={{
                                                    padding: '0.3rem 0.7rem',
                                                    fontSize: '0.7rem',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: gender === g.id ? 'var(--neon-blue)' : 'transparent',
                                                    color: gender === g.id ? 'white' : 'var(--light-gray)',
                                                    fontWeight: gender === g.id ? 'bold' : 'normal',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '80px repeat(24, 1fr)',
                                        gap: '4px',
                                        minWidth: '800px'
                                    }}>
                                        {/* Header: Hours */}
                                        <div />
                                        {Array.from({ length: 24 }).map((_, h) => (
                                            <div key={h} style={{ fontSize: '0.65rem', color: 'var(--light-gray)', textAlign: 'center' }}>
                                                {h}h
                                            </div>
                                        ))}

                                        {/* Rows: Days */}
                                        {[
                                            { id: 2, label: 'Lunes' },
                                            { id: 3, label: 'Martes' },
                                            { id: 4, label: 'Miércoles' },
                                            { id: 5, label: 'Jueves' },
                                            { id: 6, label: 'Viernes' },
                                            { id: 7, label: 'Sábado' },
                                            { id: 1, label: 'Domingo' },
                                        ].map(day => {
                                            const maxCount = Math.max(...metrics.visitsHeatmap.map(d => d.count), 1);

                                            return (
                                                <React.Fragment key={day.id}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--light-gray)', display: 'flex', alignItems: 'center' }}>
                                                        {day.label}
                                                    </div>
                                                    {Array.from({ length: 24 }).map((_, h) => {
                                                        const item = metrics.visitsHeatmap.find(d => d.dayOfWeek === day.id && d.hourOfDay === h);
                                                        const count = item?.count || 0;
                                                        const intensity = count / maxCount;

                                                        // Emerald Ice 3-point gradient (Dark Teal -> Turquoise -> Neon Green)
                                                        let r, g, b;
                                                        if (intensity < 0.5) {
                                                            const f = intensity * 2;
                                                            // From #002b2d (0, 43, 45) to #008f95 (0, 143, 149)
                                                            r = 0;
                                                            g = Math.round(43 + (143 - 43) * f);
                                                            b = Math.round(45 + (149 - 45) * f);
                                                        } else {
                                                            const f = (intensity - 0.5) * 2;
                                                            // From #008f95 (0, 143, 149) to #39ff14 (57, 255, 20)
                                                            r = Math.round(0 + 57 * f);
                                                            g = Math.round(143 + (255 - 143) * f);
                                                            b = Math.round(149 - 129 * f);
                                                        }

                                                        return (
                                                            <div
                                                                key={h}
                                                                title={`${day.label} ${h}:00 - ${count} visitas`}
                                                                style={{
                                                                    aspectRatio: '1/1',
                                                                    backgroundColor: count > 0
                                                                        ? `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.4})`
                                                                        : 'rgba(255, 255, 255, 0.03)',
                                                                    borderRadius: '2px',
                                                                    border: count > 0 ? `1px solid rgba(${r}, ${g}, ${b}, 0.3)` : '1px solid rgba(255, 255, 255, 0.05)',
                                                                    transition: 'all 0.2s ease',
                                                                    cursor: 'default'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)' }}>Bajo (Teal)</span>
                                    <div style={{ display: 'flex', gap: '3px' }}>
                                        {[0, 0.25, 0.5, 0.75, 1].map(i => {
                                            let r, g, b;
                                            if (i < 0.5) {
                                                const f = i * 2;
                                                r = 0;
                                                g = Math.round(43 + (143 - 43) * f);
                                                b = Math.round(45 + (149 - 45) * f);
                                            } else {
                                                const f = (i - 0.5) * 2;
                                                r = Math.round(0 + 57 * f);
                                                g = Math.round(143 + (255 - 143) * f);
                                                b = Math.round(149 - 129 * f);
                                            }
                                            return (
                                                <div key={i} style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '2px',
                                                    backgroundColor: `rgba(${r}, ${g}, ${b}, ${0.5 + i * 0.4})`
                                                }} />
                                            );
                                        })}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)' }}>Pico (Verde Neón)</span>
                                </div>
                            </div>
                        </div>
                    ) : activeView === 'activeMembers' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="glass-card" style={{ padding: '1.5rem', minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <Users size={20} color="var(--neon-blue)" />
                                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                            Línea de Tiempo de Socios Activos (Historial y Proyección)
                                        </h3>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--light-gray)', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                        Periodo de 60 días: {metrics.activeMembersHistory.length > 0 ? (
                                            `${new Date(metrics.activeMembersHistory[0].date).toLocaleDateString()} - ${new Date(metrics.activeMembersHistory[metrics.activeMembersHistory.length - 1].date).toLocaleDateString()}`
                                        ) : 'Cargando datos...'}
                                    </div>
                                </div>

                                <div style={{ width: '100%', height: '350px' }}>
                                    {metrics.activeMembersHistory.length > 0 ? (
                                        (() => {
                                            const firstHistoryItem = metrics.activeMembersHistory[0];
                                            const branchKeys = firstHistoryItem
                                                ? Object.keys(firstHistoryItem).filter(k => k !== 'date' && k !== 'label' && k !== 'count')
                                                : [];
                                            const BRANCH_COLORS = [
                                                'var(--neon-blue)',
                                                'var(--neon-purple)',
                                                'var(--neon-green)',
                                                '#ff4d4d',
                                                '#ffb700',
                                                '#ff007f',
                                                '#00ffcc',
                                                '#ffff00'
                                            ];

                                            return (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={metrics.activeMembersHistory} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                        <XAxis
                                                            dataKey="label"
                                                            stroke="var(--light-gray)"
                                                            fontSize={10}
                                                            tick={{ fill: 'var(--light-gray)' }}
                                                            interval={6}
                                                        />
                                                        <YAxis
                                                            stroke="var(--light-gray)"
                                                            fontSize={10}
                                                            tick={{ fill: 'var(--light-gray)' }}
                                                            domain={['auto', 'auto']}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                                                                border: '1px solid rgba(0, 243, 255, 0.2)',
                                                                borderRadius: '8px',
                                                                fontSize: '0.8rem'
                                                            }}
                                                            formatter={(value: any, name?: any) => [value, name === 'count' ? 'Total' : String(name || '')]}
                                                            labelStyle={{ color: 'var(--neon-blue)', fontWeight: 'bold', marginBottom: '4px' }}
                                                        />
                                                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                                        {branchKeys.map((branch, idx) => (
                                                            <Line
                                                                key={branch}
                                                                type="monotone"
                                                                dataKey={branch}
                                                                name={branch}
                                                                stroke={BRANCH_COLORS[idx % BRANCH_COLORS.length]}
                                                                strokeWidth={2}
                                                                dot={(props: any) => {
                                                                    const { cx, cy, payload } = props;
                                                                    const today = getTodayStr();
                                                                    if (payload.date === today) {
                                                                        return (
                                                                            <circle 
                                                                                key={`${branch}-${payload.date}`} 
                                                                                cx={cx} 
                                                                                cy={cy} 
                                                                                r={4} 
                                                                                fill="white" 
                                                                                stroke={BRANCH_COLORS[idx % BRANCH_COLORS.length]} 
                                                                                strokeWidth={2} 
                                                                            />
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        ))}
                                                        {(branchKeys.length > 1 || branchKeys.length === 0) && (
                                                            <Line
                                                                type="monotone"
                                                                dataKey="count"
                                                                name="Total"
                                                                stroke="rgba(255, 255, 255, 0.6)"
                                                                strokeDasharray="4 4"
                                                                strokeWidth={2.5}
                                                                dot={(props: any) => {
                                                                    const { cx, cy, payload } = props;
                                                                    const today = getTodayStr();
                                                                    if (payload.date === today) {
                                                                        return <circle key={`total-${payload.date}`} cx={cx} cy={cy} r={5} fill="white" stroke="rgba(255, 255, 255, 0.8)" strokeWidth={2} />;
                                                                    }
                                                                    return null;
                                                                }}
                                                                activeDot={{ r: 7 }}
                                                            />
                                                        )}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            );
                                        })()
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--light-gray)', opacity: 0.5 }}>
                                            No hay datos disponibles para este periodo. (Puntos: {metrics.activeMembersHistory.length})
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.7rem', color: 'var(--light-gray)', opacity: 0.6 }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white', border: '2px solid var(--neon-blue)' }} />
                                    <span>El punto blanco indica el día de hoy. Hacia la derecha se muestra la proyección de retención actual.</span>
                                </div>

                                {/* Expiring Members This Month Section */}
                                <div style={{ marginTop: '2.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                                        <Clock size={18} color="var(--neon-purple)" />
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                            Socios que Vencen este Mes ({new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })})
                                        </h3>
                                    </div>

                                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--light-gray)', fontWeight: 'bold' }}>Socio</th>
                                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--light-gray)', fontWeight: 'bold' }}>Sucursal</th>
                                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem', color: 'var(--light-gray)', fontWeight: 'bold' }}>Vencimiento</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {metrics.expiringMembers && metrics.expiringMembers.length > 0 ? (
                                                        metrics.expiringMembers.map((m, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: 'white' }}>{m.name}</td>
                                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)' }}>{m.branch || 'N/A'}</td>
                                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        padding: '0.2rem 0.5rem',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: 'rgba(235, 64, 52, 0.1)',
                                                                        color: '#ff4d4d',
                                                                        fontSize: '0.7rem',
                                                                        border: '1px solid rgba(235, 64, 52, 0.2)'
                                                                    }}>
                                                                        {new Date(m.expiry).toLocaleDateString('es-MX')}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--light-gray)', opacity: 0.5 }}>
                                                                No hay socios con vencimiento este mes.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Growth Mode Controls */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
                                    <button
                                        onClick={() => setGrowthMode('total')}
                                        style={{
                                            padding: '0.3rem 0.7rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: growthMode === 'total' ? 'var(--neon-green)' : 'transparent',
                                            color: growthMode === 'total' ? 'black' : 'var(--light-gray)',
                                            fontWeight: growthMode === 'total' ? 'bold' : 'normal',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        Histórico Total
                                    </button>
                                    <button
                                        onClick={() => setGrowthMode('mtd')}
                                        style={{
                                            padding: '0.3rem 0.7rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: growthMode === 'mtd' ? 'var(--neon-blue)' : 'transparent',
                                            color: growthMode === 'mtd' ? 'white' : 'var(--light-gray)',
                                            fontWeight: growthMode === 'mtd' ? 'bold' : 'normal',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        Al Día (MTD)
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                                {/* Monthly Growth Chart Card */}
                                <div className="glass-card" style={{ padding: '1.25rem', height: '420px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <TrendingUp size={18} color={growthMode === 'mtd' ? 'var(--neon-blue)' : 'var(--neon-green)'} />
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                            Historial {growthMode === 'total' ? 'Total' : 'Al Día (MTD)'}
                                        </h3>
                                    </div>

                                    <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={metrics.monthlyHistory} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                                                <defs>
                                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--neon-green)" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis
                                                    dataKey="MesTexto"
                                                    stroke="var(--light-gray)"
                                                    fontSize={10}
                                                    tick={{ fill: 'var(--light-gray)' }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    interval={0}
                                                />
                                                <YAxis
                                                    stroke="var(--light-gray)"
                                                    fontSize={10}
                                                    tick={{ fill: 'var(--light-gray)' }}
                                                    tickFormatter={(value) => `$${value} `}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                                                    formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Ventas Totales']}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="Total"
                                                    stroke="var(--neon-green)"
                                                    fillOpacity={1}
                                                    fill="url(#colorTotal)"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: 'var(--neon-green)', strokeWidth: 2, stroke: '#0a0a0f' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Monthly History Table Card */}
                                <div className="glass-card" style={{ padding: '1.25rem', height: '420px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <LayoutDashboard size={18} color="var(--neon-blue)" />
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Detalle Mensual</h3>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', color: 'var(--light-gray)', fontWeight: '500' }}>Mes</th>
                                                    <th style={{ textAlign: 'right', padding: '0.5rem 0', color: 'var(--light-gray)', fontWeight: '500' }}>Total Ventas</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metrics.monthlyHistory.length > 0 ? (
                                                    metrics.monthlyHistory.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <td style={{ padding: '0.75rem 0' }}>{item.MesTexto}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.Total)}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay historial disponible</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== Branch Sales Detail Modal ===== */}
            {
                branchModal.isOpen && (
                    <div
                        onClick={() => setBranchModal(prev => ({ ...prev, isOpen: false }))}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(6px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '1rem'
                        }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'var(--bg, #0a0a0f)',
                                border: '1px solid rgba(0, 243, 255, 0.25)',
                                borderRadius: '16px',
                                width: '95%', maxWidth: '1100px',
                                maxHeight: '90vh',
                                display: 'flex', flexDirection: 'column',
                                boxShadow: '0 25px 70px rgba(0,0,0,0.7), 0 0 40px rgba(0,243,255,0.07)'
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '1.25rem 1.5rem',
                                borderBottom: '1px solid rgba(255,255,255,0.07)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Building2 size={22} color="var(--neon-blue)" />
                                    <div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--light-gray)', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalle de Ventas</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{branchModal.branchName}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.7rem', borderRadius: '6px' }}>
                                        {startDate} → {endDate}
                                    </span>
                                    <button
                                        onClick={() => setBranchModal(prev => ({ ...prev, isOpen: false }))}
                                        style={{
                                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: '8px', color: 'white', cursor: 'pointer',
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {branchModal.loading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '0.75rem', color: 'var(--light-gray)' }}>
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            border: '3px solid rgba(0,243,255,0.2)',
                                            borderTop: '3px solid var(--neon-blue)',
                                            animation: 'spin 0.8s linear infinite'
                                        }} />
                                        Cargando transacciones...
                                    </div>
                                ) : branchModal.rows.length === 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--light-gray)', opacity: 0.5 }}>
                                        No hay transacciones para este periodo.
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg, #0a0a0f)', zIndex: 1 }}>
                                            <tr style={{ borderBottom: '2px solid rgba(0,243,255,0.15)' }}>
                                                {['Folio', 'Fecha', 'Código', 'Socio', 'Cant.', 'F. Pago', 'Total', 'Status'].map(h => (
                                                    <th key={h} style={{ padding: '0.85rem 1rem', textAlign: h === 'Total' || h === 'Cant.' ? 'right' : h === 'Status' ? 'center' : 'left', color: 'var(--light-gray)', fontWeight: '600', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {branchModal.rows.map((row, i) => {
                                                const isCancelled = row.Status === 'CANCELADO';
                                                return (
                                                    <tr
                                                        key={i}
                                                        className="table-row-hover"
                                                        onClick={() => fetchSaleDetail(row.IdMovimiento, row.IdSucursal, row.Folio)}
                                                        style={{
                                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                            backgroundColor: isCancelled ? 'rgba(255,77,77,0.03)' : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'),
                                                            opacity: isCancelled ? 0.7 : 1,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <td style={{ padding: '0.75rem 1rem', color: isCancelled ? '#ff4d4d' : 'var(--neon-blue)', fontWeight: 'bold', fontFamily: 'monospace', textDecoration: isCancelled ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>
                                                            {row.Folio}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)', whiteSpace: 'nowrap', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            {new Date(row.Fecha).toLocaleDateString('es-MX')} {new Date(row.Fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)', fontFamily: 'monospace', fontSize: '0.75rem', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            {row.Codigo || '—'}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 1rem', color: 'white', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                                                {row.Foto ? (() => {
                                                                    const fotoStr = String(row.Foto);
                                                                    const src = fotoStr.startsWith('data:') ? fotoStr : `data:image/jpeg;base64,${fotoStr}`;
                                                                    return (
                                                                        <div style={{ position: 'relative', flexShrink: 0 }} className="foto-hover-wrapper">
                                                                            <img
                                                                                src={src}
                                                                                alt=""
                                                                                style={{
                                                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                                                    objectFit: 'cover', display: 'block',
                                                                                    border: isCancelled ? '2px solid #ff4d4d' : '2px solid rgba(0,243,255,0.3)',
                                                                                    cursor: 'zoom-in',
                                                                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                                                                }}
                                                                                onMouseEnter={e => {
                                                                                    const wrapper = (e.currentTarget as HTMLElement).parentElement;
                                                                                    if (wrapper) {
                                                                                        const preview = wrapper.querySelector('.foto-preview') as HTMLElement;
                                                                                        if (preview) preview.style.opacity = '1';
                                                                                        if (preview) preview.style.pointerEvents = 'none';
                                                                                    }
                                                                                }}
                                                                                onMouseLeave={e => {
                                                                                    const wrapper = (e.currentTarget as HTMLElement).parentElement;
                                                                                    if (wrapper) {
                                                                                        const preview = wrapper.querySelector('.foto-preview') as HTMLElement;
                                                                                        if (preview) preview.style.opacity = '0';
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <img
                                                                                src={src}
                                                                                alt=""
                                                                                className="foto-preview"
                                                                                style={{
                                                                                    position: 'absolute', bottom: '38px', left: '50%',
                                                                                    transform: 'translateX(-50%)',
                                                                                    width: '200px', height: '200px', borderRadius: '12px',
                                                                                    objectFit: 'cover', zIndex: 999,
                                                                                    border: '3px solid rgba(0,243,255,0.5)',
                                                                                    boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
                                                                                    opacity: 0, pointerEvents: 'none',
                                                                                    transition: 'opacity 0.2s ease'
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    );
                                                                })() : (
                                                                    <div style={{
                                                                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                                                        border: '2px solid rgba(255,255,255,0.1)',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontSize: '0.75rem', color: 'var(--light-gray)', fontWeight: 'bold'
                                                                    }}>
                                                                        {(row.Socio || 'P')[0].toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                                                    {row.Socio}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--light-gray)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            {row.Cantidad}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)', whiteSpace: 'nowrap', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            {row.FormaPago || '—'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: isCancelled ? '#ff4d4d' : 'var(--neon-green)', whiteSpace: 'nowrap', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                            {formatCurrency(row.Total)}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                            <span style={{
                                                                padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold',
                                                                backgroundColor: isCancelled ? 'rgba(255,77,77,0.15)' : 'rgba(57,255,20,0.1)',
                                                                color: isCancelled ? '#ff4d4d' : 'var(--neon-green)',
                                                                border: `1px solid ${isCancelled ? 'rgba(255,77,77,0.3)' : 'rgba(57,255,20,0.2)'}`
                                                            }}>
                                                                {row.Status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Footer */}
                            {!branchModal.loading && branchModal.rows.length > 0 && (
                                <div style={{
                                    padding: '0.85rem 1.5rem',
                                    borderTop: '1px solid rgba(255,255,255,0.07)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.02)'
                                }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--light-gray)' }}>
                                        {branchModal.rows.length} transacciones &middot; {branchModal.rows.filter(r => r.Status === 'CANCELADO').length} canceladas
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <button
                                            onClick={exportBranchDetailToExcel}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '0.75rem', fontWeight: 'bold',
                                                backgroundColor: 'rgba(57,255,20,0.1)',
                                                color: 'var(--neon-green)',
                                                border: '1px solid rgba(57,255,20,0.3)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(57,255,20,0.2)')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(57,255,20,0.1)')}
                                        >
                                            ⬇ Exportar Excel
                                        </button>
                                        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--neon-green)' }}>
                                            Total neto: {formatCurrency(branchModal.rows.filter(r => r.Status !== 'CANCELADO').reduce((acc, r) => acc + r.Total, 0))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Sale Detail Nested Modal */}
            {saleModal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg, #0a0a0f)', width: '100%', maxWidth: '800px',
                        maxHeight: '90vh', borderRadius: '16px', border: '1px solid rgba(0,243,255,0.2)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,243,255,0.1)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeInUp 0.3s ease'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'linear-gradient(90deg, rgba(0,243,255,0.08) 0%, transparent 100%)'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: '0 0 0.3rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ color: 'var(--neon-blue)' }}>#</span>
                                    Folio {saleModal.folio}
                                </h2>
                                <span style={{ fontSize: '0.8rem', color: 'var(--light-gray)' }}>Detalle de artículos de la venta</span>
                            </div>
                            <button
                                onClick={() => setSaleModal(prev => ({ ...prev, isOpen: false }))}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--light-gray)', cursor: 'pointer', padding: '0.4rem',
                                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.color = 'white';
                                    e.currentTarget.style.background = 'rgba(255,77,77,0.2)';
                                    e.currentTarget.style.borderColor = 'rgba(255,77,77,0.4)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.color = 'var(--light-gray)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                            {saleModal.loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '1rem', color: 'var(--light-gray)' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        border: '3px solid rgba(0,243,255,0.2)',
                                        borderTop: '3px solid var(--neon-blue)',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Cargando detalle...
                                </div>
                            ) : saleModal.rows.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--light-gray)', opacity: 0.5 }}>
                                    No hay detalles de artículos para esta venta.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg, #0a0a0f)', zIndex: 1 }}>
                                        <tr style={{ borderBottom: '2px solid rgba(0,243,255,0.15)' }}>
                                            {['Cant.', 'Descripción', 'Inicio', 'Fin', 'Precio', 'Total'].map(h => (
                                                <th key={h} style={{ padding: '0.85rem 1rem', textAlign: (h === 'Precio' || h === 'Total' || h === 'Cant.') ? 'right' : 'left', color: 'var(--light-gray)', fontWeight: '600', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saleModal.rows.map((row, i) => (
                                            <tr key={i} style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                                            }}>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'white', fontWeight: 'bold' }}>
                                                    {row.Cantidad}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)' }}>
                                                    {row.Descripcion}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)' }}>
                                                    {row.Inicio ? new Date(row.Inicio).toLocaleDateString('es-MX') : '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--light-gray)' }}>
                                                    {row.Fin ? new Date(row.Fin).toLocaleDateString('es-MX') : '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--light-gray)' }}>
                                                    {formatCurrency(row.Precio)}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--neon-green)', fontWeight: 'bold' }}>
                                                    {formatCurrency(row.Total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
