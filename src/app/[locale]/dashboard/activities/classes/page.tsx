'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
    Plus,
    Edit2,
    Trash2,
    Camera,
    Upload,
    Save,
    X,
    Image as ImageIcon,
    Dumbbell,
    User,
    Calendar,
    Power,
    PowerOff,
    Search,
    Clock
} from 'lucide-react';

export default function ClassesPage() {
    const t = useTranslations('Classes');
    const ct = useTranslations('Common');

    const [classes, setClasses] = useState<any[]>([]);
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentClass, setCurrentClass] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Schedules state
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        Dia: '1',
        HoraInicio: '',
        HoraFin: ''
    });

    // Camera state
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
        fetchInstructors();
    }, []);

    // Fetch schedules when opening a class for editing (if not an event)
    useEffect(() => {
        if (currentClass?.IdClase && !currentClass.EsEvento && modalOpen) {
            fetchSchedules(currentClass.IdClase);
        } else {
            setSchedules([]);
        }
    }, [currentClass?.IdClase, modalOpen, currentClass?.EsEvento]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/classes');
            const data = await res.json();
            setClasses(data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInstructors = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            setInstructors(data);
        } catch (err) {
            console.error('Fetch instructors error:', err);
        }
    };

    const fetchSchedules = async (classId: number) => {
        setLoadingSchedules(true);
        try {
            const res = await fetch(`/api/classes/schedule?classId=${classId}`);
            const data = await res.json();
            setSchedules(data);
        } catch (err) {
            console.error('Fetch schedules error:', err);
        } finally {
            setLoadingSchedules(false);
        }
    };

    const handleAdd = () => {
        setCurrentClass({
            Clase: '',
            EsEvento: false,
            FechaEvento: '',
            HoraInicio: '',
            HoraFin: '',
            IdUsuarioInstructor: '',
            ArchivoImagen: ''
        });
        setSchedules([]);
        setModalOpen(true);
    };

    const handleEdit = (cls: any) => {
        setCurrentClass({
            ...cls,
            EsEvento: !!cls.EsEvento,
            FechaEvento: cls.FechaEvento ? cls.FechaEvento.split('T')[0] : '',
            HoraInicio: cls.HoraInicio || '',
            HoraFin: cls.HoraFin || '',
            ArchivoImagen: cls.ArchivoImagen || ''
        });
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await fetch(`/api/classes?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setClasses(classes.filter(c => c.IdClase !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleStatus = async (cls: any) => {
        const newStatus = cls.Status === 1 ? 0 : 1;
        const confirmMsg = newStatus === 1 ? t('disableConfirm') : t('enableConfirm');
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/classes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdClase: cls.IdClase, Status: newStatus })
            });
            if (res.ok) {
                setClasses(classes.map(c => c.IdClase === cls.IdClase ? { ...c, Status: newStatus } : c));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = currentClass.IdClase ? 'PUT' : 'POST';
            const res = await fetch('/api/classes', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentClass)
            });
            const data = await res.json();

            if (res.ok) {
                // If it was a new class, update the currentClass ID so we can add schedules immediately if user stays? 
                // Currently modal closes on save, but for schedules we usually add class first then schedules.
                // If ID didn't exist, we can't save schedules yet.
                // Ideally, schedules are saved immediately but need IdClase.
                // Assuming "Save" is for the main class info. 
                // Schedules are better managed if the class exists.

                setModalOpen(false);
                fetchData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddSchedule = async () => {
        if (!currentClass.IdClase) {
            // Need to save class first? Or prompt user.
            alert('Please save the class first before adding schedules.');
            return;
        }
        if (!newSchedule.HoraInicio || !newSchedule.HoraFin) return;

        try {
            const res = await fetch('/api/classes/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdClase: currentClass.IdClase,
                    ...newSchedule
                })
            });
            if (res.ok) {
                fetchSchedules(currentClass.IdClase);
                setNewSchedule({ ...newSchedule, HoraInicio: '', HoraFin: '' });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteSchedule = async (id: number) => {
        try {
            const res = await fetch(`/api/classes/schedule?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSchedules(currentClass.IdClase);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Camera Logic
    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error(err);
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
            setCurrentClass({ ...currentClass, ArchivoImagen: dataUrl });
            stopCamera();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setCurrentClass({ ...currentClass, ArchivoImagen: dataUrl });
            };
            reader.readAsDataURL(file);
        }
    };

    const filteredClasses = classes.filter(cls =>
        cls.Clase.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.Instructor && cls.Instructor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Dumbbell size={32} />
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
                    placeholder="Search classes..."
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
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colClass')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colInstructor')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colIsEvent')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colEventDate')}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colStatus')}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClasses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noData') || 'No classes found'}</td>
                                </tr>
                            ) : (
                                filteredClasses.map(cls => (
                                    <tr key={cls.IdClase} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', opacity: 0.7 }}>{cls.IdClase}</td>
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
                                                    {cls.ArchivoImagen ? (
                                                        <img src={cls.ArchivoImagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Dumbbell size={16} opacity={0.5} />
                                                    )}
                                                </div>
                                                <span style={{ fontWeight: '600' }}>{cls.Clase}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{cls.Instructor || '-'}</td>
                                        <td style={{ padding: '1rem' }}>{cls.EsEvento ? ct('yes') : ct('no')}</td>
                                        <td style={{ padding: '1rem' }}>{cls.EsEvento && cls.FechaEvento ? new Date(cls.FechaEvento).toLocaleDateString() : '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: cls.Status === 0 ? 'rgba(0, 255, 127, 0.1)' : 'rgba(255, 68, 68, 0.1)',
                                                color: cls.Status === 0 ? 'rgb(0, 255, 127)' : 'rgb(255, 68, 68)'
                                            }}>
                                                {cls.Status === 0 ? t('active') : t('disabled')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(cls)} className="btn-icon" title={t('edit')}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(cls)}
                                                    className="btn-icon"
                                                    style={{ color: cls.Status === 0 ? '#ffcc00' : '#00fa9a' }}
                                                    title={cls.Status === 0 ? t('disable') : t('enable')}
                                                >
                                                    {cls.Status === 0 ? <PowerOff size={16} /> : <Power size={16} />}
                                                </button>
                                                <button onClick={() => handleDelete(cls.IdClase)} className="btn-icon" style={{ color: '#ff4444' }} title={ct('delete')}>
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
                            {currentClass.IdClase ? t('edit') : t('new')}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
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
                                                {currentClass.ArchivoImagen ? (
                                                    <img src={currentClass.ArchivoImagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                                        <ImageIcon size={48} style={{ marginBottom: '0.5rem' }} />
                                                        <div style={{ fontSize: '0.8rem' }}>{t('labelPhoto')}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!showCamera && (
                                            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                                <button type="button" onClick={startCamera} className="btn-icon" title="Camera">
                                                    <Camera size={18} />
                                                </button>
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-icon" title="Upload">
                                                    <Upload size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                                </div>

                                {/* Right Side: Fields */}
                                <div style={{ flex: '2', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <label className="label-text">{t('labelClass')}</label>
                                        <input
                                            className="input-field"
                                            style={{ width: '100%' }}
                                            value={currentClass.Clase}
                                            onChange={e => setCurrentClass({ ...currentClass, Clase: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="label-text">{t('labelInstructor')}</label>
                                        <select
                                            className="input-field"
                                            style={{ width: '100%' }}
                                            value={currentClass.IdUsuarioInstructor}
                                            onChange={e => setCurrentClass({ ...currentClass, IdUsuarioInstructor: e.target.value })}
                                        >
                                            <option value="">{ct('selectOption')}</option>
                                            {instructors.map(inst => (
                                                <option key={inst.IdUsuario} value={inst.IdUsuario}>{inst.Usuario}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <input
                                            type="checkbox"
                                            id="isEvent"
                                            checked={currentClass.EsEvento}
                                            onChange={e => setCurrentClass({ ...currentClass, EsEvento: e.target.checked })}
                                            style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--neon-blue)' }}
                                        />
                                        <label htmlFor="isEvent" style={{ cursor: 'pointer', userSelect: 'none' }}>{t('labelIsEvent')}</label>
                                    </div>

                                    {currentClass.EsEvento && (
                                        <>
                                            <div>
                                                <label className="label-text">{t('labelEventDate')}</label>
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    style={{ width: '100%' }}
                                                    value={currentClass.FechaEvento}
                                                    onChange={e => setCurrentClass({ ...currentClass, FechaEvento: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('startTime')}</label>
                                                    <input
                                                        type="time"
                                                        className="input-field"
                                                        style={{ width: '100%' }}
                                                        value={currentClass.HoraInicio}
                                                        onChange={e => setCurrentClass({ ...currentClass, HoraInicio: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label className="label-text">{t('endTime')}</label>
                                                    <input
                                                        type="time"
                                                        className="input-field"
                                                        style={{ width: '100%' }}
                                                        value={currentClass.HoraFin}
                                                        onChange={e => setCurrentClass({ ...currentClass, HoraFin: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Schedule Section - Only if NOT an event and is existing class (has ID) */}
                            {!currentClass.EsEvento && currentClass.IdClase && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                                    <h3 className="neon-text" style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Clock size={20} />
                                        {t('schedule')}
                                    </h3>

                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '150px' }}>
                                            <label className="label-text">{t('day')}</label>
                                            <select
                                                className="input-field"
                                                style={{ width: '100%' }}
                                                value={newSchedule.Dia}
                                                onChange={e => setNewSchedule({ ...newSchedule, Dia: e.target.value })}
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                                                    <option key={d} value={d}>{t(`days.${d}`)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px' }}>
                                            <label className="label-text">{t('startTime')}</label>
                                            <input
                                                type="time"
                                                className="input-field"
                                                style={{ width: '100%' }}
                                                value={newSchedule.HoraInicio}
                                                onChange={e => setNewSchedule({ ...newSchedule, HoraInicio: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px' }}>
                                            <label className="label-text">{t('endTime')}</label>
                                            <input
                                                type="time"
                                                className="input-field"
                                                style={{ width: '100%' }}
                                                value={newSchedule.HoraFin}
                                                onChange={e => setNewSchedule({ ...newSchedule, HoraFin: e.target.value })}
                                            />
                                        </div>
                                        <button type="button" onClick={handleAddSchedule} className="btn-primary" style={{ height: '42px' }}>
                                            <Plus size={18} />
                                            {t('addSchedule')}
                                        </button>
                                    </div>

                                    <div style={{ borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <tr>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem', color: 'var(--neon-blue)' }}>{t('day')}</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem', color: 'var(--neon-blue)' }}>{t('startTime')}</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem', color: 'var(--neon-blue)' }}>{t('endTime')}</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--neon-blue)' }}>{ct('actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {schedules.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>{t('noSchedules')}</td>
                                                    </tr>
                                                ) : (
                                                    schedules.map(sch => (
                                                        <tr key={sch.IdClaseDia} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{t(`days.${sch.Dia}`)}</td>
                                                            <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{sch.HoraInicio}</td>
                                                            <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{sch.HoraFin}</td>
                                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                                <button type="button" onClick={() => handleDeleteSchedule(sch.IdClaseDia)} className="btn-icon" style={{ color: '#ff4444', padding: '0.3rem' }}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div style={{ width: '100%', marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
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
                                    {ct('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Save size={18} />
                                    {saving ? ct('saving') : ct('save')}
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
