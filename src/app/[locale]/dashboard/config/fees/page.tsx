'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, Trash2, X, Search, DollarSign, Tag } from 'lucide-react';

interface Fee {
    IdCuota: number;
    Cuota: string; // Name
    Descripcion: string;
    Precio: number;
    IVA: number;
    IdMoneda: number;
    TipoCuota: number;
    CodigoBarras?: string;
    Sesiones?: number;
    IdGrupoHorario?: number;
    GrupoHorario?: string; // For display
    Multisucursal?: number; // 0 or 1
    TipoMembresia?: number; // 0, 1, 2
    Vigencia?: number;
    TipoVigencia?: number; // 0, 1, 2, 3
}

interface ScheduleGroup {
    IdGrupoHorario: number;
    GrupoHorario: string;
    HoraInicio: string;
    HoraFin: string;
    TieneDias: number;
}

export default function FeesPage() {
    const t = useTranslations('Fees');
    const ct = useTranslations('Common');

    const pageTitle = t('title');

    // Membership Types Option Map
    const membershipTypes = [
        { value: 0, label: t('membershipTypes.0') },
        { value: 1, label: t('membershipTypes.1') },
        { value: 2, label: t('membershipTypes.2') },
    ];

    // Validity Types Option Map
    const validityTypes = [
        { value: 0, label: t('validityTypes.0') },
        { value: 1, label: t('validityTypes.1') },
        { value: 2, label: t('validityTypes.2') },
        { value: 3, label: t('validityTypes.3') },
    ];

    const [fees, setFees] = useState<Fee[]>([]);
    const [groups, setGroups] = useState<ScheduleGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentFee, setCurrentFee] = useState<Partial<Fee> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [gymCountry, setGymCountry] = useState('MX');
    const [isPriceFocused, setIsPriceFocused] = useState(false);

    useEffect(() => {
        fetchFees();
        fetchGymConfig();
        fetchGroups();
    }, []);

    const fetchGymConfig = async () => {
        try {
            const res = await fetch('/api/gym-config');
            if (res.ok) {
                const data = await res.json();
                setGymCountry(data.country || 'MX');
            }
        } catch (error) {
            console.error('Error fetching gym config:', error);
        }
    };

    const fetchFees = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/fees');
            if (res.ok) {
                const data = await res.json();
                setFees(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/schedule-groups');
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const formatCurrency = (amount: number) => {
        const locale = gymCountry === 'MX' ? 'es-MX' : 'en-US';
        const currency = gymCountry === 'MX' ? 'MXN' : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    };

    const handleOpenModal = (fee: Fee | null = null) => {
        setIsPriceFocused(false); // Reset focus state
        if (fee) {
            setCurrentFee({
                ...fee,
            });
        } else {
            setCurrentFee({
                Cuota: '',
                Descripcion: '',
                Precio: 0,
                IVA: 16,
                IdMoneda: 1,
                TipoCuota: 1,
                CodigoBarras: '',
                Sesiones: 0,
                IdGrupoHorario: 0,
                Multisucursal: 0,
                TipoMembresia: 1, // Default to Membership
                Vigencia: 1,
                TipoVigencia: 3 // Default to Months
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation Logic
        const type = currentFee?.TipoMembresia ?? 0;
        const vigencia = currentFee?.Vigencia ?? 0;
        const tipoVigencia = currentFee?.TipoVigencia ?? 0;

        if ((type === 1 || type === 2)) {
            if (vigencia <= 0 || tipoVigencia <= 0) {
                alert(t('validationError') || "Para Membresía o Locker, la vigencia y tipo de vigencia deben ser mayores a cero.");
                return;
            }
        }

        setIsSaving(true);
        try {
            const method = currentFee?.IdCuota ? 'PUT' : 'POST';

            // Map state to API body
            const body = {
                ...currentFee,
                Codigo: currentFee?.CodigoBarras, // Map interface property to API expected property
                Multisucursal: currentFee?.Multisucursal ? 1 : 0, // Ensure numeric 1/0
            };

            // Ensure numeric types
            body.Precio = Number(body.Precio);
            body.IVA = Number(body.IVA);

            const res = await fetch('/api/fees', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchFees();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await fetch(`/api/fees?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchFees();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredFees = fees.filter(f =>
        f.Cuota?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.Descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.CodigoBarras?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Tag size={32} />
                    {pageTitle}
                </h1>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {t('add')}
                </button>
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                    type="text"
                    placeholder="Buscar cuotas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '3rem', width: '100%', maxWidth: '400px' }}
                />
            </div>

            {loading ? (
                <div className="neon-text">{ct('loading')}</div>
            ) : (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colName')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('membershipTypeLabel')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('validityLabel')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('validityTypeLabel')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{ct('scheduleGroup') || 'Grupo Horario'}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('sessionsLabel')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colPrice')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colTax')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFees.map((fee) => (
                                <tr key={fee.IdCuota} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{fee.Cuota}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {membershipTypes.find(t => t.value === fee.TipoMembresia)?.label || '-'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{fee.Vigencia || '-'}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {validityTypes.find(t => t.value === fee.TipoVigencia)?.label || '-'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {fee.GrupoHorario ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                {fee.GrupoHorario}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{fee.Sesiones || '-'}</td>
                                    <td style={{ padding: '1rem' }}>{formatCurrency(fee.Precio)}</td>
                                    <td style={{ padding: '1rem' }}>{fee.IVA}%</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleOpenModal(fee)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                                }}
                                                title={t('edit')}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fee.IdCuota)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#ff4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                                }}
                                                title={ct('delete')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredFees.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                        {t('noData')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '800px', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Tag size={24} />
                                {currentFee?.IdCuota ? t('edit') : t('new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Row 1: Code, Name */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                                <div>
                                    <label className="label-text">{t('codeLabel')}</label>
                                    <input
                                        className="input-field"
                                        value={currentFee?.CodigoBarras || ''}
                                        onChange={(e) => setCurrentFee({ ...currentFee, CodigoBarras: e.target.value })}
                                        placeholder="CODE123"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{t('nameLabel')}</label>
                                    <input
                                        className="input-field"
                                        value={currentFee?.Cuota || ''}
                                        onChange={(e) => setCurrentFee({ ...currentFee, Cuota: e.target.value })}
                                        required
                                        placeholder="..."
                                    />
                                </div>
                            </div>

                            {/* Row 2: Membership Type */}
                            <div>
                                <label className="label-text">{t('membershipTypeLabel')}</label>
                                <select
                                    className="input-field"
                                    value={currentFee?.TipoMembresia ?? 1}
                                    onChange={(e) => {
                                        const newVal = parseInt(e.target.value);
                                        let newVigencia = currentFee?.Vigencia;
                                        let newTipoVigencia = currentFee?.TipoVigencia;

                                        if (newVal === 0) { // Inscripción
                                            newVigencia = 0;
                                            newTipoVigencia = 0; // None
                                        } else if (newVal === 1 || newVal === 2) { // Membresía or Locker
                                            newVigencia = 1;
                                            newTipoVigencia = 3; // Months
                                        }

                                        setCurrentFee({
                                            ...currentFee,
                                            TipoMembresia: newVal,
                                            Vigencia: newVigencia,
                                            TipoVigencia: newTipoVigencia
                                        });
                                    }}
                                >
                                    {membershipTypes.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 3: Validity, Validity Type */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label className="label-text">{t('validityLabel')}</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={currentFee?.Vigencia || 0}
                                        onChange={(e) => {
                                            const val = e.target.value.slice(0, 3); // Limit to 3 chars
                                            setCurrentFee({ ...currentFee, Vigencia: parseInt(val) || 0 })
                                        }}
                                        min="0"
                                        max="999"
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{t('validityTypeLabel')}</label>
                                    <select
                                        className="input-field"
                                        value={currentFee?.TipoVigencia ?? 3} // Default Months
                                        onChange={(e) => setCurrentFee({ ...currentFee, TipoVigencia: parseInt(e.target.value) })}
                                    >
                                        {validityTypes.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 4: Price, Tax, Sessions */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label-text">{t('priceLabel')}</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={isPriceFocused ? currentFee?.Precio : formatCurrency(currentFee?.Precio || 0)}
                                        onFocus={() => setIsPriceFocused(true)}
                                        onBlur={() => setIsPriceFocused(false)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Allow only numbers and one decimal point
                                            if (/^\d*\.?\d*$/.test(val)) {
                                                setCurrentFee({ ...currentFee, Precio: parseFloat(val) || 0 })
                                            }
                                        }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{t('taxLabel')}</label>
                                    <input
                                        type="number"
                                        step="1"
                                        className="input-field"
                                        value={currentFee?.IVA}
                                        onChange={(e) => setCurrentFee({ ...currentFee, IVA: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{t('sessionsLabel')}</label>
                                    <input
                                        type="number"
                                        step="1"
                                        className="input-field"
                                        value={currentFee?.Sesiones || 0}
                                        onChange={(e) => setCurrentFee({ ...currentFee, Sesiones: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* Row 5: Schedule Group (Drilldown) */}
                            <div>
                                <label className="label-text">{ct('scheduleGroup') || 'Grupo Horario'}</label>
                                <select
                                    className="input-field"
                                    value={currentFee?.IdGrupoHorario ?? ''}
                                    onChange={(e) => setCurrentFee({ ...currentFee, IdGrupoHorario: parseInt(e.target.value) })}
                                >
                                    <option value="0">{ct('selectOption') || 'Seleccione...'}</option>
                                    {groups.map((g) => (
                                        <option key={g.IdGrupoHorario} value={g.IdGrupoHorario}>
                                            {g.GrupoHorario} ({g.HoraInicio} - {g.HoraFin}) {g.TieneDias ? '[Días]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 6: Multisite Switch */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                                <label className="label-text" style={{ marginBottom: 0, minWidth: '100px' }}>{t('multiBranchLabel')}</label>
                                <div
                                    onClick={() => setCurrentFee({ ...currentFee, Multisucursal: currentFee?.Multisucursal === 1 ? 0 : 1 })}
                                    style={{
                                        width: '50px', height: '26px', background: currentFee?.Multisucursal === 1 ? 'var(--neon-blue)' : '#444',
                                        borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
                                    }}
                                >
                                    <div style={{
                                        width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                                        position: 'absolute', top: '3px', left: currentFee?.Multisucursal === 1 ? '27px' : '3px',
                                        transition: 'left 0.3s'
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    {currentFee?.Multisucursal === 1 ? ct('yes') || 'Sí' : ct('no') || 'No'}
                                </span>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ minWidth: '160px' }} disabled={isSaving}>
                                    {isSaving ? ct('saving') : ct('saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}

            <style jsx>{`
                table tr:hover { background: rgba(255,255,255,0.02); }
            `}</style>
        </div >
    );
}
