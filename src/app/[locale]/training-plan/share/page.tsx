'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { 
    Dumbbell, 
    User, 
    Calendar, 
    Clock, 
    Scale, 
    Ruler, 
    FileText, 
    Download, 
    Sparkles, 
    CheckCircle2, 
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
    const t = useTranslations('TrainingPlan');
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
        doc.text(t('title'), 15, 30);

        // Member Info Section
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${t('form.member')}:`, 15, 55);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.Socio, 50, 55);

        doc.setFont('helvetica', 'bold');
        doc.text(`${t('form.code')}:`, 15, 62);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.CodigoSocio, 50, 62);

        // Stats Table
        const stats = [
            [t('form.age'), `${formData.Edad} años`],
            [t('form.gender'), formData.Genero === 1 ? t('form.male') : t('form.female')],
            [t('form.weight'), `${formData.Peso} kg`],
            [t('form.height'), `${formData.Estatura} mts`],
            [t('form.days'), `${formData.Dias} días`],
            [t('form.minutes'), `${formData.Minutos} min`]
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
        doc.text(t('result.title'), 15, finalY + 15);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(generatedPlan, pageWidth - 30);
        doc.text(splitText, 15, finalY + 25);

        doc.save(`Plan_Entrenamiento_${formData.Socio.replace(/\s+/g, '_')}.pdf`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                    <Loader2 className="w-12 h-12 text-indigo-500" />
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
                <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Rutina no disponible</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 overflow-x-hidden relative">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    {project?.logo && (
                        <img 
                            src={project.logo} 
                            alt={project.title} 
                            className="h-16 mx-auto mb-4 object-contain"
                        />
                    )}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
                        <Share2 className="w-4 h-4" />
                        <span className="text-xs font-semibold tracking-wider uppercase">Rutina Compartida</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-2">
                        {formData?.Socio}
                    </h1>
                    <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-light">
                        Diseñado especialmente por la Inteligencia Artificial de {project?.title || 'Integra Gym'}.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Member Stats Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-4"
                    >
                        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                                <User className="w-5 h-5 text-indigo-400" />
                                Ficha de Rendimiento
                            </h2>

                            {formData && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                            <span className="text-xs text-slate-500 block mb-1">Código</span>
                                            <span className="text-sm font-semibold text-slate-200">{formData.CodigoSocio}</span>
                                        </div>
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                            <span className="text-xs text-slate-500 block mb-1">Género</span>
                                            <span className="text-sm font-semibold text-slate-200">
                                                {formData.Genero === 2 ? 'Mujer' : 'Hombre'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 block">Edad</span>
                                                <span className="text-sm font-bold text-slate-200">{formData.Edad} años</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                                <Scale className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 block">Peso</span>
                                                <span className="text-sm font-bold text-slate-200">{formData.Peso} kg</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                                <Ruler className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 block">Estatura</span>
                                                <span className="text-sm font-bold text-slate-200">{formData.Estatura} mts</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 block">Sesión</span>
                                                <span className="text-sm font-bold text-slate-200">{formData.Minutos} min</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 flex items-center gap-3">
                                        <Dumbbell className="w-5 h-5 text-indigo-400" />
                                        <div>
                                            <span className="text-[10px] text-indigo-400 font-medium block">Frecuencia</span>
                                            <span className="text-sm font-bold text-indigo-200">{formData.Dias} días por semana</span>
                                        </div>
                                    </div>

                                    {formData.Observaciones && (
                                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                            <span className="text-xs text-slate-500 block mb-2">Objetivos y Observaciones</span>
                                            <p className="text-sm text-slate-300 font-light leading-relaxed">{formData.Observaciones}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Routine Details Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-8"
                    >
                        <div className="glass-card min-h-[500px] rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col overflow-hidden">
                            <div className="p-6 md:p-8 border-b border-white/10 bg-white/2 flex items-center justify-between">
                                <h2 className="text-lg md:text-xl font-bold flex items-center gap-3 text-white">
                                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                                    Tu Plan de Entrenamiento
                                </h2>
                                {generatedPlan && (
                                    <button 
                                        onClick={downloadPDF}
                                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/20"
                                    >
                                        <Download className="w-4 h-4" />
                                        Descargar PDF
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                                <AnimatePresence mode="wait">
                                    {!generatedPlan ? (
                                        <motion.div 
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="h-full flex flex-col items-center justify-center text-center py-12"
                                        >
                                            <Dumbbell className="w-16 h-16 mb-4 text-indigo-500 animate-bounce" />
                                            <h3 className="text-xl font-bold mb-2 text-white">Plan en Preparación</h3>
                                            <p className="text-slate-400 max-w-sm text-sm">
                                                Tu rutina está lista para ser generada. Pídele al entrenador de tu gimnasio que inicie la generación inteligente.
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="plan"
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="prose prose-invert max-w-none"
                                        >
                                            <div className="markdown-content text-slate-300 leading-relaxed font-light text-base md:text-lg">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {generatedPlan}
                                                </ReactMarkdown>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="text-center mt-12 opacity-35 text-[10px] flex items-center justify-center gap-1 text-slate-400">
                    Desarrollado con <Heart className="w-3 h-3 text-red-500 inline" /> por Integra Gym © 2026
                </div>
            </main>

            <style jsx global>{`
                .glass-card {
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
                }
                .markdown-content a {
                    color: #818cf8;
                    text-decoration: underline;
                    font-weight: 500;
                    transition: opacity 0.2s;
                }
                .markdown-content a:hover {
                    opacity: 0.8;
                }
                .markdown-content img {
                    max-width: 100%;
                    border-radius: 12px;
                    margin: 1rem 0;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                    color: #818cf8;
                    margin-top: 1.75rem;
                    margin-bottom: 0.75rem;
                    font-weight: 800;
                    letter-spacing: -0.025em;
                }
                .markdown-content h1 { font-size: 1.75rem; }
                .markdown-content h2 { font-size: 1.5rem; }
                .markdown-content h3 { font-size: 1.25rem; }
                .markdown-content ul, .markdown-content ol {
                    margin-left: 1.5rem;
                    margin-bottom: 1.25rem;
                    list-style-type: disc;
                }
                .markdown-content li {
                    margin-bottom: 0.5rem;
                }
                .markdown-content p {
                    margin-bottom: 1.25rem;
                }
                .markdown-content strong {
                    color: #fff;
                    font-weight: 700;
                }
            `}</style>
        </div>
    );
}

export default function SharePlanPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
        }>
            <SharePlanContent />
        </Suspense>
    );
}
