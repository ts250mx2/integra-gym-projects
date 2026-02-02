'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, Trash2, X, Building2 } from 'lucide-react';
import AddressCapture from '@/components/AddressCapture';

interface Branch {
    IdSucursal: number;
    Clave: string;
    Sucursal: string;
    Pais: string;
    Estado: string;
    Localidad: string;
    CodigoPostal: string;
    Direccion1: string;
    Direccion2: string;
    Telefono: string;
    CorreoElectronico: string;
}

export default function BranchesPage() {
    const tCommon = useTranslations('Common');
    const t = useTranslations('Branches');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBranch, setCurrentBranch] = useState<Partial<Branch> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const res = await fetch('/api/branches');
            const data = await res.json();
            if (!data.error) setBranches(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (branch: Branch | null = null) => {
        setCurrentBranch(branch || {
            Clave: '',
            Sucursal: '',
            Pais: 'MX',
            Estado: '',
            Localidad: '',
            CodigoPostal: '',
            Direccion1: '',
            Direccion2: '',
            Telefono: '',
            CorreoElectronico: ''
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = currentBranch?.IdSucursal ? 'PUT' : 'POST';
            const body = {
                id: currentBranch?.IdSucursal,
                clave: currentBranch?.Clave,
                name: currentBranch?.Sucursal,
                country: currentBranch?.Pais,
                state: currentBranch?.Estado,
                city: currentBranch?.Localidad,
                zipCode: currentBranch?.CodigoPostal,
                address1: currentBranch?.Direccion1,
                address2: currentBranch?.Direccion2,
                phone: currentBranch?.Telefono,
                email: currentBranch?.CorreoElectronico
            };

            const res = await fetch('/api/branches', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchBranches();
            } else {
                const data = await res.json();
                if (data.error === 'claveExists') {
                    alert(t('errorClaveExists'));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (id === 1) {
            alert(t('errorProtectId1'));
            return;
        }
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await fetch(`/api/branches?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchBranches();
            else {
                const data = await res.json();
                if (data.error === 'cannotDeleteMainBranch') alert(t('errorProtectId1'));
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="neon-text">{tCommon('loading')}</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Building2 size={32} />
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
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colClave')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colBranch')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colCity')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colState')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colPhone')}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colEmail')}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map((branch) => (
                            <tr key={branch.IdSucursal} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>{branch.IdSucursal}</td>
                                <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--neon-blue)' }}>{branch.Clave}</td>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{branch.Sucursal}</td>
                                <td style={{ padding: '1rem' }}>{branch.Localidad}</td>
                                <td style={{ padding: '1rem' }}>{branch.Estado}</td>
                                <td style={{ padding: '1rem' }}>{branch.Telefono}</td>
                                <td style={{ padding: '1rem' }}>{branch.CorreoElectronico}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleOpenModal(branch)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                            title={t('edit')}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(branch.IdSucursal)}
                                            style={{
                                                background: branch.IdSucursal === 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
                                                border: branch.IdSucursal === 1 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                                color: branch.IdSucursal === 1 ? 'rgba(255, 255, 255, 0.2)' : '#ff4444',
                                                padding: '0.5rem', borderRadius: '8px',
                                                cursor: branch.IdSucursal === 1 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center'
                                            }}
                                            disabled={branch.IdSucursal === 1}
                                            title={tCommon('delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {branches.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
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
                    <div className="glass-card" style={{ width: '100%', maxWidth: '700px', border: '1px solid rgba(0, 243, 255, 0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)', padding: '0.5rem 0', zIndex: 10 }}>
                            <h2 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Building2 size={24} />
                                {currentBranch?.IdSucursal ? t('edit') : t('new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label-text" style={{ color: 'white', opacity: 0.8, fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>{t('colClave')}</label>
                                    <input
                                        className="input-field"
                                        value={currentBranch?.Clave || ''}
                                        onChange={(e) => setCurrentBranch({ ...currentBranch, Clave: e.target.value.toUpperCase() })}
                                        required
                                        placeholder="Ej: SUC01"
                                        style={{ marginTop: 0 }}
                                    />
                                </div>
                                <div style={{ flex: 3 }}>
                                    <label className="label-text" style={{ color: 'white', opacity: 0.8, fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>{t('nameLabel')}</label>
                                    <input
                                        className="input-field"
                                        value={currentBranch?.Sucursal || ''}
                                        onChange={(e) => setCurrentBranch({ ...currentBranch, Sucursal: e.target.value })}
                                        required
                                        placeholder="Ej: Sucursal Centro"
                                        style={{ marginTop: 0 }}
                                    />
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--neon-blue)' }}>{t('locationContact')}</h3>
                                <AddressCapture
                                    initialData={{
                                        address1: currentBranch?.Direccion1 || '',
                                        address2: currentBranch?.Direccion2 || '',
                                        country: currentBranch?.Pais || 'MX',
                                        state: currentBranch?.Estado || '',
                                        city: currentBranch?.Localidad || '',
                                        zipCode: currentBranch?.CodigoPostal || '',
                                        phone: currentBranch?.Telefono || '',
                                        email: currentBranch?.CorreoElectronico || ''
                                    }}
                                    onChange={(data) => setCurrentBranch({
                                        ...currentBranch,
                                        Direccion1: data.address1,
                                        Direccion2: data.address2,
                                        Pais: data.country,
                                        Estado: data.state,
                                        Localidad: data.city,
                                        CodigoPostal: data.zipCode,
                                        Telefono: data.phone,
                                        CorreoElectronico: data.email
                                    })}
                                />
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ minWidth: '200px' }} disabled={isSaving}>
                                    {isSaving ? tCommon('saving') : tCommon('saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                table tr:hover { background: rgba(255,255,255,0.02); }
            `}</style>
        </div>
    );
}
