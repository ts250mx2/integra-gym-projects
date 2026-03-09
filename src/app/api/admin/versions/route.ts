import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) return false;
    const session = JSON.parse(sessionCookie.value);

    if (session.isAdmin === 1 || session.isAdmin === 2) {
        return session;
    }
    return false;
}

export async function GET(req: NextRequest) {
    try {
        const session = await verifyAdminSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const versions = await query('SELECT Version FROM tblVersiones WHERE Status = 0 ORDER BY Version', []);
        return NextResponse.json(versions);
    } catch (error: any) {
        console.error('Versions GET API error:', error);
        return NextResponse.json({ error: 'serverError', details: error.message }, { status: 500 });
    }
}
