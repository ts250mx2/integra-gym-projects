'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    X, Save, Trash2, Plus, Phone, Loader2, PlayCircle, Send, UserPlus, ChevronRight,
    Bell, DollarSign, Clock, Users, DoorOpen, CalendarClock,
    CalendarX, UserX, UserMinus, TrendingUp, Receipt, Ban, BellRing,
    Sparkles, Lightbulb, type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
    Bell, DollarSign, Clock, Users, DoorOpen, CalendarClock,
    CalendarX, UserX, UserMinus, TrendingUp, Receipt, Ban, BellRing,
    Sparkles, Lightbulb,
};

interface CatalogAlert {
    IdAlerta: number;
    Clave: string;
    Tipo: string;
    Titulo: string;
    Descripcion: string | null;
    Icono: string;
}
interface AccessPhone { IdProyectoTelefono: number; Telefono: string; Nombre: string | null; }
interface Recipient { IdProyectoAlertaTelefono: number; IdAlerta: number; Telefono: string; Nombre: string | null; }

interface Props {
    project: { IdProyecto: number; Proyecto: string };
    onClose: () => void;
}

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

export default function ProjectAlertsModal({ project, onClose }: Props) {
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<CatalogAlert[]>([]);
    const [enabled, setEnabled] = useState<number[]>([]);
    const [schedules, setSchedules] = useState<Record<number, string | null>>({});
    const [accessPhones, setAccessPhones] = useState<AccessPhone[]>([]);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const [busyAlerta, setBusyAlerta] = useState<number | null>(null);
    const [newPhone, setNewPhone] = useState({ Telefono: '', Nombre: '' });
    const [savingPhone, setSavingPhone] = useState(false);

    const [previewingId, setPreviewingId] = useState<number | null>(null);
    const [preview, setPreview] = useState<{ titulo: string; tipo: string; resumen: string; detalle: string } | null>(null);
    const [sendingPhoneId, setSendingPhoneId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/projects/alerts?idProyecto=${project.IdProyecto}`);
            const data = await res.json();
            if (res.ok) {
                setCatalog(data.catalog || []);
                setEnabled(data.enabled || []);
                setSchedules(data.schedules || {});
                setAccessPhones(data.accessPhones || []);
                setRecipients(data.recipients || []);
            } else {
                alert(data.details || data.error || 'Error al cargar las alertas del proyecto');
            }
        } catch (e) {
            console.error('Error fetching project alerts:', e);
        } finally {
            setLoading(false);
        }
    }, [project.IdProyecto]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleAlerta = async (alerta: CatalogAlert) => {
        const isOn = enabled.includes(alerta.IdAlerta);
        setBusyAlerta(alerta.IdAlerta);
        setEnabled((prev) => isOn ? prev.filter((id) => id !== alerta.IdAlerta) : [...prev, alerta.IdAlerta]);
        // Al activar una alerta NUEVA, su hora arranca en 22:30 (default).
        if (!isOn) {
            setSchedules((prev) => prev[alerta.IdAlerta] === undefined ? { ...prev, [alerta.IdAlerta]: '22:30' } : prev);
        }
        try {
            const res = await fetch('/api/admin/projects/alerts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdProyecto: project.IdProyecto, IdAlerta: alerta.IdAlerta, Activa: isOn ? 0 : 1 }),
            });
            if (!res.ok) {
                setEnabled((prev) => isOn ? [...prev, alerta.IdAlerta] : prev.filter((id) => id !== alerta.IdAlerta));
                alert('No se pudo actualizar la alerta');
            }
        } catch {
            setEnabled((prev) => isOn ? [...prev, alerta.IdAlerta] : prev.filter((id) => id !== alerta.IdAlerta));
        } finally {
            setBusyAlerta(null);
        }
    };

    const addRecipient = async (telefono: string, nombre: string | null) => {
        if (!selectedId || !telefono.trim()) return;
        setSavingPhone(true);
        try {
            const res = await fetch('/api/admin/projects/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdProyecto: project.IdProyecto, IdAlerta: selectedId, Telefono: telefono.trim(), Nombre: (nombre || '').trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setNewPhone({ Telefono: '', Nombre: '' });
                fetchData();
            } else {
                alert(data.details || data.error || 'No se pudo agregar el teléfono');
            }
        } catch (e) {
            console.error('Error adding recipient:', e);
        } finally {
            setSavingPhone(false);
        }
    };

    const setSchedule = async (idAlerta: number, hora: string | null) => {
        setSchedules((prev) => ({ ...prev, [idAlerta]: hora }));
        try {
            const res = await fetch('/api/admin/projects/alerts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdProyecto: project.IdProyecto, IdAlerta: idAlerta, HoraEnvio: hora || '' }),
            });
            if (!res.ok) { alert('No se pudo guardar la hora de envío'); fetchData(); }
        } catch {
            fetchData();
        }
    };

    const removeRecipient = async (id: number) => {
        try {
            const res = await fetch(`/api/admin/projects/alerts?phoneId=${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
        } catch (e) {
            console.error('Error removing recipient:', e);
        }
    };

    const handlePreview = async (alerta: CatalogAlert) => {
        setPreviewingId(alerta.IdAlerta);
        setPreview(null);
        try {
            const res = await fetch('/api/admin/projects/alerts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idProyecto: project.IdProyecto, idAlerta: alerta.IdAlerta }),
            });
            const data = await res.json();
            if (res.ok) setPreview({ titulo: data.titulo, tipo: data.tipo, resumen: data.resumen, detalle: data.detalle });
            else alert(data.details || data.error || 'No se pudo generar la vista previa');
        } catch {
            alert('Error de conexión al generar la vista previa');
        } finally {
            setPreviewingId(null);
        }
    };

    // "Probar envío" por número: genera la alerta y la envía SOLO a ese teléfono.
    const handleSendToNumber = async (alerta: CatalogAlert, recipient: Recipient) => {
        if (!confirm(`Se enviará "${alerta.Titulo}" a ${recipient.Telefono} AHORA. ¿Continuar?`)) return;
        setSendingPhoneId(recipient.IdProyectoAlertaTelefono);
        try {
            const res = await fetch('/api/admin/projects/alerts/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idProyecto: project.IdProyecto, idAlerta: alerta.IdAlerta, to: recipient.Telefono }),
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ Enviado a ${recipient.Telefono}`);
            } else {
                alert(`No se pudo enviar a ${recipient.Telefono}:\n${data.details || data.error || 'error desconocido'}`);
            }
        } catch {
            alert('Error de conexión al enviar');
        } finally {
            setSendingPhoneId(null);
        }
    };

    const enabledCount = enabled.length;
    const selectedAlert = catalog.find((a) => a.IdAlerta === selectedId) || null;
    const selectedRecipients = recipients.filter((r) => r.IdAlerta === selectedId);
    const assignedDigits = new Set(selectedRecipients.map((r) => onlyDigits(r.Telefono)));
    const availableAccess = accessPhones.filter((p) => !assignedDigits.has(onlyDigits(p.Telefono)));
    const recipientCount = (idAlerta: number) => recipients.filter((r) => r.IdAlerta === idAlerta).length;

    const labelStyle: React.CSSProperties = { display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '1rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '920px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="icon-container" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.6rem', borderRadius: '10px' }}>
                            <BellRing size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Alertas: {project.Proyecto}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Activa cada alerta y define a qué números se envía</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <Loader2 size={28} className="animate-spin" /> Cargando alertas...
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.25rem', alignItems: 'start' }}>
                        {/* Izquierda: lista de alertas */}
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--neon-blue)', marginBottom: '0.5rem' }}>
                                Alertas <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({enabledCount} activas)</span>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '56vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                {catalog.map((a) => {
                                    const Icon = ICON_MAP[a.Icono] || Bell;
                                    const isOn = enabled.includes(a.IdAlerta);
                                    const isAi = a.Tipo === 'ai';
                                    const isSel = selectedId === a.IdAlerta;
                                    const recN = recipientCount(a.IdAlerta);
                                    return (
                                        <div
                                            key={a.IdAlerta}
                                            onClick={() => setSelectedId(a.IdAlerta)}
                                            className="glass-card"
                                            style={{
                                                padding: '0.6rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: '10px', cursor: 'pointer',
                                                background: isSel ? 'rgba(0, 243, 255, 0.07)' : 'rgba(255,255,255,0.02)',
                                                border: isSel ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                                                opacity: busyAlerta === a.IdAlerta ? 0.6 : 1,
                                            }}
                                        >
                                            <Icon size={17} style={{ color: isAi ? 'var(--neon-pink, #ff4dde)' : 'var(--neon-blue)', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.Titulo}</span>
                                                    {isAi && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--neon-pink, #ff4dde)', border: '1px solid currentColor', borderRadius: '4px', padding: '0 0.2rem', flexShrink: 0 }}>IA</span>}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <span style={{ color: recN > 0 ? 'var(--neon-green)' : 'var(--text-secondary)' }}>{recN > 0 ? `${recN} número(s)` : 'sin destinatarios'}</span>
                                                    {schedules[a.IdAlerta] && (
                                                        <span style={{ color: 'var(--neon-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <Clock size={11} />{schedules[a.IdAlerta]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Toggle activar */}
                                            <label onClick={(e) => e.stopPropagation()} className="switch" style={{ position: 'relative', display: 'inline-block', width: '38px', height: '21px', cursor: 'pointer', flexShrink: 0 }}>
                                                <input type="checkbox" checked={isOn} onChange={() => toggleAlerta(a)} style={{ opacity: 0, width: 0, height: 0 }} />
                                                <span style={{ position: 'absolute', inset: 0, backgroundColor: isOn ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: isOn ? '1px solid var(--neon-green)' : '1px solid var(--glass-border)', borderRadius: '21px', transition: '0.3s' }}>
                                                    <span style={{ position: 'absolute', height: '13px', width: '13px', left: isOn ? '20px' : '4px', bottom: '3px', backgroundColor: isOn ? 'var(--neon-green)' : 'var(--light-gray)', borderRadius: '50%', transition: '0.3s' }} />
                                                </span>
                                            </label>
                                            <ChevronRight size={15} style={{ color: isSel ? 'var(--neon-blue)' : 'var(--text-secondary)', flexShrink: 0 }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Derecha: destinatarios de la alerta seleccionada */}
                        <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '1.25rem', minHeight: '56vh' }}>
                            {!selectedAlert ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '3rem' }}>
                                    <Phone size={28} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                                    <p>Selecciona una alerta a la izquierda para asignar sus teléfonos y probarla.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{selectedAlert.Titulo}</h3>
                                        {!enabled.includes(selectedAlert.IdAlerta) && (
                                            <p style={{ fontSize: '0.72rem', color: '#ffb700', marginTop: '0.2rem' }}>Inactiva para este proyecto. Actívala (interruptor) para que se envíe.</p>
                                        )}
                                    </div>

                                    {/* Vista previa (sin enviar) */}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button type="button" onClick={() => handlePreview(selectedAlert)} disabled={previewingId !== null} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', padding: '0.4rem 0.7rem', borderRadius: '6px' }}>
                                            {previewingId === selectedAlert.IdAlerta ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Vista previa
                                        </button>
                                    </div>

                                    {/* Hora de envío diario */}
                                    <div className="glass-card" style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        <Clock size={15} style={{ color: 'var(--neon-blue)', flexShrink: 0 }} />
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hora de envío</label>
                                        <input
                                            type="time"
                                            className="input-field"
                                            style={{ marginTop: 0, height: '32px', width: 'auto', fontSize: '0.8rem' }}
                                            value={schedules[selectedAlert.IdAlerta] || ''}
                                            onChange={(e) => setSchedule(selectedAlert.IdAlerta, e.target.value || null)}
                                        />
                                        {schedules[selectedAlert.IdAlerta] && (
                                            <button type="button" onClick={() => setSchedule(selectedAlert.IdAlerta, null)} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', borderRadius: '6px' }}>Quitar</button>
                                        )}
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', flexBasis: '100%' }}>
                                            Diario, hora local (Monterrey). Sin hora, la alerta solo se envía manualmente.
                                        </span>
                                    </div>

                                    {/* Destinatarios asignados */}
                                    <div>
                                        <label style={labelStyle}>Números asignados ({selectedRecipients.length})</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            {selectedRecipients.length === 0 ? (
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Aún no hay números. Agrégalos abajo.</p>
                                            ) : selectedRecipients.map((r) => (
                                                <div key={r.IdProyectoAlertaTelefono} className="glass-card" style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', background: 'rgba(57, 255, 20, 0.04)' }}>
                                                    <Phone size={13} style={{ color: 'var(--neon-green)', flexShrink: 0 }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{r.Telefono}</span>
                                                        {r.Nombre && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>· {r.Nombre}</span>}
                                                    </div>
                                                    <button onClick={() => handleSendToNumber(selectedAlert, r)} disabled={sendingPhoneId !== null} className="btn-action-blue" title="Probar envío a este número" style={{ padding: '0.25rem', borderRadius: '5px' }}>
                                                        {sendingPhoneId === r.IdProyectoAlertaTelefono ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                    </button>
                                                    <button onClick={() => removeRecipient(r.IdProyectoAlertaTelefono)} className="btn-action-red" title="Quitar" style={{ padding: '0.25rem', borderRadius: '5px' }}><Trash2 size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Elegir de teléfonos con acceso */}
                                    <div>
                                        <label style={labelStyle}>Teléfonos con acceso del proyecto</label>
                                        {availableAccess.length === 0 ? (
                                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                                {accessPhones.length === 0 ? 'Este proyecto no tiene teléfonos con acceso registrados.' : 'Todos los teléfonos con acceso ya están asignados.'}
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                {availableAccess.map((p) => (
                                                    <button key={p.IdProyectoTelefono} type="button" onClick={() => addRecipient(p.Telefono, p.Nombre)} disabled={savingPhone} title="Asignar a esta alerta"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '0.25rem 0.6rem', color: 'var(--foreground)', fontSize: '0.75rem' }}>
                                                        <Plus size={12} style={{ color: 'var(--neon-blue)' }} />
                                                        <span style={{ fontFamily: 'monospace' }}>{p.Telefono}</span>
                                                        {p.Nombre && <span style={{ color: 'var(--text-secondary)' }}>· {p.Nombre}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Agregar nuevo número */}
                                    <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                                        <label style={labelStyle}><UserPlus size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--neon-blue)' }} />Agregar número nuevo</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <input className="input-field" style={{ marginTop: 0, height: '34px', fontSize: '0.8rem', flex: '1 1 150px' }} value={newPhone.Telefono} onChange={(e) => setNewPhone({ ...newPhone, Telefono: e.target.value })} placeholder="+52 55 1234 5678" />
                                            <input className="input-field" style={{ marginTop: 0, height: '34px', fontSize: '0.8rem', flex: '1 1 120px' }} value={newPhone.Nombre} onChange={(e) => setNewPhone({ ...newPhone, Nombre: e.target.value })} placeholder="Nombre (opcional)" />
                                            <button type="button" onClick={() => addRecipient(newPhone.Telefono, newPhone.Nombre)} disabled={savingPhone || !newPhone.Telefono.trim()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: '34px', fontSize: '0.78rem', borderRadius: '6px', padding: '0 0.8rem' }}>
                                                {savingPhone ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Agregar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <button type="button" className="btn-primary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Save size={18} /> Listo</button>
                </div>
            </div>

            {/* Vista previa (overlay) */}
            {preview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: '1rem' }} onClick={() => setPreview(null)}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <PlayCircle size={16} style={{ color: 'var(--neon-blue)' }} /> Vista previa
                                {preview.tipo === 'ai' && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--neon-pink, #ff4dde)', border: '1px solid currentColor', borderRadius: '4px', padding: '0 0.25rem' }}>IA</span>}
                            </h3>
                            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        {/* Lo que llega a WhatsApp: TODO en una sola línea */}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>Mensaje de WhatsApp (una línea)</div>
                        <div style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)', borderRadius: '12px', padding: '0.9rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            <strong>{preview.titulo}:</strong> {preview.resumen} <span style={{ color: 'var(--neon-blue)', opacity: 0.8 }}>🔗 (liga al enviar)</span>
                        </div>
                        {/* Lo que abre la liga */}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.8rem 0 0.3rem', fontWeight: 600 }}>Detalle (lo que abre la liga)</div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.9rem', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.5, maxHeight: '40vh', overflowY: 'auto' }}>
                            {preview.detalle}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>Vista previa. No se ha enviado ningún mensaje.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
