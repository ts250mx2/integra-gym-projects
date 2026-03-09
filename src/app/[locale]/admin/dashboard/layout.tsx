import { cookies } from 'next/headers';
import { redirect } from '@/navigation';
import AdminDashboardShell from '@/components/AdminDashboardShell';

export default async function AdminDashboardLayout({
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

    const session = JSON.parse(sessionCookie.value);

    // Verify if actually an admin
    if (session.isAdmin !== 1 && session.isAdmin !== 2) {
        redirect({ href: '/dashboard', locale: 'es' });
        return null;
    }

    return (
        <AdminDashboardShell session={session}>
            {children}
        </AdminDashboardShell>
    );
}
