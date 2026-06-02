'use client';

import React, { useState, useEffect } from 'react';
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
    ChevronRight,
    Loader2
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
}

export default function TrainingPlanPage() {
    const t = useTranslations('TrainingPlan');
    const searchParams = useSearchParams();
    const projectUuid = searchParams.get('projectUuid');
    const planUuid = searchParams.get('planUuid');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [formData, setFormData] = useState<TrainingPlanData | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (projectUuid && planUuid) {
            fetchInitialData();
        } else {
            setError('Missing project or plan UUID');
            setLoading(false);
        }
    }, [projectUuid, planUuid]);

    const fetchInitialData = async () => {
        try {
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
            setSuccess(t('messages.success'));
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
            const saveRes = await fetch('/api/training-plan/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, projectUuid, planUuid })
            });
            const saveData = await saveRes.json();
            if (saveData.error) throw new Error(saveData.error);

            // Then generate
            const genRes = await fetch('/api/training-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectUuid, planUuid })
            });
            const genData = await genRes.json();
            if (genData.error) throw new Error(genData.error);
            setGeneratedPlan(genData.plan);
            setSuccess(t('messages.planGenerated'));
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
        doc.setFillColor(30, 41, 59); // Dark slate
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('INTEGRA GYM', 15, 20);
        doc.setFontSize(14);
        doc.text(t('title'), 15, 30);

        // Member Info Section
        doc.setTextColor(30, 41, 59);
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

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 overflow-x-hidden">
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
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium tracking-wide uppercase">{t('subtitle')}</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-4">
                        {t('title')}
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Optimiza tu rendimiento con un plan diseñado específicamente para tus necesidades por nuestra IA avanzada.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Form Panel */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-5"
                    >
                        <div className="glass-card p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                            <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3">
                                <FileText className="w-6 h-6 text-indigo-500" />
                                {t('form.member')}
                            </h2>

                            {formData && (
                                <form onSubmit={handleSave} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1">{t('form.member')}</label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input 
                                                    disabled
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-300 focus:outline-none"
                                                    value={formData.Socio}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1">{t('form.code')}</label>
                                            <input 
                                                disabled
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-300 focus:outline-none"
                                                value={formData.CodigoSocio}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1">{t('form.gender')}</label>
                                            <select 
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all outline-none"
                                                value={formData.Genero}
                                                onChange={(e) => setFormData({...formData, Genero: parseInt(e.target.value)})}
                                            >
                                                <option value={1}>{t('form.male')}</option>
                                                <option value={2}>{t('form.female')}</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1">{t('form.age')}</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                                                value={formData.Edad}
                                                onChange={(e) => setFormData({...formData, Edad: parseInt(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1 flex items-center gap-2">
                                                <Scale className="w-3 h-3" /> {t('form.weight')}
                                            </label>
                                            <input 
                                                type="number"
                                                step="0.1"
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                                                value={formData.Peso}
                                                onChange={(e) => setFormData({...formData, Peso: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1 flex items-center gap-2">
                                                <Ruler className="w-3 h-3" /> {t('form.height')}
                                            </label>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                                                value={formData.Estatura}
                                                onChange={(e) => setFormData({...formData, Estatura: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1 flex items-center gap-2">
                                                <Calendar className="w-3 h-3" /> {t('form.days')}
                                            </label>
                                            <input 
                                                type="number"
                                                max={7}
                                                min={1}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                                                value={formData.Dias}
                                                onChange={(e) => setFormData({...formData, Dias: parseInt(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-400 ml-1 flex items-center gap-2">
                                                <Clock className="w-3 h-3" /> {t('form.minutes')}
                                            </label>
                                            <input 
                                                type="number"
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                                                value={formData.Minutos}
                                                onChange={(e) => setFormData({...formData, Minutos: parseInt(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400 ml-1">{t('form.observations')}</label>
                                        <textarea 
                                            rows={3}
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none resize-none"
                                            value={formData.Observaciones}
                                            onChange={(e) => setFormData({...formData, Observaciones: e.target.value})}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-3 pt-4">
                                        <button 
                                            type="submit"
                                            disabled={saving}
                                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('form.save')}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={handleGenerate}
                                            disabled={generating}
                                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                                        >
                                            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                                <>
                                                    <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                    {t('form.generate')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.div>

                    {/* Result Panel */}
                    <motion.div 
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-7"
                    >
                        <div className="glass-card h-full min-h-[600px] rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col">
                            <div className="p-8 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-2xl font-semibold flex items-center gap-3">
                                    <Dumbbell className="w-6 h-6 text-purple-500" />
                                    {t('result.title')}
                                </h2>
                                {generatedPlan && (
                                    <button 
                                        onClick={downloadPDF}
                                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-xl border border-indigo-500/20 transition-all flex items-center gap-2 text-sm font-medium"
                                    >
                                        <Download className="w-4 h-4" />
                                        {t('result.download')}
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    {!generatedPlan && !generating ? (
                                        <motion.div 
                                            key="placeholder"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="h-full flex flex-col items-center justify-center text-center opacity-40"
                                        >
                                            <Sparkles className="w-16 h-16 mb-4 text-indigo-400" />
                                            <p className="text-xl max-w-xs">
                                                Completa los datos y presiona "Generar" para ver tu plan.
                                            </p>
                                        </motion.div>
                                    ) : generating ? (
                                        <motion.div 
                                            key="generating"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="h-full flex flex-col items-center justify-center text-center"
                                        >
                                            <div className="relative mb-8">
                                                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                                                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin relative" />
                                            </div>
                                            <h3 className="text-2xl font-bold mb-2">{t('form.generating')}</h3>
                                            <p className="text-slate-400">Nuestra IA está diseñando la mejor rutina para ti...</p>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="result"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="prose prose-invert prose-indigo max-w-none"
                                        >
                                            <div className="markdown-content text-slate-300 leading-relaxed font-light text-lg">
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

                {/* Notifications */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-3 pointer-events-none">
                    <AnimatePresence>
                        {success && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-3 pointer-events-auto"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">{success}</span>
                            </motion.div>
                        )}
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-3 pointer-events-auto"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <style jsx global>{`
                .glass-card {
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                .markdown-content a {
                    color: #818cf8;
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
            `}</style>
        </div>
    );
}
