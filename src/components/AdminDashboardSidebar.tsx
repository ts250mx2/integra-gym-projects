'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
    Settings,
    ChevronDown,
    ChevronRight,
    Users,
    Building2,
    LayoutDashboard
} from 'lucide-react';
import packageJson from '../../package.json';

interface SidebarSectionProps {
    title: string;
    icon: React.ReactNode;
    isCollapsed: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const SidebarSection = ({ title, icon, isCollapsed, isOpen, onToggle, children }: SidebarSectionProps) => {
    return (
        <div style={{ marginBottom: '1rem' }}>
            <button
                onClick={onToggle}
                className="sidebar-section-btn"
                style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--neon-blue)' }}>
                    {icon}
                    {!isCollapsed && <span style={{ fontWeight: '600' }}>{title}</span>}
                </div>
                {!isCollapsed && (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
            </button>
            {isOpen && !isCollapsed && (
                <div style={{
                    marginTop: '0.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    paddingLeft: '1rem'
                }}>
                    {children}
                </div>
            )}
        </div>
    );
};

interface Props {
    isCollapsed: boolean;
}

export default function AdminDashboardSidebar({ isCollapsed }: Props) {
    const t = useTranslations('Sidebar');
    const [configOpen, setConfigOpen] = useState(true);

    const menuItems = [
        {
            section: 'config',
            icon: <Settings size={20} />,
            isOpen: configOpen,
            setIsOpen: setConfigOpen,
            items: [
                { href: '/admin/dashboard/config/projects', icon: <Building2 size={18} />, label: t('projects') || 'Proyectos' },
                { href: '/admin/dashboard/config/users', icon: <Users size={18} />, label: t('users') || 'Usuarios' },
            ]
        }
    ];

    return (
        <aside style={{
            width: isCollapsed ? '80px' : '260px',
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--glass-border)',
            padding: isCollapsed ? '1.5rem 0.5rem' : '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease',
            minHeight: 'calc(100vh - 58px)',
            overflowX: 'hidden'
        }}>
            <Link href="/admin/dashboard" className="sidebar-link" style={{ marginBottom: '1rem' }}>
                <LayoutDashboard size={20} />
                {!isCollapsed && <span style={{ fontWeight: '600' }}>Administración</span>}
            </Link>

            {menuItems.map((section: any, idx) => (
                <SidebarSection
                    key={idx}
                    title={t(section.section as any) || 'Configuración'}
                    icon={section.icon}
                    isCollapsed={isCollapsed}
                    isOpen={section.isOpen}
                    onToggle={() => section.setIsOpen(!section.isOpen)}
                >
                    {section.items.map((item: any, i: number) => (
                        <Link key={i} href={item.href} className="sidebar-link">
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </SidebarSection>
            ))}

            <div style={{
                marginTop: 'auto',
                paddingTop: '1rem',
                textAlign: 'center',
                fontSize: '0.7rem',
                opacity: 0.3,
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
            }}>
                {!isCollapsed && <span>IntegraAdmin v.{packageJson.version}</span>}
            </div>
        </aside>
    );
}
