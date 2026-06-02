import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone' as const,
  reactCompiler: true,
  // @anthropic-ai/sdk importa builtins con prefijo `node:` (node:fs, node:path).
  // Al tracearlo en modo standalone, Next genera chunks con `:` en el nombre que
  // Windows no puede copiar (EINVAL). Mantenerlo como paquete externo del servidor
  // (require desde node_modules) evita esos chunks y permite empaquetar el Electron.
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default withNextIntl(nextConfig);
