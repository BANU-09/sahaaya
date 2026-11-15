'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ScanLine, Camera, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, ErrorNotice, Field, useAction, Modal } from '../ui';
import { MedicineEditor, type MedicineDraft } from '../medicine-editor';
import { api, useResource, type Config } from '@/lib/client';
import type { z } from 'zod';
import type { extractedSchema } from '@/lib/validation';
import { LocalScanPanel } from '../local-scan-panel';
type ScanResult = {
  id: string;
  documentId: string;
  source: string;
  confidence: number | null;
  extracted: z.infer<typeof extractedSchema>;
};
export default function Scan() {
  const { data, user, can } = useCare(),
    { t } = useLocale(),
    action = useAction();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [result, setResult] = useState<ScanResult | null>(null),
    [consent, setConsent] = useState(false),
    [draft, setDraft] = useState<MedicineDraft | null>(null),
    [saved, setSaved] = useState(false);
  const config = useResource<Config>('config');
  function choose(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next && next.type.startsWith('image/') ? URL.createObjectURL(next) : '');
    setResult(null);
  }
  async function scan(sample = false) {
    await action.run(async () => {
      let documentId: string | undefined;
      if (!sample) {
        if (!file) throw new Error('No file');
        const form = new FormData();
        form.set('file', file);
        form.set('title', file.name);
        form.set('category', 'prescription');
        documentId = (
          await api<{ id: string }>(`patients/${data.patient.id}/documents`, 'POST', form)
        ).id;
      }
      return api<ScanResult>(`patients/${data.patient.id}/scan`, 'POST', {
        documentId,
        sample,
        consent,
      });
    }, setResult);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SCAN-TO-CARE</span>
          <h1>{t('scanTitle')}</h1>
          <p>{t('scanIntro')}</p>
        </div>
        <span className="round-icon lavender">
          <ScanLine />
        </span>
      </div>
      <ErrorNotice code={action.error} />
      <LocalScanPanel />
      {saved && (
        <div className="notice" role="status">
          {t('DRAFT')} ·{' '}
          <Link href="/app/medicines" className="text-link">
            {t('medicines')}
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>01 · {t('upload')}</h2>
            <Camera size={22} />
          </div>
          {config.data?.integrations.gemini && config.data?.integrations.vision && (
            <div className="scan-upload">
              {preview ? (
                <Image
                  src={preview}
                  alt={t('prescription')}
                  width={500}
                  height={350}
                  className="scan-preview"
                  unoptimized
                />
              ) : (
                <ScanLine size={55} strokeWidth={1.2} />
              )}
              <p>{t('uploadHelp')}</p>
              <Field label={t('upload')}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => choose(e.target.files?.[0] || null)}
                />
              </Field>
              <Field label={t('camera')}>
                <input
                  type="file"
                  capture="environment"
                  accept="image/*"
                  onChange={(e) => choose(e.target.files?.[0] || null)}
                />
              </Field>
            </div>
          )}
          {can('records.upload') && (
            <div className="form-stack section-space">
              {config.data?.integrations.gemini && config.data?.integrations.vision && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    {t('thirdPartyConsent')}
                  </label>
                  <Button
                    disabled={
                      !config.data?.integrations.gemini ||
                      !config.data?.integrations.vision ||
                      !file ||
                      !consent ||
                      file.type === 'application/pdf'
                    }
                    busy={action.busy}
                    onClick={() => scan()}
                  >
                    {t('extract')}
                  </Button>
                </>
              )}
              {!config.data?.integrations.gemini && (
                <p className="notice">{t('privateAIUnavailable')}</p>
              )}
              {file?.type === 'application/pdf' && <p className="notice">{t('manualEntry')}</p>}
              {user.demo && (
                <Button variant="secondary" busy={action.busy} onClick={() => scan(true)}>
                  {t('sample')}
                </Button>
              )}
              {can('medications.edit') && (
                <Button variant="ghost" onClick={() => setDraft({})}>
                  {t('manualEntry')}
                </Button>
              )}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>02 · {t('verifyDetails')}</h2>
            <ShieldCheck size={21} />
          </div>
          {result ? (
            <>
              <span className="source-tag">
                {result.source === 'DEMO_SAMPLE' ? t('demo') : 'Google Cloud Vision + Gemini'}
              </span>
              {result.confidence !== null && (
                <p className="notice">
                  OCR {Math.round(result.confidence * 100)}% · {t('verifyDetails')}
                </p>
              )}
              <div className="sample-sheet">
                <h3>{result.extracted.doctor || t('uncertain')}</h3>
                {result.extracted.medicines.map((medicine, i) => (
                  <div key={i}>
                    <p>
                      <strong>{medicine.name || t('uncertain')}</strong> ·{' '}
                      {medicine.strength || t('uncertain')}
                    </p>
                    <p>
                      {medicine.dosage || t('uncertain')} · {medicine.timing || t('uncertain')}
                    </p>
                    <p>{medicine.instructions || t('uncertain')}</p>
                    {medicine.uncertainFields.length > 0 && (
                      <p className="notice">
                        {t('uncertain')}:{' '}
                        {medicine.uncertainFields.map((field) => t(field)).join(', ')}
                      </p>
                    )}
                    {can('medications.edit') && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setDraft({
                            ...medicine,
                            doctor: result.extracted.doctor,
                            prescriptionId: result.id,
                          })
                        }
                      >
                        {t('addMedicine')}
                        <ArrowRight size={15} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <a
                className="text-link"
                href={`/api/patients/${data.patient.id}/documents/${result.documentId}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={17} />
                {t('download')}
              </a>
            </>
          ) : (
            <div className="empty">
              <FileText size={45} strokeWidth={1.2} />
              <p>{t('verifyMedicine')}</p>
            </div>
          )}
          <p className="privacy-note">{t('medicalCaution')}</p>
        </section>
      </div>
      <Modal open={Boolean(draft)} onOpenChange={() => setDraft(null)} title={t('verifyDetails')}>
        <MedicineEditor
          initial={draft || {}}
          onSaved={() => {
            setDraft(null);
            setSaved(true);
          }}
        />
      </Modal>
    </>
  );
}
