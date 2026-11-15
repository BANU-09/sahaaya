'use client';
import { useEffect, useState } from 'react';
import { useCare } from './care-context';
import { useLocale } from './locale-provider';
import { api, ClientError } from '@/lib/client';
import { transcriptFields, type RecordExtraction } from '@/lib/extraction';
import { Button, Field, ErrorNotice, useAction } from './ui';
import { ExtractionReview, type ExtractionEntry } from './extraction-review';
export function LocalScanPanel() {
  const { data, can } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [file, setFile] = useState<File | null>(null),
    [kind, setKind] = useState<RecordExtraction['kind']>('prescription'),
    [progress, setProgress] = useState(0),
    [result, setResult] = useState<RecordExtraction | null>(null),
    [warnings, setWarnings] = useState<string[]>([]),
    [entry, setEntry] = useState<ExtractionEntry | null>(null),
    [documentId, setDocumentId] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  if (!can('records.upload') || !can('records.view')) return null;
  async function scan() {
    await action.run(async () => {
      if (!file || file.size > 3 * 1024 * 1024) throw new ClientError('tooLarge', 413);
      setProgress(0);
      const { scanLocally } = await import('@/lib/local-scan');
      const read = await scanLocally(file, locale, setProgress);
      if (!read.text.trim()) throw new ClientError('unclearImage', 422);
      setWarnings(read.warnings);
      setResult({ kind, ...read, fields: transcriptFields(read.text) });
    });
  }
  async function save() {
    await action.run(async () => {
      if (!file || !result) return;
      let id = documentId;
      if (!id) {
        const form = new FormData();
        form.set('file', file);
        form.set('title', file.name);
        form.set('category', ['packaging', 'appointment'].includes(kind) ? 'other' : kind);
        id = (await api<{ id: string }>(`patients/${data.patient.id}/documents`, 'POST', form)).id;
        setDocumentId(id);
      }
      const saved = await api<ExtractionEntry>(
        `patients/${data.patient.id}/documents/${id}/extractions`,
        'POST',
        result,
      );
      setEntry(saved);
    });
  }
  return (
    <section className="panel section-space">
      <h2>{t('privateScan')}</h2>
      <p>{t('privateScanHelp')}</p>
      <ErrorNotice code={action.error} />
      {!entry && (
        <div className="form-stack">
          <Field label={t('category')}>
            <select
              value={kind}
              disabled={action.busy}
              onChange={(e) => {
                setKind(e.target.value as RecordExtraction['kind']);
                setResult(null);
              }}
            >
              {['prescription', 'report', 'discharge', 'appointment', 'packaging'].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('upload')}>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              disabled={action.busy}
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(selected);
                setPreview(selected ? URL.createObjectURL(selected) : '');
                setResult(null);
                setDocumentId('');
                setWarnings([]);
              }}
            />
          </Field>
          <small>{t('freeUploadLimit')}</small>
          {file && preview && (
            <a href={preview} target="_blank" rel="noreferrer" className="text-link">
              {t('original')} · {file.name}
            </a>
          )}
          <Button type="button" busy={action.busy} disabled={!file} onClick={scan}>
            {t('scanOnDevice')}
          </Button>
          {action.busy && (
            <p role="status">
              {t('readingDocument')} · {progress}%
            </p>
          )}
          {warnings.map((w) => (
            <p className="notice warning" key={w}>
              {t(w)}
            </p>
          ))}
          {result && (
            <>
              <Field label={t('transcript')}>
                <textarea value={result.text} rows={8} readOnly />
              </Field>
              <p>{t('localOcrAccuracy')}</p>
              <Button type="button" busy={action.busy} onClick={save}>
                {t('saveScanDraft')}
              </Button>
            </>
          )}
        </div>
      )}
      {entry && (
        <ExtractionReview
          entry={entry}
          path={`patients/${data.patient.id}/documents/${documentId}`}
        />
      )}
    </section>
  );
}
