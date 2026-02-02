'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Plus,
    Edit2,
    Trash2,
    Save,
    X,
    Search,
    ScanFace
} from 'lucide-react';

export default function ReadersPage() {
    const t = useTranslations('Config');
    const ct = useTranslations('Common');

    const [readers, setReaders] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentReader, setCurrentReader] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [rRes, bRes] = await Promise.all([
                    fetch('/api/readers'),
                    fetch('/api/branches')
                ]);

                if (rRes.ok) {
                    const data = await rRes.json();
                    setReaders(data);
                }
                if (bRes.ok) {
                    const bData = await bRes.json();
                    if (!bData.error) setBranches(bData);
                }
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const fetchReaders = async () => {
        // setLoading(true); // Don't block UI refresh
        try {
            const res = await fetch('/api/readers');
            if (res.ok) {
                const data = await res.json();
                setReaders(data);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        }
    };

    const handleAdd = () => {
        const defaultBranch = branches.length === 1 ? branches[0].IdSucursal : '';

        setCurrentReader({
            NumLector: '', // Will be calculated by API
            Lector: '',
            SerialNumber: '',
            IdSucursal: defaultBranch,
            FirmwareVer: '',
            Mac: '',
            Platform: '',
            DeviceName: '',
            FPAlg: '',
            FaceAlg: '',
            Manufacturer: '',
            AdminCount: 0,
            UserCount: 0,
            AttLogCount: 0,
            PwdCount: 0,
            OpLogCount: 0,
            FaceCount: 0,
            FPCount: 0,
            Modelo: ''
        });
        setModalOpen(true);
    };

    const handleEdit = (reader: any) => {
        setCurrentReader({ ...reader });
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteReaderConfirm') || 'Are you sure?')) return;

        try {
            const res = await fetch(`/api/readers?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchReaders();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = currentReader.IdLector ? 'PUT' : 'POST';
            const res = await fetch('/api/readers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentReader)
            });

            if (res.ok) {
                setModalOpen(false);
                fetchReaders();
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const filteredReaders = readers.filter(r =>
        (r.Lector && r.Lector.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.SerialNumber && r.SerialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getBranchName = (id: number) => {
        const b = branches.find(br => br.IdSucursal === id);
        return b ? b.Sucursal : '-';
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ScanFace size={32} />
                    {t('readers') || 'Lectores'}
                </h1>
                <button onClick={handleAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {t('addReader') || 'Agregar Lector'}
                </button>
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                    type="text"
                    placeholder={t('searchReaders') || "Buscar lectores..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '3rem', width: '100%', maxWidth: '400px' }}
                />
            </div>

            {loading ? (
                <div className="neon-text">{ct('loading') || 'Cargando...'}</div>
            ) : (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('numLector') || 'Num'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('lector') || 'Lector'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('serialNumber') || 'S/N'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('branchLabel') || 'Sucursal'}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('userCount') || 'Users'}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('adminCount') || 'Admins'}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReaders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noReaders') || 'No readers found'}</td>
                                </tr>
                            ) : (
                                filteredReaders.map(reader => (
                                    <tr key={reader.IdLector} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>{reader.NumLector}</td>
                                        <td style={{ padding: '1rem' }}>{reader.Lector}</td>
                                        <td style={{ padding: '1rem' }}>{reader.SerialNumber}</td>
                                        <td style={{ padding: '1rem' }}>{getBranchName(reader.IdSucursal)}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{reader.UserCount}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{reader.AdminCount}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(reader)} className="btn-icon">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(reader.IdLector)} className="btn-icon" style={{ color: '#ff4444' }}>
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
                            {currentReader.IdLector ? (t('editReader') || 'Editar Lector') : (t('addReader') || 'Agregar Lector')}
                        </h2>

                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Row 1: ID & Name */}
                            <div>
                                <label className="label-text">{t('numLector') || 'Num Lector'}</label>
                                <input className="input-field" value={currentReader.NumLector} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('lector') || 'Lector Name'}</label>
                                <input
                                    className="input-field"
                                    value={currentReader.Lector}
                                    onChange={e => setCurrentReader({ ...currentReader, Lector: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Row 2: Serial & Branch */}
                            <div>
                                <label className="label-text">{t('serialNumber') || 'Serial Number'}</label>
                                <input
                                    className="input-field"
                                    value={currentReader.SerialNumber}
                                    onChange={e => setCurrentReader({ ...currentReader, SerialNumber: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label-text">{t('branchLabel') || 'Sucursal'}</label>
                                <select
                                    className="input-field"
                                    value={currentReader.IdSucursal || ''}
                                    onChange={e => setCurrentReader({ ...currentReader, IdSucursal: Number(e.target.value) })}
                                    required
                                >
                                    <option value="">{t('selectBranch') || 'Seleccionar...'}</option>
                                    {branches.map(b => (
                                        <option key={b.IdSucursal} value={b.IdSucursal}>
                                            {b.Sucursal}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 3: Model */}
                            <div>
                                <label className="label-text">{t('modelo') || 'Modelo'}</label>
                                <input
                                    className="input-field"
                                    value={currentReader.Modelo}
                                    onChange={e => setCurrentReader({ ...currentReader, Modelo: e.target.value })}
                                />
                            </div>

                            {/* Divider for technical info */}
                            <div style={{ gridColumn: '1 / -1', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }}></div>

                            {/* Technical Read Only Fields */}
                            <div>
                                <label className="label-text">{t('firmwareVer') || 'Firmware Ver'}</label>
                                <input className="input-field" value={currentReader.FirmwareVer} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('mac') || 'Mac Address'}</label>
                                <input className="input-field" value={currentReader.Mac} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('platform') || 'Platform'}</label>
                                <input className="input-field" value={currentReader.Platform} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('deviceName') || 'Device Name'}</label>
                                <input className="input-field" value={currentReader.DeviceName} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('fpAlg') || 'FP Alg'}</label>
                                <input className="input-field" value={currentReader.FPAlg} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('faceAlg') || 'Face Alg'}</label>
                                <input className="input-field" value={currentReader.FaceAlg} disabled />
                            </div>
                            <div>
                                <label className="label-text">{t('manufacturer') || 'Manufacturer'}</label>
                                <input className="input-field" value={currentReader.Manufacturer} disabled />
                            </div>

                            {/* Counters (Read Only) */}
                            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('adminCount') || 'Admins'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.AdminCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('userCount') || 'Users'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.UserCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('attLogCount') || 'AttLogs'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.AttLogCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('pwdCount') || 'Pwds'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.PwdCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('opLogCount') || 'OpLogs'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.OpLogCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('faceCount') || 'Faces'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.FaceCount}</div></div>
                                <div><label className="label-text" style={{ fontSize: '0.8rem' }}>{t('fpCount') || 'FPs'}</label><div style={{ fontWeight: 'bold' }}>{currentReader.FPCount}</div></div>
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="btn-primary"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >
                                    {ct('cancel') || 'Cancel'}
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    <Save size={18} style={{ marginRight: '0.5rem' }} />
                                    {saving ? (ct('saving') || 'Saving...') : (ct('save') || 'Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
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
