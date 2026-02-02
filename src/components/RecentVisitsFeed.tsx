
'use client';

import { useState, useEffect } from 'react';
import { User, Clock, Calendar, Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Visit {
    CodigoSocio: string;
    Socio: string;
    FechaVencimiento: string;
    EsEmpleado: number;
    FechaVisita: string;
    ArchivoFoto: string | null;
    DiasVence: number;
}

interface RecentVisitsFeedProps {
    gymName?: string;
    gymLogo?: string | null;
}

export default function RecentVisitsFeed({ gymName, gymLogo }: RecentVisitsFeedProps) {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const t = useTranslations('Dashboard');

    useEffect(() => {
        const fetchVisits = async () => {
            try {
                const res = await fetch('/api/dashboard/recent-visits');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setVisits(data);
                    }
                }
            } catch (error) {
                console.error("Error polling visits:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVisits(); // Initial fetch
        const interval = setInterval(fetchVisits, 3000); // Poll every 3s

        return () => clearInterval(interval);
    }, []);

    if (loading && visits.length === 0) {
        return <div className="text-center opacity-50 p-4">Loading visits...</div>;
    }

    return (
        <div style={isExpanded ? {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: 'var(--background-dark, #000)', // Ensure background is solid
            padding: '2rem',
            overflowY: 'auto'
        } : { marginTop: '2rem' }}>
            {isExpanded && (
                <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                    {/* Logo */}
                    {gymLogo && (
                        <div style={{ width: '150px', height: '150px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)' }}>
                            <img src={gymLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <h2 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', opacity: 0.9, margin: 0 }}>
                            {gymName || 'Gimnasio'}
                        </h2>
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="neon-text-blue" style={isExpanded ? { display: 'none' } : {}}>{t('dailyVisits')} (Live)</h3>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="btn-icon"
                    title={isExpanded ? "Minimize" : "Maximize"}
                    style={{ color: 'var(--neon-blue)' }}
                >
                    {isExpanded ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                </button>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gridAutoRows: '140px', // Fixed row height for consistency
                gap: '1rem'
            }}>
                {visits.map((visit, index) => {
                    const isEmployee = visit.EsEmpleado === 1;
                    const isMostRecent = index === 0;

                    // Logic for card styling
                    // Employee -> Yellow/Gold styling
                    // Member -> Standard Glass/Blue styling

                    const cardStyle = isEmployee ? {
                        background: 'rgba(255, 215, 0, 0.15)', // Gold tint
                        border: '1px solid rgba(255, 215, 0, 0.4)',
                        boxShadow: '0 0 10px rgba(255, 215, 0, 0.1)'
                    } : {
                        // Inherit standard glass card, but explicit here if needed or let className handle it
                    };

                    const borderColor = isEmployee ? '#FFD700' : 'var(--neon-blue)';
                    const textColor = isEmployee ? '#FFD700' : '#fff';

                    // Dynamic sizing based on Expanded state for the Hero card
                    const heroSpanCols = isExpanded ? 'span 4' : 'span 2';
                    const heroSpanRows = isExpanded ? 'span 4' : 'span 2';
                    const heroImgSize = isExpanded ? '300px' : '120px';
                    const heroNameSize = isExpanded ? '3.5rem' : '1.8rem';
                    const heroCodeSize = isExpanded ? '2rem' : '1rem';
                    const heroIconSize = isExpanded ? 40 : 24;
                    const heroDirection = 'column'; // Keep column for both for better centering in the square-ish area
                    const heroJustify = 'center';

                    return (
                        <div key={`${visit.CodigoSocio}-${index}`} className="glass-card" style={{
                            ...cardStyle,
                            display: 'flex',
                            flexDirection: isMostRecent ? heroDirection : 'row',
                            alignItems: 'center',
                            justifyContent: isMostRecent ? heroJustify : 'flex-start',
                            gap: isMostRecent ? (isExpanded ? '2rem' : '1rem') : '1rem',
                            padding: '1rem',
                            transition: 'all 0.3s ease',
                            gridColumn: isMostRecent ? heroSpanCols : 'auto',
                            gridRow: isMostRecent ? heroSpanRows : 'auto',
                        }}>
                            {/* Photo */}
                            <div style={{
                                width: isMostRecent ? heroImgSize : '80px',
                                height: isMostRecent ? heroImgSize : '80px',
                                borderRadius: '50%',
                                border: `2px solid ${borderColor}`,
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: '#000'
                            }}>
                                {visit.ArchivoFoto ? (
                                    <img src={visit.ArchivoFoto} alt={visit.Socio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={isMostRecent ? (isExpanded ? 120 : 50) : 40} color={borderColor} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: isMostRecent ? 'center' : 'flex-start', gap: isMostRecent ? (isExpanded ? '1rem' : '0.5rem') : '0' }}>
                                <div style={{ fontSize: isMostRecent ? heroCodeSize : '0.8rem', opacity: 0.7, color: textColor }}>{visit.CodigoSocio}</div>
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: isMostRecent ? heroNameSize : '1.1rem',
                                    marginBottom: '0.25rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    textAlign: isMostRecent ? 'center' : 'left',
                                    maxWidth: '100%'
                                }}>
                                    {visit.Socio}
                                </div>
                                <div style={{ fontSize: isMostRecent ? heroCodeSize : '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9 }}>
                                    {isEmployee ? (
                                        <>
                                            <Clock size={isMostRecent ? heroIconSize : 14} color="#FFD700" />
                                            <span style={{ color: '#FFD700' }}>
                                                {new Date(visit.FechaVisita).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Calendar size={isMostRecent ? heroIconSize : 14} />
                                            <span style={{
                                                color: visit.DiasVence < 0 ? '#ff4444' : visit.DiasVence < 5 ? '#ffaa00' : '#00ff44'
                                            }}>
                                                Vence: {new Date(visit.FechaVencimiento).toLocaleDateString()}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {visits.length === 0 && <div className="text-center opacity-50 p-4">No recent visits</div>}
        </div>
    );
}
