'use client';

import { useState, useEffect } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';

interface Props {
    session: any;
    children: React.ReactNode;
}

export default function DashboardShell({ session, children }: Props) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [logo, setLogo] = useState<string | null>(null);
    const [theme, setTheme] = useState<'neon' | 'light'>('neon');

    useEffect(() => {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('dashboard-theme') as 'neon' | 'light';
        if (savedTheme) {
            setTheme(savedTheme);
        }

        // Initial fetch of logo
        fetch('/api/gym-config')
            .then(res => res.json())
            .then(data => {
                if (data.logo) setLogo(data.logo);
            })
            .catch(console.error);

        // Listen for logo updates from GymConfigPage
        const handleLogoUpdate = (e: any) => {
            setLogo(e.detail);
        };

        const handleThemeUpdate = (e: any) => {
            setTheme(e.detail);
            localStorage.setItem('dashboard-theme', e.detail);
        };

        window.addEventListener('gym-logo-updated', handleLogoUpdate);
        window.addEventListener('dashboard-theme-updated', handleThemeUpdate);

        return () => {
            window.removeEventListener('gym-logo-updated', handleLogoUpdate);
            window.removeEventListener('dashboard-theme-updated', handleThemeUpdate);
        };
    }, []);

    return (
        <div className={theme === 'light' ? 'light-theme' : ''} style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
            <DashboardHeader
                gymName={session.gymName}
                userName={session.userName}
                branchName={session.branchName}
                position={session.position}
                isAdmin={session.isAdmin}
                logo={logo}
                currentTheme={theme}
                onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <div style={{ display: 'flex' }}>
                <DashboardSidebar isCollapsed={isSidebarCollapsed} />
                <main style={{
                    flex: 1,
                    overflowY: 'auto',
                    transition: 'all 0.3s ease',
                    padding: '2rem',
                    minHeight: 'calc(100vh - 58px)'
                }}>
                    <div style={{
                        maxWidth: '1200px',
                        margin: '0 auto',
                        width: '100%'
                    }}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
