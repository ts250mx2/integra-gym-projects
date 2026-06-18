'use client';

import { useState, useEffect } from 'react';
import {
    Plus, Edit2, Trash2, Save, X, Search, BellRing,
    Bell, DollarSign, Clock, Users, DoorOpen, CalendarClock,
    CalendarX, UserX, UserMinus, TrendingUp, Receipt, Ban,
    Sparkles, Lightbulb,
    type LucideIcon
} from 'lucide-react';

// Íconos disponibles (campo Icono de tblAlertas)
const ICON_MAP: Record<string, LucideIcon> = {
    Bell, DollarSign, Clock, Users, DoorOpen, CalendarClock,
    CalendarX, UserX, UserMinus, TrendingUp, Receipt, Ban, BellRing,
    Sparkles, Lightbulb,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

interface Alert {
    IdAlerta: number;
    Clave: string;
    Tipo: string;
    Titulo: string;
    Descripcion: string | null;
    Icono: string;
    ConsultaSQL: string;
    Prompt: string | null;
    Formato: string;
    Direccion: string;
    UmbralExito: number | null;
    UmbralAdvertencia: number | null;
    EstatusNeutro: string;
    MensajeExito: string | null;
    MensajeAdvertencia: string | null;
    MensajePeligro: string | null;
    Orden: number;
    Activa: number;
}

type FormState = {
    IdAlerta: number | null;
    Clave: string;
    Tipo: string;
    Titulo: string;
    Descripcion: string;
    Icono: string;
    ConsultaSQL: string;
    Prompt: string;
    Formato: string;
    Direccion: string;
    UmbralExito: string;
    UmbralAdvertencia: string;
    EstatusNeutro: string;
    MensajeExito: string;
    MensajeAdvertencia: string;
    MensajePeligro: string;
    Orden: number;
    Activa: number;
};

const EMPTY_FORM: FormState = {
    IdAlerta: null,
    Clave: '',
    Tipo: 'sql',
    Titulo: '',
    Descripcion: '',
    Icono: 'Bell',
    ConsultaSQL: 'SELECT COUNT(*) AS valor FROM tblSocios WHERE Status = 0',
    Prompt: '',
    Formato: 'number',
    Direccion: 'neutro',
    UmbralExito: '',
    UmbralAdvertencia: '',
    EstatusNeutro: 'info',
    MensajeExito: '',
    MensajeAdvertencia: '',
    MensajePeligro: '',
    Orden: 0,
    Activa: 1,
};

const ESTATUS_COLORS: Record<string, string> = {
    success: 'var(--neon-green)',
    warning: '#ffb700',
    danger: '#ff4d4d',
    info: 'var(--neon-blue)',
};

export default function AdminAlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/alerts');
            const data = await res.json();
            if (Array.isArray(data)) {
                setAlerts(data);
            } else if (data?.details) {
                alert(data.details);
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (a: Alert) => {
        setForm({
            IdAlerta: a.IdAlerta,
            Clave: a.Clave,
            Tipo: a.Tipo || 'sql',
            Titulo: a.Titulo,
            Descripcion: a.Descripcion || '',
            Icono: a.Icono || 'Bell',
            ConsultaSQL: a.ConsultaSQL || '',
            Prompt: a.Prompt || '',
            Formato: a.Formato || 'number',
            Direccion: a.Direccion || 'neutro',
            UmbralExito: a.UmbralExito === null ? '' : String(a.UmbralExito),
            UmbralAdvertencia: a.UmbralAdvertencia === null ? '' : String(a.UmbralAdvertencia),
            EstatusNeutro: a.EstatusNeutro || 'info',
            MensajeExito: a.MensajeExito || '',
            MensajeAdvertencia: a.MensajeAdvertencia || '',
            MensajePeligro: a.MensajePeligro || '',
            Orden: a.Orden || 0,
            Activa: a.Activa,
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setForm(EMPTY_FORM);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = form.IdAlerta ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/alerts', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                await fetchAlerts();
                closeModal();
            } else {
                alert(data.details || data.error || 'Error al guardar la alerta');
            }
        } catch (error) {
            console.error('Error saving alert:', error);
            alert('Error de conexión al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (a: Alert) => {
        if (!confirm(`¿Eliminar la alerta "${a.Titulo}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/admin/alerts?id=${a.IdAlerta}`, { method: 'DELETE' });
            if (res.ok) {
                fetchAlerts();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error('Error deleting alert:', error);
        }
    };

    const toggleActiva = async (a: Alert) => {
        try {
            const res = await fetch('/api/admin/alerts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...a, Activa: a.Activa === 1 ? 0 : 1 }),
            });
            if (res.ok) fetchAlerts();
        } catch (error) {
            console.error('Error toggling alert:', error);
        }
    };

    const filtered = alerts.filter((a) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
            (a.Titulo || '').toLowerCase().includes(q) ||
            (a.Clave || '').toLowerCase().includes(q) ||
            (a.Descripcion || '').toLowerCase().includes(q)
        );
    });

    const thStyle: React.CSSProperties = {
        position: 'sticky', top: 0, backgroundColor: '#161616', zIndex: 10,
        padding: '0.75rem 0.8rem', textAlign: 'left', color: 'var(--text-secondary)',
        fontWeight: 600, borderBottom: '1px solid var(--glass-border)',
        boxShadow: '0 1px 0 0 var(--glass-border)',
    };
    const inputStyle: React.CSSProperties = { marginTop: '0.4rem' };
    const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 };

    const PreviewIcon = ICON_MAP[form.Icono] || Bell;

    return (
        <div style={{ padding: '0.25rem 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-container" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.6rem', borderRadius: '10px' }}>
                        <BellRing size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.35rem', fontWeight: 'bold', lineHeight: '1.2' }}>Alertas</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Catálogo de reglas de negocio evaluadas por proyecto</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1', justifyContent: 'flex-end', maxWidth: '650px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por título, clave o descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field"
                            style={{ marginTop: 0, paddingLeft: '36px', paddingRight: '36px', background: 'rgba(26, 26, 26, 0.6)', borderColor: 'rgba(255, 255, 255, 0.1)', height: '38px', fontSize: '0.85rem', borderRadius: '6px' }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1.25rem', fontSize: '0.85rem', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                        <Plus size={16} /> Nueva Alerta
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', position: 'relative' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ ...thStyle, width: '60px' }}>Orden</th>
                                <th style={{ ...thStyle, width: '50px' }}></th>
                                <th style={thStyle}>Título</th>
                                <th style={thStyle}>Clave</th>
                                <th style={{ ...thStyle, width: '100px' }}>Formato</th>
                                <th style={{ ...thStyle, width: '90px' }}>Dirección</th>
                                <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>Estado</th>
                                <th style={{ ...thStyle, textAlign: 'right', width: '110px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    {alerts.length === 0 ? 'No hay alertas registradas. Crea la primera con "Nueva Alerta".' : 'No se encontraron alertas para tu búsqueda.'}
                                </td></tr>
                            ) : (
                                filtered.map((a) => {
                                    const IconComp = ICON_MAP[a.Icono] || Bell;
                                    return (
                                        <tr key={a.IdAlerta} style={{ borderBottom: '1px solid var(--glass-border)', opacity: a.Activa === 1 ? 1 : 0.45 }}>
                                            <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{a.Orden}</td>
                                            <td style={{ padding: '0.6rem 0.8rem' }}>
                                                <IconComp size={18} style={{ color: 'var(--neon-blue)' }} />
                                            </td>
                                            <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {a.Titulo}
                                                    {a.Tipo === 'ai' && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--neon-pink, #ff4dde)', border: '1px solid currentColor', borderRadius: '4px', padding: '0 0.25rem' }}>IA</span>}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.8rem' }}>
                                                <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{a.Clave}</span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{a.Formato}</td>
                                            <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{a.Direccion}</td>
                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => toggleActiva(a)}
                                                    title={a.Activa === 1 ? 'Activa (clic para desactivar)' : 'Inactiva (clic para activar)'}
                                                    style={{
                                                        cursor: 'pointer', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                                                        background: a.Activa === 1 ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: a.Activa === 1 ? 'var(--neon-green)' : 'var(--light-gray)',
                                                        border: a.Activa === 1 ? '1px solid rgba(57, 255, 20, 0.25)' : '1px solid var(--glass-border)',
                                                    }}
                                                >
                                                    {a.Activa === 1 ? 'ACTIVA' : 'INACTIVA'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => openEdit(a)} className="btn-action-blue" title="Editar"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(a)} className="btn-action-red" title="Eliminar"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {searchQuery.trim()
                        ? <span>Mostrando <strong>{filtered.length}</strong> de <strong>{alerts.length}</strong> alertas</span>
                        : <span>Total: <strong>{alerts.length}</strong> alertas registradas</span>}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{form.IdAlerta ? 'Editar Alerta' : 'Nueva Alerta'}</h2>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Tipo de alerta */}
                            <div>
                                <label style={labelStyle}>Tipo de alerta</label>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                                    {[
                                        { v: 'sql', label: 'SQL (umbrales)', desc: 'Evalúa una consulta y compara con umbrales.' },
                                        { v: 'ai', label: 'IA (generada)', desc: 'Genera un texto con IA a partir de un prompt.' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.v}
                                            type="button"
                                            onClick={() => setForm({ ...form, Tipo: opt.v })}
                                            style={{
                                                flex: 1, textAlign: 'left', cursor: 'pointer', padding: '0.6rem 0.8rem', borderRadius: '8px',
                                                background: form.Tipo === opt.v ? 'rgba(0, 243, 255, 0.08)' : 'rgba(255,255,255,0.02)',
                                                border: form.Tipo === opt.v ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                                                color: form.Tipo === opt.v ? 'var(--neon-blue)' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fila 1: Título / Clave / Orden */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 0.7fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Título *</label>
                                    <input className="input-field" style={inputStyle} value={form.Titulo} onChange={(e) => setForm({ ...form, Titulo: e.target.value })} required placeholder="Ej: Ventas de Hoy" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Clave (única) *</label>
                                    <input className="input-field" style={inputStyle} value={form.Clave} onChange={(e) => setForm({ ...form, Clave: e.target.value.replace(/\s+/g, '_').toLowerCase() })} required placeholder="ej: daily_sales" disabled={!!form.IdAlerta} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Orden</label>
                                    <input type="number" className="input-field" style={inputStyle} value={form.Orden} onChange={(e) => setForm({ ...form, Orden: Number(e.target.value) })} />
                                </div>
                            </div>

                            {/* Descripción */}
                            <div>
                                <label style={labelStyle}>Descripción</label>
                                <input className="input-field" style={inputStyle} value={form.Descripcion} onChange={(e) => setForm({ ...form, Descripcion: e.target.value })} placeholder="Para qué sirve esta alerta..." />
                            </div>

                            {/* Fila 2: Icono / Formato */}
                            <div style={{ display: 'grid', gridTemplateColumns: form.Tipo === 'sql' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Ícono</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                        <span style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                                            <PreviewIcon size={20} style={{ color: 'var(--neon-blue)' }} />
                                        </span>
                                        <select className="input-field" style={{ marginTop: 0, flex: 1 }} value={form.Icono} onChange={(e) => setForm({ ...form, Icono: e.target.value })}>
                                            {ICON_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {form.Tipo === 'sql' && (
                                    <div>
                                        <label style={labelStyle}>Formato del valor</label>
                                        <select className="input-field" style={inputStyle} value={form.Formato} onChange={(e) => setForm({ ...form, Formato: e.target.value })}>
                                            <option value="number">Número</option>
                                            <option value="currency">Moneda ($)</option>
                                            <option value="percent">Porcentaje (%)</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {form.Tipo === 'ai' && (
                                <div>
                                    <label style={labelStyle}>Prompt para la IA *</label>
                                    <textarea
                                        className="input-field"
                                        style={{ ...inputStyle, fontSize: '0.85rem', minHeight: '140px', resize: 'vertical' }}
                                        value={form.Prompt}
                                        onChange={(e) => setForm({ ...form, Prompt: e.target.value })}
                                        required
                                        placeholder="Analiza los datos de HOY del gimnasio y redacta un resumen breve con los hallazgos más importantes..."
                                    />
                                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block', marginTop: '0.25rem' }}>
                                        Instrucción para el agente de IA. Tendrá acceso de solo lectura a la BD del proyecto y generará el texto que se enviará a los destinatarios.
                                    </small>
                                </div>
                            )}

                            {form.Tipo === 'sql' && (
                              <>
                            {/* Consulta SQL */}
                            <div>
                                <label style={labelStyle}>Consulta SQL *</label>
                                <textarea
                                    className="input-field"
                                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem', minHeight: '90px', resize: 'vertical' }}
                                    value={form.ConsultaSQL}
                                    onChange={(e) => setForm({ ...form, ConsultaSQL: e.target.value })}
                                    placeholder="SELECT COUNT(*) AS valor FROM tblSocios WHERE ..."
                                />
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block', marginTop: '0.25rem' }}>
                                    Solo lectura (SELECT). Debe devolver una columna <code>valor</code> y, opcionalmente, <code>valor2</code>. Se ejecuta contra la BD del proyecto seleccionado.
                                </small>
                            </div>

                            <hr style={{ borderColor: 'var(--glass-border)', margin: '0.25rem 0' }} />

                            {/* Evaluación: Dirección + umbrales */}
                            <div style={{ display: 'grid', gridTemplateColumns: form.Direccion === 'neutro' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Dirección (evaluación)</label>
                                    <select className="input-field" style={inputStyle} value={form.Direccion} onChange={(e) => setForm({ ...form, Direccion: e.target.value })}>
                                        <option value="neutro">Neutro (informativa)</option>
                                        <option value="asc">Ascendente (más es mejor)</option>
                                        <option value="desc">Descendente (menos es mejor)</option>
                                    </select>
                                </div>
                                {form.Direccion === 'neutro' ? (
                                    <div>
                                        <label style={labelStyle}>Estatus a mostrar</label>
                                        <select className="input-field" style={inputStyle} value={form.EstatusNeutro} onChange={(e) => setForm({ ...form, EstatusNeutro: e.target.value })}>
                                            <option value="info">Información (azul)</option>
                                            <option value="success">Éxito (verde)</option>
                                            <option value="warning">Advertencia (ámbar)</option>
                                            <option value="danger">Peligro (rojo)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label style={labelStyle}>Umbral Éxito</label>
                                            <input type="number" step="any" className="input-field" style={inputStyle} value={form.UmbralExito} onChange={(e) => setForm({ ...form, UmbralExito: e.target.value })} placeholder="ej: 1" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Umbral Advertencia</label>
                                            <input type="number" step="any" className="input-field" style={inputStyle} value={form.UmbralAdvertencia} onChange={(e) => setForm({ ...form, UmbralAdvertencia: e.target.value })} placeholder="ej: 0" />
                                        </div>
                                    </>
                                )}
                            </div>

                            {form.Direccion !== 'neutro' && (
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '-0.5rem' }}>
                                    {form.Direccion === 'asc'
                                        ? 'valor ≥ Éxito → verde · valor ≥ Advertencia → ámbar · resto → rojo'
                                        : 'valor ≤ Éxito → verde · valor ≤ Advertencia → ámbar · resto → rojo'}
                                </small>
                            )}

                            {/* Mensajes */}
                            <div>
                                <label style={labelStyle}>
                                    {form.Direccion === 'neutro' ? 'Mensaje' : 'Mensaje Éxito'}
                                    <span style={{ marginLeft: '0.5rem', color: ESTATUS_COLORS[form.Direccion === 'neutro' ? form.EstatusNeutro : 'success'], fontSize: '0.7rem' }}>●</span>
                                </label>
                                <input className="input-field" style={inputStyle} value={form.MensajeExito} onChange={(e) => setForm({ ...form, MensajeExito: e.target.value })} placeholder="Hoy se han registrado {valor} en ventas a través de {valor2} operaciones." />
                            </div>

                            {form.Direccion !== 'neutro' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>Mensaje Advertencia <span style={{ color: '#ffb700', fontSize: '0.7rem' }}>●</span></label>
                                        <input className="input-field" style={inputStyle} value={form.MensajeAdvertencia} onChange={(e) => setForm({ ...form, MensajeAdvertencia: e.target.value })} placeholder="{n} elementos requieren atención." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Mensaje Peligro <span style={{ color: '#ff4d4d', fontSize: '0.7rem' }}>●</span></label>
                                        <input className="input-field" style={inputStyle} value={form.MensajePeligro} onChange={(e) => setForm({ ...form, MensajePeligro: e.target.value })} placeholder="¡Atención! {n} elementos críticos." />
                                    </div>
                                </div>
                            )}

                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '-0.5rem' }}>
                                Placeholders: <code>{'{valor}'}</code> (formateado), <code>{'{n}'}</code> (entero), <code>{'{valor2}'}</code>, <code>{'{valor2f}'}</code> (moneda).
                            </small>
                              </>
                            )}

                            {/* Activa toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '42px', height: '22px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.Activa === 1} onChange={(e) => setForm({ ...form, Activa: e.target.checked ? 1 : 0 })} style={{ opacity: 0, width: 0, height: 0 }} />
                                    <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: form.Activa === 1 ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: form.Activa === 1 ? '1px solid var(--neon-green)' : '1px solid var(--glass-border)', borderRadius: '22px', transition: '0.3s ease' }}>
                                        <span style={{ position: 'absolute', height: '14px', width: '14px', left: form.Activa === 1 ? '22px' : '4px', bottom: '3px', backgroundColor: form.Activa === 1 ? 'var(--neon-green)' : 'var(--light-gray)', borderRadius: '50%', transition: '0.3s ease' }} />
                                    </span>
                                </label>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: form.Activa === 1 ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                                    {form.Activa === 1 ? 'Alerta activa' : 'Alerta inactiva'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn-secondary" onClick={closeModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><X size={18} /> Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
