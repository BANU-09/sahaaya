'use client';
import { useState } from 'react';
import { HeartPulse, Plus, Activity } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Field, Empty, ErrorNotice, useAction, VoiceInput, Modal } from '../ui';
import { api, useResource } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
import { HealthTrends, type TrendDetails } from '../health-trends';
type Analytics = TrendDetails & {
  total: number;
  taken: number;
  notTaken: number;
  unconfirmed: number;
  trend: { date: string; total: number; taken: number }[];
  delayed: number;
  days: number;
};
export default function Health() {
  const { data, can, refresh } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [mood, setMood] = useState('GOOD'),
    [note, setNote] = useState(''),
    [vital, setVital] = useState(false),
    [days, setDays] = useState(7),
    [customRange, setCustomRange] = useState('');
  const analytics = useResource<Analytics>(
    can('medications.view')
      ? `patients/${data.patient.id}/analytics?${customRange || `days=${days}`}`
      : null,
  );
  const stats = analytics.data || { ...data.adherence, trend: data.trend, delayed: 0, days: 7 };
  const maximum = Math.max(1, ...stats.trend.map((d) => d.total));
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('health')}</h1>
          <p>{t('medicalCaution')}</p>
        </div>
        <HeartPulse size={28} />
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('routine')}</h2>
            <select
              aria-label={t('days')}
              style={{ width: 100 }}
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
                setCustomRange('');
              }}
            >
              {[7, 30, 90].map((n) => (
                <option key={n} value={n}>
                  {n} {t('days')}
                </option>
              ))}
            </select>
          </div>
          <ErrorNotice code={analytics.error} />
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              setCustomRange(`from=${values.get('from')}&to=${values.get('to')}`);
            }}
          >
            <Field label={t('fromDate')}>
              <input type="date" name="from" required />
            </Field>
            <Field label={t('toDate')}>
              <input type="date" name="to" required />
            </Field>
            <Button type="submit" variant="secondary">
              {t('customRange')}
            </Button>
          </form>
          {stats.total ? (
            <>
              <div className="row wrap">
                <strong style={{ fontSize: 36 }}>
                  {Math.round((stats.taken / stats.total) * 100)}%
                </strong>
                <span className="muted">
                  {stats.taken} / {stats.total} · {t('TAKEN')}
                </span>
              </div>
              <div
                className="chart-bars"
                role="img"
                aria-label={`${t('routine')}: ${stats.taken}/${stats.total}`}
              >
                {stats.trend.map((day) => (
                  <div className="chart-column" key={day.date}>
                    <small>
                      {day.taken}/{day.total}
                    </small>
                    <div style={{ height: `${(day.total / maximum) * 160}px` }}>
                      <span
                        style={{ height: `${day.total ? (day.taken / day.total) * 100 : 0}%` }}
                      />
                    </div>
                    <small>
                      {formatDate(`${day.date}T12:00:00Z`, locale, data.patient.timezone, {
                        day: 'numeric',
                        ...(days === 7 ? { weekday: 'narrow' } : {}),
                      })}
                    </small>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span>
                  ● {t('TAKEN')} {stats.taken}
                </span>
                <span>
                  ○ {t('awaiting')} {stats.unconfirmed}
                </span>
                <span>
                  {t('NOT_TAKEN')} {stats.notTaken}
                </span>
              </div>
            </>
          ) : (
            <Empty text={t('insufficient')} />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('checkin')}</h2>
            <HeartPulse size={20} />
          </div>
          {can('journal.write') ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(
                  () => api(`patients/${data.patient.id}/journal`, 'POST', { mood, note }),
                  () => {
                    setNote('');
                    refresh();
                  },
                );
              }}
            >
              <Field label={t('checkin')}>
                <select value={mood} onChange={(e) => setMood(e.target.value)}>
                  {['VERY_GOOD', 'GOOD', 'UNWELL', 'HELP'].map((value) => (
                    <option value={value} key={value}>
                      {t(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('note')}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </Field>
              <div className="row between">
                <VoiceInput onResult={setNote} />
                <Button busy={action.busy}>{t('saveCheckin')}</Button>
              </div>
              <ErrorNotice code={action.error} />
              {action.message && (
                <p className="success-text" role="status">
                  {t('saved')}
                </p>
              )}
            </form>
          ) : (
            <Empty text={t('permissionRequired')} />
          )}
        </section>
      </div>
      <div className="two-column section-space">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('journal')}</h2>
          </div>
          {data.journal.length ? (
            data.journal.map((entry) => (
              <article className="journal-entry" key={entry.id}>
                <strong>{t(entry.mood)}</strong>
                <p>{entry.note}</p>
                <time>
                  {formatDate(entry.createdAt, locale, data.patient.timezone, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </article>
            ))
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('vitals')}</h2>
            {can('journal.write') && (
              <Button variant="secondary" onClick={() => setVital(true)}>
                <Plus size={16} />
                {t('save')}
              </Button>
            )}
          </div>
          {data.vitals.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('type')}</th>
                    <th>{t('value')}</th>
                    <th>{t('dateTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vitals.map((value) => (
                    <tr key={value.id}>
                      <td>{t(value.kind)}</td>
                      <td>
                        {value.value}
                        {value.secondaryValue ? ` / ${value.secondaryValue}` : ''} {value.unit}
                      </td>
                      <td>{formatDate(value.recordedAt, locale, data.patient.timezone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text={t('insufficient')} />
          )}
          <p className="privacy-note">
            <Activity size={15} />
            {t('medicalCaution')}
          </p>
        </section>
      </div>
      {analytics.data && <HealthTrends stats={analytics.data} timezone={data.patient.timezone} />}
      <Modal open={vital} onOpenChange={setVital} title={t('vitals')}>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(
              () =>
                api(`patients/${data.patient.id}/vitals`, 'POST', {
                  kind: form.get('kind'),
                  value: Number(form.get('value')),
                  secondaryValue: form.get('secondaryValue')
                    ? Number(form.get('secondaryValue'))
                    : undefined,
                }),
              () => {
                setVital(false);
                refresh();
              },
            );
          }}
        >
          <Field label={t('type')}>
            <select name="kind">
              {['BLOOD_PRESSURE', 'PULSE', 'WEIGHT', 'GLUCOSE'].map((value) => (
                <option key={value} value={value}>
                  {t(value)} ·{' '}
                  {{ BLOOD_PRESSURE: 'mmHg', PULSE: 'bpm', WEIGHT: 'kg', GLUCOSE: 'mg/dL' }[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('value')}>
            <input name="value" type="number" step="0.1" min="0.1" max="1000" required />
          </Field>
          <Field label={t('diastolic')}>
            <input name="secondaryValue" type="number" min="1" max="300" />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
    </>
  );
}
