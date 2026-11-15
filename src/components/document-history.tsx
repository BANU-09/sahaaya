'use client';
import { useState } from 'react';
import { api, useResource } from '@/lib/client';
import { useLocale } from './locale-provider';
import { Button, Modal, Field, ErrorNotice, useAction } from './ui';
import { formatDate } from '@/lib/i18n';
import { ExtractionReview, type ExtractionEntry } from './extraction-review';
type History = {
  title: string;
  category: string;
  notes: string | null;
  version: number;
  revisions: {
    id: string;
    version: number;
    title: string;
    category: string;
    notes: string | null;
    createdAt: string;
  }[];
  extractions: ExtractionEntry[];
};
export function DocumentHistory({
  path,
  edit,
  timezone,
  refresh,
}: {
  path: string;
  edit: boolean;
  timezone: string;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false),
    [version, setVersion] = useState(0),
    action = useAction(),
    { t, locale } = useLocale();
  const result = useResource<History>(open ? `${path}/history` : null, version);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {t('documentHistory')}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('documentHistory')}
        description={t('historyHelp')}
      >
        <ErrorNotice code={result.error || action.error} />
        {result.data && (
          <>
            <form
              className="form-stack"
              key={result.data.version}
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(new FormData(e.currentTarget));
                await action.run(
                  () =>
                    api(path, 'PATCH', {
                      ...values,
                      notes: values.notes || null,
                      version: result.data!.version,
                    }),
                  () => {
                    setVersion((v) => v + 1);
                    refresh();
                  },
                );
              }}
            >
              <Field label={t('title')}>
                <input
                  name="title"
                  defaultValue={result.data.title}
                  maxLength={150}
                  required
                  disabled={!edit}
                />
              </Field>
              <Field label={t('category')}>
                <select name="category" defaultValue={result.data.category} disabled={!edit}>
                  {[
                    'prescription',
                    'report',
                    'scan',
                    'discharge',
                    'consultation',
                    'insurance',
                    'other',
                  ].map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('notes')}>
                <textarea
                  name="notes"
                  defaultValue={result.data.notes || ''}
                  maxLength={1000}
                  disabled={!edit}
                />
              </Field>
              {edit && <Button busy={action.busy}>{t('save')}</Button>}
            </form>
            <h3>
              {t('documentHistory')} · {result.data.version}
            </h3>
            {result.data.revisions.map((r) => (
              <div key={r.id}>
                <strong>
                  {r.version}. {r.title}
                </strong>
                <p>
                  {t(r.category)} · {formatDate(r.createdAt, locale, timezone)}
                </p>
                <p>{r.notes}</p>
              </div>
            ))}
            {result.data.extractions.map((entry) => (
              <ExtractionReview key={entry.id} entry={entry} path={path} canReview={edit} />
            ))}
          </>
        )}
      </Modal>
    </>
  );
}
