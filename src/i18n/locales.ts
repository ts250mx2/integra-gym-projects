export const languages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt', name: 'Português' },
    { code: 'fr', name: 'Français' },
] as const;

export const locales = languages.map(l => l.code);
export type Locale = (typeof locales)[number];
