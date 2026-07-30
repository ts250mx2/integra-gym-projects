'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PeriodState } from './PeriodFilter';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

export const DEFAULT_PERIOD: PeriodState = { preset: '30d', from: daysAgo(29), to: today() };

interface State<T> {
    data: T | null;
    /** Solo en la primera carga; en refetch se conserva el render anterior. */
    isLoading: boolean;
    /** Hay datos en pantalla pero se esta recargando. */
    isStale: boolean;
    error: string;
}

/**
 * Carga de datos de una pagina de analiticas contra un periodo.
 *
 * En recarga NO limpia los datos: mantiene el render anterior y solo marca
 * isStale, para que las tarjetas y graficas se atenuen en lugar de colapsar a
 * un esqueleto y provocar un salto de layout.
 */
export function useAnalytics<T>(endpoint: string, period: PeriodState) {
    const [state, setState] = useState<State<T>>({ data: null, isLoading: true, isStale: false, error: '' });
    const [reloadToken, setReloadToken] = useState(0);
    const hasDataRef = useRef(false);

    const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setState((prev) => ({
                ...prev,
                isLoading: !hasDataRef.current,
                isStale: hasDataRef.current,
                error: ''
            }));

            try {
                const params = new URLSearchParams({ preset: period.preset });
                if (period.preset === 'custom') {
                    params.set('from', period.from);
                    params.set('to', period.to);
                }

                const res = await fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal });
                const payload = await res.json();

                if (!res.ok) {
                    setState((prev) => ({ ...prev, isLoading: false, isStale: false, error: payload.error || 'No se pudieron cargar los datos.' }));
                    return;
                }

                hasDataRef.current = true;
                setState({ data: payload as T, isLoading: false, isStale: false, error: '' });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                setState((prev) => ({ ...prev, isLoading: false, isStale: false, error: err.message || 'Error de red.' }));
            }
        };

        load();
        return () => controller.abort();
    }, [endpoint, period.preset, period.from, period.to, reloadToken]);

    return { ...state, refresh };
}
