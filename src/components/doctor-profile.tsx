'use client';
import { useState } from 'react';
import { api, useResource, type PublicUser } from '@/lib/client';
import { useLocale } from './locale-provider';
import { Button, Field, ErrorNotice, useAction } from './ui';
type Profile = {
  id: string;
  registrationNumber: string | null;
  specialty: string;
  hospital: string;
  contact: string | null;
  location: string | null;
  consultationHours: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
};
type Application = Profile & {
  user: { name: string; email: string | null; emailVerifiedAt: string | null };
};
export function DoctorProfile({ user }: { user: PublicUser }) {
  const { t } = useLocale(),
    action = useAction(),
    [version, setVersion] = useState(0);
  const result = useResource<{ profile: Profile | null; isOperator: boolean }>(
    !user.demo ? 'doctor-profile' : null,
    version,
  );
  const reviews = useResource<Application[]>(
    result.data?.isOperator ? 'operator/doctors' : null,
    version,
  );
  if (user.demo) return null;
  return (
    <section className="panel form-stack">
      <details>
        <summary>{t('doctorProfile')}</summary>
        <p>{t('doctorVerificationHelp')}</p>
        <ErrorNotice code={result.error || action.error} />
        <p>{t(result.data?.profile?.verifiedAt ? 'verified' : 'awaitingVerification')}</p>
        {result.data?.profile?.verificationNote && <p>{result.data.profile.verificationNote}</p>}
        <form
          className="form-stack"
          key={version}
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            await action.run(
              () => api('doctor-profile', 'POST', values),
              () => setVersion((v) => v + 1),
            );
          }}
        >
          {(
            [
              'registrationNumber',
              'specialty',
              'hospital',
              'contact',
              'location',
              'consultationHours',
            ] as const
          ).map((key) => (
            <Field label={t(key)} key={key}>
              <input
                name={key}
                defaultValue={result.data?.profile?.[key] || ''}
                maxLength={
                  key === 'registrationNumber' || key === 'contact'
                    ? 100
                    : key === 'specialty' || key === 'hospital'
                      ? 200
                      : 300
                }
                required={['registrationNumber', 'specialty', 'hospital'].includes(key)}
              />
            </Field>
          ))}
          <Button busy={action.busy}>{t('submitForVerification')}</Button>
        </form>
      </details>
      {result.data?.isOperator && (
        <details>
          <summary>{t('reviewDoctors')}</summary>
          <p>{t('operatorVerificationHelp')}</p>
          <ErrorNotice code={reviews.error} />
          {reviews.data?.map((profile) => (
            <form
              key={profile.id}
              className="form-stack section-space"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(new FormData(e.currentTarget));
                await action.run(
                  () =>
                    api(`operator/doctors/${profile.id}`, 'PATCH', {
                      ...values,
                      approved: values.approved === 'on',
                    }),
                  () => setVersion((v) => v + 1),
                );
              }}
            >
              <h3>
                {profile.user.name} · {profile.registrationNumber}
              </h3>
              <p>
                {profile.specialty} · {profile.hospital} · {profile.user.email}
              </p>
              <p>{t(profile.verifiedAt ? 'verified' : 'awaitingVerification')}</p>
              <Field label={t('verificationEvidence')}>
                <textarea name="verificationNote" minLength={20} maxLength={2000} required />
              </Field>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="approved"
                  disabled={profile.user.emailVerifiedAt === null}
                />
                {t('approveDoctor')}
              </label>
              <Field label={t('currentPassword')}>
                <input name="currentPassword" type="password" autoComplete="current-password" />
              </Field>
              <Field label={t('verificationCode')}>
                <input name="code" autoComplete="one-time-code" required />
              </Field>
              <Button busy={action.busy}>{t('confirm')}</Button>
            </form>
          ))}
        </details>
      )}
    </section>
  );
}
