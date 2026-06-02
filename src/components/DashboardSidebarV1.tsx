'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
    LayoutDashboard,
    Brain,
} from 'lucide-react';
import packageJson from '../../package.json';

interface Props {
    isCollapsed: boolean;
}

export default function DashboardSidebarV1({ isCollapsed }: Props) {
    const t = useTranslations('Sidebar');

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
            <Link href="/dashboard-v1" className="sidebar-link" style={{ marginBottom: '0.5rem' }}>
                <LayoutDashboard size={20} />
                {!isCollapsed && <span style={{ fontWeight: '600' }}>{t('home')}</span>}
            </Link>

            <Link href="/dashboard-v1/ai-agent" className="sidebar-link" style={{ marginBottom: '1rem' }}>
                <Brain size={20} />
                {!isCollapsed && <span style={{ fontWeight: '600' }}>{t('aiAgent')}</span>}
            </Link>

            <div style={{
                marginTop: 'auto',
                paddingTop: '1rem',
                textAlign: 'center',
                fontSize: '0.7rem',
                opacity: 0.3,
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
            }}>
                {!isCollapsed && <span>IntegraMembers v.{packageJson.version} (V1)</span>}
            </div>
        </aside>
    );
}
