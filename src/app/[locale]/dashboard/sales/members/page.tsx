'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
    Users as UsersIcon,
    Plus,
    Edit2,
    Trash2,
    Camera,
    Upload,
    Save,
    X,
    User,
    Settings,
    Contact,
    Building2,
    Briefcase,
    Mail,
    Phone,
    Image as ImageIcon,
    Search,
    CreditCard,
    Calendar,
    Hash
} from 'lucide-react';
import AddressCapture from '@/components/AddressCapture';

export default function MembersPage() {
    const t = useTranslations('Members');
    const ct = useTranslations('Common');

    const [members, setMembers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [projectInfo, setProjectInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentMember, setCurrentMember] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Camera state
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
        fetchProjectInfo();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [mRes, bRes] = await Promise.all([
                fetch('/api/members'),
                fetch('/api/branches')
            ]);

            const [mData, bData] = await Promise.all([
                mRes.json(),
                bRes.json()
            ]);

            if (Array.isArray(mData)) {
                setMembers(mData);
            } else {
                console.error('Members API returned non-array:', mData);
                setMembers([]);
            }

            if (Array.isArray(bData)) {
                setBranches(bData);
            } else {
                setBranches([]);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

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

    const handleAdd = () => {
        const defaultBranch = branches.length === 1 ? branches[0].IdSucursal : '';
        const branchObj = branches.length === 1 ? branches[0] : null;

        setCurrentMember({
            Socio: '',
            IdSucursal: defaultBranch,
            ArchivoFoto: '',
            Direccion1: '',
            Direccion2: '',
            Estado: branchObj?.Estado || '',
            Localidad: branchObj?.Localidad || '',
            Pais: branchObj?.Pais || '',
            CodigoPostal: '',
            Telefono: '',
            CorreoElectronico: '',
            TarjetaRFID: '',
            Genero: 0, // Default ...
            ContactoEmergencia: '',
            FechaVencimiento: '' // Typically read-only or empty for new
        });
        setModalOpen(true);
    };

    const handleEdit = (member: any) => {
        setCurrentMember({ ...member });
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteConfirm'))) return;

        try {
            const res = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMembers(members.filter(m => m.IdSocio !== id));
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = currentMember.IdSocio ? 'PUT' : 'POST';
            const res = await fetch('/api/members', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentMember)
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

    const handlePhotoSave = async (memberWithNewPhoto: any) => {
        if (!memberWithNewPhoto.IdSocio) return;
        try {
            await fetch('/api/members', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberWithNewPhoto)
            });
            setMembers(prev => prev.map(m => m.IdSocio === memberWithNewPhoto.IdSocio ? { ...m, ArchivoFoto: memberWithNewPhoto.ArchivoFoto } : m));
        } catch (err) {
            console.error('Auto-save photo error:', err);
        }
    };

    // Camera Logic (Same as Users)
    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error('Camera error:', err);
            setShowCamera(false);
            fileInputRef.current?.click();
        }
    };

    const stopCamera = () => {
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setShowCamera(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');

            const updated = { ...currentMember, ArchivoFoto: dataUrl };
            setCurrentMember(updated);

            if (updated.IdSocio) handlePhotoSave(updated);
            stopCamera();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const updated = { ...currentMember, ArchivoFoto: dataUrl };
                setCurrentMember(updated);
                if (updated.IdSocio) handlePhotoSave(updated);
            };
            reader.readAsDataURL(file);
        }
    };

    const filteredMembers = members.filter(m =>
        m.Socio.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getBranchClave = (id: number) => {
        const b = branches.find(br => br.IdSucursal === id);
        return b ? b.Clave : '';
    };

    const getBranchName = (id: number) => {
        const b = branches.find(br => br.IdSucursal === id);
        return b ? b.Sucursal : '-';
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <UsersIcon size={32} />
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
                    placeholder={t('searchPlaceholder') || "Search..."}
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
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colCode')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colName')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colBranch')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colExpiration')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colPhone')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colEmail')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noData')}</td>
                                </tr>
                            ) : (
                                filteredMembers.map(member => (
                                    <tr key={member.IdSocio} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>{getBranchClave(member.IdSucursal)}{member.IdSocio}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {member.ArchivoFoto ? (
                                                        <img src={member.ArchivoFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <User size={16} opacity={0.5} />
                                                    )}
                                                </div>
                                                {member.Socio}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{getBranchName(member.IdSucursal)}</td>
                                        <td style={{ padding: '1rem' }}>{member.FechaVencimiento ? new Date(member.FechaVencimiento).toLocaleDateString() : '-'}</td>
                                        <td style={{ padding: '1rem' }}>{member.Telefono || '-'}</td>
                                        <td style={{ padding: '1rem' }}>{member.CorreoElectronico || '-'}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(member)} className="btn-icon" title={t('edit')}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(member.IdSocio)} className="btn-icon" style={{ color: '#ff4444' }} title={ct('error')}>
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
                        width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
                        padding: '2rem', position: 'relative'
                    }}>
                        <button onClick={() => setModalOpen(false)} style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem',
                            background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5
                        }}>
                            <X size={24} />
                        </button>

                        <h2 className="neon-text" style={{ marginBottom: '1.5rem' }}>
                            {currentMember.IdSocio ? t('edit') : t('new')}
                        </h2>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                                {/* Left Side: Photo */}
                                <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ position: 'relative', width: '220px', height: '220px' }}>
                                        {showCamera ? (
                                            <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', background: 'black', position: 'relative' }}>
                                                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button type="button" onClick={takePhoto} style={{
                                                    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                                                    background: 'var(--neon-blue)', border: 'none', borderRadius: '50%', padding: '10px', color: 'black',
                                                    cursor: 'pointer', boxShadow: '0 0 15px var(--neon-blue)'
                                                }}>
                                                    <Camera size={24} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{
                                                width: '100%', height: '100%', borderRadius: '12px', background: 'rgba(0,0,0,0.3)',
                                                border: '2px dashed rgba(0, 243, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden', cursor: 'pointer'
                                            }} onClick={startCamera}>
                                                {currentMember.ArchivoFoto ? (
                                                    <img src={currentMember.ArchivoFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                                        <ImageIcon size={48} style={{ marginBottom: '0.5rem' }} />
                                                        <div style={{ fontSize: '0.8rem' }}>{t('add')}<br />Foto</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {currentMember.IdSocio && !showCamera && (
                                            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                                <button type="button" onClick={startCamera} className="btn-icon">
                                                    <Camera size={18} />
                                                </button>
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-icon">
                                                    <Upload size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />

                                    <div style={{ width: '100%', marginTop: '1rem' }}>
                                        <label className="label-text">RFID</label>
                                        <input
                                            className="input-field"
                                            value={currentMember.TarjetaRFID || ''}
                                            onChange={e => setCurrentMember({ ...currentMember, TarjetaRFID: e.target.value })}
                                            placeholder="..."
                                        />
                                    </div>
                                    <div style={{ width: '100%', marginTop: '1rem' }}>
                                        <label className="label-text">{t('expirationDateLabel')}</label>
                                        <div className="input-field" style={{ opacity: 0.6, background: 'rgba(255,255,255,0.05)' }}>
                                            {currentMember.FechaVencimiento ? new Date(currentMember.FechaVencimiento).toLocaleDateString() : '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Data */}
                                <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('memberCodeLabel')}</label>
                                            <div className="input-field" style={{ opacity: 0.6, background: 'rgba(255,255,255,0.05)' }}>
                                                {getBranchClave(Number(currentMember.IdSucursal))}{currentMember.IdSocio || '...'}
                                            </div>
                                        </div>
                                        <div style={{ flex: 2 }}>
                                            <label className="label-text">{t('nameLabel')}</label>
                                            <input
                                                className="input-field"
                                                value={currentMember.Socio}
                                                onChange={e => setCurrentMember({ ...currentMember, Socio: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="label-text">{t('genderLabel')}</label>
                                            <select
                                                className="input-field"
                                                value={currentMember.Genero}
                                                onChange={e => setCurrentMember({ ...currentMember, Genero: Number(e.target.value) })}
                                            >
                                                <option value={0}>...</option>
                                                <option value={1}>{t('male')}</option>
                                                <option value={2}>{t('female')}</option>
                                            </select>
                                        </div>
                                        <div style={{ flex: 2 }}>
                                            <label className="label-text">{t('colBranch')}</label>
                                            <select
                                                className="input-field"
                                                value={currentMember.IdSucursal}
                                                onChange={e => {
                                                    const branchId = e.target.value;
                                                    const branch = branches.find(b => b.IdSucursal.toString() === branchId);
                                                    setCurrentMember({
                                                        ...currentMember,
                                                        IdSucursal: branchId,
                                                        Estado: branch?.Estado || currentMember.Estado,
                                                        Localidad: branch?.Localidad || currentMember.Localidad,
                                                        Direccion1: branch?.Direccion1 || currentMember.Direccion1,
                                                        Direccion2: branch?.Direccion2 || currentMember.Direccion2,
                                                        CodigoPostal: branch?.CodigoPostal || currentMember.CodigoPostal,
                                                        Pais: branch?.Pais || currentMember.Pais
                                                    });
                                                }}
                                                required
                                            >
                                                <option value="">...</option>
                                                {branches.map(b => (
                                                    <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label-text">{t('emergencyContactLabel')}</label>
                                        <input
                                            className="input-field"
                                            value={currentMember.ContactoEmergencia || ''}
                                            onChange={e => setCurrentMember({ ...currentMember, ContactoEmergencia: e.target.value })}
                                            placeholder="..."
                                        />
                                    </div>

                                    <AddressCapture
                                        initialData={{
                                            address1: currentMember.Direccion1,
                                            address2: currentMember.Direccion2,
                                            country: projectInfo?.country || currentMember.Pais,
                                            state: currentMember.Estado,
                                            city: currentMember.Localidad,
                                            zipCode: currentMember.CodigoPostal,
                                            phone: currentMember.Telefono,
                                            email: currentMember.CorreoElectronico
                                        }}
                                        disabledFields={['country']}
                                        onChange={(data) => setCurrentMember({
                                            ...currentMember,
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
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-primary" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {ct('cancel')}
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={18} />
                                    {saving ? ct('saving') : ct('saveChanges')}
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
