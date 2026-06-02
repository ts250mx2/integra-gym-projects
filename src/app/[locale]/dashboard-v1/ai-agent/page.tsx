'use client';

import { Brain } from 'lucide-react';
import AiAgent from '@/components/AiAgent';

export default function AiAgentPageV1() {
    return (
        <div>
            <h1 className="neon-text" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Brain size={32} />
                Agente IA
            </h1>
            {/* version="1.0" → el agente no genera ni muestra navegación a pantallas v2.0 */}
            <AiAgent mode="embedded" version="1.0" />
        </div>
    );
}
