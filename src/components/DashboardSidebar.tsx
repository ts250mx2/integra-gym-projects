'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
    Settings,
    ScanFace,
    ShoppingCart,
    ChevronDown,
    ChevronRight,
    Users,
    Package,
    UserCheck,
    CreditCard,
    Clock,
    LayoutDashboard,
    Building2,
    Tag,
    Dumbbell,
    CalendarClock
} from 'lucide-react';

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

export default function DashboardSidebar({ isCollapsed }: Props) {
    const t = useTranslations('Sidebar');
    const [configOpen, setConfigOpen] = useState(true);
    const [salesOpen, setSalesOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const menuItems = [
        {
            section: 'config',
            icon: <Settings size={20} />,
            isOpen: configOpen,
            setIsOpen: setConfigOpen,
            items: [
                { href: '/dashboard/config/gym', icon: <Dumbbell size={18} />, label: t('gym') },
                { href: '/dashboard/config/branches', icon: <Building2 size={18} />, label: t('branches') },
                { href: '/dashboard/config/users', icon: <Users size={18} />, label: t('users') },
                { href: '/dashboard/config/positions', icon: <UserCheck size={18} />, label: t('positions') },
                { href: '/dashboard/config/schedule-groups', icon: <CalendarClock size={18} />, label: t('scheduleGroups') },
                { href: '/dashboard/config/fees', icon: <Tag size={18} />, label: t('fees') },
                { href: '/dashboard/config/products', icon: <Package size={18} />, label: t('products') },
                { href: '/dashboard/config/payment-methods', icon: <CreditCard size={18} />, label: t('paymentMethods') || 'Formas de Pago' },
                { href: '/dashboard/config/readers', icon: <ScanFace size={18} />, label: t('readers') || 'Lectores' },
            ]
        },
        {
            section: 'sales',
            icon: <ShoppingCart size={20} />,
            isOpen: salesOpen,
            setIsOpen: setSalesOpen,
            items: [
                { href: '/dashboard/sales/members', icon: <UserCheck size={18} />, label: t('members') },
                { href: '/dashboard/sales', icon: <CreditCard size={18} />, label: t('pos') },
                { href: '/dashboard/sales/visits', icon: <Clock size={18} />, label: t('visits') },
            ]
        }
    ];

    const filteredSections = menuItems.map(section => {
        const sectionTitle = t(section.section as any);
        const matchesSection = sectionTitle.toLowerCase().includes(searchTerm.toLowerCase());

        const filteredItems = section.items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (searchTerm && (matchesSection || filteredItems.length > 0)) {
            return { ...section, items: matchesSection ? section.items : filteredItems, forceOpen: true };
        }

        if (!searchTerm) return section;

        return null; // Don't show if no match
    }).filter(Boolean);


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
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                {!isCollapsed ? (
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder={t('search') || "Buscar..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.5rem 0.5rem 2rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '0.875rem'
                            }}
                        />
                        <div style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => { /* Optionally expand sidebar if clicked */ }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                )}
            </div>

            <Link href="/dashboard" className="sidebar-link" style={{ marginBottom: '1rem' }}>
                <LayoutDashboard size={20} />
                {!isCollapsed && <span style={{ fontWeight: '600' }}>{t('home')}</span>}
            </Link>

            {filteredSections.map((section: any, idx) => (
                <SidebarSection
                    key={idx}
                    title={t(section.section as any)}
                    icon={section.icon}
                    isCollapsed={isCollapsed}
                    isOpen={section.forceOpen || section.isOpen}
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
        </aside>
    );
}
