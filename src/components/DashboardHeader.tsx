'use client';

import { useState, useEffect } from 'react';
import { LogOut, Menu, Sun, Moon, Globe } from 'lucide-react';
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
}

export default function DashboardHeader({ gymName, userName, branchName, position, isAdmin, logo, currentTheme, onToggleSidebar }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
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
    );
}
