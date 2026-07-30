'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePathname, useRouter } from '@/navigation';
import {
    Sparkles, Trash2, Maximize2, X, Send, Brain, ChevronRight, FileDown, ArrowUpRight,
} from 'lucide-react';
import AgentChart from '@/components/AgentChart';

// ─── Theme tokens (neón, vía CSS vars del dashboard con fallback) ───────────────
const ACCENT = 'var(--neon-blue, #00f3ff)';
const TXT     = 'var(--foreground, #ffffff)';
const MUTED   = 'var(--light-gray, #94a3b8)';
const BORDER  = 'var(--glass-border, rgba(255,255,255,0.1))';
const PANEL_BG = 'var(--background, #0a0a0a)';
const GLASS   = 'var(--glass-bg, rgba(255,255,255,0.05))';

// Botones de navegación que el agente embebe como ```nav {json}```.
export function NavButtons({ json, onNavigate }: { json: string; onNavigate: (path: string) => void }) {
    let items: { label: string; path: string; reason?: string }[] = [];
    try { const p = JSON.parse(json); items = Array.isArray(p.items) ? p.items : []; } catch { return null; }
    if (!items.length) return null;
    return (
        <div className="not-prose" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
            {items.map((it, i) => (
                <button key={i} onClick={() => it.path && onNavigate(it.path)} title={it.reason}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${ACCENT}`, background: 'rgba(0,243,255,0.08)', color: ACCENT,
                    }}>
                    <ArrowUpRight size={13} />
                    {it.label}
                </button>
            ))}
        </div>
    );
}

// Durante el streaming, oculta un bloque cercado (```chart / ```nav) aún sin
// cerrar para no mostrar JSON crudo; el bloque aparece cuando se completa.
function hideIncompleteFence(text: string): string {
    const fences = (text.match(/```/g) || []).length;
    if (fences % 2 === 0) return text;
    const idx = text.lastIndexOf('```');
    return text.slice(0, idx).trimEnd();
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    clarification?: { question: string; suggestions: string[] };
    ts?: number;
}

type ClaudeModel = 'claude-opus-4-8' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';

const CLAUDE_MODELS: { id: ClaudeModel; label: string; badge: string }[] = [
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', badge: '⚡' },
    { id: 'claude-opus-4-8',           label: 'Opus 4.8',   badge: '🧠' },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  badge: '🪶' },
];

const CHAT_STORAGE_KEY = 'integra-gym-agent-chat-v1';

interface AiAgentProps {
    mode?: 'floating' | 'embedded';
    /** Versión del proyecto. En '1.0' se desactiva la navegación a pantallas v2.0. */
    version?: string;
    userId?: number;
    projectId?: number;
}

// ─── Page suggestions ─────────────────────────────────────────────────────────
const PAGE_SUGGESTIONS: Record<string, string[]> = {
    '/dashboard/sales/members': [
        '¿Cuántos socios activos tengo hoy?',
        '¿Cuántos socios vencen esta semana?',
        '¿Cuántas altas nuevas hubo este mes vs el anterior?',
        '¿Qué socios no han venido en los últimos 14 días?',
    ],
    '/dashboard/sales/visits': [
        '¿Cuántas visitas tuvimos hoy?',
        '¿Cuáles son los días y horas pico de asistencia?',
        '¿Cómo va la asistencia este mes vs el anterior?',
    ],
    '/dashboard/sales': [
        '¿Cuánto vendimos hoy?',
        '¿Cuál es mi ticket promedio este mes?',
        '¿Qué forma de pago genera más venta?',
    ],
    '/dashboard/activities': [
        '¿Cuáles son mis clases activas?',
        '¿Qué instructor tiene más clases?',
    ],
    '/dashboard/analytics': [
        '¿Cómo van mis ventas este mes vs el mes pasado?',
        '¿Qué membresía se vende más?',
        '¿Cuál es mi mix de membresías vs productos?',
        '¿Por qué cayó mi venta respecto al mes pasado?',
    ],
    '/dashboard': [
        '¿Cuánto vendimos este mes vs el mes pasado?',
        '¿Cuántos socios activos y cuántos por vencer tengo?',
        '¿Cómo va la asistencia esta semana?',
        '¿Qué membresía es la más vendida este mes?',
    ],
};

function getPageSuggestions(pathname: string): string[] {
    const segments = [
        '/dashboard/sales/members', '/dashboard/sales/visits', '/dashboard/sales',
        '/dashboard/activities', '/dashboard/analytics',
    ];
    for (const seg of segments) {
        if (pathname.includes(seg)) return PAGE_SUGGESTIONS[seg];
    }
    return PAGE_SUGGESTIONS['/dashboard'];
}

// ─── Typing animation ─────────────────────────────────────────────────────────
function TypingIndicator() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
            {[0, 1, 2].map(i => (
                <span key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', backgroundColor: ACCENT,
                    animation: `agentBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
            ))}
        </div>
    );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────
function ChatPanel({
    messages, isLoading, input, setInput, handleSend,
    model, setModel, onClear, onMaximize, onClose,
    mode, suggestions, messagesEndRef,
    streamingText, streamPhase, onNavigate, disableNav,
}: {
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (v: string) => void;
    handleSend: (e: React.FormEvent) => void;
    model: ClaudeModel;
    setModel: (v: ClaudeModel) => void;
    onClear: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
    mode: 'floating' | 'embedded';
    suggestions: string[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    streamingText?: string | null;
    streamPhase?: string | null;
    onNavigate: (path: string) => void;
    disableNav?: boolean;
}) {
    const currentModelInfo = CLAUDE_MODELS.find(m => m.id === model) ?? CLAUDE_MODELS[0];
    const [isInputFocused, setIsInputFocused] = useState(false);

    const mdComponents = useMemo(() => ({
        pre({ children }: any) {
            const child = Array.isArray(children) ? children[0] : children;
            const cls: string = child?.props?.className || '';
            const kids = child?.props?.children;
            const raw = (Array.isArray(kids) ? kids.join('') : String(kids ?? '')).replace(/\n$/, '');
            if (cls.includes('language-chart')) return <AgentChart json={raw} />;
            // En v1.0 (disableNav) no renderizamos botones de navegación a pantallas v2.0.
            if (cls.includes('language-nav')) return disableNav ? null : <NavButtons json={raw} onNavigate={onNavigate} />;
            return <pre>{children}</pre>;
        },
    }), [onNavigate, disableNav]);

    const sendSuggestion = (text: string) => {
        setInput(text);
        setTimeout(() => {
            (document.getElementById('agent-chat-form') as HTMLFormElement)?.requestSubmit();
        }, 0);
    };

    const exportMsg = async (idx: number) => {
        const msg = messages[idx];
        if (!msg || msg.role !== 'assistant' || !msg.content) return;
        const prev = messages[idx - 1];
        const question = prev && prev.role === 'user' ? prev.content : undefined;
        const modelLabel = CLAUDE_MODELS.find(m => m.id === model)?.label;
        try {
            const { generateAnswerPDF } = await import('@/utils/generateAnswerPDF');
            generateAnswerPDF(msg.content, { question, model: modelLabel });
        } catch (err) {
            console.error('No se pudo generar el PDF:', err);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: PANEL_BG, color: TXT }}>

            {/* ── Header ───────────────────────────────────────────────────── */}
            {mode === 'floating' && (
                <div style={{
                    flexShrink: 0, position: 'relative', overflow: 'hidden', color: '#02121a',
                    background: 'linear-gradient(135deg, var(--neon-blue, #00f3ff) 0%, var(--neon-green, #39ff14) 130%)',
                    padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 14, background: 'rgba(2,18,26,0.85)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.25)',
                        }}>
                            <Brain size={22} color="#00f3ff" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, margin: 0, lineHeight: 1 }}>Agente Integra Gym</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0a7a16', display: 'inline-block' }} />
                                <span style={{ fontSize: 10, fontWeight: 800 }}>En línea</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconBtn title="Nueva conversación" onClick={onClear}><Trash2 size={14} /></IconBtn>
                        {onMaximize && <IconBtn title="Pantalla completa" onClick={onMaximize}><Maximize2 size={14} /></IconBtn>}
                        {onClose && <IconBtn title="Cerrar" onClick={onClose}><X size={16} /></IconBtn>}
                    </div>
                </div>
            )}

            {/* ── Messages area ────────────────────────────────────────────── */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20,
                backgroundImage: 'radial-gradient(rgba(0,243,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px',
            }}>
                {/* Empty state */}
                {messages.length === 0 && (
                    <div style={{ paddingTop: 8 }}>
                        <div style={{
                            background: GLASS, border: `1px solid ${BORDER}`, borderRadius: 24, padding: 24,
                            maxWidth: 360, margin: '0 auto 24px', textAlign: 'center',
                        }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: 20, margin: '0 auto 14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,243,255,0.08)', border: `1px solid ${ACCENT}`,
                            }}>
                                <Brain size={30} color="#00f3ff" />
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: TXT, margin: '0 0 8px', letterSpacing: 0.5 }}>
                                ¡Hola! Soy tu Agente del Gimnasio
                            </h3>
                            <p style={{ color: MUTED, fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                                Tu consultor de socios, ventas y asistencia en tiempo real.
                                ¿En qué te ayudo a mejorar hoy?
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440, margin: '0 auto' }}>
                            <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, color: MUTED, padding: '0 8px', margin: '0 0 4px' }}>
                                Sugerencias para esta sección
                            </p>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => sendSuggestion(s)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '13px 16px', borderRadius: 16, background: GLASS, color: TXT,
                                        fontSize: 13.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer',
                                        border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`,
                                    }}>
                                    <span style={{ paddingRight: 8 }}>{s}</span>
                                    <ChevronRight size={14} color={MUTED} style={{ flexShrink: 0 }} />
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                            <Sparkles size={11} color={ACCENT} />
                            <span style={{ fontSize: 10, color: MUTED, fontWeight: 500 }}>
                                Potenciado por Claude AI · {currentModelInfo.label}
                            </span>
                        </div>
                    </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, maxWidth: '90%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                            {msg.role === 'assistant' && <Avatar />}
                            <div style={msg.role === 'user' ? {
                                borderRadius: '18px 18px 4px 18px', padding: '12px 15px', fontSize: 13.5, lineHeight: 1.55,
                                fontWeight: 600, background: 'rgba(0,243,255,0.12)', color: TXT, border: `1px solid ${ACCENT}`,
                            } : {
                                borderRadius: '18px 18px 18px 4px', padding: '12px 15px', fontSize: 13.5, lineHeight: 1.55,
                                background: GLASS, color: TXT, border: `1px solid ${BORDER}`,
                            }}>
                                {msg.role === 'assistant' ? (
                                    <div className="agent-md">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : msg.content}
                            </div>
                        </div>

                        {msg.role === 'assistant' && !msg.clarification && msg.content?.trim() && (
                            <button onClick={() => exportMsg(idx)} title="Exportar a PDF"
                                style={{
                                    marginLeft: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                                    borderRadius: 8, fontSize: 11, fontWeight: 600, color: MUTED, cursor: 'pointer',
                                    background: 'transparent', border: `1px solid ${BORDER}`,
                                }}>
                                <FileDown size={12} /> Exportar PDF
                            </button>
                        )}

                        {msg.role === 'assistant' && msg.clarification?.suggestions && (
                            <div style={{ marginLeft: 38, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {msg.clarification.suggestions.map((s, si) => (
                                    <button key={si} onClick={() => sendSuggestion(s)}
                                        style={{
                                            padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                            border: `1px solid ${ACCENT}`, background: 'rgba(0,243,255,0.08)', color: ACCENT,
                                        }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming bubble */}
                {typeof streamingText === 'string' && streamingText.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, maxWidth: '90%', alignItems: 'flex-start' }}>
                        <Avatar />
                        <div style={{ borderRadius: '18px 18px 18px 4px', padding: '12px 15px', fontSize: 13.5, lineHeight: 1.55, background: GLASS, color: TXT, border: `1px solid ${BORDER}` }}>
                            <div className="agent-md">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                    {hideIncompleteFence(streamingText)}
                                </ReactMarkdown>
                            </div>
                            <span style={{ display: 'inline-block', width: 6, height: 14, marginLeft: 2, verticalAlign: 'middle', borderRadius: 2, background: ACCENT, animation: 'agentPulse 1s infinite' }} />
                        </div>
                    </div>
                )}

                {/* Loading / phase */}
                {isLoading && !(typeof streamingText === 'string' && streamingText.length > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: GLASS, border: `1px solid ${BORDER}`, borderRadius: '18px 18px 18px 4px', padding: '12px 15px' }}>
                            <TypingIndicator />
                            {streamPhase && streamPhase !== 'writing' && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>
                                    {streamPhase === 'querying' ? 'Consultando tus datos…'
                                        : streamPhase === 'analyzing' ? 'Analizando…'
                                        : 'Pensando…'}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input & Controls ─────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, padding: '12px 20px 20px', background: PANEL_BG, borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: MUTED, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                    <span>Modelo de IA:</span>
                    <select value={model} onChange={e => setModel(e.target.value as ClaudeModel)}
                        style={{ fontSize: 10, fontWeight: 700, background: GLASS, border: `1px solid ${BORDER}`, color: TXT, borderRadius: 8, padding: '2px 6px', outline: 'none', cursor: 'pointer' }}>
                        {CLAUDE_MODELS.map(m => (
                            <option key={m.id} value={m.id} style={{ color: '#0f172a', background: '#fff' }}>{m.badge} {m.label}</option>
                        ))}
                    </select>
                </div>

                <form id="agent-chat-form" onSubmit={handleSend} style={{ width: '100%' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, borderRadius: 16, padding: '10px 14px',
                        border: `1px solid ${isInputFocused ? ACCENT : BORDER}`,
                        boxShadow: isInputFocused ? `0 0 0 3px rgba(0,243,255,0.15)` : 'none',
                        background: GLASS, transition: 'all .2s',
                    }}>
                        <Brain size={18} color={isInputFocused ? '#00f3ff' : '#64748b'} />
                        <input type="text" value={input} onChange={e => setInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}
                            placeholder="Pregunta sobre tu gimnasio..." disabled={isLoading}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, color: TXT, minWidth: 0 }} />
                        <button type="submit" disabled={isLoading || !input.trim()}
                            style={{
                                flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: (!isLoading && input.trim()) ? ACCENT : 'rgba(255,255,255,0.08)',
                                color: (!isLoading && input.trim()) ? '#02121a' : '#64748b',
                                opacity: (isLoading || !input.trim()) ? 0.5 : 1,
                            }}>
                            <Send size={14} />
                        </button>
                    </div>
                    <p style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 8 }}>
                        Puede cometer errores · Verifica cifras importantes
                    </p>
                </form>
            </div>

            <style jsx global>{`
                @keyframes agentBounce { 0%,60%,100%{transform:translateY(0);} 30%{transform:translateY(-6px);} }
                @keyframes agentPulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
                .agent-md { font-size: 13.5px; line-height: 1.55; }
                .agent-md p { margin: 6px 0; }
                .agent-md p:first-child { margin-top: 0; }
                .agent-md p:last-child { margin-bottom: 0; }
                .agent-md strong { font-weight: 800; color: var(--foreground, #fff); }
                .agent-md h1,.agent-md h2,.agent-md h3,.agent-md h4 { font-weight: 700; margin: 10px 0 6px; color: var(--neon-blue, #00f3ff); }
                .agent-md h1 { font-size: 16px; } .agent-md h2 { font-size: 15px; } .agent-md h3 { font-size: 14px; }
                .agent-md ul,.agent-md ol { margin: 6px 0; padding-left: 18px; }
                .agent-md li { margin: 3px 0; }
                .agent-md a { color: var(--neon-blue, #00f3ff); text-decoration: underline; }
                .agent-md code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
                .agent-md table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
                .agent-md th { background: rgba(0,243,255,0.1); font-weight: 700; padding: 6px 9px; border: 1px solid var(--glass-border, rgba(255,255,255,0.12)); text-align: left; }
                .agent-md td { padding: 6px 9px; border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); }
            `}</style>
        </div>
    );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
    return (
        <button onClick={onClick} title={title}
            style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'flex' }}>
            {children}
        </button>
    );
}

function Avatar() {
    return (
        <div style={{
            width: 28, height: 28, borderRadius: 10, flexShrink: 0, marginTop: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,243,255,0.1)', border: `1px solid ${BORDER}`,
        }}>
            <Brain size={15} color="#00f3ff" />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AiAgent({ mode = 'floating', version, userId, projectId }: AiAgentProps) {
    const pathname = usePathname();
    const router   = useRouter();
    const isV1     = String(version ?? '') === '1.0';

    const [isOpen,        setIsOpen]        = useState(false);
    const [messages,      setMessages]      = useState<Message[]>([]);
    const [input,         setInput]         = useState('');
    const [isLoading,     setIsLoading]     = useState(false);
    const [model,         setModel]         = useState<ClaudeModel>('claude-sonnet-4-6');
    const [hydrated,      setHydrated]      = useState(false);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const [streamPhase,   setStreamPhase]   = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [activeUserProj, setActiveUserProj] = useState<{ userId: number; projectId: number } | null>(null);
    const loadedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (userId && projectId) {
            setActiveUserProj({ userId, projectId });
        } else {
            fetch('/api/session/current')
                .then(res => res.json())
                .then(data => {
                    if (data.userId && data.projectId) {
                        setActiveUserProj({ userId: data.userId, projectId: data.projectId });
                    }
                })
                .catch(console.error);
        }
    }, [userId, projectId]);

    const storageKey = useMemo(() => {
        if (!activeUserProj) return null;
        return `integra-gym-agent-chat-${activeUserProj.userId}-${activeUserProj.projectId}`;
    }, [activeUserProj]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.messages)) {
                    setMessages(parsed.messages);
                } else {
                    setMessages([]);
                }
                if (CLAUDE_MODELS.some(m => m.id === parsed.model)) {
                    setModel(parsed.model);
                }
            } else {
                setMessages([]);
            }
        } catch {
            setMessages([]);
        }
        loadedKeyRef.current = storageKey;
        setHydrated(true);
    }, [storageKey]);

    useEffect(() => {
        if (!hydrated || !storageKey || loadedKeyRef.current !== storageKey) return;
        try {
            if (messages.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify({ messages, model }));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch { }
    }, [messages, model, hydrated, storageKey]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, streamingText]);

    const suggestions = getPageSuggestions(pathname || '');

    const handleSend = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input, ts: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setStreamPhase('thinking');
        setStreamingText(null);

        let streamed  = '';
        let committed = false;

        try {
            // El projectId lo resuelve el servidor desde la sesión. Pasamos projectUuid
            // del query string como respaldo (acceso al dashboard sin login).
            const projectUuid = typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search).get('projectUuid') || undefined
                : undefined;

            const res = await fetch('/api/ai/chat?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
                    model,
                    context: { currentPage: pathname },
                    projectUuid,
                }),
            });

            if (!res.ok || !res.body) throw new Error('No se pudo conectar con el agente.');

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let stop   = false;

            while (!stop) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
                    if (!dataLine) continue;
                    let evt: any;
                    try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

                    switch (evt.type) {
                        case 'status':
                            setStreamPhase(evt.phase);
                            break;
                        case 'text':
                            streamed += evt.delta;
                            setStreamingText(streamed);
                            break;
                        case 'reset':
                            streamed = '';
                            setStreamingText('');
                            break;
                        case 'clarification':
                            streamed = '';
                            committed = true;
                            setStreamingText(null);
                            setMessages(prev => [...prev, {
                                role: 'assistant', content: evt.question,
                                clarification: { question: evt.question, suggestions: evt.suggestions || [] },
                                ts: Date.now(),
                            }]);
                            break;
                        case 'done':
                            if (!committed) {
                                const finalContent = streamed || evt.content || '';
                                if (finalContent) setMessages(prev => [...prev, { role: 'assistant', content: finalContent, ts: Date.now() }]);
                                committed = true;
                            }
                            setStreamingText(null);
                            if (evt.executedSql) {
                                console.groupCollapsed('🔍 Agente Integra Gym – SQL');
                                console.log(evt.executedSql);
                                console.groupEnd();
                            }
                            stop = true;
                            break;
                        case 'error':
                            committed = true;
                            setStreamingText(null);
                            setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, ocurrió un error: ${evt.message || 'desconocido'}`, ts: Date.now() }]);
                            stop = true;
                            break;
                    }
                }
            }

            if (!committed && streamed) {
                setMessages(prev => [...prev, { role: 'assistant', content: streamed, ts: Date.now() }]);
            }
        } catch (err: any) {
            if (!committed) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, ocurrió un error: ${err.message}`, ts: Date.now() }]);
            }
        } finally {
            setStreamingText(null);
            setStreamPhase(null);
            setIsLoading(false);
        }
    }, [input, isLoading, messages, model, pathname]);

    const handleClear = () => {
        setMessages([]);
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    };

    const handleNavigate = useCallback((path: string) => {
        if (!path?.startsWith('/')) return;
        router.push(path as any);
        setIsOpen(false);
    }, [router]);

    const sharedProps = {
        messages, isLoading, input, setInput, handleSend,
        model, setModel, onClear: handleClear, suggestions, messagesEndRef,
        streamingText, streamPhase, onNavigate: handleNavigate, disableNav: false,
    };

    // ── EMBEDDED ──────────────────────────────────────────────────────────
    if (mode === 'embedded') {
        // Alto = viewport menos el cromo real del dashboard: header 58px,
        // padding 2rem×2 del <main> y el título de la página (~64px).
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 480 }}>
                <div style={{ flex: 1, borderRadius: 18, border: `1px solid ${BORDER}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, background: PANEL_BG }}>
                    <ChatPanel {...sharedProps} mode="embedded" />
                </div>
            </div>
        );
    }

    // ── FLOATING ──────────────────────────────────────────────────────────
    // Si ya estamos en la página (maximizada) del agente, no mostramos el botón
    // flotante: sería redundante con el panel embebido de pantalla completa.
    if (pathname?.includes('/ai-agent')) return null;

    const hasMessages = messages.length > 0;

    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999 }}>
            {!isOpen && (
                <button onClick={() => setIsOpen(true)} title="Agente Integra Gym"
                    style={{
                        position: 'relative', width: 56, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #00f3ff 0%, #39ff14 130%)',
                        boxShadow: '0 12px 30px -8px rgba(0,243,255,0.5)',
                    }}>
                    <Brain size={26} color="#02121a" />
                    {hasMessages && (
                        <span style={{
                            position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%',
                            background: '#39ff14', border: '2px solid #0a0a0a', color: '#02121a', fontSize: 9, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {messages.filter(m => m.role === 'assistant').length > 9 ? '9+' : messages.filter(m => m.role === 'assistant').length || ''}
                        </span>
                    )}
                </button>
            )}

            {isOpen && (
                <div style={{
                    position: 'absolute', bottom: 0, right: 0, width: 400, height: 620, borderRadius: 22, overflow: 'hidden',
                    border: `1px solid ${BORDER}`, boxShadow: '0 32px 64px -12px rgba(0,0,0,0.6)',
                }}>
                    <ChatPanel
                        {...sharedProps}
                        onMaximize={() => {
                            // v1.0 usa su propia página; v2.0 la de analíticas. Nunca cruzar rutas.
                            router.push((isV1 ? '/dashboard-v1/ai-agent' : '/dashboard/analytics/ai-agent') as any);
                            setIsOpen(false);
                        }}
                        onClose={() => setIsOpen(false)}
                        mode="floating"
                    />
                </div>
            )}
        </div>
    );
}
