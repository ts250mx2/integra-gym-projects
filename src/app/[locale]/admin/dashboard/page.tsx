import { useTranslations } from 'next-intl';

export default function AdminDashboardPage() {
    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <h1 className="neon-text-blue" style={{ marginBottom: '1rem' }}>
                Dashboard Administrador de Proyectos
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
                Bienvenido al panel de administración de proyectos. Utiliza el menú lateral para gestionar los proyectos y usuarios.
            </p>
        </div>
    );
}
