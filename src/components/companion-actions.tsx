'use client';
import { useState } from 'react';
import { DateTime } from 'luxon';
import { api } from '@/lib/client';
import { useCare } from './care-context';
import { useLocale } from './locale-provider';
import { Button, Field, Modal, ErrorNotice, useAction } from './ui';
export function CompanionActions() {
  const { data, can, refresh } = useCare(),
    { t } = useLocale(),
    action = useAction();
  const [kind, setKind] = useState<'JOURNAL' | 'APPOINTMENT' | null>(null),
    [draft, setDraft] = useState<{ id: string; payload: Record<string, unknown> } | null>(null),
    [confirmed, setConfirmed] = useState(false);
  function close() {
    setKind(null);
    setDraft(null);
    setConfirmed(false);
    action.clear();
  }
  return (
    <>
      <div className="row wrap section-space">
        {can('journal.write') && (
          <Button type="button" variant="secondary" onClick={() => setKind('JOURNAL')}>
            {t('draftCheckin')}
          </Button>
        )}
        {can('appointments.manage') && (
          <Button type="button" variant="secondary" onClick={() => setKind('APPOINTMENT')}>
            {t('draftAppointment')}
          </Button>
        )}
      </div>
      <Modal
        open={Boolean(kind)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t(kind === 'JOURNAL' ? 'draftCheckin' : 'draftAppointment')}
        description={t('companionDraftHelp')}
      >
        <ErrorNotice code={action.error} />
        {!draft ? (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const payload =
                kind === 'JOURNAL'
                  ? values
                  : {
                      ...values,
                      startsAt: DateTime.fromISO(String(values.startsAt), {
                        zone: data.patient.timezone,
                      })
                        .toUTC()
                        .toISO(),
                    };
              await action.run(
                () =>
                  api<{ id: string; payload: Record<string, unknown> }>(
                    `patients/${data.patient.id}/companion-drafts`,
                    'POST',
                    { kind, payload },
                  ),
                setDraft,
              );
            }}
          >
            {kind === 'JOURNAL' ? (
              <>
                <Field label={t('mood')}>
                  <select name="mood">
                    {['VERY_GOOD', 'GOOD', 'UNWELL', 'HELP'].map((key) => (
                      <option key={key} value={key}>
                        {t(key)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('notes')}>
                  <textarea name="note" required maxLength={2000} />
                </Field>
              </>
            ) : (
              <>
                {['doctor', 'specialty', 'hospital', 'purpose'].map((key) => (
                  <Field label={t(key)} key={key}>
                    <input name={key} required maxLength={200} />
                  </Field>
                ))}
                <Field label={`${t('dateTime')} · ${data.patient.timezone}`}>
                  <input name="startsAt" type="datetime-local" required />
                </Field>
              </>
            )}
            <Button busy={action.busy}>{t('reviewDraft')}</Button>
          </form>
        ) : (
          <div className="form-stack">
            <dl>
              {Object.entries(draft.payload)
                .filter(([, v]) => typeof v === 'string' && v)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd className="break-word">{String(value)}</dd>
                  </div>
                ))}
            </dl>
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t('confirmDraft')}
            </label>
            <Button
              type="button"
              busy={action.busy}
              disabled={!confirmed}
              onClick={() =>
                action.run(
                  () =>
                    api(`patients/${data.patient.id}/companion-drafts/${draft.id}`, 'POST', {
                      confirmed: true,
                    }),
                  () => {
                    refresh();
                    close();
                  },
                )
              }
            >
              {t('save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
              {t('edit')}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
