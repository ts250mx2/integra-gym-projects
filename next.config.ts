import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone' as const,
  reactCompiler: true,
};

export default withNextIntl(nextConfig);
