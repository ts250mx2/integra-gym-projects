import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { LayoutDashboard } from 'lucide-react';
import DashboardMetricsV1 from '@/components/DashboardMetricsV1';

export default async function DashboardPageV1() {
    const t = await getTranslations('Dashboard');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const session = JSON.parse(sessionCookie?.value || '{}');

    return (
        <div>
            <DashboardMetricsV1
                title={`${t('title')} (V1.0)`}
                welcome={t('welcome', { name: session.userName, gym: session.gymName })}
            />
        </div>
    );
}
