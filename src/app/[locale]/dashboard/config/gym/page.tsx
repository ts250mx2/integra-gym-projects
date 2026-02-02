'use client';

import { useState, useEffect, useRef } from 'react';
import AddressCapture from '@/components/AddressCapture';
import { useTranslations } from 'next-intl';
import { Save, User, MapPin, Settings as SettingsIcon, Upload, ImageIcon, Dumbbell } from 'lucide-react';

type TabType = 'general' | 'address' | 'user';

export default function GymConfigPage() {
    const t = useTranslations('Common');
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gymData, setGymData] = useState<any>(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/gym-config')
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setGymData(data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch('/api/gym-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gymData),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: t('successMessage') });
            } else {
                setMessage({ type: 'error', text: t('errorMessage') });
            }
        } catch (err) {
            setMessage({ type: 'error', text: t('networkError') });
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const updatedData = { ...gymData, logo: base64 };
                setGymData(updatedData);

                // Auto-save logo
                try {
                    const response = await fetch('/api/gym-config', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData),
                    });

                    if (response.ok) {
                        // Dispatch event to update Header
                        window.dispatchEvent(new CustomEvent('gym-logo-updated', { detail: base64 }));
                        setMessage({ type: 'success', text: t('successMessage') });
                    }
                } catch (err) {
                    console.error('Auto-save error:', err);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    if (loading) return <div className="p-8 neon-text">{t('loading')}</div>;

    const TabButton = ({ id, label, icon: Icon }: { id: TabType, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === id ? 'var(--neon-blue)' : 'var(--foreground)',
                opacity: activeTab === id ? 1 : 0.6,
                borderBottom: `2px solid ${activeTab === id ? 'var(--neon-blue)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontWeight: activeTab === id ? '600' : '400',
                fontSize: '0.95rem'
            }}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div>
            <h1 className="neon-text" style={{
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
            }}>
                <Dumbbell size={32} />
                {t('gymSettings')}
            </h1>

            {message.text && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    background: message.type === 'success' ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                    border: `1px solid ${message.type === 'success' ? '#00ff9d' : '#ff4444'}`,
                    color: message.type === 'success' ? '#00ff9d' : '#ff4444',
                    maxWidth: '800px'
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', maxWidth: '800px' }}>
                <TabButton id="general" label={t('tabGeneral')} icon={SettingsIcon} />
                <TabButton id="address" label={t('tabAddress')} icon={MapPin} />
                <TabButton id="user" label={t('tabAdminUser')} icon={User} />
            </div>

            <div className="glass-card" style={{ maxWidth: '800px', minHeight: '400px' }}>
                <form onSubmit={handleSave}>
                    {activeTab === 'general' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                            {/* Logo Section */}
                            <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        width: '180px',
                                        height: '180px',
                                        borderRadius: '12px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '2px dashed rgba(0, 243, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}
                                >
                                    {gymData?.logo ? (
                                        <img src={gymData.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                            <ImageIcon size={40} style={{ marginBottom: '0.5rem' }} />
                                            <div style={{ fontSize: '0.8rem' }}>{t('uploadLogo')}</div>
                                        </div>
                                    )}
                                    <div className="hover-overlay" style={{
                                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                        background: 'rgba(0, 243, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: 0, transition: 'opacity 0.3s ease'
                                    }}>
                                        <Upload size={24} color="var(--neon-blue)" />
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* Info Section */}
                            <div style={{ flex: '2', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label className="label-text">{t('gymName')}</label>
                                    <input
                                        className="input-field"
                                        value={gymData?.gymName || ''}
                                        onChange={(e) => setGymData({ ...gymData, gymName: e.target.value })}
                                        placeholder="..."
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label-text">{t('domain')}</label>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        height: '42px' // Match standard input height
                                    }}>
                                        <input
                                            className="input-field"
                                            value={gymData?.domain || ''}
                                            onChange={(e) => setGymData({ ...gymData, domain: e.target.value })}
                                            placeholder="ej: mi-gym"
                                            style={{
                                                borderTopRightRadius: 0,
                                                borderBottomRightRadius: 0,
                                                flex: 1,
                                                height: '100%',
                                                marginBottom: 0
                                            }}
                                        />
                                        <div style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderLeft: 'none',
                                            padding: '0 15px',
                                            borderRadius: '0 8px 8px 0',
                                            color: 'var(--neon-blue)',
                                            fontWeight: '700',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            textShadow: '0 0 10px rgba(0, 243, 255, 0.3)'
                                        }}>
                                            .IM
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="label-text">{t('rfc')}</label>
                                    <input
                                        className="input-field"
                                        value={gymData?.rfc || ''}
                                        onChange={(e) => setGymData({ ...gymData, rfc: e.target.value })}
                                        placeholder="RFC / Tax ID"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <AddressCapture
                            initialData={{
                                address1: gymData?.address1,
                                address2: gymData?.address2,
                                country: gymData?.country,
                                state: gymData?.state,
                                city: gymData?.city,
                                zipCode: gymData?.zipCode,
                                phone: gymData?.gymPhone,
                                email: gymData?.gymEmail
                            }}
                            onChange={(data) => setGymData({
                                ...gymData,
                                address1: data.address1,
                                address2: data.address2,
                                country: data.country,
                                state: data.state,
                                city: data.city,
                                zipCode: data.zipCode,
                                gymPhone: data.phone,
                                gymEmail: data.email
                            })}
                        />
                    )}

                    {activeTab === 'user' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="label-text">{t('userName')}</label>
                                <input
                                    className="input-field"
                                    value={gymData?.adminUser?.username || ''}
                                    onChange={(e) => setGymData({
                                        ...gymData,
                                        adminUser: { ...gymData.adminUser, username: e.target.value }
                                    })}
                                    placeholder="..."
                                />
                            </div>
                            <div>
                                <label className="label-text">{t('email')}</label>
                                <input
                                    className="input-field"
                                    value={gymData?.adminUser?.email || ''}
                                    disabled
                                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                />
                            </div>
                            <div>
                                <label className="label-text">{t('phone')}</label>
                                <input
                                    className="input-field"
                                    value={gymData?.adminUser?.phone || ''}
                                    onChange={(e) => setGymData({
                                        ...gymData,
                                        adminUser: { ...gymData.adminUser, phone: e.target.value }
                                    })}
                                    placeholder="..."
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px', justifyContent: 'center' }}
                        >
                            <Save size={18} />
                            {saving ? t('saving') : t('saveChanges')}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .tab-btn:hover {
                    color: white !important;
                    background: rgba(255, 255, 255, 0.05);
                }
                img {
                    max-width: 100%;
                    max-height: 100%;
                }
                div[onClick]:hover .hover-overlay {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
}
