import { cookies } from 'next/headers';
import { redirect } from '@/navigation';
import DashboardShellV1 from '@/components/DashboardShellV1';

export default async function DashboardLayoutV1({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    console.log('[DashboardLayoutV1] Session Cookie present:', !!sessionCookie);
    if (!sessionCookie?.value) {
        console.log('[DashboardLayoutV1] No session found, redirecting to login');
        redirect({ href: '/login', locale: 'es' });
        return null;
    }

    let session: any = null;
    try {
        session = JSON.parse(sessionCookie.value);
        console.log('[DashboardLayoutV1] Session User:', session.userId, 'Project:', session.projectId, 'Version:', session.version);
    } catch (e) {
        console.error('[DashboardLayoutV1] Error parsing session:', e);
        redirect({ href: '/login', locale: 'es' });
        return null;
    }

    // Ensure only v1 logic passes, or just render it
    if (session.version !== '1.0' && session.isAdmin !== 1 && session.isAdmin !== 2) {
        console.log('[DashboardLayoutV1] Version mismatch or not admin, redirecting to standard dashboard');
        redirect({ href: '/dashboard', locale: 'es' });
        return null;
    }

    return (
        <DashboardShellV1 session={session}>
            {children}
        </DashboardShellV1>
    );
}
