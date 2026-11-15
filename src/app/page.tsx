'use client';
import Link from 'next/link';
import {
  ArrowRight,
  ScanLine,
  UsersRound,
  Pill,
  ShieldCheck,
  CalendarDays,
  HeartHandshake,
  Languages,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/ui';
import { CareIllustration } from '@/components/illustration';
import { LanguageSelect, useLocale } from '@/components/locale-provider';
export default function Landing() {
  const { t } = useLocale();
  return (
    <div className="landing">
      <a href="#main" className="skip-link">
        {t('home')}
      </a>
      <nav className="landing-nav">
        <Link href="/" aria-label="Sahaaya">
          <Logo />
        </Link>
        <div className="landing-nav-links">
          <a href="#how">{t('howWorks')}</a>
          <a href="#care">{t('care')}</a>
          <a href="#privacy">{t('privacy')}</a>
        </div>
        <div className="row">
          <LanguageSelect />
          <Link className="button secondary" href="/login">
            {t('login')}
            <ArrowRight size={17} />
          </Link>
        </div>
      </nav>
      <main id="main">
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="little-dot" />
              {t('tagline')}
            </div>
            <h1>
              {t('hero1')}
              <br />
              <span>{t('hero2')}</span>
              <br />
              {t('hero3')}
            </h1>
            <p>{t('heroDescription')}</p>
            <div className="row wrap">
              <Link className="button primary large" href="/register">
                {t('getStarted')}
                <ArrowRight size={20} />
              </Link>
              <Link className="button secondary large" href="/demo">
                {t('explore')}
              </Link>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={18} />
              {t('privacyText')}
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit-label">
              <HeartHandshake size={18} />
              {t('connected')}
            </div>
            <CareIllustration />
            <div className="illustration-note">
              <span className="round-icon mint">
                <Pill size={22} />
              </span>
              <div>
                <strong>{t('todayCare')}</strong>
                <small>{t('greeting')}</small>
              </div>
              <span className="check-circle">✓</span>
            </div>
          </div>
        </section>
        <section className="belief-strip">
          <span>
            <Pill />
            {t('medicines')}
          </span>
          <span>
            <UsersRound />
            {t('family')}
          </span>
          <span>
            <Languages />
            {t('language')} · 6
          </span>
          <span>
            <ShieldCheck />
            {t('privacy')}
          </span>
        </section>
        <section id="care" className="landing-section">
          <span className="eyebrow">SAHAAYA / {t('care')}</span>
          <h2>{t('greeting')}</h2>
          <p className="section-intro">{t('dashboardIntro')}</p>
          <div className="feature-grid">
            {[
              { icon: ScanLine, title: 'scanTitle', text: 'scanIntro', color: 'lavender' },
              { icon: Pill, title: 'routine', text: 'todayCare', color: 'mint' },
              { icon: UsersRound, title: 'family', text: 'familyIntro', color: 'peach' },
              { icon: CalendarDays, title: 'appointments', text: 'visitSummary', color: 'sky' },
              { icon: Sparkles, title: 'assistant', text: 'aiIntro', color: 'lavender' },
              { icon: HeartHandshake, title: 'emergency', text: 'privacyText', color: 'mint' },
            ].map(({ icon: Icon, title, text, color }) => (
              <article className={`feature-card ${color}`} key={title}>
                <Icon size={28} strokeWidth={1.5} />
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-section how-section" id="how">
          <h2>{t('howWorks')}</h2>
          <div className="steps">
            {['register', 'scan', 'verifyDetails', 'connected'].map((key, i) => (
              <div key={key}>
                <span>0{i + 1}</span>
                <h3>{t(key)}</h3>
                <p>{t(['privacyText', 'scanIntro', 'verifyMedicine', 'familyIntro'][i])}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="privacy" className="privacy-section">
          <ShieldCheck size={46} strokeWidth={1.3} />
          <div>
            <h2>{t('privacy')}</h2>
            <p>{t('privacyText')}</p>
            <p>{t('medicalCaution')}</p>
          </div>
          <Link className="button secondary" href="/register">
            {t('getStarted')}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>{t('tagline')}</p>
        <Link href="/privacy">{t('privacy')}</Link>
      </footer>
    </div>
  );
}
