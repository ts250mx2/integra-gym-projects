'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
    Dumbbell, 
    User, 
    Calendar, 
    Clock, 
    Scale, 
    Ruler, 
    Download, 
    Sparkles, 
    AlertCircle,
    Loader2,
    Share2,
    Heart
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    PlanEntrenamiento?: string;
}

function SharePlanContent() {
    const searchParams = useSearchParams();
    const projectUuid = searchParams.get('projectUuid');
    const planUuid = searchParams.get('planUuid');

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<TrainingPlanData | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (projectUuid && planUuid) {
            fetchPlanData();
        } else {
            setError('Faltan parámetros del plan de entrenamiento');
            setLoading(false);
        }
    }, [projectUuid, planUuid]);

    const fetchPlanData = async () => {
        try {
            // Fetch Project Details
            const projectRes = await fetch(`/api/recorrido/details?UUIDProject=${projectUuid}`);
            if (projectRes.ok) {
                const projectData = await projectRes.json();
                setProject(projectData);
            }

            // Fetch Plan Details
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
    };

    const downloadPDF = () => {
        if (!formData || !generatedPlan) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text(project?.title || 'INTEGRA GYM', 15, 20);
        doc.setFontSize(14);
        doc.text('Plan de Entrenamiento Personalizado', 15, 30);

        // Member Info Section
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Socio:`, 15, 55);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.Socio, 50, 55);

        doc.setFont('helvetica', 'bold');
        doc.text(`Código:`, 15, 62);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.CodigoSocio, 50, 62);

        // Stats Table
        const stats = [
            ['Edad', `${formData.Edad} años`],
            ['Género', formData.Genero === 1 ? 'Hombre' : 'Mujer'],
            ['Peso', `${formData.Peso} kg`],
            ['Estatura', `${formData.Estatura} mts`],
            ['Días / Semana', `${formData.Dias} días`],
            ['Minutos / Sesión', `${formData.Minutos} min`]
        ];

        (doc as any).autoTable({
            startY: 75,
            head: [['Concepto', 'Valor']],
            body: stats,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo
        });

        // Plan Content
        const finalY = (doc as any).lastAutoTable.finalY || 75;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Tu Rutina de Entrenamiento', 15, finalY + 15);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(generatedPlan, pageWidth - 30);
        doc.text(splitText, 15, finalY + 25);

        doc.save(`Plan_Entrenamiento_${formData.Socio.replace(/\s+/g, '_')}.pdf`);
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#818cf8' }}>
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '2rem' }}>
                <div className="glass-card" style={{ textAlign: 'center', maxWidth: '400px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '2rem' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem', margin: '0 auto' }} />
                    <h2 style={{ marginBottom: '1rem', color: 'white' }}>Rutina no disponible</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
            {/* Background Decorations */}
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'rgba(79,70,229,0.1)', filter: 'blur(120px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(147,51,234,0.1)', filter: 'blur(120px)', borderRadius: '50%' }} />
            </div>

            <main style={{ position: 'relative', zIndex: 10, maxWidth: '1000px', margin: '0 auto', padding: '3rem 1.5rem' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    {project?.logo && (
                        <img 
                            src={project.logo} 
                            alt={project.title} 
                            style={{ height: '60px', marginBottom: '1rem', objectFit: 'contain', margin: '0 auto' }}
                        />
                    )}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '99px', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', color: '#818cf8', marginBottom: '1rem' }}>
                        <Share2 size={16} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rutina Compartida</span>
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', margin: '0 0 0.5rem 0' }}>
                        {formData?.Socio}
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.125rem', margin: 0, fontWeight: 300 }}>
                        Diseñado especialmente por la Inteligencia Artificial de {project?.title || 'Integra Gym'}.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="responsive-grid">
                    {/* Member Stats Card */}
                    <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                            <User size={20} color="#818cf8" />
                            Ficha de Rendimiento
                        </h2>

                        {formData && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Código</span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{formData.CodigoSocio}</span>
                                    </div>
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Género</span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>
                                            {formData.Genero === 2 ? 'Mujer' : 'Hombre'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }} className="stats-subgrid">
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Edad</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>{formData.Edad} años</span>
                                    </div>
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Peso</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>{formData.Peso} kg</span>
                                    </div>
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Estatura</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>{formData.Estatura} mts</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(79,70,229,0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Dumbbell size={20} color="#818cf8" />
                                        <div>
                                            <span style={{ fontSize: '0.65rem', color: '#818cf8', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Frecuencia</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#c7d2fe' }}>{formData.Dias} días / sem</span>
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(79,70,229,0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Clock size={20} color="#818cf8" />
                                        <div>
                                            <span style={{ fontSize: '0.65rem', color: '#818cf8', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Sesión</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#c7d2fe' }}>{formData.Minutos} minutos</span>
                                        </div>
                                    </div>
                                </div>

                                {formData.Observaciones && (
                                    <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Objetivos y Observaciones</span>
                                        <p style={{ fontSize: '0.875rem', color: '#cbd5e1', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>{formData.Observaciones}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Routine Details Card */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Sparkles size={20} color="#c084fc" className="pulse" />
                                Tu Plan de Entrenamiento
                            </h2>
                            {generatedPlan && (
                                <button 
                                    onClick={downloadPDF}
                                    style={{
                                        background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px',
                                        padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                                        transition: 'all 0.2s'
                                    }}
                                    className="btn-download"
                                >
                                    <Download size={16} />
                                    Descargar PDF
                                </button>
                            )}
                        </div>

                        <div style={{ padding: '2rem', flex: 1 }}>
                            {!generatedPlan ? (
                                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                    <Dumbbell size={48} color="#4f46e5" style={{ marginBottom: '1rem' }} className="bounce" />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>Plan en Preparación</h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: '350px', margin: '0 auto' }}>
                                        Tu rutina está siendo diseñada por nuestro equipo. Pídele al entrenador de tu gimnasio que inicie la generación inteligente.
                                    </p>
                                </div>
                            ) : (
                                <div className="markdown-content" style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.7, fontWeight: 300 }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {generatedPlan}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.35, fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    Desarrollado con <Heart size={10} style={{ color: '#ef4444' }} /> por Integra Gym © 2026
                </div>
            </main>

            <style jsx global>{`
                @media(min-width: 900px) {
                    .responsive-grid {
                        grid-template-columns: 1fr 2fr !important;
                    }
                }
                .pulse {
                    animation: pulse-anim 2s infinite;
                }
                @keyframes pulse-anim {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.05); }
                }
                .btn-download:hover {
                    background: #4338ca !important;
                    transform: translateY(-1px);
                }
                .btn-download:active {
                    transform: translateY(0);
                }
                .markdown-content a {
                    color: #818cf8;
                    text-decoration: underline;
                }
                .markdown-content img {
                    max-width: 100%;
                    border-radius: 8px;
                    margin: 1rem 0;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                    color: #818cf8;
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
                .markdown-content strong {
                    color: white;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}

export default function SharePlanPage() {
    return (
        <Suspense fallback={
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
                <Loader2 className="animate-spin" size={48} color="#818cf8" />
            </div>
        }>
            <SharePlanContent />
        </Suspense>
    );
}
