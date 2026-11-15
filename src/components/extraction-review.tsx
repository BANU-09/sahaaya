'use client';
import { useState } from 'react';
import type { RecordExtraction } from '@/lib/extraction';
import { api } from '@/lib/client';
import { Button, Field, ErrorNotice, useAction } from './ui';
import { useLocale } from './locale-provider';
export type ExtractionEntry = {
  id: string;
  version: number;
  status: string;
  payload: RecordExtraction;
  source: string;
};
export function ExtractionReview({
  entry,
  path,
  canReview = true,
}: {
  entry: ExtractionEntry;
  path: string;
  canReview?: boolean;
}) {
  const { t } = useLocale(),
    action = useAction(),
    [payload, setPayload] = useState(entry.payload),
    [verified, setVerified] = useState(entry.status === 'VERIFIED'),
    [consent, setConsent] = useState(false);
  return (
    <section className="form-stack">
      <h3>
        {t(payload.kind)} · {t(verified ? 'verified' : 'DRAFT')}
      </h3>
      <p>{t('localOcrAccuracy')}</p>
      <p>
        {t('pages')}: {payload.pages}/{payload.totalPages} · OCR{' '}
        {payload.confidence === null ? '—' : `${Math.round(payload.confidence * 100)}%`}
      </p>
      <a className="text-link" href={`/api/${path}`} target="_blank" rel="noreferrer">
        {t('download')} · {t('original')}
      </a>
      <details>
        <summary>{t('transcript')}</summary>
        <pre className="break-word">{payload.text}</pre>
      </details>
      {payload.barcodes.length > 0 && (
        <div className="notice">
          <p>{t('barcodeCaution')}</p>
          {payload.barcodes.map((code) => (
            <code className="break-word" key={code}>
              {code}
            </code>
          ))}
        </div>
      )}
      {payload.fields.map((field, index) => (
        <fieldset key={index} className="form-stack">
          <legend>
            {t('page')} {field.sourcePage} · {index + 1}
          </legend>
          <Field label={t('fieldName')}>
            <input
              value={field.label}
              disabled={verified || !canReview}
              maxLength={160}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  fields: p.fields.map((f, i) =>
                    i === index ? { ...f, label: e.target.value } : f,
                  ),
                }))
              }
            />
          </Field>
          <Field label={t('value')}>
            <textarea
              value={field.value}
              disabled={verified || !canReview}
              maxLength={2000}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  fields: p.fields.map((f, i) =>
                    i === index ? { ...f, value: e.target.value, uncertain: true } : f,
                  ),
                }))
              }
            />
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={verified || !canReview}
              checked={!field.uncertain}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  fields: p.fields.map((f, i) =>
                    i === index ? { ...f, uncertain: !e.target.checked } : f,
                  ),
                }))
              }
            />
            {t('checkedAgainstOriginal')}
          </label>
        </fieldset>
      ))}
      {!verified && canReview && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t('extractionConsent')}
          </label>
          <ErrorNotice code={action.error} />
          <Button
            type="button"
            busy={action.busy}
            disabled={
              !consent ||
              !payload.fields.length ||
              payload.fields.some((f) => f.uncertain || !f.label.trim())
            }
            onClick={() =>
              action.run(
                () =>
                  api(`${path}/extractions`, 'PATCH', {
                    id: entry.id,
                    version: entry.version,
                    verified: true,
                    payload,
                  }),
                () => setVerified(true),
              )
            }
          >
            {t('verify')}
          </Button>
        </>
      )}
      {verified && (
        <p className="notice" role="status">
          {t('extractionVerifiedHelp')}
        </p>
      )}
    </section>
  );
}
