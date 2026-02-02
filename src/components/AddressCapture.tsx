'use client';

import { useState, useEffect } from 'react';
import Select, { components, SingleValueProps, OptionProps } from 'react-select';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Country, State, City } from 'country-state-city';
import { useTranslations } from 'next-intl';

interface AddressData {
    address1: string;
    address2: string;
    country: string;
    state: string;
    city: string;
    zipCode: string;
    phone: string;
    email: string;
}

interface AddressCaptureProps {
    initialData?: Partial<AddressData>;
    onChange: (data: AddressData) => void;
    readOnly?: boolean;
    disabledFields?: (keyof AddressData)[];
}

// Helper to get SVG flag URL
const getFlagUrl = (countryCode: string) =>
    `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`;

const selectStyles = {
    control: (base: any) => ({
        ...base,
        background: 'var(--input-bg)',
        borderColor: 'var(--glass-border)',
        padding: '2px',
        borderRadius: '8px',
        boxShadow: 'none',
        '&:hover': {
            borderColor: 'var(--neon-blue)'
        }
    }),
    menu: (base: any) => ({
        ...base,
        background: 'var(--sidebar-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        color: 'var(--foreground)',
        zIndex: 100
    }),
    option: (base: any, state: any) => ({
        ...base,
        background: state.isFocused ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
        color: state.isSelected ? 'var(--neon-blue)' : 'var(--foreground)',
        '&:active': {
            background: 'rgba(0, 243, 255, 0.2)'
        }
    }),
    singleValue: (base: any) => ({
        ...base,
        color: 'var(--foreground)'
    }),
    input: (base: any) => ({
        ...base,
        color: 'var(--foreground)'
    }),
    placeholder: (base: any) => ({
        ...base,
        color: 'var(--foreground)',
        opacity: 0.5
    })
};

const CustomCountryOption = (props: OptionProps<any>) => (
    <components.Option {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
                src={getFlagUrl(props.data.value)}
                alt={props.data.label}
                style={{ width: '20px', height: '14px', borderRadius: '2px' }}
            />
            {props.data.label}
        </div>
    </components.Option>
);

const CustomCountrySingleValue = (props: SingleValueProps<any>) => (
    <components.SingleValue {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
                src={getFlagUrl(props.data.value)}
                alt={props.data.label}
                style={{ width: '20px', height: '14px', borderRadius: '2px' }}
            />
            {props.data.label}
        </div>
    </components.SingleValue>
);

export default function AddressCapture({ initialData, onChange, readOnly = false, disabledFields = [] }: AddressCaptureProps) {
    const t = useTranslations('Common');
    const [data, setData] = useState<AddressData>({
        address1: '',
        address2: '',
        country: '',
        state: '',
        city: '',
        zipCode: '',
        phone: '',
        email: '',
        ...initialData
    });

    const [loading, setLoading] = useState(!initialData || Object.keys(initialData).length === 0);

    useEffect(() => {
        if (!initialData || Object.keys(initialData).length === 0) {
            fetch('/api/project-defaults')
                .then(res => res.json())
                .then(defaults => {
                    if (!defaults.error) {
                        const newData = { ...data, ...defaults };
                        setData(newData);
                        onChange(newData);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching project defaults:', err);
                    setLoading(false);
                });
        }
    }, []);

    const handleChange = (field: keyof AddressData, value: string) => {
        const newData = { ...data, [field]: value };

        // Reset state and city if country changes
        if (field === 'country') {
            newData.state = '';
            newData.city = '';
        }
        // Reset city if state changes
        if (field === 'state') {
            newData.city = '';
        }

        setData(newData);
        onChange(newData);
    };

    const countries = Country.getAllCountries().map(c => ({
        value: c.isoCode,
        label: c.name
    }));

    const states = data.country ? State.getStatesOfCountry(data.country).map(s => ({
        value: s.isoCode,
        label: s.name
    })) : [];

    const cities = (data.country && data.state) ? City.getCitiesOfState(data.country, data.state).map(c => ({
        value: c.name,
        label: c.name
    })) : [];

    if (loading) return <div className="neon-text">{t('loading')}</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <label className="label-text">{t('phone')}</label>
                    <PhoneInput
                        international
                        country={data.country as any}
                        defaultCountry={data.country as any}
                        value={data.phone}
                        onChange={(val) => handleChange('phone', val || '')}
                        readOnly={readOnly}
                        disabled={readOnly || disabledFields.includes('phone')}
                        countrySelectProps={{ disabled: readOnly || disabledFields.includes('country') }}
                        className="phone-input-container"
                        placeholder="..."
                    />
                </div>

                <div>
                    <label className="label-text">{t('email')}</label>
                    <input
                        type="email"
                        className="input-field"
                        value={data.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        readOnly={readOnly}
                        placeholder="ejemplo@gym.com"
                    />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label className="label-text">{t('address1')}</label>
                    <input
                        className="input-field"
                        value={data.address1}
                        onChange={(e) => handleChange('address1', e.target.value)}
                        readOnly={readOnly}
                        placeholder="..."
                    />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label className="label-text">{t('address2')}</label>
                    <input
                        className="input-field"
                        value={data.address2}
                        onChange={(e) => handleChange('address2', e.target.value)}
                        readOnly={readOnly}
                        placeholder="..."
                    />
                </div>

                <div>
                    <label className="label-text">{t('country')}</label>
                    <Select
                        options={countries}
                        styles={selectStyles}
                        components={{ Option: CustomCountryOption, SingleValue: CustomCountrySingleValue }}
                        value={countries.find(c => c.value === data.country)}
                        onChange={(opt: any) => handleChange('country', opt?.value || '')}
                        isDisabled={readOnly || disabledFields.includes('country')}
                        placeholder={t('country')}
                    />
                </div>

                <div>
                    <label className="label-text">{t('state')}</label>
                    <Select
                        options={states}
                        styles={selectStyles}
                        value={states.find(s => s.value === data.state) || (data.state ? { value: data.state, label: data.state } : null)}
                        onChange={(opt: any) => handleChange('state', opt?.value || '')}
                        isDisabled={readOnly || !data.country || disabledFields.includes('state')}
                        placeholder={t('state')}
                    />
                </div>

                <div>
                    <label className="label-text">{t('city')}</label>
                    <Select
                        options={cities}
                        styles={selectStyles}
                        value={cities.find(c => c.value === data.city) || (data.city ? { value: data.city, label: data.city } : null)}
                        onChange={(opt: any) => handleChange('city', opt?.value || '')}
                        isDisabled={readOnly || !data.state || disabledFields.includes('city')}
                        placeholder={t('city')}
                    />
                </div>

                <div>
                    <label className="label-text">{t('zipCode')}</label>
                    <input
                        className="input-field"
                        value={data.zipCode}
                        onChange={(e) => handleChange('zipCode', e.target.value)}
                        readOnly={readOnly}
                        placeholder="00000"
                    />
                </div>


            </div>

            <style jsx global>{`
                .phone-input-container {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .phone-input-container input {
                    flex: 1;
                    background: var(--input-bg);
                    border: 1px solid var(--glass-border);
                    color: var(--foreground);
                    padding: 10px 15px;
                    border-radius: 8px;
                    outline: none;
                    transition: border-color 0.3s ease;
                }
                .phone-input-container input:focus {
                    border-color: var(--neon-accent);
                }
            `}</style>
        </div>
    );
}
