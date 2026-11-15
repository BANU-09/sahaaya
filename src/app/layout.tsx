import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import { LocaleProvider } from '@/components/locale-provider';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://sahaaya-mauve.vercel.app'),
  authors: [{ name: 'BanuSreya', url: 'https://github.com/BANU-09/sahaaya' }],
  creator: 'BanuSreya',
  title: 'Sahaaya · Care that connects',
  description:
    'Your Health. Your Family. Always Connected. Elderly-first family care coordination.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'SAHAAYA',
    title: 'SAHAAYA — Care that connects',
    description:
      'Six languages. Patient-controlled family access. Reviewed medicines and shared follow-up. Built by BanuSreya.',
  },
  twitter: { card: 'summary_large_image' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
