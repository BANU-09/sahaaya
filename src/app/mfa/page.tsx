'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { Button, Field, ErrorNotice, useAction, Logo } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
export default function MfaPage() {
  const action = useAction(),
    router = useRouter(),
    { t } = useLocale();
  return (
    <main className="auth-main">
      <Logo />
      <h1>{t('twoFactor')}</h1>
      <p>{t('mfaPrompt')}</p>
      <ErrorNotice code={action.error} />
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const code = new FormData(e.currentTarget).get('code');
          await action.run(
            () => api('auth/mfa', 'POST', { code }),
            () => router.push('/app/home'),
          );
        }}
      >
        <Field label={t('verificationCode')}>
          <input name="code" autoComplete="one-time-code" maxLength={80} required />
        </Field>
        <Button busy={action.busy}>{t('verify')}</Button>
      </form>
    </main>
  );
}
