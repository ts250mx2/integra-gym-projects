import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
        const { userId, projectId } = JSON.parse(sessionCookie.value);
        return NextResponse.json({ userId, projectId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
