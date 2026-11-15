'use client';
import { useState } from 'react';
import { Settings as SettingsIcon, ShieldCheck, Link2, Monitor, RotateCcw } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale, LanguageSelect } from '../locale-provider';
import { Button, Field, ErrorNotice, Loading, Modal, useAction } from '../ui';
import { api, useResource, type PublicUser } from '@/lib/client';
import { enablePush } from '@/lib/push';
import { formatDate } from '@/lib/i18n';
import { SecuritySettings } from '../security-settings';
import { DoctorProfile } from '../doctor-profile';
type SettingsData = {
  user: PublicUser;
  preferences: { email: boolean; push: boolean; quietStart: number; quietEnd: number } | null;
  sessions: { id: string; device: string; createdAt: string }[];
  currentSession: string;
  integrations: Record<string, boolean>;
  googleConnected: boolean;
  reminderCheckMinutes: number;
};
export default function Settings() {
  const { data, user, refresh } = useCare(),
    { t, locale } = useLocale(),
    action = useAction(),
    [version, setVersion] = useState(0),
    [reset, setReset] = useState(false);
  const result = useResource<SettingsData>('settings', version);
  const update = () => {
    setVersion((v) => v + 1);
    refresh();
  };
  const status = result.data;
  async function preferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        api('settings', 'PATCH', {
          timezone: form.get('timezone'),
          email: form.get('email') === 'on',
          quietStart: Number(form.get('quietStart')),
          quietEnd: Number(form.get('quietEnd')),
          easyMode: form.get('easyMode') === 'on',
        }),
      update,
    );
  }
  async function profile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        api(`patients/${data.patient.id}/profile`, 'PATCH', {
          bloodGroup: form.get('bloodGroup') || undefined,
          allergies: String(form.get('allergies'))
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          conditions: String(form.get('conditions'))
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          emergencyName: form.get('emergencyName') || undefined,
          emergencyPhone: form.get('emergencyPhone') || undefined,
          hospital: form.get('hospital') || undefined,
          primaryDoctor: form.get('primaryDoctor') || undefined,
          followupMinutes: Number(form.get('followupMinutes')),
          escalateMinutes: Number(form.get('escalateMinutes')),
        }),
      update,
    );
  }
  const medical = useResource<{
    bloodGroup: string | null;
    allergies: string[];
    conditions: string[];
    emergencyName: string | null;
    emergencyPhone: string | null;
    hospital: string | null;
    primaryDoctor: string | null;
  }>(data.role === 'PATIENT' ? `patients/${data.patient.id}/profile` : null, version);
  if (!status)
    return (
      <>
        <ErrorNotice code={result.error} />
        <Loading />
      </>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('settings')}</h1>
          <p>{t('privacyText')}</p>
        </div>
        <SettingsIcon size={26} />
      </div>
      <ErrorNotice code={action.error} />
      {action.message && (
        <div className="notice" role="status">
          {t(action.message)}
        </div>
      )}
      <div className="settings-grid">
        <SecuritySettings user={status.user} refresh={update} />
        <DoctorProfile user={status.user} />
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('settings')}</h2>
            <LanguageSelect
              onChange={(value) =>
                action.run(() => api('settings', 'PATCH', { language: value }), update)
              }
            />
          </div>
          <form className="form-stack" onSubmit={preferences}>
            <Field label={t('timezone')}>
              <input name="timezone" defaultValue={user.timezone} required />
            </Field>
            <label className="check-label">
              <input type="checkbox" name="easyMode" defaultChecked={user.easyMode} />
              {t('easyMode')}
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="email"
                disabled={!status.integrations.email || !user.emailVerified}
                defaultChecked={status.preferences?.email}
              />
              {t('emailReminders')}
            </label>
            <p>
              {t('reminderCheckInterval')}: {status.reminderCheckMinutes} {t('minutes')}
            </p>
            <div className="form-grid">
              <Field label={t('quietStart')}>
                <input
                  name="quietStart"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={status.preferences?.quietStart ?? 22}
                  required
                />
              </Field>
              <Field label={t('quietEnd')}>
                <input
                  name="quietEnd"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={status.preferences?.quietEnd ?? 7}
                  required
                />
              </Field>
            </div>
            <Button busy={action.busy}>{t('save')}</Button>
          </form>
          <Button
            variant="secondary"
            busy={action.busy}
            onClick={() => action.run(enablePush, update)}
          >
            {t('pushReminders')}
          </Button>
          {status.preferences?.push && (
            <Button
              variant="ghost"
              onClick={() =>
                action.run(async () => {
                  await api('push', 'DELETE');
                  await api('settings', 'PATCH', { push: false });
                }, update)
              }
            >
              {t('revoke')}
            </Button>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('integrationStatus')}</h2>
            <Link2 size={20} />
          </div>
          <div>
            {[
              { key: 'gemini', name: 'Google Gemini' },
              { key: 'vision', name: 'Google Cloud Vision' },
              { key: 'google', name: 'Google OAuth' },
              { key: 'push', name: 'Firebase Cloud Messaging' },
              { key: 'email', name: 'Resend' },
              { key: 'storage', name: 'Google Cloud Storage' },
              { key: 'maps', name: 'Google Maps' },
            ].map((integration) => (
              <div className="integration-row" key={integration.key}>
                <strong>{integration.name}</strong>
                <span>
                  {t(status.integrations[integration.key] ? 'configured' : 'notConfigured')}
                </span>
              </div>
            ))}
          </div>
          {status.integrations.google && !user.demo && (
            <form action="/api/auth/google/start" method="get">
              <input type="hidden" name="calendar" value="true" />
              <Button variant="secondary">{t('connectGoogle')}</Button>
            </form>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('sessions')}</h2>
            <Monitor size={20} />
          </div>
          {status.sessions.map((session) => (
            <div className="session-row" key={session.id}>
              <p>{session.device}</p>
              <p>
                {formatDate(session.createdAt, locale, user.timezone, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <Button
                variant="ghost"
                busy={action.busy}
                onClick={() => action.run(() => api(`sessions/${session.id}`, 'DELETE'), update)}
              >
                {t('endSession')}
              </Button>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('pin')}</h2>
            <ShieldCheck size={20} />
          </div>
          {!user.demo && (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void action.run(
                  () =>
                    api('settings', 'PATCH', {
                      pin: form.get('pin'),
                      currentPassword: form.get('currentPassword'),
                    }),
                  update,
                );
              }}
            >
              <Field label={t('password')}>
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label={t('pin')}>
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Button busy={action.busy}>{t('save')}</Button>
            </form>
          )}
          {user.hasPin && (
            <Button
              variant="secondary"
              onClick={() => action.run(() => api('auth/lock', 'POST', {}), update)}
            >
              {t('lock')}
            </Button>
          )}
          {user.demo && <p>{t('demo')}</p>}
        </section>
      </div>
      {data.role === 'PATIENT' && medical.data && (
        <section className="panel section-space">
          <div className="panel-heading">
            <h2>{t('emergency')}</h2>
          </div>
          <form className="form-stack" onSubmit={profile}>
            <div className="form-grid">
              <Field label={t('bloodGroup')}>
                <input name="bloodGroup" defaultValue={medical.data.bloodGroup || ''} />
              </Field>
              <Field label={t('allergies')}>
                <input name="allergies" defaultValue={medical.data.allergies.join(', ')} />
              </Field>
              <Field label={t('conditions')}>
                <input name="conditions" defaultValue={medical.data.conditions.join(', ')} />
              </Field>
              <Field label={t('emergencyContact')}>
                <input name="emergencyName" defaultValue={medical.data.emergencyName || ''} />
              </Field>
              <Field label={t('mobile')}>
                <input
                  name="emergencyPhone"
                  type="tel"
                  defaultValue={medical.data.emergencyPhone || ''}
                />
              </Field>
              <Field label={t('hospital')}>
                <input name="hospital" defaultValue={medical.data.hospital || ''} />
              </Field>
              <Field label={t('doctor')}>
                <input name="primaryDoctor" defaultValue={medical.data.primaryDoctor || ''} />
              </Field>
              <Field label={t('followupMinutes')}>
                <input
                  name="followupMinutes"
                  type="number"
                  min="5"
                  max="120"
                  defaultValue={data.patient.followupMinutes}
                  required
                />
              </Field>
              <Field label={t('escalateMinutes')}>
                <input
                  name="escalateMinutes"
                  type="number"
                  min="10"
                  max="240"
                  defaultValue={data.patient.escalateMinutes}
                  required
                />
              </Field>
            </div>
            <Button busy={action.busy}>{t('save')}</Button>
          </form>
        </section>
      )}
      {user.demo && data.role === 'PATIENT' && (
        <section className="panel section-space">
          <h2>{t('demo')}</h2>
          <Button variant="danger" className="section-space" onClick={() => setReset(true)}>
            <RotateCcw size={17} />
            {t('resetDemo')}
          </Button>
        </section>
      )}
      <Modal
        open={reset}
        onOpenChange={setReset}
        title={t('resetDemo')}
        description={t('resetConfirm')}
      >
        <Button
          variant="danger"
          busy={action.busy}
          onClick={() =>
            action.run(
              () => api('demo/reset', 'POST', {}),
              () => {
                setReset(false);
                update();
              },
            )
          }
        >
          {t('confirm')}
        </Button>
      </Modal>
    </>
  );
}
