import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { branchId, branchName } = body;

        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'noSession' }, { status: 401 });
        }

        const sessionData = JSON.parse(sessionCookie.value);

        // Update branch info
        sessionData.branchId = branchId;
        sessionData.branchName = branchName;

        cookieStore.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Session update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
