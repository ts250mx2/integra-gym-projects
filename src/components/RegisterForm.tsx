'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/navigation';
import PhoneInput, { getCountries } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import { languages } from '@/i18n/locales';
import Select, { components, SingleValueProps, OptionProps } from 'react-select';

// Helper to get SVG flag URL using a reliable CDN
const getFlagUrl = (countryCode: string) =>
    `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`;

// Generate country list
const countryCodes = getCountries();
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

const countries = countryCodes.map(code => ({
    value: code,
    label: regionNames.of(code) || code,
    flagUrl: getFlagUrl(code)
})).sort((a, b) => a.label.localeCompare(b.label));

// Custom style for react-select
const selectStyles = {
    control: (base: any) => ({
        ...base,
        background: 'rgba(26, 26, 26, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: '2px',
        borderRadius: '8px',
        boxShadow: 'none',
        '&:hover': {
            borderColor: 'var(--neon-blue)'
        }
    }),
    menu: (base: any) => ({
        ...base,
        background: '#1a1a1a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        zIndex: 100
    }),
    option: (base: any, state: any) => ({
        ...base,
        background: state.isFocused ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
        color: state.isSelected ? 'var(--neon-blue)' : 'white',
        '&:active': {
            background: 'rgba(0, 243, 255, 0.2)'
        }
    }),
    singleValue: (base: any) => ({
        ...base,
        color: 'white'
    }),
    input: (base: any) => ({
        ...base,
        color: 'white'
    })
};

// Custom components to show flags in the select
const CustomOption = (props: OptionProps<any>) => (
    <components.Option {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
                src={props.data.flagUrl}
                alt={props.data.label}
                style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }}
            />
            {props.data.label}
        </div>
    </components.Option>
);

const CustomSingleValue = (props: SingleValueProps<any>) => (
    <components.SingleValue {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
                src={props.data.flagUrl}
                alt={props.data.label}
                style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }}
            />
            {props.data.label}
        </div>
    </components.SingleValue>
);

export default function RegisterForm() {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const [formData, setFormData] = useState({
        gymName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        userName: '',
        country: 'MX',
        language: locale
    });

    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
                if (data.country_code) {
                    setFormData(prev => ({
                        ...prev,
                        country: data.country_code
                    }));
                }
            })
            .catch(err => console.error('IP detection error:', err));
    }, []);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (value: string | undefined) => {
        setFormData(prev => ({ ...prev, phone: value || '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(t(data.error) || t('registrationError') + (data.error || 'Unknown error'));
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            }
        } catch (err: any) {
            setError(t('registrationError') + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h2 className="neon-text">{t('registrationSuccess')}</h2>
                <p style={{ marginTop: '1rem' }}>{t('login')}...</p>
            </div>
        );
    }

    const languageOptions = languages.map(l => ({ value: l.code, label: l.name }));

    return (
        <div className="glass-card" style={{ width: '100%', maxWidth: '550px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }} className="neon-text">{t('register')}</h2>

            {error && (
                <div style={{
                    background: 'rgba(255, 0, 0, 0.1)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.9rem'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('gymName')}</label>
                    <input
                        type="text"
                        name="gymName"
                        className="input-field"
                        placeholder="Integra Gym"
                        required
                        value={formData.gymName}
                        onChange={handleChange}
                        style={{ marginTop: 0 }}
                    />
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('country')}</label>
                    <Select
                        options={countries}
                        styles={selectStyles}
                        components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
                        value={countries.find(c => c.value === formData.country)}
                        onChange={(opt: any) => handleSelectChange('country', opt?.value || 'MX')}
                        placeholder={t('country')}
                    />
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('language')}</label>
                    <Select
                        options={languageOptions}
                        styles={selectStyles}
                        value={languageOptions.find(l => l.value === formData.language)}
                        onChange={(opt: any) => handleSelectChange('language', opt?.value || 'es')}
                        placeholder={t('language')}
                    />
                </div>

                <hr style={{ gridColumn: 'span 2', border: '0', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

                <div style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('userName')}</label>
                    <input
                        type="text"
                        name="userName"
                        className="input-field"
                        placeholder="John Doe"
                        required
                        value={formData.userName}
                        onChange={handleChange}
                        style={{ marginTop: 0 }}
                    />
                </div>

                <div style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('email')}</label>
                    <input
                        type="email"
                        name="email"
                        className="input-field"
                        placeholder="admin@gym.com"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        style={{ marginTop: 0 }}
                    />
                </div>

                <div style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('phone')}</label>
                    <PhoneInput
                        international
                        flags={flags}
                        defaultCountry={formData.country as any}
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="phone-input-container"
                        placeholder="+1 234 567 8900"
                        countryCallingCodeEditable={false}
                    />
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('password')}</label>
                    <input
                        type="password"
                        name="password"
                        className="input-field"
                        placeholder="••••••••"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        style={{ marginTop: 0 }}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('confirmPassword')}</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        className="input-field"
                        placeholder="••••••••"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        style={{ marginTop: 0 }}
                    />
                </div>

                <div style={{ gridColumn: 'span 2', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--light-gray)' }}>
                    <p>
                        {t('privacyNotice')}{' '}
                        <Link href="/privacy" className="neon-text" style={{ textDecoration: 'underline' }}>
                            {t('privacyLink')}
                        </Link>
                    </p>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ gridColumn: 'span 2', width: '100%', padding: '12px' }}
                    disabled={loading}
                >
                    {loading ? '...' : t('register')}
                </button>
            </form>

            <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Link href="/login" className="nav-link">{t('login')}</Link>
                <span style={{ opacity: 0.3 }}>|</span>
                <Link href="/" className="nav-link" style={{ opacity: 0.7 }}>{t('goBack')}</Link>
            </div>

            <style jsx global>{`
        .phone-input-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .phone-input-container input {
          flex: 1;
          background: rgba(10, 10, 10, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 10px 15px;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .phone-input-container input:focus {
          border-color: var(--neon-accent);
          box-shadow: 0 0 10px rgba(0, 255, 157, 0.2);
        }
        .PhoneInputCountry {
          background: rgba(26, 26, 26, 0.8);
          padding: 8px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
        }
        .PhoneInputCountrySelect {
          color: white !important;
          background: black !important;
          opacity: 0;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          zIndex: 1;
        }
        .PhoneInputCountryIcon {
          width: 24px;
          height: 16px;
          box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
        .PhoneInputCountryIcon--square {
            width: 16px;
        }
        .PhoneInputCountrySelectArrow {
            display: block;
            content: '';
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid rgba(255,255,255,0.5);
            margin-left: 2px;
        }
      `}</style>
        </div>
    );
}
