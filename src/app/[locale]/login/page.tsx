'use client';

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/navigation';
import { useSearchParams } from 'next/navigation';
import packageJson from '../../../../package.json';

function LoginForm() {
    const t = useTranslations('Auth');
    const router = useRouter();
    const searchParams = useSearchParams();
    const isDebug = searchParams.get('Debug') === '1';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [debugResult, setDebugResult] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setDebugResult(null);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            setDebugResult(data);

            if (data.success) {
                router.push('/dashboard');
                router.refresh();
            } else {
                setError(t(data.error || 'serverError'));
            }
        } catch (err) {
            setDebugResult({ error: err instanceof Error ? err.message : String(err) });
            setError(t('serverError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }} className="neon-text-blue">{t('login')}</h2>

            {error && (
                <div style={{ color: '#ff4d4d', textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                    <label>{t('email')}</label>
                    <input
                        type="email"
                        className="input-field"
                        placeholder="email@gym.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label>{t('password')}</label>
                    <input
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                    {loading ? '...' : t('login')}
                </button>
            </form>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/register" className="nav-link">{t('register')}</Link>
                <Link href="/" className="nav-link" style={{ opacity: 0.7 }}>{t('goBack')}</Link>
            </div>

            {isDebug && (
                <div style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    background: '#000',
                    color: '#0f0',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #333'
                }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>DEBUG CONSOLE</strong>
                    <div>Email: {email}</div>
                    <div style={{ marginTop: '0.5rem', color: '#aaa' }}>API Response:</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {debugResult ? JSON.stringify(debugResult, null, 2) : 'Waiting for submit...'}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative' }}>
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm />
            </Suspense>
            <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                fontSize: '0.8rem',
                opacity: 0.4,
                color: '#fff',
                fontFamily: 'monospace'
            }}>
                IntegraMembers v.{packageJson.version}
            </div>
        </div>
    );
}
