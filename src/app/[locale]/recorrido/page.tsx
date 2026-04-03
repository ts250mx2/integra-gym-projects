'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
    User, 
    Mail, 
    Phone, 
    MapPin, 
    Calendar, 
    Camera, 
    ChevronRight, 
    CheckCircle, 
    AlertCircle, 
    Loader2, 
    ArrowLeft,
    Heart
} from 'lucide-react';

export default function RecorridoPage() {
    const searchParams = useSearchParams();
    const uuidProject = searchParams.get('UUIDProject');
    const idSucursal = searchParams.get('IdSucursal');

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        socio: '',
        correoElectronico: '',
        telefono: '',
        sexo: '',
        calleNumero: '',
        colonia: '',
        cp: '',
        estado: '',
        municipio: '',
        fechaNacimiento: '',
        contacto: '',
        fuente: '',
        foto: '' // Base64
    });

    // Locations State
    const [states, setStates] = useState<any[]>([]);
    const [municipalities, setMunicipalities] = useState<string[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Referral Sources
    const REFERRAL_SOURCES = [
        'Redes Sociales (Facebook, Instagram, TikTok)',
        'Google / Buscador',
        'Recomendación de un amigo',
        'Vi el gimnasio al pasar',
        'Publicidad impresa (Volantes, Lonas)',
        'Convenio empresarial',
        'Eventos / Promociones',
        'Otro'
    ];

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!uuidProject) {
            setError('Falta el parámetro UUIDProject');
            setLoading(false);
            return;
        }

        async function init() {
            try {
                // Fetch Project Details
                const projectRes = await fetch(`/api/recorrido/details?UUIDProject=${uuidProject}`);
                if (!projectRes.ok) throw new Error('No se pudo encontrar el proyecto');
                const projectData = await projectRes.json();
                setProject(projectData);

                // Fetch States
                const statesRes = await fetch('/api/locations');
                if (statesRes.ok) {
                    const statesData = await statesRes.json();
                    setStates(statesData);
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [uuidProject]);

    useEffect(() => {
        if (!formData.estado) {
            setMunicipalities([]);
            return;
        }

        async function fetchMunicipalities() {
            setLoadingLocations(true);
            try {
                const res = await fetch(`/api/locations?stateId=${formData.estado}`);
                if (res.ok) {
                    const data = await res.json();
                    setMunicipalities(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingLocations(false);
            }
        }

        fetchMunicipalities();
    }, [formData.estado]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value } = e.target;

        // Uppercase logic for specific fields
        const uppercaseFields = ['socio', 'contacto', 'calleNumero', 'colonia', 'estado', 'municipio'];
        if (uppercaseFields.includes(name)) {
            value = value.toUpperCase();
        }

        // Numeric-only logic for CP
        if (name === 'cp') {
            value = value.replace(/\D/g, '').substring(0, 5);
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("No se pudo acceder a la cámara");
            setShowCamera(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                setFormData(prev => ({ ...prev, foto: base64 }));
                stopCamera();
            }
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/recorrido/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuidProject,
                    idSucursal,
                    ...formData
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error al guardar el registro');

            setSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'var(--neon-blue)' }}>
            <Loader2 className="animate-spin" size={48} />
        </div>
    );

    if (error) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '2rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', maxWidth: '400px' }}>
                <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                <h2 style={{ marginBottom: '1rem' }}>Vaya...</h2>
                <p style={{ color: 'var(--light-gray)' }}>{error}</p>
            </div>
        </div>
    );

    if (success) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '2rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', maxWidth: '450px', width: '100%' }}>
                <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    background: 'rgba(34, 197, 94, 0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                }}>
                    <CheckCircle size={48} color="#22c55e" />
                </div>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>¡Registro Completo!</h2>
                <p style={{ color: 'var(--light-gray)', marginBottom: '2rem', fontSize: '1.1rem' }}>
                    Tus datos han sido guardados correctamente. ¡Gracias por visitarnos!
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="btn-primary" 
                    style={{ width: '100%' }}
                >
                    Registrar otro
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white' }}>
            {/* Header */}
            <div style={{ 
                padding: '2rem 1.5rem', 
                textAlign: 'center', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'linear-gradient(rgba(0,0,0,0.5), transparent)'
            }}>
                {project.logo && (
                    <img 
                        src={project.logo} 
                        alt={project.title} 
                        style={{ height: '60px', marginBottom: '1rem', objectFit: 'contain' }}
                    />
                )}
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neon-green)' }}>{project.title}</h1>
                <p style={{ opacity: 0.6, fontSize: '0.875rem', marginTop: '0.5rem' }}>Registro de Recorrido</p>
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Sección: Información Personal */}
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--neon-green)' }}>
                            <User size={18} />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Información Personal</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label-text">Nombre Completo *</label>
                                <input 
                                    type="text" 
                                    name="socio" 
                                    required 
                                    className="input-field" 
                                    placeholder="EJ. JUAN PÉREZ"
                                    value={formData.socio}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label-text">Sexo *</label>
                                    <select 
                                        name="sexo" 
                                        required 
                                        className="input-field"
                                        value={formData.sexo}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="1">Hombre</option>
                                        <option value="2">Mujer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label-text">F. Nacimiento *</label>
                                    <input 
                                        type="date" 
                                        name="fechaNacimiento" 
                                        required 
                                        className="input-field"
                                        value={formData.fechaNacimiento}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Contacto */}
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--neon-green)' }}>
                            <Phone size={18} />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Contacto</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label-text">Correo Electrónico *</label>
                                <input 
                                    type="email" 
                                    name="correoElectronico" 
                                    required 
                                    className="input-field" 
                                    placeholder="ejemplo@correo.com"
                                    value={formData.correoElectronico}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="label-text">Teléfono *</label>
                                <input 
                                    type="tel" 
                                    name="telefono" 
                                    required 
                                    className="input-field" 
                                    placeholder="55 1234 5678"
                                    value={formData.telefono}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="label-text">Contacto (Referencia) *</label>
                                <input 
                                    type="text" 
                                    name="contacto" 
                                    required 
                                    className="input-field" 
                                    placeholder="EJ. REDES SOCIALES, AMIGO..."
                                    value={formData.contacto}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="label-text">¿Cómo se enteró de nosotros? *</label>
                                <select 
                                    name="fuente" 
                                    required 
                                    className="input-field"
                                    value={formData.fuente}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Selecciona una opción...</option>
                                    {REFERRAL_SOURCES.map(source => (
                                        <option key={source} value={source}>{source}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Dirección */}
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--neon-green)' }}>
                            <MapPin size={18} />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Ubicación</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label-text">Dirección (Calle y Número)</label>
                                <input 
                                    type="text" 
                                    name="calleNumero" 
                                    className="input-field" 
                                    placeholder="Ej. Av. Reforma 123"
                                    value={formData.calleNumero}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label-text">Colonia</label>
                                    <input 
                                        type="text" 
                                        name="colonia" 
                                        className="input-field"
                                        value={formData.colonia}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div>
                                    <label className="label-text">C.P.</label>
                                    <input 
                                        type="text" 
                                        name="cp" 
                                        className="input-field"
                                        value={formData.cp}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label-text">Estado</label>
                                    <select 
                                        name="estado" 
                                        className="input-field"
                                        value={formData.estado}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecciona...</option>
                                        {states.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label-text">Municipio</label>
                                    <input 
                                        list="municipalities-list"
                                        name="municipio" 
                                        className="input-field"
                                        disabled={!formData.estado || loadingLocations}
                                        value={formData.municipio}
                                        onChange={handleInputChange}
                                        placeholder={loadingLocations ? 'Cargando...' : 'Escribe o selecciona...'}
                                    />
                                    <datalist id="municipalities-list">
                                        {municipalities.map(m => (
                                            <option key={m} value={m} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Foto / Selfie */}
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--neon-green)' }}>
                            <Camera size={18} />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Foto de Perfil</span>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            {formData.foto ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img 
                                        src={formData.foto} 
                                        alt="captured" 
                                        style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '50%', border: '3px solid var(--neon-green)' }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, foto: '' }))}
                                        style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            background: '#ef4444',
                                            border: 'none',
                                            borderRadius: '50%',
                                            padding: '0.5rem',
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    type="button"
                                    onClick={startCamera}
                                    className="btn-secondary"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                >
                                    <Camera size={20} />
                                    Tomar Selfie
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Botón Guardar */}
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="btn-primary" 
                        style={{ 
                            padding: '1.25rem', 
                            fontSize: '1.125rem', 
                            marginTop: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem'
                        }}
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : <ChevronRight />}
                        {submitting ? 'Guardando...' : 'Finalizar Registro'}
                    </button>

                </form>

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.3, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    Hecho con <Heart size={10} /> por Integra Gym
                </div>
            </div>

            {/* Camera Overlay */}
            {showCamera && (
                <div className="modal-overlay" style={{ flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        style={{ width: '100%', maxWidth: '400px', borderRadius: '16px', border: '2px solid var(--neon-green)' }}
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                            type="button" 
                            onClick={capturePhoto} 
                            className="btn-primary"
                            style={{ height: '60px', width: '60px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Camera size={32} />
                        </button>
                        <button 
                            type="button" 
                            onClick={stopCamera} 
                            className="btn-secondary"
                            style={{ padding: '1rem 2rem' }}
                        >
                            Cancelar
                        </button>
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
            )}

            <style jsx>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                form :global(.input-field) {
                    transition: all 0.2s ease;
                }
                
                form :global(.input-field:focus) {
                    border-color: var(--neon-green) !important;
                    box-shadow: 0 0 10px rgba(57, 255, 20, 0.2);
                }

                form :global(.label-text) {
                     color: var(--neon-green);
                     opacity: 0.9;
                     font-weight: 500;
                }
            `}</style>
        </div>
    );
}
