'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House,
  Pill,
  ScanLine,
  CalendarDays,
  HeartPulse,
  UsersRound,
  Sparkles,
  FolderHeart,
  ShieldPlus,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowRight,
  Accessibility,
} from 'lucide-react';
import { api, useResource, type Me } from '@/lib/client';
import { formatDate, normalizeLocale } from '@/lib/i18n';
import { LanguageSelect, useLocale } from './locale-provider';
import { Logo, Loading, ErrorNotice, Button, Field, useAction } from './ui';
import { CareContext, type CareData } from './care-context';
import { DoctorProfile } from './doctor-profile';
import { SecuritySettings } from './security-settings';
const navigation = [
  { key: 'home', icon: House },
  { key: 'medicines', icon: Pill },
  { key: 'scan', icon: ScanLine },
  { key: 'appointments', icon: CalendarDays },
  { key: 'health', icon: HeartPulse },
  { key: 'family', icon: UsersRound },
  { key: 'assistant', icon: Sparkles },
  { key: 'records', icon: FolderHeart },
  { key: 'emergency', icon: ShieldPlus },
  { key: 'notifications', icon: Bell },
  { key: 'settings', icon: Settings },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useLocale(),
    path = usePathname(),
    router = useRouter(),
    [version, setVersion] = useState(0),
    [patientId, setPatientId] = useState(''),
    [mobileOpen, setMobileOpen] = useState(false),
    action = useAction();
  const me = useResource<Me>('me', version);
  const selected = me.data?.patients.find((p) => p.id === patientId) || me.data?.patients[0];
  const state = useResource<CareData>(
    selected ? `patients/${selected.id}/dashboard` : null,
    version,
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (me.data?.user.language) setLocale(normalizeLocale(me.data.user.language));
  }, [me.data?.user.language, setLocale]);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  const refresh = () => setVersion((v) => v + 1);
  if (me.error === 'unauthenticated')
    return (
      <main className="centered">
        <Logo />
        <h1>{t('unauthenticated')}</h1>
        <Link href="/login" className="button primary">
          {t('login')}
          <ArrowRight size={18} />
        </Link>
      </main>
    );
  if (me.error === 'locked')
    return (
      <main className="centered">
        <Logo />
        <h1>{t('locked')}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(() => api('auth/unlock', 'POST', { pin: form.get('pin') }), refresh);
          }}
        >
          <Field label={t('pin')}>
            <input name="pin" inputMode="numeric" type="password" pattern="[0-9]{6}" required />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('unlock')}</Button>
        </form>
      </main>
    );
  if (me.error)
    return (
      <main className="centered">
        <ErrorNotice code={me.error} />
        <Button onClick={refresh}>{t('confirm')}</Button>
      </main>
    );
  if (!me.data) return <Loading />;
  const user = me.data.user,
    active = path.split('/')[2] || 'home';
  const updateLocale = (value: string) => {
    void action.run(() => api('settings', 'PATCH', { language: value }), refresh);
  };
  return (
    <div className={`app-layout ${user.easyMode ? 'easy-mode' : ''}`}>
      <a href="#main" className="skip-link">
        {t('home')}
      </a>
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Link href="/app/home" aria-label="Sahaaya">
            <Logo />
          </Link>
          <button
            className="mobile-only icon-button"
            onClick={() => setMobileOpen(false)}
            aria-label={t('close')}
          >
            <X />
          </button>
        </div>
        <div className="sidebar-profile">
          <span className="avatar avatar-patient">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{t(state.data?.role || selected?.role || 'FAMILY')}</span>
          </div>
          <span className="little-dot" />
        </div>
        <nav className="side-nav" aria-label={t('home')}>
          {navigation
            .filter(
              (item) =>
                !user.easyMode || !['health', 'records', 'notifications'].includes(item.key),
            )
            .map(({ key, icon: Icon }, i) => (
              <div key={key}>
                {(i === 0 || key === 'family') && (
                  <span className="nav-caption">{t(i === 0 ? 'care' : 'support')}</span>
                )}
                <Link
                  onClick={() => setMobileOpen(false)}
                  className={active === key ? 'active' : ''}
                  href={`/app/${key}`}
                  aria-current={active === key ? 'page' : undefined}
                >
                  <Icon size={20} strokeWidth={active === key ? 2 : 1.7} />
                  <span>{t(key)}</span>
                  {key === 'assistant' && <span className="ai-tag">AI</span>}
                  {key === 'notifications' && Boolean(state.data?.alerts.length) && (
                    <span className="nav-count">{state.data?.alerts.length}</span>
                  )}
                </Link>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <HeartPulse size={23} />
            <p>{t('greeting')}</p>
            <Link href="/app/assistant">
              {t('ask')}
              <ArrowRight size={15} />
            </Link>
          </div>
          <button
            className="logout"
            onClick={() =>
              action.run(
                () => api('auth/logout', 'POST', {}),
                () => {
                  router.push('/login');
                  router.refresh();
                },
              )
            }
          >
            <LogOut size={18} />
            {t('logout')}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-only icon-button"
              aria-label={t('home')}
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">{t(active)}</span>
            <span className="topbar-divider" />
            <span className="topbar-date">
              {formatDate(new Date(), locale, user.timezone, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
          <div className="row">
            <LanguageSelect onChange={updateLocale} />
            <button
              className="easy-toggle"
              aria-label={t('easyMode')}
              aria-pressed={user.easyMode}
              onClick={() =>
                action.run(() => api('settings', 'PATCH', { easyMode: !user.easyMode }), refresh)
              }
            >
              <Accessibility size={19} />
              <span>{t('easyMode')}</span>
              <span className={`toggle ${user.easyMode ? 'on' : ''}`} />
            </button>
            <Link
              href="/app/notifications"
              className="icon-button notification-bell"
              aria-label={t('notifications')}
            >
              <Bell size={21} />
              {Boolean(state.data?.alerts.length) && <i />}
            </Link>
            <span className="avatar avatar-small">{user.name[0]}</span>
          </div>
        </header>
        {user.demo && (
          <div className="demo-banner">
            <span>
              <span className="little-dot" />
              {t('demo')}
            </span>
            <Link href="/demo">
              {t('role')}
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
        <main id="main" className="page-content">
          <ErrorNotice code={action.error} />
          {me.data.patients.length > 1 && (
            <Field label={t('PATIENT')}>
              <select value={selected?.id} onChange={(event) => setPatientId(event.target.value)}>
                {me.data.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!selected ? (
            <div className="panel empty">
              <UsersRound size={38} />
              <p>{t('noAccess')}</p>
              <Link href="/invite" className="button primary">
                {t('acceptInvitation')}
              </Link>
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action.run(() => api('onboarding', 'POST', { consent: true }), refresh);
                }}
              >
                <label className="check-label">
                  <input type="checkbox" required />
                  {t('consent')}
                </label>
                <Button busy={action.busy}>{t('createMyProfile')}</Button>
              </form>
              <SecuritySettings user={user} refresh={refresh} />
              <DoctorProfile user={user} />
            </div>
          ) : state.error ? (
            <ErrorNotice code={state.error} />
          ) : !state.data ? (
            <Loading />
          ) : (
            <CareContext.Provider
              value={{
                data: state.data,
                user,
                refresh,
                can: (key) => state.data!.permissions.includes(key),
              }}
            >
              {children}
            </CareContext.Provider>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <HeartPulse size={15} />
            {t('tagline')}
          </span>
          <Link href="/privacy">{t('privacy')}</Link>
        </footer>
      </div>
    </div>
  );
}
