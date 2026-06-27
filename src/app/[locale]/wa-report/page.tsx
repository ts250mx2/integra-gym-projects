'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Brain, FileDown } from 'lucide-react';
import AgentChart from '@/components/AgentChart';

interface TableSpec { title?: string; columns: string[]; rows: any[][]; }
interface ReportData {
    title?: string | null;
    question?: string;
    answer?: string;
    gymName?: string;
    fecha?: string;
    tables: TableSpec[];
    charts: any[];
    insights?: string[];
}

const ACCENT = '#00f3ff';
const BG = '#0a0a0a';
const PANEL = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.12)';
const TXT = '#e6f9ff';
const MUTED = '#7c8a93';

function fmtCell(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && isFinite(v)) {
        return v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    }
    return String(v);
}

function ReportTable({ spec }: { spec: TableSpec }) {
    if (!spec || !Array.isArray(spec.columns) || !Array.isArray(spec.rows)) return null;
    return (
        <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 18 }}>
            {spec.title && (
                <div style={{ padding: '10px 14px', fontWeight: 700, color: TXT, borderBottom: `1px solid ${BORDER}`, fontSize: 14 }}>
                    {spec.title}
                </div>
            )}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                    <tr>
                        {spec.columns.map((c, i) => (
                            <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '9px 14px', background: 'rgba(0,243,255,0.08)', color: TXT, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {spec.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            {row.map((cell, ci) => (
                                <td key={ci} style={{ textAlign: ci === 0 ? 'left' : 'right', padding: '8px 14px', color: ci === 0 ? TXT : MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>
                                    {fmtCell(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ReportContent() {
    const params = useSearchParams();
    const r = params.get('r');
    const [data, setData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!r) { setError('Falta el identificador del reporte.'); setLoading(false); return; }
        fetch(`/api/whatsapp/report?r=${encodeURIComponent(r)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(res.status === 404 ? 'Este reporte no existe o expiró.' : 'No se pudo cargar el reporte.');
                return res.json();
            })
            .then((d: ReportData) => setData(d))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [r]);

    const fecha = data?.fecha ? new Date(data.fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '';
    const hasContent = !!data && ((data.charts?.length || 0) > 0 || (data.tables?.length || 0) > 0);

    const exportPdf = async () => {
        if (!data || exporting) return;
        setExporting(true);
        try {
            const { generateReportPDF } = await import('@/utils/generateReportPDF');
            generateReportPDF({
                title: data.title,
                gymName: data.gymName,
                fecha: data.fecha,
                question: data.question,
                answer: data.answer,
                charts: data.charts || [],
                tables: data.tables || [],
                insights: data.insights || [],
            });
        } catch (e) {
            console.error('No se pudo exportar el PDF:', e);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TXT, padding: '24px 16px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,243,255,0.1)', border: `1px solid ${ACCENT}` }}>
                            <Brain size={24} color={ACCENT} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, letterSpacing: 0.5, fontSize: 16 }}>Agente Integra Gym</div>
                            <div style={{ fontSize: 12, color: MUTED }}>{data?.gymName || 'Reporte'}{fecha ? ` · ${fecha}` : ''}</div>
                        </div>
                    </div>
                    {hasContent && (
                        <button onClick={exportPdf} disabled={exporting}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 12,
                                border: `1px solid ${ACCENT}`, background: 'rgba(0,243,255,0.08)', color: ACCENT,
                                fontSize: 13, fontWeight: 700, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1, whiteSpace: 'nowrap',
                            }}>
                            <FileDown size={15} />
                            {exporting ? 'Generando…' : 'Exportar PDF'}
                        </button>
                    )}
                </div>

                {loading && <div style={{ color: MUTED, padding: 40, textAlign: 'center' }}>Cargando reporte…</div>}
                {error && !loading && (
                    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: 'center', color: MUTED }}>
                        {error}
                    </div>
                )}

                {data && !loading && !error && (
                    <>
                        {data.title && <h1 style={{ fontSize: 20, fontWeight: 800, color: TXT, margin: '0 0 8px' }}>{data.title}</h1>}
                        {data.question && (
                            <div style={{ fontStyle: 'italic', color: MUTED, fontSize: 13, marginBottom: 16, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12 }}>
                                “{data.question}”
                            </div>
                        )}
                        {data.answer && (
                            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', fontSize: 14, lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
                                {data.answer}
                            </div>
                        )}

                        {/* Sugerencias / insights */}
                        {Array.isArray(data.insights) && data.insights.length > 0 && (
                            <div style={{ background: 'rgba(0,243,255,0.06)', border: `1px solid ${ACCENT}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
                                <div style={{ fontWeight: 800, color: ACCENT, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>💡 SUGERENCIAS</div>
                                <ul style={{ margin: 0, paddingLeft: 18, color: TXT, fontSize: 14, lineHeight: 1.7 }}>
                                    {data.insights.map((s, i) => (<li key={i}>{s}</li>))}
                                </ul>
                            </div>
                        )}

                        {/* Charts */}
                        {Array.isArray(data.charts) && data.charts.map((c, i) => (
                            <AgentChart key={`c${i}`} json={JSON.stringify(c)} />
                        ))}

                        {/* Tables */}
                        {Array.isArray(data.tables) && data.tables.map((t, i) => (
                            <ReportTable key={`t${i}`} spec={t} />
                        ))}

                        <div style={{ textAlign: 'center', color: MUTED, fontSize: 11, marginTop: 24 }}>
                            Generado por el Agente Integra Gym · Puede cometer errores, verifica cifras importantes
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function WaReportPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: BG, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>}>
            <ReportContent />
        </Suspense>
    );
}
