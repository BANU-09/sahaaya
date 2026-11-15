'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Sun,
  CalendarDays,
  ClipboardCheck,
  ScanLine,
  Sparkles,
  Heart,
  ShieldCheck,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Empty, ErrorNotice, useAction } from '../ui';
import { DoseCard } from '../dose-card';
import { CareIllustration } from '../illustration';
import { formatDate } from '@/lib/i18n';
import { api } from '@/lib/client';
export default function Home() {
  const { data, user, can, refresh } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [mood, setMood] = useState('GOOD');
  const next = data.doses.find((d) => !['TAKEN', 'NOT_TAKEN', 'CANCELLED'].includes(d.status));
  const upcoming = data.appointments.find(
    (a) => new Date(a.startsAt) > new Date() && !['COMPLETED', 'CANCELLED'].includes(a.status),
  );
  const todayTaken = data.doses.filter((d) => d.status === 'TAKEN').length;
  const pending = data.tasks.filter((task) => task.status === 'OPEN');
  return (
    <>
      <div className="page-greeting">
        <div>
          <div className="eyebrow">
            <Sun size={16} />
            {t('welcome')}, {user.name.split(' ')[0]}
          </div>
          <h1>{t('todayCare')}</h1>
          <p>{t('dashboardIntro')}</p>
        </div>
        <Link href="/app/scan" className="button secondary">
          <ScanLine size={18} />
          {t('scan')}
        </Link>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="pill-label">
            <Heart size={13} />
            {t('connected')}
          </span>
          <h2>{t('greeting')}</h2>
          <p>{t('familyIntro')}</p>
          <Link href="/app/family" className="text-link">
            {t('family')}
            <ArrowRight size={17} />
          </Link>
        </div>
        <CareIllustration small />
        <div className="banner-orbit orbit-one" />
        <div className="banner-orbit orbit-two" />
      </section>
      <div className="stat-grid">
        <Link href="/app/medicines" className="stat-card">
          <span className="round-icon mint">
            <Heart size={22} />
          </span>
          <div>
            <span>{t('routine')}</span>
            <strong>
              {todayTaken}
              <small> / {data.doses.length}</small>
            </strong>
            <p>{t('TAKEN')}</p>
          </div>
          <div
            className="mini-ring"
            style={
              {
                '--progress': `${data.doses.length ? (todayTaken / data.doses.length) * 100 : 0}%`,
              } as React.CSSProperties
            }
          >
            <span>
              {data.doses.length ? Math.round((todayTaken / data.doses.length) * 100) : 0}%
            </span>
          </div>
        </Link>
        <Link href="/app/appointments" className="stat-card">
          <span className="round-icon sky">
            <CalendarDays size={22} />
          </span>
          <div>
            <span>{t('nextAppointment')}</span>
            <strong className="stat-text">
              {upcoming
                ? formatDate(upcoming.startsAt, locale, data.patient.timezone, {
                    day: 'numeric',
                    month: 'short',
                  })
                : '—'}
            </strong>
            <p>{upcoming?.doctor || t('empty')}</p>
          </div>
          <ArrowUpRight size={19} />
        </Link>
        <Link href="/app/family" className="stat-card">
          <span className="round-icon peach">
            <ClipboardCheck size={23} />
          </span>
          <div>
            <span>{t('pendingTasks')}</span>
            <strong>
              {pending.length + data.alerts.filter((a) => a.stage === 'ESCALATED').length}
            </strong>
            <p>{t(pending.length ? 'attention' : 'onTrack')}</p>
          </div>
          <ArrowUpRight size={19} />
        </Link>
      </div>
      <div className="dashboard-grid">
        <div className="main-column">
          <section className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow small-eyebrow">{t('care')}</span>
                <h2>{t('todaySchedule')}</h2>
              </div>
              <Link href="/app/medicines" className="text-link">
                {t('viewAll')}
                <ArrowRight size={16} />
              </Link>
            </div>
            {next ? <DoseCard dose={next} featured /> : <Empty text={t('noDoses')} />}
            <div className="schedule-list">
              {data.doses
                .filter((d) => d.id !== next?.id)
                .slice(0, 3)
                .map((dose) => (
                  <DoseCard key={dose.id} dose={dose} />
                ))}
            </div>
          </section>
          <section className="panel continuity-panel">
            <div className="panel-heading">
              <h2>{t('continuity')}</h2>
              <ShieldCheck size={20} />
            </div>
            <div className="continuity-rows">
              {[
                {
                  key: 'routine',
                  value: next ? 'awaiting' : 'onTrack',
                  text: `${todayTaken} / ${data.doses.length} · ${t('TAKEN')}`,
                },
                {
                  key: 'appointments',
                  value: upcoming ? 'onTrack' : 'awaiting',
                  text: upcoming
                    ? formatDate(upcoming.startsAt, locale, data.patient.timezone)
                    : t('empty'),
                },
                {
                  key: 'pendingTasks',
                  value: pending.length ? 'attention' : 'onTrack',
                  text: pending[0]?.title || t('empty'),
                },
              ].map((row) => (
                <div key={row.key}>
                  <span className={`state-dot ${row.value}`} />
                  <div>
                    <strong>{t(row.key)}</strong>
                    <p>{row.text}</p>
                  </div>
                  <span>{t(row.value)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="right-column">
          <section className="scan-promo">
            <div className="row between">
              <span className="round-icon white">
                <ScanLine size={25} />
              </span>
              <span className="subtle-tag">SCAN-TO-CARE</span>
            </div>
            <h2>{t('scanTitle')}</h2>
            <p>{t('scanIntro')}</p>
            <Link href="/app/scan" className="button dark">
              {t('scanButton')}
              <ArrowRight size={17} />
            </Link>
            <div className="scan-corners" aria-hidden="true" />
          </section>
          <section className="panel checkin-panel">
            <h2>{t('checkin')}</h2>
            <div className="mood-options">
              {[
                { key: 'VERY_GOOD', Icon: Smile },
                { key: 'GOOD', Icon: Smile },
                { key: 'UNWELL', Icon: Meh },
                { key: 'HELP', Icon: Frown },
              ].map(({ key, Icon }) => (
                <button
                  key={key}
                  aria-pressed={mood === key}
                  className={mood === key ? 'selected' : ''}
                  onClick={() => setMood(key)}
                >
                  <Icon size={27} strokeWidth={1.5} />
                  <span>{t(key)}</span>
                </button>
              ))}
            </div>
            <ErrorNotice code={action.error} />
            {can('journal.write') && (
              <Button
                variant="secondary"
                busy={action.busy}
                className="full-width"
                onClick={() =>
                  action.run(
                    () => api(`patients/${data.patient.id}/journal`, 'POST', { mood, note: '' }),
                    refresh,
                  )
                }
              >
                {t('saveCheckin')}
                <ArrowRight size={16} />
              </Button>
            )}
            {action.message && (
              <p role="status" className="success-text">
                {t(action.message)}
              </p>
            )}
          </section>
          <section className="ai-promo">
            <Sparkles size={23} />
            <h3>{t('aiIntro')}</h3>
            <Link href="/app/assistant">
              {t('ask')}
              <ArrowRight size={17} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="panel family-preview">
        <div>
          <span className="eyebrow small-eyebrow">{t('support')}</span>
          <h2>{t('family')}</h2>
        </div>
        <div className="family-preview-members">
          {data.members
            .filter((m) => m.role !== 'PATIENT')
            .slice(0, 4)
            .map((member, i) => (
              <div key={member.id}>
                <span className={`avatar member-color-${i}`}>
                  {member.user.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span>
                  <strong>{member.user.name}</strong>
                  <small>{t(member.role)}</small>
                </span>
              </div>
            ))}
        </div>
        <Link className="icon-button" href="/app/family" aria-label={t('family')}>
          <ArrowUpRight />
        </Link>
      </section>
    </>
  );
}
