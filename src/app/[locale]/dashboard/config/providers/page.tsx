'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Briefcase, // Using Briefcase as icon for Providers
    Plus,
    Edit2,
    Trash2,
    Save,
    X,
    Settings,
    Contact,
    Search,
    Truck // Alternative icon for Providers
} from 'lucide-react';
import AddressCapture from '@/components/AddressCapture';

type TabType = 'general' | 'contact';

export default function ProvidersPage() {
    const t = useTranslations('Providers');
    const ct = useTranslations('Common');

    const [providers, setProviders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [currentProvider, setCurrentProvider] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [projectInfo, setProjectInfo] = useState<any>(null);

    useEffect(() => {
        fetchData();
        fetchProjectInfo();
    }, []);

    const fetchProjectInfo = async () => {
        try {
            const res = await fetch('/api/gym-config');
            const data = await res.json();
            if (!data.error) {
                setProjectInfo(data);
            }
        } catch (err) {
            console.error('Fetch project info error:', err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/providers');
            const data = await res.json();
            if (Array.isArray(data)) {
                setProviders(data);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setCurrentProvider({
            Proveedor: '',
            RFC: '',
            Contacto: '',
            Direccion1: '',
            Direccion2: '',
            Pais: projectInfo?.country || '',
            Estado: '',
            Localidad: '',
            CodigoPostal: '',
            Telefono: '',
            CorreoElectronico: ''
        });
        setActiveTab('general');
        setModalOpen(true);
    };

    const handleEdit = (provider: any) => {
        setCurrentProvider({ ...provider });
        setActiveTab('general');
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteConfirm'))) return;

        try {
            const res = await fetch(`/api/providers?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProviders(providers.filter(p => p.IdProveedor !== id));
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = currentProvider.IdProveedor ? 'PUT' : 'POST';
            const res = await fetch('/api/providers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentProvider)
            });

            if (res.ok) {
                setModalOpen(false);
                fetchData();
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }: { id: TabType, label: string, icon: any }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === id ? 'var(--neon-blue)' : 'var(--foreground)',
                opacity: activeTab === id ? 1 : 0.6,
                borderBottom: `2px solid ${activeTab === id ? 'var(--neon-blue)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontWeight: activeTab === id ? '600' : '400'
            }}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    const filteredProviders = providers.filter(p =>
        p.Proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.RFC && p.RFC.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.Contacto && p.Contacto.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Truck size={32} />
                    {t('title')}
                </h1>
                <button onClick={handleAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {t('add')}
                </button>
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
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
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colId')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colProvider')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colRFC')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colContact')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colPhone')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colEmail')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProviders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noProviders')}</td>
                                </tr>
                            ) : (
                                filteredProviders.map(provider => (
                                    <tr key={provider.IdProveedor} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>{provider.IdProveedor}</td>
                                        <td style={{ padding: '1rem', fontWeight: '600' }}>{provider.Proveedor}</td>
                                        <td style={{ padding: '1rem' }}>{provider.RFC || '-'}</td>
                                        <td style={{ padding: '1rem' }}>{provider.Contacto || '-'}</td>
                                        <td style={{ padding: '1rem' }}>{provider.Telefono || '-'}</td>
                                        <td style={{ padding: '1rem' }}>{provider.CorreoElectronico || '-'}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(provider)} className="btn-icon" title={t('edit')}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(provider.IdProveedor)} className="btn-icon" style={{ color: '#ff4444' }} title={ct('delete')}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-card" style={{
                        width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
                        padding: '2rem', position: 'relative'
                    }}>
                        <button onClick={() => setModalOpen(false)} style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem',
                            background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5
                        }}>
                            <X size={24} />
                        </button>

                        <h2 className="neon-text" style={{ marginBottom: '1.5rem' }}>
                            {currentProvider.IdProveedor ? t('edit') : t('new')}
                        </h2>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <TabButton id="general" label={t('tabGeneral')} icon={Settings} />
                            <TabButton id="contact" label={t('tabAddress')} icon={Contact} />
                        </div>

                        <form onSubmit={handleSave}>
                            {activeTab === 'general' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <label className="label-text">{t('labelProvider')}</label>
                                        <input
                                            className="input-field"
                                            value={currentProvider.Proveedor}
                                            onChange={e => setCurrentProvider({ ...currentProvider, Proveedor: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('labelRFC')}</label>
                                            <input
                                                className="input-field"
                                                value={currentProvider.RFC}
                                                onChange={e => setCurrentProvider({ ...currentProvider, RFC: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('labelContact')}</label>
                                            <input
                                                className="input-field"
                                                value={currentProvider.Contacto}
                                                onChange={e => setCurrentProvider({ ...currentProvider, Contacto: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('labelPhone')}</label>
                                            <input
                                                className="input-field"
                                                value={currentProvider.Telefono}
                                                onChange={e => setCurrentProvider({ ...currentProvider, Telefono: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('labelEmail')}</label>
                                            <input
                                                className="input-field"
                                                value={currentProvider.CorreoElectronico}
                                                onChange={e => setCurrentProvider({ ...currentProvider, CorreoElectronico: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'contact' && (
                                <AddressCapture
                                    initialData={{
                                        address1: currentProvider.Direccion1,
                                        address2: currentProvider.Direccion2,
                                        country: currentProvider.Pais,
                                        state: currentProvider.Estado,
                                        city: currentProvider.Localidad,
                                        zipCode: currentProvider.CodigoPostal,
                                        phone: currentProvider.Telefono,
                                        email: currentProvider.CorreoElectronico
                                    }}
                                    disabledFields={['phone', 'email']} // Already handled in general tab or allow override? 
                                    // Actually AddressCapture handles phone/email too, which duplicates General tab fields. 
                                    // I'll allow syncing or just let AddressCapture handle address part mainly.
                                    // Logic: sync updates back to currentProvider
                                    onChange={(data) => setCurrentProvider({
                                        ...currentProvider,
                                        Direccion1: data.address1,
                                        Direccion2: data.address2,
                                        Pais: data.country,
                                        Estado: data.state,
                                        Localidad: data.city,
                                        CodigoPostal: data.zipCode,
                                        // Optional: if user edits phone in address tab, update it too
                                        Telefono: data.phone || currentProvider.Telefono,
                                        CorreoElectronico: data.email || currentProvider.CorreoElectronico
                                    })}
                                />
                            )}

                            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="btn-primary"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}
                                >
                                    {ct('cancel') || 'Cancelar'}
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}>
                                    <Save size={18} />
                                    {saving ? ct('saving') : ct('saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .tab-btn:hover { color: white !important; background: rgba(255, 255, 255, 0.03); }
                .btn-icon { 
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: white; padding: 0.5rem; borderRadius: 8px; cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center;
                }
                .btn-icon:hover { background: rgba(0, 243, 255, 0.1); border-color: var(--neon-blue); color: var(--neon-blue); }
                .modal-overlay { z-index: 1000; }
                table tr:hover { background: rgba(255,255,255,0.02); }
            `}</style>
        </div>
    );
}
