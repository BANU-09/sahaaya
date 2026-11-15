'use client';
import Link from 'next/link';
import { LanguageSelect, useLocale } from '@/components/locale-provider';
import { privacyCopy } from '@/lib/privacy-copy';
export default function Privacy() {
  const { locale, t } = useLocale(),
    copy = privacyCopy[locale];
  return (
    <main className="document-page">
      <div className="row between">
        <Link href="/">← SAHAAYA</Link>
        <LanguageSelect />
      </div>
      <h1>{t('privacy')}</h1>
      <p>{copy.intro}</p>
      <h2>{copy.accessTitle}</h2>
      <p>{copy.access}</p>
      <h2>{copy.processingTitle}</h2>
      <p>{copy.processing}</p>
      <h2>{copy.rightsTitle}</h2>
      <p>{copy.rights}</p>
      <p className="notice">{copy.limits}</p>
      <a
        href="https://github.com/BANU-09/sahaaya/blob/main/QUALITY_REPORT.md"
        target="_blank"
        rel="noreferrer"
      >
        {t('sourceCode')} · BanuSreya
      </a>
    </main>
  );
}
