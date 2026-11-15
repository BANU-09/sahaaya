'use client';
import { useState } from 'react';
import { DateTime } from 'luxon';
import { Plus, MapPin, Clock, FileText, CalendarDays } from 'lucide-react';
import { useCare, type CareData } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Field, Modal, Status, Empty, ErrorNotice, useAction } from '../ui';
import { api, useResource, type Config } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
type Summary = {
  id: string;
  approvedAt: string | null;
  questions: string;
  content: {
    medications: { name: string; strength: string; dosage: string; instructions: string }[];
    doses: { id: string; scheduledAt: string; status: string; medication: { name: string } }[];
    journal: { mood: string; note: string; createdAt: string }[];
    documents: { id: string; title: string }[];
    generatedAt: string;
  };
};
export default function Appointments() {
  const { data, refresh, can } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const config = useResource<Config>('config');
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<CareData['appointments'][number] | null>(null),
    [summary, setSummary] = useState<Summary | null>(null),
    [approved, setApproved] = useState(false);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = DateTime.fromISO(String(form.get('startsAt')), { zone: data.patient.timezone })
      .toUTC()
      .toISO();
    await action.run(
      () =>
        api(`patients/${data.patient.id}/appointments`, 'POST', {
          doctor: form.get('doctor'),
          specialty: form.get('specialty'),
          hospital: form.get('hospital'),
          location: form.get('location'),
          startsAt,
          purpose: form.get('purpose'),
          preparation: form.get('preparation'),
          type: form.get('type'),
          reports: [],
        }),
      () => {
        setOpen(false);
        refresh();
      },
    );
  }
  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        api(`patients/${data.patient.id}/appointments/${selected.id}`, 'PATCH', {
          status: form.get('status'),
          startsAt: DateTime.fromISO(String(form.get('startsAt')), { zone: data.patient.timezone })
            .toUTC()
            .toISO(),
          confirmationReference: form.get('confirmationReference') || undefined,
          notes: form.get('notes') || undefined,
        }),
      () => {
        setSelected(null);
        refresh();
      },
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('appointments')}</h1>
          <p>
            {t('awaiting')} · {t('privacy')}
          </p>
        </div>
        {can('appointments.manage') && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} />
            {t('addAppointment')}
          </Button>
        )}
      </div>
      <ErrorNotice code={action.error} />
      <div className="stack">
        {data.appointments.length ? (
          data.appointments.map((appointment) => (
            <article className="panel appointment-card" key={appointment.id}>
              <div className="appointment-date">
                <strong>
                  {formatDate(appointment.startsAt, locale, data.patient.timezone, {
                    day: 'numeric',
                  })}
                </strong>
                <span>
                  {formatDate(appointment.startsAt, locale, data.patient.timezone, {
                    month: 'short',
                  })}
                </span>
              </div>
              <div className="appointment-info">
                <Status value={appointment.status} />
                <h2>{appointment.doctor}</h2>
                <p>{appointment.specialty}</p>
                <p>
                  <MapPin size={14} />
                  {appointment.hospital}
                </p>
                <p>
                  <Clock size={14} />
                  {formatDate(appointment.startsAt, locale, data.patient.timezone, {
                    weekday: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p>{appointment.purpose}</p>
                {appointment.preparation && <p>{appointment.preparation}</p>}
                <div className="row wrap">
                  <Button variant="secondary" onClick={() => setSelected(appointment)}>
                    {t('edit')}
                  </Button>
                  <a
                    className="button secondary"
                    href={`/api/patients/${data.patient.id}/appointments/${appointment.id}/calendar.ics`}
                  >
                    <CalendarDays size={15} />
                    {t('downloadCalendar')}
                  </a>
                  {!data.patient.demo && config.data?.integrations.google && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        action.run(
                          () =>
                            api(
                              `patients/${data.patient.id}/appointments/${appointment.id}/calendar`,
                              'POST',
                              {},
                            ),
                          refresh,
                        )
                      }
                    >
                      <CalendarDays size={15} />
                      {t('syncCalendar')}
                    </Button>
                  )}
                  {appointment.location && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appointment.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      {t('directions')}
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <Empty />
        )}
      </div>
      {can('records.view') && can('journal.view') && (
        <section className="panel section-space">
          <div className="panel-heading">
            <h2>{t('visitSummary')}</h2>
            <FileText />
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void action.run(
                () =>
                  api<Summary>(`patients/${data.patient.id}/summaries`, 'POST', {
                    questions: form.get('questions') || '',
                  }),
                (value) => {
                  setSummary(value);
                  setApproved(false);
                },
              );
            }}
          >
            <Field label={t('questions')}>
              <textarea name="questions" maxLength={3000} />
            </Field>
            <Button busy={action.busy}>{t('visitSummary')}</Button>
          </form>
        </section>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('addAppointment')}
        description={t('REQUESTED')}
      >
        <form className="form-stack" onSubmit={create}>
          <Field label={t('doctor')}>
            <input name="doctor" required />
          </Field>
          <div className="form-grid">
            <Field label={t('specialty')}>
              <input name="specialty" required />
            </Field>
            <Field label={t('hospital')}>
              <input name="hospital" required />
            </Field>
          </div>
          <Field label={t('location')}>
            <input name="location" />
          </Field>
          <Field label={`${t('dateTime')} · ${data.patient.timezone}`}>
            <input name="startsAt" type="datetime-local" required />
          </Field>
          <Field label={t('purpose')}>
            <input name="purpose" required />
          </Field>
          <Field label={t('type')}>
            <select name="type">
              {['IN_PERSON', 'VIDEO', 'PHONE'].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('preparation')}>
            <textarea name="preparation" />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(selected)}
        onOpenChange={() => setSelected(null)}
        title={t('appointments')}
      >
        <form className="form-stack" onSubmit={update}>
          <Field label={t('dateTime')}>
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={
                selected
                  ? DateTime.fromISO(selected.startsAt)
                      .setZone(data.patient.timezone)
                      .toFormat("yyyy-MM-dd'T'HH:mm")
                  : ''
              }
              required
            />
          </Field>
          <Field label={t('status')}>
            <select name="status" defaultValue={selected?.status}>
              {['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('confirmationReference')}>
            <input
              name="confirmationReference"
              defaultValue={selected?.confirmationReference || ''}
            />
          </Field>
          <Field label={t('note')}>
            <textarea name="notes" defaultValue={selected?.notes || ''} />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(summary)}
        onOpenChange={() => setSummary(null)}
        title={t('visitSummary')}
        description={data.patient.name}
      >
        {summary && (
          <div className="print-summary">
            <p>{formatDate(summary.content.generatedAt, locale, data.patient.timezone)}</p>
            <h3 className="section-space">{t('medicines')}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('medicineName')}</th>
                    <th>{t('dosage')}</th>
                    <th>{t('instructions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.content.medications.map((med, i) => (
                    <tr key={i}>
                      <td>
                        {med.name} {med.strength}
                      </td>
                      <td>{med.dosage}</td>
                      <td>{med.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="section-space">{t('recentActivity')}</h3>
            {summary.content.doses.slice(-15).map((dose) => (
              <p key={dose.id} className="inline-summary">
                {formatDate(dose.scheduledAt, locale, data.patient.timezone)} ·{' '}
                {dose.medication.name} · {t(dose.status)}
              </p>
            ))}
            <h3 className="section-space">{t('health')}</h3>
            {summary.content.journal.map((entry, i) => (
              <p key={i} className="inline-summary">
                {t(entry.mood)} · {entry.note}
              </p>
            ))}
            <h3 className="section-space">{t('records')}</h3>
            {summary.content.documents.map((doc) => (
              <p key={doc.id} className="inline-summary">
                {doc.title}
              </p>
            ))}
            <h3 className="section-space">{t('questions')}</h3>
            <p>{summary.questions}</p>
            {data.role === 'PATIENT' && !summary.approvedAt && (
              <div className="form-stack section-space no-print">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  {t('approveSummary')}
                </label>
                <Button
                  disabled={!approved}
                  busy={action.busy}
                  onClick={() =>
                    action.run(
                      () =>
                        api(`patients/${data.patient.id}/summaries/${summary.id}`, 'PATCH', {
                          approved: true,
                        }),
                      () => setSummary({ ...summary, approvedAt: new Date().toISOString() }),
                    )
                  }
                >
                  {t('confirm')}
                </Button>
              </div>
            )}
            {summary.approvedAt ? (
              <Button
                variant="secondary"
                className="section-space no-print"
                onClick={() => window.print()}
              >
                {t('print')}
              </Button>
            ) : (
              <p className="notice">{t('permissionRequired')}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
