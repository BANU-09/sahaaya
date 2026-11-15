'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type PublicUser } from '@/lib/client';
import { Button, Field, ErrorNotice, Modal, useAction } from './ui';
import { useLocale } from './locale-provider';

export function SecuritySettings({ user, refresh }: { user: PublicUser; refresh: () => void }) {
  const { t } = useLocale(),
    action = useAction(),
    router = useRouter();
  const [mode, setMode] = useState<string | null>(null),
    [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null),
    [codes, setCodes] = useState<string[] | null>(null);
  if (user.demo) return null;
  function close() {
    setMode(null);
    setEnrollment(null);
    setCodes(null);
    action.clear();
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    await action.run(async () => {
      if (mode === 'mfa-start' && !enrollment)
        setEnrollment(await api('security/mfa-start', 'POST', values));
      else if (mode === 'mfa-start') {
        const result = await api<{ codes: string[] }>('security/mfa-enable', 'POST', values);
        setCodes(result.codes);
        setEnrollment(null);
        refresh();
      } else if (mode === 'export') {
        const data = await api('privacy/export', 'POST', values);
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sahaaya-export.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        close();
      } else if (mode === 'delete') {
        await api('privacy/delete', 'POST', values);
        router.push('/');
      } else {
        await api(`security/${mode}`, 'POST', values);
        refresh();
        close();
      }
    });
  }
  return (
    <section className="panel form-stack">
      <h2>{t('accountSecurity')}</h2>
      <p>{t(user.mfaEnabled ? 'mfaEnabled' : 'mfaNotEnabled')}</p>
      <div className="row wrap">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMode(user.mfaEnabled ? 'mfa-disable' : 'mfa-start')}
        >
          {t(user.mfaEnabled ? 'disableMfa' : 'enableMfa')}
        </Button>
        {user.email && !user.emailVerified && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              action.run(
                () => api('security/send-code', 'POST', { purpose: 'VERIFY_EMAIL' }),
                () => setMode('verify-email'),
              )
            }
          >
            {t('verifyEmail')}
          </Button>
        )}
      </div>
      <p>{t('privacyAccountHelp')}</p>
      <div className="row wrap">
        <Button type="button" variant="secondary" onClick={() => setMode('export')}>
          {t('exportAccount')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setMode('delete')}>
          {t('deleteAccount')}
        </Button>
      </div>
      <ErrorNotice code={action.error} />
      <Modal
        open={Boolean(mode)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t(
          mode === 'delete'
            ? 'deleteAccount'
            : mode === 'export'
              ? 'exportAccount'
              : 'accountSecurity',
        )}
        description={t('securityProof')}
      >
        {codes ? (
          <div className="form-stack">
            <p>{t('recoveryCodesHelp')}</p>
            <pre className="recovery-codes">{codes.join('\n')}</pre>
            <Button type="button" onClick={close}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <ErrorNotice code={action.error} />
            {!enrollment && mode !== 'verify-email' && (
              <>
                <Field label={t('currentPassword')}>
                  <input name="currentPassword" type="password" autoComplete="current-password" />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    action.run(() => api('security/send-code', 'POST', { purpose: 'REAUTH' }))
                  }
                >
                  {t('sendIdentityCode')}
                </Button>
              </>
            )}
            {enrollment && (
              <>
                <p>{t('enrollmentHelp')}</p>
                <code className="break-word">{enrollment.secret}</code>
              </>
            )}
            <Field label={t('verificationCode')}>
              <input
                name="code"
                autoComplete="one-time-code"
                maxLength={80}
                required={
                  Boolean(enrollment) || mode === 'verify-email' || Boolean(user.mfaEnabled)
                }
              />
            </Field>
            {mode === 'delete' && (
              <>
                <p className="notice warning">{t('deleteAccountWarning')}</p>
                <Field label="DELETE MY ACCOUNT">
                  <input
                    name="confirmation"
                    autoComplete="off"
                    required
                    pattern="DELETE MY ACCOUNT"
                  />
                </Field>
              </>
            )}
            <Button busy={action.busy}>{t(enrollment ? 'verify' : 'confirm')}</Button>
          </form>
        )}
      </Modal>
    </section>
  );
}
