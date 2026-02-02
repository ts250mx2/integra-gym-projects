import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/locales';

export default createMiddleware({
    // A list of all locales that are supported
    locales,

    // Used when no locale matches
    defaultLocale: 'es',
    localePrefix: 'always'
});

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(es|en|pt|fr)/:path*']
};
