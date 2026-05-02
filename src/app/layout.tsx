import { Inter } from 'next/font/google';
import './[locale]/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Integra Gym Projects',
  description: 'Management system for Integra Gym',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
