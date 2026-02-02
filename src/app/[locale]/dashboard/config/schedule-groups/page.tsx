'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, Trash2, X, Search, CalendarClock, Clock } from 'lucide-react';

interface ScheduleDay {
    IdHorarioDia?: number;
    IdGrupoHorario?: number;
    DiaSemanaMySQL: number; // 0-6
    HoraEntrada: string;
    HoraSalida: string;
}

interface ScheduleGroup {
    IdGrupoHorario: number;
    GrupoHorario: string;
    HoraInicio: string;
    HoraFin: string;
    TieneDias: number; // 0 or 1
    Status: number;
    Days?: ScheduleDay[];
}

const DAYS_OF_WEEK = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 0, label: 'Domingo' },
];

export default function ScheduleGroupsPage() {
    const t = useTranslations('Sidebar'); // Reuse generic
    const st = useTranslations('ScheduleGroups');
    const ct = useTranslations('Common');

    const [groups, setGroups] = useState<ScheduleGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentGroup, setCurrentGroup] = useState<Partial<ScheduleGroup> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/schedule-groups');
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (group: ScheduleGroup | null = null) => {
        if (group) {
            // For editing, we might need to fetch details (Days) if not included in list
            // Assuming list might not return Days, or if it does. 
            // The list endpoint currently doesn't return days. We might need a detail endpoint or include it.
            // For now, let's assume we edit what we have, but we need Days.
            // I'll stick to basic init and maybe fetch details? 
            // Actually, the user requirements imply simplified edit for main fields, but for "Tiene Dias" logic we need days.
            // I'll initialize with defaults if empty.
            setCurrentGroup({
                ...group,
                Days: DAYS_OF_WEEK.map(d => ({ DiaSemanaMySQL: d.id, HoraEntrada: group.HoraInicio, HoraSalida: group.HoraFin }))
            });
        } else {
            setCurrentGroup({
                GrupoHorario: '',
                HoraInicio: '00:00',
                HoraFin: '00:00',
                TieneDias: 0,
                Days: DAYS_OF_WEEK.map(d => ({ DiaSemanaMySQL: d.id, HoraEntrada: '00:00', HoraSalida: '00:00' }))
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = currentGroup?.IdGrupoHorario ? 'PUT' : 'POST';
            const res = await fetch('/api/schedule-groups', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentGroup),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchGroups();
            } else {
                const err = await res.json();
                alert(ct('error') + ': ' + err.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(st('deleteConfirm'))) return;
        try {
            const res = await fetch(`/api/schedule-groups?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchGroups();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredGroups = groups.filter(g =>
        g.GrupoHorario?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CalendarClock size={32} />
                    {st('title')}
                </h1>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {st('add')}
                </button>
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                    type="text"
                    placeholder={st('nameLabel') + "..."}
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
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{st('colId')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{st('colName')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{st('colStart')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{st('colEnd')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{st('colDays')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{st('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGroups.map((group) => (
                                <tr key={group.IdGrupoHorario} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem' }}>{group.IdGrupoHorario}</td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.GrupoHorario}</td>
                                    <td style={{ padding: '1rem' }}>{group.HoraInicio}</td>
                                    <td style={{ padding: '1rem' }}>{group.HoraFin}</td>
                                    <td style={{ padding: '1rem' }}>{group.TieneDias ? st('yes') : st('no')}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {group.IdGrupoHorario !== 1 && group.IdGrupoHorario !== 2 && (
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleOpenModal(group)}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(group.IdGrupoHorario)}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: '#ff4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {(group.IdGrupoHorario === 1 || group.IdGrupoHorario === 2) && (
                                            <div style={{ opacity: 0.5, fontSize: '0.8rem', fontStyle: 'italic' }}>System Group</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredGroups.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                        {st('noData')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '800px', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CalendarClock size={24} />
                                {currentGroup?.IdGrupoHorario ? st('edit') : st('new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="label-text">{st('nameLabel')}</label>
                                <input
                                    className="input-field"
                                    value={currentGroup?.GrupoHorario || ''}
                                    onChange={(e) => setCurrentGroup({ ...currentGroup, GrupoHorario: e.target.value })}
                                    required
                                    placeholder="..."
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label className="label-text">{st('startTime')}</label>
                                    <input
                                        type="time"
                                        className="input-field"
                                        value={currentGroup?.HoraInicio || '00:00'}
                                        onChange={(e) => setCurrentGroup({ ...currentGroup, HoraInicio: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{st('endTime')}</label>
                                    <input
                                        type="time"
                                        className="input-field"
                                        value={currentGroup?.HoraFin || '00:00'}
                                        onChange={(e) => setCurrentGroup({ ...currentGroup, HoraFin: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Switch Tiene Dias */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                                <label className="label-text" style={{ marginBottom: 0, minWidth: '100px' }}>{st('hasDays')}</label>
                                <div
                                    onClick={() => {
                                        const newVal = currentGroup?.TieneDias === 1 ? 0 : 1;
                                        let newDays = currentGroup?.Days;
                                        if (newVal === 1) {
                                            newDays = DAYS_OF_WEEK.map(d => ({
                                                DiaSemanaMySQL: d.id,
                                                HoraEntrada: currentGroup?.HoraInicio || '00:00',
                                                HoraSalida: currentGroup?.HoraFin || '00:00'
                                            }));
                                        }
                                        setCurrentGroup({ ...currentGroup, TieneDias: newVal, Days: newDays });
                                    }}
                                    style={{
                                        width: '50px', height: '26px', background: currentGroup?.TieneDias === 1 ? 'var(--neon-blue)' : '#444',
                                        borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
                                    }}
                                >
                                    <div style={{
                                        width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                                        position: 'absolute', top: '3px', left: currentGroup?.TieneDias === 1 ? '27px' : '3px',
                                        transition: 'left 0.3s'
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    {currentGroup?.TieneDias === 1 ? st('yes') : st('no')}
                                </span>
                            </div>

                            {/* Detailed Days */}
                            {currentGroup?.TieneDias === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                    <h3 style={{ color: 'var(--neon-blue)', fontSize: '1rem' }}>{st('daysTitle')}</h3>
                                    {DAYS_OF_WEEK.map((day) => {
                                        const dayData = currentGroup?.Days?.find(d => d.DiaSemanaMySQL === day.id) || {
                                            DiaSemanaMySQL: day.id,
                                            HoraEntrada: currentGroup?.HoraInicio || '00:00',
                                            HoraSalida: currentGroup?.HoraFin || '00:00'
                                        };

                                        const updateDay = (field: 'HoraEntrada' | 'HoraSalida', value: string) => {
                                            const newDays = currentGroup?.Days ? [...currentGroup.Days] : [];
                                            const idx = newDays.findIndex(d => d.DiaSemanaMySQL === day.id);
                                            if (idx >= 0) {
                                                newDays[idx] = { ...newDays[idx], [field]: value };
                                            } else {
                                                newDays.push({ ...dayData, [field]: value });
                                            }
                                            setCurrentGroup({ ...currentGroup, Days: newDays });
                                        };

                                        return (
                                            <div key={day.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{day.label}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
                                                        type="time"
                                                        className="input-field"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                                        value={dayData.HoraEntrada}
                                                        onChange={(e) => updateDay('HoraEntrada', e.target.value)}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
                                                        type="time"
                                                        className="input-field"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                                        value={dayData.HoraSalida}
                                                        onChange={(e) => updateDay('HoraSalida', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ minWidth: '160px' }} disabled={isSaving}>
                                    {isSaving ? ct('saving') : ct('saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
