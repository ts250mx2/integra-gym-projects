'use client';

import { useState, useEffect } from 'react';
import { LogOut, Menu, Sun, Moon, Globe, RotateCcw, Shield } from 'lucide-react';
import { useRouter, usePathname } from '@/navigation';
import { useLocale } from 'next-intl';
import { languages } from '@/i18n/locales';

interface Props {
    gymName: string;
    userName: string;
    branchName?: string;
    position?: string;
    isAdmin?: number;
    logo?: string | null;
    currentTheme: 'neon' | 'light';
    onToggleSidebar: () => void;
    projectId?: number;
    proyectoIntegrados?: number;
}

export default function DashboardHeader({ gymName, userName, branchName, position, isAdmin, logo, currentTheme, onToggleSidebar, projectId, proyectoIntegrados }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    const [branches, setBranches] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    useEffect(() => {
        // Fetch projects for switching
        fetch('/api/session/projects')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProjects(data);
                }
            })
            .catch(console.error);

        if (isAdmin === 2) {
            fetch('/api/branches')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setBranches(data);
                    }
                })
                .catch(console.error);
        }
    }, [isAdmin]);

    const handleSwitchProject = async (projectId: number) => {
        setIsSwitching(true);
        try {
            const res = await fetch('/api/session/switch-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            const data = await res.json();
            if (data.success) {
                // Determine target base path
                const baseTarget = data.version === '1.0' ? 'dashboard-v1' : 'dashboard';

                // Construct absolute locale-prefixed URL to avoid middleware double-redirects
                // which can sometimes interfere with cookie commitment
                window.location.href = `/${locale}/${baseTarget}`;
            }
        } catch (err) {
            console.error('Error switching project:', err);
            setIsSwitching(false);
        }
    };

    const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const branchId = e.target.value;
        const branch = branches.find(b => b.IdSucursal.toString() === branchId);

        if (branch) {
            try {
                await fetch('/api/session/branch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        branchId: branch.IdSucursal,
                        branchName: branch.Sucursal
                    })
                });
                window.location.reload();
            } catch (err) {
                console.error('Failed to switch branch:', err);
            }
        }
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/login');
    };

    const toggleTheme = () => {
        const newTheme = currentTheme === 'neon' ? 'light' : 'neon';
        window.dispatchEvent(new CustomEvent('dashboard-theme-updated', { detail: newTheme }));
    };

    const changeLanguage = (newLocale: string) => {
        if (newLocale === locale) return;
        // Use window.location for an absolute, clean locale switch
        window.location.href = `/${newLocale}${pathname}`;
    };

    return (
        <>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 2rem',
                background: 'var(--sidebar-bg)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid var(--glass-border)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <button
                        onClick={onToggleSidebar}
                        className="header-icon-btn"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="neon-text" style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {logo && (
                            <img
                                src={logo}
                                alt="Logo"
                                style={{ height: '50px', width: 'auto', borderRadius: '4px', objectFit: 'contain' }}
                            />
                        )}
                        {gymName}
                        {(projects.length > 1 || isAdmin === 1 || isAdmin === 2) && proyectoIntegrados !== 1 && (
                            <button
                                onClick={() => setShowProjectModal(true)}
                                className="btn-secondary"
                                style={{
                                    padding: '0.15rem 0.5rem',
                                    fontSize: '0.6rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    height: '24px',
                                    marginLeft: '0.5rem',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <RotateCcw size={12} color="var(--neon-blue)" />
                                <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Cambiar</span>
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.25rem', borderRadius: '8px' }}>
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => changeLanguage(lang.code)}
                                style={{
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: locale === lang.code ? 'var(--neon-blue)' : 'transparent',
                                    color: locale === lang.code ? 'var(--background)' : 'var(--foreground)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {lang.code.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="header-icon-btn"
                        title={currentTheme === 'neon' ? 'Modo Claro' : 'Modo Neón'}
                    >
                        {currentTheme === 'neon' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{userName}</div>
                            {position && <div style={{ fontSize: '0.8rem', color: 'var(--neon-blue)', fontWeight: '500' }}>{position}</div>}
                            {isAdmin === 2 && branches.length > 1 ? (
                                <select
                                    value={branches.find(b => b.Sucursal === branchName)?.IdSucursal || ''}
                                    onChange={handleBranchChange}
                                    style={{
                                        fontSize: '0.75rem',
                                        padding: '2px',
                                        background: 'transparent',
                                        color: 'var(--foreground)',
                                        border: 'none',
                                        outline: 'none',
                                        opacity: 0.8,
                                        cursor: 'pointer',
                                        textAlign: 'right',
                                        direction: 'rtl'
                                    }}
                                >
                                    <option value="" disabled>Seleccionar...</option>
                                    {branches.map(b => (
                                        <option key={b.IdSucursal} value={b.IdSucursal} style={{ color: 'black' }}>
                                            {b.Sucursal}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                branchName && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{branchName}</div>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="logout-btn"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Project Selection Modal moved outside header to avoid stacking context issues */}
            {showProjectModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '500px',
                        width: '100%',
                        padding: '2rem',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        border: '1px solid var(--neon-blue)',
                        color: 'var(--foreground)',
                        boxShadow: '0 0 30px rgba(0, 163, 255, 0.3)'
                    }}>
                        <h2 className="neon-text-blue" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Seleccionar Proyecto</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {projects.map((p) => {
                                const isCurrentProject = projectId ? p.IdProyecto === projectId : p.Proyecto === gymName;
                                return (
                                    <button
                                        key={p.IdProyecto}
                                        onClick={() => handleSwitchProject(p.IdProyecto)}
                                        disabled={isSwitching}
                                        className="btn-secondary"
                                        style={{
                                            padding: '1rem',
                                            textAlign: 'left',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: isCurrentProject ? 'rgba(0, 243, 255, 0.08)' : 'rgba(255,255,255,0.05)',
                                            border: isCurrentProject ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                                            boxShadow: isCurrentProject ? '0 0 15px rgba(0, 243, 255, 0.15)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: isCurrentProject ? 'var(--neon-blue)' : 'var(--foreground)' }}>
                                                    {p.Proyecto}
                                                </div>
                                                {isCurrentProject && (
                                                    <span style={{
                                                        background: 'rgba(0, 243, 255, 0.2)',
                                                        color: 'var(--neon-blue)',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        Activo
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--foreground)', marginTop: '0.2rem' }}>Versión {p.Version}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {(isAdmin === 1 || isAdmin === 2) && (
                            <button
                                onClick={() => {
                                    setIsSwitching(true);
                                    window.location.href = `/${locale}/admin/dashboard`;
                                }}
                                disabled={isSwitching}
                                className="btn-primary"
                                style={{
                                    marginTop: '1.5rem',
                                    width: '100%',
                                    padding: '0.75rem 1.5rem',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    fontSize: '0.85rem',
                                    letterSpacing: '0.05em',
                                    boxShadow: '0 0 15px rgba(0, 229, 255, 0.25)',
                                    border: '1px solid var(--neon-blue)',
                                    borderRadius: '6px'
                                }}
                            >
                                <Shield size={16} />
                                Administración de Proyectos
                            </button>
                        )}
                        <button
                            className="btn-secondary"
                            style={{ marginTop: '1.5rem', width: '100%' }}
                            onClick={() => setShowProjectModal(false)}
                            disabled={isSwitching}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {isSwitching && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.5rem'
                }}>
                    <RotateCcw size={48} className="animate-spin" style={{ color: 'var(--neon-blue)', filter: 'drop-shadow(0 0 8px var(--neon-blue))' }} />
                    <div className="neon-text-blue" style={{ fontSize: '1.25rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                        Cambiando de proyecto...
                    </div>
                </div>
            )}
        </>
    );
}
