'use client';
import { useState } from 'react';
import { DateTime } from 'luxon';
import { useCare } from './care-context';
import { useLocale } from './locale-provider';
import { Button, Field, ErrorNotice, useAction } from './ui';
import { api } from '@/lib/client';
export type MedicineDraft = {
  id?: string;
  unitsPerDose?: number;
  route?: string | null;
  initialStock?: number;
  expiryDate?: string | null;
  schedule?: {
    frequency: string;
    times: string[];
    weekdays: number[];
    startDate: string;
    endDate: string | null;
    timezone: string;
  } | null;
  name?: string | null;
  strength?: string | null;
  dosage?: string | null;
  instructions?: string | null;
  doctor?: string | null;
  timing?: string | null;
  prescriptionId?: string | null;
};
export function MedicineEditor({
  initial = {},
  onSaved,
}: {
  initial?: MedicineDraft;
  onSaved: () => void;
}) {
  const { data, refresh } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [frequency, setFrequency] = useState(initial.schedule?.frequency || 'DAILY');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get('name'),
      strength: form.get('strength'),
      dosage: form.get('dosage'),
      instructions: form.get('instructions'),
      doctor: form.get('doctor'),
      unitsPerDose: Number(form.get('unitsPerDose')),
      route: form.get('route'),
      initialStock: Number(form.get('initialStock')),
      prescriptionId: initial.prescriptionId || undefined,
      expiryDate: form.get('expiryDate') || undefined,
      schedule: {
        frequency,
        times:
          frequency === 'PRN'
            ? []
            : String(form.get('times'))
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
        weekdays: form.getAll('weekdays').map(Number),
        startDate: form.get('startDate'),
        endDate: form.get('endDate') || null,
        timezone: data.patient.timezone,
      },
    };
    await action.run(
      () =>
        api(
          `patients/${data.patient.id}/medications${initial.id ? `/${initial.id}` : ''}`,
          initial.id ? 'PATCH' : 'POST',
          body,
        ),
      () => {
        refresh();
        onSaved();
      },
    );
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid">
        <Field label={t('medicineName')}>
          <input name="name" required defaultValue={initial.name || ''} />
        </Field>
        <Field label={t('strength')}>
          <input name="strength" required defaultValue={initial.strength || ''} />
        </Field>
      </div>
      <Field label={t('dosage')}>
        <input name="dosage" required defaultValue={initial.dosage || ''} />
      </Field>
      <div className="form-grid">
        <Field label={t('quantity')} hint={t('dosage')}>
          <input
            name="unitsPerDose"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            defaultValue={initial.unitsPerDose ?? 1}
            required
          />
        </Field>
        <Field label={t('route')}>
          <input name="route" defaultValue={initial.route || 'Oral'} required />
        </Field>
      </div>
      <Field label={t('instructions')}>
        <textarea
          name="instructions"
          defaultValue={initial.instructions || ''}
          maxLength={1000}
          required
        />
      </Field>
      <Field label={t('doctor')}>
        <input name="doctor" required defaultValue={initial.doctor || ''} />
      </Field>
      <div className="form-grid">
        <Field label={t('frequency')}>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {['DAILY', 'WEEKDAYS', 'ALTERNATE', 'PRN'].map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('stock')}>
          <input
            type="number"
            name="initialStock"
            min="0"
            max="100000"
            defaultValue={initial.initialStock ?? 0}
            required
          />
        </Field>
      </div>
      {frequency === 'WEEKDAYS' && (
        <div className="row wrap">
          {Array.from({ length: 7 }, (_, i) => (
            <label className="check-label" key={i}>
              <input
                type="checkbox"
                name="weekdays"
                value={i + 1}
                defaultChecked={initial.schedule?.weekdays.includes(i + 1)}
              />
              {DateTime.fromISO('2026-11-16').plus({ days: i }).setLocale(locale).toFormat('ccc')}
            </label>
          ))}
        </div>
      )}
      {frequency !== 'PRN' && (
        <Field label={t('times')}>
          <input
            name="times"
            required
            placeholder="08:00, 20:00"
            defaultValue={
              initial.schedule?.times.join(', ') ||
              (initial.timing && /^\d{2}:\d{2}$/.test(initial.timing) ? initial.timing : '')
            }
          />
        </Field>
      )}
      <div className="form-grid">
        <Field label={t('startDate')}>
          <input
            type="date"
            name="startDate"
            defaultValue={
              initial.schedule?.startDate ||
              DateTime.now().setZone(data.patient.timezone).toISODate()!
            }
            required
          />
        </Field>
        <Field label={t('endDate')}>
          <input type="date" name="endDate" defaultValue={initial.schedule?.endDate || ''} />
        </Field>
      </div>
      <Field label={t('expiryDate')}>
        <input
          type="date"
          name="expiryDate"
          defaultValue={initial.expiryDate?.slice(0, 10) || ''}
        />
      </Field>
      <label className="check-label">
        <input type="checkbox" required />
        {t('verifyMedicine')}
      </label>
      <p className="muted" style={{ fontSize: 11 }}>
        {t('medicalCaution')}
      </p>
      <ErrorNotice code={action.error} />
      <Button type="submit" busy={action.busy}>
        {t(initial.id ? 'save' : 'addMedicine')}
      </Button>
    </form>
  );
}
