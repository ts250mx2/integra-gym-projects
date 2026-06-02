'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Dumbbell, FileDown, User, Calendar, Clock, Scale, Ruler, Target, ExternalLink, Venus, Mars, RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PlanData {
    Socio: string;
    CodigoSocio: string;
    Genero: number;
    Edad: number;
    Peso: number;
    Estatura: number;
    Dias: number;
    Minutos: number;
    Observaciones: string;
    PlanEntrenamiento?: string | null;
}

const ACCENT = '#00f3ff';
const ACCENT2 = '#39ff14';
const BG = '#070b10';
const PANEL = 'rgba(255,255,255,0.035)';
const BORDER = 'rgba(255,255,255,0.10)';
const TXT = '#e9fbff';
const MUTED = '#8aa0ab';

// Repara enlaces que la IA pudo dejar con espacios dentro de la URL (rompen el clic).
function sanitizePlan(md: string): string {
    if (!md) return '';
    return md
        // Encierra/encodea espacios dentro del destino de un link Markdown ](...).
        .replace(/\]\(\s*([^)]+?)\s*\)/g, (_m, url) => `](${String(url).replace(/\s+/g, '%20')})`)
        .trim();
}

// ── Markdown personalizado: links clicables (nueva pestaña), imágenes y tablas ──
const mdComponents = {
    a: ({ href, children }: any) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="plan-link">
            {children}
            <ExternalLink size={12} style={{ flexShrink: 0 }} />
        </a>
    ),
    img: ({ src, alt }: any) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ''} loading="lazy" className="plan-img"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    ),
    table: ({ children }: any) => (
        <div className="plan-table-wrap"><table>{children}</table></div>
    ),
};

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 12,
            background: PANEL, border: `1px solid ${BORDER}`, minWidth: 0,
        }}>
            <span style={{ color: ACCENT, display: 'flex' }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: TXT, whiteSpace: 'nowrap' }}>{value}</div>
            </div>
        </div>
    );
}

function PlanContent() {
    const params = useSearchParams();
    const projectUuid = params.get('projectUuid');
    const planUuid = params.get('planUuid');

    const [data, setData] = useState<PlanData | null>(null);
    const [plan, setPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!projectUuid || !planUuid) {
            setError('Falta el identificador del plan.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/training-plan/init?projectUuid=${encodeURIComponent(projectUuid)}&planUuid=${encodeURIComponent(planUuid)}`);
                const d = await res.json();
                if (!res.ok || d.error) throw new Error(d.error || 'No se pudo cargar el plan.');
                setData(d);
                if (d.PlanEntrenamiento && String(d.PlanEntrenamiento).trim()) {
                    setPlan(sanitizePlan(d.PlanEntrenamiento));
                } else {
                    setGenerating(true);
                    const gen = await fetch('/api/training-plan/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectUuid, planUuid }),
                    });
                    const gd = await gen.json();
                    if (!gen.ok || gd.error) throw new Error(gd.error || 'No se pudo generar el plan.');
                    setPlan(sanitizePlan(gd.plan || ''));
                    setGenerating(false);
                }
            } catch (e: any) {
                setError(e.message);
                setGenerating(false);
            } finally {
                setLoading(false);
            }
        })();
    }, [projectUuid, planUuid]);

    const regenerate = async () => {
        if (!projectUuid || !planUuid || generating) return;
        setGenerating(true);
        setError(null);
        try {
            const gen = await fetch('/api/training-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectUuid, planUuid }),
            });
            const gd = await gen.json();
            if (!gen.ok || gd.error) throw new Error(gd.error || 'No se pudo regenerar el plan.');
            setPlan(sanitizePlan(gd.plan || ''));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const exportPdf = async () => {
        if (!plan || exporting) return;
        setExporting(true);
        try {
            const { generateAnswerPDF } = await import('@/utils/generateAnswerPDF');
            generateAnswerPDF(plan, { question: `Plan de entrenamiento — ${data?.Socio || ''}`.trim() });
        } catch (e) {
            console.error('No se pudo exportar el PDF:', e);
        } finally {
            setExporting(false);
        }
    };

    const esMujer = data?.Genero === 2;
    const chips = data ? [
        data.Edad ? { icon: <User size={16} />, label: 'Edad', value: `${data.Edad} años` } : null,
        { icon: esMujer ? <Venus size={16} /> : <Mars size={16} />, label: 'Sexo', value: esMujer ? 'Mujer' : 'Hombre' },
        data.Peso ? { icon: <Scale size={16} />, label: 'Peso', value: `${data.Peso} kg` } : null,
        data.Estatura ? { icon: <Ruler size={16} />, label: 'Estatura', value: `${data.Estatura} m` } : null,
        data.Dias ? { icon: <Calendar size={16} />, label: 'Frecuencia', value: `${data.Dias} días/sem` } : null,
        data.Minutos ? { icon: <Clock size={16} />, label: 'Sesión', value: `${data.Minutos} min` } : null,
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[] : [];

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TXT, paddingBottom: 40 }}>
            {/* ── Hero ── */}
            <div style={{ position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(1200px 300px at 15% -40%, rgba(0,243,255,0.28), transparent 60%), radial-gradient(900px 300px at 100% 0%, rgba(57,255,20,0.18), transparent 55%)`,
                }} />
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.5,
                    backgroundImage: 'radial-gradient(rgba(0,243,255,0.10) 1px, transparent 1px)', backgroundSize: '22px 22px',
                }} />
                <div style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '26px 18px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, boxShadow: '0 10px 28px -8px rgba(0,243,255,0.5)',
                            }}>
                                <Dumbbell size={26} color="#04121a" />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT }}>Integra Gym</div>
                                <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 900, letterSpacing: 0.3, lineHeight: 1.1 }}>Plan de Entrenamiento</h1>
                                {data?.Socio && <div style={{ fontSize: 14, color: MUTED, marginTop: 3 }}>{data.Socio}</div>}
                            </div>
                        </div>
                        {plan && !loading && !error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={regenerate} disabled={generating} title="Generar la rutina de nuevo"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 12,
                                        border: `1px solid ${BORDER}`, background: PANEL, color: TXT,
                                        fontSize: 13, fontWeight: 700, cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.5 : 1, whiteSpace: 'nowrap',
                                    }}>
                                    <RefreshCw size={15} />
                                    Regenerar
                                </button>
                                <button onClick={exportPdf} disabled={exporting}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
                                        border: 'none', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#04121a',
                                        fontSize: 13.5, fontWeight: 800, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1, whiteSpace: 'nowrap',
                                        boxShadow: '0 8px 22px -8px rgba(0,243,255,0.5)',
                                    }}>
                                    <FileDown size={16} />
                                    {exporting ? 'Generando…' : 'Descargar PDF'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stat chips */}
                    {chips.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
                            {chips.map((c, i) => <StatChip key={i} icon={c.icon} label={c.label} value={c.value} />)}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 18px 0' }}>
                {data?.Observaciones && (
                    <div style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 15px', borderRadius: 14, marginBottom: 18,
                        background: 'rgba(0,243,255,0.06)', border: `1px solid rgba(0,243,255,0.25)`,
                    }}>
                        <Target size={17} color={ACCENT} style={{ marginTop: 1, flexShrink: 0 }} />
                        <div style={{ fontSize: 13.5 }}><strong style={{ color: TXT }}>Objetivo:</strong> <span style={{ color: MUTED }}>{data.Observaciones}</span></div>
                    </div>
                )}

                {(loading || generating) && (
                    <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>
                        <div style={{
                            width: 40, height: 40, margin: '0 auto 16px', borderRadius: '50%',
                            border: `3px solid ${BORDER}`, borderTopColor: ACCENT, animation: 'planspin 0.9s linear infinite',
                        }} />
                        {generating ? 'Generando tu rutina personalizada…' : 'Cargando…'}
                    </div>
                )}
                {error && !loading && !generating && (
                    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: 'center', color: MUTED }}>
                        {error}
                    </div>
                )}

                {plan && !loading && !generating && !error && (
                    <>
                        <div className="plan-md" style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '20px 22px' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{plan}</ReactMarkdown>
                        </div>
                        <div style={{ textAlign: 'center', color: MUTED, fontSize: 11, marginTop: 22 }}>
                            Generado por el Agente Integra Gym · Consulta a tu entrenador antes de iniciar una rutina nueva
                        </div>
                    </>
                )}
            </div>

            <style jsx global>{`
                @keyframes planspin { to { transform: rotate(360deg); } }
                .plan-md { font-size: 14.5px; line-height: 1.7; color: ${TXT}; }
                .plan-md > :first-child { margin-top: 0; }
                .plan-md h1, .plan-md h2, .plan-md h3, .plan-md h4 { font-weight: 800; line-height: 1.25; }
                .plan-md h1 { font-size: 22px; color: #fff; margin: 22px 0 12px; }
                .plan-md h2 {
                    font-size: 17px; color: ${ACCENT}; margin: 26px 0 12px; padding: 8px 0 8px 14px;
                    border-left: 4px solid ${ACCENT}; background: linear-gradient(90deg, rgba(0,243,255,0.08), transparent);
                    border-radius: 0 10px 10px 0;
                }
                .plan-md h3 { font-size: 15px; color: ${ACCENT2}; margin: 18px 0 8px; }
                .plan-md p { margin: 9px 0; }
                .plan-md strong { color: #fff; font-weight: 800; }
                .plan-md em { color: ${MUTED}; }
                .plan-md ul, .plan-md ol { margin: 9px 0; padding-left: 6px; list-style: none; }
                .plan-md ol { counter-reset: item; }
                .plan-md ul > li, .plan-md ol > li { position: relative; margin: 7px 0; padding-left: 26px; }
                .plan-md ul > li::before {
                    content: ''; position: absolute; left: 6px; top: 9px; width: 7px; height: 7px;
                    border-radius: 50%; background: ${ACCENT};
                }
                .plan-md ol > li::before {
                    counter-increment: item; content: counter(item); position: absolute; left: 0; top: 1px;
                    width: 18px; height: 18px; border-radius: 6px; background: rgba(0,243,255,0.15); color: ${ACCENT};
                    font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center;
                }
                .plan-link {
                    display: inline-flex; align-items: center; gap: 5px; color: ${ACCENT}; font-weight: 700;
                    text-decoration: none; padding: 2px 8px; border-radius: 8px; border: 1px solid rgba(0,243,255,0.3);
                    background: rgba(0,243,255,0.07); transition: background .15s; vertical-align: baseline;
                }
                .plan-link:hover { background: rgba(0,243,255,0.16); }
                .plan-img {
                    display: block; max-width: 100%; height: auto; max-height: 360px; margin: 12px auto;
                    border-radius: 12px; border: 1px solid ${BORDER};
                }
                .plan-table-wrap { margin: 12px 0; overflow-x: auto; border-radius: 10px; border: 1px solid ${BORDER}; -webkit-overflow-scrolling: touch; }
                .plan-md table { border-collapse: collapse; width: 100%; min-width: 420px; font-size: 13px; }
                .plan-md .plan-table-wrap table { margin: 0; }
                .plan-md th { background: rgba(0,243,255,0.12); font-weight: 800; padding: 9px 11px; border: 1px solid ${BORDER}; text-align: left; color: ${TXT}; }
                .plan-md td { padding: 9px 11px; border: 1px solid ${BORDER}; color: ${TXT}; }
                .plan-md tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
                .plan-md hr { border: none; border-top: 1px solid ${BORDER}; margin: 20px 0; }
                .plan-md blockquote { margin: 12px 0; padding: 8px 14px; border-left: 3px solid ${ACCENT2}; background: rgba(57,255,20,0.05); border-radius: 0 8px 8px 0; color: ${MUTED}; }
                .plan-md code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 5px; font-size: 12.5px; }
            `}</style>
        </div>
    );
}

export default function WaPlanPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: BG, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>}>
            <PlanContent />
        </Suspense>
    );
}
