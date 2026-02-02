export default function PrivacyPage() {
    return (
        <div style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="neon-text-blue" style={{ marginBottom: '2rem' }}>Aviso de Privacidad / Privacy Policy</h1>
            <div className="glass-card" style={{ lineHeight: '1.8' }}>
                <h3>1. Recopilación de Información</h3>
                <p>Recopilamos información necesaria para la administración de su gimnasio, incluyendo nombres, correos electrónicos y datos de los miembros.</p>

                <h3 style={{ marginTop: '1.5rem' }}>2. Uso de los Datos</h3>
                <p>Los datos se utilizan exclusivamente para el funcionamiento del Punto de Venta (POS) y la gestión administrativa.</p>

                <h3 style={{ marginTop: '1.5rem' }}>3. Seguridad</h3>
                <p>Implementamos medidas de seguridad para proteger su información contra acceso no autorizado.</p>

                <p style={{ marginTop: '2rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Este es un aviso de ejemplo. Por favor, consulte con un asesor legal para redactar su aviso de privacidad oficial.
                </p>
            </div>
        </div>
    );
}
