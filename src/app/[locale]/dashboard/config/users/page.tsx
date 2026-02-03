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
    Search
} from 'lucide-react';
import AddressCapture from '@/components/AddressCapture';
import LoginCapture from '@/components/LoginCapture';

type TabType = 'general' | 'contact';

export default function UsersPage() {
    const t = useTranslations('Users');
    const ct = useTranslations('Common');

    const [users, setUsers] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [projectInfo, setProjectInfo] = useState<any>(null);
    const [projectDomain, setProjectDomain] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [currentUser, setCurrentUser] = useState<any>(null);
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
            const [uRes, pRes, bRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/positions'),
                fetch('/api/branches')
            ]);

            const [uData, pData, bData] = await Promise.all([
                uRes.json(),
                pRes.json(),
                bRes.json()
            ]);

            setUsers(uData);
            setPositions(pData);
            setBranches(bData);
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
                setProjectDomain(data.domain || '');
            }
        } catch (err) {
            console.error('Fetch project info error:', err);
        }
    };

    const handleAdd = () => {
        const defaultBranch = branches.length === 1 ? branches[0].IdSucursal : '';
        const branchObj = branches.length === 1 ? branches[0] : null;

        setCurrentUser({
            Usuario: '',
            IdPuesto: '',
            IdSucursal: defaultBranch,
            Login: '',
            Passwd: '',
            ConfirmPasswd: '',
            ArchivoFoto: '',
            Direccion1: '',
            Direccion2: '',
            Estado: branchObj?.Estado || '',
            Municipio: branchObj?.Localidad || '',
            Pais: branchObj?.Pais || '',
            CodigoPostal: '',
            Telefono: '',
            CorreoElectronico: '',
            TarjetaRFID: ''
        });
        setActiveTab('general');
        setModalOpen(true);
    };

    const handleEdit = (user: any) => {
        setCurrentUser({
            ...user,
            ConfirmPasswd: user.Passwd // Initially same
        });
        setActiveTab('general');
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteConfirm'))) return;

        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.IdUsuario !== id));
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (currentUser.Passwd !== currentUser.ConfirmPasswd) {
            alert(t('passwordsNoMatch'));
            return;
        }

        setSaving(true);
        try {
            const method = currentUser.IdUsuario ? 'PUT' : 'POST';
            const res = await fetch('/api/users', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentUser)
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

    const handlePhotoSave = async (userWithNewPhoto: any) => {
        if (!userWithNewPhoto.IdUsuario) return;

        try {
            await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userWithNewPhoto)
            });

            setUsers(prev => prev.map(u => u.IdUsuario === userWithNewPhoto.IdUsuario ? { ...u, ArchivoFoto: userWithNewPhoto.ArchivoFoto } : u));
        } catch (err) {
            console.error('Auto-save photo error:', err);
        }
    };

    // Camera Logic
    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
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

            const updatedUser = { ...currentUser, ArchivoFoto: dataUrl };
            setCurrentUser(updatedUser);

            if (updatedUser.IdUsuario) {
                handlePhotoSave(updatedUser);
            }

            stopCamera();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const updatedUser = { ...currentUser, ArchivoFoto: dataUrl };
                setCurrentUser(updatedUser);

                if (updatedUser.IdUsuario) {
                    handlePhotoSave(updatedUser);
                }
            };
            reader.readAsDataURL(file);
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

    const filteredUsers = users.filter(user =>
        user.Usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.Puesto && user.Puesto.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                    placeholder={t('searchPlaceholder') || "Search by user or position..."}
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
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colUser')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('positionLabel') || 'Puesto'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colLogin')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colPhone')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colEmail')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noUsers')}</td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.IdUsuario} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>{user.IdUsuario}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'rgba(0,0,0,0.3)',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {user.ArchivoFoto ? (
                                                        <img src={user.ArchivoFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <User size={16} opacity={0.5} />
                                                    )}
                                                </div>
                                                {user.Usuario}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{user.Puesto || '-'}</td>
                                        <td style={{ padding: '1rem', color: 'var(--neon-blue)', fontWeight: '600' }}>
                                            {user.displayLogin}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{user.Telefono}</td>
                                        <td style={{ padding: '1rem' }}>{user.CorreoElectronico}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(user)} className="btn-icon" title={t('edit')}>
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.IdUsuario !== 1 && (
                                                    <button onClick={() => handleDelete(user.IdUsuario)} className="btn-icon" style={{ color: '#ff4444' }} title={ct('delete')}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
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
            {
                modalOpen && (
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
                                {currentUser.IdUsuario ? t('edit') : t('new')}
                            </h2>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <TabButton id="general" label={t('tabGeneral')} icon={Settings} />
                                <TabButton id="contact" label={t('tabContact')} icon={Contact} />
                            </div>

                            <form onSubmit={handleSave}>
                                {activeTab === 'general' && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                                        {/* Left Side: Photo */}
                                        <div style={{ flex: '1', minWidth: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
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
                                                        {currentUser.ArchivoFoto ? (
                                                            <img src={currentUser.ArchivoFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                                                <ImageIcon size={48} style={{ marginBottom: '0.5rem' }} />
                                                                <div style={{ fontSize: '0.8rem' }}>{t('takePhoto')}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {currentUser.IdUsuario && !showCamera && (
                                                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                                        <button type="button" onClick={startCamera} className="btn-icon" title={t('takePhoto')}>
                                                            <Camera size={18} />
                                                        </button>
                                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-icon" title={t('uploadPhoto')}>
                                                            <Upload size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                                            <div style={{ textAlign: 'center', color: 'var(--neon-blue)', fontSize: '0.9rem', fontWeight: '600' }}>
                                                {t('photoLabel')}
                                            </div>

                                            <div style={{ width: '100%', marginTop: '1rem' }}>
                                                <label className="label-text">{t('rfidLabel')}</label>
                                                <input
                                                    className="input-field"
                                                    value={currentUser.TarjetaRFID || ''}
                                                    onChange={e => setCurrentUser({ ...currentUser, TarjetaRFID: e.target.value })}
                                                    placeholder="..."
                                                />
                                            </div>
                                        </div>

                                        {/* Right Side: Data */}
                                        <div style={{ flex: '2', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div>
                                                <label className="label-text">{t('nameLabel')}</label>
                                                <input
                                                    className="input-field"
                                                    value={currentUser.Usuario}
                                                    onChange={e => setCurrentUser({ ...currentUser, Usuario: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('positionLabel')}</label>
                                                    <select
                                                        className="input-field"
                                                        value={currentUser.IdPuesto}
                                                        onChange={e => setCurrentUser({ ...currentUser, IdPuesto: e.target.value })}
                                                        required
                                                    >
                                                        <option value="">...</option>
                                                        {positions.map(p => (
                                                            <option key={p.IdPuesto} value={p.IdPuesto}>{p.Puesto}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('branchLabel')}</label>
                                                    <select
                                                        className="input-field"
                                                        value={currentUser.IdSucursal}
                                                        onChange={e => {
                                                            const branchId = e.target.value;
                                                            const branch = branches.find(b => b.IdSucursal.toString() === branchId);
                                                            setCurrentUser({
                                                                ...currentUser,
                                                                IdSucursal: branchId,
                                                                Estado: branch?.Estado || currentUser.Estado,
                                                                Municipio: branch?.Localidad || currentUser.Municipio,
                                                                Direccion1: branch?.Direccion1 || currentUser.Direccion1,
                                                                Direccion2: branch?.Direccion2 || currentUser.Direccion2,
                                                                CodigoPostal: branch?.CodigoPostal || currentUser.CodigoPostal,
                                                                Pais: branch?.Pais || currentUser.Pais
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
                                                <LoginCapture
                                                    label={t('loginLabel')}
                                                    value={currentUser.Login}
                                                    onChange={(val) => setCurrentUser({ ...currentUser, Login: val })}
                                                    domain={projectDomain}
                                                    required
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('passwordLabel')}</label>
                                                    <input
                                                        type="password"
                                                        className="input-field"
                                                        value={currentUser.Passwd}
                                                        onChange={e => setCurrentUser({ ...currentUser, Passwd: e.target.value })}
                                                        required={!currentUser.IdUsuario}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('confirmPasswordLabel')}</label>
                                                    <input
                                                        type="password"
                                                        className="input-field"
                                                        value={currentUser.ConfirmPasswd}
                                                        onChange={e => setCurrentUser({ ...currentUser, ConfirmPasswd: e.target.value })}
                                                        required={!currentUser.IdUsuario}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'contact' && (
                                    <AddressCapture
                                        initialData={{
                                            address1: currentUser.Direccion1,
                                            address2: currentUser.Direccion2,
                                            country: currentUser.Pais || projectInfo?.country,
                                            state: currentUser.Estado,
                                            city: currentUser.Municipio,
                                            zipCode: currentUser.CodigoPostal,
                                            phone: currentUser.Telefono,
                                            email: currentUser.CorreoElectronico
                                        }}
                                        disabledFields={[]}
                                        onChange={(data) => setCurrentUser({
                                            ...currentUser,
                                            Direccion1: data.address1,
                                            Direccion2: data.address2,
                                            Pais: data.country,
                                            Estado: data.state,
                                            Municipio: data.city,
                                            CodigoPostal: data.zipCode,
                                            Telefono: data.phone,
                                            CorreoElectronico: data.email
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
                                        {ct('error') === 'Error' ? 'Cancel' : 'Cancelar'}
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}>
                                        <Save size={18} />
                                        {saving ? ct('saving') : ct('saveChanges')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

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
        </div >
    );
}
