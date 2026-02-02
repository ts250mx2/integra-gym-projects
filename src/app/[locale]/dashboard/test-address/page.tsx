'use client';

import { useState } from 'react';
import AddressCapture from '@/components/AddressCapture';

export default function TestAddressPage() {
    const [addressData, setAddressData] = useState<any>(null);

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 className="neon-text" style={{ marginBottom: '2rem' }}>Verificación de Componente de Dirección</h1>

            <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <AddressCapture
                    onChange={(data) => {
                        console.log('Address changed:', data);
                        setAddressData(data);
                    }}
                />

                {addressData && (
                    <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                        <h3>Datos capturados:</h3>
                        <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(addressData, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
