import { getTranslations } from 'next-intl/server';
import FeatureCarousel from '@/components/FeatureCarousel';
import Header from '@/components/Header';

export default async function IndexPage() {
  const t = await getTranslations('Index');
  const f = await getTranslations('Features');

  const features = [
    {
      id: 'ai',
      title: f('ai.title'),
      desc: f('ai.desc'),
      image: '/features/ai.png'
    },
    {
      id: 'members',
      title: f('members.title'),
      desc: f('members.desc'),
      image: '/features/members.png'
    },
    {
      id: 'analytics',
      title: f('analytics.title'),
      desc: f('analytics.desc'),
      image: '/features/analytics.png'
    },
    {
      id: 'access',
      title: f('access.title'),
      desc: f('access.desc'),
      image: '/features/access.png'
    },
    {
      id: 'expenses',
      title: f('expenses.title'),
      desc: f('expenses.desc'),
      image: '/features/expenses.png'
    },
    {
      id: 'billing',
      title: f('billing.title'),
      desc: f('billing.desc'),
      image: '/features/billing.png'
    },
    {
      id: 'support',
      title: f('support.title'),
      desc: f('support.desc'),
      image: '/features/support.png'
    }
  ];

  return (
    <>
      <Header />
      <main style={{
        marginTop: '80px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="neon-text" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
            {t('welcome')}
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--light-gray)', maxWidth: '800px' }}>
            {t('description')}
          </p>
        </div>

        <FeatureCarousel features={features} />

        <div style={{ marginTop: '4rem', padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
            &copy; 2026 Integra Members. Todos los derechos reservados.
          </p>
        </div>
      </main>
    </>
  );
}
