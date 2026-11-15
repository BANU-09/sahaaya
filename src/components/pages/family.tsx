'use client';
import { useState } from 'react';
import Image from 'next/image';
import { DateTime } from 'luxon';
import { UserPlus, Plus, Check, Activity, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useCare, type CareData } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Field, Modal, Empty, ErrorNotice, useAction } from '../ui';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
import { PERMISSIONS, ROLE_PERMISSIONS, type Role } from '@/lib/permissions';
import { Handovers } from '../handovers';
const permissionLabels: Record<string, string> = {
  'profile.view': 'PATIENT',
  'medications.view': 'medicines',
  'medications.edit': 'addMedicine',
  'prescriptions.approve': 'approve',
  'doses.confirm': 'taken',
  'appointments.manage': 'appointments',
  'records.view': 'records',
  'records.upload': 'upload',
  'journal.view': 'health',
  'journal.write': 'saveCheckin',
  'tasks.manage': 'pendingTasks',
  'emergency.view': 'emergency',
  'family.manage': 'family',
  'audit.view': 'recentActivity',
};
export default function Family() {
  const { data, can, refresh, user } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [invite, setInvite] = useState(false),
    [task, setTask] = useState(false),
    [role, setRole] = useState<Role>('FAMILY'),
    [keys, setKeys] = useState<string[]>([...ROLE_PERMISSIONS.FAMILY]),
    [share, setShare] = useState<{ url: string; qr: string } | null>(null),
    [alert, setAlert] = useState<CareData['alerts'][number] | null>(null),
    [member, setMember] = useState<CareData['members'][number] | null>(null),
    [handover, setHandover] = useState<CareData['tasks'][number] | null>(null);
  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      async () => {
        const result = await api<{ url: string }>(
          `patients/${data.patient.id}/invitations`,
          'POST',
          {
            email: form.get('email'),
            role,
            relationship: form.get('relationship'),
            permissions: keys,
          },
        );
        const QR = await import('qrcode');
        return { url: result.url, qr: await QR.toDataURL(result.url, { width: 220, margin: 2 }) };
      },
      (result) => {
        setShare(result);
        setInvite(false);
        refresh();
      },
    );
  }
  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        api(`patients/${data.patient.id}/tasks`, 'POST', {
          title: form.get('title'),
          note: form.get('note'),
          assignedTo: form.get('assignedTo') || undefined,
          dueAt: DateTime.fromISO(String(form.get('dueAt')), { zone: data.patient.timezone })
            .toUTC()
            .toISO(),
        }),
      () => {
        setTask(false);
        refresh();
      },
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('family')}</h1>
          <p>{t('familyIntro')}</p>
        </div>
        {can('family.manage') && data.role === 'PATIENT' && (
          <Button onClick={() => setInvite(true)}>
            <UserPlus size={18} />
            {t('invite')}
          </Button>
        )}
      </div>
      <ErrorNotice code={action.error} />
      <Handovers />
      {data.alerts
        .filter((a) => a.stage === 'ESCALATED')
        .map((item) => (
          <section className="panel alert-panel section-space" key={item.id}>
            <div className="row">
              <HeartHandshake size={25} />
              <h2>{t('ESCALATED')}</h2>
            </div>
            <p>
              {item.dose.medication.name} ·{' '}
              {formatDate(item.dose.scheduledAt, locale, data.patient.timezone, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <p>
              {t('awaiting')}. {t('medicalCaution')}
            </p>
            {item.followup && <p>{item.followup}</p>}
            {can('tasks.manage') && (
              <Button variant="secondary" onClick={() => setAlert(item)}>
                {t(item.acknowledgedAt ? 'resolve' : 'acknowledge')}
              </Button>
            )}
          </section>
        ))}
      <div className="cards-grid section-space">
        {data.members.map((person, i) => (
          <article className="panel member-card" key={person.id}>
            <span className={`avatar member-color-${i % 4}`}>
              {person.user.name
                .split(' ')
                .map((v) => v[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h3>{person.user.name}</h3>
              <p>
                {t(person.role)} · {person.relationship}
              </p>
              <p>
                {person.permissions.length} · {t('permissions')}
              </p>
              {can('family.manage') && person.role !== 'PATIENT' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMember(person);
                    setKeys(person.permissions.map((p) => p.key));
                  }}
                >
                  <ShieldCheck size={15} />
                  {t('permissions')}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="panel section-space">
        <div className="panel-heading">
          <h2>{t('pendingTasks')}</h2>
          {can('tasks.manage') && (
            <Button variant="secondary" onClick={() => setTask(true)}>
              <Plus size={16} />
              {t('addTask')}
            </Button>
          )}
        </div>
        {data.tasks.length ? (
          data.tasks.map((item) => (
            <div className="task-row" key={item.id}>
              <span className="round-icon mint">
                <Check size={20} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.note}</p>
                <p>
                  {formatDate(item.dueAt, locale, data.patient.timezone, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  ·{' '}
                  {data.members.find((m) => m.user.id === item.assignedTo)?.user.name ||
                    t('unknown')}
                </p>
              </div>
              {item.status !== 'COMPLETED' && can('tasks.manage') ? (
                <div className="row wrap">
                  <Button
                    variant="secondary"
                    busy={action.busy}
                    onClick={() =>
                      action.run(
                        () =>
                          api(`patients/${data.patient.id}/tasks/${item.id}`, 'PATCH', {
                            status: 'COMPLETED',
                          }),
                        refresh,
                      )
                    }
                  >
                    {t('complete')}
                  </Button>
                  <button className="text-link" onClick={() => setHandover(item)}>
                    {t('handover')}
                  </button>
                </div>
              ) : (
                <span className="status">{t(item.status)}</span>
              )}
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      {can('audit.view') && (
        <section className="panel section-space">
          <div className="panel-heading">
            <h2>{t('recentActivity')}</h2>
            <Activity size={20} />
          </div>
          {data.activity.map((item) => (
            <div key={item.id} className="activity-row">
              <span className="activity-icon">
                <Check size={15} />
              </span>
              <div>
                <strong>{item.actorName}</strong>
                <p>{t(item.action)}</p>
              </div>
              <time>
                {formatDate(item.createdAt, locale, data.patient.timezone, {
                  hour: 'numeric',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            </div>
          ))}
        </section>
      )}
      {user.demo && (
        <div className="section-space">
          <Button
            variant="secondary"
            busy={action.busy}
            onClick={() => action.run(() => api('demo/simulate', 'POST', {}), refresh)}
          >
            {t('simulate')}
          </Button>
        </div>
      )}
      <Modal
        open={invite}
        onOpenChange={setInvite}
        title={t('invite')}
        description={t('privacyText')}
      >
        <form className="form-stack" onSubmit={createInvite}>
          <Field label={t('email')}>
            <input type="email" name="email" required />
          </Field>
          <Field label={t('relationship')}>
            <input name="relationship" required />
          </Field>
          <Field label={t('role')}>
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value as Role;
                setRole(next);
                setKeys([...ROLE_PERMISSIONS[next]]);
              }}
            >
              {['FAMILY', 'FAMILY_ADMIN', 'CAREGIVER', 'DOCTOR'].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </Field>
          <PermissionChoices keys={keys} onChange={setKeys} />
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('invite')}</Button>
        </form>
      </Modal>
      <Modal open={Boolean(share)} onOpenChange={() => setShare(null)} title={t('invite')}>
        {share && (
          <>
            <Image src={share.qr} width={180} height={180} alt={t('invite')} className="qr-code" />
            <p className="share-link">{share.url}</p>
            <Button onClick={() => action.run(() => navigator.clipboard.writeText(share.url))}>
              {t('copyLink')}
            </Button>
            <ErrorNotice code={action.error} />
            {action.message && <p role="status">{t('saved')}</p>}
          </>
        )}
      </Modal>
      <Modal open={task} onOpenChange={setTask} title={t('addTask')}>
        <form className="form-stack" onSubmit={createTask}>
          <Field label={t('title')}>
            <input name="title" required />
          </Field>
          <Field label={t('note')}>
            <textarea name="note" />
          </Field>
          <Field label={t('assignedTo')}>
            <select name="assignedTo">
              <option value="">{t('unknown')}</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('dateTime')}>
            <input name="dueAt" type="datetime-local" required />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(alert)}
        onOpenChange={() => setAlert(null)}
        title={t(alert?.acknowledgedAt ? 'resolve' : 'acknowledge')}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(
              () =>
                api(`patients/${data.patient.id}/alerts/${alert!.id}`, 'PATCH', {
                  action: alert?.acknowledgedAt ? 'RESOLVE' : 'ACKNOWLEDGE',
                  followup: form.get('followup'),
                }),
              () => {
                setAlert(null);
                refresh();
              },
            );
          }}
        >
          <Field label={t('note')}>
            <textarea name="followup" minLength={3} required />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(member)}
        onOpenChange={() => setMember(null)}
        title={t('permissions')}
        description={member?.user.name}
      >
        <PermissionChoices keys={keys} onChange={setKeys} />
        <ErrorNotice code={action.error} />
        <div className="row wrap section-space">
          <Button
            busy={action.busy}
            onClick={() =>
              action.run(
                () =>
                  api(`patients/${data.patient.id}/members/${member!.id}`, 'PATCH', {
                    permissions: keys,
                  }),
                () => {
                  setMember(null);
                  refresh();
                },
              )
            }
          >
            {t('save')}
          </Button>
          <Button
            variant="danger"
            busy={action.busy}
            onClick={() =>
              action.run(
                () => api(`patients/${data.patient.id}/members/${member!.id}`, 'DELETE'),
                () => {
                  setMember(null);
                  refresh();
                },
              )
            }
          >
            {t('revoke')}
          </Button>
        </div>
      </Modal>
      <Modal open={Boolean(handover)} onOpenChange={() => setHandover(null)} title={t('handover')}>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(
              () =>
                api(`patients/${data.patient.id}/tasks/${handover!.id}`, 'PATCH', {
                  status: 'OPEN',
                  assignedTo: form.get('assignedTo'),
                  note: form.get('note'),
                }),
              () => {
                setHandover(null);
                refresh();
              },
            );
          }}
        >
          <Field label={t('assignedTo')}>
            <select name="assignedTo" required>
              {data.members
                .filter((m) => m.role === 'CAREGIVER' || m.role === 'FAMILY_ADMIN')
                .map((m) => (
                  <option key={m.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t('note')}>
            <textarea name="note" required defaultValue={handover?.note} />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('save')}</Button>
        </form>
      </Modal>
    </>
  );
}
function PermissionChoices({
  keys,
  onChange,
}: {
  keys: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset>
      <legend className="muted" style={{ marginBottom: 12 }}>
        {t('permissions')}
      </legend>
      <div className="permission-grid">
        {PERMISSIONS.map((key) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={keys.includes(key)}
              onChange={(e) =>
                onChange(e.target.checked ? [...keys, key] : keys.filter((v) => v !== key))
              }
            />
            {t(permissionLabels[key])}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
