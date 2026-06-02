'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
    User, 
    Calendar, 
    Clock, 
    Scale, 
    Ruler, 
    FileText, 
    Download, 
    Sparkles, 
    CheckCircle, 
    AlertCircle,
    Loader2,
    ChevronRight,
    Dumbbell,
    Heart
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface TrainingPlanData {
    Socio: string;
    CodigoSocio: string;
    Genero: number;
    Edad: number;
    Peso: number;
    Estatura: number;
    Dias: number;
    Minutos: number;
    Observaciones: string;
}

function TrainingPlanContent() {
    const searchParams = useSearchParams();
    const projectUuid = searchParams.get('projectUuid');
    const planUuid = searchParams.get('planUuid');

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [formData, setFormData] = useState<TrainingPlanData | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (projectUuid && planUuid) {
            init();
        } else {
            setError('Faltan parámetros requeridos (projectUuid o planUuid)');
            setLoading(false);
        }
    }, [projectUuid, planUuid]);

    async function init() {
        try {
            // Fetch Project Details
            const projectRes = await fetch(`/api/recorrido/details?UUIDProject=${projectUuid}`);
            if (!projectRes.ok) throw new Error('No se pudo encontrar el proyecto');
            const projectData = await projectRes.json();
            setProject(projectData);

            // Fetch Initial Plan Data
            const res = await fetch(`/api/training-plan/init?projectUuid=${projectUuid}&planUuid=${planUuid}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setFormData(data);
            if (data.PlanEntrenamiento) {
                setGeneratedPlan(data.PlanEntrenamiento);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (!formData) return;

        setFormData(prev => ({
            ...prev!,
            [name]: type === 'number' ? (value === '' ? 0 : (name === 'Estatura' || name === 'Peso' ? parseFloat(value) : parseInt(value))) : value
        }));
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch('/api/training-plan/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, projectUuid, planUuid })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSuccess('Datos guardados correctamente');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setSuccess(null);
        try {
            // First save the data
            const resSave = await fetch('/api/training-plan/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, projectUuid, planUuid })
            });
            const dataSave = await resSave.json();
            if (dataSave.error) throw new Error(dataSave.error);

            // Then generate
            const genRes = await fetch('/api/training-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectUuid, planUuid })
            });
            const genData = await genRes.json();
            if (genData.error) throw new Error(genData.error);
            setGeneratedPlan(genData.plan);
            setSuccess('¡Plan generado con éxito!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const downloadPDF = () => {
        if (!formData || !generatedPlan) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text(project?.title || 'INTEGRA GYM', 15, 20);
        doc.setFontSize(14);
        doc.text('Plan de Entrenamiento Personalizado', 15, 30);

        // Member Info
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Socio:`, 15, 55);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.Socio, 50, 55);

        doc.setFont('helvetica', 'bold');
        doc.text(`Código:`, 15, 62);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.CodigoSocio, 50, 62);

        const stats = [
            ['Edad', `${formData.Edad} años`],
            ['Género', formData.Genero === 1 ? 'Hombre' : 'Mujer'],
            ['Peso', `${formData.Peso} kg`],
            ['Estatura', `${formData.Estatura} mts`],
            ['Días / Semana', `${formData.Dias}`],
            ['Minutos / Día', `${formData.Minutos}`]
        ];

        (doc as any).autoTable({
            startY: 75,
            head: [['Concepto', 'Valor']],
            body: stats,
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] }, // Emerald (Neon Green style)
        });

        const finalY = (doc as any).lastAutoTable.finalY || 75;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Tu Rutina de Entrenamiento', 15, finalY + 15);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(generatedPlan, pageWidth - 30);
        doc.text(splitText, 15, finalY + 25);

        doc.save(`Plan_${formData.Socio.replace(/\s+/g, '_')}.pdf`);
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'var(--neon-blue)' }}>
            <Loader2 className="animate-spin" size={48} />
        </div>
    );

    if (error) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '2rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', maxWidth: '400px' }}>
                <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem', margin: '0 auto' }} />
                <h2 style={{ marginBottom: '1rem', color: 'white' }}>Vaya...</h2>
                <p style={{ color: 'var(--light-gray)' }}>{error}</p>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ 
                padding: '2rem 1.5rem', 
                textAlign: 'center', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'linear-gradient(rgba(0,0,0,0.5), transparent)'
            }}>
                {project?.logo && (
                    <img 
                        src={project.logo} 
                        alt={project.title} 
                        style={{ height: '60px', marginBottom: '1rem', objectFit: 'contain', margin: '0 auto' }}
                    />
                )}
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--neon-green)', textTransform: 'uppercase' }}>{project?.title}</h1>
                <p style={{ opacity: 0.6, fontSize: '0.875rem', marginTop: '0.5rem' }}>Plan de Entrenamiento Inteligente</p>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Form Section */}
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--neon-green)' }}>
                                <User size={20} />
                                <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Datos del Socio</span>
                            </div>

                            {formData && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label className="label-text">Socio</label>
                                            <input className="input-field" value={formData.Socio} disabled style={{ opacity: 0.7 }} />
                                        </div>
                                        <div>
                                            <label className="label-text">Código</label>
                                            <input className="input-field" value={formData.CodigoSocio} disabled style={{ opacity: 0.7 }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label className="label-text">Género</label>
                                            <select 
                                                name="Genero" 
                                                className="input-field"
                                                value={formData.Genero}
                                                onChange={handleInputChange}
                                            >
                                                <option value={1}>Hombre</option>
                                                <option value={2}>Mujer</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-text">Edad</label>
                                            <input 
                                                type="number" 
                                                name="Edad" 
                                                className="input-field"
                                                value={formData.Edad}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label className="label-text">Peso (KG)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                name="Peso" 
                                                className="input-field"
                                                value={formData.Peso}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div>
                                            <label className="label-text">Estatura (mts)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                name="Estatura" 
                                                className="input-field"
                                                value={formData.Estatura}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label className="label-text">Días / Semana</label>
                                            <input 
                                                type="number" 
                                                name="Dias" 
                                                className="input-field"
                                                value={formData.Dias}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div>
                                            <label className="label-text">Minutos / Día</label>
                                            <input 
                                                type="number" 
                                                name="Minutos" 
                                                className="input-field"
                                                value={formData.Minutos}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label-text">Observaciones / Objetivos</label>
                                        <textarea 
                                            name="Observaciones" 
                                            rows={3}
                                            className="input-field" 
                                            style={{ resize: 'none' }}
                                            value={formData.Observaciones}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
                            <button 
                                type="button" 
                                onClick={() => handleSave()}
                                disabled={saving || generating}
                                className="btn-secondary"
                                style={{ padding: '1rem' }}
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Guardar Datos'}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleGenerate}
                                disabled={generating || saving}
                                className="btn-primary"
                                style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                            >
                                {generating ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        <Sparkles size={20} />
                                        Generar Plan con IA
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Result Section */}
                    { (generatedPlan || generating) && (
                        <div className="glass-card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--neon-green)' }}>
                                    <Dumbbell size={20} />
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>Tu Plan de Entrenamiento</span>
                                </div>
                                {generatedPlan && (
                                    <button 
                                        onClick={downloadPDF}
                                        className="btn-icon"
                                        title="Descargar PDF"
                                    >
                                        <Download size={18} />
                                    </button>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                {generating ? (
                                    <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', opacity: 0.7 }}>
                                        <Loader2 className="animate-spin" size={40} color="var(--neon-green)" />
                                        <p>Nuestra IA está diseñando tu rutina...</p>
                                    </div>
                                ) : (
                                    <div className="markdown-content" style={{ 
                                        color: '#e2e8f0', 
                                        lineHeight: '1.7', 
                                        fontSize: '0.95rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        padding: '1.5rem',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {generatedPlan}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notifications */}
                {success && (
                    <div style={{ 
                        position: 'fixed', 
                        bottom: '2rem', 
                        left: '50%', 
                        transform: 'translateX(-50%)',
                        background: 'rgba(16, 185, 129, 0.9)', 
                        color: 'white', 
                        padding: '0.75rem 1.5rem', 
                        borderRadius: '99px',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        zIndex: 100,
                        backdropFilter: 'blur(8px)'
                    }}>
                        <CheckCircle size={18} />
                        <span style={{ fontWeight: 500 }}>{success}</span>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.3, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    Hecho con <Heart size={10} /> por Integra Gym
                </div>
            </div>

            <style jsx global>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .input-field:focus {
                    border-color: var(--neon-green) !important;
                    box-shadow: 0 0 10px rgba(57, 255, 20, 0.2);
                }

                .label-text {
                     color: var(--neon-green);
                     opacity: 0.9;
                     font-weight: 500;
                     margin-bottom: 0.5rem;
                     display: block;
                     font-size: 0.85rem;
                }

                .markdown-content a {
                    color: var(--neon-green);
                    text-decoration: underline;
                    transition: opacity 0.2s;
                }
                .markdown-content a:hover {
                    opacity: 0.8;
                }
                .markdown-content img {
                    max-width: 100%;
                    border-radius: 8px;
                    margin: 1rem 0;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                    color: var(--neon-green);
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    font-weight: 700;
                }
                .markdown-content ul, .markdown-content ol {
                    margin-left: 1.5rem;
                    margin-bottom: 1rem;
                }
                .markdown-content li {
                    margin-bottom: 0.5rem;
                }
                .markdown-content p {
                    margin-bottom: 1rem;
                }
            `}</style>
        </div>
    );
}

export default function TrainingPlanPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#39ff14] animate-spin" />
            </div>
        }>
            <TrainingPlanContent />
        </Suspense>
    );
}
