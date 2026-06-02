'use client';

import { Brain } from 'lucide-react';
import AiAgent from '@/components/AiAgent';

export default function AiAgentPage() {
    return (
        <div>
            <h1 className="neon-text" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Brain size={32} />
                Agente IA
            </h1>
            <AiAgent mode="embedded" />
        </div>
    );
}
