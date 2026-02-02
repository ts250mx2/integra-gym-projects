'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, Trash2, X, UserCheck, Shield, ShieldOff } from 'lucide-react';

interface Position {
    IdPuesto: number;
    Puesto: string;
    EsAdministrador: number;
}

export default function PositionsPage() {
    const tCommon = useTranslations('Common');
    const t = useTranslations('Positions');
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPosition, setCurrentPosition] = useState<Partial<Position> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchPositions();
    }, []);

    const fetchPositions = async () => {
        try {
            const res = await fetch('/api/positions');
            const data = await res.json();
            if (!data.error) setPositions(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (position: Position | null = null) => {
        setCurrentPosition(position || { Puesto: '', EsAdministrador: 0 });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = currentPosition?.IdPuesto ? 'PUT' : 'POST';
            const body = {
                id: currentPosition?.IdPuesto,
                name: currentPosition?.Puesto,
                isAdmin: currentPosition?.EsAdministrador === 1
            };

            const res = await fetch('/api/positions', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchPositions();
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
            const res = await fetch(`/api/positions?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchPositions();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="neon-text">{tCommon('loading')}</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <UserCheck size={32} />
                    {t('title')}
                </h1>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {t('add')}
                </button>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colId')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colName')}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colAdmin')}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos) => (
                            <tr key={pos.IdPuesto} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>{pos.IdPuesto}</td>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{pos.Puesto}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    {pos.EsAdministrador === 1 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#00ff9d' }}>
                                            <Shield size={16} />
                                            <span style={{ fontSize: '0.8rem' }}>{t('yes')}</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: 0.5 }}>
                                            <ShieldOff size={16} />
                                            <span style={{ fontSize: '0.8rem' }}>{t('no')}</span>
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleOpenModal(pos)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                            title={t('edit')}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(pos.IdPuesto)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#ff4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                            title={tCommon('delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {positions.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                    {t('noData')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={24} />
                                {currentPosition?.IdPuesto ? t('edit') : t('new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="label-text">{t('nameLabel')}</label>
                                <input
                                    className="input-field"
                                    value={currentPosition?.Puesto || ''}
                                    onChange={(e) => setCurrentPosition({ ...currentPosition, Puesto: e.target.value })}
                                    required
                                    placeholder="..."
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Shield size={20} color={currentPosition?.EsAdministrador === 1 ? 'var(--neon-blue)' : 'var(--foreground)'} />
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{t('isAdminLabel')}</div>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={currentPosition?.EsAdministrador === 1}
                                        onChange={(e) => setCurrentPosition({ ...currentPosition, EsAdministrador: e.target.checked ? 1 : 0 })}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ minWidth: '160px' }} disabled={isSaving}>
                                    {isSaving ? tCommon('saving') : tCommon('saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                table tr:hover { background: rgba(255,255,255,0.02); }
                
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 22px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(255,255,255,0.1);
                    transition: .4s;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 14px;
                    width: 14px;
                    left: 4px;
                    bottom: 3px;
                    background-color: white;
                    transition: .4s;
                }
                input:checked + .slider {
                    background-color: var(--neon-blue);
                    border-color: var(--neon-blue);
                }
                input:checked + .slider:before {
                    transform: translateX(22px);
                }
                .slider.round {
                    border-radius: 34px;
                }
                .slider.round:before {
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
}
