'use client';

import React from 'react';

interface LoginCaptureProps {
    value: string;
    onChange: (value: string) => void;
    domain: string;
    required?: boolean;
    label?: string;
    placeholder?: string;
}

export default function LoginCapture({
    value,
    onChange,
    domain,
    required = false,
    label = 'Login',
    placeholder = 'user'
}: LoginCaptureProps) {
    return (
        <div>
            {label && <label className="label-text">{label}</label>}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <input
                    className="input-field"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required={required}
                    placeholder={placeholder}
                    style={{
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        flex: 1,
                        marginBottom: 0
                    }}
                />
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: 'none',
                    padding: '0 15px',
                    borderRadius: '0 8px 8px 0',
                    color: 'var(--neon-blue)',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                }}>
                    @{domain}.IM
                </div>
            </div>
        </div>
    );
}
