'use client';
import { useState } from 'react';
import { useCare } from './care-context';
import { useLocale } from './locale-provider';
import { api, useResource } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
import { Button, Field, ErrorNotice, Modal, Empty, useAction } from './ui';
type Handover = {
  id: string;
  senderId: string;
  recipientId: string;
  observations: string;
  responsibilities: string;
  createdAt: string;
  acknowledgedAt: string | null;
  snapshot: {
    doses: {
      id: string;
      medication: { name: string; dosage: string };
      status: string;
      scheduledAt: string;
    }[];
    tasks: { id: string; title: string; status: string }[];
    appointments: { id: string; doctor: string; status: string; startsAt: string }[];
  };
};
export function Handovers() {
  const { data, user, can } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [open, setOpen] = useState(false),
    [version, setVersion] = useState(0);
  const enabled = can('tasks.manage') && can('medications.view') && can('journal.view');
  const path = `patients/${data.patient.id}/handovers`,
    result = useResource<Handover[]>(enabled ? path : null, version);
  if (!enabled) return null;
  const recipients = data.members.filter(
    (m) =>
      m.user.id !== user.id &&
      ['tasks.manage', 'medications.view', 'journal.view'].every((key) =>
        m.permissions.some((p) => p.key === key),
      ),
  );
  const name = (id: string) =>
    data.members.find((m) => m.user.id === id)?.user.name || t('caregiver');
  return (
    <section className="panel section-space">
      <div className="panel-heading">
        <h2>{t('handover')}</h2>
        <Button
          type="button"
          variant="secondary"
          disabled={!recipients.length}
          onClick={() => setOpen(true)}
        >
          {t('createHandover')}
        </Button>
      </div>
      <p>{t('handoverHelp')}</p>
      <ErrorNotice code={result.error || action.error} />
      {!result.data?.length && <Empty />}
      {result.data?.map((item) => (
        <details className="document-card" key={item.id}>
          <summary>
            {name(item.senderId)} → {name(item.recipientId)} ·{' '}
            {formatDate(item.createdAt, locale, data.patient.timezone)} ·{' '}
            {t(item.acknowledgedAt ? 'acknowledged' : 'pending')}
          </summary>
          <p>
            <strong>{t('observations')}</strong>
            <br />
            {item.observations || '—'}
          </p>
          <p>
            <strong>{t('responsibilities')}</strong>
            <br />
            {item.responsibilities}
          </p>
          <h3>{t('medicines')}</h3>
          <ul>
            {item.snapshot.doses.map((d) => (
              <li key={d.id}>
                {d.medication.name} ·{' '}
                {formatDate(d.scheduledAt, locale, data.patient.timezone, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · {t(d.status)}
              </li>
            ))}
          </ul>
          <h3>{t('pendingTasks')}</h3>
          <ul>
            {item.snapshot.tasks.map((task) => (
              <li key={task.id}>
                {task.title} · {t(task.status)}
              </li>
            ))}
          </ul>
          {Boolean(item.snapshot.appointments.length) && (
            <>
              <h3>{t('appointments')}</h3>
              <ul>
                {item.snapshot.appointments.map((a) => (
                  <li key={a.id}>
                    {a.doctor} · {formatDate(a.startsAt, locale, data.patient.timezone)} ·{' '}
                    {t(a.status)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {item.recipientId === user.id && !item.acknowledgedAt && (
            <Button
              type="button"
              busy={action.busy}
              onClick={() =>
                action.run(
                  () => api(`${path}/${item.id}`, 'PATCH', { acknowledged: true }),
                  () => setVersion((v) => v + 1),
                )
              }
            >
              {t('acknowledge')}
            </Button>
          )}
        </details>
      ))}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('createHandover')}
        description={t('handoverHelp')}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            await action.run(
              () => api(path, 'POST', values),
              () => {
                setOpen(false);
                setVersion((v) => v + 1);
              },
            );
          }}
        >
          <ErrorNotice code={action.error} />
          <Field label={t('assignedTo')}>
            <select name="recipientId" required>
              {recipients.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('observations')}>
            <textarea name="observations" maxLength={3000} />
          </Field>
          <Field label={t('responsibilities')}>
            <textarea name="responsibilities" required maxLength={3000} />
          </Field>
          <Button busy={action.busy}>{t('confirm')}</Button>
        </form>
      </Modal>
    </section>
  );
}
