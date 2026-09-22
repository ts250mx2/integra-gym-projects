'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, UploadCloud } from 'lucide-react';

type RowAction = 'update' | 'create' | 'skip' | 'error';

interface PlannedRow {
    line: number;
    action: RowAction;
    message: string;
    idSocio: number | null;
    codigo: string | null;
    nombre: string | null;
}

interface Summary {
    total: number;
    updates: number;
    creates: number;
    skipped: number;
    errors: number;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface ImportResponse {
    mode: 'preview' | 'apply';
    branchId: number;
    branchName: string;
    schema: string;
    truncated: boolean;
    maxRows: number;
    summary: Summary;
    rows: PlannedRow[];
    moreRows?: number;
    result?: { updated: number; created: number; skipped: number; errors: number };
}

const ACTION_COLORS: Record<RowAction, string> = {
    create: 'var(--neon-green)',
    update: 'var(--neon-blue)',
    skip: '#9aa7ad',
    error: '#ff6b81'
};

export default function MembersImportPage() {
    const t = useTranslations('MembersImport');

    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportResponse | null>(null);
    const [applied, setApplied] = useState<ImportResponse | null>(null);
    const [busy, setBusy] = useState<'' | 'preview' | 'apply'>('');
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/branches', { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (!Array.isArray(data)) return;
                setBranches(data);
                setBranchId((current) => current || String(data[0]?.IdSucursal || ''));
            })
            .catch((err) => {
                if (err.name !== 'AbortError') console.error('Branches fetch error:', err);
            });
        return () => controller.abort();
    }, []);

    const resetResults = () => {
        setPreview(null);
        setApplied(null);
        setError('');
    };

    // El detalle trae la causa real (por ejemplo, un problema de conexion con la BD del gimnasio).
    const showError = (data: { error?: string; detail?: string }) => {
        setError([data.error || t('errorGeneric'), data.detail].filter(Boolean).join(' — '));
    };

    // Se baja por fetch para poder mostrar el error aqui en vez de dejar un JSON en otra pestana.
    const downloadTemplate = async () => {
        setError('');
        try {
            const res = await fetch(templateUrl);
            if (!res.ok) {
                showError(await res.json().catch(() => ({})));
                return;
            }
            const url = URL.createObjectURL(await res.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = 'plantilla-socios.xlsx';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errorGeneric'));
        }
    };

    const send = async (mode: 'preview' | 'apply') => {
        if (!file) {
            setError(t('noFile'));
            return;
        }
        setBusy(mode);
        setError('');
        try {
            const body = new FormData();
            body.append('file', file);
            body.append('mode', mode);
            if (branchId) body.append('branchId', branchId);

            const res = await fetch('/api/members/import', { method: 'POST', body });
            const data = await res.json();

            if (!res.ok) {
                showError(data);
                return;
            }
            if (mode === 'preview') {
                setPreview(data);
                setApplied(null);
            } else {
                setApplied(data);
                setPreview(null);
                setFile(null);
                if (fileRef.current) fileRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errorGeneric'));
        } finally {
            setBusy('');
        }
    };

    const templateUrl = `/api/members/template${branchId ? `?branchId=${branchId}` : ''}`;
    const canApply = Boolean(preview && (preview.summary.updates > 0 || preview.summary.creates > 0));

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <UploadCloud size={32} />
                        {t('title')}
                    </h1>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.35rem' }}>{t('subtitle')}</p>
                </div>
                <button onClick={downloadTemplate} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={18} />
                    {t('downloadTemplate')}
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ minWidth: '220px' }}>
                        <label className="label-text">{t('branch')}</label>
                        <select
                            className="input-field"
                            value={branchId}
                            onChange={(e) => { setBranchId(e.target.value); resetResults(); }}
                        >
                            {branches.map((branch) => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>{branch.Sucursal}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ minWidth: '260px', flex: 1 }}>
                        <label className="label-text">{t('fileLabel')}</label>
                        <input
                            ref={fileRef}
                            className="input-field"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => { setFile(e.target.files?.[0] || null); resetResults(); }}
                        />
                    </div>
                    <button
                        onClick={() => send('preview')}
                        className="btn-secondary"
                        disabled={!file || busy !== ''}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !file || busy ? 0.6 : 1 }}
                    >
                        <FileSpreadsheet size={18} />
                        {busy === 'preview' ? t('reviewing') : t('review')}
                    </button>
                    <button
                        onClick={() => send('apply')}
                        className="btn-primary"
                        disabled={!canApply || busy !== ''}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !canApply || busy ? 0.6 : 1 }}
                    >
                        <Upload size={18} />
                        {busy === 'apply' ? t('importing') : t('importNow')}
                    </button>
                </div>

                <ul style={{ margin: '1.25rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem', opacity: 0.7, lineHeight: 1.8 }}>
                    <li>{t('rule1')}</li>
                    <li>{t('rule2')}</li>
                    <li>{t('rule3')}</li>
                    <li>{t('rule4')}</li>
                </ul>
            </div>

            {error && (
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', color: '#ff6b81', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {applied?.result && (
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--neon-green)' }}>
                    <CheckCircle2 size={20} />
                    <span>
                        {t('resultDone', {
                            created: applied.result.created,
                            updated: applied.result.updated,
                            branch: applied.branchName
                        })}
                    </span>
                </div>
            )}

            {(preview || applied) && (
                <ReportBlock data={(preview || applied) as ImportResponse} />
            )}
        </div>
    );
}

function ReportBlock({ data }: { data: ImportResponse }) {
    const t = useTranslations('MembersImport');
    const { summary, rows, moreRows } = data;
    const actionLabels: Record<RowAction, string> = {
        create: t('action_create'),
        update: t('action_update'),
        skip: t('action_skip'),
        error: t('action_error')
    };
    const cards = [
        { label: t('cardCreates'), value: summary.creates, color: 'var(--neon-green)' },
        { label: t('cardUpdates'), value: summary.updates, color: 'var(--neon-blue)' },
        { label: t('cardSkipped'), value: summary.skipped, color: '#9aa7ad' },
        { label: t('cardErrors'), value: summary.errors, color: '#ff6b81' }
    ];

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {cards.map((card) => (
                    <div key={card.label} className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.35rem' }}>{card.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {data.truncated && (
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', color: 'var(--neon-blue)' }}>
                    {t('truncated', { max: data.maxRows })}
                </div>
            )}

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem', opacity: 0.75 }}>
                    {data.mode === 'preview' ? t('previewTitle', { branch: data.branchName }) : t('pendingTitle')}
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <tr>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colLine')}</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colAction')}</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colMember')}</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colName')}</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('colDetail')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noRows')}</td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.line} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <td style={{ padding: '0.7rem 1rem', opacity: 0.6 }}>{row.line}</td>
                                        <td style={{ padding: '0.7rem 1rem', color: ACTION_COLORS[row.action], fontWeight: 600 }}>
                                            {actionLabels[row.action]}
                                        </td>
                                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>
                                            {row.idSocio ?? '-'}{row.codigo ? ` / ${row.codigo}` : ''}
                                        </td>
                                        <td style={{ padding: '0.7rem 1rem' }}>{row.nombre || '-'}</td>
                                        <td style={{ padding: '0.7rem 1rem', opacity: 0.75 }}>{row.message || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {Boolean(moreRows) && (
                    <div style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', opacity: 0.6 }}>
                        {t('moreRows', { count: moreRows as number })}
                    </div>
                )}
            </div>
        </>
    );
}
