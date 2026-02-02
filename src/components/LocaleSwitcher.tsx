'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { ChangeEvent, useTransition } from 'react';

export default function LocaleSwitcher() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
        const nextLocale = event.target.value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    }

    return (
        <div style={{ zIndex: 1001 }}>
            <select
                defaultValue={locale}
                disabled={isPending}
                onChange={onSelectChange}
                className="input-field"
                style={{ width: 'auto', padding: '6px 10px', background: 'rgba(26, 26, 26, 0.8)', cursor: 'pointer', marginTop: 0, fontSize: '0.85rem' }}
            >
                <option value="es">ES</option>
                <option value="en">EN</option>
                <option value="pt">PT</option>
                <option value="fr">FR</option>
            </select>
        </div>
    );
}
