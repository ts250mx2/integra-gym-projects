import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales } from './i18n/locales';

const intlMiddleware = createMiddleware({
    locales,
    defaultLocale: 'es',
    localePrefix: 'always'
});

const DASHBOARD_RE = /^\/(es|en|pt|fr)\/dashboard(-v1)?(\/|$)/;

export default function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const projectUuid = url.searchParams.get('projectUuid');

    if (projectUuid && DASHBOARD_RE.test(url.pathname)) {
        const bootstrapUrl = new URL('/api/auth/project-session', req.url);
        bootstrapUrl.searchParams.set('projectUuid', projectUuid);
        bootstrapUrl.searchParams.set('returnTo', url.pathname);
        return NextResponse.redirect(bootstrapUrl);
    }

    return intlMiddleware(req);
}

export const config = {
    matcher: ['/', '/(es|en|pt|fr)/:path*', '/recorrido', '/recorrido/:path*']
};
