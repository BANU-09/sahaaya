import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import { LocaleProvider } from '@/components/locale-provider';
export const metadata: Metadata = {
  title: 'Sahaaya · Care that connects',
  description:
    'Your Health. Your Family. Always Connected. Elderly-first family care coordination.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
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
