import { Link } from '@/navigation';
import LocaleSwitcher from './LocaleSwitcher';
import { getTranslations } from 'next-intl/server';

export default async function Header() {
    const t = await getTranslations('Index');

    return (
        <header style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 2rem',
            background: 'rgba(10, 10, 10, 0.8)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.JPG" alt="Integra Members Logo" style={{ height: '80px', width: 'auto', borderRadius: '5px' }} />

            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Link href="/login" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                    {t('enter')}
                </Link>
                <LocaleSwitcher />
            </div>
        </header>
    );
}
