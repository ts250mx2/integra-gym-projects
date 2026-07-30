'use client';

import { X } from 'lucide-react';

type Props = {
    title: string;
    subtitle?: string;
    maxWidth?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
};

/** Carcasa de vidrio compartida por los modales de inventario y compras. */
export default function ModalShell({ title, subtitle, maxWidth = '640px', onClose, children, footer }: Props) {
    return (
        <div
            className="modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem'
            }}
        >
            <div
                className="glass-card"
                style={{
                    width: '100%',
                    maxWidth,
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    position: 'relative'
                }}
            >
                <div
                    style={{
                        padding: '1.5rem 2rem',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '1rem'
                    }}
                >
                    <div>
                        <h2 className="neon-text" style={{ fontSize: '1.35rem' }}>{title}</h2>
                        {subtitle && (
                            <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>{subtitle}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer', opacity: 0.5 }}
                    >
                        <X size={22} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>{children}</div>

                {footer && (
                    <div
                        style={{
                            padding: '1.25rem 2rem',
                            borderTop: '1px solid var(--glass-border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '1rem'
                        }}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
