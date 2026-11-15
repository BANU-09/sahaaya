'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  UsersRound,
  Stethoscope,
  HeartHandshake,
} from 'lucide-react';
import { Logo, Button, Field, ErrorNotice, useAction } from './ui';
import { LanguageSelect, useLocale } from './locale-provider';
import { CareIllustration } from './illustration';
import { api, useResource, type Config } from '@/lib/client';
export function AuthForm({
  mode,
}: {
  mode: 'login' | 'register' | 'demo' | 'recover' | 'reset' | 'invite';
}) {
  const { t, locale } = useLocale(),
    router = useRouter(),
    action = useAction();
  const {
    data: config,
    error: configError,
    loading: configLoading,
  } = useResource<Config>('config');
  const [role, setRole] = useState('PATIENT');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      values = Object.fromEntries(form.entries());
    if (mode === 'register')
      await action.run(
        () =>
          api('auth/register', 'POST', {
            ...values,
            email: values.email || undefined,
            mobile: values.mobile || undefined,
            dob: values.dob || undefined,
            pin: values.pin || undefined,
            role,
            language: locale,
            timezone: values.timezone || 'Asia/Kolkata',
            consent: values.consent === 'on',
            easyMode: values.easyMode === 'on',
          }),
        () => router.push('/app/home'),
      );
    if (mode === 'login')
      await action.run(async () => {
        const login = await api<{ mfaRequired?: boolean }>('auth/login', 'POST', values);
        router.push(login.mfaRequired ? '/mfa' : '/app/home');
      });
    if (mode === 'recover') await action.run(() => api('auth/recover', 'POST', values));
    if (mode === 'reset')
      await action.run(
        () =>
          api('auth/reset', 'POST', {
            password: values.password,
            token: new URL(window.location.href).searchParams.get('token'),
          }),
        () => router.push('/login'),
      );
    if (mode === 'invite')
      await action.run(
        () =>
          api('invitations', 'POST', {
            token: new URL(window.location.href).searchParams.get('token') || values.token,
          }),
        () => router.push('/app/home'),
      );
  }
  const heading =
    mode === 'demo'
      ? 'explore'
      : mode === 'recover'
        ? 'sendRecovery'
        : mode === 'reset'
          ? 'password'
          : mode === 'invite'
            ? 'acceptInvitation'
            : mode;
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <span className="eyebrow">{t('connected')}</span>
          <h1>
            {t('hero1')}
            <br />
            {t('hero3')}
          </h1>
          <CareIllustration />
          <p>{t('tagline')}</p>
        </div>
        <span className="muted">{t('privacyText')}</span>
      </div>
      <main className="auth-main">
        <div className="auth-top">
          <Link href="/" className="text-link">
            <ArrowLeft size={17} />
            {t('home')}
          </Link>
          <LanguageSelect />
        </div>
        <div className="auth-card">
          <span className="eyebrow">SAHAAYA</span>
          <h2>{t(heading)}</h2>
          <p className="muted">{t(mode === 'demo' ? 'demoIntro' : 'dashboardIntro')}</p>
          <ErrorNotice code={action.error} />
          {action.message && mode === 'recover' && (
            <div role="status" className="notice">
              {t('recoverySent')}
            </div>
          )}
          {mode === 'demo' ? (
            <div className="demo-roles">
              {configLoading ? (
                <p role="status">{t('loading')}</p>
              ) : configError ? (
                <ErrorNotice code={configError} />
              ) : config?.demo ? (
                [
                  { role: 'PATIENT', name: 'Lakshmi Devi', icon: Heart },
                  { role: 'FAMILY', name: 'Arjun Rao', icon: UsersRound },
                  { role: 'CAREGIVER', name: 'Priya Nair', icon: HeartHandshake },
                  { role: 'DOCTOR', name: 'Dr. Meera Rao', icon: Stethoscope },
                ].map(({ role: demoRole, name, icon: Icon }) => (
                  <button
                    key={demoRole}
                    className="demo-role"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        () => api('auth/demo', 'POST', { role: demoRole, language: locale }),
                        () => router.push('/app/home'),
                      )
                    }
                  >
                    <span className="round-icon mint">
                      <Icon size={23} />
                    </span>
                    <span>
                      <strong>{t(demoRole)}</strong>
                      <small>{name}</small>
                    </span>
                    <ArrowRight size={20} />
                  </button>
                ))
              ) : (
                <p>{t('notConfigured')}</p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              {mode === 'register' && (
                <>
                  <div className="role-choice">
                    {['PATIENT', 'FAMILY', 'CAREGIVER'].map((value) => (
                      <button
                        className={role === value ? 'selected' : ''}
                        type="button"
                        key={value}
                        aria-pressed={role === value}
                        onClick={() => setRole(value)}
                      >
                        {t(value)}
                      </button>
                    ))}
                  </div>
                  <Field label={t('name')}>
                    <input name="name" required autoComplete="name" maxLength={150} />
                  </Field>
                  <div className="form-grid">
                    <Field label={t('email')}>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required={role !== 'PATIENT'}
                      />
                    </Field>
                    <Field label={t('mobile')}>
                      <input name="mobile" type="tel" autoComplete="tel" pattern="\+?[0-9]{8,15}" />
                    </Field>
                  </div>
                  {role === 'PATIENT' && (
                    <Field label={t('dob')}>
                      <input name="dob" type="date" max={new Date().toISOString().slice(0, 10)} />
                    </Field>
                  )}
                </>
              )}
              {mode === 'login' && (
                <Field label={t('identity')}>
                  <input name="identity" required autoComplete="username" />
                </Field>
              )}
              {['login', 'register', 'reset'].includes(mode) && (
                <Field label={t('password')}>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === 'login' ? 1 : 12}
                    maxLength={128}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </Field>
              )}
              {mode === 'register' && (
                <>
                  <Field label={t('timezone')}>
                    <input name="timezone" defaultValue="Asia/Kolkata" required />
                  </Field>
                  <Field label={t('pin')}>
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="off"
                    />
                  </Field>
                  <label className="check-label">
                    <input type="checkbox" name="easyMode" />
                    {t('easyMode')}
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="consent" required />
                    {t('consent')}
                  </label>
                </>
              )}
              {mode === 'recover' && (
                <Field label={t('email')}>
                  <input name="email" type="email" required />
                </Field>
              )}
              {mode === 'invite' && <p>{t('privacyText')}</p>}
              <Button type="submit" busy={action.busy} className="full-width">
                {t(heading)}
                <ArrowRight size={18} />
              </Button>
            </form>
          )}
          {mode === 'login' && (
            <>
              <Link className="text-link" href="/recover">
                {t('forgot')}
              </Link>
              {config?.integrations.google && (
                <form action="/api/auth/google/start" method="get">
                  <Button variant="secondary" className="full-width">
                    Google · {t('login')}
                  </Button>
                </form>
              )}
              <p className="auth-switch">
                <Link href="/register">{t('register')}</Link>
                <Link href="/demo">{t('explore')}</Link>
              </p>
            </>
          )}
          {mode === 'register' && (
            <Link className="text-link" href="/login">
              {t('login')}
            </Link>
          )}
          {mode === 'invite' && (
            <Link className="text-link" href="/login">
              {t('login')}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
