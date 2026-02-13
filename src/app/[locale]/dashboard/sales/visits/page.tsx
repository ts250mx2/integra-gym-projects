'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo } from 'react';
import { Search, Printer, Trash2, Calendar, FileText, User, ArrowUp, ArrowDown } from 'lucide-react';
import { printTicket } from '@/lib/ticket-utils';

export default function TicketsPage() {
    const t = useTranslations('Sidebar');

    // Filters
    const [searchType, setSearchType] = useState<'opening' | 'date'>('opening');
    const [openings, setOpenings] = useState<any[]>([]);
    const [selectedOpening, setSelectedOpening] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Sorting & Local Filtering
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});

    // Data
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRegister, setActiveRegister] = useState<any>(null);

    // Initial Load - Get Openings and Active Register
    useEffect(() => {
        // Set default dates to today
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);

        fetchActiveRegister();
        fetchOpenings();
    }, []);

    const fetchActiveRegister = async () => {
        try {
            const res = await fetch('/api/sales/register/status');
            const data = await res.json();
            setActiveRegister(data);
        } catch (error) {
            console.error('Error fetching register status:', error);
        }
    };

    const fetchOpenings = async () => {
        try {
            // Use session branch ID
            const res = await fetch(`/api/sales/openings`);
            const data = await res.json();
            setOpenings(data);

            // Auto-select latest if available
            if (data && data.length > 0) {
                setSelectedOpening(String(data[0].IdApertura));
            }
        } catch (error) {
            console.error('Error fetching openings:', error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Use session branch context by default (no explicit branchId param needed)
            const params = new URLSearchParams();

            if (searchType === 'opening') {
                if (!selectedOpening) {
                    alert('Seleccione una apertura');
                    setLoading(false);
                    return;
                }
                params.append('openingId', selectedOpening);
            } else {
                if (!startDate || !endDate) {
                    alert('Seleccione fechas');
                    setLoading(false);
                    return;
                }
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }

            const res = await fetch(`/api/sales/tickets?${params.toString()}`);
            const data = await res.json();
            setTickets(data);
        } catch (error) {
            console.error('Error searching tickets:', error);
            alert('Error al buscar tickets');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (ticketId: number) => {
        if (!confirm('¿Está seguro de eliminar este ticket?')) return;

        try {
            const res = await fetch('/api/sales/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh
                handleSearch();
            } else {
                alert('Error al eliminar ticket');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar ticket');
        }
    };

    // Auto search when opening selected
    useEffect(() => {
        if (selectedOpening) {
            // Ensure searchType is opening
            if (searchType !== 'opening') {
                setSearchType('opening');
            }
            handleSearch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOpening]);

    // Sorting Logic
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter Logic
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Derived Data: Filtered & Sorted
    const filteredAndSortedTickets = useMemo(() => {
        let result = [...tickets];

        // 1. Filter
        Object.keys(filters).forEach(key => {
            const filterValue = filters[key].toLowerCase();
            if (!filterValue) return;

            result = result.filter(ticket => {
                let cellValue = '';
                if (key === 'Socio') {
                    const code = ticket.CodigoSocio ? String(ticket.CodigoSocio) : '';
                    const name = ticket.Socio ? ticket.Socio : (ticket.CodigoSocio ? '' : 'PUBLIC');
                    return code.toLowerCase().includes(filterValue) || name.toLowerCase().includes(filterValue);
                } else if (key === 'Concepto') {
                    cellValue = ticket.ConceptoVenta || ticket.Concepto || 'Venta';
                } else if (key === 'Fecha') {
                    cellValue = new Date(ticket.FechaVenta).toLocaleString();
                } else if (key === 'Total') {
                    cellValue = String(ticket.Total);
                } else {
                    cellValue = ticket[key] ? String(ticket[key]) : '';
                }
                return cellValue.toLowerCase().includes(filterValue);
            });
        });

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                let aValue: any = a[sortConfig.key];
                let bValue: any = b[sortConfig.key];

                if (sortConfig.key === 'Socio') {
                    aValue = a.Socio || (a.CodigoSocio ? '' : 'PUBLIC');
                    bValue = b.Socio || (b.CodigoSocio ? '' : 'PUBLIC');
                } else if (sortConfig.key === 'Concepto') {
                    aValue = a.ConceptoVenta || a.Concepto || 'Venta';
                    bValue = b.ConceptoVenta || b.Concepto || 'Venta';
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [tickets, filters, sortConfig]);

    const renderSortIcon = (key: string) => {
        if (sortConfig?.key === key) {
            return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
        }
        return <div style={{ width: 14 }} />; // spacer
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
                background: 'var(--card-bg)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="text-2xl font-bold neon-text">Consultar Tickets</h1>
                        <p className="text-gray-400 text-sm">Historial de ventas y reimpresión de tickets</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Search Type Toggles */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '8px' }}>
                        <button
                            onClick={() => setSearchType('opening')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: searchType === 'opening' ? 'var(--neon-blue)' : 'transparent',
                                color: searchType === 'opening' ? '#000' : 'var(--foreground)',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Por Apertura
                        </button>
                        <button
                            onClick={() => setSearchType('date')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: searchType === 'date' ? 'var(--neon-blue)' : 'transparent',
                                color: searchType === 'date' ? '#000' : 'var(--foreground)',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Por Fecha
                        </button>
                    </div>

                    {/* Filters */}
                    {searchType === 'opening' ? (
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Seleccionar Apertura</label>
                            <select
                                className="input-field w-full"
                                value={selectedOpening}
                                onChange={(e) => setSelectedOpening(e.target.value)}
                            >
                                <option value="">Seleccione...</option>
                                {openings.map(op => (
                                    <option key={op.IdApertura} value={op.IdApertura}>
                                        #{op.IdApertura} - {new Date(op.FechaApertura).toLocaleDateString()} {new Date(op.FechaApertura).toLocaleTimeString()} - {op.UsuarioApertura} - Fondo: ${op.FondoCaja} - {op.UsuarioCorte ? `Corte: ${op.UsuarioCorte}` : 'PENDIENTE CORTE'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha Inicio</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha Fin</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                style={{
                                    background: 'var(--neon-blue)',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Search size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('IdApertura')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        # Apertura {renderSortIcon('IdApertura')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('FolioVenta')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Folio {renderSortIcon('FolioVenta')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('FechaVenta')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Fecha {renderSortIcon('FechaVenta')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)' }}>Código</th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('Socio')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Socio {renderSortIcon('Socio')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('Concepto')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Concepto {renderSortIcon('Concepto')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('FormaPago')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        F. Pago {renderSortIcon('FormaPago')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('Total')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        Total {renderSortIcon('Total')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', color: 'var(--neon-blue)', textAlign: 'center' }}>Acciones</th>
                            </tr>
                            {/* Filter Row */}
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('IdApertura', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('FolioVenta', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    {/* Date filter could be strictly a date picker, but text works for quick filter if format matches */}
                                    {/* <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('Fecha', e.target.value)} /> */}
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    {/* Code filter */}
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('Socio', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('Concepto', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('FormaPago', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}>
                                    <input placeholder="Filtro..." className="input-field" style={{ padding: '4px', fontSize: '0.8rem', width: '100%' }} onChange={(e) => handleFilterChange('Total', e.target.value)} />
                                </th>
                                <th style={{ padding: '0.5rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : filteredAndSortedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {tickets.length === 0 ? 'No se encontraron tickets' : 'No coinciden resultados'}
                                    </td>
                                </tr>
                            ) : filteredAndSortedTickets.map((ticket) => {
                                const isCancelled = ticket.Status === 2;
                                const style = isCancelled ? { color: '#ff4444', textDecoration: 'line-through' } : {};
                                const canDelete = ticket.Status === 0 && activeRegister && activeRegister.isOpen && activeRegister.details.IdApertura === ticket.IdApertura;

                                return (
                                    <tr key={ticket.IdVenta} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', ...style }}>
                                        <td style={{ padding: '0.75rem 1rem' }}>{ticket.IdApertura}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{ticket.FolioVenta}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{new Date(ticket.FechaVenta).toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{ticket.CodigoSocio || '-'}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {ticket.CodigoSocio ? <User size={14} /> : <FileText size={14} />}
                                                {/* If Socio column (name) is present, use it. If CodigoSocio is null/0, likely Public */}
                                                {/* User request: "si es publico general poner 'PUBLIC'" (or PUBLICO GENERAL usually) */}
                                                {ticket.CodigoSocio ? (ticket.Socio || 'Socio') : 'PUBLIC'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{ticket.ConceptoVenta || ticket.Concepto || 'Venta'}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{ticket.FormaPago || 'Efectivo'}</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.Total)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button
                                                title="Reimprimir Ticket"
                                                onClick={() => printTicket(ticket.IdVenta)}
                                                style={{
                                                    background: 'transparent', border: '1px solid var(--neon-blue)', color: 'var(--neon-blue)',
                                                    borderRadius: '6px', padding: '0.4rem', cursor: 'pointer'
                                                }}
                                            >
                                                <Printer size={16} />
                                            </button>

                                            {canDelete && (
                                                <button
                                                    title="Eliminar Ticket"
                                                    onClick={() => handleDelete(ticket.IdVenta)}
                                                    style={{
                                                        background: 'transparent', border: '1px solid #ff4444', color: '#ff4444',
                                                        borderRadius: '6px', padding: '0.4rem', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
