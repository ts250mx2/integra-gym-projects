'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    CreditCard,
    Plus,
    Edit2,
    Trash2,
    X,
    Save
} from 'lucide-react';

export default function PaymentMethodsPage() {
    const t = useTranslations('Config'); // Assuming Config namespace for general terms or create new if needed. Using fallbacks.
    const ct = useTranslations('Common');

    const [methods, setMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentMethod, setCurrentMethod] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/payment-methods');
            const data = await res.json();
            setMethods(data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setCurrentMethod({
            FormaPago: '',
            Comision: 0
        });
        setModalOpen(true);
    };

    const handleEdit = (method: any) => {
        setCurrentMethod({ ...method });
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm(ct('deleteConfirm') || 'Are you sure?')) return;

        try {
            const res = await fetch(`/api/payment-methods?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMethods(methods.filter(m => m.IdFormaPago !== id));
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = currentMethod.IdFormaPago ? 'PUT' : 'POST';
            const res = await fetch('/api/payment-methods', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentMethod)
            });

            if (res.ok) {
                setModalOpen(false);
                fetchMethods();
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CreditCard size={32} />
                    {t('paymentMethods') || 'Formas de Pago'}
                </h1>
                <button onClick={handleAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    {t('add') || 'Agregar'}
                </button>
            </div>

            {loading ? (
                <div className="neon-text">{ct('loading')}</div>
            ) : (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>ID</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('paymentMethod') || 'Forma de Pago'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)' }}>{t('commission') || 'Comisión (%)'}</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>{t('actions') || 'Acciones'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {methods.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>{t('noData') || 'Sin datos'}</td>
                                </tr>
                            ) : (
                                methods.map(m => (
                                    <tr key={m.IdFormaPago} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>{m.IdFormaPago}</td>
                                        <td style={{ padding: '1rem' }}>{m.FormaPago}</td>
                                        <td style={{ padding: '1rem' }}>{m.Comision}%</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => handleEdit(m)} className="btn-icon">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(m.IdFormaPago)} className="btn-icon" style={{ color: '#ff4444' }}>
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
                    <div className="glass-card" style={{ width: '90%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
                        <button onClick={() => setModalOpen(false)} style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem',
                            background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5
                        }}>
                            <X size={24} />
                        </button>

                        <h2 className="neon-text" style={{ marginBottom: '1.5rem' }}>
                            {currentMethod.IdFormaPago ? (t('edit') || 'Editar') : (t('new') || 'Nueva')}
                        </h2>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="label-text">{t('paymentMethod') || 'Forma de Pago'}</label>
                                <input
                                    className="input-field"
                                    value={currentMethod.FormaPago}
                                    onChange={e => setCurrentMethod({ ...currentMethod, FormaPago: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="label-text">{t('commission') || 'Comisión (%)'}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-field"
                                    value={currentMethod.Comision}
                                    onChange={e => setCurrentMethod({ ...currentMethod, Comision: parseFloat(e.target.value) })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="btn-primary"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >
                                    {ct('cancel')}
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    <Save size={18} style={{ marginRight: '0.5rem' }} />
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
                table tr:hover { background: rgba(255,255,255,0.02); }
            `}</style>
        </div>
    );
}
