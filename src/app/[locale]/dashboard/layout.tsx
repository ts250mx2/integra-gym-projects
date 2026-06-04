import { cookies } from 'next/headers';
import { redirect } from '@/navigation';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
        redirect({ href: '/login', locale: 'es' });
        return null;
    }

    let session: any = null;
    try {
        session = JSON.parse(sessionCookie.value);
    } catch (e) {
        console.error('[DashboardLayout] Error parsing session:', e);
        redirect({ href: '/login', locale: 'es' });
        return null;
    }

    return (
        <DashboardShell session={session}>
            {children}
        </DashboardShell>
    );
}
